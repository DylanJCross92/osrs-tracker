// How one recorded event reads in a visitor's journey: "Viewed a page /player/zezima", "Shared a weekly card (link)".
// Detail keys that only repeat the page or add noise are left out.

const SKIP = new Set(['page_title', 'route_name', 'page_path'])

const humanize = (name) => {
  const text = String(name).replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** { text, detail, kind } for an event name and its details. kind is 'page' for a page view and 'action' for everything else. */
export function describeEvent(name, props = {}) {
  if (name === 'spa_page_view') return { kind: 'page', text: 'Viewed', detail: String(props.page_path || '/') }
  if (name === 'login') return { kind: 'action', text: 'Signed in', detail: props.method ? String(props.method).replace(/_/g, ' ') : '' }
  if (name === 'session_resumed') return { kind: 'action', text: 'Came back (still signed in)', detail: '' }
  const detail = Object.entries(props)
    .filter(([k, v]) => !SKIP.has(k) && v !== '' && v != null)
    .map(([k, v]) => (typeof v === 'boolean' ? (v ? k.replace(/_/g, ' ') : '') : `${k.replace(/_/g, ' ')}: ${v}`))
    .filter(Boolean)
    .join(' · ')
  return { kind: 'action', text: humanize(name), detail }
}
