<template>
  <div class="gb">
    <div class="trk-ttabs" role="tablist" aria-label="Save code">
      <button type="button" role="tab" :aria-selected="tab === 'save'" :class="{ active: tab === 'save' }" @click="tab = 'save'">Save a code</button>
      <button type="button" role="tab" :aria-selected="tab === 'restore'" :class="{ active: tab === 'restore' }" @click="tab = 'restore'">Restore from a code</button>
    </div>

    <section v-if="tab === 'save'" class="gb-pane">
      <p class="gb-lead">One piece of text that holds what you keep in this browser. Open it on another device, or keep it as a backup. No account, nothing is sent to TickGains.</p>
      <template v-if="rows.length">
        <ul class="gb-has">
          <li v-for="r in rows" :key="r.name"><template v-if="r.count != null"><b>{{ r.count }}</b>&nbsp;</template>{{ r.label }}</li>
        </ul>
        <label class="gb-field">
          <span>Your save code</span>
          <textarea ref="codeBox" readonly rows="4" :value="code || 'Working it out…'" @focus="$event.target.select()" />
        </label>
        <div class="gb-actions">
          <button class="btn btn-primary" type="button" :disabled="!code" @click="copy(code, 'Code copied.')">Copy code</button>
          <button class="btn" type="button" :disabled="!link" @click="copy(link, 'Link copied. Open it on the other device.')">Copy link</button>
          <small v-if="link && link.length > 1800">The link is long. If a messaging app cuts it off, copy the code instead.</small>
        </div>
        <p class="gb-note">Anyone with the code can read what is in it, so keep it to yourself. Restoring adds it to the other device and never removes anything there.</p>
      </template>
      <p v-else class="gb-empty">There is nothing saved in this browser yet. Make a plan, tick some quests or follow a player, then come back.</p>
    </section>

    <section v-else class="gb-pane">
      <p class="gb-lead">Paste a save code (or a restore link) from another device to add what it holds to this browser. Nothing here is removed.</p>
      <label class="gb-field">
        <span>Save code or link</span>
        <textarea v-model="pasted" rows="4" placeholder="TG1.…" spellcheck="false" autocomplete="off" autocapitalize="off" @input="check" />
      </label>
      <p v-if="pasted.trim() && checked && !found" class="gb-error">That does not look like a TickGains save code. Check that you copied all of it.</p>
      <div v-if="found" class="gb-found">
        <p><b>This code holds</b></p>
        <ul class="gb-has">
          <li v-for="r in foundRows" :key="r.name"><template v-if="r.count != null"><b>{{ r.count }}</b>&nbsp;</template>{{ r.label }}</li>
        </ul>
        <p v-if="found.at" class="gb-note">Saved {{ when }}.</p>
        <button class="btn btn-primary" type="button" @click="restore">Add this to my browser</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { applyBackup, collectBackup, decodeBackup, describeBackup, encodeBackup } from '@/utils/guestBackup'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'

// Save a code from this browser, or restore one made on another device. initial: a code to look at straight away (from a restore link).
const props = defineProps({ start: { type: String, default: 'save' }, initial: { type: String, default: '' } })
const emit = defineEmits(['done'])
const { showToast } = useToast()

const tab = ref(props.start)
const backup = collectBackup()
const rows = describeBackup(backup)
const code = ref('')
const link = computed(() => (code.value ? `${window.location.origin}/restore#${code.value}` : ''))
onMounted(async () => {
  if (rows.length) code.value = await encodeBackup(backup)
  if (props.initial) {
    pasted.value = props.initial
    check()
  }
})

async function copy(text, message) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(message)
    track('guest_backup_copy')
  } catch {
    showToast('Could not copy. Select the code and copy it yourself.')
  }
}

const pasted = ref('')
const found = ref(null)
const checked = ref(false)
const foundRows = computed(() => (found.value ? describeBackup(found.value) : []))
const when = computed(() => {
  const d = new Date(found.value?.at)
  return Number.isNaN(d.getTime()) ? 'at an unknown time' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
})
let stamp = 0
async function check() {
  const id = ++stamp
  const result = pasted.value.trim() ? await decodeBackup(pasted.value) : null
  if (id !== stamp) return
  found.value = result
  checked.value = true
}
function restore() {
  if (!found.value) return
  const added = applyBackup(found.value)
  track('guest_backup_restore', { pieces: added.length })
  showToast('Restored. Reloading with your data…')
  emit('done')
  // Everything reads its storage when it starts, so a reload is the simplest way for all of it to pick the new data up.
  setTimeout(() => window.location.assign('/'), 700)
}
</script>
