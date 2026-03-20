import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import { MethodNotAllowed, NotFound } from '@feathersjs/errors'

import type { Application } from '../../declarations'
import type { User, UserData, UserPatch, UsersQuery } from './users.schema'

export type { User, UserData, UserPatch, UsersQuery }

interface UserRecord {
  id: number
  email: string
  password_hash: string
  active: boolean
}

export interface UsersServiceOptions {
  app: Application
}

export interface UsersParams extends Params<UsersQuery> {}

export class UsersService<
  ServiceParams extends UsersParams = UsersParams
> implements ServiceInterface<User, UserData, ServiceParams, UserPatch> {
  public readonly id = 'id'

  constructor(public options: UsersServiceOptions) {}

  /** Convert a database user row into the service response shape. */
  private mapRow(row: UserRecord): User {
    return {
      id: row.id,
      email: row.email,
      password: row.password_hash,
      active: row.active
    }
  }

  /** List users with optional filters; 
   *  Feathers local authentication uses this during login to look up the user record. */
  async find(params?: ServiceParams): Promise<User[]> {
    const query = params?.query || {}
    const knexClient = this.options.app.get('knexClient')

    // Start with the common user fields returned by this service.
    const dbQuery = knexClient<UserRecord>('users').select(
      'id',
      'email',
      'password_hash',
      'active'
    )

    // Apply supported query filters one by one when they are present.
    if (query.id !== undefined) {
      dbQuery.where('id', query.id)
    }

    if (query.email !== undefined) {
      dbQuery.where('email', String(query.email).trim().toLowerCase())
    }

    if (query.active !== undefined) {
      dbQuery.where('active', query.active)
    }

    // Default to a small result set unless the caller requests another limit.
    const limit = typeof query.$limit === 'number' ? query.$limit : 10
    if (limit >= 0) {
      dbQuery.limit(limit)
    }

    const rows = await dbQuery
    return rows.map((row) => this.mapRow(row))
  }

  /** Fetch a single user by primary key; 
   *  Feathers may call this after login to reload the authenticated user entity. */
  async get(id: Id, _params?: ServiceParams): Promise<User> {
    const knexClient = this.options.app.get('knexClient')

    // Load the stored user record that matches the requested id.
    const row = await knexClient<UserRecord>('users')
      .select('id', 'email', 'password_hash', 'active')
      .where('id', id)
      .first()

    // Return a 404-style error when the record is missing.
    if (!row) {
      throw new NotFound('User not found')
    }

    return this.mapRow(row)
  }

  /** User creation is not exposed through this service. */
  async create(_data: UserData, _params?: ServiceParams): Promise<User> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Full user replacement is not exposed through this service. */
  async update(_id: NullableId, _data: UserData, _params?: ServiceParams): Promise<User> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** Partial user updates are not exposed through this service. */
  async patch(_id: NullableId, _data: UserPatch, _params?: ServiceParams): Promise<User> {
    throw new MethodNotAllowed('Method not allowed')
  }

  /** User deletion is not exposed through this service. */
  async remove(_id: NullableId, _params?: ServiceParams): Promise<User> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

/** Build the service options object used when registering the users service. */
export const getOptions = (app: Application): UsersServiceOptions => {
  return { app }
}
