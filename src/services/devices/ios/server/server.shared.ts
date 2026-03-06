// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../../../client'
import type {
  DevicesIosServer,
  DevicesIosServerData,
  DevicesIosServerPatch,
  DevicesIosServerQuery,
  DevicesIosServerService
} from './server.class'

export type { DevicesIosServer, DevicesIosServerData, DevicesIosServerPatch, DevicesIosServerQuery }

export type DevicesIosServerClientService = Pick<
  DevicesIosServerService<Params<DevicesIosServerQuery>>,
  (typeof devicesIosServerMethods)[number]
>

export const devicesIosServerPath = 'devices/ios/server'

export const devicesIosServerMethods: Array<keyof DevicesIosServerService> = [
  'find',
  'get',
  'create',
  'patch',
  'remove',
  'update'
]

export const devicesIosServerClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(devicesIosServerPath, connection.service(devicesIosServerPath), {
    methods: devicesIosServerMethods
  })
}

// Add this service to the client service type index
declare module '../../../../client' {
  interface ServiceTypes {
    [devicesIosServerPath]: DevicesIosServerClientService
  }
}
