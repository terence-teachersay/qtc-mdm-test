import type { Params } from '@feathersjs/feathers'

import type { ClientApplication } from '../../client'
import type { User, UserData, UserPatch, UsersQuery, UsersService } from './users.class'

export type { User, UserData, UserPatch, UsersQuery }

export type UsersClientService = Pick<
  UsersService<Params<UsersQuery>>,
  (typeof usersMethods)[number]
>

export const usersPath = 'users'

export const usersMethods: Array<keyof UsersService> = ['find', 'get']

export const usersClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(usersPath, connection.service(usersPath), {
    methods: usersMethods
  })
}

declare module '../../client' {
  interface ServiceTypes {
    [usersPath]: UsersClientService
  }
}