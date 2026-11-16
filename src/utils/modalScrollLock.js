// One rule for the whole site: while any modal is open, the page behind it does not scroll.
// Every modal here is a `.modal-overlay` (or marked aria-modal), so instead of each one locking the page by itself, this watches
// the document and locks it whenever one exists, and unlocks it when the last one is gone. Stacked modals just work.
export const MODAL_SELECTOR = '.modal-overlay, [aria-modal="true"]'
export const LOCK_CLASS = 'modal-open'

/** Starts watching `doc`. Returns a function that stops watching and releases the lock. */
export function initModalScrollLock(doc = document) {
  const root = doc.documentElement
  let locked = false
  function sync() {
    const open = !!doc.querySelector(MODAL_SELECTOR)
    if (open === locked) return
    locked = open
    if (open) {
      // Hiding the scrollbar widens the page, so the gap it leaves is filled and nothing shifts sideways.
      const gap = (doc.defaultView?.innerWidth || 0) - root.clientWidth
      if (gap > 0) root.style.setProperty('--scrollbar-gap', `${gap}px`)
      root.classList.add(LOCK_CLASS)
    } else {
      root.classList.remove(LOCK_CLASS)
      root.style.removeProperty('--scrollbar-gap')
    }
  }
  const observer = new MutationObserver(sync)
  observer.observe(doc.body, { childList: true, subtree: true })
  sync()
  return () => {
    observer.disconnect()
    locked = true
    root.classList.remove(LOCK_CLASS)
    root.style.removeProperty('--scrollbar-gap')
  }
}
