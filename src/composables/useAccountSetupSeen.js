import { ref } from 'vue'

// Whether the person has settled the account setup on the planner's start page (pressed Done, or started a plan): until then the questions are asked
// inline on the page; after that they are a small option in the player panel at the top. Kept in this browser.
const KEY = 'tickgains-account-setup-v1'
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
const seen = ref(read())

export function useAccountSetupSeen() {
  function markSeen() {
    if (seen.value) return
    seen.value = true
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* storage unavailable: it asks again next visit */
    }
  }
  return { seen, markSeen }
}
