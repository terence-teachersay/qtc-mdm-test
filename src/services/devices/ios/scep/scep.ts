// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'
import express from 'express'

import {
  devicesIosScepQueryValidator,
  devicesIosScepResolver,
  devicesIosScepExternalResolver,
  devicesIosScepQueryResolver
} from './scep.schema'

import type { Application } from '../../../../declarations'
import { DevicesIosScepService, getOptions } from './scep.class'
import { devicesIosScepPath, devicesIosScepMethods } from './scep.shared'

export * from './scep.class'
export * from './scep.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const devicesIosScep = (app: Application) => {
  // Register our service on the Feathers application
  app.use(devicesIosScepPath, new DevicesIosScepService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: devicesIosScepMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(devicesIosScepPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(devicesIosScepExternalResolver),
        schemaHooks.resolveResult(devicesIosScepResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(devicesIosScepQueryValidator),
        schemaHooks.resolveQuery(devicesIosScepQueryResolver)
      ],
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
declare module '../../../../declarations' {
  interface ServiceTypes {
    [devicesIosScepPath]: DevicesIosScepService
  }
}
