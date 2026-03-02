// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'

import type { Application } from '../../../../../declarations'
import type {
  DevicesIosEnrollmentDeviceEnrollment,
  DevicesIosEnrollmentDeviceEnrollmentData,
  DevicesIosEnrollmentDeviceEnrollmentPatch,
  DevicesIosEnrollmentDeviceEnrollmentQuery
} from './device-enrollment.schema'
import { join } from 'path'
import { readFileSync } from 'fs'

export type {
  DevicesIosEnrollmentDeviceEnrollment,
  DevicesIosEnrollmentDeviceEnrollmentData,
  DevicesIosEnrollmentDeviceEnrollmentPatch,
  DevicesIosEnrollmentDeviceEnrollmentQuery
}

export interface DevicesIosEnrollmentDeviceEnrollmentServiceOptions {
  app: Application
}

export interface DevicesIosEnrollmentDeviceEnrollmentParams extends Params<DevicesIosEnrollmentDeviceEnrollmentQuery> {}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class DevicesIosEnrollmentDeviceEnrollmentService implements ServiceInterface<string> {
  constructor(public options: DevicesIosEnrollmentDeviceEnrollmentServiceOptions) {}

  async find(params?: Params): Promise<string> {
    throw new Error('Method not allowed');
  }

  /**
   * User enrollment in iOS MDM is typically done by downloading and installing a configuration profile on the device.
   * This profile contains the necessary information for the device to enroll in the MDM service, such as the server URL and enrollment credentials.
   * In this implementation, we generate a configuration profile dynamically when the `get` method is called, 
   *    which can then be downloaded and installed on the user's iOS device to complete the enrollment process.
   * @param id 
   * @param params 
   * @returns profile as xml string
   */
  async get(id: Id, params?: Params): Promise<string> {
    // Get xml template and replace variables with real values. 
    // In a real world scenario, the values would be pulled from a database
    // For testing purposes or no , the values are hardcoded here.
    const profileTemplateFileName = 'enrollment-profile.xml';
    const fileGlobalFolder = 'assets'
    
    // profile_identifier is reverse domain name style unique identifier for the profile, e.g. com.example.mdm.enroll
    const baseUrl = this.options.app.get('publicBaseUrl') as string;
    const host = new URL(baseUrl).hostname;
    const reversedDomain = host.split('.').reverse().join('.');
    const profile_identifier = `${reversedDomain}.mdm.enroll`;

    // mdm_payload_identifier is reverse domain name style unique identifier for the mdm payload, 
    // e.g. com.example.mdm.payload. 
    // It is used in the configuration profile to identify the MDM payload and should be different from the profile identifier
    const mdm_payload_identifier = `${reversedDomain}.mdm.payload`; // TODO: reverse domain name style identifier, should be generated here with baseUrl

    //TODO: These variable need to pulled from database or config file in a real world scenario. 
    // For testing purposes they are hardcoded here.
    const profile_display_name = 'QTC Test MDM Enrollment';
    const org_name = 'QTC';
    const mdm_payload_display_name = 'QTC Test MDM';

    const profileTemplateFilePath = join(process.cwd(),fileGlobalFolder,profileTemplateFileName)
    const template = readFileSync(profileTemplateFilePath, 'utf8');

    // ✅ Define variables (universal config)
    const vars: Record<string, string> = {
      '__PROFILE_IDENTIFIER__': profile_identifier,
      '__UUID_MAIN__': crypto.randomUUID(),
      '__PROFILE_DISPLAY_NAME__': profile_display_name,
      '__ORG_NAME__': org_name,
      '__MDM_PAYLOAD_IDENTIFIER__': mdm_payload_identifier,
      '__UUID_MDM__': crypto.randomUUID(),
      '__MDM_PAYLOAD_DISPLAY_NAME__': mdm_payload_display_name,
      '__UUID_IDENTITY__': crypto.randomUUID(),
      '__SERVER_URL__': `${baseUrl}/devices/ios/mdm/server`,
      '__CHECKIN_URL__': `${baseUrl}/devices/ios/mdm/checkin`
    }
    let profile = template
    for (const [k, v] of Object.entries(vars)) profile = profile.split(k).join(v);
    return profile
  }
  
  async create(data: any, params?: Params): Promise<string>{
    throw new Error('Method not allowed')
  }

  // This method has to be added to the 'methods' option to make it available to clients
  async update(id: NullableId, data: any, params?: Params): Promise<string> {
    throw new Error('Method not allowed')
  }

  async patch(id: NullableId, data: any, params?: Params): Promise<string> {
   throw new Error('Method not allowed')
  }

  async remove(id: NullableId, params?: Params): Promise<string> {
    throw new Error('Method not allowed')
  }
}

export const getOptions = (app: Application) => {
  return { app }
}
