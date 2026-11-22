<template>
  <Teleport to="body">
    <!-- No window: the celebration plays straight over the profile, on a light veil that fades the page back. Click anywhere to close. -->
    <div class="l99o" role="dialog" aria-modal="true" :aria-label="`${skillName} level 99`" @click.self="$emit('close')">
      <button class="l99o-close" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      <Level99Celebration :skill="skillName" :level="99" :run="run" free @click.self="$emit('close')" />
      <p class="l99o-who"><b>{{ name }}</b> reached level 99 {{ skillName }}.</p>
      <div class="l99o-actions">
        <button class="l99o-btn" type="button" @click="run++">Replay</button>
        <button v-if="canShare" class="l99o-btn" type="button" @click="$emit('share', skillName)">Share</button>
        <button ref="doneBtn" class="l99o-btn is-main" type="button" @click="$emit('close')">Nice</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Level99Celebration from '@/components/Level99Celebration.vue'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// The level 99 celebration over the profile: opened by a fresh 99, and by clicking the medal beside it to watch it again.
const props = defineProps({ skill: { type: String, required: true }, name: { type: String, default: '' }, canShare: { type: Boolean, default: true } })
const emit = defineEmits(['close', 'share'])
const run = ref(0)
const doneBtn = ref(null)
const skillName = computed(() => SKILL_NAMES.find((n) => n.toLowerCase() === String(props.skill).trim().toLowerCase()) || props.skill)
const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(async () => {
  document.addEventListener('keydown', onKey)
  await nextTick()
  doneBtn.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
