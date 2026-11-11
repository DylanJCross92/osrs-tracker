import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { skillIconDataUri } from './skillIcons.service.js'
import { dayCount, formatRange } from '../utils/dates.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fontsDir = path.join(__dirname, '../assets/fonts')

const FONTS = [
  { name: 'Plus Jakarta Sans', weight: 400, style: 'normal', data: readFileSync(path.join(fontsDir, 'PlusJakartaSans-Regular.ttf')) },
  { name: 'Plus Jakarta Sans', weight: 700, style: 'normal', data: readFileSync(path.join(fontsDir, 'PlusJakartaSans-Bold.ttf')) },
  { name: 'Plus Jakarta Sans', weight: 800, style: 'normal', data: readFileSync(path.join(fontsDir, 'PlusJakartaSans-ExtraBold.ttf')) },
]

const WIDTH = 1200
const HEIGHT = 630

// Plain object tree in the shape satori expects (React-element-like), no
// JSX/React dependency needed on the server.
function node(type, style, children) {
  return { type, props: { style, children } }
}

// <img> takes src/width/height as top-level props, not style properties.
function image(src, width, height) {
  return { type: 'img', props: { src, width, height, style: { width, height } } }
}

/** "4.2M" / "12.3K" / "850", no decimals under 1K. */
export function formatXp(xp) {
  const n = Number(xp) || 0
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${parseFloat((n / 1_000_000_000).toFixed(2))}B`
  if (abs >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2))}M`
  if (abs >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`
  return String(Math.round(n))
}

const COLORS = {
  green: '#7cb869',
  red: '#d98a78',
  gold: '#f0c976',
  cream: '#ece4d3',
  muted: '#a99a79',
  panel: '#211c14',
  border: '#40361f',
}

// Inline vector icons, the font has no arrow/star glyphs, and these keep
// the card independent of which characters a font happens to ship.
function svgIcon(size, color, paths, { stroke = false } = {}) {
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      children: paths.map((d) => ({
        type: 'path',
        props: stroke
          ? { d, fill: 'none', stroke: color, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
          : { d, fill: color },
      })),
    },
  }
}
const ICON = {
  up: 'M12 4l8 9h-5v7h-6v-7H4z',
  down: 'M12 20l-8-9h5V4h6v7h5z',
  star: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z',
  right: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z',
}

// "THIS WEEK'S GAINS" is only honest for a full week; a player tracked for
// three days gets "LAST 3 DAYS' GAINS" instead.
function periodTitle(startIso, endIso, period = 'week') {
  const days = dayCount(startIso, endIso)
  if (period === 'day') return "Today's gains"
  if (period === 'month') return `Last ${Math.min(days, 30)} days' gains`
  if (days >= 7) return "This week's gains"
  if (days <= 1) return "Today's gains"
  return `Last ${days} days' gains`
}

// "90 → 91" (arrow in gold) when a level was gained, otherwise just "90".
function levelProgress(start, end, size, baseColor) {
  const parts = [node('div', { color: baseColor }, String(start ?? end))]
  if (start != null && end > start) {
    parts.push(svgIcon(size, COLORS.muted, [ICON.right]))
    parts.push(node('div', { color: COLORS.gold }, String(end)))
  }
  return node('div', { display: 'flex', alignItems: 'center', gap: 8 }, parts)
}

function statTile(iconUri, label, children, highlight = false) {
  return node(
    'div',
    {
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      gap: 16,
      padding: '16px 22px',
      borderRadius: 16,
      backgroundColor: COLORS.panel,
      border: `1px solid ${highlight ? COLORS.gold : COLORS.border}`,
    },
    [
      iconUri ? image(iconUri, 40, 40) : null,
      node('div', { display: 'flex', flexDirection: 'column', flex: 1 }, [
        node('div', { fontSize: 17, color: COLORS.muted }, label),
        ...children,
      ]),
    ].filter(Boolean),
  )
}

async function buildOverallStats(topSkills) {
  const icons = await Promise.all(topSkills.map((s) => skillIconDataUri(s.skill)))
  return topSkills.map((s, i) =>
    statTile(icons[i], s.skill, [
      node('div', { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 24, fontWeight: 700 }, [
        node('div', { color: COLORS.green }, `+${formatXp(s.xp)}`),
        node('div', { fontSize: 16, color: COLORS.muted, fontWeight: 400 }, 'xp'),
      ]),
      node('div', { display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: COLORS.muted, marginTop: 2 }, [
        node('div', {}, 'Level'),
        levelProgress(s.levelStart, s.levelEnd, 16, COLORS.cream),
      ]),
    ]),
  )
}

// A skill that reached 99 during this period (a card for a skill you were already 99 in is not celebrated).
const reachedNew99 = (data) => data.skill !== 'Overall' && data.level >= 99 && (data.levelStart ?? data.level - (data.levelGained || 0)) < 99

function celebrationChip() {
  return node(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      padding: '7px 16px',
      borderRadius: 999,
      backgroundColor: 'rgba(240, 201, 118, 0.12)',
      border: `1px solid ${COLORS.gold}`,
      fontSize: 20,
      fontWeight: 700,
      color: COLORS.gold,
    },
    [svgIcon(20, COLORS.gold, [ICON.star]), node('div', {}, 'New 99!')],
  )
}

