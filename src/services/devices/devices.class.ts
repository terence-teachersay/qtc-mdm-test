// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'

import type { Application } from '../../declarations'
import type { Devices, DevicesData, DevicesPatch, DevicesQuery } from './devices.schema'

export type { Devices, DevicesData, DevicesPatch, DevicesQuery }

export interface DevicesServiceOptions {
  app: Application
}

export interface DevicesParams extends Params<DevicesQuery> {}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class DevicesService<ServiceParams extends DevicesParams = DevicesParams> implements ServiceInterface<
  Devices,
  DevicesData,
  ServiceParams,
  DevicesPatch
> {
  
  private store = new Map<number, Devices>()
  private currentId = 0
  
  constructor(public options: DevicesServiceOptions) {}

  async find(_params?: ServiceParams): Promise<Devices[]> {
    return Array.from(this.store.values())
  }

  async get(id: Id, _params?: ServiceParams): Promise<Devices> {
    const numericId = Number(id)
    const item = this.store.get(numericId)
    if (!item) {
      throw new Error(`Device ${id} not found`)
    }
    return item
  }

  async create(data: DevicesData, params?: ServiceParams): Promise<Devices>
  async create(data: DevicesData[], params?: ServiceParams): Promise<Devices[]>
  async create(data: DevicesData | DevicesData[], params?: ServiceParams): Promise<Devices | Devices[]> {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)))
    }

    const id = ++this.currentId
    const device: Devices = {
      id,
      ...data
    } as Devices

    this.store.set(id, device)
    return device
  }

  // This method has to be added to the 'methods' option to make it available to clients
  async update(id: NullableId, data: DevicesData, _params?: ServiceParams): Promise<Devices> {
    return {
      id: 0,
      ...data
    }
  }

  async patch(id: NullableId, data: DevicesPatch, _params?: ServiceParams): Promise<Devices> {
    if (id == null) throw new Error('patch requires an id')
    const numericId = Number(id)
    const existing = await this.get(numericId)
    const updated = { ...existing, ...data } as Devices
    this.store.set(numericId, updated)
    return updated
  }

  async remove(id: NullableId, _params?: ServiceParams): Promise<Devices> {
    if (id == null) throw new Error('remove requires an id')
    const numericId = Number(id)
    const existing = await this.get(numericId)
    this.store.delete(numericId)
    return existing
  }
}

export const getOptions = (app: Application) => {
  return { app }
}
