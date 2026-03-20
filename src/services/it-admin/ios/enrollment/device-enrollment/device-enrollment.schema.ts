// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../../declarations'
import { dataValidator, queryValidator } from '../../../../../validators'
import type { ItAdminIosEnrollmentDeviceEnrollmentService } from './device-enrollment.class'

// Main data model schema
export const itAdminIosEnrollmentDeviceEnrollmentSchema = {
  $id: 'ItAdminIosEnrollmentDeviceEnrollment',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'text'],
  properties: {
    id: { type: 'number' },

    text: { type: 'string' }
  }
} as const
export type ItAdminIosEnrollmentDeviceEnrollment = FromSchema<
  typeof itAdminIosEnrollmentDeviceEnrollmentSchema
>
export const itAdminIosEnrollmentDeviceEnrollmentValidator = getValidator(
  itAdminIosEnrollmentDeviceEnrollmentSchema,
  dataValidator
)
export const itAdminIosEnrollmentDeviceEnrollmentResolver = resolve<
  ItAdminIosEnrollmentDeviceEnrollment,
  HookContext<ItAdminIosEnrollmentDeviceEnrollmentService>
>({})

export const itAdminIosEnrollmentDeviceEnrollmentExternalResolver = resolve<
  ItAdminIosEnrollmentDeviceEnrollment,
  HookContext<ItAdminIosEnrollmentDeviceEnrollmentService>
>({})

// Schema for creating new data
export const itAdminIosEnrollmentDeviceEnrollmentDataSchema = {
  $id: 'ItAdminIosEnrollmentDeviceEnrollmentData',
  type: 'object',
  additionalProperties: false,
  required: ['text'],
  properties: {
    ...itAdminIosEnrollmentDeviceEnrollmentSchema.properties
  }
} as const
export type ItAdminIosEnrollmentDeviceEnrollmentData = FromSchema<
  typeof itAdminIosEnrollmentDeviceEnrollmentDataSchema
>
export const itAdminIosEnrollmentDeviceEnrollmentDataValidator = getValidator(
  itAdminIosEnrollmentDeviceEnrollmentDataSchema,
  dataValidator
)
export const itAdminIosEnrollmentDeviceEnrollmentDataResolver = resolve<
  ItAdminIosEnrollmentDeviceEnrollmentData,
  HookContext<ItAdminIosEnrollmentDeviceEnrollmentService>
>({})

// Schema for updating existing data
export const itAdminIosEnrollmentDeviceEnrollmentPatchSchema = {
  $id: 'ItAdminIosEnrollmentDeviceEnrollmentPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...itAdminIosEnrollmentDeviceEnrollmentSchema.properties
  }
} as const
export type ItAdminIosEnrollmentDeviceEnrollmentPatch = FromSchema<
  typeof itAdminIosEnrollmentDeviceEnrollmentPatchSchema
>
export const itAdminIosEnrollmentDeviceEnrollmentPatchValidator = getValidator(
  itAdminIosEnrollmentDeviceEnrollmentPatchSchema,
  dataValidator
)
export const itAdminIosEnrollmentDeviceEnrollmentPatchResolver = resolve<
  ItAdminIosEnrollmentDeviceEnrollmentPatch,
  HookContext<ItAdminIosEnrollmentDeviceEnrollmentService>
>({})

// Schema for allowed query properties
export const itAdminIosEnrollmentDeviceEnrollmentQuerySchema = {
  $id: 'ItAdminIosEnrollmentDeviceEnrollmentQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(itAdminIosEnrollmentDeviceEnrollmentSchema.properties),
    group_id: { type: 'number' }
  }
} as const
export type ItAdminIosEnrollmentDeviceEnrollmentQuery = FromSchema<
  typeof itAdminIosEnrollmentDeviceEnrollmentQuerySchema
>
export const itAdminIosEnrollmentDeviceEnrollmentQueryValidator = getValidator(
  itAdminIosEnrollmentDeviceEnrollmentQuerySchema,
  queryValidator
)
export const itAdminIosEnrollmentDeviceEnrollmentQueryResolver = resolve<
  ItAdminIosEnrollmentDeviceEnrollmentQuery,
  HookContext<ItAdminIosEnrollmentDeviceEnrollmentService>
>({})
