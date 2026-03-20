import type { Knex } from 'knex'
import { BadRequest } from '@feathersjs/errors'
import { cancelOpenCommandsForDevice } from './command-queue'

const IOS_DEVICES_TABLE = 'ios_devices'
const IOS_DEVICE_ENROLLMENT_STATUSES_TABLE = 'ios_device_enrollment_statuses'
const IOS_DEVICE_COMMANDS_TABLE = 'ios_device_commands'
const IOS_DEVICE_COMMAND_STATUSES_TABLE = 'ios_device_command_statuses'

interface StoredIosDeviceRow {
  id: number
  group_id: number
  udid: string
  enrollment_status_id: number
  enrollment_status_code: string
  current_topic: string
  apns_device_token: string | null
  push_magic: string | null
  unlock_token: string | null
  device_name: string | null
  model: string | null
  product_name: string | null
  serial_number: string | null
  os_version: string | null
  last_message_type: string | null
  enrolled_by_user_id: number | null
  first_enrolled_at: Date | string | null
  last_enrolled_at: Date | string | null
  last_seen_at: Date | string
  checked_out_at: Date | string | null
  inventory_json: Record<string, any> | null
  last_checkin_payload_json: Record<string, any> | null
  pending_command_count?: number | string | null
  queued_command_count?: number | string | null
  not_now_command_count?: number | string | null
  created_at: Date | string
  updated_at: Date | string
}

const INVENTORY_KEYS = [
  'Model',
  'ProductName',
  'SerialNumber',
  'DeviceName',
  'OSVersion',
  'AvailableDeviceCapacity',
  'BatteryLevel',
  'StorageCapacity'
]

const enrollmentStatusIdCache = new Map<string, number>()

export interface UpsertDeviceOptions {
  reactivateCheckedOut?: boolean
}

/** Return a trimmed string value or null when the input is empty or not a string. */
function pickString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Check whether a value is a plain JSON-style object that can be safely merged. */
function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value)
}

/** Convert nested values into JSON-safe data before storing payloads in Postgres JSON columns. */
function sanitizeForJson(value: any): any {
  if (value === undefined) {
    return null
  }

  if (value === null) {
    return null
  }

  if (Buffer.isBuffer(value)) {
    // Preserve binary data in a JSON-friendly shape.
    return {
      type: 'Buffer',
      data: Array.from(value)
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForJson(item))
  }

  if (value instanceof Date) {
    return value.toISOString()
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

/** Extract only the inventory fields this app wants to persist from a larger device payload. */
function extractInventory(deviceData: Record<string, any>): Record<string, any> {
  const inventory: Record<string, any> = {}
  // Keep the stored inventory focused on the fields the UI and commands use.
  for (const key of INVENTORY_KEYS) {
    if (deviceData[key] !== undefined) {
      inventory[key] = sanitizeForJson(deviceData[key])
    }
  }
  return inventory
}

/** Detect the legacy JSON shape used when binary values were serialized as `{ data: [...] }`. */
function isBufferLikeObject(value: any): value is { data: number[] } {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as any).data)
}

/** Normalize APNS tokens, unlock tokens, and other binary payload fields into hex strings for storage. */
function serializeBinaryValue(value: any): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('hex')
  }

  if (isBufferLikeObject(value)) {
    return Buffer.from(value.data).toString('hex')
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('hex')
  }

  return String(value)
}

/** Resolve an enrollment-status lookup ID and cache it for repeated device-store operations. */
async function getEnrollmentStatusId(knexClient: Knex, code: string): Promise<number> {
  const cached = enrollmentStatusIdCache.get(code)
  if (cached) {
    return cached
  }

  const row = await knexClient(IOS_DEVICE_ENROLLMENT_STATUSES_TABLE)
    .select('id')
    .where({ code })
    .first() as { id: number } | undefined

  if (!row?.id) {
    throw new Error(`ios_device_enrollment_statuses is missing required code "${code}".`)
  }

  enrollmentStatusIdCache.set(code, row.id)
  return row.id
}

