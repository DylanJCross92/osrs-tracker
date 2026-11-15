import cron from 'node-cron'
import { tick } from '../services/competitions.service.js'

// Every minute: start competitions whose time has come and finish the ones that are over. Each pass is cheap when there is
// nothing to do (two small queries).
export function startCompetitionJob() {
  cron.schedule('* * * * *', () => {
    tick().catch((err) => console.error('[competitions] pass failed:', err))
  })
  console.log('[competitions] start/finish job scheduled (every minute)')
}
