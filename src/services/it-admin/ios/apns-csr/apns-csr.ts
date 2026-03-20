import { hooks as schemaHooks } from '@feathersjs/schema'
import { authenticate } from '@feathersjs/authentication'
import { Role } from '../../../../constants/roles'
import { requireRole } from '../../../../hooks/require-role'

import {
  itAdminIosApnsCsrQueryValidator,
  itAdminIosApnsCsrQueryResolver
} from './apns-csr.schema'

import type { Application } from '../../../../declarations'
import { ItAdminIosApnsCsrService, getOptions } from './apns-csr.class'
import { itAdminIosApnsCsrPath, itAdminIosApnsCsrMethods } from './apns-csr.shared'

export * from './apns-csr.class'

export const itAdminIosApnsCsr = (app: Application) => {
  app.use(itAdminIosApnsCsrPath, new ItAdminIosApnsCsrService(getOptions(app)), {
    methods: itAdminIosApnsCsrMethods,
    events: []
  })

  app.service(itAdminIosApnsCsrPath).hooks({
    around: {
      all: []
    },
    before: {
      all: [
        authenticate('jwt'),
        requireRole(Role.IT_ADMIN),
        schemaHooks.validateQuery(itAdminIosApnsCsrQueryValidator),
        schemaHooks.resolveQuery(itAdminIosApnsCsrQueryResolver)
      ],
      get: []
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
    [itAdminIosApnsCsrPath]: ItAdminIosApnsCsrService
  }
}
