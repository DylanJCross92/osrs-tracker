// Thin wrapper over Google Tag Manager's dataLayer. The container itself
// (GTM-K6756RQ3) is loaded in index.html; this just pushes events to it, and
// is a safe no-op if the tag is blocked (ad blockers, privacy settings).
export function track(event, params = {}) {
  try {
    // Browsers marked as internal (visit /?internal=1, see index.html) send no custom events at all.
    if (localStorage.getItem('tickgains-internal') === '1') return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...params })
  } catch {
    /* analytics must never break the app */
  }
}
