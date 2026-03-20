import type { Params } from '@feathersjs/feathers'
import type { ClientApplication } from '../../../../client'
import type {
  ItAdminIosApnsCsr,
  ItAdminIosApnsCsrData,
  ItAdminIosApnsCsrPatch,
  ItAdminIosApnsCsrQuery,
  ItAdminIosApnsCsrService
} from './apns-csr.class'

export type {
  ItAdminIosApnsCsr,
  ItAdminIosApnsCsrData,
  ItAdminIosApnsCsrPatch,
  ItAdminIosApnsCsrQuery
}

export type ItAdminIosApnsCsrClientService = Pick<
  ItAdminIosApnsCsrService<Params<ItAdminIosApnsCsrQuery>>,
  (typeof itAdminIosApnsCsrMethods)[number]
>

export const itAdminIosApnsCsrPath = 'it-admin/ios/apns-csr'

export const itAdminIosApnsCsrMethods: Array<keyof ItAdminIosApnsCsrService> = ['get']

export const itAdminIosApnsCsrClient = (client: ClientApplication) => {
  const connection = client.get('connection')

  client.use(itAdminIosApnsCsrPath, connection.service(itAdminIosApnsCsrPath), {
    methods: itAdminIosApnsCsrMethods
  })
}

declare module '../../../../client' {
  interface ServiceTypes {
    [itAdminIosApnsCsrPath]: ItAdminIosApnsCsrClientService
  }
}
