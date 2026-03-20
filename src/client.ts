// For more information about this file see https://dove.feathersjs.com/guides/cli/client.html
import { feathers } from '@feathersjs/feathers'
import type { TransportConnection, Application } from '@feathersjs/feathers'
import authenticationClient from '@feathersjs/authentication-client'
import type { AuthenticationClientOptions } from '@feathersjs/authentication-client'

import { itAdminIosEnrollmentDeviceEnrollmentClient } from './services/it-admin/ios/enrollment/device-enrollment/device-enrollment.shared'
export type {
  ItAdminIosEnrollmentDeviceEnrollment,
  ItAdminIosEnrollmentDeviceEnrollmentData,
  ItAdminIosEnrollmentDeviceEnrollmentQuery,
  ItAdminIosEnrollmentDeviceEnrollmentPatch
} from './services/it-admin/ios/enrollment/device-enrollment/device-enrollment.shared'

import { itAdminIosDevicesStatusClient } from './services/it-admin/ios/devices-status/devices-status.shared'
export type {
  ItAdminIosDevicesStatus,
  ItAdminIosDevicesStatusData,
  ItAdminIosDevicesStatusQuery,
  ItAdminIosDevicesStatusPatch
} from './services/it-admin/ios/devices-status/devices-status.shared'

import { itAdminIosCommandsDeviceInformationClient } from './services/it-admin/ios/commands/device-information/device-information.shared'
export type {
  ItAdminIosCommandsDeviceInformation,
  ItAdminIosCommandsDeviceInformationData,
  ItAdminIosCommandsDeviceInformationQuery,
  ItAdminIosCommandsDeviceInformationPatch
} from './services/it-admin/ios/commands/device-information/device-information.shared'

import { devicesIosScepClient } from './services/devices/ios/scep/scep.shared'
export type {
  DevicesIosScep,
  DevicesIosScepData,
  DevicesIosScepQuery,
  DevicesIosScepPatch
} from './services/devices/ios/scep/scep.shared'

import { devicesIosServerClient } from './services/devices/ios/server/server.shared'
export type {
  DevicesIosServer,
  DevicesIosServerData,
  DevicesIosServerQuery,
  DevicesIosServerPatch
} from './services/devices/ios/server/server.shared'

import { devicesIosCheckinClient } from './services/devices/ios/checkin/checkin.shared'
export type {
  DevicesIosCheckin,
  DevicesIosCheckinData,
  DevicesIosCheckinQuery,
  DevicesIosCheckinPatch
} from './services/devices/ios/checkin/checkin.shared'

export interface Configuration {
  connection: TransportConnection<ServiceTypes>
}

export type ClientApplication = Application<ServiceTypes, Configuration>

/**
 * Returns a typed client for the qtc-mdm-test app.
 *
 * @param connection The REST or Socket.io Feathers client connection
 * @param authenticationOptions Additional settings for the authentication client
 * @see https://dove.feathersjs.com/api/client.html
 * @returns The Feathers client application
 */
export const createClient = <Configuration = any,>(
  connection: TransportConnection<ServiceTypes>,
  authenticationOptions: Partial<AuthenticationClientOptions> = {}
) => {
  const client: ClientApplication = feathers()

  client.configure(connection)
  client.configure(authenticationClient(authenticationOptions))
  client.set('connection', connection)

  client.configure(devicesIosCheckinClient)
  client.configure(devicesIosServerClient)
  client.configure(devicesIosScepClient)
  client.configure(itAdminIosCommandsDeviceInformationClient)
  client.configure(itAdminIosDevicesStatusClient)
  client.configure(itAdminIosEnrollmentDeviceEnrollmentClient)
  return client
}
