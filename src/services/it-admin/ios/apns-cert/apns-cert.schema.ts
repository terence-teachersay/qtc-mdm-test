import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../declarations'
import { dataValidator, queryValidator } from '../../../../validators'
import type { ItAdminIosApnsCertService } from './apns-cert.class'

// Result schema (placeholder — find/get/create return custom shapes)
export const itAdminIosApnsCertSchema = {
  $id: 'ItAdminIosApnsCert',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' }
  }
} as const
export type ItAdminIosApnsCert = FromSchema<typeof itAdminIosApnsCertSchema>
export const itAdminIosApnsCertValidator = getValidator(itAdminIosApnsCertSchema, dataValidator)
export const itAdminIosApnsCertResolver = resolve<
  ItAdminIosApnsCert,
  HookContext<ItAdminIosApnsCertService>
>({})
export const itAdminIosApnsCertExternalResolver = resolve<
  ItAdminIosApnsCert,
  HookContext<ItAdminIosApnsCertService>
>({})

// Data schema — certificate PEM string for POST (additionalProperties: true to pass through multipart fields)
export const itAdminIosApnsCertDataSchema = {
  $id: 'ItAdminIosApnsCertData',
  type: 'object',
  additionalProperties: true,
  required: [],
  properties: {
    certificate: { type: 'string' }
  }
} as const
export type ItAdminIosApnsCertData = FromSchema<typeof itAdminIosApnsCertDataSchema>
export const itAdminIosApnsCertDataValidator = getValidator(itAdminIosApnsCertDataSchema, dataValidator)
export const itAdminIosApnsCertDataResolver = resolve<
  ItAdminIosApnsCertData,
  HookContext<ItAdminIosApnsCertService>
>({})

// Patch schema (unused — method not allowed)
export const itAdminIosApnsCertPatchSchema = {
  $id: 'ItAdminIosApnsCertPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {}
} as const
export type ItAdminIosApnsCertPatch = FromSchema<typeof itAdminIosApnsCertPatchSchema>
export const itAdminIosApnsCertPatchValidator = getValidator(itAdminIosApnsCertPatchSchema, dataValidator)
export const itAdminIosApnsCertPatchResolver = resolve<
  ItAdminIosApnsCertPatch,
  HookContext<ItAdminIosApnsCertService>
>({})

// Query schema
export const itAdminIosApnsCertQuerySchema = {
  $id: 'ItAdminIosApnsCertQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(itAdminIosApnsCertSchema.properties),
    user_email: { type: 'string' },
    group_id: { type: 'number' }
  }
} as const
export type ItAdminIosApnsCertQuery = FromSchema<typeof itAdminIosApnsCertQuerySchema>
export const itAdminIosApnsCertQueryValidator = getValidator(itAdminIosApnsCertQuerySchema, queryValidator)
export const itAdminIosApnsCertQueryResolver = resolve<
  ItAdminIosApnsCertQuery,
  HookContext<ItAdminIosApnsCertService>
>({})
