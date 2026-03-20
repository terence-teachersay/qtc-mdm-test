// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../../../client'
import type {
  DevicesIosScep,
  DevicesIosScepData,
  DevicesIosScepPatch,
  DevicesIosScepQuery,
  DevicesIosScepService
} from './scep.class.ts'

export type { DevicesIosScep, DevicesIosScepData, DevicesIosScepPatch, DevicesIosScepQuery }

export type DevicesIosScepClientService = Pick<
  DevicesIosScepService<Params<DevicesIosScepQuery>>,
  (typeof devicesIosScepMethods)[number]
>

export const devicesIosScepPath = 'devices/ios/scep'

export const devicesIosScepMethods: Array<keyof DevicesIosScepService> = [
  'find',
  'get',
  'create',
  'patch',
  'remove'
]

export const devicesIosScepClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(devicesIosScepPath, connection.service(devicesIosScepPath), {
    methods: devicesIosScepMethods
  })
}

// Add this service to the client service type index
declare module '../../../../client' {
  interface ServiceTypes {
    [devicesIosScepPath]: DevicesIosScepClientService
  }
}
