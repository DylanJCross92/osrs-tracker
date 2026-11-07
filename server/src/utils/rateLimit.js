// Tiny in-memory per-IP sliding-window limiter (single instance, so no
// shared store needed). Protects the endpoints that trigger Hiscores or
// Wise Old Man lookups and the search box.
export function rateLimit({ windowMs, max, message = 'Too many requests — please slow down.' }) {
  const hits = new Map()
  setInterval(() => {
    const cutoff = Date.now() - windowMs
    for (const [ip, times] of hits) {
      const recent = times.filter((t) => t > cutoff)
      if (recent.length) hits.set(ip, recent)
      else hits.delete(ip)
    }
  }, windowMs).unref()

  return (req, res, next) => {
    const now = Date.now()
    const times = (hits.get(req.ip) || []).filter((t) => t > now - windowMs)
    if (times.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)))
      return res.status(429).json({ error: message })
    }
    times.push(now)
    hits.set(req.ip, times)
    next()
  }
}
