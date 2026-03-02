import { defaultAppSettings, getValidator } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import { dataValidator } from './validators'

export const configurationSchema = {
  $id: 'configuration',
  type: 'object',
  additionalProperties: false,
  required: ['host', 'port', 'public'],
  properties: {
    ...defaultAppSettings,
    host: { type: 'string' },
    port: { type: 'number' },
    public: { type: 'string' },
    publicBaseUrl: { type: 'string' },
    mdm: {
      type: 'object',
      required: ['serverPath', 'checkInPath'],
      properties: {
        serverPath: { type: 'string' },
        checkInPath: { type: 'string' }
      }
    }
  }
} as const

export const configurationValidator = getValidator(configurationSchema, dataValidator)

export type ApplicationConfiguration = FromSchema<typeof configurationSchema>
