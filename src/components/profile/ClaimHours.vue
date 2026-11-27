<template>
  <div class="claim-hours">
    <p class="claim-hours-line">
      <i class="claim-hours-dot" :class="{ on: now }" aria-hidden="true" />
      <span>{{ contact }} is usually online <b>{{ text }}</b>.</span>
    </p>
    <p v-if="yours" class="claim-hours-sub">That is {{ yours }} where you are.</p>
    <p class="claim-hours-sub">{{ now ? 'Inside those hours now, so a code is usually checked quickly.' : 'Outside those hours right now. Send your code any time and it is checked when they are back.' }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { hoursOnYourClock, hoursText, withinClaimHours } from '@/utils/claimHours'

defineProps({ contact: { type: String, default: 'The owner' } })
const text = hoursText()
const yours = computed(() => hoursOnYourClock())
const now = computed(() => withinClaimHours())
</script>
