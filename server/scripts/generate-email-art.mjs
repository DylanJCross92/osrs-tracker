// Draws the pictures used in the "claim your player" email (public/email/*.png). They are mock-ups made up for the email, not
// real players: the same look as the site, rendered with the fonts and skill icons the share cards use. Run from the server folder:
//   node scripts/generate-email-art.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { brandMarkDataUri, skillIconDataUri } from '../src/services/skillIcons.service.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fonts = path.join(here, '../src/assets/fonts')
const out = path.join(here, '../../public/email')
mkdirSync(out, { recursive: true })

const FONTS = [
  { name: 'Plus Jakarta Sans', weight: 400, style: 'normal', data: readFileSync(path.join(fonts, 'PlusJakartaSans-Regular.ttf')) },
  { name: 'Plus Jakarta Sans', weight: 700, style: 'normal', data: readFileSync(path.join(fonts, 'PlusJakartaSans-Bold.ttf')) },
  { name: 'Plus Jakarta Sans', weight: 800, style: 'normal', data: readFileSync(path.join(fonts, 'PlusJakartaSans-ExtraBold.ttf')) },
]

const C = { panel: '#211c14', page: '#15120d', border: '#40361f', text: '#ece4d3', muted: '#a99a79', gold: '#d9af52', goldBright: '#f0c976', green: '#7cb869', greenBg: '#2c3a22', rose: '#e08a8a', blue: '#6ea8e0' }
const W = 1040

const el = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } })
const box = (style, children) => el('div', style, children)
const txt = (style, s) => el('div', { fontFamily: 'Plus Jakarta Sans', ...style }, s)
const img = (src, size, extra = {}) => ({ type: 'img', props: { src, width: size, height: size, style: { width: size, height: size, ...extra } } })

const frame = (children, height) => ({ height, tree: box({ boxSizing: 'border-box', width: W, height, background: C.panel, border: `2px solid ${C.border}`, borderRadius: 28, padding: 40, flexDirection: 'column', fontFamily: 'Plus Jakarta Sans', color: C.text }, children) })

