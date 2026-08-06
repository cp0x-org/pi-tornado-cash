/* eslint-disable no-console */
import Web3 from 'web3'

import networkConfig from '../networkConfig'

const GOVERNANCE_VERSION_SELECTOR = '0x54fd4d50'
const RPC_CHECK_ACCOUNT = '0x0000000000000000000000000000000000000001'

const getFirstRpcs = (acc, [netId, { rpcUrls }]) => {
  const [rpc] = Object.values(rpcUrls)

  acc[netId] = {
    rpc
  }

  return acc
}

const rpcData = Object.entries(networkConfig).reduce(getFirstRpcs, {})

export const state = () => {
  return {
    ...rpcData,
    isActiveNotification: {
      first: true,
      second: true,
      third: true
    }
  }
}

export const getters = {
  getRpc: (state) => (netId) => {
    return state[`netId${netId}`].rpc
  },
  currentRpc: (state, getters, rootState) => {
    const netId = rootState.metamask.netId
    return state[`netId${netId}`].rpc
  }
}

export const mutations = {
  SAVE_RPC(state, { netId, name, url }) {
    this._vm.$set(state[`netId${netId}`], 'rpc', { name, url })
  },
  DISABLE_NOTIFICATION(state, { key }) {
    this._vm.$set(state, 'isActiveNotification', { ...state.isActiveNotification, [key]: false })
  }
}

export const actions = {
  disableNotification({ commit }, params) {
    commit('DISABLE_NOTIFICATION', params)
  },
  async checkCurrentRpc({ dispatch, getters, rootGetters }) {
    const netId = rootGetters['metamask/netId']
    await dispatch('preselectRpc', { netId })
  },
  async preselectRpc({ getters, commit, dispatch }, { netId }) {
    const savedRpc = getters.getRpc(netId)
    const { isValid } = await dispatch('checkRpc', { ...savedRpc, netId })

    if (isValid) {
      return
    }

    const { rpcUrls } = networkConfig[`netId${netId}`]

    for (const [, { name, url }] of Object.entries(rpcUrls)) {
      const { isValid, error } = await dispatch('checkRpc', { url, netId })
      if (isValid) {
        commit('SAVE_RPC', { netId, name, url })
        return
      } else {
        console.error('preselectRpc', url, error)
      }
    }
    throw new Error(this.app.i18n.t('rpcSelectError'))
  },
  async checkRpc(_, { url, netId }) {
    try {
      const web3 = new Web3(url)

      const [chainId] = await Promise.all([web3.eth.getChainId(), web3.eth.getBlockNumber()])

      const isCurrent = Number(chainId) === Number(netId)
      if (!isCurrent) {
        return { isValid: false, error: this.app.i18n.t('thisRpcIsForDifferentNetwork') }
      }

      const governanceAddress = networkConfig[`netId${netId}`]['governance.contract.tornadocash.eth']

      if (governanceAddress) {
        await web3.eth.estimateGas({
          from: RPC_CHECK_ACCOUNT,
          to: governanceAddress,
          data: GOVERNANCE_VERSION_SELECTOR
        })
      }

      return { isValid: true }
    } catch (e) {
      console.error('checkRpc', e)
      return { isValid: false, error: this.app.i18n.t('rpcIsDown') }
    }
  }
}
