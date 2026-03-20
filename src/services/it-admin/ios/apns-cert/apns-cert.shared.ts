import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../../../client'
import type {
  ItAdminIosApnsCert,
  ItAdminIosApnsCertData,
  ItAdminIosApnsCertPatch,
  ItAdminIosApnsCertQuery,
  ItAdminIosApnsCertService
} from './apns-cert.class'

export type {
  ItAdminIosApnsCert,
  ItAdminIosApnsCertData,
  ItAdminIosApnsCertPatch,
  ItAdminIosApnsCertQuery
}

export type ItAdminIosApnsCertClientService = Pick<
  ItAdminIosApnsCertService<Params<ItAdminIosApnsCertQuery>>,
  (typeof itAdminIosApnsCertMethods)[number]
>

export const itAdminIosApnsCertPath = 'it-admin/ios/apns-cert'

export const itAdminIosApnsCertMethods: Array<keyof ItAdminIosApnsCertService> = ['find', 'get', 'create']

export const itAdminIosApnsCertClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(itAdminIosApnsCertPath, connection.service(itAdminIosApnsCertPath), {
    methods: itAdminIosApnsCertMethods
  })
}

declare module '../../../../client' {
  interface ServiceTypes {
    [itAdminIosApnsCertPath]: ItAdminIosApnsCertClientService
  }
}
