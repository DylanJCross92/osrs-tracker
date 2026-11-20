import { MATERIALS } from '@/data/methodMaterials'
import { getMethod } from '@/data/trainingMethods'
import { SKILL_INFO } from '@/data/skillInfo'

// Which training methods use an item, from the materials each method lists (see data/methodMaterials.js): the item itself or one of the
// extra items an action uses up. Built once and kept.
let byItem = null
const SKILL_SLUG = Object.fromEntries(SKILL_INFO.map((i) => [i.name, i.slug]))

function build() {
  const map = new Map()
  const add = (name, methodId) => {
    const key = String(name).toLowerCase()
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(methodId)
  }
  for (const [methodId, items] of Object.entries(MATERIALS)) {
    for (const it of items) {
      add(it.name, methodId)
      for (const e of it.extra || []) add(e.name, methodId)
    }
  }
  return map
}

/** The methods that use this item: [{ id, name, skill, path }], by skill then name. Empty when none does. */
export function methodsUsingItem(itemName) {
  byItem ||= build()
  const ids = byItem.get(String(itemName).toLowerCase())
  if (!ids) return []
  return [...ids]
    .map((id) => getMethod(id))
    .filter(Boolean)
    .map((m) => ({ id: m.id, name: m.name, skill: m.skill, path: `/calculators/${SKILL_SLUG[m.skill] || m.skill.toLowerCase()}` }))
    .sort((a, b) => a.skill.localeCompare(b.skill) || a.name.localeCompare(b.name))
}
