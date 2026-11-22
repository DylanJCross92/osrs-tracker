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

// The skill's own 16x16 picture as crisp squares, so it can be drawn large on a card without going soft (an <img> would be smoothed).
// Returns satori nodes (an <svg> of <rect>s) or null when the icon is missing.
const pixelCache = new Map()
export async function pixelIconNode(skillName, size) {
  const key = String(skillName).toLowerCase()
  if (!pixelCache.has(key)) {
    try {
      const uri = await dataUriFor(`${key}.png`)
      if (!uri) throw new Error('missing')
      const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16"><image width="16" height="16" xlink:href="${uri}"/></svg>`
      const rendered = new Resvg(wrapper).render()
      const px = rendered.pixels
      const rects = []
      for (let i = 0; i < 256; i++) {
        const a = px[i * 4 + 3]
        if (!a) continue
        rects.push({ x: i % 16, y: Math.floor(i / 16), fill: `rgb(${px[i * 4]},${px[i * 4 + 1]},${px[i * 4 + 2]})`, opacity: a / 255 })
      }
      pixelCache.set(key, rects)
    } catch {
      pixelCache.set(key, null)
    }
  }
  const rects = pixelCache.get(key)
  if (!rects) return null
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      children: rects.map((r) => ({ type: 'rect', props: { x: r.x, y: r.y, width: 1.02, height: 1.02, fill: r.fill, fillOpacity: r.opacity, shapeRendering: 'crispEdges' } })),
    },
  }
}
