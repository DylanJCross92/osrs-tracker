import { api } from './client'

export const newsletterApi = {
  // website is the hidden honeypot field: always empty for a real visitor.
  subscribe: (email, source, website = '') => api.post('/newsletter/subscribe', { email, source, website }),
  unsubscribe: (token) => api.post('/newsletter/unsubscribe', { token }),
}
