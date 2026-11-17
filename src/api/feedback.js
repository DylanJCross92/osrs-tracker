import { api } from './client'

export const feedbackApi = {
  // { kind: 'bug' | 'idea' | 'other', message, email?, page?, viewport?, website } -> { ok: true }
  send: (body) => api.post('/feedback', body),
}
