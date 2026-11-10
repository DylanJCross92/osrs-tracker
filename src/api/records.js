import { api, BASE_URL } from './client'

const enc = encodeURIComponent

export const recordsApi = {
  get: (username) => api.get(`/players/${enc(username)}/records`),
  // The image is drawn by the server from live numbers.
  imageUrl: (username, key) => `${BASE_URL}/players/${enc(username)}/records/${enc(key)}/image.png`,
  // The link people share: the server gives it a proper preview, then the app opens the profile's Records tab.
  shareUrl: (username, key) => `${window.location.origin}/player/${enc(username)}/records/${enc(key)}`,
}
