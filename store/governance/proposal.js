/* eslint-disable no-console */
/* eslint-disable import/order */

import { utils } from 'ethers'
import uniqBy from 'lodash/uniqBy'
import chunk from 'lodash/chunk'

import { lookupAddresses, createBatchRequestCallback } from '@/services'
import { CHUNK_COUNT_PER_BATCH_REQUEST } from '@/constants'
import { getGovernanceEventsFromCache } from '@/services/governanceCache'

const { toWei, fromWei, toBN } = require('web3-utils')
const DEFAULT_LOG_BLOCK_RANGE = 1000
const MIN_LOG_BLOCK_RANGE = 25
const TRANSIENT_RETRIES = 2

const CACHE_TX = {}
const CACHE_BLOCK = {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isBlockRangeTooLargeError = (err) => {
  const message = (err?.message || '').toLowerCase()

  return (
    message.includes('block range is too large') ||
    message.includes('max block range') ||
    message.includes('maximum block range') ||
    message.includes('exceed maximum')
  )
}

async function getPastEventsChunked({
  contract,
  web3,
  eventName,
  fromBlock,
  toBlock = 'latest',
  filter,
  blockRange = DEFAULT_LOG_BLOCK_RANGE
}) {
  const resolvedToBlock = toBlock === 'latest' ? await web3.eth.getBlockNumber() : Number(toBlock)
  let currentFromBlock = Number(fromBlock)
  let currentBlockRange = blockRange
  const events = []
  let retries = 0

  if (
    !Number.isFinite(currentFromBlock) ||
    !Number.isFinite(resolvedToBlock) ||
    currentFromBlock > resolvedToBlock
  ) {
    return events
  }

  while (currentFromBlock <= resolvedToBlock) {
    const currentToBlock = Math.min(currentFromBlock + currentBlockRange, resolvedToBlock)
    const params = {
      fromBlock: currentFromBlock,
      toBlock: currentToBlock
    }

    if (filter) {
      params.filter = filter
    }

    try {
      const part = await contract.getPastEvents(eventName, params)
      if (part?.length) {
        events.push(...part)
      }

      currentFromBlock = currentToBlock + 1
      retries = 0
    } catch (err) {
      if (isBlockRangeTooLargeError(err) && currentBlockRange > MIN_LOG_BLOCK_RANGE) {
        currentBlockRange = Math.max(MIN_LOG_BLOCK_RANGE, Math.floor(currentBlockRange / 2))
        continue
      }

      if (retries < TRANSIENT_RETRIES) {
        retries += 1
        await sleep(300)
        continue
      }

      throw err
    }
  }

  return events
}

async function getPastEventsCachedAndChunked({
  netId,
  contract,
  web3,
  eventName,
  fromBlock,
  toBlock = 'latest',
  filter,
  blockRange = DEFAULT_LOG_BLOCK_RANGE
}) {
  const resolvedToBlock = toBlock === 'latest' ? await web3.eth.getBlockNumber() : Number(toBlock)
  const normalizedFromBlock = Number(fromBlock)

  if (
    !Number.isFinite(normalizedFromBlock) ||
    !Number.isFinite(resolvedToBlock) ||
    normalizedFromBlock > resolvedToBlock
  ) {
    return []
  }

  const { events: cachedEvents, cacheLastBlock } = await getGovernanceEventsFromCache({
    netId,
    eventName,
    fromBlock: normalizedFromBlock,
    toBlock: resolvedToBlock,
    filter
  })

  let rpcFromBlock = normalizedFromBlock

  if (Number.isFinite(cacheLastBlock)) {
    rpcFromBlock = Math.max(rpcFromBlock, Number(cacheLastBlock) + 1)
  }

  let rpcEvents = []

  if (rpcFromBlock <= resolvedToBlock) {
    rpcEvents = await getPastEventsChunked({
      contract,
      web3,
      eventName,
      fromBlock: rpcFromBlock,
      toBlock: resolvedToBlock,
      filter,
      blockRange
    })
  }

  return cachedEvents.concat(rpcEvents)
}

const parseComment = (calldata, govInstance) => {
  const empty = { contact: '', message: '' }
  if (!calldata || !govInstance) return empty

  const methodLength = 4 // length of castDelegatedVote method
  const result = utils.defaultAbiCoder.decode(
    ['address[]', 'uint256', 'bool'],
    utils.hexDataSlice(calldata, methodLength)
  )
  const data = govInstance.methods.castDelegatedVote(...result).encodeABI()
  const dataLength = utils.hexDataLength(data)

  try {
    const str = utils.defaultAbiCoder.decode(['string'], utils.hexDataSlice(calldata, dataLength))
    const [contact, message] = JSON.parse(str)
    return { contact, message }
  } catch {
    return empty
  }
}

const createProposalComment = (resultAll, votedEvent) => {
  const { transactionHash, returnValues, blockNumber } = votedEvent
  const { voter } = returnValues

  const comment = parseComment()

  const percentage =
    toBN(votedEvent.returnValues.votes)
      .mul(toBN(10000))
      .divRound(resultAll)
      .toNumber() / 100

  return {
    id: `${transactionHash}-${voter}`,
    percentage,
    ...returnValues,
    votes: fromWei(returnValues.votes),
    transactionHash,
    blockNumber,

    ...comment,

    ens: {
      delegator: null,
      voter: null
    },
    delegator: null,
    timestamp: null
  }
}

const createFetchCommentWithMessage = (web3, batch, govInstance) => async (proposalComment) => {
  const { transactionHash, voter, blockNumber } = proposalComment

  if (!CACHE_TX[transactionHash]) {
    CACHE_TX[transactionHash] = new Promise((resolve, reject) => {
      const callback = createBatchRequestCallback(resolve, reject)
      batch.add(web3.eth.getTransaction.request(transactionHash, callback))
    })
  }

  if (!CACHE_BLOCK[blockNumber]) {
    CACHE_BLOCK[blockNumber] = new Promise((resolve, reject) => {
      const callback = createBatchRequestCallback(resolve, reject)
      batch.add(web3.eth.getBlock.request(blockNumber, callback))
    })
  }

  try {
    const [tx, blockInfo] = await Promise.all([CACHE_TX[transactionHash], CACHE_BLOCK[blockNumber]])

    const isMaybeHasComment = voter === tx.from
    const comment = parseComment(isMaybeHasComment ? tx.input : null, govInstance)

    return {
      ...proposalComment,
      ...comment,

      delegator: voter === tx.from ? null : tx.from,
      timestamp: blockInfo.timestamp
    }
  } catch (error) {
    CACHE_TX[transactionHash] = null
    CACHE_BLOCK[blockNumber] = null
    return proposalComment
  }
}

const state = () => {
  return {
    isFetchingComments: false,
    isFetchingMessages: false,
    ensNames: {},
    comments: []
  }
}

const getters = {
  comments: (state) => {
    const { ensNames } = state
    let comments = state.comments.slice()

    comments.sort((a, b) => b.blockNumber - a.blockNumber)
    comments = uniqBy(comments, 'voter')
    comments.sort((a, b) => b.percentage - a.percentage)

    comments = comments.map((data) => ({
      ...data,
      ens: {
        delegator: ensNames[data.delegator],
        voter: ensNames[data.voter]
      }
    }))

    return comments
  }
}

const mutations = {
  SAVE_FETCHING_COMMENTS(state, status) {
    state.isFetchingComments = status
  },
  SAVE_FETCHING_MESSAGES(state, status) {
    state.isFetchingMessages = status
  },
  SAVE_ENS_NAMES(state, ensNames) {
    state.ensNames = { ...state.ensNames, ...ensNames }
  },
  SAVE_COMMENTS(state, comments) {
    state.comments = comments
  }
}

const actions = {
  async fetchComments(context, proposal) {
    const { commit, dispatch, state } = context
    let { comments } = state
    let newComments = []

    if (comments[0]?.id !== proposal.id) {
      commit('SAVE_COMMENTS', [])
      comments = []
    }

    commit('SAVE_FETCHING_COMMENTS', true)
    newComments = await dispatch('fetchVotedEvents', { proposal, comments })
    commit('SAVE_FETCHING_COMMENTS', false)

    if (!newComments) return
    commit('SAVE_COMMENTS', newComments.concat(comments))
    dispatch('fetchEnsNames', { comments: newComments })

    commit('SAVE_FETCHING_MESSAGES', true)
    // TODO: TC-163 - add pagination
    newComments = await dispatch('fetchCommentsMessages', { comments: newComments })
    commit('SAVE_FETCHING_MESSAGES', false)

    if (!newComments) return
    commit('SAVE_COMMENTS', newComments.concat(comments))
  },
  async fetchVotedEvents(context, { proposal, comments }) {
    const { rootGetters } = context
    let { blockNumber: fromBlock } = proposal

    const netId = rootGetters['metamask/netId']
    const govInstance = rootGetters['governance/gov/govContract']({ netId })
    const web3 = rootGetters['governance/gov/getWeb3']({ netId })

    if (comments[0]?.id === proposal.id) {
      fromBlock = comments[0].blockNumber + 1
    }

    try {
      let votedEvents = await getPastEventsCachedAndChunked({
        netId,
        contract: govInstance,
        web3,
        eventName: 'Voted',
        filter: {
          // support: [false],
          proposalId: proposal.id
        },
        fromBlock,
        toBlock: 'latest'
      })

      console.log('fetchVotedEvents', votedEvents.length)

      votedEvents = votedEvents.sort((a, b) => b.blockNumber - a.blockNumber)
      votedEvents = uniqBy(votedEvents, 'returnValues.voter')

      console.log('fetchVotedEvents uniq', votedEvents.length)

      const resultAll = toBN(toWei(proposal.results.for)).add(toBN(toWei(proposal.results.against)))
      let newComments = votedEvents.map((votedEvent) => createProposalComment(resultAll, votedEvent))
      newComments = newComments.concat(comments)
      return newComments
    } catch (e) {
      console.error('fetchVotedEvents', e.message)
      return null
    }
  },
  async fetchCommentsMessages(context, { comments }) {
    const { rootGetters } = context

    const netId = rootGetters['metamask/netId']
    const govInstance = rootGetters['governance/gov/govContract']({ netId })
    const web3 = rootGetters['governance/gov/getWeb3']({ netId })
    const commentListChunks = chunk(comments, CHUNK_COUNT_PER_BATCH_REQUEST)

    let results = []

    try {
      for await (const list of commentListChunks) {
        const batch = new web3.BatchRequest()
        const fetchCommentsWithMessages = createFetchCommentWithMessage(web3, batch, govInstance)
        const promises = list.map(fetchCommentsWithMessages)
        batch.execute()
        const result = await Promise.all(promises)

        results = results.concat(result)
      }

      return results
    } catch (e) {
      console.error('fetchCommentsMessages', e.message)
    }
  },
  async fetchEnsNames(context, { comments }) {
    const { rootGetters, commit } = context

    const netId = rootGetters['metamask/netId']
    const web3 = rootGetters['governance/gov/getWeb3']({ netId })

    try {
      const addresses = comments
        .map((_) => _.voter)
        .flat()
        .filter(Boolean)

      console.log('fetchEnsNames', addresses.length)

      const ensNames = await lookupAddresses(addresses, web3)

      commit('SAVE_ENS_NAMES', ensNames)
    } catch (e) {
      console.error('fetchEnsNames', e.message)
    }
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
