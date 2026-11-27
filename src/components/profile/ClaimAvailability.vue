<template>
  <div class="claim-avail">
    <p class="claim-avail-title">When will you be online? <em>Optional</em></p>
    <p class="claim-avail-hint">So {{ contact }} knows when to log on to get your code. Your time zone: {{ tz }}.</p>
    <div class="claim-avail-row">
      <select v-model="day" class="claim-avail-field" aria-label="Day">
        <option v-for="o in days" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <select v-model="from" class="claim-avail-field" aria-label="Online from">
        <option value="" disabled>From</option>
        <option v-for="o in timesFor(from)" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <span class="claim-avail-to">to</span>
      <select v-model="to" class="claim-avail-field" aria-label="Online until">
        <option value="" disabled>Until</option>
        <option v-for="o in timesFor(to)" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <p v-if="problem" class="claim-avail-problem" role="alert">{{ problem }}</p>
    <div v-if="saveable" class="claim-avail-save">
      <button class="btn btn-ghost" type="button" :disabled="busy || !win" @click="$emit('save', win)">{{ busy ? 'Saving…' : 'Save my window' }}</button>
      <button v-if="saved" class="btn-text claim-avail-clear" type="button" :disabled="busy" @click="clear">Clear</button>
    </div>
    <p v-if="saved" class="claim-avail-set">Saved: <b>{{ describeWindow(saved.onlineFrom, saved.onlineUntil) }}</b></p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { buildWindow, dayOptions, describeWindow, splitWindow, timeOptions } from '@/utils/claimWindow'

const props = defineProps({
  contact: { type: String, default: 'the owner' },
  // The window already saved on the claim, { onlineFrom, onlineUntil }, if any.
  saved: { type: Object, default: null },
  // Shows a Save button (a claim that is already running); otherwise the parent reads the live value from `change`.
  saveable: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['change', 'save'])

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your time zone'
const start = props.saved?.onlineFrom ? splitWindow(props.saved.onlineFrom, props.saved.onlineUntil) : null
const day = ref(start?.day || dayOptions()[0].value)
const from = ref(start?.from || '')
const to = ref(start?.to || '')

// The next week, plus the saved day if it is further off than that.
const days = computed(() => {
  const list = dayOptions()
  if (day.value && !list.some((o) => o.value === day.value)) {
    const [y, m, d] = day.value.split('-').map(Number)
    list.push({ value: day.value, label: new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) })
  }
  return list
})

// Every half hour, plus a saved time that is between two of those.
const timesFor = (current) => timeOptions(current)

const built = computed(() => buildWindow(day.value, from.value, to.value))
const problem = computed(() => (built.value && new Date(built.value.onlineUntil) <= new Date() ? 'That time has already passed. Pick a time still to come.' : ''))
const win = computed(() => (problem.value ? null : built.value))
watch(win, (w) => emit('change', w), { immediate: true })

function clear() {
  from.value = ''
  to.value = ''
  emit('save', null)
}
</script>
