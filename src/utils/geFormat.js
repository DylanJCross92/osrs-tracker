// How Grand Exchange numbers read on the Items pages.

/** 3,727 or 12.3M: whole coins up to 10M, then a short form. */
export function gpText(value) {
  if (value == null || !Number.isFinite(Number(value))) return '-'
  const v = Math.round(Number(value))
  const a = Math.abs(v)
  if (a >= 1e9) return `${+(v / 1e9).toFixed(2)}B`
  if (a >= 1e7) return `${+(v / 1e6).toFixed(1)}M`
  return v.toLocaleString('en-US')
}

/** A short form for chart axes: 3.7k, 12M. */
export function gpAxis(value) {
  const v = Number(value)
  const a = Math.abs(v)
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${+(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`
  if (a >= 1e4) return `${Math.round(v / 1e3)}k`
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}k`
  return String(Math.round(v))
}

export const pctText = (p) => (p == null ? '-' : `${p > 0 ? '+' : ''}${p}%`)
export const signedGp = (v) => (v == null ? '-' : `${v > 0 ? '+' : ''}${gpText(v)}`)
export const changeClass = (p) => (p > 0 ? 'planner-gain' : p < 0 ? 'planner-cost' : '')

/** The index rows from the server as objects. */
export function rowsFromIndex(list) {
  return (list || []).map(([id, name, slug, members, high, low, volume, limit, change1, change7, change30, margin]) => ({
    id, name, slug, members: members === 1, high, low, price: high != null && low != null ? Math.round((high + low) / 2) : high ?? low, volume, limit, change1, change7, change30, margin,
  }))
}

/** The wiki's picture of an item from its icon file name (or its name when that is not known). */
export const itemImage = (icon, name) => `https://oldschool.runescape.wiki/images/${encodeURI(String(icon || `${name}.png`).replace(/ /g, '_'))}`
