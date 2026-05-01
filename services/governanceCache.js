const governanceCacheByNetId = new Map()
const governanceCacheLoadersByNetId = new Map()

function getCacheUrl(netId) {
  // eslint-disable-next-line camelcase, no-undef
  const prefix = typeof __webpack_public_path__ !== 'undefined' ? __webpack_public_path__.slice(0, -7) : ''

  return `${prefix}/governance-cache/netId${netId}.json`
}

function normalizeEvent(event) {
  return {
    ...event,
    blockNumber: Number(event.blockNumber),
    logIndex: Number(event.logIndex),
    returnValues: event.returnValues || {}
  }
}

function isValueMatch(currentValue, expectedValue) {
  if (Array.isArray(expectedValue)) {
    return expectedValue.some((value) => isValueMatch(currentValue, value))
  }

  if (typeof expectedValue === 'boolean') {
    if (typeof currentValue === 'boolean') {
      return currentValue === expectedValue
    }

    return String(currentValue).toLowerCase() === String(expectedValue)
  }

  return String(currentValue).toLowerCase() === String(expectedValue).toLowerCase()
}

function isEventMatchesFilter(event, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    return isValueMatch(event.returnValues?.[key], value)
  })
}

function getEventsFromCacheByRange({ cache, eventName, fromBlock, toBlock, filter }) {
  const events = cache?.events?.[eventName]

  if (!Array.isArray(events) || !events.length) {
    return []
  }

  const from = Number(fromBlock)
  const to = Number(toBlock)

  return events
    .filter((event) => event.blockNumber >= from && event.blockNumber <= to)
    .filter((event) => isEventMatchesFilter(event, filter))
}

async function fetchGovernanceCache(netId) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return null
  }

  try {
    const response = await fetch(getCacheUrl(netId), {
      cache: 'no-store'
    })

    if (!response.ok) {
      return null
    }

    const cache = await response.json()

    if (!cache?.events || !Number.isFinite(Number(cache?.lastBlock))) {
      return null
    }

    const normalizedEvents = Object.entries(cache.events || {}).reduce((acc, [eventName, events]) => {
      acc[eventName] = Array.isArray(events) ? events.map(normalizeEvent) : []
      return acc
    }, {})

    const normalizedSync = Object.entries(cache.sync || {}).reduce((acc, [eventName, block]) => {
      acc[eventName] = Number(block)
      return acc
    }, {})

    return {
      ...cache,
      lastBlock: Number(cache.lastBlock),
      sync: normalizedSync,
      events: normalizedEvents
    }
  } catch {
    return null
  }
}

function loadGovernanceCache(netId) {
  if (governanceCacheByNetId.has(netId)) {
    return governanceCacheByNetId.get(netId)
  }

  if (!governanceCacheLoadersByNetId.has(netId)) {
    governanceCacheLoadersByNetId.set(
      netId,
      (async () => {
        const cache = await fetchGovernanceCache(netId)
        governanceCacheByNetId.set(netId, cache)
        governanceCacheLoadersByNetId.delete(netId)
        return cache
      })()
    )
  }

  return governanceCacheLoadersByNetId.get(netId)
}

async function getGovernanceEventsFromCache({ netId, eventName, fromBlock, toBlock, filter }) {
  const cache = await loadGovernanceCache(netId)

  if (!cache) {
    return {
      cacheLastBlock: null,
      events: []
    }
  }

  const perEventCacheLastBlock = Number(cache?.sync?.[eventName])
  const cacheLastBlock = Number.isFinite(perEventCacheLastBlock) ? perEventCacheLastBlock : cache.lastBlock
  const rangeToBlock = toBlock === 'latest' ? cacheLastBlock : Math.min(Number(toBlock), cacheLastBlock)
  const rangeFromBlock = Number(fromBlock)

  if (!Number.isFinite(rangeFromBlock) || !Number.isFinite(rangeToBlock) || rangeFromBlock > rangeToBlock) {
    return {
      cacheLastBlock,
      events: []
    }
  }

  return {
    cacheLastBlock,
    events: getEventsFromCacheByRange({
      cache,
      eventName,
      fromBlock: rangeFromBlock,
      toBlock: rangeToBlock,
      filter
    })
  }
}

export { getGovernanceEventsFromCache }
