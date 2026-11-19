import cron from 'node-cron'
import { remindStaleClaims } from '../services/claims.service.js'
import { closeExpiredClaims, sendClaimExpiryEmails } from '../services/claimExpiry.service.js'

// Every hour, for claims that were opened and never finished:
//   1. a claim opened over a day ago gets its 48 hour deadline, an email and a notification saying so (see claimExpiry.service.js);
//   2. anyone else who started over a day ago gets the plain reminder in their notifications, once;
//   3. claims whose time has run out are closed, so the person can open a new one.
export function startClaimReminderJob() {
  const run = async () => {
    try {
      const mail = await sendClaimExpiryEmails()
      if (mail.sent || mail.failed) console.log(`[claims] claim closing emails: ${mail.sent} sent, ${mail.failed} failed`)
      const n = await remindStaleClaims()
      if (n) console.log(`[claims] sent ${n} claim reminder${n === 1 ? '' : 's'}`)
      const closed = await closeExpiredClaims()
      if (closed) console.log(`[claims] closed ${closed} unfinished claim${closed === 1 ? '' : 's'}`)
    } catch (err) {
      console.error('[claims] reminders failed:', err.message)
    }
  }
  cron.schedule('20 * * * *', run)
  console.log('[claims] hourly reminders scheduled')
}
