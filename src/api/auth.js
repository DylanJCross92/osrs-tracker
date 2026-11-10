import { api } from './client'

export const authApi = {
  // { user } with user null for a visitor who is not signed in.
  me: () => api.get('/auth/me'),
  // website is the hidden honeypot field: always empty for a real visitor.
  // Resolves to { pending: true, email, emailSent }: the account exists but cannot be used until the email is confirmed.
  signup: ({ email, password, confirmPassword, newsletter, settings, website = '' }) => api.post('/auth/signup', { email, password, confirmPassword, newsletter, settings, website }),
  verify: (token) => api.post('/auth/verify', { token }),
  resend: (email) => api.post('/auth/resend', { email }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  saveSettings: (settings) => api.put('/auth/settings', { settings }),
  forgot: (email) => api.post('/auth/forgot', { email }),
  reset: (token, password) => api.post('/auth/reset', { token, password }),
  changePassword: (current, next) => api.post('/auth/password', { current, next }),
  deleteAccount: (password) => api.post('/auth/delete', { password }),
}
