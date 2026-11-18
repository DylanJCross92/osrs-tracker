import { api } from './client'
import { getVisitorId } from '@/utils/visitorId'

// The browser's random visitor number goes with signing up, signing in and confirming, so what this browser did before it had an
// account joins the account in the statistics (see server linkVisitor). null when the browser asks not to be tracked.
const vid = () => getVisitorId() || undefined

export const authApi = {
  // { user } with user null for a visitor who is not signed in.
  me: () => api.get('/auth/me'),
  // website is the hidden honeypot field: always empty for a real visitor.
  // Resolves to { pending: true, email, emailSent }: the account exists but cannot be used until the email is confirmed.
  signup: ({ email, password, confirmPassword, newsletter, settings, website = '' }) => api.post('/auth/signup', { email, password, confirmPassword, newsletter, settings, website, vid: vid() }),
  verify: (token) => api.post('/auth/verify', { token, vid: vid() }),
  resend: (email) => api.post('/auth/resend', { email }),
  login: (email, password) => api.post('/auth/login', { email, password, vid: vid() }),
  logout: () => api.post('/auth/logout'),
  saveSettings: (settings) => api.put('/auth/settings', { settings }),
  // Browser data that follows the account (see utils/accountData.js).
  getData: () => api.get('/auth/data'),
  saveData: (data) => api.put('/auth/data', { data }),
  forgot: (email) => api.post('/auth/forgot', { email }),
  reset: (token, password) => api.post('/auth/reset', { token, password }),
  changePassword: (current, next) => api.post('/auth/password', { current, next }),
  deleteAccount: (password) => api.post('/auth/delete', { password }),
}
