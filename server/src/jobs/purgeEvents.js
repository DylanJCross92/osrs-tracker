import cron from 'node-cron'
import { purgeOldEvents } from '../services/events.service.js'

// Once a day: product events are only kept for a limited time (see RETENTION_DAYS).
export function startEventsPurgeJob() {
  cron.schedule('30 4 * * *', () => {
    purgeOldEvents()
      .then((n) => n && console.log(`[events] purged ${n} old events`))
      .catch((err) => console.error('[events] purge failed:', err.message))
  })
  console.log('[events] daily purge scheduled')
}
