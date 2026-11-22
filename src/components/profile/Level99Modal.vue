<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card l99m" role="dialog" aria-modal="true" :aria-label="`${skill} level 99`">
        <button class="l99m-close" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        <Level99Celebration :skill="skill" :level="99" :run="run" />
        <p class="l99m-who"><b>{{ name }}</b> reached level 99 {{ skill }}.</p>
        <div class="save-plan-actions l99m-actions">
          <button class="btn btn-ghost" type="button" @click="run++">Replay</button>
          <button v-if="canShare" class="btn btn-ghost" type="button" @click="$emit('share', skill)">Share</button>
          <button ref="doneBtn" class="btn btn-primary" type="button" @click="$emit('close')">Nice</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Level99Celebration from '@/components/Level99Celebration.vue'

// The level 99 celebration in a window: opened by a fresh 99 on the profile, and by clicking the medal beside it to watch it again.
defineProps({ skill: { type: String, required: true }, name: { type: String, default: '' }, canShare: { type: Boolean, default: true } })
const emit = defineEmits(['close', 'share'])
const run = ref(0)
const doneBtn = ref(null)
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  await nextTick()
  doneBtn.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
