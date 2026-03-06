// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { create } from 'domain'
import type { Application } from '../../../../../declarations'
import { DevicesIosEnrollmentDeviceEnrollmentService, getOptions } from './device-enrollment.class'
import {
  devicesIosEnrollmentDeviceEnrollmentPath,
  devicesIosEnrollmentDeviceEnrollmentMethods
} from './device-enrollment.shared'

export * from './device-enrollment.class'
export * from './device-enrollment.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const devicesIosEnrollmentDeviceEnrollment = (app: Application) => {
  // Register our service on the Feathers application
  app.use(
    devicesIosEnrollmentDeviceEnrollmentPath,
    new DevicesIosEnrollmentDeviceEnrollmentService(getOptions(app)),
    {
      // A list of all methods this service exposes externally
      methods: devicesIosEnrollmentDeviceEnrollmentMethods,
      // You can add additional custom events to be sent to clients here
      events: []
    }
  )
  // Initialize hooks
  app.service(devicesIosEnrollmentDeviceEnrollmentPath).hooks({
    around: {
      all: []
    },
    before: {
      all: [],
      find: [],
      get: [],
      create: [],
      patch: [],
      remove: []
    },
    after: {
      all: []
    },
    error: {
      all: []
    }
  })
}

// Add this service to the service type index
declare module '../../../../../declarations' {
  interface ServiceTypes {
    [devicesIosEnrollmentDeviceEnrollmentPath]: DevicesIosEnrollmentDeviceEnrollmentService
  }
}
