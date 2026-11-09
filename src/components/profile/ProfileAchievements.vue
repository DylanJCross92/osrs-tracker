<template>
  <div class="card ach">
    <div class="ach-summary">
      <div>
        <h2>Achievements</h2>
        <p class="ach-count"><b>{{ doneCount }}</b> of {{ achievements.length }} complete</p>
      </div>
      <div class="ach-overall">
        <div class="level-progress-track"><div class="level-progress-fill" :style="{ width: `${overallPct}%` }" /></div>
        <span>{{ overallPct }}%</span>
      </div>
    </div>

    <p v-if="!profile" class="empty-hint">Loading achievements…</p>
    <template v-else>
      <!-- Overall level / total XP milestone tracks -->
      <section v-for="row in totalRows" :key="row.title" class="ach-section">
        <h3>{{ row.title }}</h3>
        <div class="ach-milestones">
          <div v-for="a in row.items" :key="a.key" class="ach-tile" :class="{ done: a.completed }" :title="tip(a)">
            <span class="ach-tile-label">{{ a.label }}</span>
            <span v-if="a.completed" class="ach-check">✓</span>
            <template v-else>
              <div class="level-progress-track"><div class="level-progress-fill" :style="{ width: `${a.progress * 100}%` }" /></div>
              <span class="ach-pct">{{ pct(a) }}%</span>
            </template>
          </div>
        </div>
      </section>

      <!-- Skill matrix: one row per skill, level tiers then XP tiers -->
      <section class="ach-section">
        <div class="ach-section-head">
          <h3>Skills</h3>
          <div class="range-tabs">
            <button :class="{ active: !onlyRemaining }" @click="onlyRemaining = false">All</button>
            <button :class="{ active: onlyRemaining }" @click="onlyRemaining = true">In progress</button>
          </div>
        </div>
        <div class="ach-scroll">
          <table class="ach-table">
            <thead>
              <tr>
                <th class="ach-skill-col">Skill</th>
                <th :colspan="levelTiers.length" class="ach-group-head">Level</th>
                <th :colspan="xpTiers.length" class="ach-group-head ach-group-start">Experience</th>
              </tr>
              <tr>
                <th />
                <th v-for="(v, i) in levelTiers" :key="`lh${v}`">{{ v }}</th>
                <th v-for="(v, i) in xpTiers" :key="`xh${v}`" :class="{ 'ach-group-start': i === 0 }">{{ xpLabel(v) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in skillRows" :key="s.skill">
                <td class="ach-skill-col">
                  <img :src="skillIconSrc(s.skill)" :alt="s.skill" width="22" height="22" />
                  <span>{{ s.skill }}</span>
                </td>
                <td v-for="a in s.levels" :key="a.key">
                  <span class="ach-cell" :class="{ done: a.completed }" :title="tip(a)">
                    <template v-if="a.completed">✓</template>
                    <template v-else>{{ pct(a) }}%</template>
                  </span>
                </td>
                <td v-for="(a, i) in s.xp" :key="a.key" :class="{ 'ach-group-start': i === 0 }">
                  <span class="ach-cell" :class="{ done: a.completed }" :title="tip(a)">
                    <template v-if="a.completed">✓</template>
                    <template v-else>{{ pct(a) }}%</template>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
    <p class="profile-note">Calculated automatically from saved hiscores snapshots. Hover a tile for details.</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { skillIconSrc, SKILL_NAMES } from '@/utils/osrsSkills'

const props = defineProps({ profile: { type: Object, default: null } })
const achievements = computed(() => props.profile?.achievements || [])
const onlyRemaining = ref(false)

const doneCount = computed(() => achievements.value.filter((a) => a.completed).length)
const overallPct = computed(() => (achievements.value.length ? Math.round((doneCount.value / achievements.value.length) * 100) : 0))

const levelTiers = [50, 70, 90, 99]
const xpTiers = [10_000_000, 25_000_000, 50_000_000, 100_000_000, 200_000_000]
const xpLabel = (v) => `${v / 1e6}M`

const lookup = computed(() => new Map(achievements.value.map((a) => [`${a.type}|${a.skill}|${a.value}`, a])))
const get = (type, skill, value) => lookup.value.get(`${type}|${skill}|${value}`)

const pct = (a) => Math.floor(a.progress * 100)
function tip(a) {
  if (a.completed) {
    return a.dateKnown ? `${a.title}: detected ${new Date(a.achievedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : `${a.title}: complete`
  }
  return `${a.title}: ${a.current.toLocaleString('en-US')} / ${a.value.toLocaleString('en-US')} (${pct(a)}%)`
}

const totalRows = computed(() => {
  const levels = achievements.value.filter((a) => a.type === 'total_level').map((a) => ({ ...a, label: a.value >= 2376 ? `Maxed ${a.value.toLocaleString('en-US')}` : a.value.toLocaleString('en-US') }))
  const xp = achievements.value
    .filter((a) => a.type === 'total_xp')
    .map((a) => ({ ...a, label: a.value >= 1e9 ? `${a.value / 1e9}B` : `${a.value / 1e6}M` }))
  return [
    { title: 'Overall', items: levels },
    { title: 'Total XP', items: xp },
  ]
})

const skillRows = computed(() => {
  const rows = SKILL_NAMES.map((skill) => ({
    skill,
    levels: levelTiers.map((v) => get('skill_level', skill, v)).filter(Boolean),
    xp: xpTiers.map((v) => get('skill_xp', skill, v)).filter(Boolean),
  })).filter((r) => r.levels.length)
  return onlyRemaining.value ? rows.filter((r) => [...r.levels, ...r.xp].some((a) => !a.completed)) : rows
})
</script>
