import { hooks as schemaHooks } from '@feathersjs/schema'
import { authenticate } from '@feathersjs/authentication'

import {
  loginPortalDataResolver,
  loginPortalDataValidator,
  loginPortalExternalResolver,
  loginPortalPatchResolver,
  loginPortalPatchValidator,
  loginPortalQueryResolver,
  loginPortalQueryValidator,
  loginPortalResolver
} from './login-portal.schema'

import type { Application } from '../../declarations'
import { LoginPortalService, getOptions } from './login-portal.class'
import { loginPortalMethods, loginPortalPath } from './login-portal.shared'

export * from './login-portal.class'
export * from './login-portal.schema'

export const loginPortal = (app: Application) => {
  app.use(loginPortalPath, new LoginPortalService(getOptions(app)), {
    methods: loginPortalMethods,
    events: []
  })

  app.service(loginPortalPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(loginPortalExternalResolver),
        schemaHooks.resolveResult(loginPortalResolver)
      ]
    },
    before: {
      all: [
        authenticate('jwt'),
        schemaHooks.validateQuery(loginPortalQueryValidator),
        schemaHooks.resolveQuery(loginPortalQueryResolver)
      ],
      find: [],
      get: [],
      create: [schemaHooks.validateData(loginPortalDataValidator), schemaHooks.resolveData(loginPortalDataResolver)],
      patch: [schemaHooks.validateData(loginPortalPatchValidator), schemaHooks.resolveData(loginPortalPatchResolver)],
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

declare module '../../declarations' {
  interface ServiceTypes {
    [loginPortalPath]: LoginPortalService
  }
}