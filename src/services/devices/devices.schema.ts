// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { DevicesService } from './devices.class'

// Main data model schema
export const devicesSchema = {
  $id: 'Devices',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' }
  }
} as const
export type Devices = FromSchema<typeof devicesSchema>
export const devicesValidator = getValidator(devicesSchema, dataValidator)
export const devicesResolver = resolve<Devices, HookContext<DevicesService>>({})

export const devicesExternalResolver = resolve<Devices, HookContext<DevicesService>>({})

// Schema for creating new data
export const devicesDataSchema = {
  $id: 'DevicesData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesSchema.properties
  }
} as const
export type DevicesData = FromSchema<typeof devicesDataSchema>
export const devicesDataValidator = getValidator(devicesDataSchema, dataValidator)
export const devicesDataResolver = resolve<DevicesData, HookContext<DevicesService>>({})

// Schema for updating existing data
export const devicesPatchSchema = {
  $id: 'DevicesPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesSchema.properties
  }
} as const
export type DevicesPatch = FromSchema<typeof devicesPatchSchema>
export const devicesPatchValidator = getValidator(devicesPatchSchema, dataValidator)
export const devicesPatchResolver = resolve<DevicesPatch, HookContext<DevicesService>>({})

// Schema for allowed query properties
export const devicesQuerySchema = {
  $id: 'DevicesQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(devicesSchema.properties)
  }
} as const
export type DevicesQuery = FromSchema<typeof devicesQuerySchema>
export const devicesQueryValidator = getValidator(devicesQuerySchema, queryValidator)
export const devicesQueryResolver = resolve<DevicesQuery, HookContext<DevicesService>>({})
