// Builds src/data/diaryData.generated.js from the OSRS Wiki: the twelve Achievement Diaries, four tiers each, with the skill levels, quests
// and quest points a tier needs, the rewards it gives and its task list.
//
//   node scripts/build-diary-data.mjs            fetch from the Wiki (twelve small requests)
//   node scripts/build-diary-data.mjs --cache d   keep and reuse the downloaded pages in folder d
//
// Run by hand when the Wiki changes; the result is committed and reviewed (git diff). Nothing here runs on the site. Anything the Wiki does
// not say is left out; nothing is guessed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://oldschool.runescape.wiki/api.php'
const UA = 'TickGains diary data build script (run by hand)'
const DELAY_MS = 350
const here = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(here, '..', 'src', 'data', 'diaryData.generated.js')
const cacheArg = process.argv.indexOf('--cache')
const cacheDir = cacheArg > -1 ? process.argv[cacheArg + 1] : path.join(os.tmpdir(), 'tickgains-diary-cache')
fs.mkdirSync(cacheDir, { recursive: true })

const SKILLS = ['Attack', 'Defence', 'Strength', 'Hitpoints', 'Ranged', 'Prayer', 'Magic', 'Cooking', 'Woodcutting', 'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving', 'Slayer', 'Farming', 'Runecraft', 'Hunter', 'Construction', 'Sailing']
const REGIONS = ['Karamja', 'Ardougne', 'Falador', 'Fremennik', 'Kandarin', 'Kourend & Kebos', 'Lumbridge & Draynor', 'Morytania', 'Varrock', 'Western Provinces', 'Wilderness', 'Desert']
const TIERS = ['Easy', 'Medium', 'Hard', 'Elite']

// The quests and miniquests of the tracker (src/data/questList.js): the only names that count as quests here. A link to anything else in a tier's
// requirements (the Fight Cave, a music track) is kept apart as "other".
const listSource = fs.readFileSync(path.join(here, '..', 'src', 'data', 'questList.js'), 'utf8')
const QUESTS = [...listSource.matchAll(/\[\s*"((?:[^"\\]|\\.)*)"\s*,\s*'(?:F|M|MQ)'\s*\]/g)].map((m) => m[1])
const normName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const BY_NORM = new Map(QUESTS.map((q) => [normName(q), q]))
// Names the Wiki links that are a quest under another title, or a part of one.
const ALIASES = { 'Knight Waves Training Grounds': 'Knight Waves', 'Between a Rock...': 'Between a Rock...' }
function asQuest(name) {
  const base = ALIASES[name] || name.split('/')[0]
  return BY_NORM.get(normName(base)) || null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function wikitext(page) {
  const file = path.join(cacheDir, `${page.replace(/[^a-z0-9]+/gi, '_')}.txt`)
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&redirects=1&format=json&formatversion=2`
  await sleep(DELAY_MS)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`)
  const text = (await res.json())?.parse?.wikitext
  if (typeof text !== 'string') throw new Error(`${page}: no wikitext`)
  fs.writeFileSync(file, text)
  return text
}

/** Wiki markup to plain text: links to their words, a skill template to "40 Magic", notes and other templates dropped. */
function clean(s) {
  let t = String(s)
  t = t.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '').replace(/\{\{efn\|[\s\S]*?\}\}/gi, '')
  t = t.replace(/\{\{SCP\|([A-Za-z]+)\|(\d+)[^}]*\}\}/g, '$2 $1')
  t = t.replace(/\{\{SCP\|[^}]*\}\}/g, '')
  t = t.replace(/\{\{(?:Coins|coins)\|([\d,]+)\}\}/g, '$1 coins')
  // Templates inside templates (prices, rune counts): take the innermost away, a few times over.
  for (let i = 0; i < 5; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '')
  t = t.replace(/\*\d+ round \d+\}\}/g, '').replace(/\{\{|\}\}/g, '')
  t = t.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
  t = t.replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return t
}
const linkNames = (s) => [...String(s).matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].replace(/_/g, ' ').trim())

/** The text between a "==Tier==" heading and the next top-level heading. */
function section(text, name) {
  const m = text.match(new RegExp(`\\n==\\s*${name}\\s*==\\s*\\n`))
  if (!m) return ''
  const start = m.index + m[0].length
  const rest = text.slice(start)
  const next = rest.search(/\n==[^=]/)
  return next === -1 ? rest : rest.slice(0, next)
}

