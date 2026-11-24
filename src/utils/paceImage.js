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

/**
 * Where to write each goal's target ("Agility 99") next to its marker on the plan line. Labels sit above and to the left of the marker (the line climbs
 * away from that corner), the last goal's first, then the rest in order, and one that would land on another label or outside the chart is left out.
 * `marks` is the series' marks ({ skill, targetLevel, day, xp }); X and Y turn a day and XP into positions; `box` is { left, right, top } of the chart.
 * Returns [{ text, x, y, anchor, index }] (x/y is the text's baseline, anchor is 'end').
 */
export function goalLabels(marks, X, Y, { charWidth = 6.2, height = 12, gap = 4, box = { left: 0, right: Infinity, top: -Infinity } } = {}) {
  const list = marks || []
  const order = list.length ? [list.length - 1, ...list.slice(0, -1).map((_, i) => i)] : []
  const placed = []
  const out = []
  for (const i of order) {
    const m = list[i]
    const text = `${m.skill} ${m.targetLevel}`
    const width = text.length * charWidth
    const x = X(m.day) - 7
    const y = Y(m.xp) - 8
    const b = { x0: x - width - gap, x1: x + gap, y0: y - height - gap, y1: y + gap }
    if (b.x0 < box.left || b.x1 > box.right || b.y0 < box.top) continue
    if (placed.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) continue
    placed.push(b)
    out.push({ text, x, y, anchor: 'end', index: i })
  }
  return out
}

/** "Agility 91 → 99" (where the player is now, and where the goal takes the skill); a finished goal says so. */
export const goalChipText = (g) => (g.done ? `${g.skill} ${g.to} ✓` : g.from != null && g.from < g.to ? `${g.skill} ${g.from} → ${g.to}` : `${g.skill} ${g.to}`)

/** The goals as chips, wrapped into rows that fit `maxWidth`: [[{ text, width }]]. `measure` gives a text's width. */
export function chipRows(labels, measure, maxWidth, { pad = 18, gap = 10 } = {}) {
  const rows = [[]]
  let used = 0
  for (const text of labels) {
    const width = measure(text) + pad * 2
    if (used && used + gap + width > maxWidth) {
      rows.push([])
      used = 0
    }
    rows[rows.length - 1].push({ text, width })
    used += (used ? gap : 0) + width
  }
  return rows.filter((r) => r.length)
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
 * info: { series, title, subtitle, finishText, untilText, pctText, badge: { kind, text } | null, xpText, skill, goals: [{ skill, from, to, done }] }
 */
export async function drawPaceImage({ series, title = 'Training plan', subtitle = '', finishText = '', untilText = '', pctText = '', badge = null, xpText = '', skill = '', goals = [] }) {
  const family = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif"
  try {
    await Promise.all(['500 24px', '700 24px', '800 24px'].map((f) => document.fonts.load(`${f} 'Plus Jakarta Sans'`)))
  } catch {
    /* the fallback font is fine */
  }
  const icon = await loadImage(skill ? skillIconSrc(skill) : null)

  const W = PACE_IMAGE_WIDTH
  // The goals (each skill's target level) as chips under the chart, when there is more than one.
  const goalTexts = goals.length ? goals.map(goalChipText) : (series.marks || []).map((m) => `${m.skill} ${m.targetLevel}`)
  const measurer = document.createElement('canvas').getContext('2d')
  measurer.font = `700 20px ${family}`
  const chips = goalTexts.length > 1 ? chipRows(goalTexts, (t) => measurer.measureText(t).width, W - PAD * 2) : []
  const CHIP_ROW = 42
  const chipsHeight = chips.length ? 34 + chips.length * CHIP_ROW : 0
  const H = PACE_IMAGE_HEIGHT + chipsHeight
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
    // The label is at the foot of the line, beside it, so it never meets a goal's label near the top.
    ctx.fillStyle = C.muted
    ctx.font = `500 18px ${family}`
    const left = geo.todayX - 10 - 56 > area.left
    ctx.textAlign = left ? 'right' : 'left'
    ctx.fillText('Today', geo.todayX + (left ? -10 : 10), area.top + area.height - 10)
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
  // the target level of each goal, by its marker
  ctx.font = `700 18px ${family}`
  ctx.fillStyle = C.text
  ctx.textAlign = 'right'
  for (const l of goalLabels(series.marks, geo.X, geo.Y, { charWidth: 10.2, height: 18, gap: 6, box: { left: area.left, right: area.left + area.width + 14, top: area.top - 40 } })) ctx.fillText(l.text, l.x, l.y)
  ctx.textAlign = 'left'
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
  // Where the player is now, by the dot (for a plan of one skill; with several, the chips below say it for each)
  if (goals.length === 1 && goals[0].from != null && !goals[0].done) {
    ctx.font = `700 18px ${family}`
    ctx.fillStyle = C.green
    ctx.textAlign = 'right'
    ctx.fillText(`You: ${goals[0].skill} ${goals[0].from}`, geo.now.x - 12, Math.max(geo.now.y - 26, area.top + 20))
    ctx.textAlign = 'left'
  }

  // the goals
  if (chips.length) {
    let cy = area.top + area.height + 70
    ctx.font = `700 20px ${family}`
    chips.forEach((row) => {
      let cx = PAD
      for (const c of row) {
        ctx.fillStyle = C.panel
        ctx.strokeStyle = C.border
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(cx, cy - 26, c.width, 36, 18)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = C.gold
        ctx.textAlign = 'left'
        ctx.fillText(c.text, cx + 18, cy)
        cx += c.width + 10
      }
      cy += CHIP_ROW
    })
  }

  // footer
  ctx.fillStyle = C.border
  ctx.fillRect(PAD, H - 64, W - PAD * 2, 2)
  ctx.fillStyle = C.muted
  ctx.font = `500 20px ${family}`
  ctx.fillText('Measured from the stats the plan started with', PAD, H - 26)
  if (xpText) {
    ctx.textAlign = 'right'
    ctx.fillText(xpText, W - PAD, H - 26)
    ctx.textAlign = 'left'
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture.'))), 'image/png'))
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}...`).width > maxWidth) t = t.slice(0, -1)
  return `${t}...`
}
