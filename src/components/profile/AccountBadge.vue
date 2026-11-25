<template>
  <p v-if="chips.length" class="pp-account" aria-label="Account type">
    <span v-for="c in chips" :key="c.key" class="pp-acct-chip" :class="`is-${c.key}`" :title="c.hint">
      <img v-if="c.icon" :src="c.icon" alt="" width="16" height="16" />
      {{ c.label }}
    </span>
  </p>
</template>

<script setup>
import { computed } from 'vue'
import { buildOf, ironKindOf } from '@/data/builds'

// What kind of account a profile says it is, beside the name: a build (level 3 skiller, pure, zerker) and, for an ironman, which kind. The owner sets
// both on the account page. Nothing shows for a plain account.
const props = defineProps({
  build: { type: String, default: 'main' },
  ironKind: { type: String, default: null },
})
const chips = computed(() => {
  const out = []
  if (props.ironKind) {
    const k = ironKindOf(props.ironKind)
    out.push({ key: 'iron', label: k.label, hint: k.blurb, icon: '/icons/ui/ironman.png' })
  }
  if (props.build && props.build !== 'main') {
    const b = buildOf(props.build)
    out.push({ key: 'build', label: b.short, hint: b.blurb })
  }
  return out
})
</script>