/** The overview tabber, split per tier. */
function overviewTier(text, tier) {
  const ov = section(text, 'Overview')
  const re = new RegExp(`\\|-\\|\\s*\\n\\s*${tier}\\s*=([\\s\\S]*?)(?=\\n\\|-\\|\\s*\\n\\s*(?:Easy|Medium|Hard|Elite)\\s*=|</tabber>|$)`)
  return (ov.match(re) || [])[1] || ''
}

function parseTier(text, tier) {
  const ov = overviewTier(text, tier)
  const skills = {}
  let qp = 0
  let allQuests = false
  const box = ov.match(/\{\{DiarySkillStats([\s\S]*?)\n\}\}/)
  if (box) {
    // "Quest = {{Globals|quest points}}": every quest point there is, so every quest.
    if (/\|\s*Quest\s*=\s*\{\{Globals/i.test(box[1])) allQuests = true
    for (const line of box[1].split('\n')) {
      const m = line.match(/^\s*\|\s*([A-Za-z]+)\s*=\s*(\d+)/)
      if (!m) continue
      if (SKILLS.includes(m[1])) skills[m[1]] = Number(m[2])
      else if (m[1] === 'Quest') qp = Number(m[2])
      else if (m[1] === 'Combat') skills.Combat = Number(m[2])
    }
  }
  const quests = []
  const partial = []
  // Quests that must be finished: the "Quest requirements" table rows.
  for (const m of ov.matchAll(/data-rowid="([^"]+)"/g)) quests.push(m[1].replace(/_/g, ' '))
  // The "Additional requirements" list: a quest that only has to be started or partly done, or finished.
  const extra = ov.match(/Additional requirements([\s\S]*?)(?=\n\|\}|$)/)
  if (extra) {
    for (const line of extra[1].split('\n|-')) {
      const names = linkNames(line)
      if (!names.length) continue
      const plain = clean(line).replace(/^[|\s]+/, '')
      if (/^(started|partial)/i.test(plain) || /partial completion/i.test(plain)) for (const n of names) partial.push(n)
      else if (/^completion of/i.test(plain)) for (const n of names) quests.push(n)
    }
  }
  const sec = section(text, tier)
  // Rewards: the bullet list under "===Rewards===".
  const rewards = []
  const rw = sec.match(/={3}\s*Rewards\s*={3}\s*\n([\s\S]*?)(?=\n={2,3}[^=]|$)/)
  if (rw) {
    for (const line of rw[1].split('\n')) {
      const text = clean(line.replace(/^\*+/, '')).replace(/:\s*$/, '')
      if (!text) continue
      if (/^\*\*/.test(line) && rewards.length) rewards[rewards.length - 1].details.push(text)
      else if (/^\*/.test(line)) rewards.push({ text, details: [] })
    }
  }
  // Tasks: "1. Do the thing" at the start of a table row.
  const tasks = []
  for (const m of sec.matchAll(/\n\|\s*(\d+)\.\s*([^\n]*)/g)) tasks.push(clean(m[2]))
  const resolve = (names) => {
    const found = []
    const other = []
    for (const n of names) {
      const q = asQuest(n)
      if (q) found.push(q)
      else if (!/^quest$/i.test(n)) other.push(n)
    }
    return { found: [...new Set(found)], other }
  }
  const full = resolve(quests)
  const part = resolve(partial)
  return {
    skills,
    qp,
    allQuests,
    quests: full.found,
    partial: part.found.filter((n) => !full.found.includes(n)),
    // Something other than a quest the tier asks for (completing the Fight Cave, for example).
    other: [...new Set([...full.other, ...part.other])],
    rewards,
    tasks: tasks.filter(Boolean),
  }
}

const out = []
for (const region of REGIONS) {
  const page = `${region} Diary`
  const text = await wikitext(page)
  const tiers = {}
  for (const tier of TIERS) tiers[tier.toLowerCase()] = parseTier(text, tier)
  out.push({ region, url: `https://oldschool.runescape.wiki/w/${encodeURIComponent(page.replace(/ /g, '_'))}`, tiers })
  console.log(page, Object.entries(tiers).map(([k, v]) => `${k}: ${Object.keys(v.skills).length} skills, ${v.quests.length}+${v.partial.length} quests, ${v.rewards.length} rewards, ${v.tasks.length} tasks`).join(' | '))
}

const header = `// Generated by scripts/build-diary-data.mjs from the OSRS Wiki (${new Date().toISOString().slice(0, 10)}). Do not edit by hand: run the script again.
// Every Achievement Diary tier: skill levels, quest points and quests it needs (partial = only started or part way), the rewards it gives, and its tasks.
`
fs.writeFileSync(outFile, `${header}export const DIARY_DATA = ${JSON.stringify(out, null, 1)}\n`)
console.log('wrote', outFile)
