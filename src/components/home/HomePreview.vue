<template>
  <section class="hp" aria-label="Product preview">
    <div class="hp-tabs" role="tablist" aria-label="What TickGains does" @keydown="onKey">
      <button
        v-for="t in tabs"
        :id="`hp-tab-${t.key}`"
        :key="t.key"
        type="button"
        role="tab"
        class="hp-tab"
        :class="{ on: tab === t.key }"
        :aria-selected="tab === t.key"
        :aria-controls="`hp-panel-${t.key}`"
        :tabindex="tab === t.key ? 0 : -1"
        @click="pick(t.key)"
      >
        <span class="hp-tab-ico" aria-hidden="true" v-html="t.icon" />{{ t.label }}
      </button>
    </div>

    <div :id="`hp-panel-${tab}`" class="hp-panel" role="tabpanel" :aria-labelledby="`hp-tab-${tab}`">
      <!-- XP tracking: a real profile from the site -->
      <template v-if="tab === 'tracking'">
        <PageSkeleton v-if="loading" kind="home-example" />
        <div v-else-if="example" class="hp-split">
          <div class="hp-profile">
            <div class="hp-profile-head">
              <span class="hp-avatar"><PlayerAvatar :name="example.username || example.displayName" /></span>
              <div>
                <span class="hp-label">Example profile</span>
                <h3>{{ example.displayName }}<PlayerBadge :label="example.badge" :claimed="example.claimed" /></h3>
              </div>
            </div>
            <dl class="hp-stats">
              <div><dt>Overall</dt><dd>{{ example.overallLevel?.toLocaleString('en-US') }}</dd></div>
              <div v-if="example.weekXp"><dt>Gained · 7 days</dt><dd class="stat-gain">+{{ example.weekXp.toLocaleString('en-US') }}</dd></div>
              <div class="wide"><dt>Total XP</dt><dd>{{ example.overallXp?.toLocaleString('en-US') }}</dd></div>
            </dl>
            <ul v-if="example.recentSkills.length" class="hp-gains">
              <li v-for="s in example.recentSkills" :key="s.skill"><img :src="skillIconSrc(s.skill)" :alt="s.skill" width="20" height="20" />{{ s.skill }}<b class="stat-gain">+{{ formatXp(s.xp) }}</b></li>
            </ul>
          </div>
          <div class="hp-chart">
            <span class="hp-label">XP progression</span>
            <XpLineChart v-if="chartPoints.length > 1" :points="chartPoints" aria-label="Example player's total experience over time" />
            <p v-else class="hp-empty">History builds up as snapshots are saved.</p>
          </div>
        </div>
        <p v-else class="hp-empty">Track a player above and their profile will look like this: charts, milestones and gains.</p>
        <div class="hp-foot">
          <RouterLink v-if="example" class="btn btn-primary" :to="{ name: 'playerDetail', params: { username: example.username } }" @click="track('home_example_profile')">Open this profile</RouterLink>
          <RouterLink v-else class="btn btn-primary" :to="{ path: '/discover' }" @click="track('home_preview_open', { tab: 'tracking' })">Explore Discover</RouterLink>
          <span class="hp-foot-note">Hourly snapshots and imported history for any player. No sign-up.</span>
        </div>
      </template>

      <!-- Account planner: a plan worked out by the planner itself -->
      <template v-else-if="tab === 'planner'">
        <div v-if="plan" class="hp-plan">
          <div class="hp-plan-head">
            <span class="hp-label">Example plan · fastest route</span>
            <span class="hp-plan-sum"><b>{{ plan.rows.length }} goals</b> · {{ Math.round(plan.totalHours) }} h · about {{ daysText(plan.days) }} at 2 h a day</span>
          </div>
          <ol class="hp-plan-rows">
            <li v-for="r in plan.rows" :key="r.skill">
              <span class="hp-plan-skill"><img :src="skillIconSrc(r.skill)" :alt="r.skill" width="22" height="22" />{{ r.skill }}</span>
              <span class="hp-plan-levels">{{ r.from }} <i aria-hidden="true">→</i> {{ r.to }}</span>
              <span class="hp-plan-method">{{ r.method }}<small v-if="r.more"> + {{ r.more }} more</small></span>
              <span class="hp-plan-bar" aria-hidden="true"><i :style="{ width: `${Math.max(6, (r.hours / maxHours) * 100)}%` }" /></span>
              <span class="hp-plan-time">{{ Math.round(r.hours) }} h<small>done {{ dateText(r.done) }}</small></span>
            </li>
          </ol>
        </div>
        <p v-else class="hp-empty">Working out an example plan…</p>
        <div class="hp-foot">
          <RouterLink class="btn btn-primary" :to="{ name: 'planner' }" @click="track('home_preview_open', { tab: 'planner' })">Build your plan</RouterLink>
          <span class="hp-foot-note">Dates for every level, methods you can unlock, costs and profit from live prices.</span>
        </div>
      </template>

      <!-- Grand Exchange prices: always mounted (hidden until its tab opens) so the live prices are already loaded when it does -->
      <div v-show="tab === 'prices'" class="hp-prices">
        <span class="hp-label">Live Grand Exchange prices</span>
        <HomeGePrices />
        <div class="hp-foot">
          <RouterLink class="btn btn-primary" :to="{ name: 'items' }" @click="track('home_ge_band', { target: 'prices' })">Browse GE prices</RouterLink>
          <span class="hp-foot-note">Any of 4,500 items, with price history.</span>
        </div>
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

// The welcome page's product preview: three tabs that show the real thing (a live profile, a plan built by the planner, live
// prices), each with a way into it. Only the open tab is drawn; the sample plan is worked out the first time its tab opens, so the
// planner code is not loaded for visitors who never look at it.
defineProps({
  example: { type: Object, default: null },
  chartPoints: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const svg = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const tabs = [
  { key: 'tracking', label: 'XP Tracking', icon: svg('<path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />') },
  { key: 'planner', label: 'Account Planner', icon: svg('<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" />') },
  { key: 'prices', label: 'GE Prices', icon: svg('<circle cx="12" cy="12" r="9" /><path d="M14.8 9.2C14.3 8.4 13.3 8 12 8c-1.7 0-2.8.8-2.8 2s1 1.7 2.8 2c1.8.3 2.8.8 2.8 2s-1.1 2-2.8 2c-1.4 0-2.4-.5-2.9-1.4" /><path d="M12 6.5V8m0 8v1.5" />') },
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
  document.getElementById(`hp-tab-${tab.value}`)?.focus()
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
