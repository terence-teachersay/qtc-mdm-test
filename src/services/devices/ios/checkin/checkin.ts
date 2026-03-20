// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  devicesIosCheckinDataValidator,
  devicesIosCheckinPatchValidator,
  devicesIosCheckinQueryValidator,
  devicesIosCheckinResolver,
  devicesIosCheckinExternalResolver,
  devicesIosCheckinDataResolver,
  devicesIosCheckinPatchResolver,
  devicesIosCheckinQueryResolver
} from './checkin.schema'

import type { Application } from '../../../../declarations'
import { DevicesIosCheckinService, getOptions } from './checkin.class'
import { devicesIosCheckinPath, devicesIosCheckinMethods } from './checkin.shared'
import express from 'express'

export * from './checkin.class'
export * from './checkin.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const devicesIosCheckin = (app: Application) => {
  // ✅ RAW middleware FIRST
  // This is required to get the raw body for the checkin service, 
  // which is needed to process the configuration profile sent by Apple devices during enrollment.
  app.use(
    devicesIosCheckinPath,
    express.raw({ type: '*/*', limit: '10mb' }),
    (req: any, _res: any, next: any) => {
      req.feathers = req.feathers || {}
      req.feathers.rawBody = req.body
      next()
    }
  )
  // Register our service on the Feathers application
  app.use(devicesIosCheckinPath, new DevicesIosCheckinService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: devicesIosCheckinMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(devicesIosCheckinPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(devicesIosCheckinExternalResolver),
        schemaHooks.resolveResult(devicesIosCheckinResolver)
      ]
    },
    before: {
      all: [
        schemaHooks.validateQuery(devicesIosCheckinQueryValidator),
        schemaHooks.resolveQuery(devicesIosCheckinQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(devicesIosCheckinDataValidator),
        schemaHooks.resolveData(devicesIosCheckinDataResolver)
      ],
      patch: [
        schemaHooks.validateData(devicesIosCheckinPatchValidator),
        schemaHooks.resolveData(devicesIosCheckinPatchResolver)
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
declare module '../../../../declarations' {
  interface ServiceTypes {
    [devicesIosCheckinPath]: DevicesIosCheckinService
  }
}
