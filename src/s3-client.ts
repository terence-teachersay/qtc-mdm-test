import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import type { Application } from './declarations'

interface AwsStaticCredentials {
  accessKeyId: string
  secretAccessKey: string
}

function getS3Credentials(awsConfig: any): AwsStaticCredentials | undefined {
  const s3Creds = awsConfig?.s3?.credentials
  if (s3Creds?.accessKeyId && s3Creds?.secretAccessKey) {
    return {
      accessKeyId: s3Creds.accessKeyId,
      secretAccessKey: s3Creds.secretAccessKey
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

function createS3Client(app: Application): S3Client {
  const awsConfig = app.get('aws') as any
  return new S3Client({
    region: awsConfig.region,
    credentials: getS3Credentials(awsConfig) // if undefined, SDK default provider chain is used
  })
}

function getS3Bucket(app: Application): string {
  const bucket = (app.get('aws') as any)?.s3?.bucket as string | undefined
  if (!bucket) throw new Error('AWS S3 bucket is not configured (aws.s3.bucket).')
  return bucket
}

function getS3Prefix(app: Application): string {
  const prefix = ((app.get('aws') as any)?.s3?.prefix as string | undefined)?.trim()
  return prefix ? prefix.replace(/^\/+|\/+$/g, '') : ''
}

function prefixedKey(app: Application, suffix: string): string {
  const prefix = getS3Prefix(app)
  return prefix ? `${prefix}/${suffix}` : suffix
}

interface GroupStorageRow {
  id: number
  school_name: string | null
  company_name: string | null
}

function sanitizeStorageSegment(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()

  return normalized || 'group'
}

async function getGroupStorageSegment(app: Application, groupId: number | string): Promise<string> {
  const numericGroupId = Number(groupId)
  if (!Number.isInteger(numericGroupId) || numericGroupId <= 0) {
    throw new Error(`Invalid group id for S3 storage prefix: ${groupId}`)
  }

  const knexClient = app.get('knexClient')
  const row = await knexClient<GroupStorageRow>('groups as g')
    .leftJoin('schools as s', 's.group_id', 'g.id')
    .leftJoin('companies as c', 'c.group_id', 'g.id')
    .select('g.id', 's.name as school_name', 'c.name as company_name')
    .where('g.id', numericGroupId)
    .first()

  if (!row?.id) {
    throw new Error(`Group ${numericGroupId} not found while building S3 storage prefix.`)
  }

  const organizationName = row.school_name || row.company_name || `group_${numericGroupId}`
  return `group_${numericGroupId}_${sanitizeStorageSegment(organizationName)}`
}

export async function getApnsRequestS3PrefixByGroup(
  app: Application,
  groupId: number | string,
  requestId: string
): Promise<string> {
  const groupSegment = await getGroupStorageSegment(app, groupId)
  return prefixedKey(app, `groups/${groupSegment}/ios/apns/requestId-${requestId}`)
}

export async function getApnsCertificateS3KeyByGroup(
  app: Application,
  groupId: number | string,
  certVersionRef: string
): Promise<string> {
  const groupSegment = await getGroupStorageSegment(app, groupId)
  return prefixedKey(app, `groups/${groupSegment}/ios/apns/certificate-${certVersionRef}/mdm_push_cert.pem`)
}

export async function getApnsCertificatePrivateKeyS3KeyByGroup(
  app: Application,
  groupId: number | string,
  certVersionRef: string
): Promise<string> {
  const groupSegment = await getGroupStorageSegment(app, groupId)
  return prefixedKey(app, `groups/${groupSegment}/ios/apns/certificate-${certVersionRef}/customer.key`)
}

/** Upload a string or Buffer to S3 with server-side encryption. */
export async function putS3Object(app: Application, key: string, body: string | Buffer): Promise<void> {
  const client = createS3Client(app)
  const bucket = getS3Bucket(app)
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ServerSideEncryption: 'AES256'
  }))
}

/** Download an S3 object and return its contents as a UTF-8 string. */
export async function getS3Object(app: Application, key: string): Promise<string> {
  const client = createS3Client(app)
  const bucket = getS3Bucket(app)
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const stream = response.Body as AsyncIterable<Uint8Array>
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Return true if an S3 object exists, false if it does not (404), re-throws on other errors. */
export async function s3ObjectExists(app: Application, key: string): Promise<boolean> {
  const client = createS3Client(app)
  const bucket = getS3Bucket(app)
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return false
    throw err
  }
}
