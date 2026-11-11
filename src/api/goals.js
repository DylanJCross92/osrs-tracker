import { api, BASE_URL } from './client'

const enc = encodeURIComponent

export const goalsApi = {
  // Public. { goals: [{ id, skill, type, target, title, pinned, percent, currentXp, targetXp, remainingXp, reached, reachedAt }] }
  list: (username) => api.get(`/players/${enc(username)}/goals`),
  // Owner only. Each returns the whole updated list.
  add: (username, goal) => api.post(`/players/${enc(username)}/goals`, goal),
  remove: (username, id) => api.post(`/players/${enc(username)}/goals/${id}/delete`),
  pin: (username, id, pinned) => api.post(`/players/${enc(username)}/goals/${id}/pin`, { pinned }),
  imageUrl: (username, id) => `${BASE_URL}/players/${enc(username)}/goals/${id}/image.png`,
  // The link people share: the server gives it a preview card, then the app opens the profile's Goals tab.
  shareUrl: (username, id) => `${window.location.origin}/player/${enc(username)}/goals/${id}`,
}
