import assert from 'assert'
import plist from 'plist'

import { DevicesIosCheckinService } from '../../../../../src/services/devices/ios/checkin/checkin.class'
import * as iosDeviceStore from '../../../../../src/services/devices/ios/ios-device-store'
import * as enrollmentTokens from '../../../../../src/services/devices/ios/enrollment/enrollment-token'

describe('DevicesIosCheckinService', () => {
  const deviceStoreMut = iosDeviceStore as unknown as Record<string, any>
  const enrollmentTokensMut = enrollmentTokens as unknown as Record<string, any>

  const originalGetDeviceByUdid = deviceStoreMut.getDeviceByUdid
  const originalMarkDeviceCheckedOut = deviceStoreMut.markDeviceCheckedOut
  const originalUpsertDevice = deviceStoreMut.upsertDevice
  const originalConsumeEnrollmentToken = enrollmentTokensMut.consumeEnrollmentToken

  const fakeKnexClient = {}
  const service = new DevicesIosCheckinService({
    app: {
      get(name: string) {
        if (name === 'knexClient') {
          return fakeKnexClient
        }

        return undefined
      }
    } as any
  })

  afterEach(() => {
    deviceStoreMut.getDeviceByUdid = originalGetDeviceByUdid
    deviceStoreMut.markDeviceCheckedOut = originalMarkDeviceCheckedOut
    deviceStoreMut.upsertDevice = originalUpsertDevice
    enrollmentTokensMut.consumeEnrollmentToken = originalConsumeEnrollmentToken
  })

  it('does not consume the enrollment token for checkout messages', async () => {
    let consumeCalled = false
    let checkedOutUdid: string | null = null
    let checkedOutPayload: any = null

    deviceStoreMut.getDeviceByUdid = async () => ({
      groupId: 42,
      enrollmentStatus: 'active'
    })
    deviceStoreMut.markDeviceCheckedOut = async (_knexClient: unknown, udid: string, payload: any) => {
      checkedOutUdid = udid
      checkedOutPayload = payload
      return true
    }
    enrollmentTokensMut.consumeEnrollmentToken = async () => {
      consumeCalled = true
      throw new Error('consumeEnrollmentToken should not be called for CheckOut')
    }

    const result = await service.update(
      null,
      plist.build({ MessageType: 'CheckOut', UDID: 'device-1' }),
      { query: { enrollmentToken: 'expired-token' } } as any
    )

    assert.deepStrictEqual(result, {})
    assert.strictEqual(consumeCalled, false)
    assert.strictEqual(checkedOutUdid, 'device-1')
    assert.strictEqual(checkedOutPayload?.MessageType, 'CheckOut')
    assert.strictEqual(checkedOutPayload?.groupId, 42)
  })

  it('still consumes the enrollment token for authenticate messages', async () => {
    let consumedArgs: { token: string; udid: string } | null = null
    let upsertCall: { udid: string; payload: any; options: any } | null = null

    deviceStoreMut.getDeviceByUdid = async () => null
    deviceStoreMut.upsertDevice = async (_knexClient: unknown, udid: string, payload: any, options: any) => {
      upsertCall = { udid, payload, options }
      return {}
    }
    enrollmentTokensMut.consumeEnrollmentToken = async (_knexClient: unknown, token: string, udid: string) => {
      consumedArgs = { token, udid }
      return 99
    }

    const result = await service.update(
      null,
      plist.build({ MessageType: 'Authenticate', UDID: 'device-2', Topic: 'topic-1' }),
      { query: { enrollmentToken: 'fresh-token' } } as any
    )

    assert.deepStrictEqual(result, {})
    assert.deepStrictEqual(consumedArgs, { token: 'fresh-token', udid: 'device-2' })
    assert.strictEqual(upsertCall?.udid, 'device-2')
    assert.strictEqual(upsertCall?.payload?.groupId, 99)
    assert.strictEqual(upsertCall?.options?.reactivateCheckedOut, true)
  })
})
