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

        <p v-if="notice" class="cl-banner" :class="{ 'is-error': notice.error }" :role="notice.error ? 'alert' : 'status'">{{ notice.text }}</p>
        <p v-if="!data.accounts.length" class="st-empty">Nobody has signed up yet.</p>
        <p v-else-if="!rows.length" class="st-empty">Nobody matches that.</p>
        <div v-else class="st-table-wrap">
          <table class="st-table su-table">
            <thead>
              <tr><th>Account</th><th>Email</th><th>Claimed players</th><th>Signed up</th><th>Last seen</th><th>Activity in {{ days }} days</th><th class="su-menu-col"><span class="sr-only">Actions</span></th></tr>
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
                    <span class="su-names"><template v-for="(p, i) in a.players" :key="p"><template v-if="i">, </template><RouterLink class="su-link" :to="{ name: 'playerDetail', params: { username: p } }" :title="`Open ${p}'s profile`">{{ p }}</RouterLink></template></span>
                  </template>
                  <RouterLink v-else-if="a.pending" class="su-flag is-wait su-link-flag" :to="{ name: 'adminClaims' }" title="Open the profile claims"><i aria-hidden="true">…</i> {{ a.pending === 1 ? 'Claim waiting' : `${a.pending} claims waiting` }}</RouterLink>
                  <span v-else class="su-none">None</span>
                  <small v-if="!a.players.length && a.nudgedAt" class="su-sub" :title="`The claim email was sent ${longDate(a.nudgedAt)}`">Emailed {{ shortDate(a.nudgedAt) }}</small>
                  <small v-else-if="!a.players.length && a.optedOut" class="su-sub">Unsubscribed from reminders</small>
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
                <td class="su-menu-cell">
                  <button type="button" class="su-dots" :aria-label="`Actions for ${a.email}`" aria-haspopup="menu" :aria-expanded="menu?.id === a.id" @click.stop="openMenu(a, $event)">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="data.total > data.accounts.length" class="st-note">Showing the {{ fmt(data.accounts.length) }} most recently seen of {{ fmt(data.total) }} accounts.</p>
      </section>
    </template>
    <Teleport to="body">
      <div v-if="menu" class="su-menu" role="menu" :style="{ top: `${menu.y}px`, left: `${menu.x}px` }" @click.stop>
        <button type="button" class="su-menu-item" role="menuitem" @click="seeActivity">See what they did</button>
        <button type="button" class="su-menu-item" role="menuitem" :disabled="!!emailBlock(menu.account)" :title="emailBlock(menu.account)" @click="askEmail">{{ menu.account.nudgedAt ? 'Send claim email again' : 'Send claim email' }}</button>
        <button type="button" class="su-menu-item is-danger" role="menuitem" :disabled="menu.account.team" :title="menu.account.team ? 'Team accounts cannot be deleted here' : ''" @click="askDelete">Delete account</button>
      </div>
      <div v-if="emailing" class="modal-overlay" @click.self="cancelEmail">
        <div class="modal-card su-confirm" role="alertdialog" aria-modal="true" aria-labelledby="su-email-title" aria-describedby="su-email-text">
          <div class="share-modal-header">
            <h2 id="su-email-title">Send the claim email?</h2>
            <button class="btn-text" type="button" aria-label="Close" :disabled="sendingEmail" @click="cancelEmail">✕</button>
          </div>
          <p id="su-email-text" class="su-confirm-text"><b>{{ emailing.email }}</b> will get the "claim your player" email, which lists what a claimed profile unlocks. <template v-if="emailing.nudgedAt">They already got it on {{ shortDate(emailing.nudgedAt) }}. </template>It has an unsubscribe link.</p>
          <div class="save-plan-actions">
            <button ref="emailCancelBtn" class="btn-text" type="button" :disabled="sendingEmail" @click="cancelEmail">Cancel</button>
            <button class="btn btn-primary" type="button" :disabled="sendingEmail" @click="confirmEmail">{{ sendingEmail ? 'Sending…' : 'Send email' }}</button>
          </div>
        </div>
      </div>
      <div v-if="confirming" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-card su-confirm" role="alertdialog" aria-modal="true" aria-labelledby="su-confirm-title" aria-describedby="su-confirm-text">
          <div class="share-modal-header">
            <h2 id="su-confirm-title">Delete this account?</h2>
            <button class="btn-text" type="button" aria-label="Close" :disabled="deleting" @click="cancelDelete">✕</button>
          </div>
          <p id="su-confirm-text" class="su-confirm-text"><b>{{ confirming.email }}</b> and everything tied to it will be deleted for good: sign-in, saved plans, profile claims<template v-if="confirming.players.length"> (including {{ confirming.players.join(', ') }})</template>, and any clans they own. This cannot be undone.</p>
          <p v-if="deleteError" class="cl-banner is-error" role="alert">{{ deleteError }}</p>
          <div class="save-plan-actions">
            <button ref="cancelBtn" class="btn-text" type="button" :disabled="deleting" @click="cancelDelete">Cancel</button>
            <button class="btn su-delete" type="button" :disabled="deleting" @click="confirmDelete">{{ deleting ? 'Deleting…' : 'Delete account' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
    <p class="st-foot">Last seen is the last time the account signed in or came back to the site. Activity counts the different days in the chosen range that the account did anything (a page opened, a button used), and the steps behind it: Very active is about 2 days in 5 or more, Regular is about 1 day in 7 or more. Browsers that send Do Not Track or Global Privacy Control, and team accounts, are not counted, so they can show as Quiet or Team.</p>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ApiError } from '@/api/client'
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

// The row menu: one popover for the whole table, placed beside the button that opened it (the table scrolls sideways, so it
// cannot live inside it).
const menu = ref(null)
const MENU_W = 190
function openMenu(account, event) {
  if (menu.value?.id === account.id) return closeMenu()
  const r = event.currentTarget.getBoundingClientRect()
  menu.value = { id: account.id, account, x: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)), y: r.bottom + 4 }
}
const closeMenu = () => (menu.value = null)
const onKey = (e) => e.key === 'Escape' && (emailing.value ? cancelEmail() : confirming.value ? cancelDelete() : closeMenu())
onMounted(() => {
  document.addEventListener('click', closeMenu)
  document.addEventListener('keydown', onKey)
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
})
function seeActivity() {
  const id = menu.value.id
  closeMenu()
  emit('go', `a:${id}`)
}

