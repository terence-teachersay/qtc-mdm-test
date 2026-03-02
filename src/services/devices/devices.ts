// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  devicesDataValidator,
  devicesPatchValidator,
  devicesQueryValidator,
  devicesResolver,
  devicesExternalResolver,
  devicesDataResolver,
  devicesPatchResolver,
  devicesQueryResolver
} from './devices.schema'

import type { Application } from '../../declarations'
import { DevicesService, getOptions } from './devices.class'
import { devicesPath, devicesMethods } from './devices.shared'

export * from './devices.class'
export * from './devices.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const devices = (app: Application) => {
  // Register our service on the Feathers application
  app.use(devicesPath, new DevicesService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: devicesMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(devicesPath).hooks({
    around: {
      all: [schemaHooks.resolveExternal(devicesExternalResolver), schemaHooks.resolveResult(devicesResolver)]
    },
    before: {
      all: [schemaHooks.validateQuery(devicesQueryValidator), schemaHooks.resolveQuery(devicesQueryResolver)],
      find: [],
      get: [],
      create: [schemaHooks.validateData(devicesDataValidator), schemaHooks.resolveData(devicesDataResolver)],
      patch: [schemaHooks.validateData(devicesPatchValidator), schemaHooks.resolveData(devicesPatchResolver)],
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
declare module '../../declarations' {
  interface ServiceTypes {
    [devicesPath]: DevicesService
  }
}