function buildSkillStats(data) {
  const levelTile = statTile(null, 'Level', [
    node('div', { display: 'flex', fontSize: 26, fontWeight: 700 }, [
      levelProgress(data.levelStart ?? data.level - (data.levelGained || 0), data.level, 20, COLORS.cream),
    ]),
    ...(data.totalXp != null ? [node('div', { fontSize: 17, color: COLORS.muted, marginTop: 2 }, `${Math.round(data.totalXp).toLocaleString('en-US')} XP total`)] : []),
  ], reachedNew99(data))

  // Always two tiles. Older frozen cards have no progress data, so they fall back to a plain rank tile.
  if (data.progressPct == null) {
    const rankTile =
      data.rankGained != null
        ? statTile(null, 'Rank climbed', [node('div', { fontSize: 26, fontWeight: 700, color: data.rankGained > 0 ? COLORS.green : COLORS.cream }, `${data.rankGained > 0 ? '+' : ''}${data.rankGained.toLocaleString('en-US')}`)])
        : statTile(null, 'Rank', [node('div', { fontSize: 26, fontWeight: 700, color: COLORS.muted }, 'Unranked')])
    return [levelTile, rankTile]
  }

  const pct = data.progressPct
  const progressTile = statTile(null, data.goalIs200m ? 'Progress to 200M' : `Progress to ${data.nextLabel}`, [
    node('div', { display: 'flex', alignItems: 'baseline', gap: 12 }, [
      node('div', { fontSize: 26, fontWeight: 700, color: COLORS.gold }, `${pct}%`),
      node('div', { fontSize: 17, color: COLORS.muted }, `${Math.round(data.xpToNext).toLocaleString('en-US')} XP to go`),
    ]),
    node('div', { display: 'flex', width: '100%', height: 8, borderRadius: 999, backgroundColor: '#352d1d', marginTop: 8 }, [
      node('div', { display: 'flex', width: `${Math.max(pct, 2)}%`, height: 8, borderRadius: 999, backgroundColor: COLORS.gold }, []),
    ]),
  ])
  return [levelTile, progressTile]
}

// One chip under the headline: a personal best, or how this period moved
// against the previous one. Nothing when there's nothing fair to compare.
const COMPARE_LABEL = { day: 'vs. yesterday', week: 'vs. previous week', month: 'vs. previous 30 days' }
function comparisonChip(comparison, period = 'week') {
  if (!comparison) return null
  let icon
  let color
  let text
  if (comparison.personalBest) {
    icon = svgIcon(20, COLORS.gold, [ICON.star])
    color = COLORS.gold
    text = 'New personal best!'
  } else if (comparison.pct != null && comparison.pct !== 0) {
    const up = comparison.pct > 0
    icon = svgIcon(18, up ? COLORS.green : COLORS.red, [up ? ICON.up : ICON.down])
    color = up ? COLORS.green : COLORS.red
    // A shortened week or month compares with the equally long stretch before it.
    const full = period === 'week' ? 7 : period === 'month' ? 30 : 1
    const label = comparison.days && comparison.days < full ? `vs. previous ${comparison.days} days` : COMPARE_LABEL[period] || COMPARE_LABEL.week
    text = `${Math.abs(comparison.pct)}% ${label}`
  } else {
    return null
  }
  return node(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      padding: '7px 16px',
      borderRadius: 999,
      backgroundColor: COLORS.panel,
      border: `1px solid ${COLORS.border}`,
      fontSize: 20,
      fontWeight: 700,
      color,
    },
    [icon, node('div', {}, text)],
  )
}

