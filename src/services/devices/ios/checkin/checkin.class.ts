// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import type { Application } from '../../../../declarations'
import type { DevicesIosCheckin, DevicesIosCheckinData, DevicesIosCheckinPatch, DevicesIosCheckinQuery } from './checkin.schema'
import plist from 'plist'
import { getDeviceByUdid, markDeviceCheckedOut, upsertDevice as upsertDeviceInStore } from '../ios-device-store'
import { logger } from '../../../../logger'
import { BadRequest, MethodNotAllowed } from '@feathersjs/errors'
import type { Knex } from 'knex'
import { consumeEnrollmentToken } from '../enrollment/enrollment-token'

export type { DevicesIosCheckin, DevicesIosCheckinData, DevicesIosCheckinPatch, DevicesIosCheckinQuery }

export interface DevicesIosCheckinServiceOptions {
  app: Application
}

export interface DevicesIosCheckinParams extends Params<DevicesIosCheckinQuery> {}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class DevicesIosCheckinService<
  ServiceParams extends DevicesIosCheckinParams = DevicesIosCheckinParams
> implements ServiceInterface<
  DevicesIosCheckin,
  DevicesIosCheckinData,
  ServiceParams,
  DevicesIosCheckinPatch
> {
  /** Initialize the check-in service. */
  constructor(public options: DevicesIosCheckinServiceOptions) {}

  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  async find(_params?: ServiceParams): Promise<DevicesIosCheckin[]> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async get(_id: Id, _params?: ServiceParams): Promise<DevicesIosCheckin> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async create(data: DevicesIosCheckinData, params?: ServiceParams): Promise<DevicesIosCheckin>
  async create(data: DevicesIosCheckinData[], params?: ServiceParams): Promise<DevicesIosCheckin[]>
  async create(
    _data: DevicesIosCheckinData | DevicesIosCheckinData[],
    _params?: ServiceParams
  ): Promise<DevicesIosCheckin | DevicesIosCheckin[]> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Handle device check-in messages and update local device state. */
  async update(id: NullableId, data: any, params?: ServiceParams): Promise<any> {
    // Apple sends check-in payloads as plist XML, so parse the raw body first.
    const msg: any = plist.parse(data)
    const { MessageType, UDID } = msg

    if (!UDID) {
      throw new BadRequest('Device check-in payload is missing UDID.')
    }

    // The enrollment token is carried on the check-in URL rather than inside the plist body.
    const enrollmentToken = typeof params?.query?.enrollmentToken === 'string'
      ? params.query.enrollmentToken
      : undefined

    // Reuse any existing owner/device state we already know for this UDID.
    const existingDevice = await getDeviceByUdid(this.knexClient, UDID) as {
      itAdminEmail?: string
      groupId?: number
      enrollmentStatus?: string
    } | null
    let groupId = typeof existingDevice?.groupId === 'number' ? existingDevice.groupId : null
    let itAdminEmail = existingDevice?.itAdminEmail || null

    // The check-in URL in the installed profile keeps the original enrollment token for
    // later TokenUpdate/CheckOut callbacks, so only consume it during Authenticate.
    // also get the groupId from the enrollment token if it's an Authenticate message,
    // even if there is an existing device record with a groupId, to handle the case where a device is re-enrolling into a different group.
    if (MessageType === 'Authenticate' && enrollmentToken) {
      groupId = await consumeEnrollmentToken(this.knexClient, enrollmentToken, UDID)
    }

    // First-time enrollment must resolve an owner from either a valid token or a known admin/device mapping.
    if (MessageType === 'Authenticate' && groupId === null && !itAdminEmail) {
      logger.error('Missing valid enrollment token for first device check-in')
      throw new BadRequest('A valid enrollment token is required for the first device check-in.')
    }

    // Checked-out devices are only allowed back into management through a fresh Authenticate with a token.
    if (MessageType === 'Authenticate' && existingDevice?.enrollmentStatus !== 'active' && !enrollmentToken) {
      throw new BadRequest('A valid enrollment token is required to re-enroll a non-active device.')
    }

    // Stop early if we still cannot determine who owns this check-in.
    if (groupId === null && !itAdminEmail) {
      throw new BadRequest('Unable to resolve the enrolling owner for this device check-in.')
    }

    logger.info('[Endpoint START]', {
      endpoint: 'devices/ios/checkin UPDATE',
      id,
      query: params?.query || null,
      input: {
        groupId,
        itAdminEmail,
        hasEnrollmentToken: Boolean(enrollmentToken),
        rawBodyLength: typeof data === 'string' ? data.length : undefined,
        messageType: MessageType || null,
        udid: UDID || null
      }
    })

    switch (MessageType) {
      case 'Authenticate':
        // Store the initial device enrollment details and reactivate checked-out records when a token is supplied.
        await upsertDeviceInStore(this.knexClient, UDID, {
          ...msg,
          ...(groupId !== null ? { groupId } : {}),
          ...(itAdminEmail ? { itAdminEmail } : {})
        }, {
          reactivateCheckedOut: Boolean(enrollmentToken)
        })
        break
      case 'TokenUpdate':
        // Refresh APNS token / push magic and other check-in metadata for an already known device.
        await upsertDeviceInStore(this.knexClient, UDID, {
          ...msg,
          ...(groupId !== null ? { groupId } : {}),
          ...(itAdminEmail ? { itAdminEmail } : {})
        })
        break
      case 'CheckOut':
        // Mark the device as no longer managed and clear live push credentials.
        await markDeviceCheckedOut(this.knexClient, UDID, {
          ...msg,
          ...(groupId !== null ? { groupId } : {}),
          ...(itAdminEmail ? { itAdminEmail } : {})
        })
        break
      default:
        logger.error('Unknown Check in Message Type', MessageType)
        break
    }

    logger.info('[Endpoint END]', {
      endpoint: 'devices/ios/checkin UPDATE',
      id,
      result: {
        groupId,
        itAdminEmail,
        messageType: MessageType,
        udid: UDID,
        ok: true
      }
    })

    return {}
  }

  async patch(
    _id: NullableId,
    _data: DevicesIosCheckinPatch,
    _params?: ServiceParams
  ): Promise<DevicesIosCheckin> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async remove(_id: NullableId, _params?: ServiceParams): Promise<DevicesIosCheckin> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

export const getOptions = (app: Application) => {
  return { app }
}
