<template>
  <span class="sg-avatar" aria-hidden="true"><PlayerAvatar :name="player.username" /></span>
  <span class="sg-main">
    <span class="sg-name">{{ player.displayName }}<PlayerBadge :label="player.badge" /></span>
    <small class="sg-sub">Overall {{ player.overallLevel != null ? player.overallLevel.toLocaleString('en-US') : '-' }}<template v-if="player.overallXp != null"> · {{ formatXp(player.overallXp) }} XP</template></small>
  </span>
  <span v-if="player.weekGain > 0" class="sg-gain"><b>+{{ formatXp(player.weekGain) }}</b><small>this week</small></span>
</template>

<script setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'

defineProps({ player: { type: Object, required: true } })
</script>
