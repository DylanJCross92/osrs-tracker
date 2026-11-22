<template>
  <section class="page" style="padding: 24px 16px">
    <div class="card">
      <ProfileHighlights :snapshots="snapshots" :events="hl.events" :before="hl.before" @share99="(s) => (last = s)" />
      <p class="empty-hint">Preview only: a made-up account with every skill at 99 in 2017 to 2019 and 200M in each by 2026. Last Share clicked: {{ last || 'none' }}</p>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import ProfileHighlights from '@/components/profile/ProfileHighlights.vue'
import { skillHighlights } from '@/utils/historyHighlights'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// Development only (see the router): the History highlights for a maxed account, which no local profile is.
const last = ref('')
const t0 = Date.UTC(2016, 1, 1)
const t1 = Date.now()
const to99 = SKILL_NAMES.map((_, i) => Date.UTC(2017, 6, 1) + (i / SKILL_NAMES.length) * (Date.UTC(2019, 3, 1) - Date.UTC(2017, 6, 1)))
const to200 = SKILL_NAMES.map((_, i) => Date.UTC(2023, 9, 1) + (i / SKILL_NAMES.length) * (Date.UTC(2026, 9, 1) - Date.UTC(2023, 9, 1)))
const snapshots = Array.from({ length: 500 }, (_, k) => {
  const t = t0 + ((t1 - t0) * k) / 499
  const skills = {}
  let total = 0
  SKILL_NAMES.forEach((n, i) => {
    const xp = t < to99[i] ? 13_034_431 * Math.pow(Math.max(0, (t - t0) / (to99[i] - t0)), 1.6) : t < to200[i] ? 13_034_431 + (t - to99[i]) * 0.00001 : 13_034_431 + (200_000_000 - 13_034_431) * Math.min(1, (t - to200[i]) / (90 * 86_400_000))
    skills[n] = { xp: Math.round(xp), level: 99 }
    total += xp
  })
  return { capturedAt: new Date(t).toISOString(), overallXp: Math.round(total), skills }
})
const hl = skillHighlights(snapshots)
</script>
