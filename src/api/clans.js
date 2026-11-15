import { BASE_URL, api } from './client'

const enc = encodeURIComponent

export const clansApi = {
  // Signed in. { slug, name, description, createdAt, memberCount }. Every clan is listed on the Clans page.
  create: (name, description) => api.post('/clans', { name, description }),
  // Public. The Clans page: { clans: [{ slug, name, description, createdAt, memberCount, weekGain, topMembers, competitions }],
  // running: [{ ...competition, clan: { slug, name } }], totals: { clans, members, runningCompetitions, weekGain } }
  list: () => api.get('/clans'),
  // Signed in. { clans: [{ ...clan, openCompetitions, owner }] }
  mine: () => api.get('/clans/mine'),
  // Anyone. The clan, its members with this week's gain, its competitions and what the viewer may do:
  // `requests` (owner and moderators only): the people waiting to be let in, [{ username, displayName, requestedAt, overallLevel, signedIn }].
  // { clan, members, requests, competitions, viewer: { role, canManage, canInvite, inviteToken } }
  get: (slug) => api.get(`/clans/${enc(slug)}`),
  // What an invite link shows before joining: { slug, name, description, memberCount, acceptingRequests }.
  preview: (token) => api.get(`/clans/invite/${enc(token)}`),
  // Ask to join with an RSN. The owner or a moderator answers, so for most people the result is
  // { slug, name, player, status: 'pending', alreadyRequested, alreadyMember: false, verified }. An owner or moderator is added
  // straight away ({ status: 'member' }), and someone already in gets { status: 'member', alreadyMember: true }.
  join: (token, rsn) => api.post('/clans/join', { token, rsn }),
  // Owner only: turn new join requests on or off for the invite link. Requests already waiting can still be answered.
  setAcceptingRequests: (slug, accepting) => api.post(`/clans/${enc(slug)}/requests/accepting`, { accepting }),
  // Owner or moderator: let a waiting player in, or turn the request down.
  approveRequest: (slug, username) => api.post(`/clans/${enc(slug)}/requests/${enc(username)}/approve`),
  declineRequest: (slug, username) => api.post(`/clans/${enc(slug)}/requests/${enc(username)}/decline`),
  resetInvite: (slug) => api.post(`/clans/${enc(slug)}/invite/reset`),
  // Owner or moderator: add a player straight away, by name. A player the site does not track yet is added first.
  // { player: { username, displayName }, alreadyMember }
  addMember: (slug, rsn) => api.post(`/clans/${enc(slug)}/members`, { rsn }),
  remove: (slug, username) => api.post(`/clans/${enc(slug)}/members/${enc(username)}/remove`),
  setModerator: (slug, username, mod) => api.post(`/clans/${enc(slug)}/members/${enc(username)}/mod`, { mod }),
  // Owner only. `confirm` has to be the word "Delete" (the clan page asks for it to be typed).
  delete: (slug, confirm) => api.post(`/clans/${enc(slug)}/delete`, { confirm }),
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
