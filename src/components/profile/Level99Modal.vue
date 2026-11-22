<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-card l99m" role="dialog" aria-modal="true" :aria-label="`${skillName} level 99`">
        <button class="l99m-close" type="button" aria-label="Close" @click="$emit('close')">✕</button>
        <Level99Celebration :skill="skillName" :level="99" :run="run" />
        <p class="l99m-who"><b>{{ name }}</b> reached level 99 {{ skillName }}.</p>
        <div class="save-plan-actions l99m-actions">
          <button class="btn btn-ghost" type="button" @click="run++">Replay</button>
          <button v-if="canShare" class="btn btn-ghost" type="button" @click="$emit('share', skillName)">Share</button>
          <button ref="doneBtn" class="btn btn-primary" type="button" @click="$emit('close')">Nice</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Level99Celebration from '@/components/Level99Celebration.vue'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// The level 99 celebration in a window: opened by a fresh 99 on the profile, and by clicking the medal beside it to watch it again.
const props = defineProps({ skill: { type: String, required: true }, name: { type: String, default: '' }, canShare: { type: Boolean, default: true } })
const emit = defineEmits(['close', 'share'])
const run = ref(0)
const skillName = computed(() => SKILL_NAMES.find((n) => n.toLowerCase() === String(props.skill).trim().toLowerCase()) || props.skill)
const doneBtn = ref(null)
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  await nextTick()
  doneBtn.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
