import { api, BASE_URL } from './client'

// ?skill= / ?period=, Overall and weekly are the defaults, so they stay out of the URL.
// ?mode=hardcore picks a name's Hardcore Worlds character.
function cardQuery(skill, period, mode) {
  const params = new URLSearchParams()
  if (skill && skill !== 'Overall') params.set('skill', skill)
  if (period && period !== 'week') params.set('period', period)
  if (mode === 'hardcore') params.set('mode', 'hardcore')
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const cardsApi = {
  getWeeklyData: (username, skill, period, mode) =>
    api.get(`/players/${encodeURIComponent(username)}/card/weekly/data${cardQuery(skill, period, mode)}`),
  freezeWeekly: (username, skill, period, mode) =>
    api.post(`/players/${encodeURIComponent(username)}/card/weekly/freeze${mode === 'hardcore' ? '?mode=hardcore' : ''}`, { skill: skill || 'Overall', period: period || 'week' }),
  getFrozen: (slug) => api.get(`/cards/${encodeURIComponent(slug)}`),
  weeklyImageUrl: (username, skill, period, mode) =>
    `${BASE_URL}/players/${encodeURIComponent(username)}/card/weekly/image.png${cardQuery(skill, period, mode)}`,
  level99ImageUrl: (username, skill, preview = false) => `${BASE_URL}/players/${encodeURIComponent(username)}/card/level99/image.png?skill=${encodeURIComponent(skill)}${preview ? '&preview=1' : ''}`,
  // The link people share: the server gives it the congratulations card, then the app opens the profile.
  level99ShareUrl: (username, skill) => `${window.location.origin}/player/${encodeURIComponent(username)}/level-99/${encodeURIComponent(skill)}`,
  cardQuery,
  frozenImageUrl: (slug) => `${BASE_URL}/cards/${encodeURIComponent(slug)}/image.png`,
}
