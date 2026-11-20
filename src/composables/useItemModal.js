import { ref } from 'vue'
import { track } from '@/utils/analytics'

// The item popup: any page can open one item's price details over itself (see components/ItemModal.vue, mounted once in App.vue).
/** The address of the item showing in the popup, or '' when it is closed. */
export const modalSlug = ref('')

export function openItemModal(slug, source = '') {
  if (!slug) return
  modalSlug.value = slug
  track('item_modal_open', { source })
}
export const closeItemModal = () => {
  modalSlug.value = ''
}

/**
 * For a link to an item: a plain click opens the popup, while a click with a modifier key (or a middle click) is left to the browser so
 * the link still opens in a new tab.
 */
export function onItemLinkClick(event, slug, source = '') {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  openItemModal(slug, source)
}
