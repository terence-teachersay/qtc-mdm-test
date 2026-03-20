import type { Params } from '@feathersjs/feathers'

import type { ClientApplication } from '../../client'
import type {
  LoginPortal,
  LoginPortalData,
  LoginPortalPatch,
  LoginPortalQuery,
  LoginPortalService
} from './login-portal.class'

export type { LoginPortal, LoginPortalData, LoginPortalPatch, LoginPortalQuery }

export type LoginPortalClientService = Pick<
  LoginPortalService<Params<LoginPortalQuery>>,
  (typeof loginPortalMethods)[number]
>

export const loginPortalPath = 'login-portal'

export const loginPortalMethods: Array<keyof LoginPortalService> = ['find']

export const loginPortalClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(loginPortalPath, connection.service(loginPortalPath), {
    methods: loginPortalMethods
  })
}

declare module '../../client' {
  interface ServiceTypes {
    [loginPortalPath]: LoginPortalClientService
  }
}