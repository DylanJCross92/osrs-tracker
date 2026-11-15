// Which name is "you" on this site. An account that owns a verified profile is that profile; the saved name (the "I am ..."
// button, kept in this browser and on the account) only decides for people with no verified profile.

const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

/**
 * The name to use as "me". `profiles` are the verified profiles the account owns ([{ username, displayName }]), `saved` is the
 * name kept as yours. With no verified profile the saved name stays. With one or more, the saved name stays only when it is
 * one of them (someone with two profiles can pick either); otherwise it is the first profile.
 */
export function meForProfiles(profiles, saved) {
  const owned = Array.isArray(profiles) ? profiles : []
  if (!owned.length) return String(saved || '')
  const own = owned.find((p) => same(p.username, saved) || same(p.displayName, saved))
  return (own || owned[0]).displayName
}
