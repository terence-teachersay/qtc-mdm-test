import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import type { Application } from '../../../../declarations'
import { MethodNotAllowed, BadRequest } from '@feathersjs/errors'
import type { Knex } from 'knex'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import forge from 'node-forge'
import { logger } from '../../../../logger'
import { putS3Object, getS3Object, s3ObjectExists, getApnsRequestS3PrefixByGroup } from '../../../../s3-client'
import {
  createSecretsManagerClient,
  getActiveCertificateSecretRefRow,
  getCertificateTypeId,
  getSystemGroupId,
  loadSecretBackedCertificateMaterial
} from '../../../../certificate-secrets'

import type {
  ItAdminIosApnsCsr,
  ItAdminIosApnsCsrData,
  ItAdminIosApnsCsrPatch,
  ItAdminIosApnsCsrQuery
} from './apns-csr.schema'

export type {
  ItAdminIosApnsCsr,
  ItAdminIosApnsCsrData,
  ItAdminIosApnsCsrPatch,
  ItAdminIosApnsCsrQuery
}

export interface ItAdminIosApnsCsrServiceOptions {
  app: Application
}

interface VendorCerts {
  vendorKeyPem: string
  vendorCertPem: string
  wwdrCertPem: string
  rootCertPem: string
}

interface CertificateRequestRow {
  id: number
  request_payload_path: string
  download_count: number
  request_expires_at: Date
}

interface RequestLookupIds {
  requestTypeId: number
  pendingStatusId: number
  expiredStatusId: number
  supersededStatusId: number
}


export interface ItAdminIosApnsCsrParams extends Params<ItAdminIosApnsCsrQuery> {
  group_id?: number
  user?: {
    id?: number | string
    email?: string
  }
}

type ItAdminIosApnsCsrResult = ItAdminIosApnsCsr | string

export class ItAdminIosApnsCsrService<
  ServiceParams extends ItAdminIosApnsCsrParams = ItAdminIosApnsCsrParams
> implements ServiceInterface<
  ItAdminIosApnsCsrResult,
  ItAdminIosApnsCsrData,
  ServiceParams,
  ItAdminIosApnsCsrPatch
