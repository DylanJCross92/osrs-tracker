import { api } from './client'

export const notificationsApi = {
  // { items: [{ id, type, count, text, to }], total }
  get: () => api.get('/notifications'),
}