/** Load the raw stored device row for a UDID, including enrollment status metadata. */
async function getStoredDeviceRowByUdid(knexClient: Knex, udid: string): Promise<StoredIosDeviceRow | null> {
  const row = await knexClient(`${IOS_DEVICES_TABLE} as d`)
    .innerJoin(`${IOS_DEVICE_ENROLLMENT_STATUSES_TABLE} as s`, 's.id', 'd.enrollment_status_id')
    .select(
      'd.id',
      'd.group_id',
      'd.udid',
      'd.enrollment_status_id',
      's.code as enrollment_status_code',
      'd.current_topic',
      'd.apns_device_token',
      'd.push_magic',
      'd.unlock_token',
      'd.device_name',
      'd.model',
      'd.product_name',
      'd.serial_number',
      'd.os_version',
      'd.last_message_type',
      'd.enrolled_by_user_id',
      'd.first_enrolled_at',
      'd.last_enrolled_at',
      'd.last_seen_at',
      'd.checked_out_at',
      'd.inventory_json',
      'd.last_checkin_payload_json',
      'd.created_at',
      'd.updated_at'
    )
    .where('d.udid', udid)
    .first() as StoredIosDeviceRow | undefined

  return row || null
}

/** Normalize aggregate counts returned from SQL into safe finite numbers. */
function normalizeCount(value: number | string | null | undefined): number {
  const count = Number(value ?? 0)
  return Number.isFinite(count) ? count : 0
}

/** Aggregate pending command counters for a batch of devices in one query. */
async function getCommandCountsByDeviceIds(
  knexClient: Knex,
  deviceIds: number[]
): Promise<Map<number, { pending: number; queued: number; notNow: number }>> {
  const countsByDeviceId = new Map<number, { pending: number; queued: number; notNow: number }>()

  if (deviceIds.length === 0) {
    return countsByDeviceId
  }

  // Compute pending / queued / not-now totals for each device so list endpoints can show command state.
  const rows = await knexClient(`${IOS_DEVICE_COMMANDS_TABLE} as c`)
    .innerJoin(`${IOS_DEVICE_COMMAND_STATUSES_TABLE} as s`, 's.id', 'c.command_status_id')
    .select(
      'c.device_id',
      knexClient.raw(`count(*) filter (where c.is_pending = true) as pending_command_count`),
      knexClient.raw(`count(*) filter (where c.is_pending = true and s.code = 'queued') as queued_command_count`),
      knexClient.raw(`count(*) filter (where c.is_pending = true and s.code = 'not_now') as not_now_command_count`)
    )
    .whereIn('c.device_id', deviceIds)
    .groupBy('c.device_id') as Array<{
      device_id: number
      pending_command_count: number | string | null
      queued_command_count: number | string | null
      not_now_command_count: number | string | null
    }>

  for (const row of rows) {
    countsByDeviceId.set(row.device_id, {
      pending: normalizeCount(row.pending_command_count),
      queued: normalizeCount(row.queued_command_count),
      notNow: normalizeCount(row.not_now_command_count)
    })
  }

  return countsByDeviceId
}

/** Attach precomputed command counters to the stored device rows returned from the database. */
async function attachCommandCounts(
  knexClient: Knex,
  rows: StoredIosDeviceRow[]
): Promise<StoredIosDeviceRow[]> {
  if (rows.length === 0) {
    return rows
  }

  const countsByDeviceId = await getCommandCountsByDeviceIds(
    knexClient,
    rows.map((row) => row.id)
  )

  // Merge command counters back onto each stored device row.
  return rows.map((row) => {
    const counts = countsByDeviceId.get(row.id)
    return {
      ...row,
      pending_command_count: counts?.pending ?? 0,
      queued_command_count: counts?.queued ?? 0,
      not_now_command_count: counts?.notNow ?? 0
    }
  })
}

