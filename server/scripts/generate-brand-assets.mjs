// One-off generator for the site's brand images: app icons, favicon, and the
// 1200x630 link-preview (og:image) images. Run from /server:
//   node scripts/generate-brand-assets.mjs
// Output goes to ../public. The mark is the rising-line icon used on cards.
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'

const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(here, '../../public')
const fontsDir = path.join(here, '../src/assets/fonts')
const GOLD = '#f0c976'
const CREAM = '#ece4d3'
const MUTED = '#a99a79'
const PANEL = '#211c14'
const BORDER = '#40361f'

const markPaths = ['M3 17l6-6 4 4 8-9', 'M15 6h6v6']
const markSvgInner = (color) =>
  markPaths.map((d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('')

// App icon: rounded dark square with the mark centred.
const iconSvg = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#16130e"/><g transform="translate(17 17) scale(2.75)">${markSvgInner(GOLD)}</g></svg>`

const png = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
writeFileSync(path.join(publicDir, 'icon-512.png'), png(iconSvg(512), 512))
writeFileSync(path.join(publicDir, 'icon-192.png'), png(iconSvg(192), 192))
writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png(iconSvg(180), 180))
writeFileSync(path.join(publicDir, 'favicon.png'), png(iconSvg(48), 48))

// Header logo: mark + two-tone wordmark.
writeFileSync(
  path.join(publicDir, 'logo.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100">
  <rect x="2" y="2" width="96" height="96" rx="22" fill="#16130e" stroke="${BORDER}" stroke-width="2"/>
  <g transform="translate(19 19) scale(2.6)">${markSvgInner(GOLD)}</g>
  <text x="118" y="67" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="52" letter-spacing="-1"><tspan fill="${CREAM}">Tick</tspan><tspan fill="${GOLD}">Gains</tspan></text>
</svg>
`,
)

// --- og:image previews (satori) ---
const fonts = [
  { name: 'Plus Jakarta Sans', weight: 400, style: 'normal', data: readFileSync(path.join(fontsDir, 'PlusJakartaSans-Regular.ttf')) },
  { name: 'Plus Jakarta Sans', weight: 700, style: 'normal', data: readFileSync(path.join(fontsDir, 'PlusJakartaSans-Bold.ttf')) },
  { name: 'Plus Jakarta Sans', weight: 800, style: 'normal', data: readFileSync(path.join(fontsDir, 'PlusJakartaSans-ExtraBold.ttf')) },
]
const el = (type, style, children) => ({ type, props: { style, children } })
const mark = (size) => ({
  type: 'svg',
  props: {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    children: markPaths.map((d) => ({ type: 'path', props: { d, fill: 'none', stroke: GOLD, strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } })),
  },
})

function ogTree({ headline, sub, chips }) {
  return el(
    'div',
    {
      width: 1200, height: 630, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: '56px 72px', fontFamily: 'Plus Jakarta Sans', color: CREAM,
      backgroundColor: '#16130e', backgroundImage: 'radial-gradient(circle at 15% 0%, #2a2318 0%, #16130e 55%, #0e0c09 100%)',
    },
    [
      el('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
        el('div', { display: 'flex', padding: 14, borderRadius: 22, backgroundColor: PANEL, border: `2px solid ${BORDER}` }, [mark(56)]),
        el('div', { display: 'flex', fontSize: 52, fontWeight: 800 }, [el('div', { color: CREAM }, 'Tick'), el('div', { color: GOLD }, 'Gains')]),
      ]),
      el('div', { display: 'flex', flexDirection: 'column', gap: 18 }, [
        el('div', { fontSize: 84, fontWeight: 800, lineHeight: 1.05, color: GOLD }, headline),
        el('div', { fontSize: 34, color: MUTED, lineHeight: 1.3, maxWidth: 940 }, sub),
      ]),
      el(
        'div',
        { display: 'flex', gap: 18 },
        chips.map((c) =>
          el('div', { display: 'flex', padding: '14px 26px', borderRadius: 999, backgroundColor: PANEL, border: `1px solid ${BORDER}`, fontSize: 26, fontWeight: 700, color: CREAM }, c),
        ),
      ),
    ],
  )
}

async function writeOg(file, spec) {
  const svg = await satori(ogTree(spec), { width: 1200, height: 630, fonts })
  writeFileSync(path.join(publicDir, file), new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng())
}

await writeOg('og-default.png', {
  headline: 'OSRS XP & Hiscores Tracker',
  sub: 'Track any player’s XP gains over time, share weekly progress cards, and plan your goals.',
  chips: ['XP gains', 'Progress cards', 'Account planner'],
})
await writeOg('og-planner.png', {
  headline: 'OSRS Account Planner',
  sub: 'Plan your skill goals — see the XP, hours, GP and days it takes, using your own stats.',
  chips: ['XP remaining', 'Training hours', 'GP estimate', 'Days to goal'],
})
console.log('Brand assets written to', publicDir)
