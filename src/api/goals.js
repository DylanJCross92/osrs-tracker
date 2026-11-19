import { api, BASE_URL } from './client'

const enc = encodeURIComponent

export const goalsApi = {
  // Public. { goals: [{ id, skill, type, target, title, pinned, fromPlan, percent, currentXp, targetXp, remainingXp, reached, reachedAt }],
  //   plan: { planId, name, updatedAt, percent, reached, count } | null }. Goals that come from the plan come first, in plan order.
  list: (username) => api.get(`/players/${enc(username)}/goals`),
  // Owner only. Each returns the same { goals, plan } as list.
  add: (username, goal) => api.post(`/players/${enc(username)}/goals`, goal),
  remove: (username, id) => api.post(`/players/${enc(username)}/goals/${id}/delete`),
  pin: (username, id, pinned) => api.post(`/players/${enc(username)}/goals/${id}/pin`, { pinned }),
  // Show a whole plan as the profile's goal ({ planId, name, goals: [{ skill, targetXp }] }), or take it off again.
  setPlan: (username, plan) => api.post(`/players/${enc(username)}/plan`, plan),
  clearPlan: (username) => api.post(`/players/${enc(username)}/plan/delete`),
  imageUrl: (username, id) => `${BASE_URL}/players/${enc(username)}/goals/${id}/image.png`,
  // The link people share: the server gives it a preview card, then the app opens the profile's Goals tab.
  shareUrl: (username, id) => `${window.location.origin}/player/${enc(username)}/goals/${id}`,
}
