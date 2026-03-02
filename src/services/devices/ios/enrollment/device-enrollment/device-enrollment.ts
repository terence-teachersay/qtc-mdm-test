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
      all: [],
      get: [
        async (context) => {
         const xml = context.result as string

          // ✅ Send bytes so Feathers/Express won't JSON-wrap it
          ;(context as any).dispatch = Buffer.from(xml, 'utf8')

          // ✅ Set HTTP response details for REST transport
          context.http = context.http ?? {}
          context.http.status = 200
          context.http.headers = {
            ...(context.http.headers ?? {}),
            'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
            'Content-Disposition': 'attachment; filename="enroll.mobileconfig"',
            'Cache-Control': 'no-store'
          }

          return context
        }
      ]
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
