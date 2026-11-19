// The email for someone who opened a claim on a profile a day ago and has not finished it. It tells them the claim closes in 48
// hours and what to do, and that they can open a new one afterwards. Pure (no database, no sending), so it is easy to preview and test.
import { renderEmail } from './emailTemplate.js'

const SITE = () => process.env.SITE_URL || 'https://tickgains.com'

export const CLAIM_EXPIRY_HOURS = 48
// How long after a claim is opened the email goes out.
export const CLAIM_EMAIL_AFTER_HOURS = 24

/** "Sat, Nov 21, 3:20 PM UTC": one fixed zone, so the wording is the same wherever it is read. */
export function deadlineLabel(deadline) {
  if (deadline == null) return ''
  const d = new Date(deadline)
  if (Number.isNaN(d.getTime())) return ''
  const text = d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
  return `${text} UTC`
}

/**
 * { subject, html, text }. player: { username, displayName }. deadline: when the claim closes. contact: who to message in game.
 * The email never includes the claim code (it is shown on the profile page once signed in) or the person's address.
 */
export function claimExpiryEmail({ player, deadline, contact, unsubscribeUrl = '' }) {
  const name = String(player?.displayName || player?.username || 'your player').slice(0, 40)
  const when = deadlineLabel(deadline)
  const rows = [{ label: 'Profile', value: name }]
  if (when) rows.push({ label: 'Claim closes', value: when })
  if (contact) rows.push({ label: 'Message in game', value: contact })
  return {
    subject: `Your claim for ${name} closes in ${CLAIM_EXPIRY_HOURS} hours`,
    ...renderEmail({
      preheader: `Send your code in game to finish claiming ${name}, or the claim closes.`,
      title: `Finish claiming ${name}`,
      paragraphs: [
        { text: `You started claiming ${name} on TickGains, but it has not been confirmed yet. You have ${CLAIM_EXPIRY_HOURS} hours to finish it.`, strong: `${CLAIM_EXPIRY_HOURS} hours` },
      ],
      features: [
        { title: 'Open your profile page', text: 'Sign in and open the profile. Your code is waiting there.' },
        { title: `Send the code in game`, text: `Send it as a private message to ${contact || 'us'} from ${name}. The message has to come from that character, since that is how we know it is you.` },
        { title: 'We confirm it', text: 'Once we see your code, the profile is yours and your dashboard unlocks.' },
      ],
      afterFeatures: [
        { text: `If it is not confirmed by the time the claim closes, it is closed automatically and the code stops working. You can open a new claim whenever you like and get a fresh code.`, strong: 'closed automatically' },
      ],
      rows,
      button: { label: 'Finish my claim', url: `${SITE()}/player/${encodeURIComponent(player?.username || '')}` },
      unsubscribeUrl,
      note: `You are getting this once because you opened a claim and did not finish it. If you no longer want this profile, ignore this email: the claim closes by itself and nothing else changes.`,
    }),
  }
}
