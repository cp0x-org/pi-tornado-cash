import 'dotenv/config'

import path from 'path'
import fs from 'fs'

import networkConfig from '../networkConfig'

import { createMimcHash, createTreeCache } from './helpers/treeCache'
import { save } from './helpers/save'

const SOURCE_DIR = './static/trees/new'
const TARGET_DIR = './static/trees'
const enabledChains = ['1']

function getSourceFiles({ currName }) {
  const prefix = `deposits_${currName}_`

  return fs
    .readdirSync(SOURCE_DIR)
    .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

function getBasePath(fileName) {
  return path.join(TARGET_DIR, path.basename(fileName, '.json'))
}

async function main() {
  const [, , , chain] = process.argv

  if (!enabledChains.includes(chain)) {
    throw new Error(`Supported chain ids ${enabledChains.join(', ')}`)
  }

  const config = networkConfig[`netId${chain}`]
  const currName = config.currencyName.toLowerCase()
  const mimcHash = await createMimcHash()
  const sourceFiles = getSourceFiles({ currName })

  if (!sourceFiles.length) {
    throw new Error(`No source files found in ${SOURCE_DIR}`)
  }

  for (const fileName of sourceFiles) {
    const sourcePath = path.join(SOURCE_DIR, fileName)
    const basePath = getBasePath(fileName)
    const events = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))

    console.log('mergeTreeCache', { fileName, count: events.length })

    const { writtenFiles } = createTreeCache({
      events,
      filePath: basePath,
      mimcHash,
      zeroElement: config.emptyElement
    })

    writtenFiles.forEach((filePath) => save(filePath))
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