// Daily xp bars, fills the card's right-hand side and makes every card
// look different. The biggest day is gold.
function dailyChart(daily) {
  if (!daily || daily.length < 2) return null
  const max = Math.max(...daily.map((d) => d.xp))
  if (max <= 0) return null
  const best = daily.find((d) => d.xp === max)
  const many = daily.length > 10 // monthly card: thin bars, only the date range is labelled
  const shortDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const CHART_H = 120
  return node('div', { display: 'flex', flexDirection: 'column', width: 500 }, [
    node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }, [
      node('div', { fontSize: 18, color: COLORS.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }, 'Daily xp'),
      node('div', { display: 'flex', gap: 8, fontSize: 18, color: COLORS.muted }, [
        node('div', {}, `Best day · ${many ? shortDate(best.date) : best.label}`),
        node('div', { color: COLORS.gold, fontWeight: 700 }, `+${formatXp(best.xp)}`),
      ]),
    ]),
    node(
      'div',
      { display: 'flex', alignItems: 'flex-end', gap: many ? 3 : 10, height: CHART_H },
      daily.map((d) =>
        node(
          'div',
          {
            display: 'flex',
            flex: 1,
            height: Math.max(Math.round((d.xp / max) * CHART_H), 5),
            borderRadius: many ? 3 : 6,
            backgroundColor: d.xp === max ? COLORS.gold : d.xp > 0 ? COLORS.green : '#352d1d',
            opacity: d.xp === max ? 1 : 0.85,
          },
          [],
        ),
      ),
    ),
    many
      ? node('div', { display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 16, color: COLORS.muted }, [
          node('div', {}, shortDate(daily[0].date)),
          node('div', {}, shortDate(daily[daily.length - 1].date)),
        ])
      : node(
          'div',
          { display: 'flex', gap: 10, marginTop: 8 },
          daily.map((d) =>
            node('div', { display: 'flex', flex: 1, justifyContent: 'center', fontSize: 16, color: COLORS.muted }, d.label.slice(0, 3)),
          ),
        ),
  ])
}

// Rising-line mark with a TickGains wordmark, deliberately not a bare
// checkmark in a box, which reads as a checkbox.
function brandBadge() {
  return node(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 20px 8px 16px',
      borderRadius: 999,
      backgroundColor: COLORS.panel,
      border: `1px solid ${COLORS.border}`,
    },
    [
      svgIcon(26, COLORS.gold, ['M3 17l6-6 4 4 8-9', 'M15 6h6v6'], { stroke: true }),
      node('div', { display: 'flex', fontSize: 24, fontWeight: 800 }, [
        node('div', { color: COLORS.cream }, 'Tick'),
        node('div', { color: COLORS.gold }, 'Gains'),
      ]),
    ],
  )
}

// Header line under the player name: [overall icon] Level 2,238  XP: 220,982,542
// Labels are regular weight, the numbers are bold.
function overallLine(data, iconUri) {
  const label = (t) => node('div', { color: COLORS.muted, fontWeight: 400 }, t)
  const value = (t) => node('div', { color: COLORS.cream, fontWeight: 700 }, t)
  return node('div', { display: 'flex', alignItems: 'center', gap: 8, fontSize: 20, marginTop: 6 }, [
    ...(iconUri ? [image(iconUri, 22, 22)] : []),
    ...(data.overallLevel ? [label('Level'), value(data.overallLevel.toLocaleString('en-US')), node('div', { width: 10, display: 'flex' }, [])] : []),
    label('XP:'),
    value(Math.round(data.overallXp).toLocaleString('en-US')),
  ])
}

