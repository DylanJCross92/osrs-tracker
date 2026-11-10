// Account roles. Every account is a plain "user" unless the server grants more. Roles are only ever set here on the
// server: nothing a visitor sends can change them.
export const ROLES = ['user', 'admin', 'owner']
export const ROLE_LABELS = { user: 'User', admin: 'Admin', owner: 'Owner' }
// The roles the site owner's account gets (instead of "user").
export const OWNER_ROLES = ['admin', 'owner']

/** Known roles only, in a fixed order (user, admin, owner); an empty or invalid list means a plain "user". */
export function normalizeRoles(input) {
  const set = new Set(Array.isArray(input) ? input.filter((r) => ROLES.includes(r)) : [])
  if (!set.size) set.add('user')
  return ROLES.filter((r) => set.has(r))
}

/** True when the account has at least one of the given roles. */
export const hasRole = (roles, ...wanted) => {
  const have = normalizeRoles(roles)
  return wanted.some((r) => have.includes(r))
}

/** The site owner's address: OWNER_EMAIL, or the address that already receives the signup notifications. */
export const ownerEmail = () => String(process.env.OWNER_EMAIL || process.env.NOTIFY_EMAIL || '').trim().toLowerCase()
export const isOwnerEmail = (email) => {
  const owner = ownerEmail()
  return Boolean(owner) && String(email || '').trim().toLowerCase() === owner
}
