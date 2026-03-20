import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import { BadRequest, MethodNotAllowed } from '@feathersjs/errors'
import type { Knex } from 'knex'

import type { Application } from '../../../../declarations'
import type {
  ItAdminIosDevicesStatus,
  ItAdminIosDevicesStatusData,
  ItAdminIosDevicesStatusPatch,
  ItAdminIosDevicesStatusQuery
} from './devices-status.schema'
import { getDevicesByGroupId } from '../../../devices/ios/ios-device-store'
import { logger } from '../../../../logger'
import { itAdminIosDevicesStatusPath } from './devices-status.shared'

export type {
  ItAdminIosDevicesStatus,
  ItAdminIosDevicesStatusData,
  ItAdminIosDevicesStatusPatch,
  ItAdminIosDevicesStatusQuery
}

export interface ItAdminIosDevicesStatusServiceOptions {
  app: Application
}

export interface ItAdminIosDevicesStatusParams extends Params<ItAdminIosDevicesStatusQuery> {
  user?: {
    id?: number | string
    email?: string
  }
  group_id?: number
  authorizedGroupIds?: number[]
  authorizedRole?: string
}

export class ItAdminIosDevicesStatusService<
  ServiceParams extends ItAdminIosDevicesStatusParams = ItAdminIosDevicesStatusParams
> implements ServiceInterface<
  ItAdminIosDevicesStatus,
  ItAdminIosDevicesStatusData,
  ServiceParams,
  ItAdminIosDevicesStatusPatch
> {
  /** Initialize the devices-status service with the current application instance. */
  constructor(public options: ItAdminIosDevicesStatusServiceOptions) {}

  /** Lazy accessor for the Knex database client from app config. */
  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  /** Listing devices-status resources is not supported by this service. */
  async find(_params?: ServiceParams): Promise<ItAdminIosDevicesStatus[]> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Return the active device list for the authorized group together with APNS-topic validation. */
  async get(id: Id, _params?: ServiceParams): Promise<any> {
    const userId = Number(_params?.user?.id)
    const userEmail = _params?.user?.email as string | undefined
    const groupId = Number(_params?.group_id)

    // This endpoint is always scoped to the caller's authorized group.
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new BadRequest('Authorized group_id is required to list iOS devices.')
    }

    logger.info('[Endpoint START]', {
      endpoint: `${itAdminIosDevicesStatusPath} GET`,
      id,
      query: _params?.query || null,
      input: {
        userId: Number.isFinite(userId) ? userId : null,
        userEmail,
        groupId
      }
    })

    // Ensure the group still has a valid APNS topic before reporting device status for that tenant.
    const contentTopic = await this.getActiveApnsTopicForGroup(groupId)
    // Load all active devices for the group from the shared iOS device store.
    const devices = await getDevicesByGroupId(this.knexClient, groupId)

    logger.info('[Endpoint END]', {
      endpoint: `${itAdminIosDevicesStatusPath} GET`,
      id,
      result: {
        userId: Number.isFinite(userId) ? userId : null,
        userEmail,
        groupId,
        topic: contentTopic,
        resultCount: Array.isArray(devices) ? devices.length : 0
      }
    })

    return devices
  }

  /** Resolve the active, non-expired APNS certificate topic for the requested group. */
  private async getActiveApnsTopicForGroup(groupId: number): Promise<string> {
    const apnsPushTypeId = await this.getCertificateTypeId('apns_push')
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

    return contentTopic
  }

  /** Look up the numeric ID for a certificate type by its code string. */
  private async getCertificateTypeId(code: string): Promise<number> {
    const row = await this.knexClient('certificate_types')
      .select('id')
      .where({ code })
      .first() as { id: number } | undefined

    if (!row?.id) {
      throw new Error(`Certificate type lookup row is missing for code "${code}". Run the certificate migration first.`)
    }

    return row.id
  }

  /** Creating device-status resources is not supported by this service. */
  async create(
    data: ItAdminIosDevicesStatusData,
    params?: ServiceParams
  ): Promise<ItAdminIosDevicesStatus>
  async create(
    data: ItAdminIosDevicesStatusData[],
    params?: ServiceParams
  ): Promise<ItAdminIosDevicesStatus[]>
  async create(
    data: ItAdminIosDevicesStatusData | ItAdminIosDevicesStatusData[],
    params?: ServiceParams
  ): Promise<ItAdminIosDevicesStatus | ItAdminIosDevicesStatus[]> {
    if (Array.isArray(data)) {
      return Promise.all(data.map((current) => this.create(current, params)))
    }

    throw new MethodNotAllowed('Method not allowed')
  }

  /** Full device-status updates are not supported by this service. */
  async update(
    _id: NullableId,
    _data: ItAdminIosDevicesStatusData,
    _params?: ServiceParams
  ): Promise<ItAdminIosDevicesStatus> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Partial device-status updates are not supported by this service. */
  async patch(
    _id: NullableId,
    _data: ItAdminIosDevicesStatusPatch,
    _params?: ServiceParams
  ): Promise<ItAdminIosDevicesStatus> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Device-status deletion is not supported by this service. */
  async remove(_id: NullableId, _params?: ServiceParams): Promise<ItAdminIosDevicesStatus> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

/** Build the service options object used when registering the devices-status service. */
export const getOptions = (app: Application) => {
  return { app }
}
