<template>
  <!-- Small illustrations of what each feature does. Decorative, drawn in the icon row so cards stay the same height. -->
  <svg class="fa" viewBox="0 0 128 54" preserveAspectRatio="xMaxYMid meet" aria-hidden="true" focusable="false">
    <!-- Automatic XP tracking: a gain line climbing -->
    <template v-if="kind === 'tracking'">
      <defs>
        <linearGradient id="fa-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f0c976" stop-opacity="0.35" />
          <stop offset="1" stop-color="#f0c976" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path class="fa-area" d="M4 44 L22 40 L38 43 L54 31 L70 34 L88 20 L106 22 L124 8 L124 54 L4 54 Z" fill="url(#fa-area)" />
      <path class="fa-line" pathLength="1" d="M4 44 L22 40 L38 43 L54 31 L70 34 L88 20 L106 22 L124 8" />
      <circle class="fa-dot" cx="124" cy="8" r="3.2" />
      <rect class="fa-chip" x="4" y="2" width="46" height="15" rx="7.5" />
      <text class="fa-text fa-good" x="27" y="12.4" text-anchor="middle">+84K xp</text>
    </template>

    <!-- Historical data: months of bars -->
    <template v-else-if="kind === 'history'">
      <line class="fa-base" x1="4" y1="49" x2="124" y2="49" />
      <rect v-for="(h, i) in bars" :key="i" class="fa-bar" :class="{ 'fa-bar-hot': i >= bars.length - 3 }" :style="{ '--i': i }" :x="6 + i * 13.4" :y="49 - h" width="9" :height="h" rx="2.5" />
    </template>

    <!-- Account planner: goals with progress and hours -->
    <template v-else-if="kind === 'planner'">
      <g v-for="(r, i) in goals" :key="r.n" :transform="`translate(0 ${i * 17.5})`">
        <text class="fa-text" x="4" y="9.5">{{ r.n }}</text>
        <rect class="fa-track" x="46" y="3" width="50" height="7" rx="3.5" />
        <rect class="fa-fill" :style="{ '--i': i }" x="46" y="3" :width="50 * r.p" height="7" rx="3.5" />
        <text class="fa-text fa-gold" x="124" y="9.5" text-anchor="end">{{ r.h }}</text>
      </g>
    </template>

    <!-- Skill calculators: level to level, then the route split into methods -->
    <template v-else-if="kind === 'calculators'">
      <rect class="fa-chip" x="4" y="2" width="30" height="17" rx="5" />
      <text class="fa-text fa-strong" x="19" y="14" text-anchor="middle">70</text>
      <path class="fa-arrow" d="M41 10.5 H58 M53 6 L58 10.5 L53 15" />
      <rect class="fa-chip fa-chip-gold" x="65" y="2" width="30" height="17" rx="5" />
      <text class="fa-text fa-strong fa-ink" x="80" y="14" text-anchor="middle">99</text>
      <text class="fa-text fa-gold" x="124" y="14" text-anchor="end">150 h</text>
      <rect class="fa-seg fa-seg-1" x="4" y="30" width="30" height="8" rx="3" />
      <rect class="fa-seg fa-seg-2" x="36" y="30" width="26" height="8" rx="3" />
      <rect class="fa-seg fa-seg-3" x="64" y="30" width="38" height="8" rx="3" />
      <rect class="fa-seg fa-seg-4" x="104" y="30" width="20" height="8" rx="3" />
      <text class="fa-text fa-muted" x="4" y="51">fastest route</text>
      <text class="fa-text fa-good" x="124" y="51" text-anchor="end">+176M gp</text>
    </template>

    <!-- Player discovery: a mini leaderboard -->
    <template v-else>
      <g v-for="(r, i) in board" :key="r.n" :transform="`translate(0 ${i * 17.5})`">
        <circle class="fa-avatar" cx="9" cy="8" r="6.5" />
        <text class="fa-text fa-ink" x="9" y="11" text-anchor="middle">{{ i + 1 }}</text>
        <rect class="fa-track" x="21" y="3" width="64" height="9" rx="4.5" />
        <rect class="fa-fill" :style="{ '--i': i }" x="21" y="3" :width="64 * r.p" height="9" rx="4.5" />
        <text class="fa-text fa-good" x="124" y="11" text-anchor="end">{{ r.g }}</text>
      </g>
    </template>
  </svg>
</template>

<script setup>
defineProps({ kind: { type: String, required: true } })

const bars = [14, 20, 17, 26, 22, 31, 27, 36, 33]
const goals = [
  { n: 'Slayer', p: 0.82, h: '12 h' },
  { n: 'Herblore', p: 0.55, h: '40 h' },
  { n: 'Farming', p: 0.28, h: '85 h' },
]
const board = [
  { n: 'a', p: 1, g: '+4.2M' },
  { n: 'b', p: 0.74, g: '+3.1M' },
  { n: 'c', p: 0.5, g: '+2.1M' },
]
</script>
