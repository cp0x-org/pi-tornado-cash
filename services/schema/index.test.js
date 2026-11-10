import schema from './index'

const NET_IDS = [1, 5, 10, 56, 100, 137, 42161, 43114]

describe('relayer status schema (ajv)', () => {
  it('compiles a validator for every supported network', () => {
    for (const netId of NET_IDS) {
      const validate = schema.getRelayerValidateFunction(netId)
      expect(typeof validate).toBe('function')
    }
  })

  it('rejects an empty relayer status', () => {
    const validate = schema.getRelayerValidateFunction(1)

    expect(validate({})).toBe(false)
    expect(validate.errors.map((e) => e.params.missingProperty)).toEqual(
      expect.arrayContaining(['rewardAccount', 'instances', 'netId'])
    )
  })

  it('applies the custom BN keyword to eth prices', () => {
    const validate = schema.getRelayerValidateFunction(1)
    const status = {
      rewardAccount: '0x0000000000000000000000000000000000000001',
      instances: {
        eth: {
          instanceAddress: {
            0.1: '0x0000000000000000000000000000000000000002',
            1: '0x0000000000000000000000000000000000000003',
            10: '0x0000000000000000000000000000000000000004',
            100: '0x0000000000000000000000000000000000000005'
          },
          decimals: 18
        }
      },
      netId: 1,
      ethPrices: { dai: '1', cdai: '1', usdc: '1', usdt: '1', torn: '1', wbtc: 'not-a-number' },
      tornadoServiceFee: 0.5,
      version: '4.0.0',
      health: { status: 'true' }
    }

    expect(validate(status)).toBe(false)
    expect(validate.errors.some((e) => e.keyword === 'BN' && e.instancePath === '/ethPrices/wbtc')).toBe(true)

    status.ethPrices.wbtc = '1000000000000000000'
    expect(validate(status)).toBe(true)
  })
})
