// Notices an account can switch off, grouped the way the account page shows them. Anything not listed (claim updates, and
// notices added later) always arrives.
export const NOTICE_GROUPS = {
  records: ['record'],
  mine: ['goal_reached', 'milestone'],
  following: ['follow_goal', 'follow_milestone'],
  social: ['new_follower', 'challenge_accepted'],
}

export const NOTICE_GROUP_IDS = Object.keys(NOTICE_GROUPS)

/** True when `type` belongs to a group the account has switched off. */
export function isTypeMuted(type, muted) {
  if (!Array.isArray(muted) || !muted.length) return false
  return muted.some((id) => (NOTICE_GROUPS[id] || []).includes(type))
}