async function buildWeeklyCardTree(data) {
  const { displayName, skill, xpGained, periodStart, periodEnd } = data
  const isOverall = skill === 'Overall'

  const [skillIconUri, overallIconUri, statTiles] = await Promise.all([
    isOverall ? Promise.resolve(null) : skillIconDataUri(skill),
    skillIconDataUri('Overall'),
    isOverall ? buildOverallStats(data.topSkills || []) : Promise.resolve(buildSkillStats(data)),
  ])

  const chart = dailyChart(data.daily)
  const chip = xpGained > 0 ? comparisonChip(data.comparison, data.period) : null
  const title = periodTitle(periodStart, periodEnd, data.period)

  return node(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 56px',
      backgroundColor: '#16130e',
      backgroundImage: 'radial-gradient(circle at 15% 0%, #241f15 0%, #16130e 55%, #0e0c09 100%)',
      fontFamily: 'Plus Jakarta Sans',
      color: COLORS.cream,
    },
    [
      // Header: eyebrow (names the skill when it isn't Overall) + player + brand
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', flexDirection: 'column' }, [
          node(
            'div',
            {
              fontSize: 20,
              color: isOverall ? COLORS.muted : COLORS.gold,
              fontWeight: isOverall ? 400 : 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            },
            isOverall ? title : `${skill}: ${title}`,
          ),
          node('div', { fontSize: 42, fontWeight: 800, color: COLORS.gold, marginTop: 4 }, displayName),
          ...(data.overallXp != null ? [overallLine(data, overallIconUri)] : []),
        ]),
        brandBadge(),
      ]),

      // Headline xp (left) + daily chart (right)
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }, [
        node('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }, [
          node(
            'div',
            { display: 'flex', alignItems: 'center', gap: 20 },
            [
              !isOverall && skillIconUri ? image(skillIconUri, 76, 76) : null,
              node('div', { display: 'flex', alignItems: 'baseline', gap: 14 }, [
                node('div', { fontSize: 100, fontWeight: 800, color: COLORS.green, lineHeight: 1 }, `+${formatXp(xpGained)}`),
                node('div', { fontSize: 32, fontWeight: 700, color: COLORS.muted }, 'XP'),
              ]),
            ].filter(Boolean),
          ),
          node('div', { fontSize: 24, color: COLORS.muted, marginTop: 6 }, (data.period === 'day' ? formatRange(periodEnd, periodEnd) : formatRange(periodStart, periodEnd))),
          ...(chip || reachedNew99(data)
            ? [node('div', { display: 'flex', alignItems: 'center', gap: 12 }, [...(reachedNew99(data) ? [celebrationChip()] : []), ...(chip ? [chip] : [])])]
            : []),
        ]),
        ...(chart ? [chart] : []),
      ]),

      // Stat tiles: top skills gained (Overall) or level/rank (single skill)
      statTiles.length ? node('div', { display: 'flex', gap: 16 }, statTiles) : node('div', { display: 'flex' }, []),

      // Footer
      node('div', { display: 'flex', justifyContent: 'flex-end' }, [
        node('div', { fontSize: 24, color: '#d8ccae', fontWeight: 700 }, 'tickgains.com'),
      ]),
    ],
  )
}

async function renderPng(tree) {
  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts: FONTS })
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } })
  return resvg.render().asPng()
}

/** data: see cards.service.js getWeeklyCardData -> PNG Buffer. */
export async function renderWeeklyCardPng(data) {
  const tree = await buildWeeklyCardTree(data)
  return renderPng(tree)
}

// --- Personal record card ---------------------------------------------------------------------------------------

const TROPHY = ['M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0V4z', 'M17 6h3v2a3 3 0 01-3 3', 'M7 6H4v2a3 3 0 003 3']

const dayLabel = (key, withYear = true) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) })

function recordWhen(record) {
  if (!record.start || !record.end) return ''
  if (record.start === record.end) return `Set ${dayLabel(record.end)}`
  const sameYear = record.start.slice(0, 4) === record.end.slice(0, 4)
  return `${dayLabel(record.start, !sameYear)} to ${dayLabel(record.end)}`
}

const RECORD_UNITS = { xp: 'XP', days: 'days in a row', levels: 'levels', skills: 'skills' }

