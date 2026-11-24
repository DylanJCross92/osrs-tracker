import { reactive } from 'vue'

// A window that says what needs an account and offers to create one or log in. Shared by everything that is for signed-in visitors only (following a
// player, for now): it asks once, in the same words, wherever it comes up. Mounted once, in App.vue (components/SignInPrompt.vue).
export const signInPrompt = reactive({ open: false, title: '', text: '', points: [], next: '' })

/** Open the window. `next` is where to come back to after signing up or logging in. */
export function askSignIn({ title, text, points = [], next = '' }) {
  Object.assign(signInPrompt, { open: true, title, text, points, next })
}
export function closeSignInPrompt() {
  signInPrompt.open = false
}
