<template>
  <section class="hf" aria-label="What TickGains does">
    <div class="hf-intro">
      <h2 class="hm-h2">Your entire OSRS journey, connected.</h2>
      <p>Your stats inform your plans. Your plans use live prices. Your progress updates automatically.</p>
    </div>
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
        <span class="hf-tab-text"><i class="hf-step">{{ t.step }}</i><b>{{ t.label }}</b><small>{{ t.text }}</small></span>
      </button>
    </div>

    <div :id="`hf-panel-${tab}`" class="hf-panel" role="tabpanel" :aria-labelledby="`hf-tab-${tab}`">
      <!-- XP tracking: a real profile from the site -->
      <template v-if="tab === 'tracking'">
        <div class="hf-head">
          <span class="hf-label">Example profile<span class="hf-live"><i aria-hidden="true" />Updated hourly</span></span>
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
              <div v-if="example.weekXp"><dt>Gained · 7 days</dt><dd class="stat-gain hf-up"><span aria-hidden="true">▲</span> {{ example.weekXp.toLocaleString('en-US') }}</dd></div>
              <div class="hf-total"><dt>Total XP</dt><dd>{{ example.overallXp?.toLocaleString('en-US') }}</dd></div>
            </dl>
            <ul v-if="example.recentSkills.length" class="hf-gains" aria-label="Biggest gains this week">
              <li v-for="s in example.recentSkills" :key="s.skill">
                <img :src="skillIconSrc(s.skill)" :alt="s.skill" width="20" height="20" />
                <span class="hf-gain-name">{{ s.skill }}</span>
                <span class="hf-gain-bar" aria-hidden="true"><i :style="{ width: `${Math.max(8, (s.xp / maxGain) * 100)}%` }" /></span>
                <b class="stat-gain">+{{ formatXp(s.xp) }}</b>
              </li>
            </ul>
          </div>
          <div class="hf-chart">
            <XpLineChart v-if="chartPoints.length > 1" :points="chartPoints" :height="170" aria-label="Example player's total experience over time" />
            <p v-else class="hf-empty">History builds up as snapshots are saved.</p>
          </div>
        </div>
        <p v-else class="hf-empty">Track a player above and their profile will look like this: charts, milestones and gains.</p>
      </template>

      <!-- Account planner: the Smart Planner's own answer for a sample account, with what makes it smart -->
      <template v-else-if="tab === 'planner'">
        <div class="hf-head">
          <span class="hf-label">Example plan · Smart Planner<template v-if="plan"> · {{ plan.goals }} goals · {{ Math.round(plan.hours) }} h · about {{ daysText(plan.days) }} at 2 h a day</template></span>
          <RouterLink class="hf-open" :to="{ name: 'planner' }" @click="track('home_preview_open', { tab: 'planner' })">Build your plan <span aria-hidden="true">→</span></RouterLink>
        </div>
        <div v-if="plan" class="hf-pl">
          <ol class="hf-pl-steps">
            <li v-for="q in plan.quests" :key="q.title" class="is-quest">
              <span class="hf-pl-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></svg></span>
              <span class="hf-pl-main"><b>{{ q.title }}</b><em>Quest</em><small :title="q.reason">{{ q.reason }}</small></span>
              <span class="hf-pl-end"><b>{{ q.time }}</b><small>{{ q.rewards }}</small></span>
            </li>
            <li v-for="r in plan.steps" :key="r.skill">
              <span class="hf-pl-ico"><img :src="skillIconSrc(r.skill)" :alt="r.skill" width="22" height="22" /></span>
              <span class="hf-pl-main"><b>{{ r.skill }}</b><span class="hf-pl-lv">{{ r.from }} <i aria-hidden="true">→</i> {{ r.to }}</span><small :title="r.reason">{{ r.reason }}</small></span>
              <span class="hf-pl-end"><b>{{ r.time }}</b><small v-if="r.netGp != null" :class="r.netGp >= 0 ? 'stat-gain' : 'hf-cost'">{{ gpSigned(r.netGp) }} gp</small></span>
            </li>
          </ol>
          <ul class="hf-pl-why">
            <li class="why-prices">
              <span class="hf-why-ico"><i class="hf-live-dot" :class="{ off: !pricesLive }" aria-hidden="true" /></span>
              <span>
                <b>Live GE prices</b>
                <strong v-if="plan.netGp != null" :class="plan.netGp >= 0 ? 'stat-gain' : 'hf-cost'">{{ gpSigned(plan.netGp) }} gp <small>net for this plan</small></strong>
                <small>{{ pricesLive ? `Every cost and profit, after the 2% tax. Updated ${updatedText}.` : 'Loading live prices…' }}</small>
              </span>
            </li>
            <li>
              <span class="hf-why-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.2 1.2L7 4.8M3.5 12l1.2 1.2L7 10.8M3.5 18l1.2 1.2L7 16.8" /></svg></span>
              <span>
                <b>Quest &amp; diary tracker</b>
                <small>Tick off what you have done: plans skip the XP, and methods you have unlocked are marked ready. <RouterLink :to="{ name: 'quests' }" @click="track('home_preview_open', { tab: 'quests' })">Open the tracker →</RouterLink></small>
              </span>
            </li>
            <li>
              <span class="hf-why-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></svg></span>
              <span>
                <b>Smart recommendations</b>
                <small>Steps are ordered by what unlocks faster training, and every one says why.</small>
              </span>
            </li>
          </ul>
        </div>
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
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import XpLineChart from '@/components/XpLineChart.vue'
import HomeGePrices from '@/components/home/HomeGePrices.vue'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { track } from '@/utils/analytics'
import { ago } from '@/components/admin/stats/statsFormat'

