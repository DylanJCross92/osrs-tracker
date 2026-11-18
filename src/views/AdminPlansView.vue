<template>
  <div class="st ap">
    <header class="st-head">
      <div>
        <h1>Player plans</h1>
        <p>The planner plans people have saved, by player name: from accounts, and from visitors who are not signed in.</p>
      </div>
      <input v-model.trim="filter" class="st-search" type="search" placeholder="Filter by player or skill" aria-label="Filter by player or skill" />
    </header>

    <p v-if="error" class="cl-banner is-error" role="alert">{{ error }}</p>
    <p v-else-if="!data" class="cl-empty">Loading…</p>

    <template v-else>
      <p class="ap-totals">
        <b>{{ fmt(data.totals.players) }}</b> {{ data.totals.players === 1 ? 'player' : 'players' }} ·
        <b>{{ fmt(data.totals.plans) }}</b> {{ data.totals.plans === 1 ? 'plan' : 'plans' }} ·
        <b>{{ fmt(data.totals.accounts) }}</b> {{ data.totals.accounts === 1 ? 'account' : 'accounts' }}<template v-if="data.totals.visitors"> ·
        <b>{{ fmt(data.totals.visitors) }}</b> {{ data.totals.visitors === 1 ? 'visitor' : 'visitors' }} not signed in</template>
        <button v-if="shown.length > 1" class="btn-text ap-toggle" type="button" @click="toggleAll">{{ allOpen ? 'Collapse all' : 'Expand all' }}</button>
      </p>
      <p v-if="!data.players.length" class="cl-empty">No plans have been saved yet.</p>
      <p v-else-if="!shown.length" class="cl-empty">No player or skill matches "{{ filter }}".</p>

      <section v-for="p in shown" :key="p.key" class="st-card ap-player">
        <button class="ap-head" type="button" :aria-expanded="isOpen(p.key)" @click="toggle(p.key)">
          <svg class="ap-chev" :class="{ 'is-open': isOpen(p.key) }" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          <h2>{{ p.name || 'No player set' }}</h2>
          <span class="ap-meta">{{ count(p.plans.length, 'plan') }}<template v-if="p.accounts > 1"> · {{ p.accounts }} accounts</template><template v-if="p.visitors"> · {{ count(p.visitors, 'visitor') }}</template></span>
          <RouterLink v-if="p.name" class="ap-open" :to="{ name: 'playerDetail', params: { username: p.name } }" @click.stop>Profile</RouterLink>
        </button>
        <ul v-show="isOpen(p.key)" class="ap-plans">
          <li v-for="plan in p.plans" :key="plan.source + plan.id" class="ap-plan">
            <div class="ap-plan-top">
              <b>{{ plan.name }}</b>
              <em v-if="plan.source === 'working'" class="ap-tag">Not saved</em>
              <RouterLink v-if="plan.owner" class="ap-visitor" :to="{ name: 'adminStats', query: { tab: 'visitors', v: plan.owner.key } }" :title="`See what ${plan.owner.label} did`">{{ plan.owner.label }}</RouterLink>
              <small>{{ plan.hoursPerDay ? `${plan.hoursPerDay} h/day` : '' }}<template v-if="strategy(plan)"> · {{ strategy(plan) }}</template><template v-if="plan.updatedAt"> · updated {{ ago(plan.updatedAt) }}</template></small>
            </div>
            <ul v-if="plan.goals.length" class="ap-goals">
              <li v-for="g in plan.goals" :key="g.skill">
                <img :src="skillIconSrc(g.skill)" :alt="''" width="20" height="20" loading="lazy" />
                <span><b>{{ g.skill }}</b> {{ levelOf(g.currentXp) }} → {{ levelOf(g.targetXp) }}</span>
                <small>{{ formatXp(Math.max(g.targetXp - g.currentXp, 0)) }} XP</small>
              </li>
            </ul>
            <p v-else class="ap-none">No goals in this plan.</p>
          </li>
        </ul>
      </section>
      <p class="st-foot">Plans come from each account's synced planner data, and from the plans saved in the browser of visitors who are not signed in (shown with their visitor number, which opens what they did in the Visitors tab). Accounts are not named here, only the player each plan is for. Browsers that ask not to be tracked are not included.</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'
import { setPageMeta } from '@/utils/pageMeta'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { levelAtXp } from '@/utils/planner'
import { STRATEGY_LABELS } from '@/utils/plannerTools'

setPageMeta({ title: 'Player plans', description: 'Plans players have saved.', path: '/admin/plans', noindex: true })

const data = ref(null)
const error = ref('')
const filter = ref('')
// Players start collapsed when there are many, so the list stays easy to scan.
const open = reactive(new Set())
onMounted(async () => {
  try {
    data.value = await statsApi.plans()
    if (data.value.players.length <= 8) data.value.players.forEach((p) => open.add(p.key))
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not load the plans.'
  }
})

const shown = computed(() => {
  const q = filter.value.toLowerCase()
  const list = data.value?.players || []
  if (!q) return list
  return list.filter((p) => p.name.toLowerCase().includes(q) || p.plans.some((pl) => pl.goals.some((g) => g.skill.toLowerCase().includes(q))))
})
const isOpen = (key) => open.has(key) || !!filter.value
const toggle = (key) => (open.has(key) ? open.delete(key) : open.add(key))
const allOpen = computed(() => shown.value.length > 0 && shown.value.every((p) => open.has(p.key)))
const toggleAll = () => (allOpen.value ? shown.value.forEach((p) => open.delete(p.key)) : shown.value.forEach((p) => open.add(p.key)))

const fmt = (n) => Number(n || 0).toLocaleString('en-US')
const count = (n, word) => `${fmt(n)} ${word}${Number(n) === 1 ? '' : 's'}`
const levelOf = (xp) => levelAtXp(Number(xp) || 0, true)
const strategy = (plan) => (STRATEGY_LABELS[plan.strategy] ? STRATEGY_LABELS[plan.strategy] : '')
function ago(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 60) return `${days} days ago`
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
