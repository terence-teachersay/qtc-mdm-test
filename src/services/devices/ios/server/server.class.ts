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
import { deviceMap } from '../ios-device-store'
import apn from 'apn';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../../logger';

// shared command queue helpers (not specific to service)
import { addCommand, CommandStatus, getNextCommand, updateCommandStatus } from '../command-queue';

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
    logger.info("src\services\devices\ios\server FIND called")
    return Array.from(deviceMap.values());
  }

  async get(id: Id, _params?: ServiceParams): Promise<DevicesIosServer> {
    return {
      id: 0
    }
  }

  /**
   * Trigger a "Push" to a specific device to force it to check for commands
   * device udid is passing in
   * TODO Tempoary only  remove later
   */
  async create(data: any, params?: Params): Promise<any> {
    // Expect callers to provide at least udid and payload.  This method
    // both enqueues the command and (optionally) sends a push notification.
    logger.info("src\services\devices\ios\server CREATE called")
    const { udid } = data;
    if (!udid) {
      throw new Error('Must supply udid and payload');
    }
    const device = deviceMap.get(udid);
    if(!device){
      throw new Error('Device UDID not found');
    }

    // Device information queries to request
    const deviceInfoPayload = {
      RequestType: 'DeviceInformation',
      Queries: [
        'Model',
        'ProductName',
        'SerialNumber',
        'DeviceName',
        'OSVersion',
        'AvailableDeviceCapacity',
        'BatteryLevel',
        'StorageCapacity'
      ]
    };

    // Queue 2 DeviceInformation commands
    const queuedCommands = Array.from({ length: 2 }, () =>
      addCommand(
        udid,
        'DeviceInformation',
        deviceInfoPayload,
        1  // priority
      )
    );

    // Send push notification to wake device if it has push token
    if (device && device.Token) {
      logger.info(`[APNs] Sending Push to ${udid}`);
      await this.sendApnsPush(device.Token, device.PushMagic);
    }

    return queuedCommands[queuedCommands.length - 1];
  }

  /**
   * Sent push notification to device
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
        logger.error('[APNS] Failed:', result.failed[0].response);
      } else {
        logger.info('[APNS] Push sent successfully to device');
      }
    } catch (err) {
      logger.error('[APNS] Error connecting to Apple:', err);
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
    logger.info(`[MDM] command loop fetch`, msg );  
    const { Status, UDID, CommandUUID, QueryResponses } = msg;
    let returnResponse = {}

    // Handle NotNow - keep command in queue for later retry
    if (Status === 'NotNow' && CommandUUID) {
      logger.info(`[MDM] Device ${UDID} returned NotNow for command ${CommandUUID}`);
      updateCommandStatus(UDID, CommandUUID, CommandStatus.NOT_NOW);
    }

    // Handle Acknowledged - mark as done and get next command
    if (Status === 'Acknowledged') {
      logger.info(`[MDM] Device ${UDID} acknowledged command ${CommandUUID}`);
      if (CommandUUID) {
        updateCommandStatus(UDID, CommandUUID, CommandStatus.ACKNOWLEDGED);
      }
      if (QueryResponses) {
        const existing = deviceMap.get(UDID) || {};
        // Update the Map with the new hardware details
        deviceMap.set(UDID, {
          ...existing,
          ...QueryResponses,
          lastSeen: new Date()
        });
        logger.info(`[Storage] Updated info for ${UDID}`);
      }
    }

    // Handle Error and CommandFormatError - mark as error and get next command
    if (Status === 'Error' || Status === 'CommandFormatError') {
      logger.error(`[MDM] Command ${CommandUUID} failed with status ${Status}`);
      if (CommandUUID) {
        updateCommandStatus(UDID, CommandUUID, CommandStatus.ERROR);
      }
    }

    // Try to send the next queued command (for all statuses except NotNow)
    // Status Idle is handle here 
    if(Status !== "NotNow"){
      const next = getNextCommand(UDID);
      if (next) {
        next.status = CommandStatus.SENT;
        const response = {
          Command: next.payload,
          CommandUUID: next.commandUUID
        };
        logger.info(`[MDM] Sending command ${next.commandUUID} to ${UDID}`);
        returnResponse = { xml: plist.build(response) };
      }
    }
    // No command in queue, device stays idle
    return returnResponse; // Send 200 OK to finish the loop
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
