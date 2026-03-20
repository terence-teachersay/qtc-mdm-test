import { BadRequest } from '@feathersjs/errors'
import type { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'

const IOS_DEVICES_TABLE = 'ios_devices'
const IOS_DEVICE_ENROLLMENT_STATUSES_TABLE = 'ios_device_enrollment_statuses'
const IOS_DEVICE_COMMANDS_TABLE = 'ios_device_commands'
const IOS_DEVICE_COMMAND_STATUSES_TABLE = 'ios_device_command_statuses'
const IOS_DEVICE_EVENTS_TABLE = 'ios_device_events'
const IOS_DEVICE_EVENT_TYPES_TABLE = 'ios_device_event_types'

export enum CommandStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  NOT_NOW = 'not_now',
  ACKNOWLEDGED = 'acknowledged',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

interface DeviceRow {
  id: number
  udid: string
  group_id: number
  current_topic: string
  enrollment_status_code: string
}

interface StoredCommandRow {
  id: number
  device_id: number
  udid: string
  command_status_id: number
  command_status_code: string
  is_pending: boolean
  command_uuid: string
  command_type: string
  payload_json: any
  priority: number
  attempt_count: number
  queued_at: Date | string
  sent_at: Date | string | null
  acknowledged_at: Date | string | null
  completed_at: Date | string | null
  expires_at: Date | string | null
  last_error: string | null
  last_response_json: any
  created_at: Date | string
  updated_at: Date | string
}

export interface MDMCommand {
  id: number
  deviceId: string
  deviceRowId: number
  commandUUID: string
  commandType: string
  payload: any
  status: CommandStatus
  isPending: boolean
  priority: number
  attemptCount: number
  queuedAt: Date | string
  sentAt: Date | string | null
  acknowledgedAt: Date | string | null
  completedAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
  replacedCommandUUIDs?: string[]
}

const commandStatusIdCache = new Map<string, number>()
const eventTypeIdCache = new Map<string, number>()

/** Convert nested values into JSON-safe data before storing command payloads and responses. */
function sanitizeForJson(value: any): any {
  if (value === undefined || value === null) {
    return null
  }

  if (Buffer.isBuffer(value)) {
    // Preserve binary values in a JSON-friendly shape.
    return {
      type: 'Buffer',
      data: Array.from(value)
    }
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForJson(entry))
  }

  if (typeof value === 'object') {
    // Recursively sanitize nested objects and arrays.
    const result: Record<string, any> = {}
    for (const [key, entry] of Object.entries(value)) {
      result[key] = sanitizeForJson(entry)
    }
    return result
  }

  return value
}

/** Load the active device row needed for queue operations and reject inactive or missing devices. */
async function getDeviceRowByUdid(db: Knex | Knex.Transaction, udid: string): Promise<DeviceRow> {
  const row = await db(`${IOS_DEVICES_TABLE} as d`)
    .innerJoin(`${IOS_DEVICE_ENROLLMENT_STATUSES_TABLE} as s`, 's.id', 'd.enrollment_status_id')
    .select(
      'd.id',
      'd.udid',
      'd.group_id',
      'd.current_topic',
      's.code as enrollment_status_code'
    )
    .where('d.udid', udid)
    .first() as DeviceRow | undefined

  if (!row?.id) {
    throw new BadRequest(`Device UDID not found: ${udid}`)
  }

  if (row.enrollment_status_code !== 'active') {
    throw new BadRequest(`Device UDID ${udid} is not actively enrolled.`)
  }

  return row
}

/** Resolve a command-status lookup ID and cache it for repeated queue operations. */
async function getCommandStatusId(db: Knex | Knex.Transaction, code: CommandStatus): Promise<number> {
  const cached = commandStatusIdCache.get(code)
  if (cached) {
    return cached
  }

  const row = await db(IOS_DEVICE_COMMAND_STATUSES_TABLE)
    .select('id')
    .where({ code })
    .first() as { id: number } | undefined

  if (!row?.id) {
    throw new Error(`ios_device_command_statuses is missing required code "${code}".`)
  }

  commandStatusIdCache.set(code, row.id)
  return row.id
}

