<template>
  <section class="page" style="padding: 24px 16px; text-align: center">
    <Level99Celebration :skill="skill" :level="99" :run="run" />
    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 8px; flex-wrap: wrap">
      <select v-model="skill" class="select" @change="run++" aria-label="Skill">
        <option v-for="s in skills" :key="s" :value="s">{{ s }}</option>
      </select>
      <button class="btn btn-primary" type="button" @click="run++">Replay</button>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import Level99Celebration from '@/components/Level99Celebration.vue'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// Development only (see the router): a place to watch the level 99 celebration.
const skill = ref('Agility')
const run = ref(0)
const skills = SKILL_NAMES.filter((s) => s !== 'Overall')
</script>
