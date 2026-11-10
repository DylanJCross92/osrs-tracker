import { api } from './client'

const enc = encodeURIComponent

export const claimsApi = {
  // { claimed, mine: 'none' | 'pending' | 'owner' | 'taken', contact, code?, expiresAt? }
  get: (username) => api.get(`/players/${enc(username)}/claim`),
  start: (username) => api.post(`/players/${enc(username)}/claim`),
  cancel: (username) => api.post(`/players/${enc(username)}/claim/cancel`),
  mine: () => api.get('/claims/mine'),
  // Site owner only.
  admin: {
    overview: () => api.get('/admin/claims'),
    lookup: (code) => api.post('/admin/claims/lookup', { code }),
    approve: (code) => api.post('/admin/claims/approve', { code }),
    reject: (id) => api.post(`/admin/claims/${id}/reject`),
    revoke: (id) => api.post(`/admin/claims/${id}/revoke`),
  },
}
