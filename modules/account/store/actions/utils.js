import networkConfig from '../../../../networkConfig'
import { graph } from '@/services'

function createMutation({ commit, rootState }, { type, payload }) {
  const { netId } = rootState.metamask

  commit(type, { ...payload, netId })
}

function clearState({ dispatch }, { key }) {
  dispatch('createMutation', {
    type: 'CLEAR_STATE',
    payload: { key }
  })
}

async function getEventsFromBlockPart({ echoContract, address, currentBlockNumber, netId }) {
  try {
    const { events: graphEvents, lastSyncBlock } = await graph.getNoteAccounts({ address, netId })

    if (graphEvents.length) {
      return graphEvents
    }

    let { NOTE_ACCOUNT_BLOCK: fromBlock } = networkConfig[`netId${netId}`].constants
    if (lastSyncBlock) {
      fromBlock = lastSyncBlock + 1
    }

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

    let events = []
    let currentFromBlock = Number(fromBlock)
    let currentBlockRange = defaultBlockRange

    while (currentFromBlock <= currentBlockNumber) {
      const currentToBlock = Math.min(currentFromBlock + currentBlockRange, currentBlockNumber)

      try {
        const partOfEvents = await echoContract.getEvents({
          fromBlock: currentFromBlock,
          toBlock: currentToBlock,
          address
        })

        if (partOfEvents) {
          events = events.concat(
            partOfEvents.map((event) => ({
              address: event.returnValues.who,
              encryptedAccount: event.returnValues.data
            }))
          )
        }

        currentFromBlock = currentToBlock + 1
        currentBlockRange = defaultBlockRange
      } catch (err) {
        if (isBlockRangeTooLargeError(err) && currentBlockRange > minBlockRange) {
          currentBlockRange = Math.max(minBlockRange, Math.floor(currentBlockRange / 2))
          continue
        }

        if (currentBlockRange <= minBlockRange) {
          console.error(`getEventsFromBlockPart has error: ${err.message}`)
          currentFromBlock = currentToBlock + 1
          continue
        }

        currentBlockRange = Math.max(minBlockRange, Math.floor(currentBlockRange / 2))
      }
    }

    events = graphEvents.concat(events)

    return events
  } catch (err) {
    console.log(`getEventsFromBlock has error: ${err.message}`)
    return false
  }
}

export { clearState, createMutation, getEventsFromBlockPart }
