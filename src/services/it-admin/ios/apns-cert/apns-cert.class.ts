import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import type { Application } from '../../../../declarations'
import { MethodNotAllowed, BadRequest, NotFound } from '@feathersjs/errors'
import type { Knex } from 'knex'
import crypto from 'crypto'
import { logger } from '../../../../logger'
import {
  getS3Object,
  putS3Object,
  getApnsCertificateS3KeyByGroup,
  getApnsCertificatePrivateKeyS3KeyByGroup
} from '../../../../s3-client'

import type {
  ItAdminIosApnsCert,
  ItAdminIosApnsCertData,
  ItAdminIosApnsCertPatch,
  ItAdminIosApnsCertQuery
} from './apns-cert.schema'

export type {
  ItAdminIosApnsCert,
  ItAdminIosApnsCertData,
  ItAdminIosApnsCertPatch,
  ItAdminIosApnsCertQuery
}

export interface ItAdminIosApnsCertServiceOptions {
  app: Application
}

interface RequestLookupIds {
  requestTypeId: number
  pendingStatusId: number
  consumedStatusId: number
  supersededStatusId: number
}

export interface ItAdminIosApnsCertParams extends Params<ItAdminIosApnsCertQuery> {
  group_id?: number
  user?: {
    id?: number | string
    email?: string
  }
}

/** Summary row returned by `find`. */
export interface CertSummary {
  id: number
  cert_name: string
  topic: string | null
  issued_at: string | null
  expires_at: string | null
  is_active: boolean
  fingerprint_sha256: string | null
  credential_version: number | null
  source_request_id: number | null
  is_valid: boolean
  days_until_expiry: number | null
}

type ItAdminIosApnsCertResult = ItAdminIosApnsCert | CertSummary[] | CertSummary | string

export class ItAdminIosApnsCertService<
  ServiceParams extends ItAdminIosApnsCertParams = ItAdminIosApnsCertParams
> implements ServiceInterface<
  ItAdminIosApnsCertResult,
  ItAdminIosApnsCertData,
  ServiceParams,
  ItAdminIosApnsCertPatch
