import networkConfig from '../../networkConfig'
import { actions, getters, state } from './staking'

describe('governance staking rewards', () => {
  it('uses the current Ethereum staking rewards contract', () => {
    expect(networkConfig.netId1['staking-rewards.contract.tornadocash.eth']).toBe(
      '0x5B3f656C80E8ddb9ec01Dd9018815576E9238c29'
    )
  })

  it('exposes a reward only when the staking contract can pay it in full', () => {
    const stakingState = {
      ...state(),
      accumulatedReward: '1000000000000000000',
      rewardContractBalance: '1000000000000000000'
    }
    const computed = {
      earnedReward: getters.earnedReward(stakingState),
      isRewardClaimable: getters.isRewardClaimable(stakingState)
    }

    expect(computed.isRewardClaimable).toBe(true)
    expect(getters.reward(stakingState, computed)).toBe('1')
    expect(getters.hasRewardShortfall(stakingState)).toBe(false)
  })

  it('hides an unpayable reward and reports a contract balance shortfall', () => {
    const stakingState = {
      ...state(),
      accumulatedReward: '1000000000000000000',
      rewardContractBalance: '0'
    }
    const computed = {
      earnedReward: getters.earnedReward(stakingState),
      isRewardClaimable: getters.isRewardClaimable(stakingState)
    }

    expect(computed.isRewardClaimable).toBe(false)
    expect(getters.reward(stakingState, computed)).toBe('0')
    expect(getters.hasRewardShortfall(stakingState)).toBe(true)
  })

  it('checks both the account reward and the reward contract TORN balance', async () => {
    const checkReward = jest.fn().mockReturnValue({ call: jest.fn().mockResolvedValue('25') })
    const balanceOf = jest.fn().mockReturnValue({ call: jest.fn().mockResolvedValue('100') })
    const commit = jest.fn()
    const stakingRewardsInstance = {
      _address: '0x0000000000000000000000000000000000000001',
      methods: { checkReward }
    }

    const result = await actions.checkReward({
      getters: { stakingRewardsContract: () => stakingRewardsInstance },
      rootGetters: {
        'metamask/netId': 1,
        'torn/tokenContract': { methods: { balanceOf } }
      },
      rootState: { metamask: { ethAccount: '0x0000000000000000000000000000000000000002' } },
      commit
    })

    expect(checkReward).toHaveBeenCalledWith('0x0000000000000000000000000000000000000002')
    expect(balanceOf).toHaveBeenCalledWith(stakingRewardsInstance._address)
    expect(result).toEqual({ reward: '25', contractBalance: '100' })
    expect(commit).toHaveBeenCalledWith('SAVE_ACCUMULATED_REWARD', '25')
    expect(commit).toHaveBeenCalledWith('SAVE_REWARD_CONTRACT_BALANCE', '100')
  })

  it('keeps the full precision of a small reward in claim notifications', async () => {
    const getReward = jest.fn().mockReturnValue({
      encodeABI: jest.fn().mockReturnValue('0xclaim'),
      estimateGas: jest.fn().mockResolvedValue(100000)
    })
    const stakingRewardsInstance = {
      _address: '0x5B3f656C80E8ddb9ec01Dd9018815576E9238c29',
      methods: { getReward }
    }
    const dispatch = jest.fn((type) => {
      if (type === 'checkReward') {
        return Promise.resolve({
          reward: '60972203765532',
          contractBalance: '438134296722282380635625'
        })
      }
      if (type === 'metamask/sendTransaction') {
        return Promise.resolve('0xhash')
      }
      return Promise.resolve()
    })

    const result = await actions.claimReward({
      getters: { stakingRewardsContract: () => stakingRewardsInstance },
      rootGetters: { 'metamask/netId': 1 },
      rootState: { metamask: { ethAccount: '0x0000000000000000000000000000000000000002' } },
      commit: jest.fn(),
      dispatch
    })

    const sendTransactionCall = dispatch.mock.calls.find(([type]) => type === 'metamask/sendTransaction')
    const { watcherParams } = sendTransactionCall[1]

    expect(result).toBe(true)
    expect(watcherParams.title.amount).toBe('0.000060972203765532')
    expect(watcherParams.successTitle.amount).toBe('0.000060972203765532')
  })
})