// The welcome page's three main features, as tabs: each says what it is in a line, and opens a small live preview with a way into
// it (a real profile, a plan worked out by the planner itself, live prices). Only the open tab is drawn, except the prices, which load
// up front; the sample plan is worked out the first time its tab opens, so the planner code is not loaded for visitors who never look.
const props = defineProps({
  example: { type: Object, default: null },
  chartPoints: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const tabs = [
  { key: 'tracking', step: 'Track', label: 'XP Tracking', text: 'Your actual XP and progress, saved every hour for any player.', icon: svg('<path d="M3 17l6-6 4 4 8-9" /><path d="M15 6h6v6" />') },
  { key: 'planner', step: 'Plan', label: 'Account Planner', text: 'Personalized training routes, built from your own stats.', icon: svg('<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" />') },
  { key: 'prices', step: 'Optimize', label: 'GE Prices', text: 'Costs from live prices on 4,500 items, in every plan.', icon: svg('<circle cx="12" cy="12" r="9" /><path d="M14.8 9.2C14.3 8.4 13.3 8 12 8c-1.7 0-2.8.8-2.8 2s1 1.7 2.8 2c1.8.3 2.8.8 2.8 2s-1.1 2-2.8 2c-1.4 0-2.4-.5-2.9-1.4" /><path d="M12 6.5V8m0 8v1.5" />') },
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

const maxGain = computed(() => Math.max(1, ...(props.example?.recentSkills || []).map((r) => r.xp)))

// The sample plan is the Smart Planner's own answer, so its code is only loaded the first time the tab opens, and its prices start
// loading then. The plan is worked out again when the live prices arrive, so its gp figures use them.
const sample = shallowRef(null)
let stopPrices = null
watch(tab, async (t) => {
  if (t !== 'planner' || sample.value) return
  try {
    const mod = await import('@/utils/homeSamplePlan')
    stopPrices = mod.startPrices()
    sample.value = mod
  } catch {
    sample.value = null
  }
})
onBeforeUnmount(() => stopPrices?.())
const plan = computed(() => {
  const mod = sample.value
  if (!mod) return null
  void mod.priceVersion.value
  try {
    return mod.buildSamplePlan()
  } catch {
    return null
  }
})
const pricesLive = computed(() => !!sample.value?.priceStatus.value.loaded)
const updatedText = computed(() => {
  const at = sample.value?.priceStatus.value.updatedAt
  return at ? ago(at) : 'just now'
})

// 5.5M, 312K, 800: short gp with its sign.
function gpSigned(v) {
  const a = Math.abs(v)
  const t = a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${Math.round(a / 1e3)}K` : String(Math.round(a))
  return `${v < 0 ? '-' : '+'}${t}`
}
const daysText = (days) => (days >= 60 ? `${Math.round(days / 30)} months` : `${days} days`)
</script>
