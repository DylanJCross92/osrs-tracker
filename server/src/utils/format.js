// How the server writes numbers in cards, previews and emails, one copy. The site writes the same figures with src/utils/osrsSkills.js
// (formatXp) and src/utils/planner.js (formatGp, formatHours); tests/utils/numbersAgree.spec.js checks these against those over many values,
// so a share card never shows a figure the page writes differently.
const trim = (v, digits) => parseFloat(v.toFixed(digits))

/** 4_200_000 -> "4.2M", 12_000 -> "12K", 850 -> "850", 3_746_000_000 -> "3.75B". Trailing zeros dropped; a value that rounds up to the next unit uses it. */
export function formatXp(xp) {
  const n = Number(xp) || 0
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${trim(n / 1e9, 2)}B`
  if (abs >= 1e6) {
    const v = trim(n / 1e6, abs >= 1e7 ? 1 : 2)
    return Math.abs(v) >= 1000 ? `${trim(n / 1e9, 2)}B` : `${v}M`
  }
  if (abs >= 1e3) {
    const v = trim(n / 1e3, 1)
    return Math.abs(v) >= 1000 ? `${trim(n / 1e6, 2)}M` : `${v}K`
  }
  return String(Math.round(n))
}

/** "+2.0M gp", "-12K gp", "+1.50B gp". Whole thousands, one decimal in millions, two in billions; null is "No GP data". */
export function formatGp(gp) {
  if (gp == null) return 'No GP data'
  const abs = Math.abs(gp)
  const sign = gp < 0 ? '-' : '+'
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B gp`
  if (abs >= 1e6 - 500) {
    const m = (abs / 1e6).toFixed(1)
    // 999,950K and up round to a million, so it is written as one
    return Number(m) >= 1000 ? `${sign}${(abs / 1e9).toFixed(2)}B gp` : `${sign}${m}M gp`
  }
  if (abs >= 1e3) {
    const k = Math.round(abs / 1e3)
    return k >= 1000 ? `${sign}${(abs / 1e6).toFixed(1)}M gp` : `${sign}${k}K gp`
  }
  return `${sign}${abs} gp`
}

/** "30 min", "5.2 h", "1,788 h". */
export function formatHours(h) {
  if (h == null) return '-'
  if (h < 1) return `${Math.max(Math.round(h * 60), 1)} min`
  return `${h >= 100 ? Math.round(h).toLocaleString('en-US') : Math.round(h * 10) / 10} h`
}

/** "1 day", "12 days". */
export const formatDays = (n) => `${Number(n).toLocaleString('en-US')} ${Number(n) === 1 ? 'day' : 'days'}`
