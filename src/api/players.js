import { api } from './client'

export const playersApi = {
  list: () => api.get('/players'),
  add: (username) => api.post('/players', { username }),
  snapshots: (id) => api.get(`/players/${id}/snapshots`),
  refresh: (id) => api.post(`/players/${id}/refresh`),
  checkWomHistory: (id) => api.post(`/players/${id}/check-wom-history`),
  syncAll: () => api.post('/players/sync-all'),
}