/** Resolve an event-type lookup ID and cache it for repeated event inserts. */
async function getEventTypeId(db: Knex | Knex.Transaction, code: string): Promise<number> {
  const cached = eventTypeIdCache.get(code)
  if (cached) {
    return cached
  }

  const row = await db(IOS_DEVICE_EVENT_TYPES_TABLE)
    .select('id')
    .where({ code })
    .first() as { id: number } | undefined

  if (!row?.id) {
    throw new Error(`ios_device_event_types is missing required code "${code}".`)
  }

  eventTypeIdCache.set(code, row.id)
  return row.id
}

/** Load a device row by UDID without requiring the device to still be active. */
async function getDeviceRowByUdidAllowInactive(
  db: Knex | Knex.Transaction,
  udid: string
): Promise<DeviceRow | null> {
  const row = await db(`${IOS_DEVICES_TABLE} as d`)
    .innerJoin(`${IOS_DEVICE_ENROLLMENT_STATUSES_TABLE} as s`, 's.id', 'd.enrollment_status_id')
    .select(
      'd.id',
      'd.udid',
      'd.group_id',
      'd.current_topic',
      's.code as enrollment_status_code'
    )
    .where('d.udid', udid)
    .first() as DeviceRow | undefined

  return row || null
}

/** Load the raw stored command row for a specific device/command UUID pair. */
async function getStoredCommandRow(
  db: Knex | Knex.Transaction,
  deviceUdid: string,
  commandUUID: string
): Promise<StoredCommandRow | null> {
  const row = await db(`${IOS_DEVICE_COMMANDS_TABLE} as c`)
    .innerJoin(`${IOS_DEVICE_COMMAND_STATUSES_TABLE} as s`, 's.id', 'c.command_status_id')
    .innerJoin(`${IOS_DEVICES_TABLE} as d`, 'd.id', 'c.device_id')
    .select(
      'c.id',
      'c.device_id',
      'd.udid',
      'c.command_status_id',
      's.code as command_status_code',
      'c.is_pending',
      'c.command_uuid',
      'c.command_type',
      'c.payload_json',
      'c.priority',
      'c.attempt_count',
      'c.queued_at',
      'c.sent_at',
      'c.acknowledged_at',
      'c.completed_at',
      'c.expires_at',
      'c.last_error',
      'c.last_response_json',
      'c.created_at',
      'c.updated_at'
    )
    .where('d.udid', deviceUdid)
    .where('c.command_uuid', commandUUID)
    .first() as StoredCommandRow | undefined

  return row || null
}