async function buildRecordCardTree({ displayName, record }) {
  const isXp = record.unit === 'xp'
  const valueText = isXp ? formatXp(record.value) : record.value.toLocaleString('en-US')
  const valueColor = isXp ? COLORS.green : COLORS.gold
  const [skillUri, detailUri] = await Promise.all([
    record.skill ? skillIconDataUri(record.skill) : Promise.resolve(null),
    record.detail?.skill ? skillIconDataUri(record.detail.skill) : Promise.resolve(null),
  ])

  // A big badge on the right: the skill icon for a skill record, a trophy for everything else.
  const badge = node(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: '#2a2314',
      border: `4px solid ${COLORS.gold}`,
      boxShadow: '0 0 80px rgba(240, 201, 118, 0.35)',
    },
    [skillUri ? image(skillUri, 150, 150) : svgIcon(170, COLORS.gold, TROPHY, { stroke: true })],
  )

  const chip = record.detail?.skill
    ? node(
        'div',
        { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 999, backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}`, fontSize: 22, color: COLORS.cream },
        [
          detailUri ? image(detailUri, 26, 26) : null,
          node('div', { display: 'flex' }, `Mostly ${record.detail.skill}`),
          node('div', { display: 'flex', color: COLORS.green, fontWeight: 700 }, `+${formatXp(record.detail.xp)}`),
        ].filter(Boolean),
      )
    : null

  return node(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 56px',
      backgroundColor: '#16130e',
      backgroundImage: 'radial-gradient(circle at 82% 45%, #3a2e14 0%, #1d1810 42%, #0e0c09 100%)',
      fontFamily: 'Plus Jakarta Sans',
      color: COLORS.cream,
    },
    [
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', alignItems: 'center', gap: 12 }, [
          svgIcon(34, COLORS.gold, TROPHY, { stroke: true }),
          node('div', { fontSize: 22, fontWeight: 800, color: COLORS.gold, letterSpacing: '0.14em', textTransform: 'uppercase' }, 'Personal record'),
        ]),
        brandBadge(),
      ]),

      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }, [
          node('div', { fontSize: 44, fontWeight: 800, color: COLORS.gold }, displayName),
          node('div', { fontSize: 32, fontWeight: 700, color: COLORS.cream, marginTop: 2 }, record.title),
          node('div', { display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 14 }, [
            node('div', { fontSize: 150, fontWeight: 800, color: valueColor, lineHeight: 1 }, valueText),
            node('div', { fontSize: 36, fontWeight: 700, color: COLORS.muted }, RECORD_UNITS[record.unit] || ''),
          ]),
          node('div', { fontSize: 26, color: COLORS.muted, marginTop: 12 }, recordWhen(record)),
          ...(chip ? [node('div', { display: 'flex', marginTop: 16 }, [chip])] : []),
        ]),
        badge,
      ]),

      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { fontSize: 32, fontWeight: 800, color: COLORS.gold }, 'Think you can beat it?'),
        node('div', { fontSize: 24, color: '#d8ccae', fontWeight: 700 }, 'tickgains.com'),
      ]),
    ],
  )
}

/** { displayName, record } (see utils/records.js) -> PNG Buffer. */
export async function renderRecordCardPng(data) {
  return renderPng(await buildRecordCardTree(data))
}

// --- Challenge card ----------------------------------------------------------------------------------------------

const SWORDS = [
  'M14.5 17.5L3 6V3h3l11.5 11.5',
  'M13 19l6-6',
  'M16 16l4 4',
  'M19 21l2-2',
  'M14.5 6.5L18 3h3v3l-3.5 3.5',
  'M5 14l4 4',
  'M7 17l-3 3',
  'M3 19l2 2',
]

/** The skills a challenger trained most this week, as icon + name + gain chips. */
async function buildChallengeCardTree({ displayName, xpGained, overallLevel, topSkills }) {
  const gained = Number(xpGained) > 0
  const skills = (topSkills || []).slice(0, 3)
  const icons = await Promise.all(skills.map((s) => skillIconDataUri(s.skill)))

  const chips = skills.map((s, i) =>
    node(
      'div',
      { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderRadius: 999, backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}`, fontSize: 22, color: COLORS.cream },
      [
        icons[i] ? image(icons[i], 26, 26) : null,
        node('div', { display: 'flex' }, s.skill),
        node('div', { display: 'flex', color: COLORS.green, fontWeight: 700 }, `+${formatXp(s.xp)}`),
      ].filter(Boolean),
    ),
  )

  const badge = node(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 300,
      height: 300,
      borderRadius: 150,
      backgroundColor: '#2a2314',
      border: `4px solid ${COLORS.gold}`,
      boxShadow: '0 0 80px rgba(240, 201, 118, 0.35)',
    },
    [svgIcon(170, COLORS.gold, SWORDS, { stroke: true })],
  )

  return node(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 56px',
      backgroundColor: '#16130e',
      backgroundImage: 'radial-gradient(circle at 82% 45%, #3a2e14 0%, #1d1810 42%, #0e0c09 100%)',
      fontFamily: 'Plus Jakarta Sans',
      color: COLORS.cream,
    },
    [
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', alignItems: 'center', gap: 12 }, [
          svgIcon(34, COLORS.gold, SWORDS, { stroke: true }),
          node('div', { fontSize: 22, fontWeight: 800, color: COLORS.gold, letterSpacing: '0.14em', textTransform: 'uppercase' }, 'Challenge'),
        ]),
        brandBadge(),
      ]),

      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }, [
          node('div', { fontSize: 44, fontWeight: 800, color: COLORS.gold }, `${displayName} challenges you`),
          node('div', { fontSize: 32, fontWeight: 700, color: COLORS.cream, marginTop: 2 }, gained ? 'Beat my week' : 'Beat my total level'),
          node('div', { display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 14 }, [
            node('div', { fontSize: 150, fontWeight: 800, color: gained ? COLORS.green : COLORS.gold, lineHeight: 1 }, gained ? `+${formatXp(xpGained)}` : Number(overallLevel || 0).toLocaleString('en-US')),
            node('div', { fontSize: 36, fontWeight: 700, color: COLORS.muted }, gained ? 'XP in 7 days' : 'total level'),
          ]),
          ...(chips.length ? [node('div', { display: 'flex', gap: 12, marginTop: 24 }, chips)] : []),
        ]),
        badge,
      ]),

      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { fontSize: 32, fontWeight: 800, color: COLORS.gold }, 'Think you can beat it?'),
        node('div', { fontSize: 24, color: '#d8ccae', fontWeight: 700 }, 'tickgains.com'),
      ]),
    ],
  )
}

