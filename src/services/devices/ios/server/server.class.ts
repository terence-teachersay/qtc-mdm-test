// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'

import type { Application } from '../../../../declarations'
import type {
  DevicesIosServer,
  DevicesIosServerData,
  DevicesIosServerPatch,
  DevicesIosServerQuery
} from './server.schema'
import * as plist from 'plist';
import { v4 as uuidv4 } from 'uuid';
import { deviceMap } from '../../../../device-store'
import apn from 'apn';
import fs from 'fs';
import path from 'path';

export type { DevicesIosServer, DevicesIosServerData, DevicesIosServerPatch, DevicesIosServerQuery }

export interface DevicesIosServerServiceOptions {
  app: Application
}

export interface DevicesIosServerParams extends Params<DevicesIosServerQuery> {}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class DevicesIosServerService<
  ServiceParams extends DevicesIosServerParams = DevicesIosServerParams
> implements ServiceInterface<DevicesIosServer, DevicesIosServerData, ServiceParams, DevicesIosServerPatch> {
  constructor(public options: DevicesIosServerServiceOptions) {}

  /**
   * Returns all enrolled devices and their current info
   * TODO: This is Temporary need to remove later
   */
  async find(params?: Params) {
    // Convert the Map values into a simple array to view
    return Array.from(deviceMap.values());
  }

  async get(id: Id, _params?: ServiceParams): Promise<DevicesIosServer> {
    return {
      id: 0
    }
  }

  /**
   * Trigger a "Push" to a specific device to force it to check for commands
   * TODO Tempoary only  remove later
   */
  async create(data: any, params?: Params): Promise<any> {
    const device = deviceMap.get(data.udid);
    if (!device || !device.Token) {
        throw new Error('Device not found or has no Push Token');
    }

    // --- APNS LOGIC START ---
    // Send a push to APNs to wake up device udid and check for commands
    console.log(`[APNs] Sending Push to ${data.udid} with Magic: ${device.PushMagic}`);
    await this.sendApnsPush(device.Token, device.PushMagic);

    return { status: 'Push Sent' };
  }

  /**
   * Sent
   * @param deviceToken 
   * @param pushMagic 
   */
  async sendApnsPush(deviceToken: any, pushMagic: string) {
    // Get the Cert and Key
    const certPath = path.join(process.cwd(), 'certs', 'MDM_ Jesse Peterson_Certificate.pem');
    const keyPath = path.join(process.cwd(), 'certs', 'mdmcert.download.push.key');

    // Set up Cert for APNs
    const apnProvider = new apn.Provider({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      production: true
    });
    
    // Set notification
    const notification: any = new apn.Notification();
    notification.payload = { mdm: pushMagic };
    notification.topic = "com.apple.mgmt.External.beb7d701-9419-4839-b984-e421062d33f6";
    notification.priority = 10;
    notification.pushType = "background";

    // Change device token to hex
    const deviceTokenHex = Buffer.from(deviceToken.data || deviceToken).toString('hex');

    try {
      // Call APNs
      const result = await apnProvider.send(notification, deviceTokenHex);
      
      if (result.failed && result.failed.length > 0) {
        console.error('[APNS] Failed:', result.failed[0].response);
      } else {
        console.log('[APNS] Push sent successfully to device');
      }
    } catch (err) {
      console.error('[APNS] Error connecting to Apple:', err);
    }
  }

  /**
   * This is the Command Loop for the APPLE DEVICE
   * TODO: Need to check the authentication of the device. 
   * Now we just accept any device that checks in and store its info in the Map. 
   * This is not secure and should be improved in a real world scenario
   */
  async update(id: NullableId, data: any, params?: Params): Promise<any> {
    const msg: any = plist.parse(data);
    const { Status, UDID, CommandUUID, QueryResponses } = msg;

    console.log(`[MDM Loop] Status: ${Status} | Device: ${UDID}`);

    // 1. Device asks for work
    if (Status === 'Idle') {
      const command = {
        Command: {
          RequestType: 'DeviceInformation',
          Queries: ['Model', 'ProductName', 'SerialNumber', 'DeviceName', 'OSVersion', 'AvailableDeviceCapacity','BatteryLevel','StorageCapacity' ]
        },
        CommandUUID: uuidv4()
      };

      // wrap command in xml
      return { xml: plist.build(command) };
    }

    // 2. Device returns the info we asked for
    if (Status === 'Acknowledged' && QueryResponses) {
      const existing = deviceMap.get(UDID) || {};
      
      // Update the Map with the new hardware details
      deviceMap.set(UDID, {
        ...existing,
        ...QueryResponses, // This merges Model, SerialNumber, etc.
        lastSeen: new Date()
      });

      console.log(`[Storage] Updated info for ${UDID}`);
    }

    //TODO: Need to handle 3 more Status: Error, CommandFormatError, NotNow,  
    // And a default Status to handle all other status.

    return {}; // Send 200 OK to finish the loop
  }

  async patch(
    id: NullableId,
    data: DevicesIosServerPatch,
    _params?: ServiceParams
  ): Promise<DevicesIosServer> {
    return {
      id: 0,
      ...data
    }
  }

  async remove(id: NullableId, _params?: ServiceParams): Promise<DevicesIosServer> {
    return {
      id: 0
    }
  }
}

export const getOptions = (app: Application) => {
  return { app }
}
