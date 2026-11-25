// One-off in-app notices the owner sends to every account (see services/broadcasts.service.js). They land in each person's notification
// bell, not their email. To announce something else, add an entry here and the owner can send it from User Management.
//   type   the notice kind (src/utils/noticeView.js gives each its icon); not in a mutable group, so it always arrives
//   text   what the bell says, at most 200 characters
//   link   where pressing it goes, a path in the app
export const BROADCASTS = {
  'weekly-race-2026-11': {
    type: 'race_open',
    text: 'A weekly XP race is on, open to every player. Join with your RuneScape name and see who gains the most this week.',
    link: '/clans',
  },
}

export const MAX_NOTICE_TEXT = 200
export const broadcastDedupeKey = (key) => `broadcast:${key}`
