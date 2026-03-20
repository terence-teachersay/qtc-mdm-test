import type { Knex } from 'knex'
import { BadRequest } from '@feathersjs/errors'

export const ENROLLMENT_TOKEN_TABLE = 'device_enrollment_tokens'

export interface EnrollmentTokenRow {
  id: number
  token_hash: string
  group_id: number
  expires_at: Date | string
  consumed_at: Date | string | null
  consumed_udid: string | null
}

export async function assertEnrollmentTokenTableExists(knexClient: Knex): Promise<void> {
  const hasTable = await knexClient.schema.hasTable(ENROLLMENT_TOKEN_TABLE)
  if (!hasTable) {
    throw new Error(
      `Required table "${ENROLLMENT_TOKEN_TABLE}" is missing. Create it in the database before using device enrollment tokens.`
    )
  }
}

export function hashEnrollmentToken(enrollmentToken: string): string {
  return require('crypto').createHash('sha256').update(enrollmentToken).digest('hex')
}

export async function getActiveEnrollmentTokenRow(
  knexClient: Knex,
  enrollmentToken: string
): Promise<EnrollmentTokenRow> {
  await assertEnrollmentTokenTableExists(knexClient)

  const tokenHash = hashEnrollmentToken(enrollmentToken)
  const row = await knexClient(ENROLLMENT_TOKEN_TABLE)
    .where({ token_hash: tokenHash })
    .andWhere('expires_at', '>', knexClient.fn.now())
    .first() as EnrollmentTokenRow | undefined

  if (!row) {
    throw new BadRequest('Enrollment token is invalid or expired.')
  }

  return row
}

export async function getEnrollmentTokenOwnerForDownload(
  knexClient: Knex,
  enrollmentToken: string
): Promise<number> {
  const tokenRow = await getActiveEnrollmentTokenRow(knexClient, enrollmentToken)
  if (tokenRow.consumed_at) {
    throw new BadRequest('Enrollment token has already been used by a device.')
  }

  return tokenRow.group_id
}

export async function consumeEnrollmentToken(
  knexClient: Knex,
  enrollmentToken: string,
  udid: string
): Promise<number> {
  const tokenRow = await getActiveEnrollmentTokenRow(knexClient, enrollmentToken)

  if (tokenRow.consumed_udid && tokenRow.consumed_udid !== udid) {
    throw new BadRequest('Enrollment token has already been consumed by another device.')
  }

  if (!tokenRow.consumed_at) {
    await knexClient(ENROLLMENT_TOKEN_TABLE)
      .where({ id: tokenRow.id })
      .update({
        consumed_at: knexClient.fn.now(),
        consumed_udid: udid,
        updated_at: knexClient.fn.now()
      })
  }

  return tokenRow.group_id
}
