// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../../../client'
import type {
  DevicesIosCheckin,
  DevicesIosCheckinData,
  DevicesIosCheckinPatch,
  DevicesIosCheckinQuery,
  DevicesIosCheckinService
} from './checkin.class'

export type { DevicesIosCheckin, DevicesIosCheckinData, DevicesIosCheckinPatch, DevicesIosCheckinQuery }

export type DevicesIosCheckinClientService = Pick<
  DevicesIosCheckinService<Params<DevicesIosCheckinQuery>>,
  (typeof devicesIosCheckinMethods)[number]
>

export const devicesIosCheckinPath = 'devices/ios/checkin'

export const devicesIosCheckinMethods: Array<keyof DevicesIosCheckinService> = [
  'find',
  'get',
  'create',
  'patch',
  'remove',
  'update'
]

export const devicesIosCheckinClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(devicesIosCheckinPath, connection.service(devicesIosCheckinPath), {
    methods: devicesIosCheckinMethods
  })
}

// Add this service to the client service type index
declare module '../../../../client' {
  interface ServiceTypes {
    [devicesIosCheckinPath]: DevicesIosCheckinClientService
  }
}
