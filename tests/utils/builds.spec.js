import { describe, expect, it } from 'vitest'
import { BUILDS, IRON_KINDS, buildOf, cleanBuild, cleanIronKind } from '@/data/builds'
import { getQuest } from '@/data/quests'
import { getMethod, methodsForSkill } from '@/data/trainingMethods'
import { methodBlockReason, accountLabel, applyRules, buildMaxTotal, capXp, detectBuild, isLocked, lockedSkills, methodFits, questFitsBuild, ruleIdsFor, skillCap, trainableSkills } from '@/utils/builds'
import { SKILL_NAMES } from '@/utils/osrsSkills'
import { xpAtLevel } from '@/utils/planner'

const goal = (skill, from, to, extra = {}) => ({ skill, currentXp: xpAtLevel(from), targetXp: xpAtLevel(to), methodId: 'global', customXpPerHour: 0, quests: [], ...extra })

describe('the builds', () => {
  it('are a short fixed list, with unknown keys falling back to the plain account', () => {
    expect(BUILDS.map((b) => b.key)).toEqual(['main', 'skiller', 'pure', 'zerker'])
    expect(IRON_KINDS.map((k) => k.key)).toEqual(['standard', 'hardcore', 'ultimate', 'group'])
    expect(cleanBuild('pure')).toBe('pure')
    expect(cleanBuild('nonsense')).toBe('main')
    expect(cleanIronKind('hardcore')).toBe('hardcore')
    expect(cleanIronKind(undefined)).toBe('standard')
    expect(buildOf('zzz').key).toBe('main')
  })
})

describe('what each build locks and caps', () => {
  it('a level 3 skiller never trains combat skills or Slayer, and Hitpoints stays at 10', () => {
    for (const s of ['Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic', 'Slayer', 'Hitpoints']) expect(isLocked('skiller', s), s).toBe(true)
    for (const s of ['Mining', 'Agility', 'Runecraft', 'Sailing', 'Construction']) expect(isLocked('skiller', s), s).toBe(false)
    expect(skillCap('skiller', 'Hitpoints')).toBe(10)
    expect(skillCap('skiller', 'Mining')).toBe(99)
    expect(lockedSkills('skiller')).toHaveLength(8)
    expect(trainableSkills('skiller')).toHaveLength(SKILL_NAMES.length - 8)
  })
  it('a 1 Defence pure locks Defence and stops Prayer at 52; a zerker stops Defence at 45', () => {
    expect(isLocked('pure', 'Defence')).toBe(true)
    expect(isLocked('pure', 'Prayer')).toBe(false)
    expect(skillCap('pure', 'Prayer')).toBe(52)
    expect(skillCap('pure', 'Strength')).toBe(99)
    expect(isLocked('zerker', 'Defence')).toBe(false)
    expect(skillCap('zerker', 'Defence')).toBe(45)
    expect(capXp('zerker', 'Defence')).toBe(xpAtLevel(45))
  })
  it('the max total counts every skill at its cap', () => {
    expect(buildMaxTotal('main')).toBe(SKILL_NAMES.length * 99)
    const skiller = SKILL_NAMES.reduce((sum, s) => sum + (isLocked('skiller', s) ? (s === 'Hitpoints' ? 10 : 1) : 99), 0)
    expect(buildMaxTotal('skiller')).toBe(skiller)
    expect(buildMaxTotal('pure')).toBe(SKILL_NAMES.length * 99 - 98 - 47)
  })
})

