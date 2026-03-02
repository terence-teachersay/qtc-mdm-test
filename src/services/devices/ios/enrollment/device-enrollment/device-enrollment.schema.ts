// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../../declarations'
import { dataValidator, queryValidator } from '../../../../../validators'
import type { DevicesIosEnrollmentDeviceEnrollmentService } from './device-enrollment.class'

// Main data model schema
export const devicesIosEnrollmentDeviceEnrollmentSchema = {
  $id: 'DevicesIosEnrollmentDeviceEnrollment',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' },
  }
} as const
export type DevicesIosEnrollmentDeviceEnrollment = FromSchema<
  typeof devicesIosEnrollmentDeviceEnrollmentSchema
>
export const devicesIosEnrollmentDeviceEnrollmentValidator = getValidator(
  devicesIosEnrollmentDeviceEnrollmentSchema,
  dataValidator
)
export const devicesIosEnrollmentDeviceEnrollmentResolver = resolve<
  DevicesIosEnrollmentDeviceEnrollment,
  HookContext<DevicesIosEnrollmentDeviceEnrollmentService>
>({})

export const devicesIosEnrollmentDeviceEnrollmentExternalResolver = resolve<
  DevicesIosEnrollmentDeviceEnrollment,
  HookContext<DevicesIosEnrollmentDeviceEnrollmentService>
>({})

// Schema for creating new data
export const devicesIosEnrollmentDeviceEnrollmentDataSchema = {
  $id: 'DevicesIosEnrollmentDeviceEnrollmentData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesIosEnrollmentDeviceEnrollmentSchema.properties
  }
} as const
export type DevicesIosEnrollmentDeviceEnrollmentData = FromSchema<
  typeof devicesIosEnrollmentDeviceEnrollmentDataSchema
>
export const devicesIosEnrollmentDeviceEnrollmentDataValidator = getValidator(
  devicesIosEnrollmentDeviceEnrollmentDataSchema,
  dataValidator
)
export const devicesIosEnrollmentDeviceEnrollmentDataResolver = resolve<
  DevicesIosEnrollmentDeviceEnrollmentData,
  HookContext<DevicesIosEnrollmentDeviceEnrollmentService>
>({})

// Schema for updating existing data
export const devicesIosEnrollmentDeviceEnrollmentPatchSchema = {
  $id: 'DevicesIosEnrollmentDeviceEnrollmentPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...devicesIosEnrollmentDeviceEnrollmentSchema.properties
  }
} as const
export type DevicesIosEnrollmentDeviceEnrollmentPatch = FromSchema<
  typeof devicesIosEnrollmentDeviceEnrollmentPatchSchema
>
export const devicesIosEnrollmentDeviceEnrollmentPatchValidator = getValidator(
  devicesIosEnrollmentDeviceEnrollmentPatchSchema,
  dataValidator
)
export const devicesIosEnrollmentDeviceEnrollmentPatchResolver = resolve<
  DevicesIosEnrollmentDeviceEnrollmentPatch,
  HookContext<DevicesIosEnrollmentDeviceEnrollmentService>
>({})

// Schema for allowed query properties
export const devicesIosEnrollmentDeviceEnrollmentQuerySchema = {
  $id: 'DevicesIosEnrollmentDeviceEnrollmentQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(devicesIosEnrollmentDeviceEnrollmentSchema.properties)
  }
} as const
export type DevicesIosEnrollmentDeviceEnrollmentQuery = FromSchema<
  typeof devicesIosEnrollmentDeviceEnrollmentQuerySchema
>
export const devicesIosEnrollmentDeviceEnrollmentQueryValidator = getValidator(
  devicesIosEnrollmentDeviceEnrollmentQuerySchema,
  queryValidator
)
export const devicesIosEnrollmentDeviceEnrollmentQueryResolver = resolve<
  DevicesIosEnrollmentDeviceEnrollmentQuery,
  HookContext<DevicesIosEnrollmentDeviceEnrollmentService>
>({})
