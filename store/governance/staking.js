import Web3 from 'web3'
import { numberToHex, fromWei, toBN } from 'web3-utils'

import networkConfig from '../../networkConfig'

import TornadoStakingRewardsABI from '@/abis/TornadoStakingRewards.abi.json'
import { getErrorMessage } from '@/utils/stringUtils'

export const state = () => {
  return {
    accumulatedReward: '0',
    rewardContractBalance: '0',
    isCheckingReward: false
  }
}

export const getters = {
  stakingRewardsContract: (state, getters, rootState) => ({ netId }) => {
    const config = networkConfig[`netId${netId}`]
    const { url } = rootState.settings[`netId${netId}`].rpc
    const address = config['staking-rewards.contract.tornadocash.eth']

    if (address) {
      const web3 = new Web3(url)
      return new web3.eth.Contract(TornadoStakingRewardsABI, address)
    }

    return null
  },
  earnedReward: (state) => {
    return fromWei(state.accumulatedReward)
  },
  isRewardClaimable: (state) => {
    const reward = toBN(state.accumulatedReward)
    const contractBalance = toBN(state.rewardContractBalance)

    return !reward.isZero() && contractBalance.gte(reward)
  },
  hasRewardShortfall: (state) => {
    const reward = toBN(state.accumulatedReward)
    const contractBalance = toBN(state.rewardContractBalance)

    return !reward.isZero() && contractBalance.lt(reward)
  },
  reward: (state, getters) => {
    return getters.isRewardClaimable ? getters.earnedReward : '0'
  },
  isCheckingReward: (state) => {
    return state.isCheckingReward
  }
}

export const mutations = {
  SAVE_ACCUMULATED_REWARD(state, payload) {
    state.accumulatedReward = payload
  },
  SAVE_REWARD_CONTRACT_BALANCE(state, payload) {
    state.rewardContractBalance = payload
  },
  SAVE_CHECKING_REWARD(state, payload) {
    this._vm.$set(state, 'isCheckingReward', payload)
  }
}

export const actions = {
  async checkReward({ getters, rootGetters, rootState, commit }) {
    try {
      commit('SAVE_CHECKING_REWARD', true)

      const netId = rootGetters['metamask/netId']
      const { ethAccount } = rootState.metamask
      const stakingRewardsInstance = getters.stakingRewardsContract({ netId })

      if (!ethAccount || !stakingRewardsInstance) {
        commit('SAVE_ACCUMULATED_REWARD', '0')
        commit('SAVE_REWARD_CONTRACT_BALANCE', '0')
        return { reward: '0', contractBalance: '0' }
      }

      const tokenInstance = rootGetters['torn/tokenContract']
      const [reward, contractBalance] = await Promise.all([
        stakingRewardsInstance.methods.checkReward(ethAccount).call(),
        tokenInstance.methods.balanceOf(stakingRewardsInstance._address).call()
      ])

      commit('SAVE_ACCUMULATED_REWARD', reward)
      commit('SAVE_REWARD_CONTRACT_BALANCE', contractBalance)

      return { reward, contractBalance }
    } catch (err) {
      console.error('checkReward', err.message)
      commit('SAVE_ACCUMULATED_REWARD', '0')
      commit('SAVE_REWARD_CONTRACT_BALANCE', '0')
      return { reward: '0', contractBalance: '0' }
    } finally {
      commit('SAVE_CHECKING_REWARD', false)
    }
  },
  async claimReward({ getters, rootGetters, rootState, commit, dispatch }) {
    try {
      const netId = rootGetters['metamask/netId']
      const { ethAccount } = rootState.metamask
      const stakingRewardsInstance = getters.stakingRewardsContract({ netId })

      if (!stakingRewardsInstance) {
        return false
      }

      const { reward, contractBalance } = await dispatch('checkReward')

      if (toBN(reward).isZero()) {
        throw new Error(this.app.i18n.t('stakingReward.nothingToClaim'))
      }

      if (toBN(contractBalance).lt(toBN(reward))) {
        throw new Error(this.app.i18n.t('stakingReward.insufficientContractBalance'))
      }

      const data = await stakingRewardsInstance.methods.getReward().encodeABI()
      const gas = await stakingRewardsInstance.methods.getReward().estimateGas({ from: ethAccount, value: 0 })

      const currency = 'TORN'
      const amount = fromWei(reward)

      const callParams = {
        method: 'eth_sendTransaction',
        params: {
          to: stakingRewardsInstance._address,
          gas: numberToHex(gas + 100000),
          data
        },
        watcherParams: {
          title: {
            path: 'claiming',
            amount,
            currency
          },
          successTitle: {
            path: 'claimedValue',
            amount,
            currency
          },
          storeType: 'govTxs',
          onSuccess: () => {
            dispatch('torn/fetchTokenBalance', {}, { root: true })
            dispatch('checkReward')
          }
        },
        isSaving: false
      }

      const txHash = await dispatch('metamask/sendTransaction', callParams, { root: true })

      commit(
        'txHashKeeper/SAVE_TX_HASH',
        {
          txHash,
          storeType: 'govTxs',
          type: 'Reward',
          netId
        },
        { root: true }
      )
      return true
    } catch (err) {
      console.error('claimReward', err.message)
      dispatch(
        'notice/addNoticeWithInterval',
        {
          notice: {
            untranslatedTitle: getErrorMessage(err, this.app.i18n.t('internalError')),
            type: 'danger'
          },
          interval: 5000
        },
        { root: true }
      )
      return false
    }
  }
}
