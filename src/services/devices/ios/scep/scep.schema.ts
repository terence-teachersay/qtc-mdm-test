// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../declarations'
import { dataValidator, queryValidator } from '../../../../validators'
import type { DevicesIosScepService } from './scep.class.ts'

// Main data model schema
export const devicesIosScepSchema = {
  $id: 'DevicesIosScep',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' }
  }
} as const
export type DevicesIosScep = FromSchema<typeof devicesIosScepSchema>
export const devicesIosScepValidator = getValidator(devicesIosScepSchema, dataValidator)
export const devicesIosScepResolver = resolve<DevicesIosScep, HookContext<DevicesIosScepService>>({})

export const devicesIosScepExternalResolver = resolve<DevicesIosScep, HookContext<DevicesIosScepService>>({})

// Schema for creating new data
export const devicesIosScepDataSchema = {
  $id: 'DevicesIosScepData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesIosScepSchema.properties
  }
} as const
export type DevicesIosScepData = FromSchema<typeof devicesIosScepDataSchema>
export const devicesIosScepDataValidator = getValidator(devicesIosScepDataSchema, dataValidator)
export const devicesIosScepDataResolver = resolve<DevicesIosScepData, HookContext<DevicesIosScepService>>({})

// Schema for updating existing data
export const devicesIosScepPatchSchema = {
  $id: 'DevicesIosScepPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesIosScepSchema.properties
  }
} as const
export type DevicesIosScepPatch = FromSchema<typeof devicesIosScepPatchSchema>
export const devicesIosScepPatchValidator = getValidator(devicesIosScepPatchSchema, dataValidator)
export const devicesIosScepPatchResolver = resolve<DevicesIosScepPatch, HookContext<DevicesIosScepService>>(
  {}
)

// Schema for allowed query properties
export const devicesIosScepQuerySchema = {
  $id: 'DevicesIosScepQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(devicesIosScepSchema.properties),
    operation: {
      type: 'string',
      enum: ['GetCACaps', 'GetCACert', 'PKIOperation']
    },
    message: {
      type: 'string'
    }
  }
} as const
export type DevicesIosScepQuery = FromSchema<typeof devicesIosScepQuerySchema>
export const devicesIosScepQueryValidator = getValidator(devicesIosScepQuerySchema, queryValidator)
export const devicesIosScepQueryResolver = resolve<DevicesIosScepQuery, HookContext<DevicesIosScepService>>(
  {}
)