> {
  constructor(public options: ItAdminIosApnsCertServiceOptions) {}

  /** Lazy accessor for the Knex database client from app config. */
  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  /**
   * Returns the user's newest 5 APNS push certificates with summary metadata.
   * Use the `id` from these results to download the cert file via `get(id)`.
   */
  async find(params?: ServiceParams): Promise<CertSummary[]> {
    const userEmail = params!.user!.email as string
    const userId = Number(params?.user?.id)
    const groupId = Number(params?.group_id)

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequest('Authenticated user id is required to list APNS certificates.')
    }
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new BadRequest('Authorized group_id is required to list APNS certificates.')
    }

    logger.info('[Endpoint START]', {
      endpoint: 'it-admin/ios/apns-cert FIND',
      input: { userId, userEmail, groupId }
    })

    const apnsPushTypeId = await this.getCertificateTypeId('apns_push')

    const rows = await this.knexClient('certificates as c')
      .where('c.owner_group_id', groupId)
      .where('c.cert_type', apnsPushTypeId)
      .distinct(
        'c.id', 'c.cert_name', 'c.common_name', 'c.issued_at', 'c.expires_at',
        'c.is_active', 'c.fingerprint_sha256', 'c.credential_version', 'c.source_request_id'
      )
      .orderBy('c.expires_at', 'desc')
      .limit(5)

    const now = new Date()
    const result: CertSummary[] = rows.map((row: any) => {
      const expireDate = row.expires_at ? new Date(row.expires_at) : null
      const isValid = expireDate !== null && expireDate > now
      const daysUntilExpiry = expireDate
        ? Math.floor((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null

      return {
        id: row.id,
        cert_name: row.cert_name ?? null,
        topic: row.common_name ?? null,
        issued_at: row.issued_at ? new Date(row.issued_at).toISOString() : null,
        expires_at: expireDate ? expireDate.toISOString() : null,
        is_active: Boolean(row.is_active),
        fingerprint_sha256: row.fingerprint_sha256 ?? null,
        credential_version: row.credential_version ?? null,
        source_request_id: row.source_request_id ?? null,
        is_valid: isValid,
        days_until_expiry: daysUntilExpiry
      }
    })

    logger.info('[Endpoint END]', {
      endpoint: 'it-admin/ios/apns-cert FIND',
      result: { userId, userEmail, groupId, count: result.length }
    })

    return result
  }

  /**
   * Returns the PEM content of an APNS certificate by its DB id.
   * The id is available from the `find` response.
   * Validates that the certificate belongs to the requesting user before returning.
   */
  async get(id: Id, params?: ServiceParams): Promise<string> {
    const userEmail = params!.user!.email as string
    const userId = Number(params?.user?.id)
    const groupId = Number(params?.group_id)

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequest('Authenticated user id is required to download an APNS certificate.')
    }
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new BadRequest('Authorized group_id is required to download an APNS certificate.')
    }

    logger.info('[Endpoint START]', {
      endpoint: 'it-admin/ios/apns-cert GET',
      input: { userId, userEmail, groupId, id }
    })

    const apnsPushTypeId = await this.getCertificateTypeId('apns_push')

    const certRow = await this.knexClient('certificates as c')
      .where('c.id', Number(id))
      .where('c.owner_group_id', groupId)
      .where('c.cert_type', apnsPushTypeId)
      .select('c.id', 'c.storage_ref')
      .first() as { id: number; storage_ref: string | null } | undefined

    if (!certRow) {
      throw new NotFound(`Certificate with id ${id} not found for this user.`)
    }
    if (!certRow.storage_ref) {
      throw new NotFound(`Certificate storage reference is missing for cert id ${id}.`)
    }

    let certPem: string
    try {
      certPem = await getS3Object(this.options.app, certRow.storage_ref)
    } catch {
      throw new NotFound(`Certificate file could not be retrieved from storage for cert id ${id}.`)
    }

    logger.info('[Endpoint END]', {
      endpoint: 'it-admin/ios/apns-cert GET',
      result: { userId, userEmail, groupId, id, certLength: certPem.length }
    })

    return certPem
  }

  /**
   * Validate and store an uploaded Apple-signed APNS push certificate.
   *
   * Expects `data.certificate` to be a PEM string of the Apple-issued cert.
   * Matches the cert against a pending CSR request (by public key fingerprint),
   * uploads both the cert and paired private key to S3, inserts a new row in
   * `certificates`, deactivates the previous active cert, and marks the source
   * CSR request as consumed.
   */
  async create(data: ItAdminIosApnsCertData, params?: ServiceParams): Promise<CertSummary> {
    const userEmail = params!.user!.email as string
    const userId = Number(params?.user?.id)
    const groupId = Number(params?.group_id)

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequest('Authenticated user id is required to upload an APNS certificate.')
    }
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new BadRequest('Authorized group_id is required to upload an APNS certificate.')
    }

    const certificate = (data as any).certificate as string | undefined
    if (!certificate) {
      throw new BadRequest('Signed certificate PEM is required.')
    }

    logger.info('[Endpoint START]', {
      endpoint: 'it-admin/ios/apns-cert CREATE',
      input: { userId, userEmail, groupId, hasCertificate: true }
    })

    // 1) Parse and validate the uploaded cert.
    const { topic, expireDateString } = this.parseAppleMdmCert(certificate)
    const expireDate = expireDateString ? new Date(expireDateString) : null
    if (!topic) {
      throw new BadRequest('Failed to extract topic (UID) from certificate. Ensure the certificate contains a UID field.')
    }
    if (!expireDate) {
      throw new BadRequest('Failed to extract expiry date from certificate.')
    }
    if (expireDate < new Date()) {
      throw new BadRequest('The uploaded certificate is already expired.')
    }

    // 2) Load request/status lookup IDs and cert type ID.
    const {
      requestTypeId,
      pendingStatusId,
      consumedStatusId,
      supersededStatusId
    } = await this.getRequestLookupIds()
    const apnsPushTypeId = await this.getCertificateTypeId('apns_push')

    // 3) Find a pending CSR request whose private key matches the uploaded cert's public key.
    const uploadedPublicKeyFingerprint = this.getPublicKeyFingerprintFromCertPem(certificate)

    const matchingRequest = await this.knexClient('certificate_requests')
      .where({
        owner_group_id: groupId,
        request_type_id: requestTypeId,
        status_id: pendingStatusId,
        private_key_fingerprint: uploadedPublicKeyFingerprint
      })
      .andWhere('request_expires_at', '>', this.knexClient.fn.now())
      .orderBy('generated_at', 'desc')
      .first()

    let privateKeyPem: string | null = null
    let sourceRequestId: number | null = null

    if (matchingRequest?.private_key_path) {
      try {
        privateKeyPem = await getS3Object(this.options.app, matchingRequest.private_key_path)
        sourceRequestId = matchingRequest.id
      } catch {
        logger.warn('[apns-cert] Could not retrieve private key from S3', { s3Key: matchingRequest.private_key_path })
      }
    }

    if (!privateKeyPem) {
      throw new BadRequest(
        'No matching pending CSR request found for this certificate. ' +
        'Please generate or reuse the latest CSR request first.'
      )
    }

    // 4) Validate new cert and update old cert to inactive before insert, all in one transaction.
    const x509 = new crypto.X509Certificate(certificate)
    const certFingerprint = (x509.fingerprint256 || '').replace(/:/g, '').toLowerCase()
    const { newCertificateId, credentialVersion, replacedPreviousCertificate } =
      await this.knexClient.transaction(async (trx) => {
        // Lock and fetch current active cert
        const activeApnsCert = await trx('certificates as c')
          .where('c.owner_group_id', groupId)
          .where('c.cert_type', apnsPushTypeId)
          .where('c.is_active', true)
          .orderBy('c.expires_at', 'desc')
          .select('c.*')
          .forUpdate()
          .first()

        if (activeApnsCert?.storage_ref) {
          let existingCertPem: string | null = null
          try { existingCertPem = await getS3Object(this.options.app, activeApnsCert.storage_ref) } catch { /* ignore */ }
          if (existingCertPem) {
            const { topic: existingTopic, expireDateString: existingExpireDateStr } = this.parseAppleMdmCert(existingCertPem)
            const existingExpireDate = existingExpireDateStr ? new Date(existingExpireDateStr) : null
            if (existingTopic !== topic) {
              throw new BadRequest(
                'A different certificate already exists for this group. ' +
                'Contact support if you need to change the certificate topic.'
              )
            }
            if (existingExpireDate && expireDate <= existingExpireDate) {
              throw new BadRequest('The uploaded certificate is not newer than the existing active certificate.')
            }
          }
        }

        // Deactivate old cert before insert
        if (activeApnsCert?.id) {
          await trx('certificates')
            .where({ id: activeApnsCert.id })
            .update({
              is_active: false,
              replaced_by_certificate_id: null,
              updated_at: trx.fn.now()
            })
        }

        const nextCredentialVersion = Number(activeApnsCert?.credential_version || 0) + 1
        const certificateS3Key = await getApnsCertificateS3KeyByGroup(
          this.options.app,
          groupId,
          String(nextCredentialVersion)
        )
        const certificatePrivateKeyS3Key = await getApnsCertificatePrivateKeyS3KeyByGroup(
          this.options.app,
          groupId,
          String(nextCredentialVersion)
        )

        await putS3Object(this.options.app, certificateS3Key, certificate)
        await putS3Object(this.options.app, certificatePrivateKeyS3Key, privateKeyPem!)

        const certName = `APNS Push Cert (group ${groupId})`
        const insertedRows = await trx('certificates')
          .insert({
            cert_name: certName,
            cert_type: apnsPushTypeId,
            subject: x509.subject,
            common_name: topic,
            created_by_uid: userId,
            owner_group_id: groupId,
            issued_at: new Date(x509.validFrom),
            expires_at: expireDate,
            storage_type: 's3',
            storage_ref: certificateS3Key,
            storage_key: certificatePrivateKeyS3Key,
            is_active: true,
            notes: 'Apple-issued APNS push certificate uploaded by user.',
            source_request_id: sourceRequestId,
            fingerprint_sha256: certFingerprint,
            public_key_fingerprint: uploadedPublicKeyFingerprint,
            renews_certificate_id: activeApnsCert?.id || null,
            credential_version: nextCredentialVersion
          })
          .returning(['id'])

        const insertedCertificateId = insertedRows[0]?.id ?? null

        // Link old cert to new cert
        if (activeApnsCert?.id && insertedCertificateId) {
          await trx('certificates')
            .where({ id: activeApnsCert.id })
            .update({
              replaced_by_certificate_id: insertedCertificateId,
              updated_at: trx.fn.now()
            })
        }

        return {
          newCertificateId: insertedCertificateId,
          credentialVersion: nextCredentialVersion,
          replacedPreviousCertificate: Boolean(activeApnsCert?.id)
        }
      })

    // 6) Mark the source request as consumed; supersede any other pending requests for this user.
    if (sourceRequestId) {
      await this.knexClient('certificate_requests')
        .where({ id: sourceRequestId })
        .update({
          status_id: consumedStatusId,
          consumed_at: this.knexClient.fn.now(),
          updated_at: this.knexClient.fn.now()
        })

      await this.knexClient('certificate_requests')
        .where({ owner_group_id: groupId, request_type_id: requestTypeId, status_id: pendingStatusId })
        .whereNot({ id: sourceRequestId })
        .update({ status_id: supersededStatusId, updated_at: this.knexClient.fn.now() })
    }

    const now = new Date()
    const certName = `APNS Push Cert (group ${groupId})`
    const resultSummary: CertSummary = {
      id: newCertificateId!,
      cert_name: certName,
      topic,
      issued_at: x509.validFrom ? new Date(x509.validFrom).toISOString() : null,
      expires_at: expireDate ? expireDate.toISOString() : null,
      is_active: true,
      fingerprint_sha256: certFingerprint,
      credential_version: credentialVersion,
      source_request_id: sourceRequestId,
      is_valid: expireDate !== null && expireDate > now,
      days_until_expiry: expireDate
        ? Math.floor((expireDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null
    }

    logger.info('[Endpoint END]', {
      endpoint: 'it-admin/ios/apns-cert CREATE',
      result: {
        userId, userEmail, groupId, newCertificateId, credentialVersion, sourceRequestId, replacedPreviousCertificate
      }
    })

    return resultSummary
  }

  /** Parse APNS certificate UID (topic) and expiry using Node's built-in crypto module. */
  private parseAppleMdmCert(pem: string): { topic: string | null; expireDateString: string | null } {
    const x509 = new crypto.X509Certificate(pem)
    const topic = x509.subject.match(/UID=([^\n,]+)/)?.[1]?.trim() ?? null
    return { topic, expireDateString: x509.validTo }
  }

  /** Fetch the numeric IDs for the ios_apns_csr request type and the pending/consumed/superseded statuses. */
  private async getRequestLookupIds(): Promise<RequestLookupIds> {
    const result = await this.knexClient.raw(`
      select 'type' as source, code, id
      from certificate_request_types
      where code in ('ios_apns_csr')
      union all
      select 'status' as source, code, id
      from certificate_request_statuses
      where code in ('pending', 'consumed', 'superseded')
    `) as { rows: Array<{ source: 'type' | 'status'; code: string; id: number }> }

    const ids = {
      requestTypeId: result.rows.find((r) => r.source === 'type' && r.code === 'ios_apns_csr')?.id,
      pendingStatusId: result.rows.find((r) => r.source === 'status' && r.code === 'pending')?.id,
      consumedStatusId: result.rows.find((r) => r.source === 'status' && r.code === 'consumed')?.id,
      supersededStatusId: result.rows.find((r) => r.source === 'status' && r.code === 'superseded')?.id
    }

    if (!ids.requestTypeId || !ids.pendingStatusId || !ids.consumedStatusId || !ids.supersededStatusId) {
      throw new Error('Certificate request lookup rows are missing. Run the certificate request migration first.')
    }

    return ids as RequestLookupIds
  }

  /** Look up the numeric ID for a certificate type by its code string. */
  private async getCertificateTypeId(code: string): Promise<number> {
    const row = await this.knexClient('certificate_types').select('id').where({ code }).first() as
      | { id: number }
      | undefined
    if (!row?.id) {
      throw new Error(`Certificate type lookup row is missing for code "${code}". Run the certificate migration first.`)
    }
    return row.id
  }

  /** Derive the SHA-256 fingerprint of the public key extracted from a PEM certificate. */
  private getPublicKeyFingerprintFromCertPem(certPem: string): string {
    return this.sha256Hex(
      new crypto.X509Certificate(certPem).publicKey.export({ type: 'spki', format: 'der' })
    )
  }

  /** Return the hex-encoded SHA-256 digest of the given input. */
  private sha256Hex(input: crypto.BinaryLike): string {
    return crypto.createHash('sha256').update(input).digest('hex')
  }

  async update(_id: NullableId, _data: ItAdminIosApnsCertData, _params?: ServiceParams): Promise<CertSummary> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async patch(_id: NullableId, _data: ItAdminIosApnsCertPatch, _params?: ServiceParams): Promise<CertSummary> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async remove(_id: NullableId, _params?: ServiceParams): Promise<CertSummary> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

export const getOptions = (app: Application) => {
  return { app }
}
