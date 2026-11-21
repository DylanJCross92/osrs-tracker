import { ref } from 'vue'
import { geApi } from '@/api/ge'

// The Grand Exchange prices the planners and calculators use, kept in one place. Prices are fetched by item name (only the items the
// site's methods and materials use), and reading one inside a Vue computed makes it recompute when new prices arrive.
const book = new Map() // lower case name -> { high, low, slug, icon }

/** Counts up every time prices are loaded or cleared. Read it to depend on the prices. */
export const priceVersion = ref(0)
/** { loaded, updatedAt, stale } for the badge that says how fresh the numbers are. */
export const priceStatus = ref({ loaded: false, updatedAt: null, stale: false })

const key = (name) => String(name).trim().toLowerCase()

// Which price the planners use. 'mid' is the middle of the latest buy and sell price (steady, and what most people trade near);
// 'instant' prices what you pay to buy at once and what you get selling at once, so it is the cost of doing it right now.
const BASIS_KEY = 'tg_price_basis'
function loadBasis() {
  try {
    return localStorage.getItem(BASIS_KEY) === 'instant' ? 'instant' : 'mid'
  } catch {
    return 'mid'
  }
}
export const priceBasis = ref(loadBasis())

/** Switches between the middle price and instant buy and sell prices; everything that depends on the prices recomputes. */
export function setPriceBasis(basis) {
  const next = basis === 'instant' ? 'instant' : 'mid'
  if (next === priceBasis.value) return
  priceBasis.value = next
  try {
    localStorage.setItem(BASIS_KEY, next)
  } catch {
    /* the choice just is not remembered */
  }
  priceVersion.value++
}

/** { high, low, slug } for an item, or null when there is no price. Depends on the price version. */
export function priceOf(name) {
  void priceVersion.value
  return book.get(key(name)) || null
}

/** The middle of the buy and sell price, or null. */
export function midOf(name) {
  const p = priceOf(name)
  if (!p) return null
  if (p.high != null && p.low != null) return Math.round((p.high + p.low) / 2)
  return p.high ?? p.low ?? null
}

/** What it costs to buy one now: the middle price, or on the instant basis what you pay buying at once. null when there is no price. */
export function buyOf(name) {
  const p = priceOf(name)
  if (!p) return null
  if (priceBasis.value === 'instant') return p.high ?? p.low ?? null
  return midOf(name)
}

/** What one sells for now (before tax): the middle price, or on the instant basis what you get selling at once. null when there is no price. */
export function sellOf(name) {
  const p = priceOf(name)
  if (!p) return null
  if (priceBasis.value === 'instant') return p.low ?? p.high ?? null
  return midOf(name)
}

/** Replaces the prices with `prices` ({ name: [high, low, slug] }), as the server sends them. */
export function setPrices(prices, info = {}) {
  book.clear()
  for (const [name, [high, low, slug, icon]] of Object.entries(prices || {})) book.set(key(name), { high, low, slug, icon: icon || '' })
  priceStatus.value = { loaded: true, updatedAt: info.updatedAt || null, stale: !!info.stale }
  priceVersion.value++
}

/** The wiki picture file of an item when it is not just "<name>.png" (the price book knows it once prices are loaded), or ''. */
export const iconOf = (name) => {
  void priceVersion.value
  return book.get(key(name))?.icon || ''
}

/** The item address for a name (for a link), or null. */
export const slugOf = (name) => {
  void priceVersion.value
  return book.get(key(name))?.slug || null
}

// --- loading -----------------------------------------------------------------------------------------------------------------------
const MAX_NAMES = 400
const REFRESH_MS = 10 * 60_000
let wanted = new Set()
let timer = null
let inFlight = null
let users = 0

async function load() {
  if (inFlight || !wanted.size) return inFlight
  inFlight = geApi
    .prices([...wanted].slice(0, MAX_NAMES))
    .then((res) => setPrices(res.prices, res))
    .catch(() => {
      /* without prices the planners keep using the saved figures */
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/**
 * Asks for the prices of these item names (more can be asked for later) and keeps them fresh while something is using them. Returns a
 * function to call when the page is done with them.
 */
export function usePrices(names) {
  for (const n of names) wanted.add(n)
  users++
  load()
  if (!timer) timer = setInterval(load, REFRESH_MS)
  return () => {
    users = Math.max(0, users - 1)
    if (!users && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** For tests: empties the book. */
export function resetPrices() {
  book.clear()
  wanted = new Set()
  priceStatus.value = { loaded: false, updatedAt: null, stale: false }
  priceVersion.value++
}
