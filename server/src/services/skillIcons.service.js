import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

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

// The skill's own 16x16 picture enlarged without going soft (square by square), as a PNG data URI at `size` pixels, drawn once per skill and
// kept. (Drawing the squares inside the card itself took about 200 MB for every first render, so it is done here, separately.)
const bigCache = new Map()
export async function pixelIconDataUri(skillName, size = 200) {
  const key = `${String(skillName).toLowerCase()}:${size}`
  if (bigCache.has(key)) return bigCache.get(key)
  let uri = null
  try {
    const small = await dataUriFor(`${String(skillName).toLowerCase()}.png`)
    if (small) {
      const px = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16"><image width="16" height="16" xlink:href="${small}"/></svg>`, { font: { loadSystemFonts: false } }).render().pixels
      let rects = ''
      for (let i = 0; i < 256; i++) {
        const a = px[i * 4 + 3]
        if (a) rects += `<rect x="${i % 16}" y="${Math.floor(i / 16)}" width="1.02" height="1.02" fill="rgb(${px[i * 4]},${px[i * 4 + 1]},${px[i * 4 + 2]})" fill-opacity="${(a / 255).toFixed(3)}"/>`
      }
      const big = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges">${rects}</svg>`, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } })
      uri = `data:image/png;base64,${big.render().asPng().toString('base64')}`
    }
  } catch {
    uri = null
  }
  bigCache.set(key, uri)
  return uri
}
