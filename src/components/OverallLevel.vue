<template>
  <span v-if="level != null && level !== 0" class="ovr"><img class="ovr-ic" :src="skillIconSrc('Overall')" alt="" width="16" height="16" />Overall {{ level.toLocaleString('en-US') }}</span>
  <span v-else>{{ empty }}</span>
</template>

<script setup>
import { skillIconSrc } from '@/utils/osrsSkills'

// A player's overall (total) level with the Overall icon: "[icon] Overall 2,278". With no level yet it shows `empty` instead.
defineProps({ level: { type: Number, default: null }, empty: { type: String, default: '-' } })
</script>
