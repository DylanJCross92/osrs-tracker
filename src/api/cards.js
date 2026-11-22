import { api, BASE_URL } from './client'

// ?skill= / ?period=, Overall and weekly are the defaults, so they stay out of the URL.
function cardQuery(skill, period) {
  const params = new URLSearchParams()
  if (skill && skill !== 'Overall') params.set('skill', skill)
  if (period && period !== 'week') params.set('period', period)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const cardsApi = {
  getWeeklyData: (username, skill, period) =>
    api.get(`/players/${encodeURIComponent(username)}/card/weekly/data${cardQuery(skill, period)}`),
  freezeWeekly: (username, skill, period) =>
    api.post(`/players/${encodeURIComponent(username)}/card/weekly/freeze`, { skill: skill || 'Overall', period: period || 'week' }),
  getFrozen: (slug) => api.get(`/cards/${encodeURIComponent(slug)}`),
  weeklyImageUrl: (username, skill, period) =>
    `${BASE_URL}/players/${encodeURIComponent(username)}/card/weekly/image.png${cardQuery(skill, period)}`,
  level99ImageUrl: (username, skill) => `${BASE_URL}/players/${encodeURIComponent(username)}/card/level99/image.png?skill=${encodeURIComponent(skill)}`,
  // The link people share: the server gives it the congratulations card, then the app opens the profile.
  level99ShareUrl: (username, skill) => `${window.location.origin}/player/${encodeURIComponent(username)}/level-99/${encodeURIComponent(skill)}`,
  cardQuery,
  frozenImageUrl: (slug) => `${BASE_URL}/cards/${encodeURIComponent(slug)}/image.png`,
}
