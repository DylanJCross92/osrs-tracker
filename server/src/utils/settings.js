// The preferences an account keeps. Anything not listed here is dropped, so the settings column can only ever hold
// these few, small values no matter what a client sends.
const NAME_RE = /^[A-Za-z0-9 _-]{1,12}$/
const PERIODS = ['day', 'week', 'month']
export const MAX_RIVALS = 25

const cleanName = (v) => (typeof v === 'string' && NAME_RE.test(v.trim()) ? v.trim() : null)

/** Keeps only known keys with valid values. Missing keys stay missing so a partial update never wipes the rest. */
export function sanitizeSettings(input) {
  const out = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  if (input.me === '') out.me = ''
  else if (cleanName(input.me)) out.me = cleanName(input.me)
  if (Array.isArray(input.rivals)) {
    const seen = new Set()
    out.rivals = []
    for (const r of input.rivals) {
      const name = cleanName(r)
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      out.rivals.push(name)
      if (out.rivals.length >= MAX_RIVALS) break
    }
  }
  if (PERIODS.includes(input.gainPeriod)) out.gainPeriod = input.gainPeriod
  return out
}
