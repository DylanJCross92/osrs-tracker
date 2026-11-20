import { ECONOMY_ITEMS } from '@/data/methodEconomy'
import { MATERIALS } from '@/data/methodMaterials'

// Every item name the planners and calculators may need a price for: what the methods use and make, and the materials lists.
const names = new Set(ECONOMY_ITEMS)
for (const list of Object.values(MATERIALS)) {
  for (const it of list) {
    names.add(it.name)
    for (const e of it.extra || []) names.add(e.name)
  }
}
export const PRICE_NAMES = [...names].sort()
