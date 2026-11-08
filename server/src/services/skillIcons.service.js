import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconsDir = path.join(__dirname, '../assets/icons')

// PNG copies of public/icons/skills/*.gif, pre-converted (see that folder's
// README-less history), satori embeds <img> as an SVG <image>, and PNG is
// the format resvg reliably rasterizes, unlike GIF.
const cache = new Map()

async function dataUriFor(filename) {
  if (cache.has(filename)) return cache.get(filename)
  try {
    const buf = await readFile(path.join(iconsDir, filename))
    const uri = `data:image/png;base64,${buf.toString('base64')}`
    cache.set(filename, uri)
    return uri
  } catch {
    return null
  }
}

export function skillIconDataUri(skillName) {
  return dataUriFor(`${skillName.toLowerCase()}.png`)
}

export function brandMarkDataUri() {
  return dataUriFor('_brand-mark.png')
}