/** Convert the raw database command row into the public command view returned by the queue helpers. */
function buildCommandView(row: StoredCommandRow): MDMCommand {
  return {
    id: row.id,
    deviceId: row.udid,
    deviceRowId: row.device_id,
    commandUUID: row.command_uuid,
    commandType: row.command_type,
    payload: row.payload_json,
    status: row.command_status_code as CommandStatus,
    isPending: row.is_pending,
    priority: row.priority,
    attemptCount: row.attempt_count,
    queuedAt: row.queued_at,
    sentAt: row.sent_at,
    acknowledgedAt: row.acknowledged_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/** Persist a command lifecycle event so queue transitions can be audited later. */
async function insertCommandEvent(
  db: Knex | Knex.Transaction,
  device: DeviceRow,
  commandId: number,
  eventCode: string,
  payload: any,
  actorUserId?: number | null
): Promise<void> {
  const eventTypeId = await getEventTypeId(db, eventCode)

  // Store enough context to reconstruct what command changed and under which topic it was observed.
  await db(IOS_DEVICE_EVENTS_TABLE).insert({
    device_id: device.id,
    command_id: commandId,
    event_type_id: eventTypeId,
    actor_user_id: actorUserId ?? null,
    message_type: payload?.Command?.RequestType ?? payload?.RequestType ?? null,
    observed_topic: device.current_topic,
    payload_json: sanitizeForJson(payload),
    created_at: db.fn.now()
  })
}

/** Map a command status transition to the event code recorded in the device-events table. */
function getEventCodeForStatus(status: CommandStatus): string | null {
  switch (status) {
    case CommandStatus.SENT:
      return 'command_sent'
    case CommandStatus.NOT_NOW:
      return 'command_not_now'
    case CommandStatus.ACKNOWLEDGED:
      return 'command_acknowledged'
    case CommandStatus.COMPLETED:
      return 'command_completed'
    case CommandStatus.FAILED:
      return 'command_failed'
    default:
      return null
  }
}

/** Queue a new MDM command for a device, replacing older pending commands of the same type when needed. */
export async function addCommand(
  knexClient: Knex,
  deviceUdid: string,
  commandType: string,
  payload: any,
  priority = 1,
  requestedByUserId?: number | null
): Promise<MDMCommand> {
  const commandUUID = uuidv4()
  const replacedCommandUUIDs: string[] = []

  try {
    await knexClient.transaction(async (trx) => {
      // Resolve the device and the status IDs needed for the queue mutation.
      const device = await getDeviceRowByUdid(trx, deviceUdid)
      const queuedStatusId = await getCommandStatusId(trx, CommandStatus.QUEUED)
      const notNowStatusId = await getCommandStatusId(trx, CommandStatus.NOT_NOW)
      const cancelledStatusId = await getCommandStatusId(trx, CommandStatus.CANCELLED)

      // Only allow one pending command of the same type; older queued/not-now copies are replaced.
      const pendingCommands = await trx(`${IOS_DEVICE_COMMANDS_TABLE} as c`)
        .select('c.id', 'c.command_uuid')
        .where('c.device_id', device.id)
        .where('c.command_type', commandType)
        .whereIn('c.command_status_id', [queuedStatusId, notNowStatusId])
        .orderBy('c.queued_at', 'asc') as Array<{ id: number; command_uuid: string }>

      if (pendingCommands.length > 0) {
        replacedCommandUUIDs.push(...pendingCommands.map((row) => row.command_uuid))

        // Mark superseded commands as cancelled before inserting the newer replacement.
        await trx(IOS_DEVICE_COMMANDS_TABLE)
          .whereIn('id', pendingCommands.map((row) => row.id))
          .update({
            command_status_id: cancelledStatusId,
            is_pending: false,
            completed_at: trx.fn.now(),
            last_error: 'Replaced by a newer queued command.',
            updated_at: trx.fn.now()
          })
      }

      // Insert the new command in queued state so the server loop can hand it to the device later.
      await trx(IOS_DEVICE_COMMANDS_TABLE).insert({
        device_id: device.id,
        command_status_id: queuedStatusId,
        is_pending: true,
        requested_by_user_id: requestedByUserId ?? null,
        command_uuid: commandUUID,
        command_type: commandType,
        payload_json: sanitizeForJson(payload),
        priority,
        attempt_count: 0,
        queued_at: trx.fn.now(),
        sent_at: null,
        acknowledged_at: null,
        completed_at: null,
        expires_at: null,
        last_error: null,
        last_response_json: null,
        created_at: trx.fn.now(),
        updated_at: trx.fn.now()
      })

      const inserted = await getStoredCommandRow(trx, deviceUdid, commandUUID)
      if (!inserted) {
        throw new Error(`Failed to insert command ${commandUUID} for device ${deviceUdid}.`)
      }

      // Record the queue event for auditing and troubleshooting.
      await insertCommandEvent(
        trx,
        device,
        inserted.id,
        'command_queued',
        {
          commandUUID,
          commandType,
          priority,
          payload,
          replacedCommandUUIDs
        },
        requestedByUserId
      )
    })
  } catch (error: any) {
    // Translate the unique-index violation into a clearer API message for callers.
    if (error?.code === '23505' && error?.constraint === 'ios_device_commands_one_pending_per_type_idx') {
      throw new BadRequest(
        `A pending ${commandType} command already exists for device ${deviceUdid}. Revoke or replace it before queueing a new one.`
      )
    }

    throw error
  }

  const command = await getStoredCommandRow(knexClient, deviceUdid, commandUUID)
  if (!command) {
    throw new Error(`Queued command ${commandUUID} could not be reloaded for device ${deviceUdid}.`)
  }

  return {
    ...buildCommandView(command),
    replacedCommandUUIDs
  }
}

/** Return the full command history for a device, ordered by priority and queue time. */
export async function getCommands(knexClient: Knex, deviceUdid: string): Promise<MDMCommand[]> {
  const rows = await knexClient(`${IOS_DEVICE_COMMANDS_TABLE} as c`)
    .innerJoin(`${IOS_DEVICE_COMMAND_STATUSES_TABLE} as s`, 's.id', 'c.command_status_id')
    .innerJoin(`${IOS_DEVICES_TABLE} as d`, 'd.id', 'c.device_id')
    .select(
      'c.id',
      'c.device_id',
      'd.udid',
      'c.command_status_id',
      's.code as command_status_code',
      'c.is_pending',
      'c.command_uuid',
      'c.command_type',
      'c.payload_json',
      'c.priority',
      'c.attempt_count',
      'c.queued_at',
      'c.sent_at',
      'c.acknowledged_at',
      'c.completed_at',
      'c.expires_at',
      'c.last_error',
      'c.last_response_json',
      'c.created_at',
      'c.updated_at'
    )
    .where('d.udid', deviceUdid)
    .orderBy('c.priority', 'desc')
    .orderBy('c.queued_at', 'asc') as StoredCommandRow[]

  return rows.map((row) => buildCommandView(row))
}

/** Return the next pending command a device should receive, prioritizing queued items ahead of not-now retries. */
export async function getNextCommand(knexClient: Knex, deviceUdid: string): Promise<MDMCommand | null> {
  const queuedStatusId = await getCommandStatusId(knexClient, CommandStatus.QUEUED)
  const notNowStatusId = await getCommandStatusId(knexClient, CommandStatus.NOT_NOW)

  // Prefer freshly queued commands first, then retry commands that previously returned NotNow.
  const row = await knexClient(`${IOS_DEVICE_COMMANDS_TABLE} as c`)
    .innerJoin(`${IOS_DEVICE_COMMAND_STATUSES_TABLE} as s`, 's.id', 'c.command_status_id')
    .innerJoin(`${IOS_DEVICES_TABLE} as d`, 'd.id', 'c.device_id')
    .select(
      'c.id',
      'c.device_id',
      'd.udid',
      'c.command_status_id',
      's.code as command_status_code',
      'c.is_pending',
      'c.command_uuid',
      'c.command_type',
      'c.payload_json',
      'c.priority',
      'c.attempt_count',
      'c.queued_at',
      'c.sent_at',
      'c.acknowledged_at',
      'c.completed_at',
      'c.expires_at',
      'c.last_error',
      'c.last_response_json',
      'c.created_at',
      'c.updated_at'
    )
    .where('d.udid', deviceUdid)
    .whereIn('c.command_status_id', [queuedStatusId, notNowStatusId])
    .orderByRaw('case when c.command_status_id = ? then 0 else 1 end asc', [queuedStatusId])
    .orderBy('c.priority', 'desc')
    .orderBy('c.queued_at', 'asc')
    .first() as StoredCommandRow | undefined

  return row ? buildCommandView(row) : null
}

/** Update a command status, persist any response payload, and emit the matching queue event when applicable. */
export async function updateCommandStatus(
  knexClient: Knex,
  deviceUdid: string,
  commandUUID: string,
  status: CommandStatus,
  options?: {
    responsePayload?: any
    errorMessage?: string | null
    actorUserId?: number | null
  }
): Promise<MDMCommand | null> {
  // Normalize the optional response payload before storing it in JSON columns.
  const responsePayload = sanitizeForJson(options?.responsePayload)

  return knexClient.transaction(async (trx) => {
    const device = await getDeviceRowByUdid(trx, deviceUdid)
    const existing = await getStoredCommandRow(trx, deviceUdid, commandUUID)
    if (!existing) {
      return null
    }

    const statusId = await getCommandStatusId(trx, status)
    // Pending state only remains true while the command is queued or waiting for a retry after NotNow.
    const updatePayload: Record<string, any> = {
      command_status_id: statusId,
      is_pending: status === CommandStatus.QUEUED || status === CommandStatus.NOT_NOW,
      updated_at: trx.fn.now()
    }

    if (responsePayload !== null) {
      updatePayload.last_response_json = responsePayload
    }

    if (options?.errorMessage !== undefined) {
      updatePayload.last_error = options.errorMessage
    }

    if (status === CommandStatus.SENT) {
      // Count each time the server actually hands the command to the device.
      updatePayload.sent_at = trx.fn.now()
      updatePayload.attempt_count = existing.attempt_count + 1
    }

    if (status === CommandStatus.ACKNOWLEDGED) {
      updatePayload.acknowledged_at = trx.fn.now()
    }

    if (
      status === CommandStatus.COMPLETED ||
      status === CommandStatus.FAILED ||
      status === CommandStatus.CANCELLED ||
      status === CommandStatus.EXPIRED
    ) {
      updatePayload.completed_at = trx.fn.now()
      updatePayload.acknowledged_at = existing.acknowledged_at ?? trx.fn.now()
    }

    // Persist the command status transition to the command row itself.
    await trx(IOS_DEVICE_COMMANDS_TABLE)
      .where({ id: existing.id })
      .update(updatePayload)

    const eventCode = getEventCodeForStatus(status)
    if (eventCode) {
      // Mirror notable state changes into the device-events table for auditing.
      await insertCommandEvent(
        trx,
        device,
        existing.id,
        eventCode,
        {
          commandUUID,
          status,
          responsePayload,
          errorMessage: options?.errorMessage ?? null
        },
        options?.actorUserId
      )
    }

    const updated = await getStoredCommandRow(trx, deviceUdid, commandUUID)
    return updated ? buildCommandView(updated) : null
  })
}

/** Cancel any still-open commands for a device that is no longer manageable, such as after checkout. */
export async function cancelOpenCommandsForDevice(
  knexClient: Knex,
  deviceUdid: string,
  reason: string
): Promise<number> {
  return knexClient.transaction(async (trx) => {
    const device = await getDeviceRowByUdidAllowInactive(trx, deviceUdid)
    if (!device?.id) {
      return 0
    }

    // Cancel commands that could still be considered in-flight or retryable.
    const cancelledStatusId = await getCommandStatusId(trx, CommandStatus.CANCELLED)
    const sentStatusId = await getCommandStatusId(trx, CommandStatus.SENT)
    const queuedStatusId = await getCommandStatusId(trx, CommandStatus.QUEUED)
    const notNowStatusId = await getCommandStatusId(trx, CommandStatus.NOT_NOW)
    const acknowledgedStatusId = await getCommandStatusId(trx, CommandStatus.ACKNOWLEDGED)

    const updatedCount = await trx(IOS_DEVICE_COMMANDS_TABLE)
      .where('device_id', device.id)
      .whereIn('command_status_id', [queuedStatusId, sentStatusId, notNowStatusId, acknowledgedStatusId])
      .update({
        command_status_id: cancelledStatusId,
        is_pending: false,
        completed_at: trx.fn.now(),
        last_error: reason,
        updated_at: trx.fn.now()
      })

    return Number(updatedCount || 0)
  })
}
