// Injects per-share-card meta tags into the built index.html template, so a
// plain HTTP GET (which is all link-unfurling bots like Discord/Twitter/
// iMessage ever do — they never run the SPA's JS) sees the right title,
// description, and og:image for that specific card. The Vue app still calls
// setPageMeta() client-side too, for in-app navigation and a consistent tab
// title once it hydrates — this is only about what a bot sees on first byte.

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// Replaces the content="..." value of the first <meta> tag matching
// (name|property)="attrValue", regardless of attribute order in the source.
function setMetaContent(html, attrValue, newContent) {
  const tagRe = new RegExp(`<meta[^>]*\\b(?:name|property)=["']${attrValue}["'][^>]*>`, 'i')
  return html.replace(tagRe, (tag) => tag.replace(/content=(["'])[^"']*\1/i, `content="${escapeHtml(newContent)}"`))
}

function setLinkHref(html, rel, newHref) {
  const tagRe = new RegExp(`<link[^>]*\\brel=["']${rel}["'][^>]*>`, 'i')
  return html.replace(tagRe, (tag) => tag.replace(/href=(["'])[^"']*\1/i, `href="${escapeHtml(newHref)}"`))
}

/**
 * template: the raw index.html string. { title, description, imageUrl,
 * pageUrl }: all plain text/URLs — escaped here, callers don't need to.
 */
export function injectCardMeta(template, { title, description, imageUrl, pageUrl }) {
  let html = template
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  html = setMetaContent(html, 'description', description)
  html = setMetaContent(html, 'og:title', title)
  html = setMetaContent(html, 'og:description', description)
  html = setMetaContent(html, 'og:url', pageUrl)
  html = setMetaContent(html, 'og:image', imageUrl)
  html = setMetaContent(html, 'twitter:card', 'summary_large_image')
  html = setMetaContent(html, 'twitter:title', title)
  html = setMetaContent(html, 'twitter:description', description)
  html = setMetaContent(html, 'twitter:image', imageUrl)
  html = setLinkHref(html, 'canonical', pageUrl)
  return html
}