/** Convert the raw stored device row into the service response shape used by the rest of the app. */
function buildDeviceView(row: StoredIosDeviceRow): any {
  const payload = isPlainObject(row.last_checkin_payload_json) ? row.last_checkin_payload_json : {}
  const inventory = isPlainObject(row.inventory_json) ? row.inventory_json : {}

  // Blend the latest check-in payload and saved inventory into one backward-compatible device view.
  return {
    ...payload,
    ...inventory,
    UDID: row.udid,
    Topic: row.current_topic,
    Token: row.apns_device_token,
    PushMagic: row.push_magic,
    UnlockToken: row.unlock_token,
    DeviceName: row.device_name ?? inventory.DeviceName ?? null,
    Model: row.model ?? inventory.Model ?? null,
    ProductName: row.product_name ?? inventory.ProductName ?? null,
    SerialNumber: row.serial_number ?? inventory.SerialNumber ?? null,
    OSVersion: row.os_version ?? inventory.OSVersion ?? null,
    MessageType: row.last_message_type ?? payload.MessageType ?? null,
    groupId: row.group_id,
    enrollmentStatus: row.enrollment_status_code,
    pendingCommandCount: normalizeCount(row.pending_command_count),
    queuedCommandCount: normalizeCount(row.queued_command_count),
    notNowCommandCount: normalizeCount(row.not_now_command_count),
    lastSeen: row.last_seen_at,
    deviceId: row.id
  }
}

/** Fetch a single device by UDID and enrich it with computed command counters. */
export async function getDeviceByUdid(knexClient: Knex, udid: string): Promise<any | null> {
  const row = await getStoredDeviceRowByUdid(knexClient, udid)
  if (!row) {
    return null
  }

  const [enrichedRow] = await attachCommandCounts(knexClient, [row])
  return buildDeviceView(enrichedRow)
}

/** Insert or update a device record from check-in data, with special handling for checked-out devices. */
export async function upsertDevice(
  knexClient: Knex,
  udid: string,
  deviceData: any,
  options: UpsertDeviceOptions = {}
): Promise<any> {
  const existing = await getStoredDeviceRowByUdid(knexClient, udid)
  const messageType = pickString(deviceData?.MessageType)
  const existingStatusCode = existing?.enrollment_status_code ?? null
  // Checked-out records can either stay inert or be reactivated depending on the caller's intent.
  const shouldReactivateCheckedOut = Boolean(options.reactivateCheckedOut)
  const shouldRemainCheckedOut = existingStatusCode === 'checked_out' && !shouldReactivateCheckedOut
  const nextTopic = shouldRemainCheckedOut
    ? existing?.current_topic ?? pickString(deviceData?.Topic) ?? null
    : pickString(deviceData?.Topic) || existing?.current_topic || null

  // Do not allow an active device record to silently switch to a different APNS topic.
  if (existing?.current_topic && nextTopic && existing.current_topic !== nextTopic && existing.enrollment_status_code !== 'checked_out') {
    throw new BadRequest(
      `Device with UDID ${udid} is already enrolled with a different topic. Please check the device enrollment or contact support.`
    )
  }

  const groupId = Number(deviceData?.groupId ?? existing?.group_id)
  if (!Number.isInteger(groupId) || groupId <= 0) {
    throw new BadRequest(`Valid groupId is required to store device state for UDID ${udid}.`)
  }

  if (!nextTopic) {
    throw new BadRequest(`Device topic is required to store device state for UDID ${udid}.`)
  }

  const activeStatusId = await getEnrollmentStatusId(knexClient, 'active')
  const now = knexClient.fn.now()
  // Preserve prior inventory while a checked-out device remains inactive; otherwise merge in the latest snapshot.
  const mergedInventory = shouldRemainCheckedOut
    ? (isPlainObject(existing?.inventory_json) ? existing.inventory_json : null)
    : {
        ...(isPlainObject(existing?.inventory_json) ? existing!.inventory_json! : {}),
        ...extractInventory(deviceData)
      }

  // Build one normalized payload used for both inserts and updates.
  const updatePayload = {
    group_id: shouldRemainCheckedOut ? existing?.group_id ?? groupId : groupId,
    enrollment_status_id: shouldRemainCheckedOut ? existing?.enrollment_status_id ?? activeStatusId : activeStatusId,
    current_topic: shouldRemainCheckedOut ? existing?.current_topic ?? nextTopic : nextTopic,
    apns_device_token: shouldRemainCheckedOut
      ? existing?.apns_device_token ?? null
      : serializeBinaryValue(deviceData?.Token) ?? existing?.apns_device_token ?? null,
    push_magic: shouldRemainCheckedOut
      ? existing?.push_magic ?? null
      : pickString(deviceData?.PushMagic) ?? existing?.push_magic ?? null,
    unlock_token: shouldRemainCheckedOut
      ? existing?.unlock_token ?? null
      : serializeBinaryValue(deviceData?.UnlockToken) ?? existing?.unlock_token ?? null,
    device_name: shouldRemainCheckedOut
      ? existing?.device_name ?? null
      : pickString(deviceData?.DeviceName) ?? existing?.device_name ?? null,
    model: shouldRemainCheckedOut
      ? existing?.model ?? null
      : pickString(deviceData?.Model) ?? existing?.model ?? null,
    product_name: shouldRemainCheckedOut
      ? existing?.product_name ?? null
      : pickString(deviceData?.ProductName) ?? existing?.product_name ?? null,
    serial_number: shouldRemainCheckedOut
      ? existing?.serial_number ?? null
      : pickString(deviceData?.SerialNumber) ?? existing?.serial_number ?? null,
    os_version: shouldRemainCheckedOut
      ? existing?.os_version ?? null
      : pickString(deviceData?.OSVersion) ?? existing?.os_version ?? null,
    last_message_type: messageType ?? existing?.last_message_type ?? null,
    first_enrolled_at: existing?.first_enrolled_at ?? now,
    last_enrolled_at:
      shouldRemainCheckedOut
        ? existing?.last_enrolled_at ?? null
        : messageType === 'Authenticate'
          ? now
          : existing?.last_enrolled_at ?? now,
    last_seen_at: now,
    checked_out_at: shouldRemainCheckedOut ? existing?.checked_out_at ?? now : null,
    inventory_json:
      mergedInventory && Object.keys(mergedInventory).length > 0
        ? mergedInventory
        : null,
    last_checkin_payload_json: sanitizeForJson(deviceData),
    updated_at: now
  }

  if (existing?.id) {
    // Update the existing stored device row when the UDID is already known.
    await knexClient(IOS_DEVICES_TABLE)
      .where({ id: existing.id })
      .update(updatePayload)
  } else {
    // Insert a new stored device row for first-time enrollments.
    await knexClient(IOS_DEVICES_TABLE).insert({
      udid,
      enrolled_by_user_id: null,
      created_at: now,
      ...updatePayload
    })
  }

  return getDeviceByUdid(knexClient, udid)
}

