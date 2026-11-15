<template>
  <div class="clan">
    <p v-if="loading" class="dash-loading">Loading the clan…</p>

    <section v-else-if="notFound" class="card clan-empty">
      <h1>Clan not found</h1>
      <p>That clan does not exist, or the link is wrong. Ask whoever shared it for the right one.</p>
      <RouterLink class="btn btn-primary" to="/">Back home</RouterLink>
    </section>

    <template v-else-if="view">
      <header class="card clan-head">
        <div class="clan-head-main">
          <p class="clan-kicker">Clan<span v-if="roleLabel" class="clan-role">{{ roleLabel }}</span></p>
          <h1>{{ view.clan.name }}</h1>
          <p v-if="view.clan.description" class="clan-desc">{{ view.clan.description }}</p>
          <p class="clan-meta">{{ view.members.length }} member{{ view.members.length === 1 ? '' : 's' }} · created {{ createdText }}</p>
        </div>
        <button class="btn btn-ghost" type="button" @click="copy(clansApi.pageUrl(view.clan.slug), 'Clan page link copied')">Copy page link</button>
      </header>

      <div class="clan-grid">
        <div class="clan-main">
          <!-- Competitions -->
          <section class="card clan-card" aria-labelledby="clan-comp-h">
            <header class="dash-card-head">
              <h2 id="clan-comp-h">Competitions</h2>
              <button v-if="view.viewer.canManage" class="btn btn-primary clan-start" type="button" @click="startOpen = true">Start a competition</button>
            </header>
            <p v-if="!view.competitions.length" class="dash-empty">{{ view.viewer.canManage ? 'No competitions yet. Start one and everyone in the clan takes part.' : 'No competitions yet.' }}</p>
            <ul v-else class="clan-comps">
              <li v-for="c in competitions" :key="c.id" class="clan-comp" :class="`is-${c.status}`">
                <RouterLink class="clan-comp-link" :to="{ name: 'competition', params: { id: c.id } }" :aria-label="`Open ${c.title}`">
                  <span class="clan-comp-icon" aria-hidden="true"><img :src="skillIconSrc(c.metric === 'overall_xp' ? 'Overall' : c.skill)" alt="" width="30" height="30" /></span>
                  <span class="clan-comp-body">
                    <span class="clan-comp-top">
                      <b>{{ c.title }}</b>
                      <span class="cmt-pill-status" :class="`is-${c.status}`"><i aria-hidden="true" />{{ statusLabel(c) }}</span>
                    </span>
                    <span class="clan-comp-tags">
                      <span class="cmt-tag">{{ metricLabel(c) }}</span>
                      <span class="cmt-tag">{{ c.entrants }} {{ c.entrants === 1 ? 'entrant' : 'entrants' }}</span>
                    </span>
                    <span class="clan-comp-when">
                      <span>{{ dayText(c.startsAt) }}</span>
                      <span class="clan-comp-arrow" aria-hidden="true">to</span>
                      <span>{{ dayText(c.endsAt) }}</span>
                    </span>
                    <span v-if="c.status === 'running'" class="clan-comp-track" aria-hidden="true"><i :style="{ width: `${progressOf(c)}%` }" /></span>
                    <span v-if="c.winners.length" class="clan-winner">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in RECORD_ICONS.trophy" :key="d" :d="d" /></svg>
                      {{ c.winners.map((w) => w.displayName).join(' and ') }} won with +{{ formatXp(c.winners[0].gain) }}
                    </span>
                  </span>
                  <span class="clan-comp-clock" :class="{ 'is-live': c.status === 'running' }">{{ clockText(c, now) }}</span>
                </RouterLink>
              </li>
            </ul>
          </section>

          <!-- Members -->
          <section class="card clan-card" aria-labelledby="clan-members-h">
            <header class="dash-card-head">
              <h2 id="clan-members-h">Members</h2>
              <span class="dash-hint">XP gained in the last 7 days</span>
            </header>
            <p v-if="!view.members.length" class="dash-empty">Nobody has joined yet. Share the invite link and the members show up here.</p>
            <ul v-else class="clan-members">
              <li v-for="(m, i) in view.members" :key="m.username" class="clan-member">
                <span class="clan-pos" aria-hidden="true">{{ i + 1 }}</span>
                <RouterLink class="clan-avatar" :to="profileRoute(m)" :aria-label="`Open ${m.displayName}'s profile`"><PlayerAvatar :name="m.username" /></RouterLink>
                <div class="clan-who">
                  <span class="clan-name">
                    <RouterLink :to="profileRoute(m)">{{ m.displayName }}</RouterLink>
                    <svg v-if="m.verified" class="clan-tick" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Verified owner"><title>Verified: this profile's owner joined</title><circle cx="12" cy="12" r="9.5" /><path d="M8 12.5l2.7 2.7L16 9.5" /></svg>
                    <span v-if="m.role === 'mod'" class="clan-chip">Mod</span>
                  </span>
                  <small>{{ m.overallLevel ? `Level ${m.overallLevel.toLocaleString('en-US')}` : 'Not synced yet' }}</small>
                </div>
                <span class="clan-gain" :class="{ 'is-up': m.weekGain > 0 }">{{ m.weekGain > 0 ? `+${formatXp(m.weekGain)}` : '-' }}</span>
                <span class="clan-actions">
                  <button v-if="view.viewer.role === 'owner' && (m.verified || m.role === 'mod')" class="btn-text" type="button" :title="m.role === 'mod' ? '' : 'Moderators can add and remove members and run competitions'" @click="toggleMod(m)">{{ m.role === 'mod' ? 'Remove mod' : 'Make mod' }}</button>
                  <button v-if="canRemove(m)" class="btn-text clan-remove" type="button" :disabled="busy" @click="remove(m)" @blur="confirming = ''">
                    {{ confirming === m.username ? (isMine(m) ? 'Leave?' : 'Remove?') : isMine(m) ? 'Leave' : 'Remove' }}
                  </button>
                </span>
              </li>
            </ul>
          </section>
        </div>

        <aside class="clan-side">
          <section v-if="view.viewer.canInvite && view.viewer.inviteToken" class="card clan-card" aria-labelledby="clan-invite-h">
            <h2 id="clan-invite-h">Invite people</h2>
            <p class="clan-note">Send the link, or share the card below. Anyone can join with their RuneScape name, no account needed.</p>
            <button class="clan-invite-card" type="button" aria-label="Open the invite card to share" @click="inviteOpen = true">
              <img :src="clansApi.inviteImageUrl(view.viewer.inviteToken)" :alt="`Invite card for ${view.clan.name}`" loading="lazy" />
            </button>
            <input class="clan-link" type="text" readonly :value="clansApi.inviteUrl(view.viewer.inviteToken)" aria-label="Invite link" @focus="$event.target.select()" />
            <div class="clan-btns">
              <button class="btn btn-primary" type="button" @click="copyInvite">Copy invite link</button>
              <button class="btn btn-ghost" type="button" @click="inviteOpen = true">Share card</button>
            </div>
            <button v-if="view.viewer.canManage" class="btn-text clan-newlink" type="button" :disabled="busy" @click="resetInvite" @blur="confirming = ''">{{ confirming === '@reset' ? 'The old link stops working. Sure?' : 'Make a new link' }}</button>
          </section>

          <section v-else-if="!view.viewer.role" class="card clan-card">
            <h2>Join this clan</h2>
            <p class="clan-note">Ask a member or the owner for the invite link, then open it and enter your RuneScape name.</p>
          </section>

          <section v-if="view.viewer.role === 'owner'" class="card clan-card clan-danger">
            <h2>Owner</h2>
            <p class="clan-note">Deleting the clan removes it for everyone, along with its competitions.</p>
            <button class="btn btn-ghost" type="button" :disabled="busy" @click="deleteClan" @blur="confirming = ''">{{ confirming === '@delete' ? 'Press again to delete it' : 'Delete clan' }}</button>
          </section>
        </aside>
      </div>
    </template>

    <ClanCompetitionModal v-if="startOpen && view" :clan="view.clan" @close="startOpen = false" @created="onCreated" />
    <ClanInviteModal v-if="inviteOpen && view?.viewer.inviteToken" :clan="view.clan" :token="view.viewer.inviteToken" @close="inviteOpen = false" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ClanCompetitionModal from '@/components/clans/ClanCompetitionModal.vue'
