import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../declarations'
import { dataValidator, queryValidator } from '../../../../validators'
import type { ItAdminIosApnsCsrService } from './apns-csr.class'

export const itAdminIosApnsCsrSchema = {
  $id: 'ItAdminIosApnsCsr',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' }
  }
} as const
export type ItAdminIosApnsCsr = FromSchema<typeof itAdminIosApnsCsrSchema>
export const itAdminIosApnsCsrValidator = getValidator(itAdminIosApnsCsrSchema, dataValidator)
export const itAdminIosApnsCsrResolver = resolve<
  ItAdminIosApnsCsr,
  HookContext<ItAdminIosApnsCsrService>
>({})

export const itAdminIosApnsCsrExternalResolver = resolve<
  ItAdminIosApnsCsr,
  HookContext<ItAdminIosApnsCsrService>
>({})

export const itAdminIosApnsCsrDataSchema = {
  $id: 'ItAdminIosApnsCsrData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...itAdminIosApnsCsrSchema.properties
  }
} as const
export type ItAdminIosApnsCsrData = FromSchema<typeof itAdminIosApnsCsrDataSchema>
export const itAdminIosApnsCsrDataValidator = getValidator(
  itAdminIosApnsCsrDataSchema,
  dataValidator
)
export const itAdminIosApnsCsrDataResolver = resolve<
  ItAdminIosApnsCsrData,
  HookContext<ItAdminIosApnsCsrService>
>({})

export const itAdminIosApnsCsrPatchSchema = {
  $id: 'ItAdminIosApnsCsrPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...itAdminIosApnsCsrSchema.properties
  }
} as const
export type ItAdminIosApnsCsrPatch = FromSchema<typeof itAdminIosApnsCsrPatchSchema>
export const itAdminIosApnsCsrPatchValidator = getValidator(
  itAdminIosApnsCsrPatchSchema,
  dataValidator
)
export const itAdminIosApnsCsrPatchResolver = resolve<
  ItAdminIosApnsCsrPatch,
  HookContext<ItAdminIosApnsCsrService>
>({})

export const itAdminIosApnsCsrQuerySchema = {
  $id: 'ItAdminIosApnsCsrQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(itAdminIosApnsCsrSchema.properties),
    user_email: { type: 'string' },
    group_id: { type: 'number' }
  }
} as const
export type ItAdminIosApnsCsrQuery = FromSchema<typeof itAdminIosApnsCsrQuerySchema>
export const itAdminIosApnsCsrQueryValidator = getValidator(
  itAdminIosApnsCsrQuerySchema,
  queryValidator
)
export const itAdminIosApnsCsrQueryResolver = resolve<
  ItAdminIosApnsCsrQuery,
  HookContext<ItAdminIosApnsCsrService>
>({})
