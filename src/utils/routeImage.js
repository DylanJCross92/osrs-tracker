// A shareable picture of a skill's level-by-level training route (for social media). Drawn on a canvas in the browser, so
// nothing is uploaded. rowsForImage() is pure (and tested); drawRouteImage() does the painting.
import { formatGp, formatHours, formatNum } from '@/utils/planner'
import { methodIconSrc } from '@/data/methodIcons'
import { skillIconSrc } from '@/utils/osrsSkills'

export const IMAGE_WIDTH = 1080
const PAD = 48
const HEAD = 190
const ROW = 104
const FOOT = 150
const MAX_ROWS = 14

const C = { bg: '#16130e', panel: '#211c14', border: '#40361f', text: '#ece4d3', muted: '#a99a79', gold: '#f0c976', green: '#7cb869', red: '#e08a78' }

/** The rows shown in the picture: [{ levels, name, icon, perHour, gp, hours }]. Steps past MAX_ROWS are folded into `more`. */
export function rowsForImage(segments) {
  const all = (segments || []).map((s) => ({
    levels: `${s.startLevel} to ${s.endLevel}`,
    name: s.method ? s.method.name : 'No catalog method',
    icon: s.method ? methodIconSrc(s.method) : null,
    xpPerHour: s.xpPerHour ? `~${formatNum(s.xpPerHour)} xp/h` : '',
    gp: s.netGp == null ? 'No GP data' : formatGp(s.netGp),
    gpSign: s.netGp == null ? 0 : s.netGp >= 0 ? 1 : -1,
    hours: s.hours == null ? '-' : formatHours(s.hours),
  }))
  return { rows: all.slice(0, MAX_ROWS), more: Math.max(all.length - MAX_ROWS, 0) }
}

/**
 * The line under the title, worked out from the route that is actually drawn (so a method picked for some levels is reflected):
 * one method throughout -> "Using X"; levels picked by hand -> "Custom route"; otherwise the strategy's own wording (`fallback`).
 */
export function routeSubtitle(segments, fallback = 'Fastest route') {
  const segs = (segments || []).filter((s) => s.method)
  const names = [...new Set(segs.map((s) => s.method.name))]
  if (names.length === 1) return `Using ${names[0]}`
  if (segs.some((s) => s.kind === 'manual')) return 'Custom route'
  return fallback
}

/** The levels the route covers: from its first step to its last (quest xp can move the start above the typed level). */
export function routeLevels(segments, fallbackFrom, fallbackTo) {
  const list = segments || []
  if (!list.length) return { from: fallbackFrom, to: fallbackTo }
  return { from: list[0].startLevel ?? fallbackFrom, to: list[list.length - 1].endLevel ?? fallbackTo }
}

