// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert'
import { app } from '../../../src/app'

describe('devices\ios\enrollment\deviceEnrollment service', () => {
  it('registered the service', () => {
    const service = app.service('devices\ios\enrollment\deviceEnrollment')

    assert.ok(service, 'Registered the service')
  })
})