/** getWeeklyCardData (Overall) -> PNG Buffer. */
export async function renderChallengeCardPng(data) {
  return renderPng(await buildChallengeCardTree(data))
}

// --- Goal card ---------------------------------------------------------------------------------------------------

const TARGET = ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z', 'M12 12.8a.8.8 0 100-1.6.8.8 0 000 1.6z']

async function buildGoalCardTree({ displayName, goal }) {
  const skillUri = await skillIconDataUri(goal.skill)
  const done = goal.reached
  const pct = Math.max(Math.min(goal.percent, 100), 0)
  const barW = 700

  const badge = node(
    'div',
    { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 280, height: 280, borderRadius: 140, backgroundColor: '#2a2314', border: `4px solid ${done ? COLORS.green : COLORS.gold}`, boxShadow: '0 0 80px rgba(240, 201, 118, 0.3)' },
    [skillUri ? image(skillUri, 140, 140) : svgIcon(150, COLORS.gold, TARGET, { stroke: true })],
  )

  const bar = node('div', { display: 'flex', width: barW, height: 34, borderRadius: 17, backgroundColor: '#0e0c09', border: `2px solid ${COLORS.border}`, overflow: 'hidden' }, [
    node('div', { display: 'flex', width: Math.max((barW - 4) * (pct / 100), pct > 0 ? 30 : 0), height: '100%', backgroundColor: done ? COLORS.green : COLORS.gold, borderRadius: 15 }, ''),
  ])

  return node(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 56px',
      backgroundColor: '#16130e',
      backgroundImage: 'radial-gradient(circle at 82% 45%, #3a2e14 0%, #1d1810 42%, #0e0c09 100%)',
      fontFamily: 'Plus Jakarta Sans',
      color: COLORS.cream,
    },
    [
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', alignItems: 'center', gap: 12 }, [
          svgIcon(34, COLORS.gold, TARGET, { stroke: true }),
          node('div', { fontSize: 22, fontWeight: 800, color: COLORS.gold, letterSpacing: '0.14em', textTransform: 'uppercase' }, done ? 'Goal reached' : 'Goal'),
        ]),
        brandBadge(),
      ]),

      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }, [
          node('div', { fontSize: 40, fontWeight: 800, color: COLORS.gold }, displayName),
          node('div', { fontSize: 100, fontWeight: 800, color: COLORS.cream, lineHeight: 1.05, marginTop: 6 }, goal.title),
          node('div', { display: 'flex', alignItems: 'center', gap: 18, marginTop: 22 }, [
            bar,
            node('div', { fontSize: 44, fontWeight: 800, color: done ? COLORS.green : COLORS.gold }, `${pct}%`),
          ]),
          node('div', { fontSize: 26, color: COLORS.muted, marginTop: 14 }, done ? 'Done!' : `${formatXp(goal.currentXp)} of ${formatXp(goal.targetXp)} XP`),
        ]),
        badge,
      ]),

      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { fontSize: 30, fontWeight: 800, color: COLORS.gold }, done ? 'Next stop: the next goal.' : 'Follow my progress.'),
        node('div', { fontSize: 24, color: '#d8ccae', fontWeight: 700 }, 'tickgains.com'),
      ]),
    ],
  )
}

/** { displayName, goal } (see goals.service.js) -> PNG Buffer. */
export async function renderGoalCardPng(data) {
  return renderPng(await buildGoalCardTree(data))
}

// --- Profile preview card (what a pasted profile link unfurls into) -------------------------------------------------

import { avatarFor } from '../utils/avatar.js'

const SHIELD = ['M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z']

// The generated pixel picture, drawn the same way the site draws it, so a shared link shows the same face.
function pixelAvatar(name, size) {
  const art = avatarFor(name)
  return node('div', { display: 'flex', width: size, height: size, backgroundImage: `linear-gradient(145deg, ${art.palette.bg1}, ${art.palette.bg2})` }, [
    {
      type: 'svg',
      props: {
        width: size,
        height: size,
        viewBox: '0 0 7 7',
        children: art.cells.map((c) => ({ type: 'rect', props: { x: c.x, y: c.y, width: 1, height: 1, fill: art.palette.fg, fillOpacity: c.o } })),
      },
    },
  ])
}

