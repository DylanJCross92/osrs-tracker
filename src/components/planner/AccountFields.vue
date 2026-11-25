<template>
  <div class="af" :class="{ 'is-compact': compact || tight, 'is-tight': tight }">
    <div class="pset-field">
      <span>Membership</span>
      <OptionChips :model-value="members" :options="MEMBERSHIP" label="Free-to-play or members" :hide-hint="tight" @update:model-value="(v) => $emit('update:members', v)" />
    </div>

    <div class="pset-field">
      <span>Account type</span>
      <OptionChips :model-value="accountType" :options="ACCOUNT" label="Main account, ironman or Hardcore Worlds" :hide-hint="tight" @update:model-value="setAccountType" />
      <template v-if="iron">
        <OptionChips class="af-sub" :model-value="ironKind" :options="IRON_OPTIONS" label="Kind of ironman" @update:model-value="(v) => $emit('update:ironKind', v)" />
      </template>
    </div>

    <div class="pset-field">
      <span>Build</span>
      <OptionChips :model-value="build" :options="BUILD_OPTIONS" label="Build" hide-hint @update:model-value="(v) => $emit('update:build', v)" />
      <p class="af-blurb">{{ current.blurb }}</p>
      <ul v-if="current.effects.length && !tight" class="af-effects">
        <li v-for="e in current.effects" :key="e">{{ e }}</li>
      </ul>
      <p v-if="suggestion" class="af-suggest" role="status">
        Your stats look like a <b>{{ suggestion.label.toLowerCase() }}</b>.
        <button class="btn-text" type="button" @click="$emit('update:build', suggestion.key)">Use that build</button>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import OptionChips from '@/components/OptionChips.vue'
import { BUILDS, IRON_KINDS, buildOf } from '@/data/builds'

// The kind of account a plan is for, in compact chips: members or free-to-play, main or ironman (and which kind), and the build. Used in the plan
// settings and on the new-plan setup, so both ask the same way. `detected` is the build the player's stats look like, offered as a one-press choice.
const props = defineProps({
  members: { type: Boolean, default: true },
  iron: { type: Boolean, default: false },
  // 'hardcore' for Hardcore Worlds (a main account that only has one life), else 'normal'. Never together with ironman.
  world: { type: String, default: 'normal' },
  ironKind: { type: String, default: 'standard' },
  build: { type: String, default: 'main' },
  detected: { type: String, default: null },
  // Smaller chips, for a panel (the planner's account option) rather than a whole page.
  compact: { type: Boolean, default: false },
  // Membership and account type side by side, no hints or effect lists: for a window that has other things to fit (the plan settings).
  tight: { type: Boolean, default: false },
})
const emit = defineEmits(['update:members', 'update:iron', 'update:ironKind', 'update:world', 'update:build'])

const MEMBERSHIP = [
  { value: true, label: 'Members', icon: '/icons/ui/members.png', hint: 'Every skill and training method.' },
  { value: false, label: 'Free-to-play', icon: '/icons/ui/free-to-play.png', hint: "Only free methods, from the wiki's free-to-play guides. Members-only skills and quests are locked." },
]
// Main account, ironman and Hardcore Worlds exclude each other (a Hardcore Worlds character is a main account), so it is one choice with three answers.
const ACCOUNT = [
  { value: 'main', label: 'Main account', icon: '/icons/ui/main-account.png', hint: 'You can buy and sell on the Grand Exchange.' },
  { value: 'iron', label: 'Ironman', icon: '/icons/ui/ironman.png', hint: 'You gather everything yourself: gp is left out and the cheapest routes lead.' },
  { value: 'hardcore', label: 'Hardcore Worlds', hint: 'One life. Methods that can kill you are left out, and gp is an estimate because Hardcore Worlds have their own economy.' },
]
const accountType = computed(() => (props.iron ? 'iron' : props.world === 'hardcore' ? 'hardcore' : 'main'))
function setAccountType(v) {
  emit('update:iron', v === 'iron')
  emit('update:world', v === 'hardcore' ? 'hardcore' : 'normal')
}
const IRON_OPTIONS = IRON_KINDS.map((k) => ({ value: k.key, label: k.label, hint: k.blurb }))
const BUILD_OPTIONS = BUILDS.map((b) => ({ value: b.key, label: b.label, hint: b.blurb }))
const current = computed(() => buildOf(props.build))
// Only offered while it is not the build already chosen.
const suggestion = computed(() => (props.detected && props.detected !== props.build ? buildOf(props.detected) : null))
</script>
