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
import type { Knex } from 'knex'
import { getDeviceByUdid, updateDeviceInventory } from '../ios-device-store'
import { logger } from '../../../../logger';
import { MethodNotAllowed } from '@feathersjs/errors'
import { CommandStatus, getNextCommand, updateCommandStatus } from '../command-queue';

export type { DevicesIosServer, DevicesIosServerData, DevicesIosServerPatch, DevicesIosServerQuery }

export interface DevicesIosServerServiceOptions {
  app: Application
}

export interface DevicesIosServerParams extends Params<DevicesIosServerQuery> {}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class DevicesIosServerService<
  ServiceParams extends DevicesIosServerParams = DevicesIosServerParams
> implements ServiceInterface<DevicesIosServer, DevicesIosServerData, ServiceParams, DevicesIosServerPatch> {
  /** Initialize the MDM server service. */
  constructor(public options: DevicesIosServerServiceOptions) {}

  private get knexClient(): Knex {
    return this.options.app.get('knexClient')
  }

  async find(params?: Params): Promise<any> {
    throw new MethodNotAllowed('Method not allowed');
  }

  async get(id: Id, _params?: ServiceParams): Promise<DevicesIosServer> {
    throw new MethodNotAllowed('Method not allowed');
  }

  async create(data: any, params?: Params): Promise<any> {
    throw new MethodNotAllowed('Method not allowed');
  }

  /** Process device command-loop requests and return the next command payload. */
  async update(id: NullableId, data: any, params?: Params): Promise<any> {
    const msg: any = plist.parse(data);
    const { Status, UDID, CommandUUID, QueryResponses } = msg;
    const existingDevice = UDID ? await getDeviceByUdid(this.knexClient, UDID) : null
    const isActiveDevice = existingDevice?.enrollmentStatus === 'active'

    logger.info('[Endpoint START]', {
      endpoint: 'devices/ios/server UPDATE',
      id,
      query: params?.query || null,
      input: {
        rawBodyLength: typeof data === 'string' ? data.length : undefined,
        status: Status || null,
        udid: UDID || null,
        commandUUID: CommandUUID || null,
        hasQueryResponses: Boolean(QueryResponses)
      }
    });

    let returnResponse = {}

    // Handle NotNow - keep command in queue for later retry
    if (Status === 'NotNow' && CommandUUID && isActiveDevice) {
      await updateCommandStatus(this.knexClient, UDID, CommandUUID, CommandStatus.NOT_NOW, {
        responsePayload: msg
      });
    }

    // Handle Acknowledged - mark as done and get next command
    if (Status === 'Acknowledged') {
      if (CommandUUID && isActiveDevice) {
        await updateCommandStatus(this.knexClient, UDID, CommandUUID, CommandStatus.ACKNOWLEDGED, {
          responsePayload: msg
        });
      }
      if (QueryResponses && isActiveDevice) {
        await updateDeviceInventory(this.knexClient, UDID, QueryResponses);
      }
      if (CommandUUID && isActiveDevice) {
        await updateCommandStatus(this.knexClient, UDID, CommandUUID, CommandStatus.COMPLETED, {
          responsePayload: msg
        });
      }
    }

    // Handle Error and CommandFormatError - mark as error and get next command
    if (Status === 'Error' || Status === 'CommandFormatError') {
      logger.error(`[MDM] Command ${CommandUUID} failed with status ${Status}`);
      if (CommandUUID && isActiveDevice) {
        await updateCommandStatus(this.knexClient, UDID, CommandUUID, CommandStatus.FAILED, {
          responsePayload: msg,
          errorMessage: `Device returned status ${Status}`
        });
      }
    }

    // Try to send the next queued command (for all statuses except NotNow)
    // Status Idle is handle here 
    if(Status !== "NotNow" && isActiveDevice){
      const next = await getNextCommand(this.knexClient, UDID);
      if (next) {
        await updateCommandStatus(this.knexClient, UDID, next.commandUUID, CommandStatus.SENT, {
          responsePayload: {
            Status: 'Sent',
            CommandUUID: next.commandUUID
          }
        });
        const response = {
          Command: next.payload,
          CommandUUID: next.commandUUID
        };
        returnResponse = { xml: plist.build(response) };
      }
    }

    if (!isActiveDevice && existingDevice) {
      logger.info('[MDM] Ignoring late server update for non-active device', {
        udid: UDID,
        enrollmentStatus: existingDevice.enrollmentStatus,
        status: Status || null,
        commandUUID: CommandUUID || null
      })
    }

    logger.info('[Endpoint END]', {
      endpoint: 'devices/ios/server UPDATE',
      id,
      result: {
        status: Status,
        udid: UDID,
        hasResponseXml: Boolean((returnResponse as any)?.xml)
      }
    });

    // No command in queue, device stays idle
    return returnResponse; // Send 200 OK to finish the loop
  }

  async patch(
    id: NullableId,
    data: DevicesIosServerPatch,
    _params?: ServiceParams
  ): Promise<DevicesIosServer> {
    throw new MethodNotAllowed('Method not allowed');
  }

  async remove(id: NullableId, _params?: ServiceParams): Promise<DevicesIosServer> {
    throw new MethodNotAllowed('Method not allowed');
  }
}

export const getOptions = (app: Application) => {
  return { app }
}
