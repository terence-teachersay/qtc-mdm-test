import { devicesIosServer } from './devices/ios/server/server'
import { devicesIosCheckin } from './devices/ios/checkin/checkin'
import { devicesIosEnrollmentDeviceEnrollment } from './devices/ios/enrollment/device-enrollment/device-enrollment'
// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html#configure-functions
import type { Application } from '../declarations'

export const services = (app: Application) => {
  app.configure(devicesIosServer)
  app.configure(devicesIosCheckin)
  app.configure(devicesIosEnrollmentDeviceEnrollment)
  // All services will be registered here
}
