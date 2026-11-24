<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card gb-modal" role="dialog" aria-modal="true" aria-labelledby="gb-title">
        <div class="share-modal-header">
          <h2 id="gb-title">Back up or move your data</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        </div>
        <GuestBackup :start="start" @done="$emit('close')" />
        <p class="gb-account">Want it on every device without codes? <RouterLink :to="{ name: 'signup', query: { next: '/' } }" @click="$emit('close')">Create a free account</RouterLink> and it carries over.</p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import GuestBackup from '@/components/guest/GuestBackup.vue'

defineProps({ start: { type: String, default: 'save' } })
const emit = defineEmits(['close'])
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
