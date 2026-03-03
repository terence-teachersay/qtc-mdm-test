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
    const fileGlobalFolder = 'assets'
    const profileTemplateFileName = 'enrollment-profile.xml';
    const profileTemplateFilePath = join(process.cwd(),fileGlobalFolder,profileTemplateFileName)
    const template = readFileSync(profileTemplateFilePath, 'utf8');
    let profile = template // set return profile = template for now and replace variables after variables are set up

    //Set up Variables********************************************************************************************************
    //TODO: These variable need to pulled from database or config file in a real world scenario. 
    //For testing purposes they are hardcoded here.
    const filePayloadTypeTYPE_ = 'Configuration' //from db later
    const filePayloadVersion = 1 //from db later

    // profile_identifier is reverse domain name style unique identifier for the profile, 
    // e.g. com.example.mdm.enroll
    const baseUrl = this.options.app.get('publicBaseUrl') as string;
    const host = new URL(baseUrl).hostname;
    const reversedDomain = host.split('.').reverse().join('.');
    const profile_identifier = `${reversedDomain}.mdm.enroll`;

    const profile_display_name = 'QTC Test MDM Enrollment'; //from db later
    const org_name = 'QTC'; //from db later
    const payloadRemovalDisallowed = false; //from db later
    const contentPayloadType = 'com.apple.mdm' //from db later
    const contentPayloadVersion = 1 //from db later

    // mdm_payload_identifier is reverse domain name style unique identifier for the mdm payload, 
    // e.g. com.example.mdm.payload. 
    // It is used in the configuration profile to identify the MDM payload and should be different from the profile identifier
    const mdm_payload_identifier = `${reversedDomain}.mdm.payload`;

    const mdm_payload_display_name = 'QTC Test MDM'; //from db later

    //get MDM server Path and Check in path from config
    const mdmConfig = this.options.app.get('mdm') as any;
    const serverPath = mdmConfig.serverPath;
    const serverUrl = `${baseUrl}${serverPath}`;
    const checkInPath = mdmConfig.checkInPath;
    const checkInUrl = `${baseUrl}${checkInPath}`;

    const accessRights = 8191; // Full access  //from db later
    const signMessage = true; //from db later
    const checkOutWhenRemoved = true;  //from db later   
    //End Set up Variables****************************************************************************************************

    
    // ✅ Define variables (universal config)
    const vars: Record<string, string> = {
      //file payload variables
      '_FILE_PAYLOAD_TYPE_': filePayloadTypeTYPE_,
      '_FILE_PAYLOAD_VERSION_': filePayloadVersion.toString(),
      '__PROFILE_IDENTIFIER__': profile_identifier,
      '__UUID_MAIN__': crypto.randomUUID(),
      '__PROFILE_DISPLAY_NAME__': profile_display_name,
      '__ORG_NAME__': org_name,
      '__PAYLOAD_REMOVAL_DISALLOWED__': payloadRemovalDisallowed.toString(),

      //content payload variables
      '_CONTENT_PAYLOAD_TYPE_': contentPayloadType,
      '_CONTENT_PAYLOAD_VERSION_': contentPayloadVersion.toString(),
      '__MDM_PAYLOAD_IDENTIFIER__': mdm_payload_identifier,
      '__UUID_MDM__': crypto.randomUUID(),
      '__MDM_PAYLOAD_DISPLAY_NAME__': mdm_payload_display_name,
      '__UUID_IDENTITY__': crypto.randomUUID(),
      '__SERVER_URL__': serverUrl,
      '__CHECKIN_URL__': checkInUrl,
      '__ACCESS_RIGHTS__': accessRights.toString(),
      '__SIGN_MESSAGE__': signMessage.toString(),
      '__CHECKOUT_WHEN_REMOVED__': checkOutWhenRemoved.toString()
    }

    // ✅ Replace variables in the template with real values
    for (const [k, v] of Object.entries(vars)) profile = profile.split(k).join(v);
    
    // ✅ Return the generated profile
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
