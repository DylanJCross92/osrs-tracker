import { api, BASE_URL } from './client'

// ?skill= / ?period= — Overall and weekly are the defaults, so they stay out of the URL.
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
  cardQuery,
  frozenImageUrl: (slug) => `${BASE_URL}/cards/${encodeURIComponent(slug)}/image.png`,
}
