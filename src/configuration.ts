import { defaultAppSettings, getValidator } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import { dataValidator } from './validators'
import { Logger } from 'winston'

export const configurationSchema = {
  $id: 'configuration',
  type: 'object',
  additionalProperties: false,
  required: ['host', 'port', 'public', 'environment'],
  properties: {
    ...defaultAppSettings,
    host: { type: 'string' },
    port: { type: 'number' },
    environment: { type: 'string' },
    public: { type: 'string' },
    publicBaseUrl: { type: 'string' },
    authentication: {
      type: 'object',
      additionalProperties: true
    },
    activeDatabase: { type: 'string' },
    databases: {
      type: 'object',
      additionalProperties: true
    },
    postgres: {
      type: 'object',
      additionalProperties: true
    },
    aws: {
      type: 'object',
      additionalProperties: true
    }
  }
} as const

export const configurationValidator = getValidator(configurationSchema, dataValidator)

export type ApplicationConfiguration = FromSchema<typeof configurationSchema>