/** A safe file name, like "tickgains-runecraft-1-99.png". */
export const imageFileName = (skill, from, to) => `tickgains-${String(skill).toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${from}-${to}.png`

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}...`).width > maxWidth) t = t.slice(0, -1)
  return `${t}...`
}

/**
 * Paints the picture and resolves to a PNG Blob.
 * { skill, startLevel, endLevel, segments, totalHours, totalGp, strategy }
 */
export async function drawRouteImage({ skill, startLevel, endLevel, segments, totalHours, totalGp, strategy }) {
  const { rows, more } = rowsForImage(segments)
  const family = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif"
  try {
    await Promise.all(['500 24px', '700 24px', '800 24px'].map((f) => document.fonts.load(`${f} 'Plus Jakarta Sans'`)))
  } catch {
    /* the fallback font is fine */
  }
  const [skillIcon, ...icons] = await Promise.all([loadImage(skillIconSrc(skill)), ...rows.map((r) => loadImage(r.icon))])

  const height = HEAD + rows.length * ROW + (more ? 44 : 0) + FOOT
  const scale = 2 // sharp on high-density screens
  const canvas = document.createElement('canvas')
  canvas.width = IMAGE_WIDTH * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  const g = ctx.createLinearGradient(0, 0, 0, height)
  g.addColorStop(0, '#241f15')
  g.addColorStop(1, '#0e0c09')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, IMAGE_WIDTH, height)

  // Header
  ctx.textBaseline = 'alphabetic'
  if (skillIcon) {
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(skillIcon, PAD, 52, 72, 72)
    ctx.imageSmoothingEnabled = true
  }
  ctx.fillStyle = C.text
  ctx.font = `800 54px ${family}`
  ctx.fillText(`${skill}: ${startLevel} to ${endLevel}`, PAD + 96, 100)
  ctx.fillStyle = C.muted
  ctx.font = `500 24px ${family}`
  ctx.fillText(strategy || 'Fastest route', PAD + 96, 138)
  ctx.fillStyle = C.border
  ctx.fillRect(PAD, HEAD - 22, IMAGE_WIDTH - PAD * 2, 2)

  // Rows
  const right = IMAGE_WIDTH - PAD
  rows.forEach((r, i) => {
    const y = HEAD + i * ROW
    ctx.fillStyle = C.panel
    ctx.beginPath()
    ctx.roundRect(PAD, y, IMAGE_WIDTH - PAD * 2, ROW - 12, 14)
    ctx.fill()
    ctx.strokeStyle = C.border
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.fillStyle = C.gold
    ctx.font = `800 30px ${family}`
    ctx.textAlign = 'left'
    ctx.fillText(r.levels, PAD + 24, y + 56)

    const icon = icons[i]
    if (icon) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(icon, PAD + 230, y + 16, 60, 60)
      ctx.imageSmoothingEnabled = true
    }
    ctx.fillStyle = C.text
    ctx.font = `700 28px ${family}`
    ctx.fillText(fit(ctx, r.name, 400), PAD + 308, y + 44)
    ctx.fillStyle = C.muted
    ctx.font = `500 21px ${family}`
    ctx.fillText(r.xpPerHour, PAD + 308, y + 72)

    ctx.textAlign = 'right'
    ctx.fillStyle = r.gpSign > 0 ? C.green : r.gpSign < 0 ? C.red : C.muted
    ctx.font = `700 26px ${family}`
    ctx.fillText(r.gp, right - 24, y + 44)
    ctx.fillStyle = C.muted
    ctx.font = `500 21px ${family}`
    ctx.fillText(r.hours, right - 24, y + 72)
    ctx.textAlign = 'left'
  })
  let y = HEAD + rows.length * ROW
  if (more) {
    ctx.fillStyle = C.muted
    ctx.font = `500 22px ${family}`
    ctx.textAlign = 'center'
    ctx.fillText(`+ ${more} more step${more === 1 ? '' : 's'} on tickgains.com`, IMAGE_WIDTH / 2, y + 26)
    ctx.textAlign = 'left'
    y += 44
  }

  // Footer: totals and the site
  ctx.fillStyle = C.border
  ctx.fillRect(PAD, y + 4, IMAGE_WIDTH - PAD * 2, 2)
  ctx.fillStyle = C.muted
  ctx.font = `500 22px ${family}`
  ctx.fillText('Total time', PAD, y + 50)
  ctx.fillText('Net GP', PAD + 300, y + 50)
  ctx.fillStyle = C.text
  ctx.font = `800 34px ${family}`
  ctx.fillText(formatHours(totalHours), PAD, y + 92)
  ctx.fillStyle = totalGp == null ? C.muted : totalGp >= 0 ? C.green : C.red
  ctx.fillText(totalGp == null ? 'No GP data' : formatGp(totalGp), PAD + 300, y + 92)
  ctx.textAlign = 'right'
  ctx.fillStyle = C.gold
  ctx.font = `800 34px ${family}`
  ctx.fillText('TickGains.com', right, y + 92)
  ctx.fillStyle = C.muted
  ctx.font = `500 20px ${family}`
  ctx.fillText('Approximate rates, net of supplies', right, y + 50)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture.'))), 'image/png'))
}

/** Downloads the picture. Where the device offers a share sheet with files (phones), that opens instead. */
export async function saveRouteImage(blob, fileName, { share = true, title = 'My training route' } = {}) {
  const file = new File([blob], fileName, { type: 'image/png' })
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'saved'
}
