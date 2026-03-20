import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import { BadRequest, MethodNotAllowed } from '@feathersjs/errors'
import type { Knex } from 'knex'

import type { Application } from '../../../../../declarations'
import type {
  ItAdminIosCommandsDeviceInformation,
  ItAdminIosCommandsDeviceInformationData,
  ItAdminIosCommandsDeviceInformationPatch,
  ItAdminIosCommandsDeviceInformationQuery
} from './device-information.schema'
import { logger } from '../../../../../logger'
import { addCommand } from '../../../../devices/ios/command-queue'
import { sendApnsPush } from '../../../../devices/ios/apns-push'
import { getDeviceByUdid } from '../../../../devices/ios/ios-device-store'
import { itAdminIosCommandsDeviceInformationPath } from './device-information.shared'

export type {
  ItAdminIosCommandsDeviceInformation,
  ItAdminIosCommandsDeviceInformationData,
  ItAdminIosCommandsDeviceInformationPatch,
  ItAdminIosCommandsDeviceInformationQuery
}

export interface ItAdminIosCommandsDeviceInformationServiceOptions {
  app: Application
}

export interface ItAdminIosCommandsDeviceInformationParams extends Params<ItAdminIosCommandsDeviceInformationQuery> {
  user?: {
    id?: number | string
    email?: string
  }
  group_id?: number
  authorizedGroupIds?: number[]
  authorizedRole?: string
}

export class ItAdminIosCommandsDeviceInformationService<
  ServiceParams extends ItAdminIosCommandsDeviceInformationParams = ItAdminIosCommandsDeviceInformationParams
> implements ServiceInterface<
  ItAdminIosCommandsDeviceInformation,
  ItAdminIosCommandsDeviceInformationData,
  ServiceParams,
  ItAdminIosCommandsDeviceInformationPatch
> {
  /** Initialize the device-information command service with the current application instance. */
  constructor(public options: ItAdminIosCommandsDeviceInformationServiceOptions) {}

  /** Lazy accessor for the Knex database client from app config. */
  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  /** Listing queued device-information commands is not supported by this service. */
  async find(_params?: ServiceParams): Promise<ItAdminIosCommandsDeviceInformation[]> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Fetching a single device-information command is not supported by this service. */
  async get(_id: Id, _params?: ServiceParams): Promise<ItAdminIosCommandsDeviceInformation> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Queue a DeviceInformation command for one or more devices and send an APNS wake-up when possible. */
  async create(data: any, params?: ServiceParams): Promise<any> {
    const userId = Number(params?.user?.id)
    const userEmail = params?.user?.email as string | undefined
    const groupId = Number(params?.group_id)
    // Normalize single and multi-device inputs into one deduplicated UDID list.
    const normalizedUdids = Array.from(
      new Set(
        [
          ...(Array.isArray(data?.udids) ? data.udids : []),
          ...(typeof data?.udid === 'string' ? [data.udid] : [])
        ]
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      )
    )

    logger.info('[Endpoint START]', {
      endpoint: `${itAdminIosCommandsDeviceInformationPath} CREATE`,
      id: null,
      query: params?.query || null,
      input: {
        userId: Number.isFinite(userId) ? userId : null,
        userEmail: userEmail || null,
        groupId: Number.isInteger(groupId) ? groupId : null,
        udids: normalizedUdids
      }
    })

    // This command endpoint is always scoped to the caller's authorized group.
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new BadRequest('Authorized group_id is required to send iOS device commands.')
    }

    if (normalizedUdids.length === 0) {
      throw new BadRequest('Must supply udid or udids.')
    }

    const deviceInfoPayload = {
      RequestType: 'DeviceInformation',
      Queries: [
        'Model',
        'ProductName',
        'SerialNumber',
        'DeviceName',
        'OSVersion',
        'AvailableDeviceCapacity',
        'BatteryLevel',
        'StorageCapacity'
      ]
    }

    // Verify every requested UDID exists and belongs to the authorized group before queueing anything.
    const devices = await Promise.all(
      normalizedUdids.map(async (udid) => {
        const device = await getDeviceByUdid(this.knexClient, udid)
        if (!device) {
          throw new BadRequest(`Device UDID not found: ${udid}`)
        }

        if (Number(device.groupId) !== groupId) {
          throw new BadRequest(`Device UDID ${udid} does not belong to authorized group_id ${groupId}.`)
        }

        return { udid, device }
      })
    )

    const results: any[] = []

    for (const { udid, device } of devices) {
      // Queue the command in the shared MDM command table first.
      const queuedCommand = await addCommand(
        this.knexClient,
        udid,
        'DeviceInformation',
        deviceInfoPayload,
        1,
        Number.isFinite(userId) ? userId : null
      )

      // Wake the device through APNS when it has a current push token.
      if (device.Token) {
        await sendApnsPush(this.options.app, device.Token, device.PushMagic, groupId, device.Topic)
      }

      results.push({
        udid,
        ...queuedCommand
      })
    }

    const result = results.length === 1 ? results[0] : results

    logger.info('[Endpoint END]', {
      endpoint: `${itAdminIosCommandsDeviceInformationPath} CREATE`,
      id: null,
      result: {
        userId: Number.isFinite(userId) ? userId : null,
        userEmail,
        groupId,
        udidCount: normalizedUdids.length,
        queuedCount: results.length,
        commandUUIDs: results.map((entry) => entry.commandUUID)
      }
    })

    return result
  }

  /** Full command replacement is not supported by this service. */
  async update(
    _id: NullableId,
    _data: ItAdminIosCommandsDeviceInformationData,
    _params?: ServiceParams
  ): Promise<ItAdminIosCommandsDeviceInformation> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Partial command updates are not supported by this service. */
  async patch(
    _id: NullableId,
    _data: ItAdminIosCommandsDeviceInformationPatch,
    _params?: ServiceParams
  ): Promise<ItAdminIosCommandsDeviceInformation> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Command deletion is not supported by this service. */
  async remove(_id: NullableId, _params?: ServiceParams): Promise<ItAdminIosCommandsDeviceInformation> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

/** Build the service options object used when registering the device-information command service. */
export const getOptions = (app: Application) => {
  return { app }
}
