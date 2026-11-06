import { api, BASE_URL } from './client'

function skillQuery(skill) {
  return skill && skill !== 'Overall' ? `?skill=${encodeURIComponent(skill)}` : ''
}

export const cardsApi = {
  getWeeklyData: (username, skill) =>
    api.get(`/players/${encodeURIComponent(username)}/card/weekly/data${skillQuery(skill)}`),
  freezeWeekly: (username, skill) =>
    api.post(`/players/${encodeURIComponent(username)}/card/weekly/freeze`, { skill: skill || 'Overall' }),
  getFrozen: (slug) => api.get(`/cards/${encodeURIComponent(slug)}`),
  weeklyImageUrl: (username, skill) =>
    `${BASE_URL}/players/${encodeURIComponent(username)}/card/weekly/image.png${skillQuery(skill)}`,
  frozenImageUrl: (slug) => `${BASE_URL}/cards/${encodeURIComponent(slug)}/image.png`,
}
