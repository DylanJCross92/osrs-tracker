import { reactive } from 'vue'

// Module-level (not created inside useToast) so every caller shares the
// same reactive object — this is intentionally a singleton, not a
// per-component instance.
const toastState = reactive({ message: '', visible: false })
let hideTimeout = null

export function useToast() {
  function showToast(message, duration = 2600) {
    toastState.message = message
    toastState.visible = true
    clearTimeout(hideTimeout)
    hideTimeout = setTimeout(() => {
      toastState.visible = false
    }, duration)
  }

  return { toastState, showToast }
}
