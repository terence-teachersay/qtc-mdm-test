// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import { BadRequest, MethodNotAllowed } from '@feathersjs/errors'
import forge from 'node-forge'
import type { Knex } from 'knex'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { execFile as execFileCb } from 'node:child_process'
import { promisify } from 'node:util'
import type { Application } from '../../../../declarations'
import { logger } from '../../../../logger'
import {
  createSecretsManagerClient,
  getActiveCertificateSecretRefRow,
  getSystemGroupId,
  loadSecretBackedCertificateMaterial
} from '../../../../certificate-secrets'
import type {
  DevicesIosScep,
  DevicesIosScepData,
  DevicesIosScepPatch,
  DevicesIosScepQuery
} from './scep.schema'

const execFile = promisify(execFileCb)

export type { DevicesIosScep, DevicesIosScepData, DevicesIosScepPatch, DevicesIosScepQuery }

export interface DevicesIosScepServiceOptions {
  app: Application
}

export interface DevicesIosScepParams extends Params<DevicesIosScepQuery> {}

interface ScepResponse {
  contentType: string
  body: Buffer | string
}

const SCEP_ATTR_OIDS = {
  messageType: '2.16.840.1.113733.1.9.2',
  pkiStatus: '2.16.840.1.113733.1.9.3',
  senderNonce: '2.16.840.1.113733.1.9.5',
  recipientNonce: '2.16.840.1.113733.1.9.6',
  transactionId: '2.16.840.1.113733.1.9.7'
} as const

interface ParsedScepRequestAttributes {
  messageType?: string
  transactionId?: string
  senderNonceBinary?: string
  senderNonceHex?: string
}

interface RequesterIdentity {
  certificate: forge.pki.Certificate
  publicKey: forge.pki.PublicKey
  subjectAttributes: forge.pki.CertificateField[]
}

export class DevicesIosScepService<
  ServiceParams extends DevicesIosScepParams = DevicesIosScepParams
