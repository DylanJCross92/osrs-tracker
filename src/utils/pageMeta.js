const SITE_NAME = 'TickGains'
const SITE_URL = 'https://tickgains.com'

function setMetaTag(selectorAttr, selectorValue, content) {
  let tag = document.querySelector(`meta[${selectorAttr}="${selectorValue}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(selectorAttr, selectorValue)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

/**
 * Updates the document title, meta description, OG tags, and canonical
 * link for the current route — this is a client-rendered SPA with no SSR,
 * so these start from index.html's defaults and get overwritten per-page
 * once a view knows what it's showing (e.g. the player's display name).
 */
export function setPageMeta({ title, description, path = '/' }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — OSRS XP & Hiscores Tracker`
  document.title = fullTitle

  setMetaTag('name', 'description', description)
  setMetaTag('property', 'og:title', fullTitle)
  setMetaTag('property', 'og:description', description)
  setMetaTag('property', 'og:url', `${SITE_URL}${path}`)

  let canonical = document.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', `${SITE_URL}${path}`)
}
