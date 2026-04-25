import namehash from 'eth-ens-namehash'
import { BigNumber as BN } from 'bignumber.js'
import { toChecksumAddress } from 'web3-utils'

import networkConfig from '../../networkConfig'
import { graph } from '@/services'
import { REGISTRY_DEPLOYED_BLOCK } from '@/constants'

import AggregatorABI from '@/abis/Aggregator.abi.json'
import RelayerRegistryABI from '@/abis/RelayerRegistry.abi.json'

const MIN_STAKE_BALANCE = '0x22B1C8C1227A00000' // 40 TORN

const subdomains = Object.values(networkConfig).map(({ ensSubdomainKey }) => ensSubdomainKey)

class RelayerRegister {
  constructor(provider) {
    this.provider = provider
    this.$indexedDB = window.$nuxt.$indexedDB(1)

    const { registryContract, aggregatorContract } = networkConfig.netId1

    this.aggregator = new this.provider.Contract(AggregatorABI, aggregatorContract)
    this.relayerRegistry = new this.provider.Contract(RelayerRegistryABI, registryContract)
  }

  fetchEvents = async (fromBlock, toBlock) => {
    const isBlockRangeTooLargeError = (err) => {
      if (err?.code === -32062 || err?.data?.code === -32062) return true
      const message = (err?.message || err?.data?.message || '').toLowerCase()
      return (
        message.includes('block range is too large') ||
        message.includes('max block range') ||
        message.includes('maximum block range') ||
        message.includes('exceed maximum') ||
        message.includes('query returned more than')
      )
    }

    const defaultBlockRange = 500
    const minBlockRange = 25
    let currentBlockRange = defaultBlockRange
    let currentFrom = fromBlock
    const events = []

    while (currentFrom <= toBlock) {
      const currentTo = Math.min(currentFrom + currentBlockRange, toBlock)
      try {
        const part = await this.relayerRegistry.getPastEvents('RelayerRegistered', {
          fromBlock: currentFrom,
          toBlock: currentTo
        })
        if (part) events.push(...part)
        currentFrom = currentTo + 1
        currentBlockRange = defaultBlockRange
      } catch (err) {
        if (isBlockRangeTooLargeError(err) && currentBlockRange > minBlockRange) {
          currentBlockRange = Math.max(minBlockRange, Math.floor(currentBlockRange / 2))
          continue
        }
        if (currentBlockRange <= minBlockRange) {
          console.error(`fetchEvents chunk error: ${err.message}`)
          currentFrom = currentTo + 1
          continue
        }
        currentBlockRange = Math.max(minBlockRange, Math.floor(currentBlockRange / 2))
      }
    }

    return events
  }

  saveEvents = async ({ events, lastSyncBlock, storeName }) => {
    try {
      if (this.$indexedDB.isBlocked) {
        return
      }

      await this.$indexedDB.putItem({
        data: {
          blockNumber: lastSyncBlock,
          name: storeName
        },
        storeName: 'lastEvents'
      })

      if (events.length) {
        this.$indexedDB.createMultipleTransactions({ data: events, storeName })
      }
    } catch (err) {
      console.error(`saveEvents has error: ${err.message}`)
    }
  }

  getCachedData = async () => {
    let blockFrom = REGISTRY_DEPLOYED_BLOCK[1]

    try {
      const blockTo = await this.provider.getBlockNumber()

      const cachedEvents = await this.$indexedDB.getAll({
        storeName: 'register_events'
      })

      const lastBlock = await this.$indexedDB.getFromIndex({
        indexName: 'name',
        key: 'register_events',
        storeName: 'lastEvents'
      })

      if (lastBlock) {
        blockFrom = blockTo >= lastBlock.blockNumber ? lastBlock.blockNumber + 1 : blockTo
      }

      return { blockFrom, blockTo, cachedEvents }
    } catch {
      return { blockFrom, blockTo: 'latest', cachedEvents: [] }
    }
  }

  fetchRelayers = async () => {
    // eslint-disable-next-line prefer-const
    let { blockFrom, blockTo, cachedEvents } = await this.getCachedData()
    let allRelayers = cachedEvents

    if (blockFrom !== blockTo) {
      const registeredRelayersEvents = await graph.getAllRegisters(blockFrom)

      let relayers = {
        lastSyncBlock: registeredRelayersEvents.lastSyncBlock,
        events: registeredRelayersEvents.events.map((el) => ({
          ensName: el.ensName,
          relayerAddress: toChecksumAddress(el.address)
        }))
      }

      const isGraphLate = relayers.lastSyncBlock && blockTo > Number(relayers.lastSyncBlock)

      if (isGraphLate) {
        blockFrom = relayers.lastSyncBlock
      }

      if (!relayers.events.length || isGraphLate) {
        const multicallEvents = await this.fetchEvents(blockFrom, blockTo)
        const eventsRelayers = multicallEvents.map(({ returnValues }) => ({
          ensName: returnValues.ensName,
          relayerAddress: returnValues.relayerAddress
        }))

        relayers = {
          lastSyncBlock: blockTo,
          events: relayers.events.concat(eventsRelayers)
        }
      }

      await this.saveEvents({ storeName: 'register_events', ...relayers })
      allRelayers = allRelayers.concat(relayers.events)
    }

    return allRelayers
  }

  filterRelayer = (acc, curr, ensSubdomainKey, relayer) => {
    const subdomainIndex = subdomains.indexOf(ensSubdomainKey)

    const mainnetSubdomain = curr.records[0]
    const hostname = curr.records[subdomainIndex]
    const isHostWithProtocol = hostname.includes('http')

    const isOwner = relayer.relayerAddress === curr.owner
    const hasMinBalance = new BN(curr.balance).gte(MIN_STAKE_BALANCE)

    if (
      hostname &&
      isOwner &&
      mainnetSubdomain &&
      curr.isRegistered &&
      hasMinBalance &&
      !isHostWithProtocol
    ) {
      acc.push({
        hostname,
        ensName: relayer.ensName,
        stakeBalance: curr.balance,
        relayerAddress: relayer.relayerAddress
      })
    } else {
      console.error(`${relayer.ensName} invalid: `, {
        isOwner,
        hasTXT: Boolean(hostname),
        isHasMinBalance: hasMinBalance,
        isRegistered: curr.isRegistered,
        isHostWithoutProtocol: !isHostWithProtocol,
        isMainnetSubdomain: Boolean(mainnetSubdomain)
      })
    }

    return acc
  }

  getValidRelayers = async (relayers, ensSubdomainKey) => {
    const relayerNameHashes = relayers.map((r) => namehash.hash(r.ensName))

    const relayersData = await this.aggregator.methods.relayersData(relayerNameHashes, subdomains).call()

    const validRelayers = relayersData.reduce(
      (acc, curr, index) => this.filterRelayer(acc, curr, ensSubdomainKey, relayers[index]),
      []
    )

    return validRelayers
  }

  getRelayers = async (ensSubdomainKey) => {
    const relayers = await this.fetchRelayers()

    const validRelayers = await this.getValidRelayers(relayers, ensSubdomainKey)

    return validRelayers
  }
}

export const relayerRegisterService = (provider) => new RelayerRegister(provider.eth)
