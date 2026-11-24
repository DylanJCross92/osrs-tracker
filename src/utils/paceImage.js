// A picture of the plan's pace chart (the plan against what really happened), to save and share. Drawn on a canvas in the browser, so nothing is
// uploaded. chartGeometry() is pure (and tested); drawPaceImage() does the painting. The chart is the same one the planner page draws
// (components/planner/PlannerPaceChart.vue): the plan, your progress, and where your pace takes you.
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'

export const PACE_IMAGE_WIDTH = 1200
export const PACE_IMAGE_HEIGHT = 800
const PAD = 56
const C = { panel: '#211c14', border: '#40361f', text: '#ece4d3', muted: '#a99a79', gold: '#f0c976', green: '#7cb869', plan: '#b9a47a', red: '#e08a78' }

/**
 * Where everything goes inside a chart area { left, top, width, height } (the plot itself, axis labels go outside it): the points of each line,
 * the goal markers, today, the end markers and the labelled ticks. `series` is the planner's pace series (utils/plannerTools.js paceSeries).
 */
export function chartGeometry(series, area, { xTickCount = 5, dateLabel = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) } = {}) {
  // A little room past the last date so the finish marker is never cut off (as on the page).
  const lastDay = Math.max(series.endDay || 0, series.plannedDays || 0, series.projectedDay || 0)
  const xMax = Math.max(1, lastDay * 1.04)
  const total = Math.max(series.totalXp || 1, 1)
  const X = (day) => area.left + (day / xMax) * area.width
  const Y = (xp) => area.top + area.height - (xp / total) * area.height
  const pts = (list) => (list || []).map((p) => ({ x: X(p.day), y: Y(p.xp) }))
  const dateAt = (day) => new Date(series.baseline.getTime() + day * 86_400_000)
  const yTicks = [0, 0.5, 1].map((f) => ({ y: Y(f * total), label: f === 0 ? '0' : formatXp(f * total) }))
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const day = (i / (xTickCount - 1)) * xMax
    return { x: X(day), label: dateLabel(dateAt(day)), anchor: i === 0 ? 'left' : i === xTickCount - 1 ? 'right' : 'center' }
  })
  const actual = pts(series.actual)
  const now = actual[actual.length - 1] || { x: X(0), y: Y(0) }
  return {
    X,
    Y,
    xMax,
    planned: pts(series.planned),
    actual,
    projected: series.projected ? pts(series.projected) : null,
    marks: (series.marks || []).slice(0, -1).map((m) => ({ x: X(m.day), y: Y(m.xp) })),
    plannedEnd: { x: X(series.plannedDays), y: Y(total) },
    projectedEnd: series.projected ? { x: X(series.projectedDay), y: Y(total) } : null,
    now,
    todayX: series.nowDay > 0 ? X(series.nowDay) : null,
    yTicks,
    xTicks,
    baselineY: Y(0),
  }
}

/** A safe file name, like "tickgains-my-training-plan-pace.png". */
export const paceFileName = (title) => `tickgains-${String(title || 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan'}-pace.png`

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Paints the picture and resolves to a PNG Blob.
 * info: { series, title, subtitle, finishText, untilText, pctText, badge: { kind, text } | null, xpText, skill }
 */
