import { api } from './client'

export const playersApi = {
  list: () => api.get('/players'),
  add: (username) => api.post('/players', { username }),
  remove: (id) => api.delete(`/players/${id}`),
  snapshots: (id) => api.get(`/players/${id}/snapshots`),
  refresh: (id) => api.post(`/players/${id}/refresh`),
  syncAll: () => api.post('/players/sync-all'),
}
