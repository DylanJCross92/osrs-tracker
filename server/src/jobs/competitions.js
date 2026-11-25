import cron from 'node-cron'
import { tick } from '../services/competitions.service.js'
import { ensureWeeklyRace } from '../services/weeklyRace.service.js'

// Every minute: make sure the site's weekly race is on, then start competitions whose time has come and finish the ones that are over.
// Each pass is cheap when there is nothing to do (a few small queries).
export function startCompetitionJob() {
  cron.schedule('* * * * *', () => {
    ensureWeeklyRace()
      .catch((err) => console.error('[weekly] could not set up the weekly race:', err.message))
      .then(() => tick())
      .catch((err) => console.error('[competitions] pass failed:', err))
  })
  console.log('[competitions] start/finish job scheduled (every minute)')
}
