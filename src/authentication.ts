import type { AuthenticationRequest } from '@feathersjs/authentication'
import type { Params } from '@feathersjs/feathers'
import {
  AuthenticationService,
  JWTStrategy
} from '@feathersjs/authentication'
import { LocalStrategy } from '@feathersjs/authentication-local'

import type { Application } from './declarations'
import { logger } from './logger'

class EmailPasswordStrategy extends LocalStrategy {
  /** Limit local authentication to active user records only. */
  async getEntityQuery(query: any, _params: Params): Promise<{ $limit: number; active: boolean }> {
    const baseQuery = await super.getEntityQuery(query, _params)

    return {
      ...baseQuery,
      active: true
    }
  }

  private get knexClient() {
    return (this.authentication!.app as Application).get('knexClient')
  }

  /** Safely read a named field from the incoming authentication payload. */
  private getFieldValue(data: AuthenticationRequest, fieldName: string): unknown {
    return (data as Record<string, unknown> | undefined)?.[fieldName]
  }

  /** Normalize the login username/email so authentication checks are case-insensitive. */
  private normalizeUsername(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim().toLowerCase()
    return normalized.length > 0 ? normalized : null
  }

  /** Increment the failed login counter for the matching user email when authentication fails. */
  private async incrementFailedLogin(username: string | null): Promise<void> {
    if (!username) {
      return
    }

    await this.knexClient('users')
      .where('email', username)
      .increment('cumulative_failed_login_count', 1)
  }

  /** Update last-seen metadata and clear failed-login counts after a successful login. */
  private async markSuccessfulLogin(entity: any, username: string | null): Promise<void> {
    const { entityId = 'id' } = this.configuration
    const userId = entity?.[entityId]
    const query = this.knexClient('users')

    if (userId !== undefined && userId !== null) {
      query.where('id', userId)
    } else if (username) {
      query.where('email', username)
    } else {
      return
    }

    await query.update({
      last_seen_on: this.knexClient.fn.now(),
      cumulative_failed_login_count: 0
    })
  }

  /** Run the normal local authentication flow and attach success/failure bookkeeping in the users table.
   * Override the default `authenticate` method to add custom logic for tracking successful and failed login attempts.
   */
  async authenticate(data: AuthenticationRequest, params: Params) {
    const { usernameField } = this.configuration
    const username = this.normalizeUsername(this.getFieldValue(data, usernameField))

    try {
      const result = await super.authenticate(data, params)
      const entityName = this.configuration.entity
      const entity = result[entityName]
      const { entityId = 'id' } = this.configuration

      await this.markSuccessfulLogin(entity, username)

      logger.info('[Auth] Login succeeded', {
        userId: entity?.[entityId] ?? null,
        email: typeof entity?.email === 'string' ? entity.email : username
      })

      return result
    } catch (error) {
      await this.incrementFailedLogin(username)

      logger.warn('[Auth] Login failed', {
        email: username
      })

      throw error
    }
  }
}

/** Configure and register the Feathers authentication service with JWT and local login strategies. */
export const authentication = (app: Application) => {
  const authService = new AuthenticationService(app)

  authService.register('jwt', new JWTStrategy())
  authService.register('local', new EmailPasswordStrategy())

  app.use('authentication', authService)
}

declare module './declarations' {
  interface ServiceTypes {
    authentication: AuthenticationService
  }
}
