import { api } from './client'

export const playersApi = {
  list: () => api.get('/players'),
  add: (username) => api.post('/players', { username }),
  snapshots: (id) => api.get(`/players/${id}/snapshots`),
  refresh: (id) => api.post(`/players/${id}/refresh`),
  checkWomHistory: (id) => api.post(`/players/${id}/check-wom-history`),
  profile: (id) => api.get(`/players/${id}/profile`),
  search: (q) => api.get(`/players/search?q=${encodeURIComponent(q)}`),
  discover: () => api.get('/discover'),
  syncAll: () => api.post('/players/sync-all'),
}
