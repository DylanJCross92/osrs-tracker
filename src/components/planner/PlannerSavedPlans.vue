<template>
  <div ref="rootEl" class="sp">
    <div class="sp-bar" role="group" aria-label="Plan actions">
      <div class="sp-menu">
        <button class="sp-switch" :class="{ open }" type="button" aria-haspopup="true" :aria-expanded="open" title="Your saved plans" @click="open = !open">
          <svg class="sp-switch-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
          <span class="sp-name" :class="{ unsaved: !currentId }">{{ currentId ? currentName : 'Unsaved plan' }}</span>
          <i v-if="dirty" class="sp-dirty" title="You have changes that are not saved yet. Press Update plan to save them." aria-label="Unsaved changes" />
          <span class="sp-count" aria-label="saved plans">{{ visiblePlans.length }}</span>
          <svg class="sp-caret" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <div v-if="open" class="sp-panel" role="region" aria-label="Saved plans">
          <div class="sp-panel-head">
          <b>{{ playerName ? `Plans for ${playerLabel}` : 'Saved plans' }} <span>{{ visiblePlans.length }}</span></b>
          <button class="sp-new" type="button" :disabled="!hasGoals" :title="canSave ? '' : saveBlockedReason" @click="canSave ? openSaveAsNew() : $emit('blocked')">{{ canSave ? '+ Save as new' : 'Can\'t save' }}</button>
        </div>
          <p v-if="!canSave" class="sp-note sp-note-warn">{{ saveBlockedReason }}</p>
          <p class="sp-note">
            <template v-if="loggedIn">Saved to your account, so they are on every device you log in on.</template>
            <template v-else>Stored in this browser. <RouterLink :to="{ name: 'login', query: { next: '/planner' } }">Log in</RouterLink> to keep them on every device.</template>
          </p>

          <ul v-if="visiblePlans.length" class="saved-list">
            <li
              v-for="p in visiblePlans"
              :key="p.id"
              :class="{ current: p.id === currentId, renaming: renaming === p.id }"
              :role="renaming === p.id ? null : 'button'"
              :tabindex="renaming === p.id ? null : 0"
              :aria-label="renaming === p.id ? null : `Load ${p.name}`"
              :title="renaming === p.id ? null : 'Click to load this plan'"
              @click="renaming === p.id || load(p)"
              @keydown.enter.self="renaming === p.id || load(p)"
            >
              <form v-if="renaming === p.id" class="saved-rename" @submit.prevent="doRename(p)" @click.stop>
                <input v-model="renameText" type="text" maxlength="60" aria-label="New plan name" @keydown.esc="renaming = null" />
                <button class="saved-icon on" type="submit" title="Save name" aria-label="Save name">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </button>
                <button class="saved-icon" type="button" title="Cancel" aria-label="Cancel rename" @click="renaming = null">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </form>
              <div v-else class="saved-meta">
                <b>{{ p.name }}<i v-if="shareFor(p.id)" class="sp-public" :title="`Public (${shareFor(p.id).mode === 'live' ? 'live progress' : 'static'})`">Public</i></b>
                <small>{{ p.goals.length }} skill{{ p.goals.length === 1 ? '' : 's' }}<template v-if="p.player.rsn"> · {{ p.player.rsn }}</template> · {{ new Date(p.updatedAt).toLocaleDateString() }}</small>
              </div>
              <div v-if="renaming !== p.id" class="saved-actions" @click.stop>
                <button class="saved-icon" type="button" title="Rename" aria-label="Rename" @click="startRename(p)">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
                </button>
                <button class="saved-icon" :class="{ on: shareFor(p.id) }" type="button" :title="shareFor(p.id) ? 'Sharing: manage the public link' : 'Share'" :aria-label="shareFor(p.id) ? 'Manage sharing' : 'Share'" @click="shareRow(p)">
                  <ShareIcon name="share" :size="18" />
                </button>
                <button class="saved-icon" type="button" title="Duplicate" aria-label="Duplicate" @click="$emit('duplicate', p.id)">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
                </button>
                <button class="saved-icon saved-delete" type="button" title="Delete" aria-label="Delete" @click="$emit('delete', p.id)">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
                </button>
              </div>
            </li>
          </ul>
          <p v-else class="planner-hint">{{ plans.length ? `No saved plans for ${playerLabel} yet.` : 'No saved plans yet. Add a goal and press Save plan.' }}</p>
          <button v-if="hiddenCount || showAll" class="sp-others" type="button" @click="showAll = !showAll">
            {{ showAll ? `Only show plans for ${playerLabel}` : `${hiddenCount} plan${hiddenCount === 1 ? '' : 's'} for other players. Show` }}
          </button>
        </div>
      </div>
      <button v-if="saveState !== 'clean'" class="sp-save" :class="`is-${saveState}`" type="button" :disabled="!hasGoals || saveState === 'clean'" :aria-disabled="saveState === 'blocked'" :title="saveTitle" @click="onSaveClick">
        <svg v-if="saveState === 'blocked'" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
        <svg v-else-if="saveState === 'clean'" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        <svg v-else-if="saveState === 'dirty'" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" /></svg>
        <svg v-else viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg>
        <span>{{ saveLabel }}</span>
      </button>
      <button v-if="dirty && currentId" class="sp-revert" :class="{ confirm: confirmRevert }" type="button" :title="confirmRevert ? 'Press again to discard your changes' : 'Go back to the last saved version'" @click="onRevert" @blur="confirmRevert = false">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" /><path d="M3 3v5h5" /></svg>
        <span>{{ confirmRevert ? 'Discard changes?' : 'Revert' }}</span>
      </button>
      <button class="sp-icon" type="button" :disabled="!hasGoals" title="Copy plan link" aria-label="Copy plan link" @click="$emit('copy-link')">
        <ShareIcon name="link" :size="19" />
      </button>
      <button class="sp-icon" type="button" :disabled="!hasGoals" title="Share plan" aria-label="Share plan" @click="onShare">
        <ShareIcon name="share" :size="19" />
      </button>
    </div>

    <SavePlanModal v-if="saving" :initial-name="modalName" :exists="false" :for-share="savingForShare" :as-new="savingAsNew" :no-save="!canSave" @close="saving = false" @confirm="onConfirm" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useSharedPlans } from '@/composables/useSharedPlans'
