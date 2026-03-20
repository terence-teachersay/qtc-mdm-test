import type { Params } from '@feathersjs/feathers'
import type {
  DevicesIosEnrollmentDeviceEnrollment,
  DevicesIosEnrollmentDeviceEnrollmentData,
  DevicesIosEnrollmentDeviceEnrollmentPatch,
  DevicesIosEnrollmentDeviceEnrollmentQuery,
  DevicesIosEnrollmentDeviceEnrollmentService
} from './device-enrollment.class'

export type {
  DevicesIosEnrollmentDeviceEnrollment,
  DevicesIosEnrollmentDeviceEnrollmentData,
  DevicesIosEnrollmentDeviceEnrollmentPatch,
  DevicesIosEnrollmentDeviceEnrollmentQuery
}

export type DevicesIosEnrollmentDeviceEnrollmentClientService = Pick<
  DevicesIosEnrollmentDeviceEnrollmentService<Params<DevicesIosEnrollmentDeviceEnrollmentQuery>>,
  (typeof devicesIosEnrollmentDeviceEnrollmentMethods)[number]
>

export const devicesIosEnrollmentDeviceEnrollmentPath = 'devices/ios/enrollment/device-enrollment'

export const devicesIosEnrollmentDeviceEnrollmentMethods: Array<
  keyof DevicesIosEnrollmentDeviceEnrollmentService
> = ['find', 'get', 'create', 'patch', 'remove']
