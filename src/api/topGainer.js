import { api, BASE_URL } from './client'

const enc = encodeURIComponent

export const topGainerApi = {
  // { days, streak, longest, bestXp, bestDay, firstDay, lastDay, leadingNow }; days is 0 for a player who never was.
  get: (username) => api.get(`/players/${enc(username)}/top-gainer`),
  // The image is drawn by the server from the live count.
  imageUrl: (username) => `${BASE_URL}/players/${enc(username)}/top-gainer/image.png`,
  // The link people share: the server gives it a proper preview, then the app opens the profile.
  shareUrl: (username) => `${window.location.origin}/player/${enc(username)}/top-gainer`,
}
