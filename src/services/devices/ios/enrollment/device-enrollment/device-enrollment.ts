import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  devicesIosEnrollmentDeviceEnrollmentDataValidator,
  devicesIosEnrollmentDeviceEnrollmentPatchValidator,
  devicesIosEnrollmentDeviceEnrollmentQueryValidator,
  devicesIosEnrollmentDeviceEnrollmentResolver,
  devicesIosEnrollmentDeviceEnrollmentExternalResolver,
  devicesIosEnrollmentDeviceEnrollmentDataResolver,
  devicesIosEnrollmentDeviceEnrollmentPatchResolver,
  devicesIosEnrollmentDeviceEnrollmentQueryResolver
} from './device-enrollment.schema'

import type { Application } from '../../../../../declarations'
import { DevicesIosEnrollmentDeviceEnrollmentService, getOptions } from './device-enrollment.class'
import {
  devicesIosEnrollmentDeviceEnrollmentPath,
  devicesIosEnrollmentDeviceEnrollmentMethods
} from './device-enrollment.shared'

export * from './device-enrollment.class'
export * from './device-enrollment.schema'

export const devicesIosEnrollmentDeviceEnrollment = (app: Application) => {
  app.use(
    devicesIosEnrollmentDeviceEnrollmentPath,
    new DevicesIosEnrollmentDeviceEnrollmentService(getOptions(app)),
    {
      methods: devicesIosEnrollmentDeviceEnrollmentMethods,
      events: []
    }
  )

  app.service(devicesIosEnrollmentDeviceEnrollmentPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(devicesIosEnrollmentDeviceEnrollmentExternalResolver),
        schemaHooks.resolveResult(devicesIosEnrollmentDeviceEnrollmentResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(devicesIosEnrollmentDeviceEnrollmentQueryValidator),
        schemaHooks.resolveQuery(devicesIosEnrollmentDeviceEnrollmentQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(devicesIosEnrollmentDeviceEnrollmentDataValidator),
        schemaHooks.resolveData(devicesIosEnrollmentDeviceEnrollmentDataResolver)
      ],
      patch: [
        schemaHooks.validateData(devicesIosEnrollmentDeviceEnrollmentPatchValidator),
        schemaHooks.resolveData(devicesIosEnrollmentDeviceEnrollmentPatchResolver)
      ],
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

declare module '../../../../../declarations' {
  interface ServiceTypes {
    [devicesIosEnrollmentDeviceEnrollmentPath]: DevicesIosEnrollmentDeviceEnrollmentService
  }
}
