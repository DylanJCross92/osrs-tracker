import { ref, watch } from 'vue'

const STORAGE_KEY = 'tickgains:gain-period'
const VALID_PERIODS = ['day', 'week', 'month']

function loadStoredPeriod() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return VALID_PERIODS.includes(stored) ? stored : 'day'
  } catch {
    // Storage unavailable (private browsing, blocked, etc.) — just don't persist.
    return 'day'
  }
}

// Module-level (not created inside useGainPeriod) so every caller shares the
// same ref — picking a period on one page keeps it selected on the others,
// and it's saved to localStorage so it survives a reload too.
const period = ref(loadStoredPeriod())

watch(period, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Ignore write failures (private browsing, storage full, etc.)
  }
})

export function useGainPeriod() {
  return { period }
}
