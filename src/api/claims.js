import { api } from './client'

const enc = encodeURIComponent

export const claimsApi = {
  // { claimed, mine: 'none' | 'pending' | 'owner' | 'taken', contact, canPing, code?, expiresAt?, onlineFrom?, onlineUntil?, pingWaitMinutes? }
  get: (username) => api.get(`/players/${enc(username)}/claim`),
  // `window` is optional: { onlineFrom, onlineUntil } as ISO strings, when the claimant will be in game.
  start: (username, window) => api.post(`/players/${enc(username)}/claim`, window || {}),
  // Save (or, with null, clear) the window.
  online: (username, window) => api.post(`/players/${enc(username)}/claim/online`, window || {}),
  // "I'm in game now": pings the owner on Discord.
  ping: (username) => api.post(`/players/${enc(username)}/claim/ping`),
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
