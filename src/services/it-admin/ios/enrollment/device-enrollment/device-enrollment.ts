// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { authenticate } from '@feathersjs/authentication'
import { Role } from '../../../../../constants/roles'
import { requireRole } from '../../../../../hooks/require-role'

import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  itAdminIosEnrollmentDeviceEnrollmentDataValidator,
  itAdminIosEnrollmentDeviceEnrollmentPatchValidator,
  itAdminIosEnrollmentDeviceEnrollmentQueryValidator,
  itAdminIosEnrollmentDeviceEnrollmentResolver,
  itAdminIosEnrollmentDeviceEnrollmentExternalResolver,
  itAdminIosEnrollmentDeviceEnrollmentDataResolver,
  itAdminIosEnrollmentDeviceEnrollmentPatchResolver,
  itAdminIosEnrollmentDeviceEnrollmentQueryResolver
} from './device-enrollment.schema'

import type { Application } from '../../../../../declarations'
import { ItAdminIosEnrollmentDeviceEnrollmentService, getOptions } from './device-enrollment.class'
import {
  itAdminIosEnrollmentDeviceEnrollmentPath,
  itAdminIosEnrollmentDeviceEnrollmentMethods
} from './device-enrollment.shared'

export * from './device-enrollment.class'
export * from './device-enrollment.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const itAdminIosEnrollmentDeviceEnrollment = (app: Application) => {
  // Register our service on the Feathers application
  app.use(
    itAdminIosEnrollmentDeviceEnrollmentPath,
    new ItAdminIosEnrollmentDeviceEnrollmentService(getOptions(app)),
    {
      // A list of all methods this service exposes externally
      methods: itAdminIosEnrollmentDeviceEnrollmentMethods,
      // You can add additional custom events to be sent to clients here
      events: []
    }
  )
  // Initialize hooks
  app.service(itAdminIosEnrollmentDeviceEnrollmentPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(itAdminIosEnrollmentDeviceEnrollmentExternalResolver),
        schemaHooks.resolveResult(itAdminIosEnrollmentDeviceEnrollmentResolver)
      ]
    },
    before: {
      all: [
        authenticate('jwt'),
        requireRole(Role.IT_ADMIN),
        schemaHooks.validateQuery(itAdminIosEnrollmentDeviceEnrollmentQueryValidator),
        schemaHooks.resolveQuery(itAdminIosEnrollmentDeviceEnrollmentQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(itAdminIosEnrollmentDeviceEnrollmentDataValidator),
        schemaHooks.resolveData(itAdminIosEnrollmentDeviceEnrollmentDataResolver)
      ],
      patch: [
        schemaHooks.validateData(itAdminIosEnrollmentDeviceEnrollmentPatchValidator),
        schemaHooks.resolveData(itAdminIosEnrollmentDeviceEnrollmentPatchResolver)
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

// Add this service to the service type index
declare module '../../../../../declarations' {
  interface ServiceTypes {
    [itAdminIosEnrollmentDeviceEnrollmentPath]: ItAdminIosEnrollmentDeviceEnrollmentService
  }
}
