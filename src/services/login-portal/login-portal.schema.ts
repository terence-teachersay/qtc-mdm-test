import { getValidator, querySyntax, resolve } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { LoginPortalService } from './login-portal.class'

export const loginPortalSchema = {
  $id: 'LoginPortal',
  type: 'object',
  additionalProperties: false,
  required: ['roleType', 'groupType', 'groupId', 'label'],
  properties: {
    roleType: { type: 'string' },
    groupType: { type: 'string' },
    groupId: { type: 'number' },
    groupName: { type: ['string', 'null'] },
    label: { type: 'string' }
  }
} as const
export type LoginPortal = FromSchema<typeof loginPortalSchema>
export const loginPortalValidator = getValidator(loginPortalSchema, dataValidator)
export const loginPortalResolver = resolve<LoginPortal, HookContext<LoginPortalService>>({})

export const loginPortalExternalResolver = resolve<LoginPortal, HookContext<LoginPortalService>>({})

export const loginPortalDataSchema = {
  $id: 'LoginPortalData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {}
} as const
export type LoginPortalData = FromSchema<typeof loginPortalDataSchema>
export const loginPortalDataValidator = getValidator(loginPortalDataSchema, dataValidator)
export const loginPortalDataResolver = resolve<LoginPortalData, HookContext<LoginPortalService>>({})

export const loginPortalPatchSchema = {
  $id: 'LoginPortalPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {}
} as const
export type LoginPortalPatch = FromSchema<typeof loginPortalPatchSchema>
export const loginPortalPatchValidator = getValidator(loginPortalPatchSchema, dataValidator)
export const loginPortalPatchResolver = resolve<LoginPortalPatch, HookContext<LoginPortalService>>({})

export const loginPortalQuerySchema = {
  $id: 'LoginPortalQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax({})
  }
} as const
export type LoginPortalQuery = FromSchema<typeof loginPortalQuerySchema>
export const loginPortalQueryValidator = getValidator(loginPortalQuerySchema, queryValidator)
export const loginPortalQueryResolver = resolve<LoginPortalQuery, HookContext<LoginPortalService>>({})