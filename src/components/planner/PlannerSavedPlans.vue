<template>
  <div ref="rootEl" class="sp">
    <form class="sp-bar" @submit.prevent="onSave">
      <input v-model="name" type="text" maxlength="60" placeholder="Name this plan to save it" aria-label="Plan name" data-1p-ignore />
      <button class="btn btn-primary" type="submit" :disabled="!hasGoals">{{ currentId ? 'Update' : 'Save plan' }}</button>
      <button v-if="currentId" class="btn btn-ghost" type="button" @click="onSaveNew">Save as new</button>
      <button class="btn btn-ghost sp-share" type="button" :disabled="!hasGoals" title="Get a public link to this plan" @click="$emit('share-current', name)">Share</button>
      <button class="btn btn-ghost sp-toggle" type="button" :aria-expanded="open" @click="open = !open">
        Saved plans<span class="sp-count">{{ plans.length }}</span><span class="sp-caret" aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
      </button>
    </form>

    <div v-if="open" class="sp-panel">
      <p class="sp-note">
        <template v-if="loggedIn">Saved to your account, so they are on every device you log in on.</template>
        <template v-else>Stored in this browser. <RouterLink :to="{ name: 'login', query: { next: '/planner' } }">Log in</RouterLink> to keep them on every device.</template>
      </p>

      <ul v-if="plans.length" class="saved-list">
        <li v-for="p in plans" :key="p.id" :class="{ current: p.id === currentId }">
          <div class="saved-meta">
            <template v-if="renaming === p.id">
              <input v-model="renameText" type="text" maxlength="60" aria-label="New plan name" @keydown.enter="doRename(p)" @keydown.esc="renaming = null" />
              <button class="btn-text" type="button" @click="doRename(p)">Save</button>
            </template>
            <template v-else>
              <b>{{ p.name }}<i v-if="shareFor(p.id)" class="sp-public" :title="`Public (${shareFor(p.id).mode === 'live' ? 'live progress' : 'static'})`">Public</i></b>
              <small>{{ p.goals.length }} skill{{ p.goals.length === 1 ? '' : 's' }}<template v-if="p.player.rsn"> · {{ p.player.rsn }}</template> · updated {{ new Date(p.updatedAt).toLocaleDateString() }}</small>
            </template>
          </div>
          <div class="saved-actions">
            <button class="btn-text" type="button" @click="load(p)">Load</button>
            <button class="btn-text" type="button" @click="startRename(p)">Rename</button>
            <button class="btn-text" type="button" @click="$emit('share', p)">{{ shareFor(p.id) ? 'Sharing' : 'Share' }}</button>
            <button class="btn-text" type="button" @click="$emit('duplicate', p.id)">Duplicate</button>
            <button class="btn-text" type="button" @click="$emit('export', p)">Export</button>
            <button class="btn-text saved-delete" type="button" @click="$emit('delete', p.id)">Delete</button>
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
const name = ref(props.currentName)
watch(() => props.currentName, (v) => (name.value = v))
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

const onSave = () => emit('save', name.value)
const onSaveNew = () => emit('save-new', name.value)
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
