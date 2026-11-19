import cron from 'node-cron'
import { sendDueClaimNudges } from '../services/claimNudge.service.js'

// Every hour: confirmed accounts that still have no claimed player a day after confirming get the reminder email, once.
export function startClaimNudgeJob() {
  const run = () =>
    sendDueClaimNudges()
      .then(({ sent, failed }) => (sent || failed) && console.log(`[claims] claim reminder emails: ${sent} sent, ${failed} failed`))
      .catch((err) => console.error('[claims] claim reminder emails failed:', err.message))
  cron.schedule('40 * * * *', run)
  console.log('[claims] hourly claim reminder emails scheduled')
}
