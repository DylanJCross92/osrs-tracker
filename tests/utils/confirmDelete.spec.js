import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConfirmDelete from '@/components/ConfirmDelete.vue'

const mountIt = (props = {}) => mount(ConfirmDelete, { props: { open: true, title: 'Delete this skill?', name: 'Mining', text: 'will be removed.', cancelLabel: 'Keep skill', confirmLabel: 'Delete skill', ...props }, attachTo: document.body })

describe('the delete confirmation window', () => {
  it('shows what is being deleted and offers keep and delete', async () => {
    const w = mountIt()
    await nextTick()
    const card = document.body.querySelector('.modal-card')
    expect(card.getAttribute('role')).toBe('alertdialog')
    expect(card.textContent).toContain('Delete this skill?')
    expect(card.textContent).toContain('Mining will be removed.')
    expect(card.querySelector('.po-delete').textContent).toBe('Delete skill')
    w.unmount()
  })
  it('emits confirm and cancel, and cancels on Escape', async () => {
    const w = mountIt()
    await nextTick()
    document.body.querySelector('.po-delete').click()
    expect(w.emitted('confirm')).toHaveLength(1)
    document.body.querySelector('.btn-ghost').click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('cancel')).toHaveLength(2)
    w.unmount()
  })
  it('draws nothing when closed', () => {
    const w = mountIt({ open: false })
    expect(document.body.querySelector('.modal-card')).toBeNull()
    w.unmount()
  })
})
