// Posts to a Discord channel through a webhook (no bot needed) so the site owner hears about profile claims.
// Off unless DISCORD_CLAIMS_WEBHOOK is set. Set DISCORD_OWNER_ID to a Discord user id (Developer Mode, right click, Copy
// User ID) so the "I'm in game now" ping actually mentions the owner. A failure is logged and never reaches the visitor.

const MAX_PER_HOUR = 30
const sent = []

function underHourlyCap(now = Date.now()) {
  while (sent.length && sent[0] < now - 3_600_000) sent.shift()
  if (sent.length >= MAX_PER_HOUR) return false
  sent.push(now)
  return true
}

export const discordConfigured = () => Boolean(process.env.DISCORD_CLAIMS_WEBHOOK)
const siteUrl = () => process.env.SITE_URL || 'https://tickgains.com'
const ownerId = () => (/^\d{5,25}$/.test(process.env.DISCORD_OWNER_ID || '') ? process.env.DISCORD_OWNER_ID : null)

// Discord shows <t:unix:f> in each reader's own time zone, so the owner never has to convert.
const stamp = (d, style) => `<t:${Math.floor(new Date(d).getTime() / 1000)}:${style}>`

/** "Nov 15, 2026 6:00 PM until 10:00 PM" in the reader's time zone, or '' with no window. */
export function windowText(from, until) {
  if (!from || !until) return ''
  const span = new Date(until).getTime() - new Date(from).getTime()
  return `${stamp(from, 'f')} until ${stamp(until, span < 86_400_000 ? 't' : 'f')} (${stamp(from, 'R')})`
}

const adminLink = () => `${siteUrl()}/admin/claims`

export function startedMessage({ playerName, from, until }) {
  const when = windowText(from, until)
  return `**New profile claim:** ${playerName}\n${when ? `They say they will be online ${when}.` : 'They did not say when they will be online.'}\n${adminLink()}`
}

export function windowMessage({ playerName, from, until }) {
  return `**${playerName}** says they will be online ${windowText(from, until)}.\n${adminLink()}`
}

export function pingMessage({ playerName, from, until }) {
  const id = ownerId()
  const when = windowText(from, until)
  return `${id ? `<@${id}> ` : ''}**${playerName}** is in game now and waiting to send their claim code.${when ? ` (They said ${when}.)` : ''}\n${adminLink()}`
}

/** Sends a message. Resolves true when Discord accepted it, false otherwise; never throws. */
export async function postToDiscord(content) {
  if (!discordConfigured()) return false
  if (!underHourlyCap()) return false
  const id = ownerId()
  try {
    const res = await fetch(process.env.DISCORD_CLAIMS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Only the owner can be mentioned, whatever a player's name contains.
      body: JSON.stringify({ username: 'TickGains', content: content.slice(0, 1800), allowed_mentions: { parse: [], users: id ? [id] : [] } }),
    })
    if (!res.ok) {
      console.error(`Discord post failed: ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.error('Discord post failed:', err.message)
    return false
  }
}
