import { api } from './client'

export const playersApi = {
  list: () => api.get('/players'),
  // Tracked Hardcore Worlds characters (the normal list never has them), same shape.
  hardcoreList: () => api.get('/players/hardcore'),
  // { character } for a name's Hardcore Worlds character ({ id, status, life, resets, rank, events }) or null when it has none.
  hardcore: (id) => api.get(`/players/${id}/hardcore`),
  add: (username) => api.post('/players', { username }),
  snapshots: (id) => api.get(`/players/${id}/snapshots`),
  refresh: (id) => api.post(`/players/${id}/refresh`),
  checkWomHistory: (id) => api.post(`/players/${id}/check-wom-history`),
  profile: (id) => api.get(`/players/${id}/profile`),
  // { followers, following }: accounts following this profile, and players its owner follows.
  followCounts: (id) => api.get(`/players/${id}/follow-counts`),
  cheer: (id, milestone) => api.post(`/players/${id}/cheer`, milestone),
  // A signed-in account has watched the celebration for this milestone (never shown to them again).
  celebrationSeen: (id, milestone) => api.post(`/players/${id}/celebration-seen`, milestone),
  search: (q) => api.get(`/players/search?q=${encodeURIComponent(q)}`),
  discover: (world = 'main') => api.get(world === 'hardcore' ? '/discover?world=hardcore' : '/discover'),
  syncAll: () => api.post('/players/sync-all'),
}