const chip = (children) =>
  node('div', { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderRadius: 999, backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}`, fontSize: 24, color: COLORS.cream }, children)

async function buildProfileCardTree(d) {
  const [highestIcon, ...skillIcons] = await Promise.all([d.highest ? skillIconDataUri(d.highest.skill) : null, ...d.topSkills.map((s) => skillIconDataUri(s.skill))])
  const AV = 230
  const picture = node(
    'div',
    { display: 'flex', width: AV, height: AV, borderRadius: 44, overflow: 'hidden', border: `4px solid ${COLORS.gold}`, boxShadow: '0 0 70px rgba(240, 201, 118, 0.3)', flexShrink: 0 },
    [d.photo ? image(d.photo, AV - 8, AV - 8) : pixelAvatar(d.username, AV - 8)],
  )

  // The marks next to the name: the gold shield for founders and admins, a green tick for any other claimed profile.
  const marks = d.badge
    ? [svgIcon(46, COLORS.gold, SHIELD)]
    : d.claimed
      ? [node('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.green }, [svgIcon(28, '#16130e', ['M5.5 12.5l4 4 9-9.5'], { stroke: true })])]
      : []

  const stats = [
    chip([node('div', { display: 'flex', color: COLORS.muted }, 'Overall'), node('div', { display: 'flex', fontWeight: 800 }, d.overallLevel.toLocaleString('en-US'))]),
    chip([node('div', { display: 'flex', fontWeight: 800 }, formatXp(d.overallXp)), node('div', { display: 'flex', color: COLORS.muted }, 'XP')]),
    ...(d.overallRank ? [chip([node('div', { display: 'flex', color: COLORS.muted }, 'Rank'), node('div', { display: 'flex', fontWeight: 800 }, `#${d.overallRank.toLocaleString('en-US')}`)])] : []),
  ]

  // The headline: this week's gain when there is one, otherwise the player's strongest skill.
  const headline = d.weekXp > 0
    ? [node('div', { fontSize: 78, fontWeight: 800, color: COLORS.green, lineHeight: 1 }, `+${formatXp(d.weekXp)}`), node('div', { fontSize: 30, fontWeight: 700, color: COLORS.muted, marginLeft: 14, marginTop: 28 }, 'XP this week')]
    : d.highest
      ? [node('div', { fontSize: 60, fontWeight: 800, color: COLORS.gold, lineHeight: 1.1 }, `${d.highest.skill} ${d.highest.level}`), node('div', { fontSize: 28, fontWeight: 700, color: COLORS.muted, marginLeft: 14, marginTop: 22 }, 'highest skill')]
      : []

  const topChips = d.topSkills.map((s, i) =>
    chip([skillIcons[i] ? image(skillIcons[i], 28, 28) : null, node('div', { display: 'flex' }, s.skill), node('div', { display: 'flex', color: COLORS.green, fontWeight: 800 }, `+${formatXp(s.xp)}`)].filter(Boolean)),
  )
  if (!topChips.length && d.highest && d.weekXp > 0) topChips.push(chip([highestIcon ? image(highestIcon, 30, 30) : null, node('div', { display: 'flex' }, `Highest: ${d.highest.skill} ${d.highest.level}`)].filter(Boolean)))

  return node(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '40px 56px',
      backgroundColor: '#16130e',
      backgroundImage: 'radial-gradient(circle at 18% 40%, #3a2e14 0%, #1d1810 45%, #0e0c09 100%)',
      fontFamily: 'Plus Jakarta Sans',
      color: COLORS.cream,
    },
    [
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { fontSize: 22, fontWeight: 800, color: COLORS.gold, letterSpacing: '0.14em', textTransform: 'uppercase' }, 'OSRS player profile'),
        brandBadge(),
      ]),

      node('div', { display: 'flex', alignItems: 'center', gap: 44 }, [
        picture,
        node('div', { display: 'flex', flexDirection: 'column', flex: 1 }, [
          node('div', { display: 'flex', alignItems: 'center', gap: 16 }, [node('div', { fontSize: 72, fontWeight: 800, color: COLORS.gold, lineHeight: 1.05 }, d.displayName), ...marks]),
          node('div', { display: 'flex', gap: 12, marginTop: 18 }, stats),
          node('div', { display: 'flex', alignItems: 'baseline', marginTop: 26 }, headline),
          ...(topChips.length ? [node('div', { display: 'flex', gap: 10, marginTop: 22 }, topChips)] : []),
        ]),
      ]),

      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { fontSize: 28, fontWeight: 800, color: COLORS.gold }, 'XP history, records, goals and more'),
        node('div', { fontSize: 24, color: '#d8ccae', fontWeight: 700 }, 'tickgains.com'),
      ]),
    ],
  )
}

/** getProfileCardData(...) -> PNG Buffer. */
export async function renderProfileCardPng(data) {
  return renderPng(await buildProfileCardTree(data))
}