describe('methods a build can use', () => {
  it('everything is allowed on a plain account', () => {
    for (const m of methodsForSkill('Mining')) expect(methodFits(m, { build: 'main' }), m.id).toBe(true)
  })
  it('a skiller loses methods that need Magic or a combat level, and anything in the Wilderness', () => {
    expect(methodFits(getMethod('runecraft-ourania'), { build: 'skiller' })).toBe(false)
    expect(methodFits(getMethod('agility-wilderness'), { build: 'skiller' })).toBe(false)
    expect(methodFits(getMethod('mining-amethyst'), { build: 'skiller' })).toBe(true)
    expect(methodFits(getMethod('agility-draynor'), { build: 'skiller' })).toBe(true)
  })
  it('a skiller cannot train a locked skill at all', () => {
    for (const m of methodsForSkill('Slayer')) expect(methodFits(m, { build: 'skiller' })).toBe(false)
    expect(ruleIdsFor('Slayer', { build: 'skiller' })).toEqual([])
  })
  it('a pure cannot use a method that needs Defence, but can use everything else', () => {
    expect(methodFits(getMethod('mining-amethyst'), { build: 'pure' })).toBe(true)
    expect(methodsForSkill('Defence').every((m) => !methodFits(m, { build: 'pure' }))).toBe(true)
  })
  it('only a hardcore ironman loses the Wilderness methods', () => {
    expect(methodFits(getMethod('agility-wilderness'), { build: 'main', iron: true, ironKind: 'hardcore' })).toBe(false)
    expect(methodFits(getMethod('agility-wilderness'), { build: 'main', iron: true, ironKind: 'standard' })).toBe(true)
    expect(methodFits(getMethod('agility-wilderness'), { build: 'main', iron: false, ironKind: 'hardcore' })).toBe(true)
  })
})

describe('quests a build can do', () => {
  it('anything goes on a plain account', () => {
    expect(questFitsBuild(getQuest("cook's-assistant"), 'main')).toBe(true)
  })
  it('a quest with no fight and no combat reward suits a skiller', () => {
    expect(questFitsBuild(getQuest("cook's-assistant"), 'skiller')).toBe(true)
  })
  it('a quest that needs a fight does not suit a skiller', () => {
    expect(questFitsBuild(getQuest("olaf's-quest"), 'skiller')).toBe(false)
  })
  it('a quest that gives Defence experience does not suit a pure, but suits a zerker while it stays under 45', () => {
    expect(getQuest("olaf's-quest").rewards.Defence).toBeGreaterThan(0)
    expect(questFitsBuild(getQuest("olaf's-quest"), 'pure')).toBe(false)
    expect(questFitsBuild(getQuest("olaf's-quest"), 'zerker')).toBe(true)
  })
})

describe('applyRules', () => {
  const free = () => null
  it('drops the goals of locked skills, holds a target at the cap and drops a goal that is already there', () => {
    const goals = [goal('Attack', 1, 99), goal('Mining', 1, 99), goal('Prayer', 1, 99), goal('Defence', 1, 99)]
    const pure = applyRules(goals, { build: 'pure' }, null, free)
    expect(pure.map((g) => g.skill)).toEqual(['Attack', 'Mining', 'Prayer'])
    expect(pure.find((g) => g.skill === 'Prayer').targetXp).toBe(xpAtLevel(52))
    const skiller = applyRules(goals, { build: 'skiller' }, null, free)
    expect(skiller.map((g) => g.skill)).toEqual(['Mining'])
    expect(applyRules([goal('Prayer', 60, 99)], { build: 'pure' }, null, free)).toEqual([])
  })
  it('limits a goal to the methods the build allows, and returns the same list when nothing is ruled out', () => {
    const [g] = applyRules([goal('Runecraft', 1, 99)], { build: 'skiller' }, null, free)
    expect(g.allowedMethodIds).toBeTruthy()
    expect(g.allowedMethodIds).not.toContain('runecraft-ourania')
    const plain = [goal('Mining', 1, 99)]
    expect(applyRules(plain, { build: 'main' }, null, free)).toEqual(plain)
  })
  it('takes a limit that only the old rules set off again, but keeps one the person chose', () => {
    const skiller = { build: 'skiller' }
    const [limited] = applyRules([goal('Runecraft', 1, 99)], skiller, null, free)
    const [back] = applyRules([limited], { build: 'main' }, skiller, free)
    expect(back.allowedMethodIds).toBeUndefined()
    const mine = goal('Runecraft', 1, 99, { allowedMethodIds: ['runecraft-ourania', 'runecraft-early'] })
    const [kept] = applyRules([mine], skiller, null, free)
    expect(kept.allowedMethodIds).toEqual(['runecraft-early'])
  })
  it('free-to-play and a build work together', () => {
    const freeIds = (skill) => methodsForSkill(skill).slice(0, 3).map((m) => m.id)
    const [g] = applyRules([goal('Mining', 1, 99)], { members: false, build: 'skiller' }, null, freeIds)
    expect(g.allowedMethodIds.length).toBeLessThanOrEqual(3)
    expect(g.allowedMethodIds.every((id) => freeIds('Mining').includes(id))).toBe(true)
  })
})

