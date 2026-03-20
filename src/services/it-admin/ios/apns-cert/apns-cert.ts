import { hooks as schemaHooks } from '@feathersjs/schema'
import { authenticate } from '@feathersjs/authentication'
import { Role } from '../../../../constants/roles'
import { requireRole } from '../../../../hooks/require-role'

import {
  itAdminIosApnsCertQueryValidator,
  itAdminIosApnsCertQueryResolver
} from './apns-cert.schema'

import type { Application } from '../../../../declarations'
import { ItAdminIosApnsCertService, getOptions } from './apns-cert.class'
import { itAdminIosApnsCertPath, itAdminIosApnsCertMethods } from './apns-cert.shared'

export * from './apns-cert.class'

export const itAdminIosApnsCert = (app: Application) => {
  app.use(itAdminIosApnsCertPath, new ItAdminIosApnsCertService(getOptions(app)), {
    methods: itAdminIosApnsCertMethods,
    events: []
  })

  app.service(itAdminIosApnsCertPath).hooks({
    around: {
      all: [],
      find: [],
      get: [],    // returns string PEM — no schema resolve hooks
      create: []  // returns CertSummary — no schema resolve hooks
    },
    before: {
      all: [
        authenticate('jwt'),
        requireRole(Role.IT_ADMIN),
        schemaHooks.validateQuery(itAdminIosApnsCertQueryValidator),
        schemaHooks.resolveQuery(itAdminIosApnsCertQueryResolver)
      ],
      find: [],
      get: [],
      create: []
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
    [itAdminIosApnsCertPath]: ItAdminIosApnsCertService
  }
}
