import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  userDataResolver,
  userDataValidator,
  userExternalResolver,
  userPatchResolver,
  userPatchValidator,
  userQueryResolver,
  userQueryValidator,
  userResolver
} from './users.schema'

import type { Application } from '../../declarations'
import { UsersService, getOptions } from './users.class'
import { usersMethods, usersPath } from './users.shared'

export * from './users.class'
export * from './users.schema'

export const users = (app: Application) => {
  app.use(usersPath, new UsersService(getOptions(app)), {
    methods: usersMethods,
    events: []
  })

  app.service(usersPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(userExternalResolver),
        schemaHooks.resolveResult(userResolver)
      ]
    },
    before: {
      all: [schemaHooks.validateQuery(userQueryValidator), schemaHooks.resolveQuery(userQueryResolver)],
      find: [],
      get: [],
      create: [schemaHooks.validateData(userDataValidator), schemaHooks.resolveData(userDataResolver)],
      patch: [schemaHooks.validateData(userPatchValidator), schemaHooks.resolveData(userPatchResolver)],
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
    [usersPath]: UsersService
  }
}
