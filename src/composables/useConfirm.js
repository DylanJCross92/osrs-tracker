import { reactive } from 'vue'

// Same singleton pattern as useToast — native window.confirm() is unreliable
// in some embedded/automated browser contexts (and doesn't match the app's
// theme), so destructive actions go through this in-app dialog instead.
const state = reactive({ visible: false, message: '', confirmLabel: 'Confirm' })
let resolvePromise = null

export function useConfirm() {
  function askConfirm(message, confirmLabel = 'Confirm') {
    state.message = message
    state.confirmLabel = confirmLabel
    state.visible = true
    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }

  function resolve(result) {
    state.visible = false
    resolvePromise?.(result)
    resolvePromise = null
  }

  return { confirmState: state, askConfirm, resolve }
}
