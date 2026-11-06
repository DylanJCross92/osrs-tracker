import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { skillIconDataUri, brandMarkDataUri } from './skillIcons.service.js'

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
  if (abs >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2))}M`
  if (abs >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`
  return String(Math.round(n))
}

function formatDateRange(startIso, endIso) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const sameYear = start.getFullYear() === end.getFullYear() && end.getFullYear() === new Date().getFullYear()
  const yearSuffix = sameYear ? '' : `, ${end.getFullYear()}`
  return `${fmt(start)} – ${fmt(end)}${yearSuffix}`
}

function statTile(iconUri, label, value, valueColor, children) {
  return node(
    'div',
    {
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      gap: 16,
      padding: '18px 22px',
      borderRadius: 16,
      backgroundColor: '#211c14',
      border: '1px solid #40361f',
    },
    [
      iconUri ? image(iconUri, 40, 40) : node('div', { width: 40, height: 40 }),
      node('div', { display: 'flex', flexDirection: 'column', flex: 1 }, [
        node('div', { fontSize: 17, color: '#a99a79' }, label),
        node(
          'div',
          { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 24, fontWeight: 700, color: '#ece4d3' },
          children ?? [node('div', { color: valueColor ?? '#ece4d3' }, value)],
        ),
      ]),
    ],
  )
}

async function buildOverallStats(topSkills) {
  const icons = await Promise.all(topSkills.map((s) => skillIconDataUri(s.skill)))
  return topSkills.map((s, i) =>
    statTile(icons[i], s.skill, null, null, [
      node('div', { color: '#7cb869' }, `+${formatXp(s.xp)}`),
      node('div', { fontSize: 16, color: '#a99a79' }, 'xp'),
    ]),
  )
}

function buildSkillStats(data) {
  const levelTile = statTile(
    null,
    'Level',
    null,
    null,
    [
      node('div', {}, String(data.level)),
      data.levelGained > 0 ? node('div', { fontSize: 18, color: '#7cb869' }, `+${data.levelGained}`) : null,
    ].filter(Boolean),
  )

  // Always two tiles, even when there's no rank to show — a lone tile
  // would otherwise stretch to fill the whole row and look broken.
  const rankTile =
    data.rankGained != null
      ? statTile(
          null,
          'Rank climbed',
          null,
          data.rankGained > 0 ? '#7cb869' : '#ece4d3',
          `${data.rankGained > 0 ? '+' : ''}${data.rankGained.toLocaleString()}`,
        )
      : statTile(null, 'Rank', null, '#a99a79', 'Unranked')

  return [levelTile, rankTile]
}

async function buildWeeklyCardTree(data) {
  const { displayName, skill, xpGained, periodStart, periodEnd } = data
  const isOverall = skill === 'Overall'

  const [skillIconUri, brandUri, statTiles] = await Promise.all([
    isOverall ? Promise.resolve(null) : skillIconDataUri(skill),
    brandMarkDataUri(),
    isOverall ? buildOverallStats(data.topSkills || []) : Promise.resolve(buildSkillStats(data)),
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
      padding: '48px 56px',
      backgroundColor: '#16130e',
      backgroundImage: 'radial-gradient(circle at 15% 0%, #241f15 0%, #16130e 55%, #0e0c09 100%)',
      fontFamily: 'Plus Jakarta Sans',
      color: '#ece4d3',
    },
    [
      // Header: player name (eyebrow names the skill when it isn't Overall) + brand
      node('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [
        node('div', { display: 'flex', flexDirection: 'column' }, [
          node(
            'div',
            { fontSize: 20, color: isOverall ? '#a99a79' : '#f0c976', fontWeight: isOverall ? 400 : 700, letterSpacing: '0.04em', textTransform: 'uppercase' },
            isOverall ? "This week's gains" : `${skill} — This week's gains`,
          ),
          node('div', { fontSize: 42, fontWeight: 800, color: '#f0c976', marginTop: 4 }, displayName),
        ]),
        node(
          'div',
          {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 18px',
            borderRadius: 999,
            backgroundColor: '#211c14',
            border: '1px solid #40361f',
          },
          [
            brandUri ? image(brandUri, 22, 22) : node('div', { width: 22, height: 22 }),
            node('div', { fontSize: 20, fontWeight: 700, color: '#f0c976' }, 'TickGains'),
          ],
        ),
      ]),

      // Headline xp number — the skill's own icon sits right on the number
      // when it isn't Overall, so which skill this card is about is
      // unmistakable even at a glance.
      node('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }, [
        node('div', { display: 'flex', alignItems: 'center', gap: 20 }, [
          !isOverall && skillIconUri ? image(skillIconUri, 76, 76) : null,
          node('div', { display: 'flex', alignItems: 'baseline', gap: 14 }, [
            node('div', { fontSize: 100, fontWeight: 800, color: '#7cb869', lineHeight: 1 }, `+${formatXp(xpGained)}`),
            node('div', { fontSize: 32, fontWeight: 700, color: '#a99a79' }, 'XP'),
          ]),
        ].filter(Boolean)),
        node('div', { fontSize: 24, color: '#a99a79', marginTop: 6 }, formatDateRange(periodStart, periodEnd)),
      ]),

      // Stat tiles row: top 3 skills gained (Overall) or level/rank (single skill)
      statTiles.length
        ? node('div', { display: 'flex', gap: 16 }, statTiles)
        : node('div', { display: 'flex' }, []),

      // Footer: site url
      node('div', { display: 'flex', justifyContent: 'flex-end' }, [
        node('div', { fontSize: 22, color: '#a99a79', fontWeight: 600 }, 'tickgains.com'),
      ]),
    ],
  )
}

async function renderPng(tree) {
  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts: FONTS })
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } })
  return resvg.render().asPng()
}

/** data: { displayName, xpGained, topSkill, topSkillXp, periodStart, periodEnd } -> PNG Buffer. */
export async function renderWeeklyCardPng(data) {
  const tree = await buildWeeklyCardTree(data)
  return renderPng(tree)
}
