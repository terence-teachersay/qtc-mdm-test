import { getValidator, querySyntax, resolve } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { UsersService } from './users.class'

export const userSchema = {
  $id: 'User',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'email', 'password', 'active'],
  properties: {
    id: { type: 'number' },
    email: { type: 'string', format: 'email' },
    password: { type: 'string' },
    active: { type: 'boolean' }
  }
} as const
export type User = FromSchema<typeof userSchema>
export const userValidator = getValidator(userSchema, dataValidator)
export const userResolver = resolve<User, HookContext<UsersService>>({})

export const userExternalResolver = resolve<User, HookContext<UsersService>>({
  password: async (_value, _user, context) => {
    if (context.params.provider) {
      return undefined
    }

    return _value
  }
})

export const userDataSchema = {
  $id: 'UserData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' },
    active: { type: 'boolean' }
  }
} as const
export type UserData = FromSchema<typeof userDataSchema>
export const userDataValidator = getValidator(userDataSchema, dataValidator)
export const userDataResolver = resolve<UserData, HookContext<UsersService>>({})

export const userPatchSchema = {
  $id: 'UserPatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' },
    active: { type: 'boolean' }
  }
} as const
export type UserPatch = FromSchema<typeof userPatchSchema>
export const userPatchValidator = getValidator(userPatchSchema, dataValidator)
export const userPatchResolver = resolve<UserPatch, HookContext<UsersService>>({})

export const userQuerySchema = {
  $id: 'UserQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax({
      id: { type: 'number' },
      email: { type: 'string', format: 'email' },
      active: { type: 'boolean' }
    }),
    email: { type: 'string', format: 'email' },
    active: { type: 'boolean' }
  }
} as const
export type UsersQuery = FromSchema<typeof userQuerySchema>
export const userQueryValidator = getValidator(userQuerySchema, queryValidator)
export const userQueryResolver = resolve<UsersQuery, HookContext<UsersService>>({})