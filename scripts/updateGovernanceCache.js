import 'dotenv/config'

import fs from 'fs'
import path from 'path'
import Web3 from 'web3'

import networkConfig from '../networkConfig'
import GovernanceABI from '../abis/Governance.abi.json'

const CACHE_DIR = './static/governance-cache'
const DEFAULT_BLOCK_RANGE = 20000
const MIN_BLOCK_RANGE = 25
const MAX_BLOCK_RANGE = 120000
const TRANSIENT_RETRIES = 3
const EVENTS = ['ProposalCreated', 'Delegated', 'Undelegated', 'Voted']

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isBlockRangeTooLargeError = (error) => {
  const message = ((error && error.message) || '').toLowerCase()

  return (
    message.includes('block range is too large') ||
    message.includes('max block range') ||
    message.includes('maximum block range') ||
    message.includes('exceed maximum')
  )
}

function getNetId() {
  const netIdFromArg = process.argv
    .slice(2)
    .find((arg) => arg && !arg.startsWith('-') && Number.isFinite(Number(arg)))

  return String(netIdFromArg || '1')
}

function getRpcUrl(config) {
  if (config && config.rpcUrls && Object.keys(config.rpcUrls).length) {
    const [{ url }] = Object.values(config.rpcUrls)
    return url
  }

  if (config && config.rpc && config.rpc.url) {
    return config.rpc.url
  }

  throw new Error('RPC url not found in network config')
}

function normalizeEvent(eventName, event) {
  const blockNumber = Number(event.blockNumber)
  const logIndex = Number(event.logIndex)
  const transactionHash = event.transactionHash
  const returnValues = event.returnValues || {}

  switch (eventName) {
    case 'ProposalCreated':
      return {
        blockNumber,
        logIndex,
        transactionHash,
        returnValues: {
          id: returnValues.id,
          proposer: returnValues.proposer,
          target: returnValues.target,
          startTime: returnValues.startTime,
          endTime: returnValues.endTime,
          description: returnValues.description
        }
      }
    case 'Delegated':
      return {
        blockNumber,
        logIndex,
        transactionHash,
        returnValues: {
          account: returnValues.account,
          to: returnValues.to
        }
      }
    case 'Undelegated':
      return {
        blockNumber,
        logIndex,
        transactionHash,
        returnValues: {
          account: returnValues.account,
          from: returnValues.from
        }
      }
    case 'Voted':
      return {
        blockNumber,
        logIndex,
        transactionHash,
        returnValues: {
          proposalId: returnValues.proposalId,
          voter: returnValues.voter,
          support: returnValues.support,
          votes: returnValues.votes
        }
      }
    default:
      return {
        blockNumber,
        logIndex,
        transactionHash,
        returnValues
      }
  }
}

function createEventKey(event) {
  return `${event.transactionHash}:${event.logIndex}:${event.blockNumber}`
}

function mergeEvents(existingEvents, freshEvents) {
  const uniq = new Map()

  existingEvents.forEach((event) => {
    uniq.set(createEventKey(event), event)
  })

  freshEvents.forEach((event) => {
    uniq.set(createEventKey(event), event)
  })

  return Array.from(uniq.values()).sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber
    }

    return a.logIndex - b.logIndex
  })
}

function createDefaultCache({ netId, governanceAddress, fromBlock }) {
  const sync = EVENTS.reduce((acc, eventName) => {
    acc[eventName] = fromBlock - 1
    return acc
  }, {})

  return {
    version: 1,
    netId: Number(netId),
    governanceAddress,
    fromBlock,
    lastBlock: fromBlock - 1,
    updatedAt: new Date(0).toISOString(),
    sync,
    events: {
      ProposalCreated: [],
      Delegated: [],
      Undelegated: [],
      Voted: []
    }
  }
}

function loadCache({ filePath, defaultCache }) {
  if (!fs.existsSync(filePath)) {
    return defaultCache
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)

    return {
      ...defaultCache,
      ...parsed,
      sync: {
        ...defaultCache.sync,
        ...(parsed.sync || {})
      },
      events: {
        ...defaultCache.events,
        ...(parsed.events || {})
      }
    }
  } catch {
    return defaultCache
  }
}

function persistCache({ filePath, cache }) {
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2) + '\n')
}

