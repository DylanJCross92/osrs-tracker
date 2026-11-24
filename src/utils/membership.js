// Free-to-play or members, for a plan. A free-to-play plan only trains with free methods (the ones the wiki's free-to-play guides show, see
// data/plannerMilestones.js), which it does by giving each goal the list of methods it may use (`allowedMethodIds`, the same field the Smart
// Planner uses). The plan keeps one flag (`members: false` for free-to-play) so the choice shows in its settings and survives a reload.
import { F2P_METHOD_IDS, F2P_SKILLS } from '@/data/plannerMilestones'
import { methodsForSkill } from '@/data/trainingMethods'

/** The methods a free-to-play player can use for a skill (none for a members-only skill). */
export const freeMethodIds = (skill) => (F2P_SKILLS.includes(skill) ? methodsForSkill(skill).filter((m) => F2P_METHOD_IDS.has(m.id)).map((m) => m.id) : [])

const sameSet = (a, b) => a.length === b.length && a.every((id) => b.includes(id))

/**
 * The goals for a free-to-play plan (`members` false) or a members one. Free-to-play: each goal may only use free methods (a goal already limited to
 * some methods keeps those that are free). Members: the limit that free-to-play put there is taken off again (a limit chosen for another reason, like
 * AFK-only methods, stays). Goals with no free methods (a members skill) are left as they are.
 */
export function applyMembership(goals, members) {
  return (goals || []).map((g) => {
    const free = freeMethodIds(g.skill)
    const has = Array.isArray(g.allowedMethodIds) ? g.allowedMethodIds : []
    if (members === false) {
      if (!free.length) return g
      const kept = has.filter((id) => free.includes(id))
      const allowed = kept.length ? kept : free
      return sameSet(allowed, has) ? g : { ...g, allowedMethodIds: allowed }
    }
    if (has.length && free.length && sameSet(free, has)) {
      const { allowedMethodIds, ...rest } = g
      return rest
    }
    return g
  })
}

/** The skills in a plan that a free-to-play player has no route for (members-only skills, or no free method listed yet), in plan order. */
export function skillsWithoutFreeRoute(goals) {
  return (goals || []).filter((g) => !freeMethodIds(g.skill).length).map((g) => g.skill)
}