> implements ServiceInterface<DevicesIosScep, DevicesIosScepData, ServiceParams, DevicesIosScepPatch> {
  private caCertificatePem: string | null = null
  private caPrivateKeyPem: string | null = null
  private caCertificateRowId: number | null = null
  private caMaterialsPromise: Promise<void> | null = null

  /** Initialize the SCEP service. */
  constructor(public options: DevicesIosScepServiceOptions) {}

  /** Lazy accessor for the Knex database client from app config. */
  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  /** Handle SCEP GET operations for CA capabilities and certificate. */
  async find(params?: ServiceParams): Promise<any> {
    await this.ensureCaMaterialsLoaded()

    const operation = String(params?.query?.operation || '').trim()
    logger.info('[Endpoint START]', {
      endpoint: 'devices/ios/scep FIND',
      id: null,
      query: params?.query || null,
      input: {
        operation
      }
    })

    let response: ScepResponse | null = null

    if (operation === 'GetCACaps') {
      response = {
        contentType: 'text/plain',
        body: ['POSTPKIOperation', 'SHA-256', 'AES', 'DES3'].join('\n')
      } satisfies ScepResponse
    }

    if (operation === 'GetCACert') {
      const { certPem: caCertificatePem } = this.getCaMaterials()
      const caCert = forge.pki.certificateFromPem(caCertificatePem)
      const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(caCert)).getBytes()

      response = {
        contentType: 'application/x-x509-ca-cert',
        body: Buffer.from(derBytes, 'binary')
      } satisfies ScepResponse
    }

    if (!response) {
      throw new BadRequest('Unsupported SCEP operation. Use GetCACaps, GetCACert, or PKIOperation')
    }

    logger.info('[Endpoint END]', {
      endpoint: 'devices/ios/scep FIND',
      id: null,
      result: {
        operation,
        contentType: response.contentType,
        bytes: Buffer.isBuffer(response.body) ? response.body.length : Buffer.byteLength(response.body, 'utf8')
      }
    })

    return response
  }

  async get(_id: Id, _params?: ServiceParams): Promise<DevicesIosScep> {
    throw new MethodNotAllowed('Method not allowed. Use GET /devices/ios/scep?operation=...')
  }

  /** Handle SCEP PKIOperation POST and return CertRep payload. */
  async create(_data: DevicesIosScepData, params?: ServiceParams): Promise<DevicesIosScep>
  async create(_data: DevicesIosScepData[], params?: ServiceParams): Promise<DevicesIosScep[]>
  async create(_data: DevicesIosScepData | DevicesIosScepData[], params?: ServiceParams): Promise<any> {
    await this.ensureCaMaterialsLoaded()

    const operation = String(params?.query?.operation || '').trim()
    const payload = (params as any)?.rawBody as Buffer

    logger.info('[Endpoint START]', {
      endpoint: 'devices/ios/scep CREATE',
      id: null,
      query: params?.query || null,
      input: {
        operation,
        payloadBytes: Buffer.isBuffer(payload) ? payload.length : 0,
        hasPayload: Buffer.isBuffer(payload) && payload.length > 0
      }
    })

    if (operation !== 'PKIOperation') {
      throw new BadRequest('Unsupported SCEP operation. Use PKIOperation for POST')
    }

    if (!Buffer.isBuffer(payload) || payload.length === 0) {
      throw new BadRequest('Missing PKIOperation payload')
    }

    const body = await this.handlePkiOperation(payload)

    const response = {
      contentType: 'application/x-pki-message',
      body
    }

    logger.info('[Endpoint END]', {
      endpoint: 'devices/ios/scep CREATE',
      id: null,
      result: {
        operation,
        contentType: response.contentType,
        bytes: body.length
      }
    })

    return response
  }

  /** Process PKIOperation payload and build a signed response. */
  async handlePkiOperation(payload: Buffer): Promise<Buffer> {
    const debugId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const debugDir = path.join(process.cwd(), 'logs', 'scep-debug')
    mkdirSync(debugDir, { recursive: true })

    const requestDumpPath = path.join(debugDir, `${debugId}-request.der`)
    const requestCmsTextPath = path.join(debugDir, `${debugId}-request.cms.txt`)
    const responseDumpPath = path.join(debugDir, `${debugId}-response.der`)
    const responseCmsTextPath = path.join(debugDir, `${debugId}-response.cms.txt`)

    writeFileSync(requestDumpPath, payload)
    await this.dumpCms(requestDumpPath, requestCmsTextPath)

    const requester = this.extractRequesterIdentity(payload)
    const requestAttrs = this.extractScepRequestAttributes(payload)

    const issuedCertPem = this.issueDeviceCertificatePem(requester)
    const response = this.buildCertRepWithForge(issuedCertPem, requestAttrs, requester?.certificate || null)

    writeFileSync(responseDumpPath, response)
    await this.dumpCms(responseDumpPath, responseCmsTextPath)

    return response
  }

  /** Build CertRep SignedData with SCEP authenticated attributes. */
  private buildCertRepWithForge(
    issuedCertPem: string,
    requestAttrs: ParsedScepRequestAttributes | null,
    requesterCertificate: forge.pki.Certificate | null
  ): Buffer {
    const { certPem: caCertificatePem, keyPem: caPrivateKeyPem } = this.getCaMaterials()
    const caCert = forge.pki.certificateFromPem(caCertificatePem)
    const caKey = forge.pki.privateKeyFromPem(caPrivateKeyPem)
    const issuedCert = forge.pki.certificateFromPem(issuedCertPem)

    const senderNonceBinary = forge.random.getBytesSync(16)
    const authenticatedAttributes: Array<{ type: string; value?: any }> = [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: SCEP_ATTR_OIDS.messageType, value: '3' },
      { type: SCEP_ATTR_OIDS.pkiStatus, value: '0' },
      { type: SCEP_ATTR_OIDS.senderNonce, value: senderNonceBinary }
    ]

    if (requestAttrs?.transactionId) {
      authenticatedAttributes.push({ type: SCEP_ATTR_OIDS.transactionId, value: requestAttrs.transactionId })
    }
    if (requestAttrs?.senderNonceBinary) {
      authenticatedAttributes.push({ type: SCEP_ATTR_OIDS.recipientNonce, value: requestAttrs.senderNonceBinary })
    }

    const signed = forge.pkcs7.createSignedData()
    signed.content = forge.util.createBuffer(
      this.buildPkiMessageContentBinary(issuedCert, caCert, requesterCertificate)
    )
    signed.addCertificate(issuedCert)
    signed.addCertificate(caCert)
    signed.addSigner({
      key: caKey,
      certificate: caCert,
      digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes
    })
    signed.sign()

    // node-forge emits empty values for unknown signed attribute OIDs.
    // SCEP requires concrete values, so inject them explicitly and re-sign.
    this.applyScepSignedAttributes(signed as any, caKey, {
      transactionId: requestAttrs?.transactionId,
      senderNonceBinary,
      recipientNonceBinary: requestAttrs?.senderNonceBinary
    })

    const der = forge.asn1.toDer(signed.toAsn1()).getBytes()
    return Buffer.from(der, 'binary')
  }

  /** Inject SCEP-specific signed attributes and re-sign signer info. */
  private applyScepSignedAttributes(
    signed: any,
    signingKey: forge.pki.PrivateKey,
    values: { transactionId?: string; senderNonceBinary: string; recipientNonceBinary?: string }
  ): void {
    const signer = signed?.signers?.[0]
    if (!signer?.authenticatedAttributesAsn1) {
      return
    }

    const attrs = signer.authenticatedAttributesAsn1.value as any[]
    const withoutScepAttrs = attrs.filter((attr) => {
      const oidNode = attr?.value?.[0] as any
      if (!oidNode || typeof oidNode.value !== 'string') {
        return true
      }
      const oid = forge.asn1.derToOid(oidNode.value)
      return !Object.values(SCEP_ATTR_OIDS).includes(oid as any)
    })

    withoutScepAttrs.push(this.makePrintableAttr(SCEP_ATTR_OIDS.messageType, '3'))
    withoutScepAttrs.push(this.makePrintableAttr(SCEP_ATTR_OIDS.pkiStatus, '0'))
    withoutScepAttrs.push(this.makeOctetAttr(SCEP_ATTR_OIDS.senderNonce, values.senderNonceBinary))
    if (values.recipientNonceBinary) {
      withoutScepAttrs.push(this.makeOctetAttr(SCEP_ATTR_OIDS.recipientNonce, values.recipientNonceBinary))
    }
    if (values.transactionId) {
      withoutScepAttrs.push(this.makePrintableAttr(SCEP_ATTR_OIDS.transactionId, values.transactionId))
    }

    signer.authenticatedAttributesAsn1.value = withoutScepAttrs

    const signedAttrsSet = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SET,
      true,
      withoutScepAttrs
    )
    const md = forge.md.sha256.create()
    md.update(forge.asn1.toDer(signedAttrsSet).getBytes())
    signer.signatureAlgorithm = forge.pki.oids.sha256WithRSAEncryption
    signer.signature = (signingKey as any).sign(md, 'RSASSA-PKCS1-V1_5')

    this.syncSignerInfoAsn1(signed, signer)
  }

  /** Sync signer ASN.1 fields after manual signature updates. */
  private syncSignerInfoAsn1(signed: any, signer: any): void {
    const signerInfoAsn1 = signed?.signerInfos?.[0]
    if (!signerInfoAsn1?.value || !Array.isArray(signerInfoAsn1.value)) {
      return
    }

    // SignerInfo SEQUENCE: version, issuerAndSerial, digestAlg, authAttrs, sigAlg, signature
    const sigAlgSeq = signerInfoAsn1.value[4]
    const sigValue = signerInfoAsn1.value[5]
    if (sigAlgSeq?.value?.[0]) {
      sigAlgSeq.value[0].value = forge.asn1.oidToDer(forge.pki.oids.sha256WithRSAEncryption).getBytes()
    }
    if (sigValue) {
      sigValue.value = signer.signature
    }
  }

  /** Build certificate payload for CertRep content. */
  private buildCertPayloadBinary(issuedCert: forge.pki.Certificate, caCert: forge.pki.Certificate): string {
    // CertRep content carries a CMS object containing the issued certificate.
    const certPayload = forge.pkcs7.createSignedData()
    certPayload.content = forge.util.createBuffer('')
    certPayload.addCertificate(issuedCert)
    certPayload.addCertificate(caCert)
    return forge.asn1.toDer(certPayload.toAsn1()).getBytes()
  }

  /** Build SCEP PKI message content, enveloped when requester cert exists. */
  private buildPkiMessageContentBinary(
    issuedCert: forge.pki.Certificate,
    caCert: forge.pki.Certificate,
    requesterCertificate: forge.pki.Certificate | null
  ): string {
    const certPayloadBinary = this.buildCertPayloadBinary(issuedCert, caCert)

    // SCEP success CertRep should carry the issued cert payload in EnvelopedData
    // encrypted to the requester's certificate.
    if (requesterCertificate) {
      const enveloped = forge.pkcs7.createEnvelopedData()
      enveloped.content = forge.util.createBuffer(certPayloadBinary)
      enveloped.addRecipient(requesterCertificate)
      enveloped.encrypt(undefined, forge.pki.oids['aes128-CBC'])
      return forge.asn1.toDer(enveloped.toAsn1()).getBytes()
    }

    return certPayloadBinary
  }

  /** Create a printable-string ASN.1 attribute node. */
  private makePrintableAttr(oid: string, value: string): forge.asn1.Asn1 {
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer(oid).getBytes()
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.PRINTABLESTRING, false, value)
      ])
    ])
  }

  /** Create an octet-string ASN.1 attribute node. */
  private makeOctetAttr(oid: string, binaryValue: string): forge.asn1.Asn1 {
    return forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer(oid).getBytes()
      ),
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, binaryValue)
      ])
    ])
  }

  /** Dump CMS structure to text for local debugging output. */
  private async dumpCms(derPath: string, outTextPath: string): Promise<void> {
    try {
      const { stdout } = await execFile('openssl', [
        'cms',
        '-inform',
        'DER',
        '-in',
        derPath,
        '-cmsout',
        '-print'
      ])
      writeFileSync(outTextPath, stdout, 'utf8')
    } catch (error: any) {
      writeFileSync(
        outTextPath,
        `Failed to parse CMS via openssl.\n${error?.stderr?.toString?.() || error?.message || ''}`,
        'utf8'
      )
    }
  }

  /** Extract requester identity certificate and subject data from CMS. */
  private extractRequesterIdentity(payload: Buffer): RequesterIdentity | null {
    try {
      const asn1 = forge.asn1.fromDer(payload.toString('binary'))
      const p7 = forge.pkcs7.messageFromAsn1(asn1) as any
      const cert = p7?.certificates?.[0] as forge.pki.Certificate | undefined
      if (cert?.publicKey && Array.isArray(cert.subject?.attributes) && cert.subject.attributes.length > 0) {
        return {
          certificate: cert,
          publicKey: cert.publicKey,
          subjectAttributes: cert.subject.attributes as forge.pki.CertificateField[]
        }
      }
    } catch {
      // fall through to default identity
    }

    return null
  }

  /** Extract SCEP request attributes from authenticated CMS attributes. */
  private extractScepRequestAttributes(payload: Buffer): ParsedScepRequestAttributes | null {
    try {
      const asn1 = forge.asn1.fromDer(payload.toString('binary'))
      const p7 = forge.pkcs7.messageFromAsn1(asn1) as any
      const attrs = p7?.rawCapture?.authenticatedAttributes
      if (!Array.isArray(attrs)) {
        return null
      }

      const out: ParsedScepRequestAttributes = {}
      for (const attr of attrs) {
        const oidNode = attr?.value?.[0]
        const setNode = attr?.value?.[1]
        if (!oidNode || !setNode || typeof oidNode.value !== 'string') {
          continue
        }

        const oid = forge.asn1.derToOid(oidNode.value)
        const valueNode = Array.isArray(setNode.value) ? setNode.value[0] : null
        if (!valueNode) {
          continue
        }

        if (oid === SCEP_ATTR_OIDS.messageType) {
          out.messageType = String(valueNode.value)
        } else if (oid === SCEP_ATTR_OIDS.transactionId) {
          out.transactionId = String(valueNode.value)
        } else if (oid === SCEP_ATTR_OIDS.senderNonce) {
          const nonceBinary = typeof valueNode.value === 'string' ? valueNode.value : ''
          out.senderNonceBinary = nonceBinary
          out.senderNonceHex = Buffer.from(nonceBinary, 'binary').toString('hex')
        }
      }

      return out
    } catch {
      return null
    }
  }

  /** Issue a short-lived device certificate from the configured SCEP CA. */
  private issueDeviceCertificatePem(
    requester: {
      publicKey: forge.pki.PublicKey
      subjectAttributes: forge.pki.CertificateField[]
    } | null
  ): string {
    const { certPem: caCertificatePem, keyPem: caPrivateKeyPem } = this.getCaMaterials()
    const caCert = forge.pki.certificateFromPem(caCertificatePem)
    const caKey = forge.pki.privateKeyFromPem(caPrivateKeyPem)

    const issuedCert = forge.pki.createCertificate()
    issuedCert.publicKey = requester?.publicKey || caCert.publicKey
    issuedCert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16)).replace(/^00/, '01')
    issuedCert.validity.notBefore = new Date()
    issuedCert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    issuedCert.setSubject(
      requester?.subjectAttributes || [
        { name: 'commonName', value: 'iOS SCEP Device' },
        { name: 'organizationName', value: 'QTC MDM' }
      ]
    )
    issuedCert.setIssuer(caCert.subject.attributes)
    issuedCert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', clientAuth: true }
    ])
    issuedCert.sign(caKey, forge.md.sha256.create())

    return forge.pki.certificateToPem(issuedCert)
  }

  /** Load and validate the cached SCEP CA materials from Secrets Manager. */
  private async ensureCaMaterialsLoaded(): Promise<void> {
    const systemGroupId = await getSystemGroupId(this.knexClient)
    const caRow = await getActiveCertificateSecretRefRow(this.knexClient, 'scep_ca', systemGroupId)

    if (this.caCertificatePem && this.caPrivateKeyPem && this.caCertificateRowId === caRow.id) {
      return
    }

    if (!this.caMaterialsPromise || this.caCertificateRowId !== caRow.id) {
      this.caMaterialsPromise = (async () => {
        const client = createSecretsManagerClient(this.options.app)
        const secretCache = new Map<string, Record<string, string>>()
        const material = await loadSecretBackedCertificateMaterial(client, secretCache, caRow, {
          certFieldLabel: 'scep_ca storage_ref',
          keyFieldLabel: 'scep_ca storage_key',
          requirePrivateKey: true
        })

        this.caCertificatePem = material.certPem
        this.caPrivateKeyPem = material.keyPem!
        this.caCertificateRowId = caRow.id
      })().catch((error) => {
        this.caMaterialsPromise = null
        throw error
      })
    }

    await this.caMaterialsPromise
  }

  /** Return the loaded SCEP CA materials after the async secret load has completed. */
  private getCaMaterials(): { certPem: string; keyPem: string } {
    if (!this.caCertificatePem || !this.caPrivateKeyPem) {
      throw new BadRequest('SCEP CA materials are not loaded from Secrets Manager.')
    }

    return {
      certPem: this.caCertificatePem,
      keyPem: this.caPrivateKeyPem
    }
  }
  async update(_id: NullableId, _data: DevicesIosScepData, _params?: ServiceParams): Promise<DevicesIosScep> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async patch(_id: NullableId, _data: DevicesIosScepPatch, _params?: ServiceParams): Promise<DevicesIosScep> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async remove(_id: NullableId, _params?: ServiceParams): Promise<DevicesIosScep> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

export const getOptions = (app: Application) => {
  return { app }
}




