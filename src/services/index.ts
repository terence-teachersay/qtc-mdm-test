import { itAdminIosEnrollmentDeviceEnrollment } from './it-admin/ios/enrollment/device-enrollment/device-enrollment'
import { itAdminIosDevicesStatus } from './it-admin/ios/devices-status/devices-status'
import { itAdminIosCommandsDeviceInformation } from './it-admin/ios/commands/device-information/device-information'
import { itAdminIosApnsCsr } from './it-admin/ios/apns-csr/apns-csr'
import { itAdminIosApnsCert } from './it-admin/ios/apns-cert/apns-cert'
import { devicesIosEnrollmentDeviceEnrollment } from './devices/ios/enrollment/device-enrollment/device-enrollment'
import { devicesIosScep } from './devices/ios/scep/scep'
import { devicesIosServer } from './devices/ios/server/server'
import { devicesIosCheckin } from './devices/ios/checkin/checkin'
import { users } from './users/users'
import { loginPortal } from './login-portal/login-portal'
// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html#configure-functions
import type { Application } from '../declarations'

export const services = (app: Application) => {
  app.configure(itAdminIosEnrollmentDeviceEnrollment)
  app.configure(itAdminIosDevicesStatus)
  app.configure(itAdminIosCommandsDeviceInformation)
  app.configure(users)
  app.configure(loginPortal)
  app.configure(itAdminIosApnsCsr)
  app.configure(itAdminIosApnsCert)
  app.configure(devicesIosEnrollmentDeviceEnrollment)
  app.configure(devicesIosScep)
  app.configure(devicesIosServer)
  app.configure(devicesIosCheckin)
  // All services will be registered here
}
