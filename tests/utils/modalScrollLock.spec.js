import { afterEach, describe, expect, it } from 'vitest'
import { initModalScrollLock, LOCK_CLASS } from '@/utils/modalScrollLock'

const tick = () => new Promise((r) => setTimeout(r, 0))
const open = (cls = 'modal-overlay') => {
  const el = document.createElement('div')
  el.className = cls
  document.body.appendChild(el)
  return el
}

describe('modal scroll lock', () => {
  let stop = null
  afterEach(() => {
    stop?.()
    document.body.innerHTML = ''
  })

  it('locks the page while a modal is open and releases it when it closes', async () => {
    stop = initModalScrollLock()
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false)
    const m = open()
    await tick()
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true)
    m.remove()
    await tick()
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false)
  })

  it('stays locked until the last of several stacked modals closes', async () => {
    stop = initModalScrollLock()
    const a = open()
    const b = open('modal-overlay msheet-overlay')
    await tick()
    a.remove()
    await tick()
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true)
    b.remove()
    await tick()
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false)
  })

  it('locks for any aria-modal dialog and starts locked if one is already open', async () => {
    const d = document.createElement('div')
    d.setAttribute('aria-modal', 'true')
    document.body.appendChild(d)
    stop = initModalScrollLock()
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(true)
  })

  it('releases the lock when stopped', async () => {
    stop = initModalScrollLock()
    open()
    await tick()
    stop()
    stop = null
    expect(document.documentElement.classList.contains(LOCK_CLASS)).toBe(false)
  })
})
