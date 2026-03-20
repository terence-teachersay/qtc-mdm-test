import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import { BadRequest, MethodNotAllowed } from '@feathersjs/errors'

import type { Application } from '../../declarations'
import type {
  LoginPortal,
  LoginPortalData,
  LoginPortalPatch,
  LoginPortalQuery
} from './login-portal.schema'
import { logger } from '../../logger'
import { loginPortalPath } from './login-portal.shared'

export type { LoginPortal, LoginPortalData, LoginPortalPatch, LoginPortalQuery }

interface LoginPortalRoleRow {
  role_type: string
  group_type: string
  group_id: number
  school_name: string | null
  company_name: string | null
}

export interface LoginPortalServiceOptions {
  app: Application
}

export interface LoginPortalParams extends Params<LoginPortalQuery> {
  user?: {
    id?: number | string
  }
}

export class LoginPortalService<
  ServiceParams extends LoginPortalParams = LoginPortalParams
> implements ServiceInterface<LoginPortal, LoginPortalData, ServiceParams, LoginPortalPatch> {
  constructor(public options: LoginPortalServiceOptions) {}

  /** Return the authenticated user's available portal roles and groups for portal selection. */
  async find(params?: ServiceParams): Promise<LoginPortal[]> {
    const userId = Number(params?.user?.id)

    logger.info('[Endpoint START]', {
      endpoint: `${loginPortalPath} FIND`,
      id: null,
      query: params?.query || null,
      input: {
        userId: Number.isFinite(userId) ? userId : null
      }
    })

    // Require an authenticated user so we only return that user's portal memberships.
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequest('Authenticated user id is required')
    }

    const knexClient = this.options.app.get('knexClient')

    // Load the user's active roles together with the owning group metadata used by the portal picker.
    const rows = await knexClient<LoginPortalRoleRow>('user_roles as ur')
      .innerJoin(`roles as rt`, 'rt.id', 'ur.role_id')
      .innerJoin('groups as g', 'g.id', 'ur.group_id')
      .innerJoin('group_types as gt', 'gt.id', 'g.group_type_id')
      .leftJoin('schools as s', 's.group_id', 'g.id')
      .leftJoin('companies as c', 'c.group_id', 'g.id')
      .select(
        'rt.name as role_type',
        'gt.name as group_type',
        'g.id as group_id',
        's.name as school_name',
        'c.name as company_name'
      )
      .where('ur.uid', userId)
      .where('ur.revoked', 0)
      .orderBy('gt.name', 'asc')
      .orderBy('g.id', 'asc')
      .orderBy('rt.name', 'asc')

    // Normalize each row into the frontend-friendly portal option shape.
    const result = rows.map((row: LoginPortalRoleRow) => {
      const groupName =
        row.group_type === 'school'
          ? row.school_name
          : row.group_type === 'company'
            ? row.company_name
            : 'system'

      return {
        roleType: row.role_type,
        groupType: row.group_type,
        groupId: row.group_id,
        groupName,
        label: `${groupName || row.group_type} ${row.role_type}`
      }
    })

    logger.info('[Endpoint END]', {
      endpoint: `${loginPortalPath} FIND`,
      id: null,
      result: {
        userId,
        roleCount: result.length,
        groupIds: Array.from(new Set(result.map((entry) => entry.groupId)))
      }
    })

    return result
  }

  async get(_id: Id, _params?: ServiceParams): Promise<LoginPortal> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async create(_data: LoginPortalData, _params?: ServiceParams): Promise<LoginPortal> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async update(_id: NullableId, _data: LoginPortalData, _params?: ServiceParams): Promise<LoginPortal> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async patch(_id: NullableId, _data: LoginPortalPatch, _params?: ServiceParams): Promise<LoginPortal> {
    throw new MethodNotAllowed('Method not allowed')
  }

  async remove(_id: NullableId, _params?: ServiceParams): Promise<LoginPortal> {
    throw new MethodNotAllowed('Method not allowed')
  }
}

export const getOptions = (app: Application): LoginPortalServiceOptions => {
  return { app }
}
