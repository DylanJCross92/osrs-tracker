<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card cmt-modal" role="dialog" aria-modal="true" aria-label="Start a competition">
      <div class="share-modal-header">
        <h2>Start a competition</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <form class="cmt-form" novalidate @submit.prevent="submit">
        <fieldset class="cmt-group">
          <legend>What is measured</legend>
          <div class="cmt-choice" role="radiogroup" aria-label="What is measured">
            <button type="button" class="cmt-pill" :class="{ on: form.metric === 'skill_xp' }" role="radio" :aria-checked="form.metric === 'skill_xp'" @click="setMetric('skill_xp')">XP in one skill</button>
            <button type="button" class="cmt-pill" :class="{ on: form.metric === 'overall_xp' }" role="radio" :aria-checked="form.metric === 'overall_xp'" @click="setMetric('overall_xp')">Overall XP</button>
          </div>
          <label v-if="form.metric === 'skill_xp'" class="cmt-field">
            <span>Skill</span>
            <select v-model="form.skill" @change="syncTitle">
              <option v-for="s in SKILLS" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
        </fieldset>

        <label class="cmt-field">
          <span>Title <small>{{ form.title.length }}/60</small></span>
          <input v-model="form.title" type="text" maxlength="60" autocomplete="off" data-1p-ignore @input="titleEdited = true" />
        </label>

        <fieldset class="cmt-group">
          <legend>Starts</legend>
          <div class="cmt-when">
            <input v-model="form.startDate" type="date" :min="today" aria-label="Start date" />
            <input v-model="form.startTime" type="time" step="900" aria-label="Start time" />
          </div>
          <div class="cmt-choice cmt-quick" role="group" aria-label="Set the start">
            <span class="cmt-quick-label">Start</span>
            <button type="button" class="cmt-pill is-small" @click="startNow">Right now</button>
          </div>
        </fieldset>

        <fieldset class="cmt-group">
          <legend>Ends</legend>
          <div class="cmt-when">
            <input v-model="form.endDate" type="date" :min="form.startDate || today" aria-label="End date" />
            <input v-model="form.endTime" type="time" step="900" aria-label="End time" />
          </div>
          <div class="cmt-choice cmt-quick" role="group" aria-label="Set the end from the start">
            <span class="cmt-quick-label">Run for</span>
            <button v-for="l in LENGTHS" :key="l.key" type="button" class="cmt-pill is-small" @click="runFor(l.ms)">{{ l.label }}</button>
          </div>
        </fieldset>

        <div v-if="windowInfo" class="cmt-window" aria-live="polite">
          <div class="cmt-window-row">
            <span class="cmt-window-label">Starts</span>
            <span class="cmt-window-value" :class="{ 'is-now': windowInfo.rightAway }">
              {{ windowInfo.startText }}
              <small>{{ windowInfo.startNote }}</small>
            </span>
          </div>
          <div class="cmt-window-row">
            <span class="cmt-window-label">Ends</span>
            <span class="cmt-window-value">{{ windowInfo.endText }}</span>
          </div>
          <div class="cmt-window-row">
            <span class="cmt-window-label">Runs for</span>
            <span class="cmt-window-value">{{ windowInfo.length }}</span>
          </div>
          <p class="cmt-zone">Times are in your time zone ({{ zone }}).</p>
        </div>
        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <div class="cmt-actions">
          <button class="btn btn-ghost" type="button" @click="$emit('close')">Cancel</button>
          <button class="btn btn-primary" type="submit" :disabled="busy">{{ busy ? 'Starting…' : windowInfo && !windowInfo.rightAway ? 'Schedule it' : 'Start now' }}</button>
        </div>
        <p class="clan-note">Everyone in the clan takes part, and anyone who joins while it runs is added. Each person's gain is measured from a fresh hiscores check at the start.</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ApiError } from '@/api/client'
import { clansApi } from '@/api/clans'
import { track } from '@/utils/analytics'
import { LENGTHS, applyLength, blankForm, buildCompetitionBody, defaultTitle, describeWindow, setStartNow, toDateInput } from '@/utils/competitionForm'
import { SKILL_NAMES } from '@/utils/osrsSkills'

const props = defineProps({ clan: { type: Object, required: true } })
const emit = defineEmits(['close', 'created'])

const SKILLS = SKILL_NAMES.filter((s) => s !== 'Overall')
const form = reactive(blankForm())
const today = toDateInput(new Date())
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time'

// The suggested title follows the choices until the person types their own.
const titleEdited = ref(false)
const syncTitle = () => {
  if (!titleEdited.value) form.title = defaultTitle(form.metric, form.skill)
}
const setMetric = (m) => {
  form.metric = m
  syncTitle()
}
const startNow = () => setStartNow(form)
const runFor = (ms) => applyLength(form, ms)

// The summary shows whenever both ends are valid moments, even when another rule (a title, a limit) is not met yet.
const windowInfo = computed(() => {
  const start = new Date(`${form.startDate}T${form.startTime}`)
  const end = new Date(`${form.endDate}T${form.endTime}`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null
  return describeWindow(start, end)
})

const busy = ref(false)
const error = ref('')
async function submit() {
  if (busy.value) return
  const built = buildCompetitionBody(form)
  if (!built.ok) {
    error.value = built.error
    return
  }
  busy.value = true
  error.value = ''
  try {
    const competition = await clansApi.createCompetition(props.clan.slug, built.body)
    track('competition_create', { metric: form.metric, start: describeWindow(built.startsAt, built.endsAt).rightAway ? 'now' : 'later' })
    emit('created', competition)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