import ShareIcon from '@/components/ShareIcon.vue'
import SavePlanModal from '@/components/planner/SavePlanModal.vue'

const props = defineProps({
  plans: { type: Array, required: true },
  // The player the planner is showing. Saved plans belong to the player they were made for, so only theirs are listed.
  playerName: { type: String, default: '' },
  playerLabel: { type: String, default: '' },
  currentId: { type: String, default: '' },
  currentName: { type: String, default: '' },
  hasGoals: { type: Boolean, default: false },
  // The plan on screen has changes its saved copy does not have yet.
  dirty: { type: Boolean, default: false },
  // Plans can only be saved for the player's own profile (or for no player at all).
  canSave: { type: Boolean, default: true },
  saveBlockedReason: { type: String, default: '' },
})
const emit = defineEmits(['save', 'save-new', 'load', 'duplicate', 'delete', 'rename', 'share', 'share-current', 'blocked', 'revert', 'copy-link'])

const { loggedIn } = useAuth()
const { shareFor } = useSharedPlans()
// Saving asks for a name in a small window; sharing a plan that was never saved asks first, then carries on to sharing.
const saving = ref(false)
const savingForShare = ref(false)
function shareRow(p) {
  open.value = false
  emit('share', p)
}
// A plan belongs to the profile it was made for. With a player loaded, only that player's plans are listed (plans not made for
// anyone in particular are always listed), so plans for your own profile never turn up while you look at someone else's.
const norm = (n) => String(n || '').toLowerCase().replace(/[\s_-]+/g, '')
const showAll = ref(false)
watch(() => props.playerName, () => (showAll.value = false))
const belongsHere = (p) => !props.playerName || !p.player?.rsn || norm(p.player.rsn) === norm(props.playerName)
const visiblePlans = computed(() => (showAll.value ? props.plans : props.plans.filter(belongsHere)))
const hiddenCount = computed(() => props.plans.length - props.plans.filter(belongsHere).length)

const savingAsNew = ref(false)
const modalName = ref('')
function openSave(forShare, asNew = false) {
  open.value = false
  savingForShare.value = forShare
  savingAsNew.value = asNew
  modalName.value = asNew && props.currentId ? `${props.currentName} (copy)`.slice(0, 60) : props.currentName
  saving.value = true
}
const openSaveAsNew = () => openSave(false, true)

// One button that says what pressing it will do: save a new plan, update the saved one, or (nothing to do) show it is saved.
const saveState = computed(() => {
  const base = !props.currentId ? 'new' : props.dirty ? 'dirty' : 'clean'
  return !props.canSave && base !== 'clean' ? 'blocked' : base
})
const saveLabel = computed(() => ({ new: 'Save plan', dirty: 'Update plan', clean: 'Saved', blocked: 'Not saved' })[saveState.value])
const saveTitle = computed(
  () =>
    ({
      new: 'Name this plan and save it',
      dirty: 'You changed this plan. Update the saved copy to keep the changes.',
      clean: 'This plan is saved and up to date',
      blocked: props.saveBlockedReason,
    })[saveState.value],
)
// Reverting throws changes away, so it asks once: the first press changes the label, the second does it.
const confirmRevert = ref(false)
let revertTimer = null
function onRevert() {
  if (!confirmRevert.value) {
    confirmRevert.value = true
    clearTimeout(revertTimer)
    revertTimer = setTimeout(() => (confirmRevert.value = false), 4000)
    return
  }
  clearTimeout(revertTimer)
  confirmRevert.value = false
  emit('revert')
}
function onSaveClick() {
  if (saveState.value === 'blocked') return emit('blocked')
  if (saveState.value === 'new') openSave(false)
  else if (saveState.value === 'dirty') emit('save', props.currentName)
}
function onShare() {
  open.value = false
  if (props.currentId) emit('share-current', props.currentName)
  else openSave(true)
}
function onConfirm({ name, asNew }) {
  saving.value = false
  if (savingForShare.value) return emit('share-current', name)
  emit(savingAsNew.value ? 'save-new' : 'save', name)
}
const open = ref(false)
const rootEl = ref(null)
// Loading a plan closes the list so the plan is right there.
function load(p) {
  emit('load', p)
  open.value = false
}
const onDoc = (e) => {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) open.value = false
}
const onKey = (e) => e.key === 'Escape' && open.value && (open.value = false)
onMounted(() => {
  document.addEventListener('click', onDoc)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDoc)
  document.removeEventListener('keydown', onKey)
})
const renaming = ref(null)
const renameText = ref('')

function startRename(p) {
  renaming.value = p.id
  renameText.value = p.name
  nextTick(() => document.querySelector('.saved-rename input')?.select())
}
function doRename(p) {
  emit('rename', p.id, renameText.value)
  renaming.value = null
}
</script>
