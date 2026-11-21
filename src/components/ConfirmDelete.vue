<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="$emit('cancel')">
      <div class="modal-card save-plan" role="alertdialog" aria-modal="true" :aria-labelledby="`${uid}-h`" :aria-describedby="`${uid}-d`">
        <div class="share-modal-header">
          <h2 :id="`${uid}-h`">{{ title }}</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="$emit('cancel')">✕</button>
        </div>
        <p :id="`${uid}-d`" class="save-plan-note"><template v-if="name"><b class="po-del-name">{{ name }}</b>{{ ' ' }}</template>{{ text }}</p>
        <div class="save-plan-actions po-del-actions">
          <button ref="cancelBtn" class="btn btn-ghost" type="button" @click="$emit('cancel')">{{ cancelLabel }}</button>
          <button class="btn po-delete" type="button" @click="$emit('confirm')">{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// The site's delete confirmation window (the same one the planner uses for a saved plan): a title, what is being deleted in bold and what
// will happen, a safe "keep" button that has focus, and a red delete button. Escape and a click outside close it.
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  name: { type: String, default: '' },
  text: { type: String, default: 'This cannot be undone.' },
  cancelLabel: { type: String, default: 'Keep it' },
  confirmLabel: { type: String, default: 'Delete' },
})
const emit = defineEmits(['confirm', 'cancel'])
const uid = `cd-${Math.random().toString(36).slice(2, 8)}`
const cancelBtn = ref(null)

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    await nextTick()
    cancelBtn.value?.focus()
  },
)
const onKey = (e) => {
  if (e.key === 'Escape' && props.open) emit('cancel')
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
