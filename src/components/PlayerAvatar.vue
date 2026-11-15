<template>
  <img v-if="custom" class="pavatar pavatar-photo" :src="custom" alt="" draggable="false" />
  <svg v-else class="pavatar" viewBox="0 0 7 7" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" :style="{ background: `linear-gradient(145deg, ${art.palette.bg1}, ${art.palette.bg2})` }" aria-hidden="true" focusable="false">
    <rect v-for="c in art.cells" :key="`${c.x}-${c.y}`" :x="c.x" :y="c.y" width="1" height="1" :fill="art.palette.fg" :opacity="c.o" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { avatarFor } from '@/utils/avatar'
import { usePlayersStore } from '@/stores/players'
import { useAvatarsStore } from '@/stores/avatars'
import { profilePageApi } from '@/api/profilePage'

// Fills whatever frame it is placed in (the frame supplies the size, border and rounding). A profile whose owner
// uploaded a picture shows that instead of the generated one, for every visitor on every page.
const props = defineProps({ name: { type: String, default: '' } })
const store = usePlayersStore()
const avatars = useAvatarsStore()
avatars.ensureLoaded()
const art = computed(() => avatarFor(props.name))
const custom = computed(() => {
  const name = String(props.name)
  const key = name.toLowerCase()
  // The picture list covers everyone; the player list (when a page has it) is fresher right after an upload.
  const p = store.players.find((x) => x.username.toLowerCase() === key)
  const version = (p && p.avatarV) || avatars.versions[key]
  return version ? profilePageApi.avatarUrl(p?.username || name, version) : ''
})
</script>
