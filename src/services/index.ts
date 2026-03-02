import { devicesIosEnrollmentDeviceEnrollment } from './devices/ios/enrollment/device-enrollment/device-enrollment'
// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html#configure-functions
import type { Application } from '../declarations'

export const services = (app: Application) => {
  app.configure(devicesIosEnrollmentDeviceEnrollment)
  // All services will be registered here
}
