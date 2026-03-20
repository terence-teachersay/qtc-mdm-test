// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import type { Knex } from 'knex'
import crypto from 'crypto'

import type { Application } from '../../../../../declarations'
import type {
  ItAdminIosEnrollmentDeviceEnrollment,
  ItAdminIosEnrollmentDeviceEnrollmentData,
  ItAdminIosEnrollmentDeviceEnrollmentPatch,
  ItAdminIosEnrollmentDeviceEnrollmentQuery
} from './device-enrollment.schema'
import { itAdminIosEnrollmentDeviceEnrollmentPath } from './device-enrollment.shared'
import { MethodNotAllowed, BadRequest } from '@feathersjs/errors'
import { logger } from '../../../../../logger'
import {
  ENROLLMENT_TOKEN_TABLE,
  assertEnrollmentTokenTableExists,
  hashEnrollmentToken
} from '../../../../devices/ios/enrollment/enrollment-token'

export type {
  ItAdminIosEnrollmentDeviceEnrollment,
  ItAdminIosEnrollmentDeviceEnrollmentData,
  ItAdminIosEnrollmentDeviceEnrollmentPatch,
  ItAdminIosEnrollmentDeviceEnrollmentQuery
}

export interface ItAdminIosEnrollmentDeviceEnrollmentServiceOptions {
  app: Application
}

export interface ItAdminIosEnrollmentDeviceEnrollmentParams extends Params<ItAdminIosEnrollmentDeviceEnrollmentQuery> {
  user?: {
    id?: number | string
    email?: string
  }
  group_id?: number
  authorizedGroupIds?: number[]
  authorizedRole?: string
}

export interface EnrollmentSessionResult {
  enrollmentToken: string
  enrollmentUrl: string
  expiresAt: string
}

export class ItAdminIosEnrollmentDeviceEnrollmentService<
  ServiceParams extends ItAdminIosEnrollmentDeviceEnrollmentParams =
    ItAdminIosEnrollmentDeviceEnrollmentParams
> implements ServiceInterface<
  ItAdminIosEnrollmentDeviceEnrollment | EnrollmentSessionResult,
  ItAdminIosEnrollmentDeviceEnrollmentData,
  ServiceParams,
  ItAdminIosEnrollmentDeviceEnrollmentPatch
> {
  constructor(public options: ItAdminIosEnrollmentDeviceEnrollmentServiceOptions) {}

  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  async find(_params?: ServiceParams): Promise<ItAdminIosEnrollmentDeviceEnrollment[]> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Issue a short-lived enrollment URL that a device can redeem without admin auth. */
  async get(id: Id, _params?: ServiceParams): Promise<EnrollmentSessionResult> {
    const userId = Number(_params?.user?.id)
    const userEmail = _params?.user?.email as string | undefined
    const groupId = Number(_params?.group_id)

    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new BadRequest('Authorized group_id is required to create an enrollment session.')
    }

    logger.info('[Endpoint START]', {
      endpoint: `${itAdminIosEnrollmentDeviceEnrollmentPath} GET`,
      id,
      query: _params?.query || null,
      input: {
        userId: Number.isFinite(userId) ? userId : null,
        userEmail,
        groupId
      }
    })

    const result = await this.issueEnrollmentSession(groupId)

    logger.info('[Endpoint END]', {
      endpoint: `${itAdminIosEnrollmentDeviceEnrollmentPath} GET`,
      id,
      result: {
        userId: Number.isFinite(userId) ? userId : null,
        userEmail,
        groupId,
        enrollmentUrl: result.enrollmentUrl,
        expiresAt: result.expiresAt
      }
    })

    return result
  }

  /** Create a short-lived tokenized enrollment URL for device onboarding. */
  async issueEnrollmentSession(groupId: number): Promise<EnrollmentSessionResult> {
    await assertEnrollmentTokenTableExists(this.knexClient)

    const enrollmentToken = crypto.randomBytes(24).toString('base64url')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const tokenHash = hashEnrollmentToken(enrollmentToken)
    const baseUrl = this.options.app.get('publicBaseUrl') as string
    const enrollmentUrl = `${baseUrl}/devices/ios/enrollment/device-enrollment/${encodeURIComponent(enrollmentToken)}`

    await this.knexClient(ENROLLMENT_TOKEN_TABLE).insert({
      token_hash: tokenHash,
      group_id: groupId,
      expires_at: expiresAt,
      consumed_at: null,
      consumed_udid: null,
      created_at: this.knexClient.fn.now(),
      updated_at: this.knexClient.fn.now()
    })

    return {
      enrollmentToken,
      enrollmentUrl,
      expiresAt: expiresAt.toISOString()
    }
  }

  async create(_data: ItAdminIosEnrollmentDeviceEnrollmentData, _params?: ServiceParams): Promise<ItAdminIosEnrollmentDeviceEnrollment> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async update(
    _id: NullableId,
    _data: ItAdminIosEnrollmentDeviceEnrollmentData,
    _params?: ServiceParams
  ): Promise<ItAdminIosEnrollmentDeviceEnrollment> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async patch(
    _id: NullableId,
    _data: ItAdminIosEnrollmentDeviceEnrollmentPatch,
    _params?: ServiceParams
  ): Promise<ItAdminIosEnrollmentDeviceEnrollment> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async remove(_id: NullableId, _params?: ServiceParams): Promise<ItAdminIosEnrollmentDeviceEnrollment> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

export const getOptions = (app: Application) => {
  return { app }
}
