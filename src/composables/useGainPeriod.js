import { ref } from 'vue'

// Module-level (not created inside useGainPeriod) so every caller shares the
// same ref — picking a period on one page keeps it selected on the others
// for the rest of the session.
const period = ref('day')

export function useGainPeriod() {
  return { period }
}
