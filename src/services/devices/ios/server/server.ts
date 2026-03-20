// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  devicesIosServerDataValidator,
  devicesIosServerPatchValidator,
  devicesIosServerQueryValidator,
  devicesIosServerResolver,
  devicesIosServerExternalResolver,
  devicesIosServerDataResolver,
  devicesIosServerPatchResolver,
  devicesIosServerQueryResolver
} from './server.schema'

import type { Application } from '../../../../declarations'
import { DevicesIosServerService, getOptions } from './server.class'
import { devicesIosServerPath, devicesIosServerMethods } from './server.shared'

export * from './server.class'
export * from './server.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const devicesIosServer = (app: Application) => {
  // Register our service on the Feathers application
  app.use(devicesIosServerPath, new DevicesIosServerService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: devicesIosServerMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(devicesIosServerPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(devicesIosServerExternalResolver),
        schemaHooks.resolveResult(devicesIosServerResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(devicesIosServerQueryValidator),
        schemaHooks.resolveQuery(devicesIosServerQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(devicesIosServerDataValidator),
        schemaHooks.resolveData(devicesIosServerDataResolver)
      ],
      patch: [
        schemaHooks.validateData(devicesIosServerPatchValidator),
        schemaHooks.resolveData(devicesIosServerPatchResolver)
      ],
      remove: []
    },
    after: {
      all: []//,
      // update: [
      //   async (context) => {
      //     // Only process if we have an XML command to send
      //     // Assuming your service returns: return { xml: '<?xml...' }
      //     const result = context.result as any;
          
      //     if (result && result.xml) {
      //       const xmlString = result.xml;

      //       // 1. Set dispatch to Buffer to prevent JSON wrapping
      //       ;(context as any).dispatch = Buffer.from(xmlString, 'utf8');

      //       // 2. Set HTTP response details
      //       context.http = context.http ?? {}
      //       context.http.status = 200
      //       context.http.headers = {
      //         ...(context.http.headers ?? {}),
      //         'Content-Type': 'application/x-apple-aspen-mdm',
      //         'Cache-Control': 'no-store'
      //       }
      //     }

      //     return context;
      //   }
      // ]
    },
    error: {
      all: []
    }
  })
}

// Add this service to the service type index
declare module '../../../../declarations' {
  interface ServiceTypes {
    [devicesIosServerPath]: DevicesIosServerService
  }
}
