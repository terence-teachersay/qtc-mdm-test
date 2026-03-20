import { hooks as schemaHooks } from '@feathersjs/schema'
import { authenticate } from '@feathersjs/authentication'

import { Role } from '../../../../constants/roles'
import { requireRole } from '../../../../hooks/require-role'
import {
  itAdminIosDevicesStatusDataValidator,
  itAdminIosDevicesStatusPatchValidator,
  itAdminIosDevicesStatusQueryValidator,
  itAdminIosDevicesStatusResolver,
  itAdminIosDevicesStatusExternalResolver,
  itAdminIosDevicesStatusDataResolver,
  itAdminIosDevicesStatusPatchResolver,
  itAdminIosDevicesStatusQueryResolver
} from './devices-status.schema'

import type { Application } from '../../../../declarations'
import { ItAdminIosDevicesStatusService, getOptions } from './devices-status.class'
import {
  itAdminIosDevicesStatusPath,
  itAdminIosDevicesStatusMethods
} from './devices-status.shared'

export * from './devices-status.class'
export * from './devices-status.schema'

export const itAdminIosDevicesStatus = (app: Application) => {
  app.use(itAdminIosDevicesStatusPath, new ItAdminIosDevicesStatusService(getOptions(app)), {
    methods: itAdminIosDevicesStatusMethods,
    events: []
  })

  app.service(itAdminIosDevicesStatusPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(itAdminIosDevicesStatusExternalResolver),
        schemaHooks.resolveResult(itAdminIosDevicesStatusResolver)
      ]
    },
    before: {
      all: [
        authenticate('jwt'),
        requireRole(Role.IT_ADMIN),
        schemaHooks.validateQuery(itAdminIosDevicesStatusQueryValidator),
        schemaHooks.resolveQuery(itAdminIosDevicesStatusQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(itAdminIosDevicesStatusDataValidator),
        schemaHooks.resolveData(itAdminIosDevicesStatusDataResolver)
      ],
      patch: [
        schemaHooks.validateData(itAdminIosDevicesStatusPatchValidator),
        schemaHooks.resolveData(itAdminIosDevicesStatusPatchResolver)
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

declare module '../../../../declarations' {
  interface ServiceTypes {
    [itAdminIosDevicesStatusPath]: ItAdminIosDevicesStatusService
  }
}
