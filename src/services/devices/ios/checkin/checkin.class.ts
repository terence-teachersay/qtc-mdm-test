// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import type { Application } from '../../../../declarations'
import type { DevicesIosCheckin, DevicesIosCheckinData, DevicesIosCheckinPatch, DevicesIosCheckinQuery} from './checkin.schema'
import plist from 'plist'
import { deviceMap } from '../ios-device-store'
import { logger } from '../../../../logger'

export type { DevicesIosCheckin, DevicesIosCheckinData, DevicesIosCheckinPatch, DevicesIosCheckinQuery }

export interface DevicesIosCheckinServiceOptions {
  app: Application
}

export interface DevicesIosCheckinParams extends Params<DevicesIosCheckinQuery> {}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class DevicesIosCheckinService<
  ServiceParams extends DevicesIosCheckinParams = DevicesIosCheckinParams
> implements ServiceInterface<
  DevicesIosCheckin,
  DevicesIosCheckinData,
  ServiceParams,
  DevicesIosCheckinPatch
> {
  constructor(public options: DevicesIosCheckinServiceOptions) {}

  async find(_params?: ServiceParams): Promise<DevicesIosCheckin[]> {
    throw new Error('Method not allowed');
  }

  async get(id: Id, _params?: ServiceParams): Promise<DevicesIosCheckin> {
    throw new Error('Method not allowed');
  }

  async create(data: DevicesIosCheckinData, params?: ServiceParams): Promise<DevicesIosCheckin>
  async create(data: DevicesIosCheckinData[], params?: ServiceParams): Promise<DevicesIosCheckin[]>
  async create(
    data: DevicesIosCheckinData | DevicesIosCheckinData[],
    params?: ServiceParams
  ): Promise<DevicesIosCheckin | DevicesIosCheckin[]> {
    throw new Error('Method not allowed');
  }

  /**
   * Handle Device Check in for auth, token update and check out
   * @param id 
   * @param data 
   * @param params 
   * @returns 
   */
  async update(id: NullableId, data: any, params?: ServiceParams): Promise<any> {
      // already bodyParser.text the data in app.ts, 'data' is now the raw XML string
      const msg: any = plist.parse(data);

      const { MessageType, UDID } = msg;
      logger.info(`MDM Checkin`, msg);  

      //Handle different incoming message
      switch (MessageType) {
        //TODO need to really authenticate the device. Now we just upsert the device info into the Map without any authentication.
        //Need to check if the device is already register under other organization.
        case 'Authenticate':
          this.upsertDevice(UDID, msg);
          break;
        case 'TokenUpdate':
          this.upsertDevice(UDID, msg);
          break;
        case 'CheckOut':
          deviceMap.delete(UDID);
          logger.info(`Device checked out`, { UDID });
          break;
        default:
          logger.error("Unknown Check in Message Type", MessageType)
          //TODO: Need to link this to Google chat or alert channel
          break;  
      }

      return {};
  }
  
  /**
   * Helper to update or insert device info into the Map
   */
  private upsertDevice(udid: string, info: any) {
    const existing = deviceMap.get(udid) || {};
    
    // Merge existing data with new info and update timestamp
    deviceMap.set(udid, {
      ...existing,
      ...info,
      lastSeen: new Date()
    });
  }

  async patch(
    id: NullableId,
    data: DevicesIosCheckinPatch,
    _params?: ServiceParams
  ): Promise<DevicesIosCheckin> {
    throw new Error('Method not allowed');
  }

  async remove(id: NullableId, _params?: ServiceParams): Promise<DevicesIosCheckin> {
    throw new Error('Method not allowed');
  }
}

export const getOptions = (app: Application) => {
  return { app }
}
