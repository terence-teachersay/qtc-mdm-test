import { hooks as schemaHooks } from '@feathersjs/schema'
import { authenticate } from '@feathersjs/authentication'

import { Role } from '../../../../../constants/roles'
import { requireRole } from '../../../../../hooks/require-role'
import {
  itAdminIosCommandsDeviceInformationDataValidator,
  itAdminIosCommandsDeviceInformationPatchValidator,
  itAdminIosCommandsDeviceInformationQueryValidator,
  itAdminIosCommandsDeviceInformationResolver,
  itAdminIosCommandsDeviceInformationExternalResolver,
  itAdminIosCommandsDeviceInformationDataResolver,
  itAdminIosCommandsDeviceInformationPatchResolver,
  itAdminIosCommandsDeviceInformationQueryResolver
} from './device-information.schema'

import type { Application } from '../../../../../declarations'
import { ItAdminIosCommandsDeviceInformationService, getOptions } from './device-information.class'
import {
  itAdminIosCommandsDeviceInformationPath,
  itAdminIosCommandsDeviceInformationMethods
} from './device-information.shared'

export * from './device-information.class'
export * from './device-information.schema'

export const itAdminIosCommandsDeviceInformation = (app: Application) => {
  app.use(
    itAdminIosCommandsDeviceInformationPath,
    new ItAdminIosCommandsDeviceInformationService(getOptions(app)),
    {
      methods: itAdminIosCommandsDeviceInformationMethods,
      events: []
    }
  )

  app.service(itAdminIosCommandsDeviceInformationPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(itAdminIosCommandsDeviceInformationExternalResolver),
        schemaHooks.resolveResult(itAdminIosCommandsDeviceInformationResolver)
      ]
    },
    before: {
      all: [
        authenticate('jwt'),
        requireRole(Role.IT_ADMIN),
        schemaHooks.validateQuery(itAdminIosCommandsDeviceInformationQueryValidator),
        schemaHooks.resolveQuery(itAdminIosCommandsDeviceInformationQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(itAdminIosCommandsDeviceInformationDataValidator),
        schemaHooks.resolveData(itAdminIosCommandsDeviceInformationDataResolver)
      ],
      patch: [
        schemaHooks.validateData(itAdminIosCommandsDeviceInformationPatchValidator),
        schemaHooks.resolveData(itAdminIosCommandsDeviceInformationPatchResolver)
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
    [itAdminIosCommandsDeviceInformationPath]: ItAdminIosCommandsDeviceInformationService
  }
}
