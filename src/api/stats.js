import { api } from './client'

export const statsApi = {
  // Anonymous counters, fire and forget.
  share: (kind, method) => api.post('/stats/share', { kind, method }),
  visit: (kind, source) => api.post('/stats/visit', { kind, source }),
  // Site owner only: { days, totals, byKind, sources, daily }.
  shares: (days = 30) => api.get(`/admin/stats/shares?days=${days}`),
  // Site owner only: every product event with its counts, and one event in detail.
  events: (days = 30) => api.get(`/admin/stats/events?days=${days}`),
  // Site owner only: { total, players: [{ username, displayName, badge, claimed, trackedAt, level, xp }] }, newest first.
  recentPlayers: (limit = 25) => api.get(`/admin/stats/recent-players?limit=${limit}`),
  // Site owner only: { days: [{ day, xp, players }] }, oldest first, ending with today so far.
  dailyXp: (days = 30) => api.get(`/admin/stats/daily-xp?days=${days}`),
  // Site owner only: { days: [{ day, total, added }] }, oldest first, ending today.
  dailyPlayers: (days = 30) => api.get(`/admin/stats/daily-players?days=${days}`),
  // Site owner only: { days: [{ day, active, logins, resumed }] }.
  dailyActive: (days = 30) => api.get(`/admin/stats/daily-active?days=${days}`),
  eventDetail: (name, days = 30) => api.get(`/admin/stats/events/${encodeURIComponent(name)}?days=${days}`),
}
