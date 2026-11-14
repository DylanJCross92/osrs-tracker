import { api } from './client'

export const statsApi = {
  // Anonymous counters, fire and forget.
  share: (kind, method) => api.post('/stats/share', { kind, method }),
  visit: (kind, source) => api.post('/stats/visit', { kind, source }),
  // Site owner only: { days, totals, byKind, sources, daily }.
  shares: (days = 30) => api.get(`/admin/stats/shares?days=${days}`),
}
