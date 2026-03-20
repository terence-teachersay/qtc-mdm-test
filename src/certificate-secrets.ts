import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { BadRequest } from '@feathersjs/errors'
import type { Knex } from 'knex'
import type { Application } from './declarations'

export interface AwsStaticCredentials {
  accessKeyId: string
  secretAccessKey: string
}

export interface StoredCertificateSecretRefRow {
  id: number
  storage_type: string
  storage_ref: string | null
  storage_key: string | null
}

export interface LoadedCertificateSecretMaterial {
  rowId: number
  certPem: string
  keyPem?: string
  certReference: string
  keyReference?: string
}

/** Resolve AWS credentials for Secrets Manager, preferring service-specific credentials when configured. */
export function getSecretsManagerCredentials(awsConfig: any): AwsStaticCredentials | undefined {
  const smCreds = awsConfig?.secretsManager?.credentials
  if (smCreds?.accessKeyId && smCreds?.secretAccessKey) {
    return {
      accessKeyId: smCreds.accessKeyId,
      secretAccessKey: smCreds.secretAccessKey
    }
  }

  if (awsConfig?.accessKeyId && awsConfig?.secretAccessKey) {
    return {
      accessKeyId: awsConfig.accessKeyId,
      secretAccessKey: awsConfig.secretAccessKey
    }
  }

  return undefined
}

/** Create a Secrets Manager client from the application AWS configuration. */
export function createSecretsManagerClient(app: Application): SecretsManagerClient {
  const awsConfig = app.get('aws') as any
  const region = String(awsConfig?.region || '').trim()
  if (!region) {
    throw new BadRequest('AWS region is required to load certificate materials from Secrets Manager.')
  }

  return new SecretsManagerClient({
    region,
    credentials: getSecretsManagerCredentials(awsConfig)
  })
}

/** Look up the system-owned group that stores shared certificate references. */
export async function getSystemGroupId(knexClient: Knex): Promise<number> {
  const row = await knexClient('groups as g')
    .innerJoin('group_types as gt', 'gt.id', 'g.group_type_id')
    .select('g.id')
    .where('gt.name', 'system')
    .orderBy('g.id', 'asc')
    .first() as { id: number } | undefined

  if (!row?.id) {
    throw new Error('System group not found. Shared certificate lookup requires a system-owned certificate row.')
  }

  return row.id
}

/** Look up the newest active certificate row for the requested type, returning undefined when no row exists. */
export async function findActiveCertificateSecretRefRow(
  knexClient: Knex,
  code: string,
  ownerGroupId: number
): Promise<StoredCertificateSecretRefRow | undefined> {
  const certTypeId = await getCertificateTypeId(knexClient, code)

  const row = await knexClient('certificates as c')
    .select('c.id', 'c.storage_type', 'c.storage_ref', 'c.storage_key')
    .where('c.owner_group_id', ownerGroupId)
    .where('c.cert_type', certTypeId)
    .where('c.is_active', true)
    .orderBy('c.expires_at', 'desc')
    .orderBy('c.id', 'desc')
    .first() as StoredCertificateSecretRefRow | undefined

  if (!row) {
    return undefined
  }

  if (row.storage_type !== 'secrets_manager') {
    throw new BadRequest(
      `Certificate row ${row.id} for type "${code}" must use storage_type "secrets_manager", received "${row.storage_type}".`
    )
  }

  if (!row.storage_ref) {
    throw new BadRequest(`Certificate row ${row.id} for type "${code}" is missing storage_ref.`)
  }

  return row
}

/** Load the newest active certificate row for the requested certificate type and validate its storage metadata. */
export async function getActiveCertificateSecretRefRow(
  knexClient: Knex,
  code: string,
  ownerGroupId: number
): Promise<StoredCertificateSecretRefRow> {
  const row = await findActiveCertificateSecretRefRow(knexClient, code, ownerGroupId)
  if (!row) {
    throw new BadRequest(`Active certificate row not found for certificate type "${code}".`)
  }

  return row
}

/** Look up the numeric ID for a certificate type by its code string. */
export async function getCertificateTypeId(knexClient: Knex, code: string): Promise<number> {
  const row = await knexClient('certificate_types').select('id').where({ code }).first() as
    | { id: number }
    | undefined

  if (!row?.id) {
    throw new Error(`Certificate type lookup row is missing for code "${code}". Run the certificate migration first.`)
  }

  return row.id
}

/** Parse a Secrets Manager reference in the form `secretName#secretKey`, with optional secret-name fallback support. */
export function parseSecretReference(
  reference: string | null | undefined,
  fieldLabel: string,
  fallbackSecretName?: string
): { secretName: string; secretKey: string } {
  const trimmed = String(reference || '').trim()
  if (!trimmed) {
    throw new BadRequest(`${fieldLabel} is missing from certificates table.`)
  }

  const hashIndex = trimmed.indexOf('#')
  if (hashIndex === -1) {
    if (!fallbackSecretName) {
      throw new BadRequest(`Invalid Secrets Manager reference "${trimmed}" in ${fieldLabel}. Expected "secretName#secretKey".`)
    }

    return {
      secretName: fallbackSecretName,
      secretKey: trimmed
    }
  }

  const secretName = trimmed.slice(0, hashIndex).trim()
  const secretKey = trimmed.slice(hashIndex + 1).trim()
  if (!secretName || !secretKey) {
    throw new BadRequest(`Invalid Secrets Manager reference "${trimmed}" in ${fieldLabel}. Expected "secretName#secretKey".`)
  }

  return { secretName, secretKey }
}