// --- Shared plan card (what a pasted plan link unfurls into) -----------------------------------------------------------

const planHours = (h) => (h == null ? '-' : h >= 100 ? `${Math.round(h).toLocaleString('en-US')} h` : `${parseFloat(h.toFixed(1))} h`)
const planGp = (gp) => {
  if (gp == null) return 'No GP data'
  const abs = Math.abs(gp)
  const n = abs >= 1e9 ? `${parseFloat((abs / 1e9).toFixed(2))}B` : abs >= 1e6 ? `${parseFloat((abs / 1e6).toFixed(1))}M` : abs >= 1e3 ? `${parseFloat((abs / 1e3).toFixed(1))}K` : String(abs)
  return `${gp >= 0 ? '+' : '-'}${n} gp`
}
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

async function buildPlanCardTree({ name, rsn, mode, summary, plan }) {
  const goals = summary.goals?.length ? summary.goals : plan.goals.map((g) => ({ skill: g.skill, fromLevel: 1, toLevel: 99 }))
  const shown = goals.slice(0, 10)
  const icons = await Promise.all(shown.map((g) => skillIconDataUri(g.skill)))
  const title = clip(name, 40)
  const tile = (label, value, color) =>
    node('div', { display: 'flex', flexDirection: 'column', padding: '14px 22px', borderRadius: 18, backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}`, flexShrink: 0 }, [
      node('div', { fontSize: 20, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }, label),
      node('div', { display: 'flex', fontSize: 40, fontWeight: 800, color, marginTop: 4, whiteSpace: 'nowrap' }, value),
    ])
  const days = summary.days != null ? `${summary.days.toLocaleString('en-US')} day${summary.days === 1 ? '' : 's'}` : '-'

  return node(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '44px 56px',
      backgroundColor: '#16130e',
      backgroundImage: 'radial-gradient(circle at 85% 20%, #3a2e14 0%, #1d1810 45%, #0e0c09 100%)',
      fontFamily: 'Plus Jakarta Sans',
      color: COLORS.cream,
    },
    [
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', alignItems: 'center', gap: 14 }, [
          node('div', { fontSize: 22, fontWeight: 800, color: COLORS.gold, letterSpacing: '0.14em', textTransform: 'uppercase' }, 'Training plan'),
          node('div', { display: 'flex', fontSize: 20, fontWeight: 700, color: mode === 'live' ? COLORS.green : COLORS.muted, padding: '4px 14px', borderRadius: 999, border: `1px solid ${mode === 'live' ? COLORS.green : COLORS.border}` }, mode === 'live' ? 'Live progress' : 'Static plan'),
        ]),
        brandBadge(),
      ]),

      node('div', { display: 'flex', flexDirection: 'column' }, [
        node('div', { display: 'flex', fontSize: title.length > 24 ? 62 : 80, fontWeight: 800, color: COLORS.cream, lineHeight: 1.05 }, title),
        rsn ? node('div', { display: 'flex', fontSize: 34, fontWeight: 700, color: COLORS.gold, marginTop: 8 }, `by ${rsn}`) : null,
        node(
          'div',
          { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 },
          [
            ...shown.map((g, i) =>
              node('div', { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}`, fontSize: 24, fontWeight: 700 }, [
                icons[i] ? image(icons[i], 28, 28) : null,
                node('div', { display: 'flex' }, `${g.toLevel}`),
              ].filter(Boolean)),
            ),
            goals.length > shown.length ? node('div', { display: 'flex', alignItems: 'center', fontSize: 22, color: COLORS.muted, padding: '6px 8px' }, `+${goals.length - shown.length} more`) : null,
          ].filter(Boolean),
        ),
      ].filter(Boolean)),

      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }, [
        node('div', { display: 'flex', gap: 14 }, [
          tile('Training time', planHours(summary.totalHours), COLORS.cream),
          tile('Net GP', planGp(summary.netGp), summary.netGp != null && summary.netGp < 0 ? '#e58a7c' : COLORS.green),
          tile(`At ${plan.hoursPerDay} h/day`, days, COLORS.gold),
        ]),
        node('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }, [
          node('div', { display: 'flex', fontSize: 24, fontWeight: 800, color: COLORS.gold, whiteSpace: 'nowrap' }, 'Use this plan, free'),
          node('div', { display: 'flex', fontSize: 22, color: '#d8ccae', fontWeight: 700, marginTop: 4 }, 'tickgains.com'),
        ]),
      ]),
    ],
  )
}

/** A public share (see sharedPlans.js publicShape) -> PNG Buffer. */
export async function renderPlanCardPng(share) {
  return renderPng(await buildPlanCardTree(share))
}
