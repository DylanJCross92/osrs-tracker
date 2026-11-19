import { api } from './client'

export const statsApi = {
  // Anonymous counters, fire and forget.
  share: (kind, method, item) => api.post('/stats/share', { kind, method, ...(item ? { item } : {}) }),
  visit: (kind, source, item) => api.post('/stats/visit', { kind, source, ...(item ? { item } : {}) }),
  // Site owner only: { days, totals, byKind, sources, daily, items: [{ kind, label, item, shares, visits }] }.
  shares: (days = 30) => api.get(`/admin/stats/shares?days=${days}`),
  // Site owner only: { days, labels, growth: [{ key, label, total, added, daily }], unverified, pendingClaims, activeWeek, feed: [{ at, kind, text, detail? }] }.
  overview: (days = 30) => api.get(`/admin/stats/overview?days=${days}`),
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
  // Site owner only: { day, accounts: [{ email, players, logins, returned }] }.
  // Site owner only: { totals, players: [{ key, name, accounts, plans }] }.
  plans: () => api.get('/admin/plans'),
  activeAccounts: (day) => api.get(`/admin/stats/daily-active/${day}`),
  // Site owner only: the people (accounts and browsers) active lately, and one person's journey in order.
  visitors: (days = 30) => api.get(`/admin/stats/visitors?days=${days}`),
  // Site owner only: { days, total, accounts: [{ id, email, createdAt, verifiedAt, lastSeen, players, pending, steps, activeDays, team }] }.
  accounts: (days = 30) => api.get(`/admin/stats/accounts?days=${days}`),
  journey: (key, days = 30) => api.get(`/admin/stats/visitors/${encodeURIComponent(key)}?days=${days}`),
  // A visitor who is not signed in: the plans saved in their browser, under their random visitor number.
  visitorPlans: (vid, plans, planner) => api.post('/stats/visitor-plans', { vid, plans, planner }),
  eventDetail: (name, days = 30) => api.get(`/admin/stats/events/${encodeURIComponent(name)}?days=${days}`),
}
