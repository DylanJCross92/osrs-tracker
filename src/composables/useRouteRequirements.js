import { computed, inject, unref } from 'vue'
import { plannerRequirementContext } from '@/composables/plannerRequirementContext'
import { methodAvailability } from '@/utils/requirements'

/**
 * What every method a plan's route uses needs (levels, quests, items), and whether the player has it:
 * [{ method, state, items, unmet }] for the methods that have requirements. `picked` is a method chosen by hand that may not be in the
 * route. Used by the skill editor and by the path card's details, so both say the same thing.
 */
export function useRouteRequirements(plan, picked = null) {
  const reqCtx = inject(plannerRequirementContext, null)
  const routeMethods = computed(() => {
    const seen = new Map()
    const ctx = reqCtx?.value || {}
    for (const seg of unref(plan)?.segments || []) {
      const m = seg.method
      if (m?.id && m.requirements && !seen.has(m.id)) seen.set(m.id, methodAvailability(m, ctx))
    }
    const p = unref(picked)
    if (p?.requirements && !seen.has(p.id)) seen.set(p.id, methodAvailability(p, ctx))
    return [...seen.values()].filter((a) => a.items.length)
  })
  const routeState = computed(() => {
    const states = routeMethods.value.map((a) => a.state)
    return states.includes('blocked') ? 'blocked' : states.includes('unconfirmed') ? 'unconfirmed' : 'available'
  })
  return { routeMethods, routeState }
}
