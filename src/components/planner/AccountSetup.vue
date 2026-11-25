<template>
  <section class="as" aria-labelledby="as-h">
    <header class="as-head">
      <div class="as-title">
        <p class="as-kicker">Before you pick a plan</p>
        <h2 id="as-h">Set up your account</h2>
        <p class="as-sum">
          The plans below only train and recommend what {{ forWho }} can do. You can change this later from the account option beside the player at the top, or in your account settings.
        </p>
      </div>
      <button class="btn btn-primary as-done" type="button" @click="$emit('done')">Done</button>
    </header>

    <div class="as-body">
      <AccountFields
        :members="account.members"
        :iron="account.iron"
        :iron-kind="account.ironKind"
        :world="account.world"
        :build="account.build"
        :detected="detected"
        compact
        @update:members="(v) => $emit('change', { members: v })"
        @update:iron="(v) => $emit('change', { iron: v })"
        @update:iron-kind="(v) => $emit('change', { ironKind: v })"
        @update:world="(v) => $emit('change', { world: v })"
        @update:build="(v) => $emit('change', { build: v })"
      />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import AccountFields from '@/components/planner/AccountFields.vue'
import { detectBuild } from '@/utils/builds'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// The first thing on a new plan: what kind of account it is for (membership, main or ironman and which kind, and the build), so the plans below are only
// ever for that account. It shows the settings of the player loaded at the top (each of your profiles can have its own) and reports what is changed;
// the page keeps them. Open until Done is pressed, or a plan is started.
const props = defineProps({
  account: { type: Object, required: true },
  skills: { type: Object, default: null },
  playerLabel: { type: String, default: '' },
})
defineEmits(['change', 'done'])

const forWho = computed(() => (props.playerLabel ? `${props.playerLabel}'s account` : 'your account'))
// The build the loaded player's stats look like.
const detected = computed(() => {
  if (!props.skills) return null
  const levels = {}
  for (const name of SKILL_NAMES) if (Number.isFinite(props.skills[name]?.level)) levels[name] = props.skills[name].level
  return detectBuild(levels)
})
</script>
