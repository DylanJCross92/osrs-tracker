<template>
  <div ref="root" class="am">
    <button class="am-btn" type="button" title="What your plans are for: membership, account type and build" :aria-expanded="open" aria-haspopup="dialog" @click="open = !open">
      <span class="am-label">{{ summary }}</span>
      <svg class="am-caret" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
    </button>
    <div v-if="open" class="am-pop" role="dialog" :aria-label="`Account settings${playerLabel ? ` for ${playerLabel}` : ''}`" @keydown.esc="open = false">
      <p class="am-title">{{ playerLabel ? `${playerLabel}'s account` : 'Your account' }}</p>
      <AccountFields
        :members="account.members"
        :iron="account.iron"
        :iron-kind="account.ironKind"
        :build="account.build"
        :detected="detected"
        compact
        @update:members="(v) => $emit('change', { members: v })"
        @update:iron="(v) => $emit('change', { iron: v })"
        @update:iron-kind="(v) => $emit('change', { ironKind: v })"
        @update:build="(v) => $emit('change', { build: v })"
      />
      <div class="am-foot"><button class="btn btn-primary" type="button" @click="open = false">Done</button></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AccountFields from '@/components/planner/AccountFields.vue'
import { IRON_KINDS } from '@/data/builds'
import { accountLabel } from '@/utils/builds'

// The account settings as one small option beside the player at the top of the planner: shows what the plans are for ("Members · Level 3 skiller") and
// opens the same choices as the start page's setup. The settings are the loaded player's own.
const props = defineProps({
  account: { type: Object, required: true },
  detected: { type: String, default: null },
  playerLabel: { type: String, default: '' },
})
defineEmits(['change'])

const open = ref(false)
const root = ref(null)
const kindNames = Object.fromEntries(IRON_KINDS.map((k) => [k.key, k.label]))
const summary = computed(() => accountLabel(props.account, kindNames))

const onOutside = (e) => {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', onOutside, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))
</script>
