import cron from 'node-cron'
import { remindStaleClaims } from '../services/claims.service.js'

// Every hour: anyone who started claiming a profile over a day ago and never finished gets one reminder in their notifications.
export function startClaimReminderJob() {
  const run = () =>
    remindStaleClaims()
      .then((n) => n && console.log(`[claims] sent ${n} claim reminder${n === 1 ? '' : 's'}`))
      .catch((err) => console.error('[claims] reminders failed:', err.message))
  cron.schedule('20 * * * *', run)
  console.log('[claims] hourly reminders scheduled')
}