> {
  /** Initialize the APNS CSR service with the current application instance. */
  constructor(public options: ItAdminIosApnsCsrServiceOptions) {}

  /** Lazy accessor for the Knex database client from app config. */
  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  /**
   * Generates the Apple APNS CSR upload payload for a user.
   * Returns an existing unexpired request when available; otherwise it creates a new one,
   * stores request metadata in Postgres, and returns the base64 request content for Apple upload.
   */
  async get(id: Id, params?: ServiceParams): Promise<string> {
    const groupId = Number(params?.group_id)
    const userId = Number(params?.user?.id)
    logger.info('[Endpoint START]', {
      endpoint: 'it-admin/ios/apns-csr GET',
      query: params?.query || null,
      input: {
        userId: Number.isFinite(userId) ? userId : null,
        userEmail: params?.user?.email || null,
        groupId: Number.isInteger(groupId) ? groupId : null
      }
    })

    const userEmail = params!.user!.email as string
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequest('Authenticated user id is required to generate an APNS CSR request.')
    }
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new BadRequest('Authorized group_id is required to generate an APNS CSR request.')
    }

    // 1) Resolve request/status lookup IDs and certificate type ID, then expire stale pending requests.
    const {
      requestTypeId,
      pendingStatusId,
      expiredStatusId,
      supersededStatusId
    } = await this.getRequestLookupIds()
    const apnsPushTypeId = await getCertificateTypeId(this.knexClient, 'apns_push')

    // 2) Mark all pending requests that already passed their expiry timestamp as expired.
    // This keeps only truly reusable pending requests for the next lookup step.
    await this.knexClient('certificate_requests')
      .where({ owner_group_id: groupId, request_type_id: requestTypeId, status_id: pendingStatusId })
      .andWhere('request_expires_at', '<=', this.knexClient.fn.now())
      .update({ status_id: expiredStatusId, updated_at: this.knexClient.fn.now() })

    // 3) Check if a valid pending request already exists.
    const existingRequest = await this.knexClient('certificate_requests')
      .where({ owner_group_id: groupId, request_type_id: requestTypeId, status_id: pendingStatusId })
      .andWhere('request_expires_at', '>', this.knexClient.fn.now())
      .orderBy('generated_at', 'desc')
      .first() as CertificateRequestRow | undefined

    // 4) Reuse existing request payload from S3 only when still valid 
    // and not expiring within 1 day before the vendor cert expired
    // The expired time save in CSR is already 1 day before the vendor cert expired, 
    // so just check if it's already expired or not. 
    const renewBefore = new Date(Date.now() )
    const hasEnoughValidityLeft = existingRequest 
      ? new Date(existingRequest.request_expires_at) > renewBefore
      : false

    let resultPayload: string
    let requestId: number | null = null
    let reusedExistingRequest = false
    let resultRequestExpiresAt: Date | undefined

    if (existingRequest && hasEnoughValidityLeft && await s3ObjectExists(this.options.app, existingRequest.request_payload_path)) {
      await this.knexClient('certificate_requests')
        .where({ id: existingRequest.id })
        .update({
          download_count: this.knexClient.raw('download_count + 1'),
          latest_downloaded_at: this.knexClient.fn.now(),
          updated_at: this.knexClient.fn.now()
        })

      resultPayload = await getS3Object(this.options.app, existingRequest.request_payload_path)
      requestId = existingRequest.id
      reusedExistingRequest = true
    } else {
      // 5) Invalidate old pending request (missing payload or expiring within 1 day) before regenerating.
      if (existingRequest) {
        await this.knexClient('certificate_requests')
          .where({ id: existingRequest.id })
          .update({ status_id: supersededStatusId, updated_at: this.knexClient.fn.now() })
      }

      // 6) Load and validate vendor signing materials from Secrets Manager.
      // and set new CSR expire time to at least 1 day before the vendor cert expires 
      // to allow for safe reuse until the last moment.
      const { vendorKeyPem, vendorCertPem, wwdrCertPem, rootCertPem } = await this.loadVendorCerts()
      const vendorCert = new crypto.X509Certificate(vendorCertPem)
      const vendorCertExpiresAt = new Date(vendorCert.validTo)
      const requestExpiresAt = new Date(vendorCertExpiresAt.getTime() - 24 * 60 * 60 * 1000)

      if (requestExpiresAt <= new Date()) {
        throw new BadRequest('Vendor certificate is too close to expiry to generate a reusable APNS CSR request.')
      }

      const activeApnsCert = await this.knexClient('certificates as c')
        .where('c.owner_group_id', groupId)
        .where('c.cert_type', apnsPushTypeId)
        .where('c.is_active', true)
        .orderBy('c.expires_at', 'desc')
        .select('c.id')
        .first()

      // 7) Verify vendor keypair and generate customer key + CSR entirely in memory.
      const requestSlug = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`

      // Confirm the vendor private key matches the vendor cert before proceeding.
      const vendorPubFromCert = (new crypto.X509Certificate(vendorCertPem)).publicKey.export({ type: 'spki', format: 'der' }) as Buffer
      const vendorPubFromKey = crypto.createPublicKey(crypto.createPrivateKey(vendorKeyPem)).export({ type: 'spki', format: 'der' }) as Buffer
      if (!vendorPubFromCert.equals(vendorPubFromKey)) {
        throw new BadRequest('Vendor private key does not match vendor certificate.')
      }

      // Generate an RSA-2048 customer private key.
      // Build the CSR in memory using node-forge (no temp files needed).
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      })

      const forgePrivKey = forge.pki.privateKeyFromPem(privateKey)
      const forgeCSR = forge.pki.createCertificationRequest()
      forgeCSR.publicKey = forge.pki.rsa.setPublicKey(forgePrivKey.n, forgePrivKey.e)
      forgeCSR.setSubject([{ name: 'commonName', value: userEmail }])
      forgeCSR.sign(forgePrivKey, forge.md.sha256.create())
      const csrDer = Buffer.from(forge.asn1.toDer(forge.pki.certificationRequestToAsn1(forgeCSR)).getBytes(), 'binary')
      const csrB64 = csrDer.toString('base64')

      // 8) Sign the raw CSR DER bytes with the vendor private key (RSA-SHA256).
      // Apple requires this signature to prove the CSR was submitted by an authorised vendor.
      const signer = crypto.createSign('RSA-SHA256')
      signer.update(csrDer)
      signer.end()
      const signature = signer.sign(vendorKeyPem)
      const signatureB64 = signature.toString('base64')

      // 9) Build Apple upload plist, then base64-encode the final request payload.
      const vendorPem = vendorCertPem.replace(/\r\n/g, '\n').trim()
      const wwdrPem = wwdrCertPem.replace(/\r\n/g, '\n').trim()
      const rootPem = rootCertPem.replace(/\r\n/g, '\n').trim()
      const certChainPem = `${vendorPem}\n${wwdrPem}\n${rootPem}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      const plistTemplate = fs.readFileSync(path.join(__dirname, './pushCertRequest_template.plist'), 'utf8')
      const plist = plistTemplate
        .replace('__csrB64__', csrB64)
        .replace('__certChainPem__', certChainPem)
        .replace('__signatureB64__', signatureB64)

      const finalReq = Buffer.from(plist, 'utf8').toString('base64')

      // 10) Upload request artifacts directly to S3 from memory.
      const s3Prefix = await getApnsRequestS3PrefixByGroup(this.options.app, groupId, requestSlug)
      const privateKeyS3Key = `${s3Prefix}/customer.key`
      const requestPayloadS3Key = `${s3Prefix}/customer_apple_upload.req`
      await putS3Object(this.options.app, privateKeyS3Key, privateKey)
      await putS3Object(this.options.app, requestPayloadS3Key, finalReq)

      // 11) Persist request metadata in DB.
      const privateKeyFingerprint = this.getPublicKeyFingerprintFromPrivateKeyPem(privateKey)
      const csrFingerprint = this.sha256Hex(csrDer)
      const insertedRows = await this.knexClient('certificate_requests')
        .insert({
          request_type_id: requestTypeId,
          status_id: pendingStatusId,
          created_by_uid: userId,
          owner_group_id: groupId,
          renews_certificate_id: activeApnsCert?.id || null,
          request_expires_at: requestExpiresAt,
          vendor_cert_expires_at: vendorCertExpiresAt,
          latest_downloaded_at: this.knexClient.fn.now(),
          download_count: 1,
          private_key_fingerprint: privateKeyFingerprint,
          csr_fingerprint: csrFingerprint,
          request_payload_path: requestPayloadS3Key,
          csr_der_path: null,
          private_key_path: privateKeyS3Key,
          updated_at: this.knexClient.fn.now()
        })
        .returning(['id'])

      resultPayload = finalReq
      requestId = insertedRows[0]?.id ?? null
      resultRequestExpiresAt = requestExpiresAt
    }

    logger.info('[Endpoint END]', {
      endpoint: 'it-admin/ios/apns-csr GET',
      id,
      result: {
        userId,
        userEmail,
        groupId,
        requestId,
        reusedExistingRequest,
        ...(resultRequestExpiresAt ? { requestExpiresAt: resultRequestExpiresAt.toISOString() } : {}),
        resultLength: resultPayload.length
      }
    })

    return resultPayload
  }

  /** Load vendor private key and cert chain using certificate DB rows that point at Secrets Manager values. */
  private async loadVendorCerts(): Promise<VendorCerts> {
    const systemGroupId = await getSystemGroupId(this.knexClient)

    const [vendorRow, wwdrRow, rootRow] = await Promise.all([
      getActiveCertificateSecretRefRow(this.knexClient, 'mdm_vendor', systemGroupId),
      getActiveCertificateSecretRefRow(this.knexClient, 'apple_wwdr', systemGroupId),
      getActiveCertificateSecretRefRow(this.knexClient, 'apple_root', systemGroupId)
    ])

    const client = createSecretsManagerClient(this.options.app)
    const secretCache = new Map<string, Record<string, string>>()
    const [vendorMaterial, wwdrMaterial, rootMaterial] = await Promise.all([
      loadSecretBackedCertificateMaterial(client, secretCache, vendorRow, {
        certFieldLabel: 'mdm_vendor storage_ref',
        keyFieldLabel: 'mdm_vendor storage_key',
        requirePrivateKey: true
      }),
      loadSecretBackedCertificateMaterial(client, secretCache, wwdrRow, {
        certFieldLabel: 'apple_wwdr storage_ref'
      }),
      loadSecretBackedCertificateMaterial(client, secretCache, rootRow, {
        certFieldLabel: 'apple_root storage_ref'
      })
    ])

    const vendorKeyPem = vendorMaterial.keyPem!
    const vendorCertPem = vendorMaterial.certPem
    const wwdrCertPem = wwdrMaterial.certPem
    const rootCertPem = rootMaterial.certPem

    try {
      crypto.createPrivateKey(vendorKeyPem)
    } catch (_error) {
      throw new BadRequest(
        `Invalid PEM in Secrets Manager reference "${vendorMaterial.keyReference}". ` +
        'Ensure it includes BEGIN/END headers and real line breaks.'
      )
    }

    try {
      new crypto.X509Certificate(vendorCertPem)
    } catch (_error) {
      throw new BadRequest(
        `Invalid PEM in Secrets Manager reference "${vendorMaterial.certReference}". ` +
        'Ensure it includes BEGIN/END headers and real line breaks.'
      )
    }

    try {
      new crypto.X509Certificate(wwdrCertPem)
    } catch (_error) {
      throw new BadRequest(
        `Invalid PEM in Secrets Manager reference "${wwdrMaterial.certReference}". ` +
        'Ensure it includes BEGIN/END headers and real line breaks.'
      )
    }

    try {
      new crypto.X509Certificate(rootCertPem)
    } catch (_error) {
      throw new BadRequest(
        `Invalid PEM in Secrets Manager reference "${rootMaterial.certReference}". ` +
        'Ensure it includes BEGIN/END headers and real line breaks.'
      )
    }

    return {
      vendorKeyPem,
      vendorCertPem,
      wwdrCertPem,
      rootCertPem
    }
  }

  /** Fetch the numeric IDs for the ios_apns_csr request type and the pending/expired/superseded statuses. */
  private async getRequestLookupIds(): Promise<RequestLookupIds> {
    const result = await this.knexClient.raw(
      `
        select 'type' as source, code, id
        from certificate_request_types
        where code in ('ios_apns_csr')
        union all
        select 'status' as source, code, id
        from certificate_request_statuses
        where code in ('pending', 'expired', 'superseded')
      `
    ) as { rows: Array<{ source: 'type' | 'status'; code: string; id: number }> }

    const ids = {
      requestTypeId: result.rows.find((row) => row.source === 'type' && row.code === 'ios_apns_csr')?.id,
      pendingStatusId: result.rows.find((row) => row.source === 'status' && row.code === 'pending')?.id,
      expiredStatusId: result.rows.find((row) => row.source === 'status' && row.code === 'expired')?.id,
      supersededStatusId: result.rows.find((row) => row.source === 'status' && row.code === 'superseded')?.id
    }

    if (!ids.requestTypeId || !ids.pendingStatusId || !ids.expiredStatusId || !ids.supersededStatusId) {
      throw new Error('Certificate request lookup rows are missing. Run the certificate request migration first.')
    }

    return ids as RequestLookupIds
  }

  /** Derive the SHA-256 fingerprint of the public key extracted from a PKCS#8 PEM private key. */
  private getPublicKeyFingerprintFromPrivateKeyPem(privateKeyPem: string): string {
    const privateKey = crypto.createPrivateKey(privateKeyPem)
    const publicKeyDer = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' })
    return this.sha256Hex(publicKeyDer)
  }

  /** Return the hex-encoded SHA-256 digest of the given input. */
  private sha256Hex(input: crypto.BinaryLike): string {
    return crypto.createHash('sha256').update(input).digest('hex')
  }

  /** Listing APNS CSR resources is not supported by this service. */
  async find(_params?: ServiceParams): Promise<ItAdminIosApnsCsr[]> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Direct APNS CSR creation is not supported; clients must use the GET flow that reuses or generates the payload. */
  async create(_data: ItAdminIosApnsCsrData, _params?: ServiceParams): Promise<ItAdminIosApnsCsrResult> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Full APNS CSR updates are not supported by this service. */
  async update(
    _id: NullableId,
    _data: ItAdminIosApnsCsrData,
    _params?: ServiceParams
  ): Promise<ItAdminIosApnsCsr> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Partial APNS CSR updates are not supported by this service. */
  async patch(
    _id: NullableId,
    _data: ItAdminIosApnsCsrPatch,
    _params?: ServiceParams
  ): Promise<ItAdminIosApnsCsr> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** APNS CSR deletion is not supported by this service. */
  async remove(_id: NullableId, _params?: ServiceParams): Promise<ItAdminIosApnsCsr> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

/** Build the service options object used when registering the APNS CSR service. */
export const getOptions = (app: Application) => {
  return { app }
}
