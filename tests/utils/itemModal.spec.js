import { beforeEach, describe, expect, it } from 'vitest'
import { closeItemModal, modalSlug, onItemLinkClick, openItemModal } from '@/composables/useItemModal'

const click = (over = {}) => ({ defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, preventDefault() { this.defaultPrevented = true }, ...over })

beforeEach(() => closeItemModal())

describe('the item popup', () => {
  it('opens and closes by item address', () => {
    openItemModal('dragon-bones')
    expect(modalSlug.value).toBe('dragon-bones')
    closeItemModal()
    expect(modalSlug.value).toBe('')
    openItemModal('')
    expect(modalSlug.value).toBe('')
  })
  it('opens on a plain click and stops the link navigating', () => {
    const e = click()
    onItemLinkClick(e, 'earth-rune', 'materials')
    expect(e.defaultPrevented).toBe(true)
    expect(modalSlug.value).toBe('earth-rune')
  })
  it('leaves new-tab clicks to the browser', () => {
    for (const over of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const e = click(over)
      onItemLinkClick(e, 'earth-rune')
      expect(e.defaultPrevented).toBe(false)
      expect(modalSlug.value).toBe('')
    }
  })
})
