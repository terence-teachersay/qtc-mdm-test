// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../declarations'
import { dataValidator, queryValidator } from '../../../../validators'
import type { DevicesIosCheckinService } from './checkin.class'

// Main data model schema
export const devicesIosCheckinSchema = {
  $id: 'DevicesIosCheckin',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' }
  }
} as const
export type DevicesIosCheckin = FromSchema<typeof devicesIosCheckinSchema>
export const devicesIosCheckinValidator = getValidator(devicesIosCheckinSchema, dataValidator)
export const devicesIosCheckinResolver = resolve<DevicesIosCheckin, HookContext<DevicesIosCheckinService>>({})

export const devicesIosCheckinExternalResolver = resolve<
  DevicesIosCheckin,
  HookContext<DevicesIosCheckinService>
>({})

// Schema for creating new data
export const devicesIosCheckinDataSchema = {
  $id: 'DevicesIosCheckinData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesIosCheckinSchema.properties
  }
} as const
export type DevicesIosCheckinData = FromSchema<typeof devicesIosCheckinDataSchema>
export const devicesIosCheckinDataValidator = getValidator(devicesIosCheckinDataSchema, dataValidator)
export const devicesIosCheckinDataResolver = resolve<
  DevicesIosCheckinData,
  HookContext<DevicesIosCheckinService>
>({})

// Schema for updating existing data
export const devicesIosCheckinPatchSchema = {
  $id: 'DevicesIosCheckinPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesIosCheckinSchema.properties
  }
} as const
export type DevicesIosCheckinPatch = FromSchema<typeof devicesIosCheckinPatchSchema>
export const devicesIosCheckinPatchValidator = getValidator(devicesIosCheckinPatchSchema, dataValidator)
export const devicesIosCheckinPatchResolver = resolve<
  DevicesIosCheckinPatch,
  HookContext<DevicesIosCheckinService>
>({})

// Schema for allowed query properties
export const devicesIosCheckinQuerySchema = {
  $id: 'DevicesIosCheckinQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(devicesIosCheckinSchema.properties)
  }
} as const
export type DevicesIosCheckinQuery = FromSchema<typeof devicesIosCheckinQuerySchema>
export const devicesIosCheckinQueryValidator = getValidator(devicesIosCheckinQuerySchema, queryValidator)
export const devicesIosCheckinQueryResolver = resolve<
  DevicesIosCheckinQuery,
  HookContext<DevicesIosCheckinService>
>({})
