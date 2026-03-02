// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { ClientApplication } from '../../../../../client'
import type { ServiceInterface } from '@feathersjs/feathers'

// This service returns the enrollment profile (mobileconfig XML) as a string
export type DevicesIosEnrollmentDeviceEnrollment = string

export const devicesIosEnrollmentDeviceEnrollmentPath = 'devices/ios/enrollment/device-enrollment'

// Only expose the methods you actually support
export const devicesIosEnrollmentDeviceEnrollmentMethods = ['get'] as const

export type DevicesIosEnrollmentDeviceEnrollmentClientService = Pick<
  ServiceInterface<string>,
  (typeof devicesIosEnrollmentDeviceEnrollmentMethods)[number]
>

export const devicesIosEnrollmentDeviceEnrollmentClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(
    devicesIosEnrollmentDeviceEnrollmentPath,
    connection.service(devicesIosEnrollmentDeviceEnrollmentPath),
    { methods: devicesIosEnrollmentDeviceEnrollmentMethods }
  )
}