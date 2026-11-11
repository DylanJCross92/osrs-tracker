import { api } from './client'

const enc = encodeURIComponent

export const followsApi = {
  // Signed-in only. Each returns { players: [{ username, displayName }] }, the account's whole list.
  list: () => api.get('/follows'),
  setAll: (names) => api.put('/follows', { names }),
  follow: (name) => api.post(`/players/${enc(name)}/follow`),
  unfollow: (name) => api.post(`/players/${enc(name)}/unfollow`),
  // Public: recent gains and milestones for a list of names (works for names saved in the browser too).
  feed: (names) => api.get(`/following/feed?names=${enc(names.join(','))}`),
}
