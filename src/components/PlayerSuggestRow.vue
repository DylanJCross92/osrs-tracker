<template>
  <span class="sg-avatar" aria-hidden="true"><PlayerAvatar :name="player.username" /></span>
  <span class="sg-main">
    <span class="sg-name is-rich"><span class="sg-name-text">{{ player.displayName }}</span><PlayerBadge :label="player.badge" :claimed="player.claimed" /><HardcoreTag v-if="player.mode === 'hardcore'" short /><span v-else-if="player.hasBoth" class="sg-main-tag" title="The main hiscores character">Main</span></span>
    <small class="sg-sub"><OverallLevel :level="player.overallLevel" /><template v-if="player.overallXp != null"> · {{ formatXp(player.overallXp) }} XP</template></small>
  </span>
  <span v-if="player.weekGain > 0" class="sg-gain"><b>+{{ formatXp(player.weekGain) }}</b><small>this week</small></span>
</template>

<script setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import OverallLevel from '@/components/OverallLevel.vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import HardcoreTag from '@/components/HardcoreTag.vue'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'

defineProps({ player: { type: Object, required: true } })
</script>
