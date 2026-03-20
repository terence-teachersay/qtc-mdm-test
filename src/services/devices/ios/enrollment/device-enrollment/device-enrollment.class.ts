import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import type { Knex } from 'knex'
import crypto from 'crypto'
import type { Application } from '../../../../../declarations'
import { BadRequest, MethodNotAllowed } from '@feathersjs/errors'
import { logger } from '../../../../../logger'
import { join } from 'path'
import fs from 'fs'
import { getReversedPublicBaseDomain } from '../../../../../public-base-domain'
import { devicesIosServerPath } from '../../server/server.shared'
import { devicesIosCheckinPath } from '../../checkin/checkin.shared'
import { execFileSync } from 'child_process'
import os from 'os'
import {
  createSecretsManagerClient,
  findActiveCertificateSecretRefRow,
  getActiveCertificateSecretRefRow,
  getCertificateTypeId,
  getSystemGroupId,
  loadSecretBackedCertificateMaterial
} from '../../../../../certificate-secrets'

import type {
  DevicesIosEnrollmentDeviceEnrollment,
  DevicesIosEnrollmentDeviceEnrollmentData,
  DevicesIosEnrollmentDeviceEnrollmentPatch,
  DevicesIosEnrollmentDeviceEnrollmentQuery
} from './device-enrollment.schema'
import { devicesIosEnrollmentDeviceEnrollmentPath } from './device-enrollment.shared'
import { getEnrollmentTokenOwnerForDownload } from '../enrollment-token'

export type {
  DevicesIosEnrollmentDeviceEnrollment,
  DevicesIosEnrollmentDeviceEnrollmentData,
  DevicesIosEnrollmentDeviceEnrollmentPatch,
  DevicesIosEnrollmentDeviceEnrollmentQuery
}

export interface DevicesIosEnrollmentDeviceEnrollmentServiceOptions {
  app: Application
}

export interface DevicesIosEnrollmentDeviceEnrollmentParams extends Params<DevicesIosEnrollmentDeviceEnrollmentQuery> {}

interface ProfileSigningMaterials {
  profileCertificateRowId: number
  chainRowId: number | null
  certPem: string
  keyPem: string
  chainPem?: string
}

export class DevicesIosEnrollmentDeviceEnrollmentService<
  ServiceParams extends DevicesIosEnrollmentDeviceEnrollmentParams = DevicesIosEnrollmentDeviceEnrollmentParams
> implements ServiceInterface<
  DevicesIosEnrollmentDeviceEnrollment | Buffer,
  DevicesIosEnrollmentDeviceEnrollmentData,
  ServiceParams,
  DevicesIosEnrollmentDeviceEnrollmentPatch