// A drawn tick (the fonts have no check mark glyph).
const tick = (size, color) => ({ type: 'svg', props: { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', children: [{ type: 'path', props: { d: 'M5 12.5l4.5 4.5L19 7.5', stroke: color, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } }] } })

const tag = (label) => txt({ fontSize: 20, fontWeight: 700, color: C.muted, letterSpacing: 2, textTransform: 'uppercase' }, label)
const bar = (pct, color = C.gold, h = 16) => box({ width: '100%', height: h, background: C.page, borderRadius: h, overflow: 'hidden' }, [box({ width: `${pct}%`, height: h, background: color, borderRadius: h })])

async function dashboard() {
  const skills = [
    ['Slayer', '+412K XP', 100],
    ['Mining', '+318K XP', 77],
    ['Runecraft', '+276K XP', 67],
  ]
  const icons = await Promise.all(skills.map((s) => skillIconDataUri(s[0])))
  const tile = (label, value, color) => box({ flex: 1, flexDirection: 'column', background: C.page, border: `2px solid ${C.border}`, borderRadius: 18, padding: '20px 24px', gap: 6 }, [tag(label), txt({ fontSize: 46, fontWeight: 800, color }, value)])
  return frame(
    [
      box({ justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, [txt({ fontSize: 34, fontWeight: 800, color: C.goldBright }, 'Your week'), txt({ fontSize: 20, color: C.muted }, 'Example dashboard')]),
      box({ gap: 18, marginBottom: 28 }, [tile('XP this week', '1.24M', C.green), tile('Streak', '12 days', C.goldBright), tile('Level ups', '3', C.text)]),
      ...skills.map((s, i) =>
        box({ alignItems: 'center', gap: 18, marginBottom: i < 2 ? 16 : 0 }, [
          img(icons[i], 40),
          txt({ width: 150, fontSize: 24, fontWeight: 700 }, s[0]),
          box({ flex: 1 }, [bar(s[2], C.green, 14)]),
          txt({ width: 140, justifyContent: 'flex-end', fontSize: 24, fontWeight: 700, color: C.green }, s[1]),
        ]),
      ),
    ],
    480,
  )
}

async function profile() {
  const mark = await brandMarkDataUri()
  const chip = (s) => txt({ fontSize: 20, fontWeight: 700, color: C.text, border: `2px solid ${C.border}`, borderRadius: 999, padding: '6px 18px' }, s)
  return frame(
    [
      box({ alignItems: 'center', gap: 26, marginBottom: 26 }, [
        box({ width: 112, height: 112, borderRadius: 56, background: C.page, border: `3px solid ${C.gold}`, alignItems: 'center', justifyContent: 'center' }, [img(mark, 64)]),
        box({ flexDirection: 'column', gap: 10 }, [
          box({ alignItems: 'center', gap: 16 }, [
            txt({ fontSize: 44, fontWeight: 800, color: C.goldBright }, 'Sir Example'),
            box({ alignItems: 'center', gap: 8, background: C.greenBg, border: `2px solid ${C.green}`, borderRadius: 999, padding: '6px 18px' }, [tick(22, C.green), txt({ fontSize: 22, fontWeight: 800, color: C.green }, 'Claimed')]),
          ]),
          txt({ fontSize: 24, color: C.muted }, 'Total level 2,104 · 312M XP · Ironman'),
        ]),
      ]),
      txt({ fontSize: 26, lineHeight: 1.45, marginBottom: 20 }, 'Grinding to max cape one skill at a time. Say hi on Discord!'),
      box({ gap: 12, marginBottom: 30 }, [chip('Discord'), chip('Twitch'), chip('YouTube')]),
      box({ flexDirection: 'column', gap: 14, background: C.page, border: `2px solid ${C.border}`, borderRadius: 18, padding: '22px 26px' }, [
        box({ justifyContent: 'space-between', alignItems: 'center' }, [
          box({ flexDirection: 'column', gap: 4 }, [tag('Goal on profile'), txt({ fontSize: 30, fontWeight: 800 }, 'Road to Max')]),
          txt({ fontSize: 54, fontWeight: 800, color: C.goldBright }, '64%'),
        ]),
        bar(64, C.gold, 20),
        txt({ fontSize: 20, color: C.muted }, '4 of 6 skills done · moves every time you gain XP'),
      ]),
    ],
    560,
  )
}

async function notifications() {
  const rows = [
    ['mining', C.gold, 'New personal record', 'Mining: 82,400 xp/h, your best yet', 'Today'],
    ['runecraft', C.rose, 'Another player congratulated you', 'on reaching level 99 Runecraft', 'Today'],
    ['slayer', C.green, 'Goal reached', 'You hit level 90 Slayer', 'Yesterday'],
  ]
  const icons = await Promise.all(rows.map((r) => skillIconDataUri(r[0])))
  return frame(
    [
      box({ justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, [txt({ fontSize: 34, fontWeight: 800, color: C.goldBright }, 'Notifications'), txt({ fontSize: 20, color: C.muted }, 'Example')]),
      ...rows.map((r, i) =>
        box({ alignItems: 'center', gap: 22, background: C.page, border: `2px solid ${C.border}`, borderRadius: 18, padding: '18px 22px', marginBottom: i < rows.length - 1 ? 14 : 0 }, [
          box({ width: 76, height: 76, borderRadius: 38, border: `3px solid ${r[1]}`, alignItems: 'center', justifyContent: 'center', background: C.panel }, [img(icons[i], 44)]),
          box({ flex: 1, flexDirection: 'column', gap: 4 }, [txt({ fontSize: 26, fontWeight: 800 }, r[2]), txt({ fontSize: 22, color: C.muted }, r[3])]),
          txt({ fontSize: 20, color: C.muted }, r[4]),
        ]),
      ),
    ],
    540,
  )
}

for (const [name, make] of [['dashboard', dashboard], ['profile', profile], ['notifications', notifications]]) {
  const { tree, height } = await make()
  const svg = await satori(tree, { width: W, height, fonts: FONTS })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng()
  writeFileSync(path.join(out, `${name}.png`), png)
  console.log(`${name}.png ${W}x${height} ${Math.round(png.length / 1024)} KB`)
}
