<template>
  <Teleport to="body">
    <div class="modal-overlay gxm-overlay" @click.self="$emit('close')">
      <div ref="card" class="gxm-card" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <div class="gxm-bar">
          <GePriceBadge />
          <span class="gxm-spacer" />
          <RouterLink :to="{ name: 'item', params: { slug } }" class="gxm-full" @click="$emit('close')">
            Open full page
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </RouterLink>
          <button type="button" class="gxm-close" aria-label="Close" @click="$emit('close')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <ItemDetail :slug="slug" variant="modal" @loaded="(i) => (title = `${i.name} price`)" />
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import GePriceBadge from '@/components/GePriceBadge.vue'
import ItemDetail from '@/components/ItemDetail.vue'

defineProps({ slug: { type: String, required: true } })
const emit = defineEmits(['close'])

const card = ref(null)
const title = ref('Item price')
let opener = null

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(async () => {
  opener = document.activeElement
  document.addEventListener('keydown', onKey)
  // The page behind does not scroll while the popup is open.
  document.body.style.overflow = 'hidden'
  await nextTick()
  card.value?.focus()
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  if (opener && typeof opener.focus === 'function') opener.focus()
})
</script>
