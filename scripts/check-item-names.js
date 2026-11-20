// Lists the item names the planners and calculators use (data/methodEconomy.js and data/methodMaterials.js) that the Grand Exchange has no
// price for, so a typo or a renamed item is noticed. It asks a running API, so start one first (and let it fetch prices):
//   npx vite-node scripts/check-item-names.js            (uses http://localhost:4000/api, or give another address as the argument)
import { PRICE_NAMES } from '../src/utils/priceNames.js'

const base = process.argv[2] || 'http://localhost:4000/api'
const missing = []
for (let i = 0; i < PRICE_NAMES.length; i += 100) {
  const chunk = PRICE_NAMES.slice(i, i + 100)
  const res = await fetch(`${base}/ge/prices?names=${encodeURIComponent(chunk.join('|'))}`)
  if (!res.ok) throw new Error(`The API answered ${res.status}.`)
  const { prices } = await res.json()
  for (const n of chunk) if (!prices[n.toLowerCase()]) missing.push(n)
}
console.log(`${PRICE_NAMES.length} item names checked.`)
console.log(missing.length ? `No Grand Exchange price for ${missing.length}:\n  ${missing.join('\n  ')}` : 'Every item has a price.')
process.exit(missing.length ? 1 : 0)
