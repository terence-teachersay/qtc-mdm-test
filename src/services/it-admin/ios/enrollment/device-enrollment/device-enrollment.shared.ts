// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../../../../client'
import type {
  ItAdminIosEnrollmentDeviceEnrollment,
  ItAdminIosEnrollmentDeviceEnrollmentData,
  ItAdminIosEnrollmentDeviceEnrollmentPatch,
  ItAdminIosEnrollmentDeviceEnrollmentQuery,
  ItAdminIosEnrollmentDeviceEnrollmentService
} from './device-enrollment.class'

export type {
  ItAdminIosEnrollmentDeviceEnrollment,
  ItAdminIosEnrollmentDeviceEnrollmentData,
  ItAdminIosEnrollmentDeviceEnrollmentPatch,
  ItAdminIosEnrollmentDeviceEnrollmentQuery
}

export type ItAdminIosEnrollmentDeviceEnrollmentClientService = Pick<
  ItAdminIosEnrollmentDeviceEnrollmentService<Params<ItAdminIosEnrollmentDeviceEnrollmentQuery>>,
  (typeof itAdminIosEnrollmentDeviceEnrollmentMethods)[number]
>

export const itAdminIosEnrollmentDeviceEnrollmentPath = 'it-admin/ios/enrollment/device-enrollment'

export const itAdminIosEnrollmentDeviceEnrollmentMethods: Array<
  keyof ItAdminIosEnrollmentDeviceEnrollmentService
> = ['find', 'get', 'create', 'patch', 'remove']

export const itAdminIosEnrollmentDeviceEnrollmentClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(
    itAdminIosEnrollmentDeviceEnrollmentPath,
    connection.service(itAdminIosEnrollmentDeviceEnrollmentPath),
    {
      methods: itAdminIosEnrollmentDeviceEnrollmentMethods
    }
  )
}

// Add this service to the client service type index
declare module '../../../../../client' {
  interface ServiceTypes {
    [itAdminIosEnrollmentDeviceEnrollmentPath]: ItAdminIosEnrollmentDeviceEnrollmentClientService
  }
}
