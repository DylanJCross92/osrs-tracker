import { api } from './client'

export const statsApi = {
  // Anonymous counters, fire and forget.
  share: (kind, method) => api.post('/stats/share', { kind, method }),
  visit: (kind, source) => api.post('/stats/visit', { kind, source }),
  // Site owner only: { days, totals, byKind, sources, daily }.
  shares: (days = 30) => api.get(`/admin/stats/shares?days=${days}`),
  // Site owner only: every product event with its counts, and one event in detail.
  events: (days = 30) => api.get(`/admin/stats/events?days=${days}`),
  eventDetail: (name, days = 30) => api.get(`/admin/stats/events/${encodeURIComponent(name)}?days=${days}`),
}
