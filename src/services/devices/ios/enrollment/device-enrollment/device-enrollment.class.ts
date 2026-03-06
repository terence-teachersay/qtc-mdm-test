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
   * This profile contains the necessary information for the device to enroll in the MDM service,
   *  such as the server URL and enrollment credentials.
   * In this implementation, we generate a configuration profile dynamically when the `get` method is called, 
   *  which can then be downloaded and installed on the user's iOS device to complete the enrollment process.
   * 782ms from local call.
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
    
    // set return profile = template for now and replace variables after variables are set up
    let profile = template;

    // *** Set Variables ***************************************************************************************************
    // === Set Profile Variables ===========================================================================================
    // TODO: Some variable need to pulled from database or config file in a real world scenario.

    // Tell device this is a configuration profile.
    const profilePayloadType = 'Configuration';//from db later
    
    // Tell the device profile format version
    const profilePayloadVersion = 1 //from db later

    // Device use profilePayloadIdentifier to track if its new or existing profile and update the profile if needed. 
    const baseUrl = this.options.app.get('publicBaseUrl') as string;
    const host = new URL(baseUrl).hostname;
    const reversedDomain = host.split('.').reverse().join('.'); 
    const profilePayloadIdentifier = `${reversedDomain}.mdm.enroll`; 
    
    // Random UUID for the profile, to let the device track the profile version.
    const profilePayloadUUID = crypto.randomUUID(); 

    // The profile name shown on device when install
    const profilePayloadDisplayName = 'QTC Test MDM Enrollment'; //from db later

    // The profile description shown on device when install 
    const profilePayloadDescription = 'This profile will enroll your device in QTC MDM'; //from db later

    // The profile organization name shown on device when install
    const profilePayloadOrganization = 'QTC'; //from db later

    // Allow the user to remove the profile or not
    const profilePayloadRemovalDisallowed = false; //from db later or use a logic to decide. 
    //=== Profile Variables Setting End ====================================================================================

    //=== Set Content Cert Payload Variables ===============================================================================
    // TODO not a good way  need cert for different device.
    // 1. Need to store the cert in a safe place and retrieve it when needed.
    // 2. Currently the cert is generated using openssl and is not password protected. 
    //    In a real world scenario, you should password protect the cert and store the password securely as well.
    // 3. Need to generate the cert in SCEP not PKCS12. Now is PKCS12 for testing purpose only.

    // The type of the certificate payload.
    const certPayloadType = 'com.apple.security.pkcs12'; //maybe from db later??
    
    // Cert format version
    const certPayloadVersion = 1; //maybe from db later??

    // Cert id that device can use to track if uts new or exiting cert.
    const certPayloadIdentifier = `${reversedDomain}.mdm.enroll.cert`;

    // Random UUID for the cert payload, to let the device track the cert version.
    const certPayloadUUID = crypto.randomUUID();

    // The cert data in PKCS12 format, which is base64 encoded. 
    const certData = `MIIJWQIBAzCCCRcGCSqGSIb3DQEHAaCCCQgEggkEMIIJADCCA7cGCSqGSIb3DQEH
                      BqCCA6gwggOkAgEAMIIDnQYJKoZIhvcNAQcBMBwGCiqGSIb3DQEMAQYwDgQI3+8g
                      +dhUuMYCAggAgIIDcCj/llavT8MhKwb0fR8fWjmBMYzpjXyblmkGe4ZvwYjtRbIq
                      lwH9Tm/utxDCPQfHi3BxoiNPVnyHBCew85rcWp1w4WhrFyNSmNx9mIZgXT34WOaq
                      d0DM+w0POKgQAJmagkNxdF8tRJjsbZG882wU9JbIpkUfRuvPpzwZLzpCngYF+sAG
                      Aavrvwgld0dW0r8+i5mj6gI/yCKf/PGEwlwgIEGCn7P7k9Onsebdsvw+ComLzVJx
                      KsnBKQjhsjxOJrVoOXzLb2yNMOTFj1KNM2JzPDAR/P+e7A1n9DaQ6W4G8+5CP20j
                      bPPOQpEb0NbXXOdWtECDO8JRV9esz9KExFVyxi/tcKwFpR5Q7HaLHGvwYpPeOa4N
                      xqt7GzCNwBjo7nQ0U8nvQVyCrhLsp7zySkLUdvqKNy1LRL9iVsG6YKU72qydO1Kt
                      81+4bKJ3E7MUpFKuvta87DYVvC5dH9+llUXJkPaRmnlTQ8qPjDwwrG3zDRN+xrb8
                      ytcuRuTf3QG7xorJNblShRzGwQvZAfRbSa/7hMswhzNIEAo2ZW41U7u/sEvqberV
                      FdYZkeTlDKmN+qRwE6UkqkKacvukHTFX04CVj3LGZau7j3KU3BcqCj7eBUZuEB1k
                      D5Xzuug8ZaKcmL6QUwcZhSsS6CPmUUe/dPCbsKiX2ef0yXR2IAVaHsCm9Dz44BSG
                      OoY43WlDyZztFtToV6eHkFf5FpF9PIbsmecGE3PL/x05JEnAXknhvofUBLYkF18y
                      Ll2ormVvcUMpXDBStb31Jf9mtjys/KpHB1xBEMNjM9KKi9CIM7Q2hFIVHPFEk9aT
                      uuYenisHitt7Hjn7Bh7hd+WCwJOBa7k3RWrY3X/hAQbjyYfk5c3hn5hgRbza5AE6
                      wW9yR+PWh8SYfhYiAw4wF0EQPPcNoj5ewOxS9D/SFt+/hI8ks/0nXo6YFpPksf5x
                      rzppkCgdS3o/PWUEY6oEzQf+OX+jJNJY+tQmjG+a7yiELBePe+qdSahqqYjSPaqv
                      aPlbcXmb+bsKzkUUirSuFAUaqPMDM5286zrvodVyyy/A3YzXTUI1SujfR5Ab8IhW
                      A/BArxOjL9fzdkaKcdUlOuPzrutJ0oNiEn29kAPnus4Pqe0Shay58lztfZwu2ior
                      KeGs7f+ZCkPbTqirO2adwMXB1rlvKL2inRwOPucwggVBBgkqhkiG9w0BBwGgggUy
                      BIIFLjCCBSowggUmBgsqhkiG9w0BDAoBAqCCBO4wggTqMBwGCiqGSIb3DQEMAQMw
                      DgQISBThX5cZTbgCAggABIIEyIDL1Z5k2VB12E87vsRdfSGa2MzzDZIkUYIaCWkx
                      jtry3//hVk92J1H6JYu2hcFtK8rlJmHTLutfc3QXp6ZdMIJzH4SdWZkK4BHB/gpx
                      ZVLtDSwoC0p5Fd8f2IibCa9n0SN4SF52hvSGKW1DTsirUtq71+OzsTma3nc+Wh3k
                      cF5Kv8vQ/FzswwMk2TnKcEWt+oxVqtrZpjzRkHeWuR8PZr2Du8uBAxslBW8gvIGx
                      IwOo7D7arbBfjiQbyoLTmdef0hdesMAGFaswVFqid6B6oLdf6zP9SparseKxOPUQ
                      2KEpH46+uq8rEumNEO46CeGTfgfaJ+lTo+gCx+eDHodCg09D8D3TDA5+XJNuUg9T
                      KBo0OP59ghwaHMVWxng9j7c4Fad6MIRV1O6GdPUXRHlTIHhuHo58AgrN0xaGM9/g
                      E16dmjU+xJ0G6I9gcu8XpXfM+KsydUyrspFK8QPVFQUygSQz05jOEd0gfDAEhYba
                      4OGx0mM2Y9s4RDnpqhBeO8rw/8wrcMbFPWQ2rvqVLx+NMhmuwW4KosjWaPdyYFlg
                      cis0G0DDCSG6g5BfqDbO5KROjrPTCnN8MIihiJRHxg0wjc7OhtBDUKQC1ctDnvIv
                      PARIvlBnko3ZkACWLkTlKUPMdfH8cr5o4rdxGlAg0WonaMMdy14JwpkUCx6hmvzG
                      toWA7/4fwzq4vktUvlANqWFLm/KmH1DD1iWE2bkZ0rBUvT8/IZFCzklLm3NzfWoT
                      sk0Ny+W+BtYyI20aVpM9qplAV2kVAqtPfJZpjWGK1m3hHgqmHkzNN8fYZ4TAZqiM
                      9p3Bbca0QGeL3oDNNhOcuEnvsFuItwDVFZQyBWRKpB3zHEgNZF7SMzbHXrmXlFd1
                      9BU2qVtaPxVn3e+CQLRN0RKUVEwtHJBjzpzEbppmmUy+xjr9g0u3IGF9VL77wGbC
                      znxmqQ8AGFEjfYlPY9yOd+LP5E0zIoKwxhQXiT3n8kPm8385EBx+0SX9MMDj38MC
                      Z+L0yRQA6EQZMW8KvMnkXTRg2+cupnrQ70qpuYj2omZhFKxeRMcrGhkHu3LMP8sg
                      KIXWYbbqpqGvR4qWA+QDNOeFU1dlccm8Z/CeHOZ7AyS/QW0qdewTbX8SAs3fS/Qx
                      3QNuzCPzZa9VFZy1Lu3R3atJabHqIbvCEcfDZtUScGjphAdVluSuAvgqS3oKs8cB
                      LzYJG+AmHT/Sac1BfDkUe2bKzHOTEIbTQHQaUVobDujgKHkUH7SBfRfH15PGwwjy
                      yMwD9FLnB1HHE/iTRNDQQcK+QCOVznWebNzJHviHO5GxDRhL4+47h5akf+POAola
                      1Pi0UkAkjbH0jQu8xCSmm4z5O5IEeknzXn8DRS+LzJLAYQ8o8+XgiKC84pRwp7GJ
                      7/lJ7Ew0lDIzdqAxE50cj/Fyog22Bw2RwBjd/Yk39mvX53KqkKuwMMXP/NctsJ/t
                      tGycY408U5d6rFOFHgVs9M2Dxfqq+6Zr/vddUBbWpwz3f0C56140nYdLeL2kdpRc
                      FWdxqc2zNfIwOWbPtU2tkCYezW+2o9DwpfkijjXUlp3V4JtVbXUU8Ab0fiYtHjj+
                      JPrSMC/uWmWa6Hoy85qCar7NiI8ZF7pkDc3uxlOdOggAyzSXYgfgi6w8VzElMCMG
                      CSqGSIb3DQEJFTEWBBQMA5KfV6o9+6pKwGO5T2rF6RC/uTA5MCEwCQYFKw4DAhoF
                      AAQUUAcyl3A5kzM0IjpyY4o9jagCTmAEEINEi8zwwJCmvgx3ghpAZekCAggA
                    `;
    // Cert password, if the cert is password protected. Need to store in DB with encription.
    const certPassword = 'password123';// need to stored in db

    //=== Content Cert Payload Variables Setting End =======================================================================
    //=== Set Content MDM Payload Variables ================================================================================
    
    //Type for mdm payload.
    const contentPayloadType = 'com.apple.mdm';//from db later
    
    // Payload format version
    const contentPayloadVersion = 1;//from db later

    // MDM payload ID that device can use to track if its new or exiting mdm payload.
    const contentPayloadIdentifier = `${reversedDomain}.mdm.payload`;
    
    // Random UUID for the MDM payload, to let the device track the MDM payload version.
    const contentPayloadUUID = crypto.randomUUID();

    // The MDM server display name shown on device when install the profile.
    const contentPayloadDisplayName = 'QTC Test MDM'; //from db later

    // APNs topic for MDM, which is used for the device to receive push notification from MDM server.
    const contentTopic = "com.apple.mgmt.External.beb7d701-9419-4839-b984-e421062d33f6" //from db later
    const contentIdentityCertificateUUID = certPayloadUUID

    //get MDM server Path and Check in path from config
    const mdmConfig = this.options.app.get('mdm') as any;
    
    // Server End point for the device to check for commands 
    // The end point is implmented in devices\ios\server UPDATE method.
    const serverPath = mdmConfig.serverPath;
    const contentServerUrl = `${baseUrl}${serverPath}`;

    // Check in End point for the device to do authenticate, update push APNs Token and check out.
    // The end point is implmented in devices\ios\checkin UPDATE method.
    //TODO: Need to add a enrollToken at the end of the checkin url for authentication
    // It should  be used for first time check in.
    // i.e.  /checkin?enrollToken=xxxx.
    // Now we just accept any device that checks in and store its info in the Map. 
    // This is not secure and should be improved in a real world scenario.
    // The token should be generated when the profile is generated and stored in the database with an expiration time.
    // When the device checks in, the token is verified and then invalidated to prevent reuse.
    // The token should be link to the loggin in user info as well.
    // In checkin end point.  when device check in,  either check if the token is valid (first time check in) 
    // or check if the device UDUD is already in the database and is valid UDID
    const checkInPath = mdmConfig.checkInPath;
    const contentCheckInUrl = `${baseUrl}${checkInPath}`;

    // Access right for the MDM server to manage the device. 8191 is full access.
    const contentAccessRights = 8191; //from db later

    // Whether the MDM server require the device to sign the messages sent to MDM server with the identity cert.
    const contentSignMessage = true; //from db later

    // Whether the device should be automatically checked out (unenrolled) when the profile is removed.
    const contentCheckOutWhenRemoved = true;  //from db later 
    //=== Content MDM Payload Variables Setting End ========================================================================
    //End Set up Variables**************************************************************************************************

    
    //*** Pair variables to the template variables
    const vars: Record<string, string> = {
      //file payload variables
      '__PROFILE_PAYLOAD_TYPE__': profilePayloadType,
      '__PROFILE_PAYLOAD_VERSION__': profilePayloadVersion.toString(),
      '__PROFILE_PAYLOAD_IDENTIFIER__': profilePayloadIdentifier,
      '__PROFILE_PAYLOAD_UUID__': profilePayloadUUID,
      '__PROFILE_PAYLOAD_DISPLAY_NAME__': profilePayloadDisplayName,
      '__PROFILE_PAYLOAD_DESCRIPTION__': profilePayloadDescription,
      '__PROFILE_PAYLOAD_ORGANIZATION__': profilePayloadOrganization,
      '__PROFILE_REMOVAL_DISALLOWED__': profilePayloadRemovalDisallowed ? `<true/>` : `<false/>`,
      
      //cert payload variables
      '__CERT_PAYLOAD_TYPE__': certPayloadType,
      '__CERT_PAYLOAD_VERSION__': certPayloadVersion.toString(),
      '__CERT_PAYLOAD_IDENTIFIER__': certPayloadIdentifier,
      '__CERT_PAYLOAD_UUID__': certPayloadUUID,
      '__CERT_DATA__': certData,
      '__CERT_PASSWORD__': certPassword,

      //content payload variables
      '__CONTENT_PAYLOAD_TYPE__': contentPayloadType,
      '__CONTENT_PAYLOAD_VERSION__': contentPayloadVersion.toString(),
      '__CONTENT_PAYLOAD_IDENTIFIER__': contentPayloadIdentifier,
      '__CONTENT_PAYLOAD_UUID__': contentPayloadUUID,
      '__CONTENT_PAYLOAD_DISPLAY_NAME__': contentPayloadDisplayName,
      '__CONTENT_TOPIC__': contentTopic,
      '__CONTENT_IDENTITY_CERTIFICATE_UUID__': contentIdentityCertificateUUID,
      '__CONTENT_SERVER_URL__': contentServerUrl,
      '__CONTENT_CHECKIN_URL__': contentCheckInUrl,
      '__CONTENT_ACCESS_RIGHTS__': contentAccessRights.toString(),
      '__CONTENT_SIGN_MESSAGE__': contentSignMessage? `<true/>` : `<false/>`,
      '__CONTENT_CHECKOUT_WHEN_REMOVED__': contentCheckOutWhenRemoved? `<true/>` : `<false/>`
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
