import fs from 'fs'
import path from 'path'

import Jszip from 'jszip'

export async function save(fileName) {
  try {
    const zip = new Jszip()
    zip.file(path.basename(fileName), fs.readFileSync(fileName))

    const content = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })

    fs.writeFileSync(`${fileName}.zip`, content)
    fs.unlinkSync(fileName)
    return true
  } catch (err) {
    console.log('on save error', fileName, err.message)
    return false
  }
}
