import 'dotenv/config'

import fs from 'fs'

import networkConfig from '../networkConfig'

import { loadCachedEvents, save, createMimcHash, createTreeCache } from './helpers'

const TREES_FOLDER = 'static/trees'
const TREES_PATH = './static/trees/'
const EVENTS_PATH = './static/events/'

const EVENTS = ['deposit']
const enabledChains = ['1']
let mimcHash

function getName({ path, type, instance, format = '.json', currName = 'eth' }) {
  return `${path}${type.toLowerCase()}s_${currName}_${instance}${format}`
}

function createTreeZip(netId) {
  try {
    const config = networkConfig[`netId${netId}`]
    const { instanceAddress: CONTRACTS } = config.tokens.eth

    for (const type of EVENTS) {
      for (const [instance] of Object.entries(CONTRACTS)) {
        const baseFilename = getName({
          type,
          instance,
          format: '',
          path: TREES_PATH,
          currName: config.currencyName.toLowerCase()
        })

        const treesFolder = fs.readdirSync(TREES_FOLDER)

        treesFolder.forEach((fileName) => {
          fileName = `${TREES_PATH}${fileName}`
          const isInstanceFile = !fileName.includes('.zip') && fileName.includes(baseFilename)

          if (isInstanceFile) {
            save(fileName)
          }
        })
      }
    }
  } catch {}
}

async function createTree(netId) {
  try {
    const { currencyName, tokens, deployedBlock } = networkConfig[`netId${netId}`]

    const currName = currencyName.toLowerCase()
    const { instanceAddress: CONTRACTS } = tokens.eth

    for (const type of EVENTS) {
      for (const [instance] of Object.entries(CONTRACTS)) {
        const filePath = getName({
          type,
          instance,
          currName,
          format: '',
          path: TREES_PATH
        })

        console.log('createTree', { type, instance })

        const { events } = await loadCachedEvents({
          name: `${type}s_${currName}_${instance}.json`,
          directory: EVENTS_PATH,
          deployedBlock
        })

        console.log('events', events.length)

        const { count } = createTreeCache({
          events,
          filePath,
          mimcHash,
          zeroElement: networkConfig[`netId${netId}`].emptyElement
        })

        console.log('leaves', count)
      }
    }
  } catch (e) {
    console.error(e.message)
  }
}

async function initMimc() {
  mimcHash = await createMimcHash()
}

async function main() {
  const [, , , chain] = process.argv
  if (!enabledChains.includes(chain)) {
    throw new Error(`Supported chain ids ${enabledChains.join(', ')}`)
  }
  await initMimc()

  await createTree(chain)
  await createTreeZip(chain)
}

main()