import ClanInviteModal from '@/components/clans/ClanInviteModal.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { ApiError } from '@/api/client'
import { clansApi } from '@/api/clans'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { track } from '@/utils/analytics'
import { clockText } from '@/utils/competitionForm'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { setPageMeta } from '@/utils/pageMeta'
import { RECORD_ICONS } from '@/utils/recordText'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()
const { profiles } = useAuth()

const view = ref(null)
const loading = ref(true)
const notFound = ref(false)
const busy = ref(false)
// A button that needs a second press to act holds its key here until pressed again or left.
const confirming = ref('')
const inviteOpen = ref(false)
const startOpen = ref(false)

async function load() {
  try {
    view.value = await clansApi.get(route.params.slug)
    notFound.value = false
    setPageMeta({ title: view.value.clan.name, description: `${view.value.clan.name}, a clan on TickGains.`, path: `/clans/${view.value.clan.slug}`, noindex: true })
  } catch (err) {
    view.value = null
    notFound.value = err instanceof ApiError && err.status === 404
    if (!notFound.value) showToast('Could not load the clan right now.')
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => route.params.slug, () => {
  loading.value = true
  load()
})

const roleLabel = computed(() => ({ owner: 'Owner', mod: 'Moderator', member: 'Member' })[view.value?.viewer.role] || '')
const createdText = computed(() => new Date(view.value.clan.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))
const profileRoute = (m) => ({ name: 'playerDetail', params: { username: m.username } })

// Members the signed-in account owns (it can take them out of the clan).
const isMine = (m) => profiles.value.some((p) => p.username.toLowerCase() === m.username.toLowerCase())
const canRemove = (m) => {
  const role = view.value.viewer.role
  return isMine(m) || role === 'owner' || (role === 'mod' && m.role !== 'mod')
}

const message = (err) => (err instanceof ApiError ? err.message : 'Something went wrong, please try again.')

async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(done)
    track('clan_link_copy', { what: done.includes('Invite') ? 'invite' : 'page' })
  } catch {
    showToast('Could not copy. Select the link and copy it by hand.')
  }
}

