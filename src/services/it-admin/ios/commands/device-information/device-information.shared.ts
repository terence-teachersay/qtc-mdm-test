import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../../../../client'
import type {
  ItAdminIosCommandsDeviceInformation,
  ItAdminIosCommandsDeviceInformationData,
  ItAdminIosCommandsDeviceInformationPatch,
  ItAdminIosCommandsDeviceInformationQuery,
  ItAdminIosCommandsDeviceInformationService
} from './device-information.class'

export type {
  ItAdminIosCommandsDeviceInformation,
  ItAdminIosCommandsDeviceInformationData,
  ItAdminIosCommandsDeviceInformationPatch,
  ItAdminIosCommandsDeviceInformationQuery
}

export type ItAdminIosCommandsDeviceInformationClientService = Pick<
  ItAdminIosCommandsDeviceInformationService<Params<ItAdminIosCommandsDeviceInformationQuery>>,
  (typeof itAdminIosCommandsDeviceInformationMethods)[number]
>

export const itAdminIosCommandsDeviceInformationPath = 'it-admin/ios/commands/device-information'

export const itAdminIosCommandsDeviceInformationMethods: Array<
  keyof ItAdminIosCommandsDeviceInformationService
> = ['find', 'get', 'create', 'patch', 'remove']

export const itAdminIosCommandsDeviceInformationClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(
    itAdminIosCommandsDeviceInformationPath,
    connection.service(itAdminIosCommandsDeviceInformationPath),
    {
      methods: itAdminIosCommandsDeviceInformationMethods
    }
  )
}

declare module '../../../../../client' {
  interface ServiceTypes {
    [itAdminIosCommandsDeviceInformationPath]: ItAdminIosCommandsDeviceInformationClientService
  }
}
