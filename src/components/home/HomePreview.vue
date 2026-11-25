<template>
  <section class="hf" aria-label="What TickGains does">
    <div class="hf-tabs" role="tablist" aria-label="Main features" @keydown="onKey">
      <button
        v-for="t in tabs"
        :id="`hf-tab-${t.key}`"
        :key="t.key"
        type="button"
        role="tab"
        class="hf-tab"
        :class="{ on: tab === t.key }"
        :aria-selected="tab === t.key"
        :aria-controls="`hf-panel-${t.key}`"
        :tabindex="tab === t.key ? 0 : -1"
        @click="pick(t.key)"
      >
        <span class="hf-ico" aria-hidden="true" v-html="t.icon" />
        <span class="hf-tab-text"><b>{{ t.label }}</b><small>{{ t.text }}</small></span>
      </button>
    </div>

    <div :id="`hf-panel-${tab}`" class="hf-panel" role="tabpanel" :aria-labelledby="`hf-tab-${tab}`">
      <!-- XP tracking: a real profile from the site -->
      <template v-if="tab === 'tracking'">
        <div class="hf-head">
          <span class="hf-label">Example profile</span>
          <RouterLink v-if="example" class="hf-open" :to="{ name: 'playerDetail', params: { username: example.username } }" @click="track('home_example_profile')">Open this profile <span aria-hidden="true">→</span></RouterLink>
          <RouterLink v-else class="hf-open" :to="{ path: '/discover' }" @click="track('home_preview_open', { tab: 'tracking' })">Explore Discover <span aria-hidden="true">→</span></RouterLink>
        </div>
        <PageSkeleton v-if="loading" kind="home-example" />
        <div v-else-if="example" class="hf-xp">
          <div class="hf-profile">
            <div class="hf-who">
              <span class="hf-avatar"><PlayerAvatar :name="example.username || example.displayName" /></span>
              <h3>{{ example.displayName }}<PlayerBadge :label="example.badge" :claimed="example.claimed" /></h3>
            </div>
            <dl class="hf-stats">
              <div><dt>Overall</dt><dd>{{ example.overallLevel?.toLocaleString('en-US') }}</dd></div>
              <div v-if="example.weekXp"><dt>Gained · 7 days</dt><dd class="stat-gain">+{{ example.weekXp.toLocaleString('en-US') }}</dd></div>
              <div><dt>Total XP</dt><dd>{{ example.overallXp?.toLocaleString('en-US') }}</dd></div>
            </dl>
            <ul v-if="example.recentSkills.length" class="hf-gains">
              <li v-for="s in example.recentSkills" :key="s.skill"><img :src="skillIconSrc(s.skill)" :alt="s.skill" width="18" height="18" />{{ s.skill }} <b class="stat-gain">+{{ formatXp(s.xp) }}</b></li>
            </ul>
          </div>
          <div class="hf-chart">
            <XpLineChart v-if="chartPoints.length > 1" :points="chartPoints" :height="170" aria-label="Example player's total experience over time" />
            <p v-else class="hf-empty">History builds up as snapshots are saved.</p>
          </div>
        </div>
        <p v-else class="hf-empty">Track a player above and their profile will look like this: charts, milestones and gains.</p>
      </template>

      <!-- Account planner: a plan worked out by the planner itself -->
      <template v-else-if="tab === 'planner'">
        <div class="hf-head">
          <span class="hf-label">Example plan · fastest route<template v-if="plan"> · {{ plan.rows.length }} goals · {{ Math.round(plan.totalHours) }} h · about {{ daysText(plan.days) }} at 2 h a day</template></span>
          <RouterLink class="hf-open" :to="{ name: 'planner' }" @click="track('home_preview_open', { tab: 'planner' })">Build your plan <span aria-hidden="true">→</span></RouterLink>
        </div>
        <ol v-if="plan" class="hf-plan">
          <li v-for="r in plan.rows" :key="r.skill">
            <span class="hf-plan-skill"><img :src="skillIconSrc(r.skill)" :alt="r.skill" width="20" height="20" />{{ r.skill }}</span>
            <span class="hf-plan-levels">{{ r.from }} <i aria-hidden="true">→</i> {{ r.to }}</span>
            <span class="hf-plan-method">{{ r.method }}<small v-if="r.more"> + {{ r.more }} more</small></span>
            <span class="hf-plan-bar" aria-hidden="true"><i :style="{ width: `${Math.max(6, (r.hours / maxHours) * 100)}%` }" /></span>
            <span class="hf-plan-time">{{ Math.round(r.hours) }} h <small>done {{ dateText(r.done) }}</small></span>
          </li>
        </ol>
        <p v-else class="hf-empty">Working out an example plan…</p>
      </template>

      <!-- Grand Exchange prices: always mounted (hidden until its tab opens) so the live prices are already loaded when it does -->
      <div v-show="tab === 'prices'" class="hf-prices">
        <div class="hf-head">
          <span class="hf-label">Live Grand Exchange prices</span>
          <RouterLink class="hf-open" :to="{ name: 'items' }" @click="track('home_ge_band', { target: 'prices' })">Browse GE prices <span aria-hidden="true">→</span></RouterLink>
        </div>
        <HomeGePrices />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import XpLineChart from '@/components/XpLineChart.vue'
import HomeGePrices from '@/components/home/HomeGePrices.vue'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { track } from '@/utils/analytics'

// The welcome page's three main features, as tabs: each says what it is in a line, and opens a small live preview with a way into
// it (a real profile, a plan worked out by the planner itself, live prices). Only the open tab is drawn, except the prices, which load
// up front; the sample plan is worked out the first time its tab opens, so the planner code is not loaded for visitors who never look.
defineProps({
  example: { type: Object, default: null },
  chartPoints: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const tabs = [
  { key: 'tracking', label: 'XP Tracking', text: 'Hourly snapshots, gains and hiscores history for any player.', icon: svg('<path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" />') },
  { key: 'planner', label: 'Account Planner', text: 'The date you reach each level, the methods to unlock, what it costs.', icon: svg('<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" />') },
  { key: 'prices', label: 'GE Prices', text: 'Live prices for 4,500 items, after tax, behind every gp figure.', icon: svg('<circle cx="12" cy="12" r="9" /><path d="M14.8 9.2C14.3 8.4 13.3 8 12 8c-1.7 0-2.8.8-2.8 2s1 1.7 2.8 2c1.8.3 2.8.8 2.8 2s-1.1 2-2.8 2c-1.4 0-2.4-.5-2.9-1.4" /><path d="M12 6.5V8m0 8v1.5" />') },
]

const tab = ref('tracking')
function pick(key) {
  if (tab.value === key) return
  tab.value = key
  track('home_preview_tab', { tab: key })
}
// Arrow keys move between the tabs, as in any tab list.
function onKey(e) {
  const i = tabs.findIndex((t) => t.key === tab.value)
  const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
  if (next == null) return
  e.preventDefault()
  pick(tabs[(next + tabs.length) % tabs.length].key)
  document.getElementById(`hf-tab-${tab.value}`)?.focus()
}

const plan = ref(null)
const maxHours = computed(() => Math.max(1, ...(plan.value?.rows || []).map((r) => r.hours)))
watch(tab, async (t) => {
  if (t !== 'planner' || plan.value) return
  try {
    const mod = await import('@/utils/homeSamplePlan')
    plan.value = mod.buildSamplePlan()
  } catch {
    plan.value = null
  }
})

const dateText = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const daysText = (days) => (days >= 60 ? `${Math.round(days / 30)} months` : `${days} days`)
</script>