/** Merge fresh inventory data into an already-active device record. */
export async function updateDeviceInventory(knexClient: Knex, udid: string, deviceData: any): Promise<any | null> {
  const existing = await getStoredDeviceRowByUdid(knexClient, udid)
  if (!existing?.id) {
    return null
  }

  // Ignore late inventory updates from devices that are no longer actively enrolled.
  if (existing.enrollment_status_code !== 'active') {
    return getDeviceByUdid(knexClient, udid)
  }

  const now = knexClient.fn.now()
  // Merge the newly reported inventory fields into the existing stored snapshot.
  const mergedInventory = {
    ...(isPlainObject(existing.inventory_json) ? existing.inventory_json : {}),
    ...extractInventory(deviceData)
  }
  const existingPayload = isPlainObject(existing.last_checkin_payload_json) ? existing.last_checkin_payload_json : {}
  // Keep the most recent raw payload details alongside the curated inventory snapshot.
  const nextPayload = {
    ...existingPayload,
    ...sanitizeForJson(deviceData)
  }

  await knexClient(IOS_DEVICES_TABLE)
    .where({ id: existing.id })
    .update({
      device_name: pickString(deviceData?.DeviceName) ?? existing.device_name ?? null,
      model: pickString(deviceData?.Model) ?? existing.model ?? null,
      product_name: pickString(deviceData?.ProductName) ?? existing.product_name ?? null,
      serial_number: pickString(deviceData?.SerialNumber) ?? existing.serial_number ?? null,
      os_version: pickString(deviceData?.OSVersion) ?? existing.os_version ?? null,
      inventory_json: Object.keys(mergedInventory).length > 0 ? mergedInventory : null,
      last_checkin_payload_json: Object.keys(nextPayload).length > 0 ? nextPayload : null,
      last_seen_at: now,
      updated_at: now
    })

  return getDeviceByUdid(knexClient, udid)
}

