// The OSRS experience table, for /osrs-xp-table. Every number comes from the planner's own level table, so this page can
// never disagree with the calculators. The build also runs this module (see vite.config.js) to give the server
// crawler-readable HTML for the page.
import { MAX_VIRTUAL_LEVEL, MAX_XP, formatNum, xpAtLevel } from '@/utils/planner'

export const XP_TABLE_PATH = '/osrs-xp-table'
export const XP_TABLE_TITLE = 'OSRS XP Table: XP for Every Level, 1 to 126 | TickGains'
export const XP_TABLE_DESCRIPTION = `The full OSRS XP table: XP needed for every level from 1 to 99 and on to virtual level ${MAX_VIRTUAL_LEVEL}, plus the XP between levels. Level 99 needs ${formatNum(xpAtLevel(99))} XP.`

/** One row per level: { level, xp, toNext, pctOf99 }. */
export function xpTableRows() {
  const max99 = xpAtLevel(99)
  const rows = []
  for (let level = 1; level <= MAX_VIRTUAL_LEVEL; level++) {
    const xp = xpAtLevel(level)
    rows.push({
      level,
      xp,
      toNext: level < MAX_VIRTUAL_LEVEL ? xpAtLevel(level + 1) - xp : null,
      pctOf99: Math.min(100, (xp / max99) * 100),
    })
  }
  return rows
}

/** Everything the page shows, in plain values the server can also use. */
export function buildXpTable() {
  const rows = xpTableRows()
  const xp = (l) => formatNum(xpAtLevel(l))
  const faq = [
    { q: 'How much XP do you need for level 99 in OSRS?', a: `Level 99 needs ${xp(99)} XP in a single skill. Reaching it makes up the first ninety-nine levels of the table; past that, XP keeps counting up to the 200,000,000 cap.` },
    { q: 'What level is halfway to 99 in OSRS?', a: `Level 92 is the halfway point in XP, at ${xp(92)} XP. The first ninety-one levels take about as much XP as the last seven.` },
    { q: 'How much XP is level 50 and level 70?', a: `Level 50 is ${xp(50)} XP and level 70 is ${xp(70)} XP, which is only about ${Math.round((xpAtLevel(70) / xpAtLevel(99)) * 100)}% of the way to 99 in XP terms, even though 70 sounds close to 99.` },
    { q: 'What is the most XP you can have in one skill?', a: `The cap is ${formatNum(MAX_XP)} XP per skill. Levels above 99 are virtual: virtual level ${MAX_VIRTUAL_LEVEL} is reached at ${xp(MAX_VIRTUAL_LEVEL)} XP and shows only on the hiscores and in the skill guide.` },
    { q: 'Is the XP table the same for every skill?', a: 'Yes. Every skill in Old School RuneScape uses the same table, so level 85 needs the same XP in Mining as in Cooking. What changes between skills is how quickly you can earn it, which is what the calculators are for.' },
  ]
  return {
    path: XP_TABLE_PATH,
    title: XP_TABLE_TITLE,
    description: XP_TABLE_DESCRIPTION,
    h1: 'OSRS XP Table',
    lead: `Experience needed for every level, from 1 to 99 and on to virtual level ${MAX_VIRTUAL_LEVEL}. Level 99 is ${xp(99)} XP, and level 92 is already halfway there.`,
    rows,
    faq,
  }
}
