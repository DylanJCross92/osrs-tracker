import { computed, ref, watch } from 'vue'
import { CONFIRM_KEY, RESPECT_KEY, cleanConfirmations } from '@/utils/requirements'
import { SYNCED_EVENT } from '@/utils/accountData'
import { doneShortcutIds, questStats } from '@/utils/questProgress'
import { questId } from '@/utils/questSlug'
import { diaryPatch, diaryStats } from '@/utils/diaryProgress'

// What the player says about quests, diaries, gear and unlocks (the hiscores cannot tell us), plus whether the planner
// should skip methods they are missing something for. Kept in this browser and, when signed in, in the account.
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

const confirmations = ref(cleanConfirmations(read(CONFIRM_KEY, {})))
const respect = ref(read(RESPECT_KEY, true) !== false)

watch(confirmations, (v) => write(CONFIRM_KEY, v), { deep: true })
watch(respect, (v) => write(RESPECT_KEY, v))
// Another device changed them (account sync): pick that up.
if (typeof window !== 'undefined') {
  window.addEventListener(SYNCED_EVENT, () => {
    confirmations.value = cleanConfirmations(read(CONFIRM_KEY, {}))
  })
}

const doneQuestIds = computed(() => doneShortcutIds(confirmations.value))
const stats = computed(() => questStats(confirmations.value))
const diaries = computed(() => diaryStats(confirmations.value))

export function useRequirements() {
  /** answer: 'have', 'missing', or null to go back to "not sure". */
  function setAnswer(id, answer) {
    const next = { ...confirmations.value }
    if (answer === 'have' || answer === 'missing') next[id] = answer
    else if (id in next) next[id] = 'unknown'
    confirmations.value = next
  }
  /** Several answers at once ({ id: 'have' | 'missing' | null }), saved together (ticking a diary tier also ticks the ones below it). */
  function setMany(patch) {
    const next = { ...confirmations.value }
    for (const [id, answer] of Object.entries(patch)) {
      if (answer === 'have' || answer === 'missing') next[id] = answer
      else if (id in next) next[id] = 'unknown'
    }
    confirmations.value = next
  }
  /** Mark a diary tier done (or not), with the tiers below or above it that have to follow. */
  const setDiaryDone = (id, done) => setMany(diaryPatch(id, done, confirmations.value))
  const questState = (name) => confirmations.value[questId(name)] || null
  /** Mark a quest finished (or not). Saved with the rest of the answers, so it follows a signed-in player everywhere. */
  const setQuestDone = (name, done) => setAnswer(questId(name), done ? 'have' : null)
  return { confirmations, respect, setAnswer, setMany, doneQuestIds, questStats: stats, diaryStats: diaries, questState, setQuestDone, setDiaryDone }
}
