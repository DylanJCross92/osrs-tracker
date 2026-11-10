<template>
  <span v-if="shown.length" class="roles" :aria-label="`Role: ${labels.join(', ')}`">
    <span v-for="r in shown" :key="r.key" class="role-badge" :class="`is-${r.key}`">{{ r.label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ roles: { type: Array, default: () => [] } })

const LABELS = { admin: 'Admin', owner: 'Owner' }
const ORDER = ['admin', 'owner']
// Only the special roles are shown. A plain user (everyone by default) gets no badge at all.
const shown = computed(() => ORDER.filter((k) => props.roles.includes(k)).map((k) => ({ key: k, label: LABELS[k] })))
const labels = computed(() => shown.value.map((r) => r.label))
</script>
