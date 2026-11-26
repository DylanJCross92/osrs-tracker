<template>
  <div class="ws" role="group" aria-label="Which character">
    <!-- A name with both characters gets the switch; one with only a Hardcore Worlds character gets the same pill, on its own. -->
    <div class="ws-tabs" :class="{ 'is-single': !switchable }">
      <button v-if="switchable" type="button" :class="{ on: world === 'main' }" :aria-pressed="world === 'main'" @click="$emit('update:world', 'main')">Main</button>
      <button type="button" class="on-hw" :class="{ on: world === 'hardcore' || !switchable }" :aria-pressed="world === 'hardcore' || !switchable" :data-tip="TIP" :aria-label="`Hardcore Worlds. ${TIP}`" @click="$emit('update:world', 'hardcore')">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c-4.4 0-8 3.2-8 7.5 0 2.4 1.1 4.2 2.7 5.4V19h10.6v-3.1c1.6-1.2 2.7-3 2.7-5.4C20 6.2 16.4 3 12 3z" /><circle cx="9" cy="11" r="1.3" /><circle cx="15" cy="11" r="1.3" /></svg>
        Hardcore Worlds
      </button>
    </div>
    <span v-if="(world === 'hardcore' || !switchable) && character" class="ws-facts">
      <b>Life {{ character.life }}</b>
      <template v-if="character.status === 'left'"> · left Hardcore Worlds</template>
      <template v-else-if="rank > 0"> · rank <b>#{{ rank.toLocaleString('en-US') }}</b></template>
    </span>
  </div>
</template>

<script setup>
// Main or Hardcore Worlds, for a name that has both: the switch beside the player's name on a profile, and (on the Hardcore side) which life they are on and
// their rank on the Hardcore Worlds hiscores.
defineProps({
  // False for a name that only has a Hardcore Worlds character: there is nothing to switch to, so it is just the one pill.
  switchable: { type: Boolean, default: true },
  world: { type: String, default: 'main' },
  character: { type: Object, default: null },
  rank: { type: Number, default: 0 },
})
defineEmits(['update:world'])
const TIP = 'Hardcore Worlds character. These stats are from the Hardcore Worlds hiscores, not the main hiscores, so ranks, XP and levels are separate from any main account.'
</script>
