// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html
import { feathers } from '@feathersjs/feathers'
import express, {
  rest,
  json,
  urlencoded,
  cors,
  serveStatic,
  notFound,
  errorHandler
} from '@feathersjs/express'
import configuration from '@feathersjs/configuration'
import socketio from '@feathersjs/socketio'

import type { Application } from './declarations'
import { configurationValidator } from './configuration'
import { logger } from './logger'
import { logError } from './hooks/log-error'
import { services } from './services/index'
import { channels } from './channels'
import path from 'path'

const app: Application = express(feathers())

// Load app configuration
app.configure(configuration(configurationValidator))
app.set('public', path.join(process.cwd(), 'public'))
app.use(cors())
app.use(json())
app.use(urlencoded({ extended: true }))
// Host the public folder
app.use('/', serveStatic(app.get('public')))

// Feather services set return content type to json by default, 
// override this for the enrollment service to return the correct content type for the configuration profile.
// x-apple-aspen-config is used for iOS configuration profiles, which is what we are using for device enrollment.
app.configure(rest((req, res) => {
  res.format({
    'application/x-apple-aspen-config': () => {
      res.set('Content-Type', 'application/x-apple-aspen-config');
      res.send(res.data);
    },
    default: () => {
      res.json(res.data);
    }
  });
}));
app.configure(
  socketio({
    cors: {
      origin: app.get('origins')
    }
  })
)
app.configure(services)
app.configure(channels)

// Configure a middleware for 404s and the error handler
app.use(notFound())
app.use(errorHandler({ logger }))

// Register hooks that run on all service methods
app.hooks({
  around: {
    all: [logError]
  },
  before: {},
  after: {},
  error: {}
})
// Register application setup and teardown hooks here
app.hooks({
  setup: [],
  teardown: []
})

export { app }
