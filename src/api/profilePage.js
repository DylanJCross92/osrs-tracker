import { api, ApiError, BASE_URL } from './client'

const enc = encodeURIComponent

export const profilePageApi = {
  // { bio, links: [{ kind, url }], hasAvatar, avatarV }
  get: (username) => api.get(`/players/${enc(username)}/page`),
  save: (username, page) => api.put(`/players/${enc(username)}/page`, page),
  removeAvatar: (username) => api.post(`/players/${enc(username)}/avatar/remove`),
  // The picture, by version, so a new upload is picked up straight away and old ones stay cached.
  avatarUrl: (username, version) => `${BASE_URL}/players/${enc(username)}/avatar${version ? `?v=${version}` : ''}`,
  // Sends the image bytes as the body (the endpoint takes raw JPEG, PNG or WebP).
  async uploadAvatar(username, blob) {
    const res = await fetch(`${BASE_URL}/players/${enc(username)}/avatar`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': blob.type }, body: blob })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(data?.error || 'Could not upload that picture.', res.status)
    return data
  },
  adminReset: (username) => api.post(`/admin/profiles/${enc(username)}/reset`),
}
