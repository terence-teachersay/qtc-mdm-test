import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../../../client'
import type {
  ItAdminIosDevicesStatus,
  ItAdminIosDevicesStatusData,
  ItAdminIosDevicesStatusPatch,
  ItAdminIosDevicesStatusQuery,
  ItAdminIosDevicesStatusService
} from './devices-status.class'

export type {
  ItAdminIosDevicesStatus,
  ItAdminIosDevicesStatusData,
  ItAdminIosDevicesStatusPatch,
  ItAdminIosDevicesStatusQuery
}

export type ItAdminIosDevicesStatusClientService = Pick<
  ItAdminIosDevicesStatusService<Params<ItAdminIosDevicesStatusQuery>>,
  (typeof itAdminIosDevicesStatusMethods)[number]
>

export const itAdminIosDevicesStatusPath = 'it-admin/ios/devices-status'

export const itAdminIosDevicesStatusMethods: Array<keyof ItAdminIosDevicesStatusService> = [
  'find',
  'get',
  'create',
  'patch',
  'remove'
]

export const itAdminIosDevicesStatusClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(itAdminIosDevicesStatusPath, connection.service(itAdminIosDevicesStatusPath), {
    methods: itAdminIosDevicesStatusMethods
  })
}

declare module '../../../../client' {
  interface ServiceTypes {
    [itAdminIosDevicesStatusPath]: ItAdminIosDevicesStatusClientService
  }
}
