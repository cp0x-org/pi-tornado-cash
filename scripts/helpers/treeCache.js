import fs from 'fs'
import BloomFilter from 'bloomfilter.js'
import { MerkleTree } from 'fixed-merkle-tree'
import { buildMimcSponge } from 'circomlibjs'

export const trees = {
  PARTS_COUNT: 4,
  LEVELS: 20
}

export async function createMimcHash() {
  const mimcSponge = await buildMimcSponge()
  return (left, right) => mimcSponge.F.toString(mimcSponge.multiHash([BigInt(left), BigInt(right)]))
}

function prepareTarget(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  if (fs.lstatSync(filePath).isDirectory()) {
    fs.rmSync(filePath, { recursive: true, force: true })
  }
}

export function createTreeCache({ events, filePath, mimcHash, zeroElement }) {
  const bloom = new BloomFilter(events.length)

  const eventsData = events.reduce(
    (acc, { leafIndex, commitment, ...rest }, i) => {
      if (leafIndex !== i) {
        throw new Error(`leafIndex (${leafIndex}) !== i (${i})`)
      }

      const leaf = commitment.toString()
      acc.leaves.push(leaf)
      acc.metadata[leaf] = { ...rest, leafIndex }

      return acc
    },
    { leaves: [], metadata: {} }
  )

  const tree = new MerkleTree(trees.LEVELS, eventsData.leaves, {
    zeroElement,
    hashFunction: mimcHash
  })

  const writtenFiles = []
  const slices = tree.getTreeSlices(trees.PARTS_COUNT)

  slices.forEach((slice, index) => {
    slice.metadata = slice.elements.reduce((acc, curr) => {
      if (index < trees.PARTS_COUNT - 1) {
        bloom.add(curr)
      }

      acc.push(eventsData.metadata[curr])
      return acc
    }, [])

    const slicePath = `${filePath}_slice${index + 1}.json`
    prepareTarget(slicePath)
    fs.writeFileSync(slicePath, JSON.stringify(slice, null, 2) + '\n')
    writtenFiles.push(slicePath)
  })

  const bloomPath = `${filePath}_bloom.json`
  prepareTarget(bloomPath)
  fs.writeFileSync(bloomPath, bloom.serialize())
  writtenFiles.push(bloomPath)

  return {
    count: eventsData.leaves.length,
    writtenFiles
  }
}
