// Builds src/data/questData.generated.js from the OSRS Wiki: every quest that gives a set amount of experience, with its experience rewards,
// skill requirements, quest requirements, quest-point requirement, difficulty, length, recommended combat level and the strongest enemy.
//
//   node scripts/build-quest-data.mjs            fetch from the Wiki (a few hundred small requests, about a minute)
//   node scripts/build-quest-data.mjs --cache d   keep and reuse the downloaded pages in folder d (default: the system temp folder)
//
// Run by hand when the Wiki changes; the result is committed and reviewed (git diff). Nothing here runs on the site. Anything the Wiki does
// not say is left null; nothing is guessed. Requests are spaced out and say what they are, as the Wiki asks.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { questSlug } from '../src/utils/questSlug.js'

const API = 'https://oldschool.runescape.wiki/api.php'
const UA = 'TickGains quest data build script (run by hand)'
const DELAY_MS = 350
const here = path.dirname(fileURLToPath(import.meta.url))
const outFile = path.join(here, '..', 'src', 'data', 'questData.generated.js')
const cacheArg = process.argv.indexOf('--cache')
const cacheDir = cacheArg > -1 ? process.argv[cacheArg + 1] : path.join(os.tmpdir(), 'tickgains-quest-cache')
fs.mkdirSync(cacheDir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function wikitext(page) {
  const file = path.join(cacheDir, `${page.replace(/[^a-z0-9]+/gi, '_')}.txt`)
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&redirects=1&format=json&formatversion=2`
  await sleep(DELAY_MS)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`)
  const json = await res.json()
  const text = json?.parse?.wikitext
  if (typeof text !== 'string') throw new Error(`${page}: no wikitext`)
  fs.writeFileSync(file, text)
  return text
}

const SKILLS = ['Attack', 'Defence', 'Strength', 'Hitpoints', 'Ranged', 'Prayer', 'Magic', 'Cooking', 'Woodcutting', 'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving', 'Slayer', 'Farming', 'Runecraft', 'Hunter', 'Construction', 'Sailing']

const num = (s) => {
  const m = String(s || '').replace(/&nbsp;/g, ' ').match(/\d[\d,]*(?:\.\d+)?/)
  return m ? Number(m[0].replace(/,/g, '')) : null
}
const linkTarget = (s) => {
  const m = String(s || '').match(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/)
  return m ? m[1].replace(/_/g, ' ').trim() : null
}

// --- 1. Experience rewards: the Wiki's own tables, read from the page as it is shown (some tables are built by templates) ------------