async function getPastEventsChunked({ contract, eventName, fromBlock, toBlock }) {
  let currentFromBlock = Number(fromBlock)
  let currentBlockRange = DEFAULT_BLOCK_RANGE
  let retries = 0
  let successStreak = 0
  const events = []

  while (currentFromBlock <= toBlock) {
    const currentToBlock = Math.min(currentFromBlock + currentBlockRange, toBlock)

    try {
      const part = await contract.getPastEvents(eventName, {
        fromBlock: currentFromBlock,
        toBlock: currentToBlock
      })

      if (part && part.length) {
        events.push(...part.map((event) => normalizeEvent(eventName, event)))
      }

      const donePercent = (((currentToBlock - fromBlock + 1) / (toBlock - fromBlock + 1)) * 100).toFixed(2)

      console.log(
        `[${eventName}] chunk ${currentFromBlock}-${currentToBlock} done, total=${events.length}, progress=${donePercent}%`
      )

      currentFromBlock = currentToBlock + 1
      retries = 0
      successStreak += 1

      if (successStreak >= 4 && currentBlockRange < MAX_BLOCK_RANGE) {
        currentBlockRange = Math.min(MAX_BLOCK_RANGE, currentBlockRange * 2)
        successStreak = 0
      }
    } catch (error) {
      if (isBlockRangeTooLargeError(error) && currentBlockRange > MIN_BLOCK_RANGE) {
        currentBlockRange = Math.max(MIN_BLOCK_RANGE, Math.floor(currentBlockRange / 2))
        successStreak = 0
        console.log(`[${eventName}] reduce block range to ${currentBlockRange}`)
        continue
      }

      if (retries < TRANSIENT_RETRIES) {
        retries += 1
        console.log(`[${eventName}] retry ${retries}/${TRANSIENT_RETRIES}: ${error.message}`)
        await sleep(500)
        continue
      }

      throw error
    }
  }

  return events
}

async function main() {
  const netId = getNetId()
  const config = networkConfig[`netId${netId}`]

  if (!config) {
    throw new Error(`Network netId${netId} is not found in networkConfig`)
  }

  const governanceAddress = config['governance.contract.tornadocash.eth']
  const governanceBlock = Number(config && config.constants && config.constants.GOVERNANCE_BLOCK)

  if (!governanceAddress || !Number.isFinite(governanceBlock)) {
    throw new Error(`Network netId${netId} does not have governance address or GOVERNANCE_BLOCK`)
  }

  const rpcUrl = getRpcUrl(config)

  const web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl))
  const contract = new web3.eth.Contract(GovernanceABI, governanceAddress)
  const currentBlock = await web3.eth.getBlockNumber()

  fs.mkdirSync(CACHE_DIR, { recursive: true })

  const filePath = path.resolve(`${CACHE_DIR}/netId${netId}.json`)
  const defaultCache = createDefaultCache({
    netId,
    governanceAddress,
    fromBlock: governanceBlock
  })
  const cache = loadCache({
    filePath,
    defaultCache
  })

  console.log(`Governance cache update started for netId=${netId}`)
  console.log(`RPC: ${rpcUrl}`)
  console.log(`Governance contract: ${governanceAddress}`)
  console.log(`To block: ${currentBlock}`)

  for await (const eventName of EVENTS) {
    const syncedBlock = Number(cache.sync[eventName])
    const eventStartBlock = Math.max(
      Number.isFinite(syncedBlock) ? syncedBlock + 1 : governanceBlock,
      governanceBlock
    )

    console.log(`[${eventName}] from block: ${eventStartBlock}`)

    if (eventStartBlock <= currentBlock) {
      const freshEvents = await getPastEventsChunked({
        contract,
        eventName,
        fromBlock: eventStartBlock,
        toBlock: currentBlock
      })

      cache.events[eventName] = mergeEvents(cache.events[eventName] || [], freshEvents)
      cache.sync[eventName] = currentBlock
      console.log(`[${eventName}] saved total: ${cache.events[eventName].length}`)
    } else {
      console.log(`[${eventName}] already up to date`)
    }

    const syncedBlocks = EVENTS.map((name) => Number(cache.sync[name])).filter((value) =>
      Number.isFinite(value)
    )

    cache.netId = Number(netId)
    cache.governanceAddress = governanceAddress
    cache.fromBlock = governanceBlock
    cache.lastBlock = syncedBlocks.length ? Math.min(...syncedBlocks) : governanceBlock - 1
    cache.updatedAt = new Date().toISOString()

    persistCache({ filePath, cache })
    console.log(`[${eventName}] persisted to file: ${filePath}`)
  }

  console.log(`Cache file updated: ${filePath}`)
}

main().catch((error) => {
  console.error('updateGovernanceCache failed:', error)
  process.exit(1)
})
