import { BadRequest, Forbidden } from '@feathersjs/errors'

import { Role } from '../constants/roles'
import type { HookContext } from '../declarations'

interface RoleRow {
  groupId: number
}

export const requireRole = (roleName: Role) => {
  return async (context: HookContext) => {
    const userId = Number(context.params.user?.id)
    const requestedGroupId = Number(context.params.query?.group_id)

    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequest('Authenticated user id is required')
    }

    if (
      context.params.query?.group_id === undefined ||
      context.params.query?.group_id === null ||
      context.params.query?.group_id === ''
    ) {
      throw new BadRequest('query.group_id is required')
    }

    if (!Number.isInteger(requestedGroupId) || requestedGroupId <= 0) {
      throw new BadRequest('query.group_id must be a positive integer')
    }

    const knexClient = context.app.get('knexClient')

    const rows = await knexClient<RoleRow>('user_roles as ur')
      .innerJoin('roles as r', 'r.id', 'ur.role_id')
      .innerJoin('groups as g', 'g.id', 'ur.group_id')
      .select('g.id as groupId')
      .where('ur.uid', userId)
      .where('ur.revoked', 0)
      .where('r.name', roleName)
      .where('g.id', requestedGroupId)
      .orderBy('g.id', 'asc')

    if (rows.length === 0) {
      throw new Forbidden(`User does not have a valid ${roleName} role for group_id ${requestedGroupId}`)
    }

    context.params.authorizedRole = roleName
    context.params.authorizedGroupIds = rows.map((row: RoleRow) => row.groupId)
    context.params.group_id = requestedGroupId
    context.params.query = {
      ...(context.params.query || {}),
      group_id: requestedGroupId
    }

    return context
  }
}