> {
  private cachedProfileSigningMaterials: ProfileSigningMaterials | null = null

  /** Initialize the device-enrollment service. */
  constructor(public options: DevicesIosEnrollmentDeviceEnrollmentServiceOptions) {}

  /** Lazy accessor for the Knex database client from app config. */
  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  /** Listing enrollment profiles is not supported by this service. */
  async find(_params?: ServiceParams): Promise<DevicesIosEnrollmentDeviceEnrollment[]> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Validate the enrollment token and return a signed mobileconfig profile for the owning group. */
  async get(id: Id, params?: ServiceParams): Promise<Buffer> {
    const enrollmentToken = String(id || '').trim()
    if (!enrollmentToken) {
      throw new BadRequest('Enrollment token is required.')
    }

    logger.info('[Endpoint START]', {
      endpoint: `${devicesIosEnrollmentDeviceEnrollmentPath} GET`,
      id: '[redacted]',
      query: params?.query || null,
      input: {
        hasEnrollmentToken: true
      }
    })

    const groupId = await getEnrollmentTokenOwnerForDownload(this.knexClient, enrollmentToken)
    const signedProfile = await this.buildSignedEnrollmentProfile(groupId, enrollmentToken)

    logger.info('[Endpoint END]', {
      endpoint: `${devicesIosEnrollmentDeviceEnrollmentPath} GET`,
      result: {
        groupId,
        bytes: signedProfile.length
      }
    })

    return signedProfile
  }

  /** Build the unsigned enrollment profile XML and then sign it for iOS installation. */
  private async buildSignedEnrollmentProfile(groupId: number, enrollmentToken: string): Promise<Buffer> {
    const profileTemplateFilePath = this.getEnrollmentProfileTemplatePath()
    const template = fs.readFileSync(profileTemplateFilePath, 'utf8')

    let profile = template

    // Top-level configuration profile metadata.
    const profilePayloadType = 'Configuration'
    const profilePayloadVersion = 1
    const baseUrl = this.options.app.get('publicBaseUrl') as string
    const reversedDomain = getReversedPublicBaseDomain(this.options.app)
    const profilePayloadIdentifier = `${reversedDomain}.mdm.enroll`
    const profilePayloadUUID = crypto.randomUUID()
    const profilePayloadDisplayName = 'QTC Test MDM Enrollment'
    const profilePayloadDescription = 'This profile will enroll your device in QTC MDM'
    const profilePayloadOrganization = 'QTC'
    const profilePayloadRemovalDisallowed = false

    // Embedded SCEP payload used to issue the device identity certificate.
    const scepUrl = `${baseUrl}/devices/ios/scep`
    const scepName = 'EnrollmentCAInstance'
    const scepO = 'QTC MDM'
    const scepCN = 'iOS Device Certificate'
    const scepChallenge = 'password123'
    const scepKeySize = 2048
    const scepKeyType = 'RSA'
    const scepKeyUsage = 5
    const scepPayloadDescription = 'Provides device encryption identity'
    const scepPayloadUUID = crypto.randomUUID()
    const scepPayloadType = 'com.apple.security.scep'
    const scepPayloadDisplayName = 'QTC MDM SCEP'
    const scepPayloadVersion = 1
    const scepPayloadOrganization = 'QTC'
    const scepPayloadIdentifier = `${reversedDomain}.mdm.scep`

    // Embedded MDM payload that points the device at the check-in and command URLs.
    const contentPayloadType = 'com.apple.mdm'
    const contentPayloadVersion = 1
    const contentPayloadIdentifier = `${reversedDomain}.mdm.payload`
    const contentPayloadUUID = crypto.randomUUID()
    const contentPayloadDisplayName = 'QTC Test MDM'

    // Use the active APNS topic for this group so the installed profile can talk to the correct MDM topic.
    const apnsPushTypeId = await getCertificateTypeId(this.knexClient, 'apns_push')
    const activeApnsCert = await this.knexClient('certificates as c')
      .where('c.owner_group_id', groupId)
      .where('c.cert_type', apnsPushTypeId)
      .where('c.is_active', true)
      .andWhere('c.expires_at', '>', this.knexClient.fn.now())
      .orderBy('c.expires_at', 'desc')
      .select('c.common_name')
      .first() as { common_name: string | null } | undefined

    const contentTopic = activeApnsCert?.common_name ?? null
    if (!contentTopic) {
      throw new BadRequest(`Active non-expired APNS certificate topic not found in database for group_id: ${groupId}`)
    }

    const contentServerUrl = `${baseUrl}/${devicesIosServerPath}`
    const contentCheckInUrl = `${baseUrl}/${devicesIosCheckinPath}?enrollmentToken=${encodeURIComponent(enrollmentToken)}`
    const contentAccessRights = 8191
    const contentSignMessage = true
    const contentCheckOutWhenRemoved = true

    const vars: Record<string, string> = {
      '__PROFILE_PAYLOAD_TYPE__': profilePayloadType,
      '__PROFILE_PAYLOAD_VERSION__': profilePayloadVersion.toString(),
      '__PROFILE_PAYLOAD_IDENTIFIER__': profilePayloadIdentifier,
      '__PROFILE_PAYLOAD_UUID__': profilePayloadUUID,
      '__PROFILE_PAYLOAD_DISPLAY_NAME__': profilePayloadDisplayName,
      '__PROFILE_PAYLOAD_DESCRIPTION__': profilePayloadDescription,
      '__PROFILE_PAYLOAD_ORGANIZATION__': profilePayloadOrganization,
      '__PROFILE_REMOVAL_DISALLOWED__': profilePayloadRemovalDisallowed ? `<true/>` : `<false/>`,
      '__SCEP_URL__': scepUrl,
      '__SCEP_NAME__': scepName,
      '__SCEP_O__': scepO,
      '__SCEP_CN__': scepCN,
      '__SCEP_CHALLENGE__': scepChallenge,
      '__SCEP_KEY_SIZE__': scepKeySize.toString(),
      '__SCEP_KEY_TYPE__': scepKeyType,
      '__SCEP_KEY_USAGE__': scepKeyUsage.toString(),
      '__SCEP_PAYLOAD_DESCRIPTION__': scepPayloadDescription,
      '__SCEP_PAYLOAD_UUID__': scepPayloadUUID,
      '__SCEP_PAYLOAD_TYPE__': scepPayloadType,
      '__SCEP_PAYLOAD_DISPLAY_NAME__': scepPayloadDisplayName,
      '__SCEP_PAYLOAD_VERSION__': scepPayloadVersion.toString(),
      '__SCEP_PAYLOAD_ORGANIZATION__': scepPayloadOrganization,
      '__SCEP_PAYLOAD_IDENTIFIER__': scepPayloadIdentifier,
      '__CONTENT_PAYLOAD_TYPE__': contentPayloadType,
      '__CONTENT_PAYLOAD_VERSION__': contentPayloadVersion.toString(),
      '__CONTENT_PAYLOAD_IDENTIFIER__': contentPayloadIdentifier,
      '__CONTENT_PAYLOAD_UUID__': contentPayloadUUID,
      '__CONTENT_PAYLOAD_DISPLAY_NAME__': contentPayloadDisplayName,
      '__CONTENT_TOPIC__': contentTopic,
      '__CONTENT_IDENTITY_CERTIFICATE_UUID__': scepPayloadUUID,
      '__CONTENT_SERVER_URL__': contentServerUrl,
      '__CONTENT_CHECKIN_URL__': contentCheckInUrl,
      '__CONTENT_ACCESS_RIGHTS__': contentAccessRights.toString(),
      '__CONTENT_SIGN_MESSAGE__': contentSignMessage ? `<true/>` : `<false/>`,
      '__CONTENT_CHECKOUT_WHEN_REMOVED__': contentCheckOutWhenRemoved ? `<true/>` : `<false/>`
    }

    // Replace template placeholders with the runtime values for this enrollment request.
    for (const [k, v] of Object.entries(vars)) profile = profile.split(k).join(v)

    return this.signProfile(profile)
  }

  /** Sign the generated mobileconfig XML with the active secret-backed profile-signing materials. */
  private async signProfile(profileXml: string): Promise<Buffer> {
    const materials = await this.loadProfileSigningMaterials()

    // OpenSSL still expects file-based input for CMS signing, so keep the PEM files short-lived in temp storage.
    const tmpDir = fs.mkdtempSync(join(os.tmpdir(), 'mdm-profile-sign-'))
    const unsignedPath = join(tmpDir, 'unsigned.mobileconfig')
    const signedPath = join(tmpDir, 'signed.mobileconfig')
    const certPath = join(tmpDir, 'profile-signing-cert.pem')
    const keyPath = join(tmpDir, 'profile-signing-key.pem')
    const chainPath = join(tmpDir, 'profile-signing-chain.pem')

    try {
      fs.writeFileSync(unsignedPath, profileXml, 'utf8')
      fs.writeFileSync(certPath, materials.certPem, 'utf8')
      fs.writeFileSync(keyPath, materials.keyPem, 'utf8')
      if (materials.chainPem) {
        fs.writeFileSync(chainPath, materials.chainPem, 'utf8')
      }

      const args = [
        'smime',
        '-sign',
        '-binary',
        '-nodetach',
        '-in',
        unsignedPath,
        '-out',
        signedPath,
        '-outform',
        'DER',
        '-signer',
        certPath,
        '-inkey',
        keyPath
      ]

      if (materials.chainPem) {
        args.push('-certfile', chainPath)
      }

      // Sign as a DER-encoded PKCS#7/CMS payload that Apple accepts for configuration profiles.
      execFileSync('openssl', args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      return fs.readFileSync(signedPath)
    } catch (err) {
      const error = err as any
      const stderr = error.stderr ? error.stderr.toString() : ''
      const stdout = error.stdout ? error.stdout.toString() : ''
      throw new BadRequest(`Failed to sign enrollment profile. ${stderr || stdout || error.message}`)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  /** Load the active profile-signing certificate, key, and preferred chain bundle from the certificates table. */
  private async loadProfileSigningMaterials(): Promise<ProfileSigningMaterials> {
    const systemGroupId = await getSystemGroupId(this.knexClient)
    const [profileRow, chainOnlyRow, chainRow] = await Promise.all([
      getActiveCertificateSecretRefRow(this.knexClient, 'profile_signing', systemGroupId),
      findActiveCertificateSecretRefRow(this.knexClient, 'profile_signing_chain_only', systemGroupId),
      findActiveCertificateSecretRefRow(this.knexClient, 'profile_signing_chain', systemGroupId)
    ])

    // Prefer the chain-only bundle when available, otherwise fall back to the combined chain entry.
    const preferredChainRow = chainOnlyRow || chainRow || null
    if (
      this.cachedProfileSigningMaterials &&
      this.cachedProfileSigningMaterials.profileCertificateRowId === profileRow.id &&
      this.cachedProfileSigningMaterials.chainRowId === (preferredChainRow?.id ?? null)
    ) {
      return this.cachedProfileSigningMaterials
    }

    const client = createSecretsManagerClient(this.options.app)
    const secretCache = new Map<string, Record<string, string>>()
    const profileMaterial = await loadSecretBackedCertificateMaterial(client, secretCache, profileRow, {
      certFieldLabel: 'profile_signing storage_ref',
      keyFieldLabel: 'profile_signing storage_key',
      requirePrivateKey: true
    })

    let chainPem: string | undefined
    if (preferredChainRow) {
      const chainFieldLabel = preferredChainRow.id === chainOnlyRow?.id
        ? 'profile_signing_chain_only storage_ref'
        : 'profile_signing_chain storage_ref'
      const chainMaterial = await loadSecretBackedCertificateMaterial(client, secretCache, preferredChainRow, {
        certFieldLabel: chainFieldLabel
      })
      chainPem = chainMaterial.certPem
    }

    this.cachedProfileSigningMaterials = {
      profileCertificateRowId: profileRow.id,
      chainRowId: preferredChainRow?.id ?? null,
      certPem: profileMaterial.certPem,
      keyPem: profileMaterial.keyPem!,
      ...(chainPem ? { chainPem } : {})
    }

    return this.cachedProfileSigningMaterials
  }

  /** Resolve the enrollment profile XML template from the source tree or compiled runtime location. */
  private getEnrollmentProfileTemplatePath(): string {
    const candidatePaths = [
      join(process.cwd(), 'src', 'services', 'devices', 'ios', 'enrollment', 'device-enrollment', 'enrollment-profile.xml'),
      join(__dirname, 'enrollment-profile.xml')
    ]

    const existingPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath))
    if (!existingPath) {
      throw new BadRequest(`Enrollment profile template not found. Checked: ${candidatePaths.join(', ')}`)
    }

    return existingPath
  }

  /** Direct profile creation is not supported; clients must use the token-backed GET endpoint. */
  async create(
    _data: DevicesIosEnrollmentDeviceEnrollmentData,
    _params?: ServiceParams
  ): Promise<DevicesIosEnrollmentDeviceEnrollment> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Full profile updates are not supported by this service. */
  async update(
    _id: NullableId,
    _data: DevicesIosEnrollmentDeviceEnrollmentData,
    _params?: ServiceParams
  ): Promise<DevicesIosEnrollmentDeviceEnrollment> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Partial profile updates are not supported by this service. */
  async patch(
    _id: NullableId,
    _data: DevicesIosEnrollmentDeviceEnrollmentPatch,
    _params?: ServiceParams
  ): Promise<DevicesIosEnrollmentDeviceEnrollment> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Profile deletion is not supported by this service. */
  async remove(_id: NullableId, _params?: ServiceParams): Promise<DevicesIosEnrollmentDeviceEnrollment> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

/** Build the service options object used when registering the device enrollment service. */
export const getOptions = (app: Application) => {
  return { app }
}