async function renderedHtml(page) {
  const file = path.join(cacheDir, `${page.replace(/[^a-z0-9]+/gi, '_')}.html`)
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=text&redirects=1&format=json&formatversion=2`
  await sleep(DELAY_MS)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${page}: HTTP ${res.status}`)
  const text = (await res.json())?.parse?.text
  if (typeof text !== 'string') throw new Error(`${page}: no page`)
  fs.writeFileSync(file, text)
  return text
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&#91;/g, '[').replace(/&#93;/g, ']').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
const plain = (c) => decode(c.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const rowCells = (row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((m) => m[1])
const firstTitle = (cell) => decode(cell.match(/title="([^"]+)"/)?.[1] || '')

/**
 * { quests: Map(name -> { rewards, members, miniquest, lamps: [] }) }: the set experience (one table per skill) and, apart, the
 * experience given as a choice of skills (lamps and the like).
 */
function parseExperience(html) {
  const quests = new Map()
  const entry = (name, members, miniquest) => {
    if (!quests.has(name)) quests.set(name, { rewards: {}, members, miniquest, lamps: [] })
    return quests.get(name)
  }
  let section = null
  for (const m of html.matchAll(/<h[23][^>]*id="([^"]+)"|<table[\s\S]*?<\/table>/g)) {
    if (m[1]) {
      section = m[1]
      continue
    }
    const rows = [...m[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => rowCells(r[1]))
    const head = (rows[0] || []).map(plain)
    if (!head.includes('Quest') || !head.includes('Experience reward')) continue
    const isChoice = head.includes('Skills available')
    for (const cells of rows.slice(1)) {
      const label = plain(cells[0] || '')
      if (!label || /^total$/i.test(label)) continue
      // Parts of a quest series (Recipe for Disaster's subquests and the like) are not quests of their own here.
      if (/subquest/i.test(label)) continue
      const name = decode(firstTitle(cells[0]) || label)
      if (name.includes('/')) continue // a part of a series (Recipe for Disaster's subquests)
      const miniquest = /miniquest/i.test(label)
      if (isChoice) {
        const e = entry(name, true, miniquest)
        e.lamps.push({ xp: plain(cells[1] || ''), skills: plain(cells[2] || '') || null })
      } else if (SKILLS.includes(section)) {
        const xp = num(plain(cells[2] || ''))
        if (!xp) continue
        const e = entry(name, /yes/i.test(plain(cells[1] || '')), miniquest)
        e.rewards[section] = xp
      }
    }
  }
  return quests
}

// --- 2. A quest's own page: the "Quest details" box -------------------------------------------------------------------------------

/** The text of a {{Template ...}} starting at `from`, with braces balanced. */
function balanced(text, from) {
  let depth = 0
  for (let i = from; i < text.length; i++) {
    if (text.startsWith('{{', i)) {
      depth++
      i++
    } else if (text.startsWith('}}', i)) {
      depth--
      i++
      if (depth === 0) return text.slice(from, i + 1)
    }
  }
  return text.slice(from)
}

/** Fields of a template as { name: value }, splitting only on the | that are not inside {{ }} or [[ ]]. */
function fields(template) {
  const inner = template.slice(2, -2)
  const parts = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < inner.length; i++) {
    const two = inner.slice(i, i + 2)
    if (two === '{{' || two === '[[') {
      depth++
      cur += two
      i++
    } else if (two === '}}' || two === ']]') {
      depth--
      cur += two
      i++
    } else if (inner[i] === '|' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += inner[i]
  }
  parts.push(cur)
  const out = {}
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=')
    if (eq > -1) out[p.slice(0, eq).trim()] = p.slice(eq + 1).trim()
  }
  return out
}

const LENGTHS = ['Very Short', 'Short', 'Medium', 'Long', 'Very Long']
const DIFFICULTIES = ['Novice', 'Intermediate', 'Experienced', 'Master', 'Grandmaster', 'Special']
const pickWord = (text, list) => {
  const t = String(text || '').toLowerCase()
  // Longest first, so "Very Long" is not read as "Long".
  return [...list].sort((a, b) => b.length - a.length).find((w) => t.includes(w.toLowerCase())) || null
}

function parseDetails(text) {
  const at = text.indexOf('{{Quest details')
  if (at < 0) return null
  const f = fields(balanced(text, at))
  const infoAt = text.search(/\{\{Infobox (Quest|Miniquest)/)
  const info = infoAt > -1 ? fields(balanced(text, infoAt)) : {}
  const req = f.requirements || ''
  const reqs = {}
  let qpReq = null
  for (const m of req.matchAll(/\{\{SCP\|([A-Za-z ]+)\|(\d+)([^}]*)\}\}(\s*\{\{Boostable\|yes\}\})?/g)) {
    const skill = m[1].trim()
    if (skill === 'Quest') qpReq = Number(m[2])
    else if (SKILLS.includes(skill)) reqs[skill] = Math.max(reqs[skill] || 0, Number(m[2]))
  }
  // Quests that must be finished first: the links in the list that follows "Completion of the following quests" (nested bullets).
  const prereq = []
  const lines = req.split('\n')
  let inQuests = false
  for (const line of lines) {
    if (/Completion of the following quests|Completion of the quest|Completion of /i.test(line) && !/^\*\*/.test(line)) {
      inQuests = true
      // "Completion of [[X]]" on one line
      const one = line.match(/Completion of (?:the quest )?\[\[([^\]|#]+)/i)
      if (one) prereq.push(one[1].replace(/_/g, ' ').trim())
      continue
    }
    if (inQuests && /^\*\*/.test(line)) {
      const t = linkTarget(line)
      if (t) prereq.push(t)
    } else if (/^\*(?!\*)/.test(line)) inQuests = false
  }
  const combatMatch = String(f.recommended || '').match(/\{\{SCP\|Combat\|(\d+)/)
  const kills = String(f.kills || '')
  const levels = [...kills.matchAll(/level\s*(\d+)/gi)].map((m) => Number(m[1]))
  return {
    members: /yes/i.test(info.members || '') ? true : /no/i.test(info.members || '') ? false : null,
    difficulty: pickWord(f.difficulty, DIFFICULTIES),
    length: pickWord(f.length, LENGTHS),
    reqs,
    qpReq,
    prereq: [...new Set(prereq)],
    recommendedCombat: combatMatch ? Number(combatMatch[1]) : null,
    enemyMax: levels.length ? Math.max(...levels) : null,
    // "The ability to defeat a level 195 Jungle Demon" is a requirement, and a strong sign the fight matters
    mustDefeat: (req.match(/defeat a level (\d+)/i) || [])[1] ? Number(req.match(/defeat a level (\d+)/i)[1]) : null,
  }
}

// --- run ---------------------------------------------------------------------------------------------------------------------------

const xp = parseExperience(await renderedHtml('Quests/Experience rewards'))
console.log(`${xp.size} quests with a set experience reward`)

const out = []
const problems = []
const have = new Set()
async function addQuest(name, entry, support = false) {
  if (have.has(name)) return
  have.add(name)
  try {
    const page = await wikitext(name)
    const details = parseDetails(page)
    if (!details) problems.push(`${name}: no "Quest details" box`)
    const { members: pageMembers, ...rest } = details || { members: null, difficulty: null, length: null, reqs: {}, qpReq: null, prereq: [], recommendedCombat: null, enemyMax: null, mustDefeat: null }
    out.push({
      name,
      slug: questSlug(name),
      members: entry?.members ?? pageMembers ?? true,
      miniquest: entry?.miniquest ?? false,
      // A quest that only has to be done first (it gives no set experience itself) is kept so the time of a chain can be counted.
      ...(support ? { support: true } : {}),
      rewards: entry?.rewards ?? {},
      lamps: entry?.lamps ?? [],
      ...rest,
      url: `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_'))}`,
    })
  } catch (err) {
    problems.push(`${name}: ${err.message}`)
  }
}
for (const [name, entry] of xp) await addQuest(name, entry)
// Everything a quest needs finished first, and what those need, down to the start.
for (let i = 0; i < out.length; i++) for (const pre of out[i].prereq) await addQuest(pre, null, true)
// A prerequisite that turns out not to be a quest (a mention of Kudos, a transport system) is dropped, from the list and from what needs it.
for (let i = out.length - 1; i >= 0; i--) if (out[i].support && !out[i].length) out.splice(i, 1)
const names = new Set(out.map((q) => q.name))
for (const q of out) q.prereq = q.prereq.filter((n) => names.has(n))
out.sort((a, b) => a.name.localeCompare(b.name))

const header = `// GENERATED by scripts/build-quest-data.mjs from the OSRS Wiki (${new Date().toISOString().slice(0, 10)}). Do not edit by hand: change the script or
// put a correction in src/data/quests.js (its overrides block) and run the script again.
// Each entry: the quest, its set experience rewards, what it needs (skills, quest points, quests that must come first), how hard and how
// long the Wiki says it is, the combat level the Wiki recommends (null if it gives none) and the strongest enemy it lists. null means the Wiki did not say.
`
fs.writeFileSync(outFile, `${header}export const QUEST_DATA = ${JSON.stringify(out, null, 1)}\n`)
console.log(`wrote ${out.length} quests to ${path.relative(process.cwd(), outFile)}`)
if (problems.length) console.log(`\n${problems.length} to check by hand:\n${problems.join('\n')}`)