/** Mark a device as checked out, clear live push credentials, and cancel open commands. */
export async function markDeviceCheckedOut(knexClient: Knex, udid: string, deviceData?: any): Promise<boolean> {
  const existing = await getStoredDeviceRowByUdid(knexClient, udid)
  if (!existing?.id) {
    return false
  }

  const checkedOutStatusId = await getEnrollmentStatusId(knexClient, 'checked_out')
  const now = knexClient.fn.now()

  // Clear APNS communication fields so the device is no longer treated as manageable.
  await knexClient(IOS_DEVICES_TABLE)
    .where({ id: existing.id })
    .update({
      enrollment_status_id: checkedOutStatusId,
      apns_device_token: null,
      push_magic: null,
      unlock_token: null,
      last_message_type: pickString(deviceData?.MessageType) ?? 'CheckOut',
      last_seen_at: now,
      checked_out_at: now,
      last_checkin_payload_json: sanitizeForJson(deviceData ?? { MessageType: 'CheckOut', UDID: udid }),
      updated_at: now
    })

  // Checked-out devices should not keep pending management commands in the queue.
  await cancelOpenCommandsForDevice(knexClient, udid, 'Device checked out and is no longer managed.')

  return true
}

/** Return all active devices currently enrolled under a specific APNS topic. */
export async function getDevicesByTopic(knexClient: Knex, topic: string): Promise<any[]> {
  const rows = await knexClient(`${IOS_DEVICES_TABLE} as d`)
    .innerJoin(`${IOS_DEVICE_ENROLLMENT_STATUSES_TABLE} as s`, 's.id', 'd.enrollment_status_id')
    .select(
      'd.id',
      'd.group_id',
      'd.udid',
      'd.enrollment_status_id',
      's.code as enrollment_status_code',
      'd.current_topic',
      'd.apns_device_token',
      'd.push_magic',
      'd.unlock_token',
      'd.device_name',
      'd.model',
      'd.product_name',
      'd.serial_number',
      'd.os_version',
      'd.last_message_type',
      'd.enrolled_by_user_id',
      'd.first_enrolled_at',
      'd.last_enrolled_at',
      'd.last_seen_at',
      'd.checked_out_at',
      'd.inventory_json',
      'd.last_checkin_payload_json',
      'd.created_at',
      'd.updated_at'
    )
    .where('d.current_topic', topic)
    .where('s.code', 'active')
    .orderBy('d.last_seen_at', 'desc') as StoredIosDeviceRow[]

  // Enrich the list with command counters before returning it to service callers.
  const enrichedRows = await attachCommandCounts(knexClient, rows)
  return enrichedRows.map((row) => buildDeviceView(row))
}

/** Return all active devices that belong to the specified group. */
export async function getDevicesByGroupId(knexClient: Knex, groupId: number): Promise<any[]> {
  const rows = await knexClient(`${IOS_DEVICES_TABLE} as d`)
    .innerJoin(`${IOS_DEVICE_ENROLLMENT_STATUSES_TABLE} as s`, 's.id', 'd.enrollment_status_id')
    .select(
      'd.id',
      'd.group_id',
      'd.udid',
      'd.enrollment_status_id',
      's.code as enrollment_status_code',
      'd.current_topic',
      'd.apns_device_token',
      'd.push_magic',
      'd.unlock_token',
      'd.device_name',
      'd.model',
      'd.product_name',
      'd.serial_number',
      'd.os_version',
      'd.last_message_type',
      'd.enrolled_by_user_id',
      'd.first_enrolled_at',
      'd.last_enrolled_at',
      'd.last_seen_at',
      'd.checked_out_at',
      'd.inventory_json',
      'd.last_checkin_payload_json',
      'd.created_at',
      'd.updated_at'
    )
    .where('d.group_id', groupId)
    .where('s.code', 'active')
    .orderBy('d.last_seen_at', 'desc') as StoredIosDeviceRow[]

  // Enrich the list with command counters before returning it to service callers.
  const enrichedRows = await attachCommandCounts(knexClient, rows)
  return enrichedRows.map((row) => buildDeviceView(row))
}
