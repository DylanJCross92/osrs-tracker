<template>
  <div ref="rootEl" class="sp">
    <div class="sp-icons" role="group" aria-label="Plan actions">
      <span class="sp-name" :class="{ unsaved: !currentId }" :title="currentId ? 'This plan is saved' : 'Not saved yet'">{{ currentId ? currentName : 'Unsaved plan' }}</span>
      <button class="sp-icon" type="button" :disabled="!hasGoals" title="Save plan" aria-label="Save plan" @click="openSave(false)">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg>
      </button>
      <button class="sp-icon" type="button" :disabled="!hasGoals" title="Share plan" aria-label="Share plan" @click="onShare">
        <ShareIcon name="share" :size="19" />
      </button>
      <button class="sp-icon sp-toggle" :class="{ open }" type="button" :aria-expanded="open" title="Saved plans" aria-label="Saved plans" @click="open = !open">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
        <span class="sp-count">{{ plans.length }}</span>
      </button>
    </div>

    <SavePlanModal v-if="saving" :initial-name="currentName" :exists="!!currentId" :for-share="savingForShare" @close="saving = false" @confirm="onConfirm" />

    <div v-if="open" class="sp-panel">
      <p class="sp-note">
        <template v-if="loggedIn">Saved to your account, so they are on every device you log in on.</template>
        <template v-else>Stored in this browser. <RouterLink :to="{ name: 'login', query: { next: '/planner' } }">Log in</RouterLink> to keep them on every device.</template>
      </p>

      <ul v-if="plans.length" class="saved-list">
        <li
          v-for="p in plans"
          :key="p.id"
          :class="{ current: p.id === currentId, renaming: renaming === p.id }"
          :role="renaming === p.id ? null : 'button'"
          :tabindex="renaming === p.id ? null : 0"
          :aria-label="renaming === p.id ? null : `Load ${p.name}`"
          :title="renaming === p.id ? null : 'Click to load this plan'"
          @click="renaming === p.id || load(p)"
          @keydown.enter.self="renaming === p.id || load(p)"
        >
          <div class="saved-meta">
            <template v-if="renaming === p.id">
              <input v-model="renameText" type="text" maxlength="60" aria-label="New plan name" autofocus @keydown.enter="doRename(p)" @keydown.esc="renaming = null" />
              <button class="btn-text" type="button" @click.stop="doRename(p)">Save</button>
            </template>
            <template v-else>
              <b>{{ p.name }}<i v-if="shareFor(p.id)" class="sp-public" :title="`Public (${shareFor(p.id).mode === 'live' ? 'live progress' : 'static'})`">Public</i></b>
              <small>{{ p.goals.length }} skill{{ p.goals.length === 1 ? '' : 's' }}<template v-if="p.player.rsn"> · {{ p.player.rsn }}</template> · updated {{ new Date(p.updatedAt).toLocaleDateString() }}</small>
            </template>
          </div>
          <div class="saved-actions" @click.stop>
            <button class="saved-icon" type="button" title="Rename" aria-label="Rename" @click="startRename(p)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
            </button>
            <button class="saved-icon" :class="{ on: shareFor(p.id) }" type="button" :title="shareFor(p.id) ? 'Sharing: manage the public link' : 'Share'" :aria-label="shareFor(p.id) ? 'Manage sharing' : 'Share'" @click="$emit('share', p)">
              <ShareIcon name="share" :size="18" />
            </button>
            <button class="saved-icon" type="button" title="Duplicate" aria-label="Duplicate" @click="$emit('duplicate', p.id)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" /></svg>
            </button>
            <button class="saved-icon" type="button" title="Export" aria-label="Export" @click="$emit('export', p)">
              <ShareIcon name="download" :size="18" />
            </button>
            <button class="saved-icon saved-delete" type="button" title="Delete" aria-label="Delete" @click="$emit('delete', p.id)">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="planner-hint">No saved plans yet. Add a goal, name the plan above and press Save plan.</p>

      <details class="planner-all-methods">
        <summary>Import a plan</summary>
        <textarea v-model="importText" rows="5" placeholder="Paste exported plan JSON here" aria-label="Plan JSON" />
        <div class="saved-import-actions">
          <button class="btn btn-ghost" type="button" :disabled="!importText.trim()" @click="doImport">Import from text</button>
          <label class="btn btn-ghost saved-file">
            Choose a file
            <input type="file" accept="application/json,.json" @change="onFile" />
          </label>
        </div>
        <p v-if="importMessage" :class="importOk ? 'planner-hint' : 'planner-error'">{{ importMessage }}</p>
      </details>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useSharedPlans } from '@/composables/useSharedPlans'
import ShareIcon from '@/components/ShareIcon.vue'
import SavePlanModal from '@/components/planner/SavePlanModal.vue'

const props = defineProps({
  plans: { type: Array, required: true },
  currentId: { type: String, default: '' },
  currentName: { type: String, default: '' },
  hasGoals: { type: Boolean, default: false },
  importResult: { type: Object, default: null },
})
const emit = defineEmits(['save', 'save-new', 'load', 'duplicate', 'export', 'delete', 'rename', 'import', 'share', 'share-current'])

const { loggedIn } = useAuth()
const { shareFor } = useSharedPlans()
// Saving asks for a name in a small window; sharing a plan that was never saved asks first, then carries on to sharing.
const saving = ref(false)
const savingForShare = ref(false)
function openSave(forShare) {
  savingForShare.value = forShare
  saving.value = true
}
function onShare() {
  if (props.currentId) emit('share-current', props.currentName)
  else openSave(true)
}
function onConfirm({ name, asNew }) {
  saving.value = false
  if (savingForShare.value) return emit('share-current', name)
  emit(asNew ? 'save-new' : 'save', name)
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
onMounted(() => document.addEventListener('click', onDoc))
onBeforeUnmount(() => document.removeEventListener('click', onDoc))
const renaming = ref(null)
const renameText = ref('')
const importText = ref('')
const importMessage = ref('')
const importOk = ref(false)

function startRename(p) {
  renaming.value = p.id
  renameText.value = p.name
}
function doRename(p) {
  emit('rename', p.id, renameText.value)
  renaming.value = null
}
function doImport() {
  emit('import', importText.value)
}
function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => emit('import', String(reader.result || ''))
  reader.readAsText(file)
  e.target.value = ''
}
watch(
  () => props.importResult,
  (r) => {
    if (!r) return
    importOk.value = !r.error
    importMessage.value = r.error || `Imported "${r.plan.name}".${r.warnings?.length ? ' ' + r.warnings.join(' ') : ''}`
    if (!r.error) importText.value = ''
  },
)
</script>
