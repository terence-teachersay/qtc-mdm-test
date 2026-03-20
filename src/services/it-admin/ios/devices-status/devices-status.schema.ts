import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../declarations'
import { dataValidator, queryValidator } from '../../../../validators'
import type { ItAdminIosDevicesStatusService } from './devices-status.class'

export const itAdminIosDevicesStatusSchema = {
  $id: 'ItAdminIosDevicesStatus',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' }
  }
} as const
export type ItAdminIosDevicesStatus = FromSchema<typeof itAdminIosDevicesStatusSchema>
export const itAdminIosDevicesStatusValidator = getValidator(itAdminIosDevicesStatusSchema, dataValidator)
export const itAdminIosDevicesStatusResolver = resolve<
  ItAdminIosDevicesStatus,
  HookContext<ItAdminIosDevicesStatusService>
>({})

export const itAdminIosDevicesStatusExternalResolver = resolve<
  ItAdminIosDevicesStatus,
  HookContext<ItAdminIosDevicesStatusService>
>({})

export const itAdminIosDevicesStatusDataSchema = {
  $id: 'ItAdminIosDevicesStatusData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...itAdminIosDevicesStatusSchema.properties
  }
} as const
export type ItAdminIosDevicesStatusData = FromSchema<typeof itAdminIosDevicesStatusDataSchema>
export const itAdminIosDevicesStatusDataValidator = getValidator(
  itAdminIosDevicesStatusDataSchema,
  dataValidator
)
export const itAdminIosDevicesStatusDataResolver = resolve<
  ItAdminIosDevicesStatusData,
  HookContext<ItAdminIosDevicesStatusService>
>({})

export const itAdminIosDevicesStatusPatchSchema = {
  $id: 'ItAdminIosDevicesStatusPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...itAdminIosDevicesStatusSchema.properties
  }
} as const
export type ItAdminIosDevicesStatusPatch = FromSchema<typeof itAdminIosDevicesStatusPatchSchema>
export const itAdminIosDevicesStatusPatchValidator = getValidator(
  itAdminIosDevicesStatusPatchSchema,
  dataValidator
)
export const itAdminIosDevicesStatusPatchResolver = resolve<
  ItAdminIosDevicesStatusPatch,
  HookContext<ItAdminIosDevicesStatusService>
>({})

export const itAdminIosDevicesStatusQuerySchema = {
  $id: 'ItAdminIosDevicesStatusQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(itAdminIosDevicesStatusSchema.properties),
    user_email: { type: 'string' },
    group_id: { type: 'number' }
  }
} as const
export type ItAdminIosDevicesStatusQuery = FromSchema<typeof itAdminIosDevicesStatusQuerySchema>
export const itAdminIosDevicesStatusQueryValidator = getValidator(
  itAdminIosDevicesStatusQuerySchema,
  queryValidator
)
export const itAdminIosDevicesStatusQueryResolver = resolve<
  ItAdminIosDevicesStatusQuery,
  HookContext<ItAdminIosDevicesStatusService>
>({})
