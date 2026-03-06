// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'
import type { Application } from '../../../../declarations'
import type { DevicesIosCheckin, DevicesIosCheckinData, DevicesIosCheckinPatch, DevicesIosCheckinQuery} from './checkin.schema'
import plist from 'plist'
import { deviceMap } from '../../../../device-store'

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

      console.log(`[MDM Checkin] Correctly Parsed: ${MessageType} from ${UDID}`);

      //Handle different incoming message
      switch (MessageType) {
        //TODO need to really authenticate the device. Now we just upsert the device info into the Map without any authentication.
        case 'Authenticate':
          this.upsertDevice(UDID, msg);
          break;
        case 'TokenUpdate':
          this.upsertDevice(UDID, msg);
          break;
        case 'CheckOut':
          //TODO need to handle check out as well.
          break;
        default:
          //TODO need to handle unknon message type.
          //Throw a system 500 error.
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

    console.log(`[Storage] Active devices in Map: ${deviceMap.size}`);
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
