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
import bodyParser from 'body-parser';
import bodyParserXml from 'body-parser-xml';
import multer from 'multer';
import setupKnex from './knex'
import { authentication } from './authentication'

// 1. Initialize the XML parser extension
bodyParserXml(bodyParser);

const apnsMultipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024
  }
});

const app: Application = express(feathers())

// In app.ts, replace the bodyParser.xml block, this will make the none json incoming payload works.
app.use(bodyParser.text({
  type: ['text/xml', 'application/xml', 'application/x-apple-aspen-mdm', 'application/x-apple-aspen-mdm-checkin'],
  limit: '1mb',
}));

// SCEP requests must keep their original binary payload,
// so the service can process the PKI message without JSON/text parsing.
app.use(
  '/devices/ios/scep',
  bodyParser.raw({
    type: ['application/x-pki-message', 'application/octet-stream'],
    limit: '1mb'
  }),
  (req, _res, next) => {
    req.feathers = req.feathers || {}
    req.feathers.rawBody = req.body
    next()
  }
)

// APNS certificate uploads can arrive as multipart/form-data, 
// so convert the uploaded file into req.body.certificate for the service.
app.use('/it-admin/ios/apns-cert', (req, res, next) => {
  const isCreate = req.method.toUpperCase() === 'POST';
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const isMultipart = contentType.includes('multipart/form-data');

  if (!isCreate || !isMultipart) {
    return next();
  }

  return apnsMultipartUpload.any()(req, res, err => {
    if (err) {
      return next(err);
    }

    const files = Array.isArray(req.files) ? req.files : [];
    if (!req.body) {
      req.body = {};
    }

    if (!req.body.certificate && files.length > 0) {
      req.body.certificate = files[0].buffer.toString('utf8');
    }

    return next();
  });
});

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
  const reqURL = req.originalUrl || req.url;
  const method = req.method.toUpperCase();
  if(reqURL.includes('/devices/ios/enrollment/device-enrollment') && method === 'GET') {
    const payload = Buffer.isBuffer(res.data)
      ? res.data
      : res.data && typeof res.data === 'object'
        ? Buffer.from(Object.values(res.data))
        : res.data;
    res.set('Content-Type', 'application/x-apple-aspen-config');
    res.send(payload);
  }
  else if(reqURL.includes('/devices/ios/server') && method === 'PUT') {
    res.set('Content-Type', 'application/x-apple-aspen-mdm');
    res.send(res.data?.xml || res.data);
  }else if(reqURL.includes('/devices/ios/scep')) {
    const payload = res.data?.body ?? res.data;
    const contentType = res.data?.contentType || 'application/octet-stream';
    res.set('Content-Type', contentType);
    res.set('statusCode', '200');
    res.send(payload);
  }else if(reqURL.includes('/it-admin/ios/apns-csr') && method === 'GET') {
    res.set('Content-Type', 'application/pkcs10');
    res.set('Content-Disposition', 'attachment; filename="customer_apple_upload.req"')
    res.send(res.data);
  }else if(reqURL.match(/\/it-admin\/ios\/apns-cert\/[^/]+/) && method === 'GET') {
    res.set('Content-Type', 'application/x-pem-file');
    res.set('Content-Disposition', 'attachment; filename="apns_push_cert.pem"');
    res.send(res.data);
  }else{
    res.json(res.data);
  }
}));

app.configure(
  socketio({
    cors: {
      origin: app.get('origins')
    }
  })
)
app.configure(services)
app.configure(authentication)
app.configure(channels)
app.configure(setupKnex)

// Configure a middleware for 404s and the error handler
app.use(notFound())
logger.level = app.get('environment') === 'dev' ? 'debug' : 'info'; //set logger level base on envirnment setting in config
app.use(errorHandler({ logger }))

app.get('knexClient')
  .raw('SELECT 1')
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch((err: unknown) => console.error('❌ DB connection failed:', err))

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