describe('detectBuild', () => {
  const base = Object.fromEntries(SKILL_NAMES.map((s) => [s, s === 'Hitpoints' ? 10 : 1]))
  it('spots a level 3 skiller, a 1 Defence pure and a zerker from their levels', () => {
    expect(detectBuild({ ...base, Mining: 80, Agility: 70 })).toBe('skiller')
    expect(detectBuild({ ...base, Attack: 60, Strength: 99, Hitpoints: 80, Ranged: 90 })).toBe('pure')
    expect(detectBuild({ ...base, Attack: 75, Strength: 85, Defence: 45, Hitpoints: 80 })).toBe('zerker')
    expect(detectBuild({ ...base, Attack: 90, Strength: 90, Defence: 80, Hitpoints: 90 })).toBeNull()
  })
  it('says nothing without a full set of levels', () => {
    expect(detectBuild(null)).toBeNull()
    expect(detectBuild({ Mining: 5 })).toBeNull()
  })
})

describe('accountLabel', () => {
  it('names the account in one line', () => {
    expect(accountLabel({})).toBe('Members')
    expect(accountLabel({ members: false, build: 'pure' })).toBe('Free-to-play · 1 Defence pure')
    expect(accountLabel({ iron: true, ironKind: 'hardcore', build: 'skiller' }, { hardcore: 'Hardcore ironman' })).toBe('Members · Hardcore ironman · Level 3 skiller')
  })
})

describe('methodBlockReason', () => {
  it('says why a method is out, in words for the picker', () => {
    expect(methodBlockReason(getMethod('runecraft-ourania'), { build: 'skiller' })).toBe('Not for a level 3 skiller')
    expect(methodBlockReason(getMethod('agility-wilderness'), { build: 'main', iron: true, ironKind: 'hardcore' })).toBe('Too risky for a hardcore ironman')
    expect(methodBlockReason(getMethod('mining-amethyst'), { build: 'skiller' })).toBe('')
  })
})

describe('free-to-play locks members content', () => {
  it('locks members-only skills and keeps the free ones', async () => {
    const { isLocked, lockedSkills, lockReason, skillCap } = await import('../../src/utils/builds.js')
    expect(isLocked({ members: false, build: 'main' }, 'Slayer')).toBe(true)
    expect(isLocked({ members: false, build: 'main' }, 'Mining')).toBe(false)
    expect(isLocked({ members: true, build: 'main' }, 'Slayer')).toBe(false)
    expect(lockReason({ members: false, build: 'main' }, 'Herblore')).toBe('members')
    expect(lockReason({ members: false, build: 'skiller' }, 'Attack')).toBe('build')
    expect(skillCap({ members: false }, 'Farming')).toBe(1)
    expect(lockedSkills({ members: false, build: 'main' })).toContain('Agility')
    expect(lockedSkills('main')).toEqual([])
  })
  it('leaves out members quests, and the goals for members skills, when free-to-play', async () => {
    const { questFitsBuild, applyRules } = await import('../../src/utils/builds.js')
    const { QUESTS } = await import('../../src/data/quests.js')
    const free = { members: false, build: 'main' }
    const fits = QUESTS.filter((q) => questFitsBuild(q, free))
    expect(fits.length).toBeLessThan(QUESTS.length)
    expect(QUESTS.every((q) => questFitsBuild(q, { members: true, build: 'main' }))).toBe(true)
    const goals = [{ skill: 'Mining', currentXp: 0, targetXp: 1000 }, { skill: 'Slayer', currentXp: 0, targetXp: 1000 }]
    expect(applyRules(goals, free).map((g) => g.skill)).toEqual(['Mining'])
  })
  it('gives free-to-play recommended plans only the free skills', async () => {
    const { recommendedPlans } = await import('../../src/utils/recommendedPlans.js')
    const { F2P_SKILLS } = await import('../../src/data/plannerMilestones.js')
    const plans = recommendedPlans(null, { build: 'main', members: false })
    expect(plans.length).toBeGreaterThan(0)
    for (const p of plans) for (const g of p.goals) expect(F2P_SKILLS).toContain(g.skill)
    expect(plans.find((p) => p.id === 'all-70').title).toBe('All free-to-play skills to 70')
  })
})
