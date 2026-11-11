import { api } from './client'

export const notificationsApi = {
  // { items: [{ id, type, count, text, to }], unread, total }
  get: () => api.get('/notifications'),
  // The stored inbox: [{ id, type, text, link, createdAt, read }], newest first.
  inbox: () => api.get('/inbox'),
  markRead: (ids) => api.post('/inbox/read', { ids }),
  markAllRead: () => api.post('/inbox/read', { all: true }),
  // Someone accepted a challenge link; lets the challenger's owner know. No account needed.
  challengeAccepted: (from, opponent) => api.post('/challenges/accepted', { from, opponent }),
}
