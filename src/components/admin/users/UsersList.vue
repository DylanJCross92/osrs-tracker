<template>
  <div class="su">
    <p v-if="error" class="cl-banner is-error" role="alert">{{ error }}</p>
    <p v-else-if="!data" class="st-empty">Loading…</p>
    <template v-else>
      <section class="st-tiles is-four" aria-label="Summary">
        <div class="st-tile">
          <span class="st-tile-label">Accounts</span>
          <b class="st-tile-num">{{ fmt(data.total) }}</b>
          <small>{{ count(summary.waiting, 'claim') }} waiting for a code check</small>
        </div>
        <div class="st-tile">
          <span class="st-tile-label">Email confirmed</span>
          <b class="st-tile-num">{{ fmt(summary.verified) }}</b>
          <small>{{ summary.verifiedPct }} of accounts. {{ fmt(summary.total - summary.verified) }} still to confirm.</small>
        </div>
        <div class="st-tile">
          <span class="st-tile-label">Claimed a player</span>
          <b class="st-tile-num is-visits">{{ fmt(summary.claimed) }}</b>
          <small>{{ summary.claimedPct }} of accounts own a profile</small>
        </div>
        <div class="st-tile">
          <span class="st-tile-label">Active in {{ days }} days</span>
          <b class="st-tile-num">{{ fmt(summary.active) }}</b>
          <small>{{ summary.activePct }} did something on the site</small>
        </div>
      </section>

      <section class="st-card" aria-labelledby="su-list">
        <div class="st-card-head">
          <h2 id="su-list">People who signed up</h2>
          <div class="su-tools">
            <input v-model.trim="query" class="st-search" type="search" placeholder="Find an email or player" aria-label="Find an email or player" />
            <select v-model="sort" class="su-sort" aria-label="Sort by">
              <option v-for="s in SORTS" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
          </div>
        </div>
        <div class="su-filters" role="group" aria-label="Show">
          <button v-for="f in FILTERS" :key="f.key" type="button" class="su-chip" :class="{ on: filter === f.key }" :aria-pressed="filter === f.key" @click="filter = f.key">
            {{ f.label }} <small>{{ counts[f.key] }}</small>
          </button>
        </div>

        <p v-if="!data.accounts.length" class="st-empty">Nobody has signed up yet.</p>
        <p v-else-if="!rows.length" class="st-empty">Nobody matches that.</p>
        <div v-else class="st-table-wrap">
          <table class="st-table su-table">
            <thead>
              <tr><th>Account</th><th>Email</th><th>Claimed players</th><th>Signed up</th><th>Last seen</th><th>Activity in {{ days }} days</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in rows" :key="a.id">
                <th scope="row">
                  <button type="button" class="su-who" :title="`See what ${a.email} did`" @click="emit('go', `a:${a.id}`)">{{ a.email }}</button>
                  <span v-if="a.team" class="su-team">Team</span>
                </th>
                <td data-label="Email">
                  <span v-if="a.verifiedAt" class="su-flag is-yes" :title="`Confirmed ${longDate(a.verifiedAt)}`"><i aria-hidden="true">✓</i> Confirmed</span>
                  <span v-else class="su-flag is-no"><i aria-hidden="true">!</i> Not confirmed</span>
                </td>
                <td class="su-players" data-label="Claimed players">
                  <template v-if="a.players.length">
                    <span class="su-flag is-yes"><i aria-hidden="true">✓</i> {{ a.players.length }}</span>
                    <span class="su-names">{{ a.players.join(', ') }}</span>
                  </template>
                  <span v-else-if="a.pending" class="su-flag is-wait"><i aria-hidden="true">…</i> {{ a.pending === 1 ? 'Claim waiting' : `${a.pending} claims waiting` }}</span>
                  <span v-else class="su-none">None</span>
                </td>
                <td data-label="Signed up" :title="longDate(a.createdAt)">{{ shortDate(a.createdAt) }}</td>
                <td data-label="Last seen" :title="longDate(a.lastSeen)">
                  <template v-if="a.lastSeen">{{ ago(a.lastSeen) }}<small class="su-sub">{{ shortDate(a.lastSeen) }}</small></template>
                  <span v-else class="su-none">Never</span>
                </td>
                <td class="su-act" data-label="Activity">
                  <template v-if="a.team"><span class="su-level is-team">Team</span><small class="su-sub">Not counted</small></template>
                  <template v-else>
                    <span class="su-level" :class="`is-${level(a).level}`">{{ level(a).label }}</span>
                    <span class="su-meter" aria-hidden="true"><i :style="{ width: `${Math.round(level(a).share * 100)}%` }" /></span>
                    <small class="su-sub">{{ a.activeDays ? `${count(a.activeDays, 'day')} · ${count(a.steps, 'step')}` : 'Nothing recorded' }}</small>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="data.total > data.accounts.length" class="st-note">Showing the {{ fmt(data.accounts.length) }} most recently seen of {{ fmt(data.total) }} accounts.</p>
      </section>
    </template>
    <p class="st-foot">Last seen is the last time the account signed in or came back to the site. Activity counts the different days in the chosen range that the account did anything (a page opened, a button used), and the steps behind it: Very active is about 2 days in 5 or more, Regular is about 1 day in 7 or more. Browsers that send Do Not Track or Global Privacy Control, and team accounts, are not counted, so they can show as Quiet or Team.</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { statsApi } from '@/api/stats'
import { ago, count, fmt } from '../stats/statsFormat'
import { activityLevel, FILTERS, filterUsers, SORTS, usersSummary } from './usersData'
import { useStatsLoad } from '../stats/useStatsLoad'

const props = defineProps({ days: { type: Number, required: true } })
const emit = defineEmits(['go'])

const { data, error, load } = useStatsLoad((d) => statsApi.accounts(d), 'Could not load the accounts.')
watch(() => props.days, (d) => load(d), { immediate: true })

const query = ref('')
const filter = ref('all')
const sort = ref('seen')

const accounts = computed(() => data.value?.accounts || [])
const summary = computed(() => usersSummary(accounts.value, props.days))
const rows = computed(() => filterUsers(accounts.value, { query: query.value, filter: filter.value, sort: sort.value }))
// How many accounts each filter would show, so the chips say what is behind them.
const counts = computed(() => Object.fromEntries(FILTERS.map((f) => [f.key, filterUsers(accounts.value, { filter: f.key }).length])))
const level = (a) => activityLevel(a, props.days)

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-')
const longDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
</script>
