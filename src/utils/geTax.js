// The Grand Exchange tax, as the planners work it out. A copy of the rules in server/src/utils/ge.js (a test keeps the two the same):
// 2% of a sale, rounded down, at most 5M coins per item, and a short list of items that pay nothing.
export const GE_TAX_RATE = 0.02
export const GE_TAX_CAP = 5_000_000
const EXEMPT = new Set(
  [
    'Old school bond', 'Energy potion', 'Bronze arrow', 'Bronze dart', 'Iron arrow', 'Iron dart', 'Mind rune', 'Steel arrow', 'Steel dart',
    'Bass', 'Bread', 'Cake', 'Cooked chicken', 'Cooked meat', 'Herring', 'Lobster', 'Mackerel', 'Meat pie', 'Pike', 'Salmon', 'Shrimps', 'Tuna',
    'Ardougne teleport', 'Camelot teleport', 'Civitas illa fortis teleport', 'Falador teleport', 'Games necklace(8)', 'Kourend castle teleport',
    'Lumbridge teleport', 'Ring of dueling(8)', 'Teleport to house', 'Varrock teleport', 'Chisel', 'Gardening trowel', 'Glassblowing pipe',
    'Hammer', 'Needle', 'Pestle and mortar', 'Rake', 'Saw', 'Secateurs', 'Seed dibber', 'Shears', 'Spade', 'Watering can',
  ].map((n) => n.toLowerCase()),
)

/** The tax on selling one item at `price`. */
export function geTax(price, name = '') {
  const p = Math.floor(Number(price))
  if (!(p > 0) || EXEMPT.has(String(name).toLowerCase())) return 0
  return Math.min(Math.floor(p * GE_TAX_RATE), GE_TAX_CAP)
}

/** What a seller keeps from one item sold at `price`. */
export const afterTax = (price, name = '') => (Number(price) > 0 ? Math.floor(Number(price)) - geTax(price, name) : 0)
