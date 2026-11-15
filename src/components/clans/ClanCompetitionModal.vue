<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card cmt-modal" role="dialog" aria-modal="true" aria-label="Start a competition">
      <div class="share-modal-header">
        <h2>Start a competition</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <form class="cmt-form" novalidate @submit.prevent="submit">
        <div class="cmt-modes" role="radiogroup" aria-label="Kind of competition">
          <button type="button" class="cmt-mode" :class="{ on: mode === 'sotw' }" role="radio" :aria-checked="mode === 'sotw'" @click="setMode('sotw')">
            <span class="cmt-mode-icon" aria-hidden="true"><img :src="skillIconSrc(weekSkill)" alt="" width="30" height="30" /></span>
            <span class="cmt-mode-text"><b>Skill of the Week</b><small>This week: {{ weekSkill }}</small></span>
          </button>
          <button type="button" class="cmt-mode" :class="{ on: mode === 'custom' }" role="radio" :aria-checked="mode === 'custom'" @click="setMode('custom')">
            <span class="cmt-mode-icon is-custom" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
            </span>
            <span class="cmt-mode-text"><b>Custom</b><small>Your own skill and dates</small></span>
          </button>
        </div>

        <!-- Skill of the Week: pick it and go -->
        <template v-if="mode === 'sotw'">
          <div ref="sotwWrap" class="cmt-sotw-wrap">
          <div class="cmt-sotw">
            <button type="button" class="cmt-sotw-icon" :class="{ open: pickerOpen }" :aria-expanded="pickerOpen" aria-controls="cmt-skill-picker" :aria-label="`${form.skill}. Choose a different skill`" @click="pickerOpen = !pickerOpen">
              <img :src="skillIconSrc(form.skill)" alt="" width="44" height="44" />
              <span class="cmt-sotw-edit" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg></span>
            </button>
            <div class="cmt-sotw-text">
              <span class="cmt-sotw-label">{{ form.skill === featured ? `${weekWord} skill` : 'Your pick' }}</span>
              <b>{{ form.skill }}</b>
              <small>{{ form.skill === featured ? 'The same skill for everyone on TickGains, new every Monday.' : `Not ${weekWord.toLowerCase()} pick (${featured}), but it works the same.` }}</small>
            </div>
            <div class="cmt-sotw-actions">
              <button type="button" class="cmt-pill is-small" :class="{ on: pickerOpen }" :aria-expanded="pickerOpen" aria-controls="cmt-skill-picker" @click="pickerOpen = !pickerOpen">All skills</button>
              <button type="button" class="cmt-pill is-small" @click="shuffle">Shuffle</button>
              <button v-if="form.skill !== featured" type="button" class="cmt-pill is-small" @click="resetWeekSkill">{{ weekWord }}</button>
            </div>
          </div>
          <div v-if="pickerOpen" id="cmt-skill-picker" class="cmt-skillgrid" role="listbox" aria-label="Choose a skill">
            <button v-for="sk in GRID_SKILLS" :key="sk" type="button" class="cmt-skill" :class="{ on: sk === form.skill, featured: sk === featured }" role="option" :aria-selected="sk === form.skill" @click="pickSkill(sk)">
              <img :src="skillIconSrc(sk)" alt="" width="28" height="28" />
              <span>{{ sk }}</span>
              <i v-if="sk === featured" class="cmt-skill-star" aria-label="Skill of the week">★</i>
            </button>
          </div>
          </div>
          <div class="cmt-choice cmt-quick" role="radiogroup" aria-label="When it starts">
            <span class="cmt-quick-label">Starts</span>
            <button type="button" class="cmt-pill is-small" :class="{ on: sotwStart === 'now' }" role="radio" :aria-checked="sotwStart === 'now'" @click="setSotwStart('now')">Right now</button>
            <button type="button" class="cmt-pill is-small" :class="{ on: sotwStart === 'monday' }" role="radio" :aria-checked="sotwStart === 'monday'" @click="setSotwStart('monday')">Next Monday</button>
            <span class="cmt-quick-label">for one week</span>
          </div>
        </template>

        <!-- Custom: everything is up to you -->
        <template v-else>
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
        </template>

        <label class="cmt-field">
          <span>Title <small>{{ form.title.length }}/60</small></span>
          <input v-model="form.title" type="text" maxlength="60" autocomplete="off" data-1p-ignore @input="titleEdited = true" />
        </label>

        <template v-if="mode === 'custom'">
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
        </template>

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
import { LENGTHS, applyLength, applySotw, blankForm, buildCompetitionBody, defaultTitle, describeWindow, nextMonday, setStartNow, skillOfTheWeek, toDateInput } from '@/utils/competitionForm'
import { SKILL_GRID_ORDER, SKILL_NAMES, skillIconSrc } from '@/utils/osrsSkills'

const props = defineProps({ clan: { type: Object, required: true } })
const emit = defineEmits(['close', 'created'])

const SKILLS = SKILL_NAMES.filter((s) => s !== 'Overall')
// The picker lists them the way the in-game skills panel does.
const GRID_SKILLS = SKILL_GRID_ORDER.filter((x) => SKILLS.includes(x))
const pickerOpen = ref(false)
const sotwWrap = ref(null)
const weekSkill = skillOfTheWeek(SKILLS)
const nextWeekSkill = skillOfTheWeek(SKILLS, nextMonday(new Date()))
// It opens on the quick choice: this week's skill, a week long, starting now.
const mode = ref('sotw')
const sotwStart = ref('now')
// The featured skill for the week the competition would run in: this week's when it starts now, next week's from Monday.
const featured = computed(() => (sotwStart.value === 'monday' ? nextWeekSkill : weekSkill))
const weekWord = computed(() => (sotwStart.value === 'monday' ? "Next week's" : "This week's"))
const form = reactive(blankForm())
applySotw(form, weekSkill, 'now')
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
function setMode(m) {
  if (m === mode.value) return
  mode.value = m
  pickerOpen.value = false
  if (m === 'sotw') {
    titleEdited.value = false
    applySotw(form, SKILLS.includes(form.skill) ? form.skill : featured.value, sotwStart.value)
  } else {
    titleEdited.value = false
    syncTitle()
  }
}
const setSotwStart = (k) => {
  // Someone still on the featured skill follows it to the other week; a skill they shuffled to stays.
  const following = form.skill === featured.value
  sotwStart.value = k
  titleEdited.value = false
  applySotw(form, following ? featured.value : form.skill, k)
}
function pickSkill(name) {
  applySotw(form, name, sotwStart.value)
  titleEdited.value = false
  pickerOpen.value = false
}
// Another skill than this week's, picked at random (never the one already showing).
function shuffle() {
  const others = SKILLS.filter((x) => x !== form.skill)
  applySotw(form, others[Math.floor(Math.random() * others.length)], sotwStart.value)
  titleEdited.value = false
}
const resetWeekSkill = () => {
  applySotw(form, featured.value, sotwStart.value)
  titleEdited.value = false
}
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
    track('competition_create', { metric: form.metric, kind: mode.value, start: describeWindow(built.startsAt, built.endsAt).rightAway ? 'now' : 'later' })
    emit('created', competition)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}

// Escape closes the skill panel first, then the window; a click anywhere outside the panel closes it too.
const onKey = (e) => {
  if (e.key !== 'Escape') return
  if (pickerOpen.value) pickerOpen.value = false
  else emit('close')
}
const onDocClick = (e) => {
  if (pickerOpen.value && sotwWrap.value && !sotwWrap.value.contains(e.target)) pickerOpen.value = false
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.removeEventListener('click', onDocClick)
})
</script>
