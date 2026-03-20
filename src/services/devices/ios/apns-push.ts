import apn from 'apn';
import type { Knex } from 'knex';

import type { Application } from '../../../declarations'
import { getS3Object } from '../../../s3-client'
import { logger } from '../../../logger';

/** Send an APNS MDM wake-up push to a device using the active APNS certificate for the owning group. */
export async function sendApnsPush(
    app: Application,
    deviceToken: any,
    pushMagic: string,
    groupId: number,
    topic: string
) {
    const { certPem, keyPem, topic: certificateTopic } = await getActiveApnsPushCredentials(app, groupId);

    // Ensure the device record is still associated with the same APNS topic as the active certificate.
    if (topic && certificateTopic && topic !== certificateTopic) {
        throw new Error(
            `Device topic "${topic}" does not match active APNS certificate topic "${certificateTopic}" for group ${groupId}.`
        );
    }

    // Create a provider instance using the current APNS certificate and private key.
    const apnProvider = new apn.Provider({
        cert: certPem,
        key: keyPem,
        production: true
    });

    // Build the silent MDM notification payload that tells the device to reconnect to the server.
    const notification: any = new apn.Notification();
    notification.payload = { mdm: pushMagic };
    notification.topic = certificateTopic;
    notification.priority = 10;
    notification.pushType = "background";

    // Device tokens stored in DB are kept as hex strings; older in-memory values may still be buffers.
    const normalizedToken = typeof deviceToken === 'string' ? deviceToken.trim() : null;
    const deviceTokenHex =
      normalizedToken && /^[a-f0-9]+$/i.test(normalizedToken) && normalizedToken.length % 2 === 0
        ? normalizedToken.toLowerCase()
        : Buffer.from(deviceToken?.data || deviceToken).toString('hex');

    try {
        // Send the background push through APNS.
        const result = await apnProvider.send(notification, deviceTokenHex);
        
        if (result.failed && result.failed.length > 0) {
        // Log the first reported APNS failure so command send issues can be diagnosed.
        logger.error('[APNS] Failed:', result.failed[0].response);
        } else {
        logger.info('[APNS] Push sent successfully to device');
        }
    } catch (err) {
        logger.error('[APNS] Error connecting to Apple:', err);
    } finally {
        // Always tear down the provider to release sockets and credentials after the send attempt.
        apnProvider.shutdown();
    }
}

/** Load the active APNS certificate, private key, and topic for the specified group. */
async function getActiveApnsPushCredentials(
    app: Application,
    groupId: number
): Promise<{ certPem: string; keyPem: string; topic: string }> {
    const knexClient = app.get('knexClient') as Knex
    const apnsPushTypeId = await getCertificateTypeId(knexClient, 'apns_push')

    // Use the newest active, non-expired APNS certificate row for the group.
    const activeApnsCert = await knexClient('certificates as c')
        .where('c.owner_group_id', groupId)
        .where('c.cert_type', apnsPushTypeId)
        .where('c.is_active', true)
        .andWhere('c.expires_at', '>', knexClient.fn.now())
        .orderBy('c.expires_at', 'desc')
        .select('c.storage_ref', 'c.storage_key', 'c.common_name')
        .first() as { storage_ref: string | null; storage_key: string | null; common_name: string | null } | undefined

    if (!activeApnsCert?.storage_ref || !activeApnsCert?.storage_key || !activeApnsCert?.common_name) {
        throw new Error(`Active APNS push certificate material not found for group_id ${groupId}.`)
    }

    // The certificate and its private key are stored separately in S3.
    const [certPem, keyPem] = await Promise.all([
        getS3Object(app, activeApnsCert.storage_ref),
        getS3Object(app, activeApnsCert.storage_key)
    ])

    return {
        certPem,
        keyPem,
        topic: activeApnsCert.common_name
    }
}

/** Look up the numeric ID for a certificate type by its code string. */
async function getCertificateTypeId(knexClient: Knex, code: string): Promise<number> {
    const row = await knexClient('certificate_types')
        .select('id')
        .where({ code })
        .first() as { id: number } | undefined

    if (!row?.id) {
        throw new Error(`Certificate type lookup row is missing for code "${code}".`)
    }

    return row.id
}