/** Fetch and cache a JSON Secrets Manager secret object by name. */
export async function getSecretsManagerSecretObject(
  client: SecretsManagerClient,
  cache: Map<string, Record<string, string>>,
  secretName: string
): Promise<Record<string, string>> {
  const cached = cache.get(secretName)
  if (cached) {
    return cached
  }

  const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }))
  if (!response.SecretString) {
    throw new Error(`Secret "${secretName}" is empty or binary; expected a JSON string.`)
  }

  const rawSecret = JSON.parse(response.SecretString)
  const secret: Record<string, string> = {}
  for (const [key, value] of Object.entries(rawSecret)) {
    secret[key.trim()] = value as string
  }

  cache.set(secretName, secret)
  return secret
}

/** Read a required field from a fetched secret object and fail with a clear message when it is missing. */
export function getRequiredSecretValue(
  secret: Record<string, string>,
  secretName: string,
  secretKey: string,
  fieldLabel: string
): string {
  const value = secret[secretKey]
  if (!value) {
    throw new Error(
      `Missing key "${secretKey}" in Secrets Manager secret "${secretName}" referenced by ${fieldLabel}.`
    )
  }

  return value
}

/** Normalize PEM text from Secrets Manager so headers, line breaks, and quoted values are usable by crypto APIs. */
export function normalizePem(value: string): string {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim()

  const unquoted = normalized.startsWith('"') && normalized.endsWith('"')
    ? normalized.slice(1, -1).trim()
    : normalized

  const rebuiltPem = rebuildPemBlock(unquoted)
  if (rebuiltPem) {
    return rebuiltPem
  }

  return unquoted
}

/** Rebuild a PEM block into canonical line-wrapped form when the secret contains a flattened PEM string. */
export function rebuildPemBlock(value: string): string | null {
  const beginMatch = value.match(/-----BEGIN [A-Z0-9 ]+-----/)
  const endMatch = value.match(/-----END [A-Z0-9 ]+-----/)

  if (!beginMatch || !endMatch) {
    return null
  }

  const begin = beginMatch[0]
  const end = endMatch[0]

  if (value.indexOf(begin) > value.indexOf(end)) {
    return null
  }

  const start = value.indexOf(begin) + begin.length
  const finish = value.indexOf(end)
  const bodyRaw = value.slice(start, finish)
  const base64Body = bodyRaw.replace(/[^A-Za-z0-9+/=]/g, '')

  if (!base64Body) {
    return null
  }

  const lines = base64Body.match(/.{1,64}/g) || [base64Body]
  return `${begin}\n${lines.join('\n')}\n${end}\n`
}

/** Ensure the normalized secret value still contains the expected PEM header for the requested certificate material. */
export function assertContainsPemHeader(value: string, secretKeyName: string, headers: string[]): void {
  const hasHeader = headers.some((header) => value.includes(header))
  if (!hasHeader) {
    throw new BadRequest(
      `Invalid PEM format in Secrets Manager key "${secretKeyName}". Expected one of: ${headers.join(', ')}`
    )
  }
}

/** Load certificate PEM and optional private key PEM from a DB-backed Secrets Manager row. */
export async function loadSecretBackedCertificateMaterial(
  client: SecretsManagerClient,
  cache: Map<string, Record<string, string>>,
  row: StoredCertificateSecretRefRow,
  options: {
    certFieldLabel: string
    keyFieldLabel?: string
    requirePrivateKey?: boolean
    certPemHeaders?: string[]
    keyPemHeaders?: string[]
  }
): Promise<LoadedCertificateSecretMaterial> {
  const certRef = parseSecretReference(row.storage_ref, options.certFieldLabel)
  const keyRef = row.storage_key
    ? parseSecretReference(row.storage_key, options.keyFieldLabel || options.certFieldLabel, certRef.secretName)
    : null

  const secretNames = new Set<string>([certRef.secretName])
  if (keyRef) {
    secretNames.add(keyRef.secretName)
  }

  const secretsByName = new Map<string, Record<string, string>>()
  for (const secretName of secretNames) {
    secretsByName.set(secretName, await getSecretsManagerSecretObject(client, cache, secretName))
  }

  const certPem = normalizePem(
    getRequiredSecretValue(
      secretsByName.get(certRef.secretName)!,
      certRef.secretName,
      certRef.secretKey,
      options.certFieldLabel
    )
  )

  const certReference = `${certRef.secretName}#${certRef.secretKey}`
  assertContainsPemHeader(certPem, certReference, options.certPemHeaders || ['-----BEGIN CERTIFICATE-----'])

  let keyPem: string | undefined
  let keyReference: string | undefined
  if (keyRef) {
    keyPem = normalizePem(
      getRequiredSecretValue(
        secretsByName.get(keyRef.secretName)!,
        keyRef.secretName,
        keyRef.secretKey,
        options.keyFieldLabel || options.certFieldLabel
      )
    )
    keyReference = `${keyRef.secretName}#${keyRef.secretKey}`
    assertContainsPemHeader(
      keyPem,
      keyReference,
      options.keyPemHeaders || ['-----BEGIN PRIVATE KEY-----', '-----BEGIN RSA PRIVATE KEY-----', '-----BEGIN EC PRIVATE KEY-----']
    )
  } else if (options.requirePrivateKey) {
    throw new BadRequest(`${options.keyFieldLabel || options.certFieldLabel} is missing from certificates table.`)
  }

  return {
    rowId: row.id,
    certPem,
    ...(keyPem ? { keyPem } : {}),
    certReference,
    ...(keyReference ? { keyReference } : {})
  }
}
