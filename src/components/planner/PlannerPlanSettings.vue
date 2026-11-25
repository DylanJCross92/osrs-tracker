<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="cancel">
      <div class="modal-card ps-settings" role="dialog" aria-modal="true" aria-labelledby="pset-h">
        <div class="share-modal-header">
          <h2 id="pset-h">Plan settings</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="cancel">✕</button>
        </div>

        <label class="pset-field">
          <span>Plan name</span>
          <input v-model="draftName" type="text" maxlength="60" autocomplete="off" data-1p-ignore data-lpignore="true" @keydown.enter.prevent="save" />
        </label>

        <div v-if="$slots.player" class="pset-field">
          <span>Player</span>
          <slot name="player" />
        </div>

        <div v-if="profile" class="pset-field">
          <span>Profile</span>
          <label class="pset-check">
            <input v-model="draftProfile" type="checkbox" />
            <span>
              <b>Show this plan on my profile</b>
              <small>{{ profileHint }}</small>
            </span>
          </label>
        </div>

        <!-- The kind of account: membership, main or ironman (and which kind) and the build -->
        <AccountFields tight :members="draftMembers" :iron="draftIron" :iron-kind="draftIronKind" :build="draftBuild" :detected="detectedBuild" @update:members="(v) => (draftMembers = v)" @update:iron="setIron" @update:iron-kind="(v) => (draftIronKind = v)" @update:build="(v) => (draftBuild = v)" />
        <p v-if="!draftMembers && noFreeRoute.length" class="pset-note" role="status">
          We have no free-to-play route for {{ noFreeRoute.join(', ') }}. {{ noFreeRoute.length === 1 ? 'It stays' : 'They stay' }} in the plan, worked out with members methods, so you may want to take {{ noFreeRoute.length === 1 ? 'it' : 'them' }} out.
        </p>
        <p v-if="droppedByBuild.length" class="pset-note" role="status">
          {{ droppedByBuild.join(', ') }} {{ droppedByBuild.length === 1 ? 'is' : 'are' }} locked for this account, so {{ droppedByBuild.length === 1 ? 'it comes' : 'they come' }} out of the plan when you save.
        </p>

        <div class="pset-field">
          <span>Strategy for every skill</span>
          <OptionChips v-model="draftStrategy" :options="strategyChoices" label="Training strategy" />
        </div>

        <div class="pset-field">
          <span>Hours played per day</span>
          <div class="pset-hours">
            <div class="pset-read"><b>{{ draftHours }}</b> hour{{ draftHours === 1 ? '' : 's' }} a day</div>
            <div class="pset-range">
              <button type="button" aria-label="Half an hour less" :disabled="draftHours <= minHours" @click="setHours(draftHours - 0.5)">−</button>
              <input type="range" min="0.5" max="12" step="0.5" :value="Math.min(draftHours, 12)" :style="{ '--fill': fill + '%' }" aria-label="Hours played per day" @input="setHours(Number($event.target.value))" />
              <button type="button" aria-label="Half an hour more" :disabled="draftHours >= maxHours" @click="setHours(draftHours + 0.5)">+</button>
            </div>
          </div>
        </div>

        <div class="save-plan-actions">
          <button class="btn btn-ghost" type="button" @click="cancel">Cancel</button>
          <button class="btn btn-primary" type="button" @click="save">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { skillsWithoutFreeRoute } from '@/utils/membership'
import OptionChips from '@/components/OptionChips.vue'
import AccountFields from '@/components/planner/AccountFields.vue'
import { isMembersSkill, lockedSkills } from '@/utils/builds'
import { ironStrategy } from '@/utils/ironman'

// The settings that belong to the whole plan, not one skill: its name, the strategy, how long you play, and who it is for.
// Name, strategy and hours are edited as a draft and only reach the plan when Save is pressed; closing the window throws them away.
const props = defineProps({
  name: { type: String, default: '' },
  strategy: { type: String, required: true },
  strategies: { type: Array, required: true },
  hoursPerDay: { type: Number, required: true },
  minHours: { type: Number, default: 0.5 },
  maxHours: { type: Number, default: 24 },
  // Free-to-play or members, and the skills in the plan (to say which ones a free player has no route for).
  members: { type: Boolean, default: true },
  iron: { type: Boolean, default: false },
  // What kind of ironman, and the build (see data/builds.js); `detected` is the build the player's stats look like.
  ironKind: { type: String, default: 'standard' },
  build: { type: String, default: 'main' },
  detected: { type: String, default: null },
  goalSkills: { type: Array, default: () => [] },
  // Only for a plan for a profile you own: { on, other, willSave, byDefault }. Shows the option to make this plan the goal on that profile.
  profile: { type: Object, default: null },
})
const emit = defineEmits(['save', 'close'])
const draftName = ref(props.name)
const draftStrategy = ref(props.strategy)
const draftHours = ref(props.hoursPerDay)
const draftMembers = ref(props.members)
const draftIron = ref(props.iron)
const draftIronKind = ref(props.ironKind)
const draftBuild = ref(props.build)
const detectedBuild = computed(() => props.detected)
// The skills in the plan that the chosen build never trains: they come out of the plan when the settings are saved.
const droppedByBuild = computed(() => props.goalSkills.filter((skill) => lockedSkills({ build: draftBuild.value, members: draftMembers.value }).includes(skill)))
const STRATEGY_LOOK = { 'auto-fast': { icon: '/icons/ui/fastest.png' }, 'auto-cheap': { icon: '/icons/ui/cheapest.png' }, 'auto-balanced': { svg: 'balance' } }
const strategyChoices = computed(() => props.strategies.map((s) => ({ value: s.value, label: s.label, hint: s.hint, ...(STRATEGY_LOOK[s.value] || {}) })))
// Choosing ironman also moves a strategy that assumes buying (fastest, profit) to cheapest, the way an ironman plays.
function setIron(on) {
  draftIron.value = on
  if (on) draftStrategy.value = ironStrategy(draftStrategy.value)
}
const noFreeRoute = computed(() => skillsWithoutFreeRoute(props.goalSkills.map((skill) => ({ skill }))).filter((skill) => !isMembersSkill(skill)))
const draftProfile = ref(!!props.profile?.on || !!props.profile?.byDefault)
const profileHint = computed(() => {
  if (props.profile?.other) return `This replaces "${props.profile.other}", the plan on your profile now.`
  if (!props.profile?.on && props.profile?.willSave) return 'Your profile\'s Goals tab and header show this plan\'s progress. Turning this on saves the plan first.'
  return 'Your profile\'s Goals tab and header show this plan\'s progress, and keep up as you change the plan. One plan at a time.'
})
function setHours(v) {
  if (!Number.isFinite(v)) return
  draftHours.value = Math.min(props.maxHours, Math.max(props.minHours, Math.round(v * 2) / 2))
}
// How far along the slider is (0.5 to 12 hours), to colour the track up to the handle.
const fill = computed(() => ((Math.min(Math.max(draftHours.value, 0.5), 12) - 0.5) / 11.5) * 100)
function save() {
  emit('save', { name: draftName.value.trim(), strategy: draftStrategy.value, hours: draftHours.value, profile: draftProfile.value, members: draftMembers.value, iron: draftIron.value, ironKind: draftIronKind.value, build: draftBuild.value })
}
function cancel() {
  emit('close')
}
const onKey = (e) => e.key === 'Escape' && cancel()
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
