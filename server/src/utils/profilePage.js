// Rules for what an owner may put on their profile. Everything is plain text; links can only point to a few well-known
// sites over https; pictures must really be JPEG, PNG or WebP and small. Pure functions so they can be tested.
export const MAX_BIO = 300
export const MAX_LINKS = 5
export const MAX_AVATAR_BYTES = 150_000

export const LINK_KINDS = {
  discord: ['discord.gg', 'discord.com', 'www.discord.com'],
  twitch: ['twitch.tv', 'www.twitch.tv'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  twitter: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
}

// Control characters and line breaks collapse to a space, so a bio is always one tidy paragraph.
const plain = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** A clean link { kind, url } or null when it is not an https link to the site its kind names. */
export function cleanLink(link) {
  if (!link || typeof link !== 'object') return null
  const kind = String(link.kind || '')
  if (!(kind in LINK_KINDS)) return null
  let url
  try {
    url = new URL(String(link.url || '').trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  if (!LINK_KINDS[kind].includes(url.hostname.toLowerCase())) return null
  const out = url.toString()
  return out.length <= 200 ? { kind, url: out } : null
}

/** Keeps the known fields with valid values. A missing field stays missing so a partial save never wipes the rest. */
export function sanitizeProfilePage(input) {
  const out = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out
  if ('bio' in input) out.bio = plain(input.bio, MAX_BIO)
  if (Array.isArray(input.links)) {
    const seen = new Set()
    out.links = []
    for (const l of input.links) {
      const c = cleanLink(l)
      if (!c || seen.has(c.url)) continue
      seen.add(c.url)
      out.links.push(c)
      if (out.links.length >= MAX_LINKS) break
    }
  }
  return out
}

/** The image type of a buffer judged by its first bytes (never by what the uploader claimed), or null. */
export function sniffImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return null
}
