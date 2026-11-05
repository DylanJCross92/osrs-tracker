<template>
  <div v-if="confirmState.visible" class="confirm-overlay" @click.self="resolve(false)">
    <div class="confirm-box card" role="alertdialog" aria-modal="true">
      <p class="confirm-message">{{ confirmState.message }}</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost" @click="resolve(false)">Cancel</button>
        <button class="btn btn-danger confirm-danger" @click="resolve(true)">{{ confirmState.confirmLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useConfirm } from '@/composables/useConfirm'

const { confirmState, resolve } = useConfirm()

function onKeydown(e) {
  if (!confirmState.visible) return
  if (e.key === 'Escape') resolve(false)
  if (e.key === 'Enter') resolve(true)
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
