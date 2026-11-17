// Page titles and descriptions as search results show them. Google cuts a title at about 60 characters and a description at
// about 160, so these keep the part that matters inside that and drop the rest on purpose, instead of leaving the cut to
// chance. This is a copy of src/utils/seoText.js: the server image ships without the app's src folder. Keep the two in step.
export const BRAND = 'TickGains'
export const TITLE_MAX = 60
export const DESCRIPTION_MAX = 158

/** "Title | TickGains" when that fits in a search result, otherwise just the title. An existing brand suffix is ignored. */
export function withBrand(title, max = TITLE_MAX) {
  const core = String(title || '').replace(/\s*\|\s*TickGains$/, '').trim()
  const full = `${core} | ${BRAND}`
  return full.length <= max ? full : core
}

/** A finished title: drops the brand suffix if it does not fit, and leaves a title without the suffix alone. */
export const fitTitle = (title, max = TITLE_MAX) => (/\|\s*TickGains$/.test(String(title || '')) ? withBrand(title, max) : String(title || ''))

/** The description, cut at a word boundary with an ellipsis if it is longer than a search result shows. */
export function fitDescription(text, max = DESCRIPTION_MAX) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-–]+$/, '')}…`
}