// The claim email, one account at a time: only for a confirmed email and no claimed player, and it asks first.
const emailing = ref(null)
const sendingEmail = ref(false)
const emailCancelBtn = ref(null)
const notice = ref(null)
const emailBlock = (a) => (a.team ? 'Team accounts do not get this email' : !a.verifiedAt ? 'Their email is not confirmed' : a.players.length ? 'They already claimed a player' : a.optedOut ? 'They unsubscribed from reminder emails' : '')
async function askEmail() {
  if (emailBlock(menu.value.account)) return
  emailing.value = menu.value.account
  closeMenu()
  await nextTick()
  emailCancelBtn.value?.focus()
}
function cancelEmail() {
  if (!sendingEmail.value) emailing.value = null
}
async function confirmEmail() {
  const target = emailing.value
  sendingEmail.value = true
  try {
    const r = await statsApi.sendClaimEmail(target.id)
    data.value = { ...data.value, accounts: data.value.accounts.map((a) => (a.id === target.id ? { ...a, nudgedAt: r.sentAt } : a)) }
    notice.value = { text: `Sent the claim email to ${target.email}.`, error: false }
  } catch (err) {
    notice.value = { text: err instanceof ApiError ? err.message : 'Could not send the email.', error: true }
  } finally {
    sendingEmail.value = false
    emailing.value = null
  }
}

// Deleting asks first, and says what goes with the account.
const confirming = ref(null)
const deleting = ref(false)
const deleteError = ref('')
const cancelBtn = ref(null)
async function askDelete() {
  if (menu.value.account.team) return
  confirming.value = menu.value.account
  deleteError.value = ''
  closeMenu()
  await nextTick()
  cancelBtn.value?.focus()
}
function cancelDelete() {
  if (!deleting.value) confirming.value = null
}
async function confirmDelete() {
  const target = confirming.value
  deleting.value = true
  deleteError.value = ''
  try {
    await statsApi.deleteAccount(target.id)
    data.value = { ...data.value, total: Math.max(0, data.value.total - 1), accounts: data.value.accounts.filter((a) => a.id !== target.id) }
    confirming.value = null
  } catch (err) {
    deleteError.value = err instanceof ApiError ? err.message : 'Could not delete the account.'
  } finally {
    deleting.value = false
  }
}

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-')
const longDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')
</script>
