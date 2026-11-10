<template>
  <div class="modal-overlay qp-overlay" @click.self="$emit('close')">
    <div class="modal-card qp-modal" role="dialog" aria-modal="true" :aria-label="`${skill} quick planner`">
      <div class="qp-modal-head">
        <img :src="skillIconSrc(skill)" :alt="skill" width="28" height="28" />
        <h2>{{ skill }} quick planner</h2>
        <span class="qp-modal-level">Level {{ level }}</span>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>
      <QuickSkillPlanner :skill="skill" :xp="xp" :username="username" :hide-title="true" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import QuickSkillPlanner from '@/components/profile/QuickSkillPlanner.vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { levelAtXp } from '@/utils/planner'
import { track } from '@/utils/analytics'

const props = defineProps({
  skill: { type: String, required: true },
  xp: { type: Number, required: true },
  username: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const level = computed(() => levelAtXp(props.xp, true))

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => {
  document.addEventListener('keydown', onKey)
  track('quick_planner_modal_open', { skill: props.skill })
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
