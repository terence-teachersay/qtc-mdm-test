import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../../../../declarations'
import { dataValidator, queryValidator } from '../../../../../validators'
import type { ItAdminIosCommandsDeviceInformationService } from './device-information.class'

export const itAdminIosCommandsDeviceInformationSchema = {
  $id: 'ItAdminIosCommandsDeviceInformationNested',
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'number' }
  }
} as const
export type ItAdminIosCommandsDeviceInformation = FromSchema<typeof itAdminIosCommandsDeviceInformationSchema>
export const itAdminIosCommandsDeviceInformationValidator = getValidator(
  itAdminIosCommandsDeviceInformationSchema,
  dataValidator
)
export const itAdminIosCommandsDeviceInformationResolver = resolve<
  ItAdminIosCommandsDeviceInformation,
  HookContext<ItAdminIosCommandsDeviceInformationService>
>({})

export const itAdminIosCommandsDeviceInformationExternalResolver = resolve<
  ItAdminIosCommandsDeviceInformation,
  HookContext<ItAdminIosCommandsDeviceInformationService>
>({})

export const itAdminIosCommandsDeviceInformationDataSchema = {
  $id: 'ItAdminIosCommandsDeviceInformationDataNested',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...itAdminIosCommandsDeviceInformationSchema.properties,
    udid: { type: 'string' },
    udids: {
      type: 'array',
      items: { type: 'string' }
    }
  }
} as const
export type ItAdminIosCommandsDeviceInformationData = FromSchema<
  typeof itAdminIosCommandsDeviceInformationDataSchema
>
export const itAdminIosCommandsDeviceInformationDataValidator = getValidator(
  itAdminIosCommandsDeviceInformationDataSchema,
  dataValidator
)
export const itAdminIosCommandsDeviceInformationDataResolver = resolve<
  ItAdminIosCommandsDeviceInformationData,
  HookContext<ItAdminIosCommandsDeviceInformationService>
>({})

export const itAdminIosCommandsDeviceInformationPatchSchema = {
  $id: 'ItAdminIosCommandsDeviceInformationPatchNested',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...itAdminIosCommandsDeviceInformationSchema.properties
  }
} as const
export type ItAdminIosCommandsDeviceInformationPatch = FromSchema<
  typeof itAdminIosCommandsDeviceInformationPatchSchema
>
export const itAdminIosCommandsDeviceInformationPatchValidator = getValidator(
  itAdminIosCommandsDeviceInformationPatchSchema,
  dataValidator
)
export const itAdminIosCommandsDeviceInformationPatchResolver = resolve<
  ItAdminIosCommandsDeviceInformationPatch,
  HookContext<ItAdminIosCommandsDeviceInformationService>
>({})

export const itAdminIosCommandsDeviceInformationQuerySchema = {
  $id: 'ItAdminIosCommandsDeviceInformationQueryNested',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(itAdminIosCommandsDeviceInformationSchema.properties),
    user_email: { type: 'string' },
    group_id: { type: 'number' }
  }
} as const
export type ItAdminIosCommandsDeviceInformationQuery = FromSchema<
  typeof itAdminIosCommandsDeviceInformationQuerySchema
>
export const itAdminIosCommandsDeviceInformationQueryValidator = getValidator(
  itAdminIosCommandsDeviceInformationQuerySchema,
  queryValidator
)
export const itAdminIosCommandsDeviceInformationQueryResolver = resolve<
  ItAdminIosCommandsDeviceInformationQuery,
  HookContext<ItAdminIosCommandsDeviceInformationService>
>({})
