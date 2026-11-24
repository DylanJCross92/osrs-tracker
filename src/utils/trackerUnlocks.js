// What a quest or diary tier opens up in the planner: the training methods that need it (straight, or through an item or unlock it gives, see
// data/requirementQuests.js). Built once from the method catalogue, so the tracker can say "Unlocks Gem rocks (Mining)" next to a diary tier.
import { TRAINING_METHODS } from '@/data/trainingMethods'
import { requirementsFor } from '@/data/methodRequirements'

const MELEE = ['Attack', 'Strength', 'Defence']
const baseId = (id) => id.replace(/:partial$/, '')

let index = null
function build() {
  // id -> Map(method name -> Set(skills))
  const byId = new Map()
  const add = (id, method) => {
    const key = baseId(id)
    if (!byId.has(key)) byId.set(key, new Map())
    const names = byId.get(key)
    if (!names.has(method.name)) names.set(method.name, { skills: new Set(), method })
    names.get(method.name).skills.add(method.skill)
  }
  for (const method of TRAINING_METHODS) {
    for (const req of requirementsFor(method)) {
      if (req.kind === 'quest' || req.kind === 'diary') add(req.id, method)
      for (const q of req.quests || []) add(q.id, method)
    }
  }
  index = new Map()
  for (const [id, names] of byId) {
    index.set(
      id,
      [...names].map(([name, { skills, method }]) => {
        const list = [...skills]
        const melee = MELEE.every((s) => list.includes(s))
        // `method` is one of the methods of that name (the first skill listed), for its icon and rates.
        return { name, skills: list, melee, method, text: `${melee ? 'Melee' : list.join(', ')}: ${name}` }
      }),
    )
  }
}

/** The methods that need this quest or diary id: [{ name, skills, text }]. */
export function unlocksFor(id) {
  if (!index) build()
  return index.get(baseId(id)) || []
}