// A new competition opens on its own page.
function onCreated(competition) {
  startOpen.value = false
  showToast(`"${competition.title}" is set up.`)
  router.push({ name: 'competition', params: { id: competition.id } })
}

async function copyInvite() {
  track('clan_share', { method: 'copy_link' })
  await copy(clansApi.inviteUrl(view.value.viewer.inviteToken), 'Invite link copied')
}

// Each risky action asks for a second press.
async function act(key, fn, doneText) {
  if (confirming.value !== key) {
    confirming.value = key
    return false
  }
  confirming.value = ''
  busy.value = true
  try {
    await fn()
    if (doneText) showToast(doneText)
    return true
  } catch (err) {
    showToast(message(err))
    return false
  } finally {
    busy.value = false
  }
}
async function remove(m) {
  const ok = await act(m.username, () => clansApi.remove(view.value.clan.slug, m.username), isMine(m) ? 'You left the clan.' : `${m.displayName} was removed.`)
  if (ok) await load()
}
async function toggleMod(m) {
  busy.value = true
  try {
    await clansApi.setModerator(view.value.clan.slug, m.username, m.role !== 'mod')
    await load()
  } catch (err) {
    showToast(message(err))
  } finally {
    busy.value = false
  }
}
async function resetInvite() {
  const ok = await act('@reset', () => clansApi.resetInvite(view.value.clan.slug), 'New invite link made.')
  if (ok) await load()
}
async function deleteClan() {
  const ok = await act('@delete', () => clansApi.delete(view.value.clan.slug), 'Clan deleted.')
  if (ok) router.push({ name: 'clans' })
}

// --- competitions ---------------------------------------------------------------------------------------------------
const metricLabel = (c) => (c.metric === 'overall_xp' ? 'Overall XP' : `${c.skill} XP`)
const dateText = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
// Running first, then the next to start, then the ones that are over (newest first).
const ORDER = { running: 0, scheduled: 1, finished: 2, cancelled: 3 }
const competitions = computed(() =>
  [...(view.value?.competitions || [])].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.status === 'scheduled' ? new Date(a.startsAt) - new Date(b.startsAt) : new Date(b.startsAt) - new Date(a.startsAt))),
)
const dayText = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(new Date(d).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
// A ticking clock for the countdowns, and how far through a running competition is.
const now = ref(Date.now())
let ticker = null
onMounted(() => (ticker = setInterval(() => (now.value = Date.now()), 30_000)))
onBeforeUnmount(() => clearInterval(ticker))
const progressOf = (c) => {
  const start = new Date(c.startsAt).getTime()
  const end = new Date(c.endsAt).getTime()
  return Math.min(Math.max(((now.value - start) / (end - start)) * 100, 0), 100)
}
const statusLabel = (c) => ({ scheduled: 'Upcoming', running: 'Running', finished: 'Finished', cancelled: 'Cancelled' })[c.status] || c.status
</script>