export async function drawPaceImage({ series, title = 'Training plan', subtitle = '', finishText = '', untilText = '', pctText = '', badge = null, xpText = '', skill = '' }) {
  const family = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif"
  try {
    await Promise.all(['500 24px', '700 24px', '800 24px'].map((f) => document.fonts.load(`${f} 'Plus Jakarta Sans'`)))
  } catch {
    /* the fallback font is fine */
  }
  const icon = await loadImage(skill ? skillIconSrc(skill) : null)

  const W = PACE_IMAGE_WIDTH
  const H = PACE_IMAGE_HEIGHT
  const scale = 2 // sharp on high-density screens
  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)

  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#241f15')
  g.addColorStop(1, '#0e0c09')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  // Header: the plan and who it is for, and the site
  ctx.fillStyle = C.text
  ctx.font = `800 44px ${family}`
  ctx.textAlign = 'left'
  ctx.fillText(fitText(ctx, title, W - PAD * 2 - 260), PAD, 88)
  if (subtitle) {
    ctx.fillStyle = C.muted
    ctx.font = `500 24px ${family}`
    ctx.fillText(subtitle, PAD, 124)
  }
  ctx.textAlign = 'right'
  ctx.fillStyle = C.gold
  ctx.font = `800 30px ${family}`
  ctx.fillText('TickGains.com', W - PAD, 80)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.border
  ctx.fillRect(PAD, 148, W - PAD * 2, 2)

  // The numbers: finish line, how complete, and the XP
  let y = 196
  if (finishText) {
    ctx.fillStyle = C.muted
    ctx.font = `800 18px ${family}`
    ctx.fillText('FINISH LINE', PAD, y - 18)
    ctx.fillStyle = C.gold
    ctx.font = `800 46px ${family}`
    ctx.fillText(finishText, PAD, y + 28)
    if (untilText) {
      ctx.fillStyle = C.muted
      ctx.font = `500 22px ${family}`
      ctx.fillText(untilText, PAD, y + 60)
    }
  }
  const midX = 520
  if (pctText) {
    ctx.fillStyle = C.text
    ctx.font = `800 46px ${family}`
    if (icon) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(icon, midX, y - 8, 40, 40)
      ctx.imageSmoothingEnabled = true
    }
    const x0 = icon ? midX + 54 : midX
    ctx.fillText(`${pctText} complete`, x0, y + 28)
    if (badge?.text) {
      ctx.font = `700 22px ${family}`
      const w = ctx.measureText(badge.text).width + 32
      const col = badge.kind === 'behind' || badge.kind === 'late' ? C.red : C.green
      ctx.strokeStyle = col
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(x0, y + 42, w, 38, 19)
      ctx.stroke()
      ctx.fillStyle = col
      ctx.fillText(badge.text, x0 + 16, y + 69)
    }
  }
  if (xpText) {
    ctx.textAlign = 'right'
    ctx.fillStyle = C.muted
    ctx.font = `500 22px ${family}`
    ctx.fillText(xpText, W - PAD, y + 66)
    ctx.textAlign = 'left'
  }

  // The chart
  const area = { left: PAD + 64, top: 372, width: W - PAD * 2 - 64 - 14, height: 300 }
  const geo = chartGeometry(series, area)
  // legend
  let lx = PAD + 64
  const ly = 326
  ctx.font = `500 20px ${family}`
  const legend = [
    ['Plan', C.plan, false],
    ['Your progress', C.green, false],
    ...(geo.projected ? [['At your pace', C.green, true]] : []),
  ]
  for (const [label, color, dashed] of legend) {
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.setLineDash(dashed ? [7, 6] : [])
    ctx.beginPath()
    ctx.moveTo(lx, ly - 6)
    ctx.lineTo(lx + 30, ly - 6)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = C.muted
    ctx.fillText(label, lx + 40, ly)
    lx += 40 + ctx.measureText(label).width + 30
  }
  // grid and labels
  ctx.lineWidth = 1
  ctx.font = `500 18px ${family}`
  for (const t of geo.yTicks) {
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'
    ctx.beginPath()
    ctx.moveTo(area.left, t.y)
    ctx.lineTo(area.left + area.width, t.y)
    ctx.stroke()
    ctx.fillStyle = C.muted
    ctx.textAlign = 'right'
    ctx.fillText(t.label, area.left - 12, t.y + 6)
  }
  for (const t of geo.xTicks) {
    ctx.fillStyle = C.muted
    ctx.textAlign = t.anchor === 'left' ? 'left' : t.anchor === 'right' ? 'right' : 'center'
    ctx.fillText(t.label, t.x, area.top + area.height + 34)
  }
  ctx.textAlign = 'left'
  // today
  if (geo.todayX != null) {
    ctx.strokeStyle = 'rgba(236,228,211,0.45)'
    ctx.setLineDash([4, 5])
    ctx.beginPath()
    ctx.moveTo(geo.todayX, area.top)
    ctx.lineTo(geo.todayX, area.top + area.height)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = C.muted
    ctx.textAlign = geo.todayX > area.left + area.width * 0.85 ? 'right' : 'center'
    ctx.fillText('Today', geo.todayX, area.top - 8)
    ctx.textAlign = 'left'
  }
  const path = (pts) => {
    ctx.beginPath()
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  }
  // the plan
  ctx.strokeStyle = C.plan
  ctx.lineWidth = 3
  path(geo.planned)
  ctx.stroke()
  ctx.fillStyle = C.plan
  for (const m of geo.marks) {
    ctx.beginPath()
    ctx.arc(m.x, m.y, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = C.gold
  ctx.lineWidth = 3
  ctx.fillStyle = '#16130e'
  ctx.beginPath()
  ctx.arc(geo.plannedEnd.x, geo.plannedEnd.y, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // what really happened
  if (geo.actual.length) {
    ctx.fillStyle = 'rgba(124,184,105,0.16)'
    path(geo.actual)
    ctx.lineTo(geo.now.x, geo.baselineY)
    ctx.lineTo(geo.actual[0].x, geo.baselineY)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = C.green
    ctx.lineWidth = 3.5
    path(geo.actual)
    ctx.stroke()
  }
  if (geo.projected) {
    ctx.strokeStyle = C.green
    ctx.lineWidth = 3
    ctx.setLineDash([9, 7])
    path(geo.projected)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = C.green
    ctx.beginPath()
    ctx.arc(geo.projectedEnd.x, geo.projectedEnd.y, 7, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = C.green
  ctx.beginPath()
  ctx.arc(geo.now.x, geo.now.y, 6.5, 0, Math.PI * 2)
  ctx.fill()

  // footer
  ctx.fillStyle = C.border
  ctx.fillRect(PAD, H - 64, W - PAD * 2, 2)
  ctx.fillStyle = C.muted
  ctx.font = `500 20px ${family}`
  ctx.fillText('Progress is measured from the stats the plan started with', PAD, H - 26)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture.'))), 'image/png'))
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}...`).width > maxWidth) t = t.slice(0, -1)
  return `${t}...`
}
