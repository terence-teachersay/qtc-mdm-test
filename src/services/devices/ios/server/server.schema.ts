// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../declarations'
import { dataValidator, queryValidator } from '../../../../validators'
import type { DevicesIosServerService } from './server.class'

// Main data model schema
export const devicesIosServerSchema = {
  $id: 'DevicesIosServer',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' },
    udid: { type: 'string' }
  }
} as const
export type DevicesIosServer = FromSchema<typeof devicesIosServerSchema>
export const devicesIosServerValidator = getValidator(devicesIosServerSchema, dataValidator)
export const devicesIosServerResolver = resolve<DevicesIosServer, HookContext<DevicesIosServerService>>({})

export const devicesIosServerExternalResolver = resolve<
  DevicesIosServer,
  HookContext<DevicesIosServerService>
>({})

// Schema for creating new data
export const devicesIosServerDataSchema = {
  $id: 'DevicesIosServerData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesIosServerSchema.properties
  }
} as const
export type DevicesIosServerData = FromSchema<typeof devicesIosServerDataSchema>
export const devicesIosServerDataValidator = getValidator(devicesIosServerDataSchema, dataValidator)
export const devicesIosServerDataResolver = resolve<
  DevicesIosServerData,
  HookContext<DevicesIosServerService>
>({})

// Schema for updating existing data
export const devicesIosServerPatchSchema = {
  $id: 'DevicesIosServerPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesIosServerSchema.properties
  }
} as const
export type DevicesIosServerPatch = FromSchema<typeof devicesIosServerPatchSchema>
export const devicesIosServerPatchValidator = getValidator(devicesIosServerPatchSchema, dataValidator)
export const devicesIosServerPatchResolver = resolve<
  DevicesIosServerPatch,
  HookContext<DevicesIosServerService>
>({})

// Schema for allowed query properties
export const devicesIosServerQuerySchema = {
  $id: 'DevicesIosServerQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(devicesIosServerSchema.properties)
  }
} as const
export type DevicesIosServerQuery = FromSchema<typeof devicesIosServerQuerySchema>
export const devicesIosServerQueryValidator = getValidator(devicesIosServerQuerySchema, queryValidator)
export const devicesIosServerQueryResolver = resolve<
  DevicesIosServerQuery,
  HookContext<DevicesIosServerService>
>({})
