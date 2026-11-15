import { BASE_URL, api } from './client'

const enc = encodeURIComponent

export const clansApi = {
  // Signed in. { slug, name, description, visibility, createdAt, memberCount }
  // `visibility` is 'unlisted' (only people with the link find it) or 'public' (listed on the Clans page).
  create: (name, description, visibility = 'unlisted') => api.post('/clans', { name, description, visibility }),
  // Public. The Clans page: { clans: [{ slug, name, description, createdAt, memberCount, weekGain, topMembers, competitions }],
  // running: [{ ...competition, clan: { slug, name } }], totals: { clans, members, runningCompetitions, weekGain } }
  list: () => api.get('/clans'),
  setVisibility: (slug, visibility) => api.post(`/clans/${enc(slug)}/visibility`, { visibility }),
  // Signed in. { clans: [{ ...clan, openCompetitions, owner }] }
  mine: () => api.get('/clans/mine'),
  // Anyone. The clan, its members with this week's gain, its competitions and what the viewer may do:
  // { clan, members, competitions, viewer: { role, canManage, canInvite, inviteToken } }
  get: (slug) => api.get(`/clans/${enc(slug)}`),
  // What an invite link shows before joining: { slug, name, description, memberCount }.
  preview: (token) => api.get(`/clans/invite/${enc(token)}`),
  // Join with an RSN. { slug, name, player, alreadyMember, verified }
  join: (token, rsn) => api.post('/clans/join', { token, rsn }),
  resetInvite: (slug) => api.post(`/clans/${enc(slug)}/invite/reset`),
  remove: (slug, username) => api.post(`/clans/${enc(slug)}/members/${enc(username)}/remove`),
  setModerator: (slug, username, mod) => api.post(`/clans/${enc(slug)}/members/${enc(username)}/mod`, { mod }),
  delete: (slug) => api.post(`/clans/${enc(slug)}/delete`),
  // The picture for an invite link: the clan, who is in it and the competition that is on.
  inviteImageUrl: (token) => `${BASE_URL}/clans/invite/${enc(token)}/image.png`,
  inviteUrl: (token) => `${window.location.origin}/join/${enc(token)}`,
  pageUrl: (slug) => `${window.location.origin}/clans/${enc(slug)}`,
  // Owner or moderator. `body`: { title, metric: 'skill_xp' | 'overall_xp', skill, startsAt, endsAt } (dates as ISO strings).
  createCompetition: (slug, body) => api.post(`/clans/${enc(slug)}/competitions`, body),
}

export const competitionsApi = {
  // { competition: { id, title, metric, skill, startsAt, endsAt, status, clan: { slug, name } },
  //   standings: [{ rank, username, displayName, gain, startXp, currentXp/endXp, gapToAbove, pending, joinedLate }],
  //   entrants, viewer: { role, canManage } }
  get: (id) => api.get(`/competitions/${id}`),
  cancel: (id) => api.post(`/competitions/${id}/cancel`),
}
