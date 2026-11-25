<template>
  <div class="card detail-header">
    <div class="profile-banner">
      <a href="#" class="btn-text back-link" @click.prevent="router.push({ name: 'players' })">← Home</a>
      <div class="banner-right">
      <div class="detail-buttons banner-actions">
          <button
            v-if="player?.womImportStatus === 'none'"
            class="btn btn-ghost"
            :disabled="checkingWomHistory"
            @click="checkWomHistory"
          >
            {{ checkingWomHistory ? 'Checking…' : 'Check for Historical' }}
          </button>
          <RouterLink v-if="player && !isHardcore" class="btn btn-ghost" :to="compareLink" @click="track('compare_open', { source: 'profile' })">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4" /></svg>
            Compare
          </RouterLink>
          <button v-if="player && !isHardcore && isProfileOwner" class="btn btn-ghost" type="button" @click="customizeOpen = true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
            Customize
          </button>
          <button v-if="player && !isHardcore && !isProfileOwner" class="btn btn-ghost" :class="{ 'is-following': isFollowing(player.displayName) }" type="button" :aria-pressed="isFollowing(player.displayName)" :title="loggedIn || isFollowing(player.displayName) ? '' : 'Following needs a free account'" @click="toggleFollow">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.6-9.3-9.1C1.1 8.7 3 5 6.4 5c2 0 3.4 1.1 4.2 2.4h2.8C14.2 6.1 15.6 5 17.6 5 21 5 22.9 8.7 21.3 11.9 19 16.4 12 21 12 21z" /></svg>
            {{ isFollowing(player.displayName) ? 'Following' : 'Follow' }}
            <svg v-if="!loggedIn && !isFollowing(player.displayName)" class="btn-lock" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-label="Needs a free account"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
          </button>
          <button v-if="player && !isHardcore && claim && !claim.claimed" class="btn btn-ghost" @click="openClaim">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
            {{ claim.mine === 'pending' ? 'Finish claim' : 'Claim' }}
          </button>
          <button v-if="!isHardcore" class="btn btn-ghost" :disabled="!player" @click="openChallenge('header')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2" /></svg>
            Challenge
          </button>
          <button v-if="!isHardcore" class="btn btn-ghost" :disabled="!player" @click="shareModalOpen = true; track('share_card_open')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.7l6.8-4M8.6 13.3l6.8 4" /></svg>
            Share
          </button>
      </div>
      <p v-if="latest" class="last-synced banner-sync">
        <span :title="`Last checked ${formatRelative(player?.lastCheckedAt || latest.capturedAt)}`">Updated {{ lastXpAt ? formatRelative(lastXpAt) : 'never (no XP gained yet)' }}</span>
        <span v-if="checkingForUpdates" class="checking-indicator">
          <span class="spinner" /> Checking for updates…
        </span>
        <button class="refresh-icon" :class="{ 'is-spinning': refreshing }" type="button" :title="refreshing ? 'Syncing…' : 'Refresh from the OSRS hiscores'" :aria-label="refreshing ? 'Syncing' : 'Refresh now'" :disabled="refreshing || !player" @click="refresh">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 11-2.6-5.9" /><path d="M20 4v5h-5" /></svg>
        </button>
      </p>
      </div>
    </div>
    <div class="detail-body">
      <div class="pa">
        <div class="profile-avatar" aria-hidden="true">
          <PlayerAvatar :name="player?.username || usernameParam" />
        </div>
        <CombatBadge :skills="latest?.skills" />
      </div>
      <div class="detail-info">
        <h1 class="detail-name">{{ player?.displayName || usernameParam }}<PlayerBadge :label="player?.badge" :claimed="!!claim?.claimed" :mine="claim?.mine === 'owner'" /><HardcoreTag v-if="isHardcore" class="hw-tag-lg" /></h1>
        <AccountBadge :build="page.build" :iron-kind="page.ironKind" />
        <WorldSwitch v-if="hardcore && mainPlayer" :world="world" :character="hardcore" :rank="Number(hardcorePlayer?.latest?.overallRank) || 0" @update:world="setWorld" />
        <div v-if="followCounts || profile" class="pp-meta">
          <p v-if="followCounts" class="pp-follows" aria-label="Followers and following">
            <span><b>{{ formatCount(followCounts.followers) }}</b> {{ followCounts.followers === 1 ? 'follower' : 'followers' }}</span>
            <span><b>{{ formatCount(followCounts.following) }}</b> following</span>
          </p>
          <ProfileFlair v-if="profile" :streak="profile.streak" :achievements="profile.achievements" :pinned-key="page.pinnedAchievement || ''" @open-achievements="setTab('achievements')" />
        </div>
        <p v-if="page.bio" class="pp-bio">{{ page.bio }}</p>
        <ul v-if="page.links.length" class="pp-links">
          <li v-for="l in page.links" :key="l.url"><a :href="l.url" target="_blank" rel="noopener nofollow ugc">{{ LINK_LABELS[l.kind] || l.kind }}</a></li>
        </ul>
        <button v-if="headerGoal" type="button" class="pp-goal" @click="setTab('goals')" :aria-label="`Goal: ${headerGoal.title}, ${headerGoal.percent} percent. Open goals`">
          <span class="pp-goal-label">Goal</span>
          <b>{{ headerGoal.title }}</b>
          <span class="pp-goal-bar"><i :style="{ width: headerGoal.percent + '%' }" /></span>
          <span class="pp-goal-pct">{{ headerGoal.percent }}%</span>
        </button>
        <div v-if="latest" class="profile-chips" :class="{ 'has-world': hardcore && mainPlayer }">
          <span><img :src="skillIconSrc('Overall')" alt="" width="16" height="16" />Overall <b>{{ latest.overallLevel.toLocaleString('en-US') }}</b></span>
          <span>Total XP <b>{{ latest.overallXp.toLocaleString('en-US') }}</b></span>
          <span v-if="latest.overallRank > 0">Rank <b>{{ latest.overallRank.toLocaleString('en-US') }}</b></span>
          <span v-if="topSkill"><img :src="skillIconSrc(topSkill.skill)" :alt="topSkill.skill" width="16" height="16" />Highest <b>{{ topSkill.skill }} {{ topSkill.level }}</b></span>
        </div>
      </div>
      <div class="detail-side">
        <XpSparkline v-if="weekDays.length" :days="weekDays" @select="(d) => (recapDay = d)" />
      </div>
    </div>
  </div>

  <DayRecapModal v-if="recapDay && player" :day="recapDay" :days="weekDays" :username="player.username" :display-name="player.displayName" @close="recapDay = null" @records="recapDay = null; setTab('records')" />
  <QuickPlannerModal v-if="plannerSkill && latest" :skill="plannerSkill" :xp="xpForSkill(latest, plannerSkill)" :username="player?.username || usernameParam" @close="plannerSkill = ''" />
  <GoalShareModal v-if="shareGoal && player" :username="player.username" :display-name="player.displayName" :goal="shareGoal" @close="shareGoal = null" />
  <CustomizeProfileModal v-if="customizeOpen && player && isProfileOwner" :username="player.username" :page="page" :achievements="profile?.achievements || []" @saved="(p) => (page = p)" @close="customizeOpen = false" />
  <ClaimProfileModal v-if="claimOpen && player && claim" :username="player.username" :display-name="player.displayName" :state="claim" :logged-in="loggedIn" @update="(c) => (claim = c)" @close="claimOpen = false" />
  <ChallengeModal v-if="challengeOpen && player" :username="player.username" :display-name="player.displayName" :week-xp="weekGainXp" :source="challengeSource" @close="challengeOpen = false" />
  <Level99ShareModal v-if="share99Skill && player" :username="player.username" :display-name="player.displayName" :skill="share99Skill" :preview="fakeNinetyNine.length > 0" @close="share99Skill = ''" />
  <ShareCardModal v-if="shareModalOpen && player" :username="player.username" :initial-skill="shareSkill" @close="shareModalOpen = false" />

  <ProfileCelebrations v-if="player && shownCelebrations.length" :player-id="player.id" :name="player.displayName" :celebrations="shownCelebrations" @share="openShare" @share99="(skill) => (share99Skill = skill)" />

  <div v-if="isImportingWomHistory" class="card wom-import-banner">
    <span class="spinner" />
    <p>Still importing historical data from Wise Old Man, the chart and table below will fill in as it finds more.</p>
  </div>

  <PageSkeleton v-if="loading" kind="profile" />

  <template v-else-if="snapshots.length">
    <nav class="profile-tabs" aria-label="Profile sections">
      <button v-for="t in visibleTabs" :key="t.key" :class="{ active: tab === t.key }" @click="setTab(t.key)">{{ t.label }}</button>
    </nav>
    <div v-if="isHardcore && hardcore" class="hl-wrap"><HardcoreLives :character="hardcore" /></div>
    <ProfileOverview v-if="tab === 'overview'" :player="player" :snapshots="snapshots" :profile="profile" :week-days="weekDays" @view-history="setTab('history')" @day="(d) => (recapDay = d)" @skill="openPlanner" @records="setTab('records')" @challenge="openChallenge('overview')" />
    <ProfileAchievements v-else-if="tab === 'achievements'" :profile="profile" />
    <ProfileRecords v-else-if="tab === 'records'" :player="player" />
    <template v-else-if="tab === 'goals'">
      <ProfileGoalsPublic :username="player.username" :display-name="player.displayName" :goals="goals" :plan="goalPlan" :is-owner="isProfileOwner" :target-id="Number(route.query.goal) || null" @update="(g) => (goals = g)" @share="(g) => (shareGoal = g)" />
    </template>
    <ProfileHistory v-else-if="tab === 'history'" :profile="profile" :snapshots="snapshots" @share99="(skill) => (share99Skill = skill)" />
    <template v-else>
    <div class="stats-toolbar">
      <label class="period-select">
        <span class="period-select-label">Show gains for</span>
        <select v-model="period">
          <option value="day">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </label>
    </div>
    <div class="card hiscores-panel">
      <table class="hiscores-table">
        <thead>
          <tr>
            <th class="hs-skill-col">Skill</th>
            <th>Rank</th>
            <th>Level</th>
            <th>Experience</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="skill in HISCORES_SKILL_ORDER"
            :key="skill"
            class="hiscores-row"
            :class="{ 'hiscores-row-static': skill === 'Overall' }"
            :tabindex="skill === 'Overall' ? -1 : 0"
            :role="skill === 'Overall' ? undefined : 'button'"
            :aria-haspopup="skill === 'Overall' ? undefined : 'dialog'"
            @click="openPlanner(skill)"
            @keydown.enter="openPlanner(skill)"
            @keydown.space.prevent="openPlanner(skill)"
          >
            <td class="hs-skill-col">
              <span class="skill-cell">
                <img class="skill-icon" :src="skillIconSrc(skill)" :alt="skill" width="16" height="16" />
                <span class="skill-name">{{ skill }}</span>
                <span v-if="newMilestones[skill]" class="new-milestone" :title="`Reached ${newMilestones[skill].title} in the last 2 days`">New {{ newMilestones[skill].short }}</span>
              </span>
            </td>
            <td>
              <span
                v-if="periodRankGains[skill] > 0"
                class="xp-delta"
                :title="`Climbed ${periodRankGains[skill].toLocaleString('en-US')} ranks ${periodPhrase}`"
              >
                +{{ formatXp(periodRankGains[skill]) }}
              </span>
              {{ rankLabel(rankForSkill(latest, skill)) }}
            </td>
            <td>
              <span v-if="periodLevelGains[skill] > 0" class="xp-delta" :title="`+${periodLevelGains[skill]} levels ${periodPhrase}`">
                +{{ periodLevelGains[skill] }}
              </span>
              {{ levelForSkill(latest, skill).toLocaleString('en-US') }}
            </td>
            <td class="hs-xp-col">
              <span v-if="periodXpGains[skill] > 0" class="xp-delta" :title="`+${periodXpGains[skill].toLocaleString('en-US')} xp ${periodPhrase}`">
                +{{ formatXp(periodXpGains[skill]) }}
              </span>
              {{ xpForSkill(latest, skill).toLocaleString('en-US') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>


    <div class="gain-tiles">
      <div class="card gain-tile">
        <span class="stat-label">{{ selectedSkill }} gained today</span>
        <span class="stat-value stat-gain">{{ formatSignedXp(gain('day')) }}</span>
      </div>
      <div class="card gain-tile">
        <span class="stat-label">{{ selectedSkill }} gained this week</span>
        <span class="stat-value stat-gain">{{ formatSignedXp(gain('week')) }}</span>
      </div>
      <div class="card gain-tile">
        <span class="stat-label">{{ selectedSkill }} gained this month</span>
        <span class="stat-value stat-gain">{{ formatSignedXp(gain('month')) }}</span>
      </div>
    </div>

    <div class="card">
      <div class="chart-header">
        <h2>{{ selectedSkill }} XP over time</h2>
      </div>
      <XpLineChart :points="chartPoints" :aria-label="`${selectedSkill} experience over time`" />
      <button class="btn-text table-toggle" @click="showTable = !showTable; track('profile_table_toggle', { open: showTable })">
        {{ showTable ? 'Hide' : 'Show' }} data table
      </button>
      <div v-if="showTable" class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="day-toggle-col"></th>
              <th>Updated</th>
              <th>Rank</th>
              <th>Rank Gained</th>
              <th>Level</th>
              <th>Lvl Gained</th>
              <th>XP</th>
              <th>XP Gained</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="month in monthGroups" :key="month.key">
              <tr
                v-if="showMonthGrouping"
                class="month-row"
                tabindex="0"
                role="button"
                :aria-expanded="expandedMonths.has(month.key)"
                @click="toggleMonth(month.key)"
                @keydown.enter="toggleMonth(month.key)"
                @keydown.space.prevent="toggleMonth(month.key)"
              >
                <td class="day-toggle-col">
                  <span class="chevron" :class="{ open: expandedMonths.has(month.key) }">▸</span>
                </td>
                <td>{{ month.label }} <span class="day-row-count">({{ month.days.length }} day{{ month.days.length === 1 ? '' : 's' }})</span></td>
                <td>{{ rankLabel(month.rank) }}</td>
                <td :class="{ 'stat-gain': month.rankGain > 0 }">{{ month.rankGain != null ? formatSignedXp(month.rankGain) : '--' }}</td>
                <td>{{ month.level?.toLocaleString('en-US') }}</td>
                <td :class="{ 'stat-gain': month.levelGain > 0 }">{{ month.levelGain != null ? formatSignedXp(month.levelGain) : '--' }}</td>
                <td>{{ month.xp.toLocaleString('en-US') }}</td>
                <td :class="{ 'stat-gain': month.xpGain > 0 }">{{ month.xpGain != null ? formatSignedXp(month.xpGain) : '--' }}</td>
              </tr>
              <template v-if="!showMonthGrouping || expandedMonths.has(month.key)">
                <template v-for="group in month.days" :key="group.key">
                  <tr
                    class="day-row"
                    :class="{ 'day-row-nested': showMonthGrouping }"
                    tabindex="0"
                    role="button"
                    :aria-expanded="expandedDays.has(group.key)"
                    @click="toggleDay(group.key)"
                    @keydown.enter="toggleDay(group.key)"
                    @keydown.space.prevent="toggleDay(group.key)"
                  >
                    <td class="day-toggle-col">
                      <span class="chevron" :class="{ open: expandedDays.has(group.key) }">▸</span>
                    </td>
                    <td>{{ group.label }} <span class="day-row-count">({{ group.rows.length }})</span></td>
                    <td>{{ rankLabel(group.rank) }}</td>
                    <td :class="{ 'stat-gain': group.rankGain > 0 }">{{ group.rankGain != null ? formatSignedXp(group.rankGain) : '--' }}</td>
                    <td>{{ group.level?.toLocaleString('en-US') }}</td>
                    <td :class="{ 'stat-gain': group.levelGain > 0 }">{{ group.levelGain != null ? formatSignedXp(group.levelGain) : '--' }}</td>
                    <td>{{ group.xp.toLocaleString('en-US') }}</td>
                    <td :class="{ 'stat-gain': group.xpGain > 0 }">{{ group.xpGain != null ? formatSignedXp(group.xpGain) : '--' }}</td>
                  </tr>
                  <template v-if="expandedDays.has(group.key)">
                    <tr v-for="row in group.rows" :key="row.capturedAt" class="hour-row">
                      <td class="day-toggle-col"></td>
                      <td>{{ new Date(row.capturedAt).toLocaleString(undefined, { timeStyle: 'short' }) }}</td>
                      <td>{{ rankLabel(row.rank) }}</td>
                      <td :class="{ 'stat-gain': row.rankGain > 0 }">{{ row.rankGain != null ? formatSignedXp(row.rankGain) : '--' }}</td>
                      <td>{{ row.level?.toLocaleString('en-US') }}</td>
                      <td :class="{ 'stat-gain': row.levelGain > 0 }">{{ row.levelGain != null ? formatSignedXp(row.levelGain) : '--' }}</td>
                      <td>{{ row.xp.toLocaleString('en-US') }}</td>
                      <td :class="{ 'stat-gain': row.xpGain > 0 }">{{ row.xpGain != null ? formatSignedXp(row.xpGain) : '--' }}</td>
                    </tr>
                  </template>
                </template>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    </template>
  </template>

  <div v-else class="card">
    <p class="empty-hint">
      {{ player ? 'No snapshots yet for this player.' : `"${usernameParam}" isn't being tracked.` }}
    </p>
  </div>
</template>

<script setup>
import PageSkeleton from '@/components/PageSkeleton.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import CombatBadge from '@/components/CombatBadge.vue'
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayersStore } from '@/stores/players'
import { useToast } from '@/composables/useToast'
import { useGainPeriod } from '@/composables/useGainPeriod'
import { useRivals } from '@/composables/useRivals'
import { formatRelative, withYearIfNotCurrent } from '@/utils/time'
import XpLineChart from '@/components/XpLineChart.vue'
import ShareCardModal from '@/components/ShareCardModal.vue'
import Level99ShareModal from '@/components/profile/Level99ShareModal.vue'
import ChallengeModal from '@/components/profile/ChallengeModal.vue'
import ClaimProfileModal from '@/components/profile/ClaimProfileModal.vue'
import CustomizeProfileModal from '@/components/profile/CustomizeProfileModal.vue'
import ProfileFlair from '@/components/profile/ProfileFlair.vue'
import AccountBadge from '@/components/profile/AccountBadge.vue'
import WorldSwitch from '@/components/profile/WorldSwitch.vue'
import HardcoreTag from '@/components/HardcoreTag.vue'
import HardcoreLives from '@/components/profile/HardcoreLives.vue'
import ProfileGoalsPublic from '@/components/profile/ProfileGoalsPublic.vue'
import GoalShareModal from '@/components/profile/GoalShareModal.vue'
import { goalsApi } from '@/api/goals'
import { profilePageApi } from '@/api/profilePage'
import { claimsApi } from '@/api/claims'
import { useFollowing } from '@/composables/useFollowing'
import { useAuth } from '@/composables/useAuth'
import ProfileCelebrations from '@/components/profile/ProfileCelebrations.vue'
import PlayerBadge from '@/components/PlayerBadge.vue'
import ProfileOverview from '@/components/profile/ProfileOverview.vue'
import ProfileAchievements from '@/components/profile/ProfileAchievements.vue'
import ProfileRecords from '@/components/profile/ProfileRecords.vue'
import ProfileHistory from '@/components/profile/ProfileHistory.vue'
import { playersApi } from '@/api/players'
import { highestSkill } from '@/utils/profile'
import { track } from '@/utils/analytics'
import { gameDay, startOfGameDay, recentGameDays, formatGameDay, gameMonthKey } from '@/utils/gameDay'
import { weekDaysFrom } from '@/utils/weekDays'
import XpSparkline from '@/components/profile/XpSparkline.vue'
import DayRecapModal from '@/components/profile/DayRecapModal.vue'
import {
  SKILL_NAMES,
  skillIconSrc,
  formatXp,
  formatSignedXp,
  xpForSkill,
  levelForSkill,
  rankForSkill,
  xpGain,
  levelGain,
  rankGain,
} from '@/utils/osrsSkills'
import QuickPlannerModal from '@/components/profile/QuickPlannerModal.vue'
import { setPageMeta } from '@/utils/pageMeta'

// Same order (and the same "Overall" row first) as the official OSRS
// hiscores table, not the in-game skills panel's 3-column layout.
const HISCORES_SKILL_ORDER = ['Overall', ...SKILL_NAMES]

const route = useRoute()
const router = useRouter()
const store = usePlayersStore()
const { showToast } = useToast()

// The URL carries the RSN rather than the numeric id, so it reads naturally
// (/player/Dylanz297), we still resolve it to the player's id client-side
// since the API itself is id-based.
const usernameParam = computed(() => route.params.username ?? '')
// Hardcore Worlds: a name can have a second character with its own hiscores table. ?world=hardcore shows it, with the same page and the same
// per-player data (it is just another tracked player), minus the things that belong to the person rather than the character.
const world = computed(() => (route.query.world === 'hardcore' ? 'hardcore' : 'main'))
// A name that only exists on Hardcore Worlds (no normal character is tracked) opens on its Hardcore Worlds character.
const hardcoreOnly = computed(() => !mainPlayer.value && !!hardcorePlayer.value)
const isHardcore = computed(() => world.value === 'hardcore' || hardcoreOnly.value)
const lower = (v) => String(v || '').toLowerCase()
const mainPlayer = computed(() => store.players.find((p) => lower(p.username) === lower(usernameParam.value)) ?? null)
const hardcorePlayer = computed(() => store.hardcorePlayers.find((p) => lower(p.username) === lower(usernameParam.value)) ?? null)
const player = computed(() => (isHardcore.value ? hardcorePlayer.value : mainPlayer.value))
const playerId = computed(() => player.value?.id ?? null)

// The name's Hardcore Worlds character, or null when it has none (looked for once a day on the server).
const hardcore = ref(null)
let hardcoreFor = ''
// Snapshots already fetched, by player id: switching between a name's characters shows the other one at once, with no skeleton and no jump in height.
const snapCache = new Map()
async function snapshotsFor(id) {
  const rows = await store.fetchSnapshots(id)
  snapCache.set(id, rows)
  return rows
}
function prefetchSnapshots(ids) {
  for (const id of ids) if (id && !snapCache.has(id)) snapshotsFor(id).catch(() => {})
}
async function loadHardcore() {
  const id = mainPlayer.value?.id ?? hardcorePlayer.value?.id
  // Only forget the last answer for a different name, so the switch stays put while it is refreshed.
  if (hardcoreFor !== lower(usernameParam.value)) hardcore.value = null
  hardcoreFor = lower(usernameParam.value)
  if (!id) return
  try {
    const { character } = await playersApi.hardcore(id)
    hardcore.value = character
    if (character) prefetchSnapshots([mainPlayer.value?.id, character.id])
    if (character && !store.hardcorePlayers.some((p) => p.id === character.id)) await store.loadHardcore()
  } catch {
    hardcore.value = null
  }
}
function setWorld(next) {
  const query = { ...route.query }
  if (next === 'hardcore') query.world = 'hardcore'
  else delete query.world
  delete query.tab
  router.replace({ query })
}

watch(
  [player, usernameParam],
  ([p, username]) => {
    const name = p?.displayName || username
    setPageMeta({
      title: `${name} | OSRS ${p?.mode === 'hardcore' ? 'Hardcore Worlds ' : ''}Player Profile`,
      description: `Explore ${name}'s Old School RuneScape stats, XP history, achievements, and progression on TickGains.`,
      path: `/player/${encodeURIComponent(username)}${p?.mode === 'hardcore' ? '?world=hardcore' : ''}`,
    })
  },
  { immediate: true },
)

// Compare opens against your saved name when you have one (and this is not you), otherwise with this player first.
const { me: myName } = useRivals()
const compareLink = computed(() => {
  const name = player.value?.username || usernameParam.value
  const mine = myName.value
  return mine && mine.toLowerCase() !== name.toLowerCase()
    ? `/compare/${encodeURIComponent(mine)}/${encodeURIComponent(name)}`
    : `/compare/${encodeURIComponent(name)}`
})

const isImportingWomHistory = computed(
  () => player.value?.womImportStatus === 'pending' || player.value?.womImportStatus === 'running',
)

// The store polls for Wise Old Man import status in the background (see
// stores/players.js), once it flips away from pending/running for this
// specific player, re-fetch their snapshots so the chart/table pick up
// whatever history just landed, without the user having to reload.
watch(
  () => player.value?.womImportStatus,
  (status, previousStatus) => {
    const wasImporting = previousStatus === 'pending' || previousStatus === 'running'
    if (!wasImporting || status !== 'done' || !playerId.value) return
    store
      .fetchSnapshots(playerId.value)
      .then((rows) => {
        snapshots.value = rows
      })
      .catch(() => {})
  },
)

const snapshots = ref([])

// --- profile tabs (kept in ?tab= so a tab is linkable; history.replaceState
// rather than router.replace so switching never scrolls the page to the top)
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'stats', label: 'Stats' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'records', label: 'Records' },
  { key: 'goals', label: 'Goals' },
  { key: 'history', label: 'History' },
]
// Records and goals belong to the person, not a character, so the Hardcore Worlds view leaves them out.
const visibleTabs = computed(() => (isHardcore.value ? TABS.filter((t) => !['records', 'goals'].includes(t.key)) : TABS))
const tab = ref(TABS.some((t) => t.key === route.query.tab) ? route.query.tab : 'overview')
function setTab(key) {
  tab.value = key
  track('profile_tab', { tab: key })
  const url = new URL(window.location.href)
  if (key === 'overview') url.searchParams.delete('tab')
  else url.searchParams.set('tab', key)
  window.history.replaceState(window.history.state, '', url)
}

const profile = ref(null)
async function loadProfile() {
  if (!playerId.value) return
  try {
    profile.value = await playersApi.profile(playerId.value)
  } catch {
    profile.value = null
  }
}
watch([playerId, () => snapshots.value.length], loadProfile, { immediate: true })

// Who follows this profile and who its owner follows. Counts only.
const followCounts = ref(null)
const formatCount = (n) => Number(n).toLocaleString('en-US')
// Followers belong to the person (the normal character's profile), so they stay the same whichever character is shown and never blink on a switch.
async function loadFollowCounts() {
  const id = mainPlayer.value?.id
  if (!id) return
  try {
    followCounts.value = await playersApi.followCounts(id)
  } catch {
    followCounts.value = null
  }
}
watch(() => mainPlayer.value?.id, (id, prev) => {
  if (!id || id !== prev) followCounts.value = null
  loadFollowCounts()
}, { immediate: true })
// One event per profile opened (not per refresh).
watch(
  playerId,
  (id, prev) => {
    if (id && id !== prev) track('profile_view', { tab: tab.value, source: document.referrer ? 'referrer' : 'direct' })
  },
  { immediate: true },
)

// XP gained per game day (6 AM to 6 AM Eastern) over the last 7 days, oldest first. Each snapshot's gain is
// credited to its own day, starting from the newest snapshot before the window, so the days add up to the
// same 7-day total as the stats table and a gap in older data can never be dumped onto one day.
const weekDays = computed(() => weekDaysFrom(trackedSnapshots.value))

// When new XP last arrived: the newest snapshot whose total XP is higher than
// the one before it. Rank-only changes don't count as an update.
const lastXpAt = computed(() => {
  const list = snapshots.value
  for (let i = list.length - 1; i > 0; i--) {
    if (list[i].overallXp > list[i - 1].overallXp) return list[i].capturedAt
  }
  return null
})

const topSkill = computed(() => highestSkill(snapshots.value[snapshots.value.length - 1]))

const loading = ref(true)
const refreshing = ref(false)
const checkingWomHistory = ref(false)
const shareModalOpen = ref(false)
const shareSkill = ref('Overall')
const { isFollowing, toggle: toggleFollowing } = useFollowing()
async function toggleFollow() {
  const name = player.value?.displayName
  if (!name) return
  const now = await toggleFollowing(name)
  // null: the visitor was asked to sign in, nothing changed.
  if (now === null) return
  track(now ? 'follow' : 'unfollow', { source: 'profile' })
  loadFollowCounts()
}
// How this profile relates to the signed-in visitor (claimed? owned by them?). Loaded below.
const claim = ref(null)
// What the owner added to this profile (bio, status, links, hidden tabs). Visitors get it too.
const blankPage = () => ({ bio: '', links: [], pinnedAchievement: null, hasAvatar: false, avatarV: null, build: 'main', ironKind: null })
const page = ref(blankPage())
const customizeOpen = ref(false)
// Public goals the owner set, with live progress; the pinned one shows in the header.
const goals = ref([])
const shareGoal = ref(null)
// The plan the owner shows on the profile (null when none): its name and overall progress.
const goalPlan = ref(null)
const pinnedGoal = computed(() => goals.value.find((g) => g.pinned && !g.fromPlan) || null)
// The header shows the plan when there is one, otherwise the goal pinned by hand.
const headerGoal = computed(() => (goalPlan.value ? { title: goalPlan.value.name, percent: goalPlan.value.percent } : pinnedGoal.value))
watch(
  () => player.value?.username,
  async (name) => {
    goals.value = []
    goalPlan.value = null
    if (!name) return
    try {
      const res = await goalsApi.list(name)
      goals.value = res.goals
      goalPlan.value = res.plan
    } catch {
      goals.value = []
      goalPlan.value = null
    }
  },
  { immediate: true },
)
const isProfileOwner = computed(() => claim.value?.mine === 'owner')
// Development only: ?fake99=agility,firemaking,runecrafting shows a fresh 99 in each of those skills (up to six, in that order) on any profile
// (nothing is saved), to watch the celebration. Names can be in any case; "runecrafting" works for Runecraft.
const fakeNinetyNine = import.meta.env.DEV
  ? String(route.query.fake99 || '')
      .split(/[,\s]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .map((x) => SKILL_NAMES.find((n) => n !== 'Overall' && n.toLowerCase() === x) || SKILL_NAMES.find((n) => n !== 'Overall' && x.startsWith(n.toLowerCase())) || '')
      .filter((n, i, all) => n && all.indexOf(n) === i)
      .slice(0, 6)
  : []
const shownCelebrations = computed(() => {
  const real = profile.value?.celebrations || []
  if (!fakeNinetyNine.length) return real
  const fakes = fakeNinetyNine.map((skill, i) => ({ type: 'skill_level', skill, value: 99, title: `99 ${skill}`, occurredAt: new Date(Date.now() - i * 60_000).toISOString(), cheers: 0, cheered: false }))
  return [...fakes, ...real]
})
const LINK_LABELS = { discord: 'Discord', twitch: 'Twitch', youtube: 'YouTube', twitter: 'X' }
watch(
  () => player.value?.username,
  async (name) => {
    page.value = blankPage()
    if (!name) return
    try {
      page.value = await profilePageApi.get(name)
    } catch {
      page.value = blankPage()
    }
  },
  { immediate: true },
)
const claimOpen = ref(false)
const { loggedIn } = useAuth()
function openClaim() {
  claimOpen.value = true
  track('claim_open', { signed_in: loggedIn.value })
}
// Whether this profile is claimed, and how it relates to the signed-in visitor. Reloaded on login or logout.
watch(
  [() => player.value?.username, loggedIn],
  async ([name]) => {
    claim.value = null
    if (!name) return
    try {
      claim.value = await claimsApi.get(name)
    } catch {
      claim.value = null
    }
  },
  { immediate: true },
)
const challengeOpen = ref(false)
const challengeSource = ref('header')
function openChallenge(source) {
  challengeSource.value = source
  challengeOpen.value = true
}
// The last 7 game days of XP, the same numbers the week strip shows.
const weekGainXp = computed(() => weekDays.value.reduce((sum, d) => sum + d.xp, 0))
const share99Skill = ref('')
function openShare(skill) {
  shareSkill.value = skill || 'Overall'
  shareModalOpen.value = true
  track('share_card_open', { source: 'celebration' })
}
// Skills with a 99 (or 200M XP) reached in the last 2 days get a small badge in the stats table.
const newMilestones = computed(() => {
  const out = {}
  for (const c of profile.value?.celebrations || []) {
    if (!c.skill || out[c.skill]) continue
    if (Date.now() - new Date(c.occurredAt).getTime() > 2 * 86_400_000) continue
    out[c.skill] = { title: c.title, short: c.type === 'skill_xp' ? '200M' : String(c.value) }
  }
  return out
})
const checkingForUpdates = ref(false)
const showTable = ref(false)
const selectedSkill = ref('Overall')
// Clicking a skill in the hiscores opens its quick planner in a modal; nothing else on the page changes.
const recapDay = ref(null)
const plannerSkill = ref('')
function openPlanner(skill) {
  if (skill === 'Overall') return
  track('profile_skill_planner', { skill })
  plannerSkill.value = skill
}

// A Hardcore Worlds character starts over when it resets: the page shows the life it is on now (earlier ones are in the Lives list).
const currentLife = (rows) => {
  if (!isHardcore.value || !rows.length) return rows
  const top = Math.max(...rows.map((r) => r.life || 1))
  return rows.filter((r) => (r.life || 1) === top)
}

async function load() {
  // Switching characters: what was already fetched shows straight away (and is refreshed below), so the page does not collapse into the skeleton.
  loading.value = !(playerId.value && snapCache.has(playerId.value))
  if (!store.loaded) await store.loadPlayers()
  // A name with no normal character might be a Hardcore Worlds one, so look there before saying it is not tracked.
  if ((isHardcore.value || !mainPlayer.value) && !store.hardcoreLoaded) await store.loadHardcore().catch(() => {})
  if (!tab.value || !visibleTabs.value.some((t) => t.key === tab.value)) tab.value = 'overview'
  loadHardcore()

  if (!playerId.value) {
    // Unknown RSN in the URL, nothing to fetch.
    snapshots.value = []
    loading.value = false
    return
  }

  try {
    const cached = snapCache.get(playerId.value)
    if (cached) snapshots.value = currentLife(cached)
    snapshots.value = currentLife(await snapshotsFor(playerId.value))
  } catch {
    showToast("Could not load this player's history.")
    snapshots.value = []
  } finally {
    loading.value = false
  }

  // Check for updates whenever this page loads, rather than only on the
  // hourly scheduler or a manual refresh. Runs after the saved data is
  // already showing, so a slow hiscores fetch never blocks the page,
  // snapshots.value is swapped in once the refresh completes.
  checkingForUpdates.value = true
  try {
    await store.refreshPlayer(playerId.value)
    snapshots.value = currentLife(await snapshotsFor(playerId.value))
    if (isHardcore.value) store.loadHardcore().catch(() => {})
  } catch {
    // Non-fatal, the page already has the last saved data.
  } finally {
    checkingForUpdates.value = false
  }
}
onMounted(load)

watch(() => [route.params.username, route.query.world], load)

const latest = computed(() => snapshots.value[snapshots.value.length - 1] ?? null)

// Dropdown above the hiscores table, which window its per-skill deltas
// show. "day" means the calendar day (resets at 6 AM Eastern), "week"/
// "month" are rolling 7/30-day windows. Shared across pages for the session.
const { period } = useGainPeriod()
watch(period, (p) => track('profile_gain_period', { period: p }))
const periodPhrase = computed(
  () => ({ day: 'today', week: 'in the last 7 days', month: 'in the last 30 days' })[period.value],
)

// Per-skill xp/level/rank gained over the selected period, computed once
// per snapshot load/period change rather than re-walking history on every
// row's render.
const periodXpGains = computed(() => buildGainMap(xpGain))
const periodLevelGains = computed(() => buildGainMap(levelGain))
const periodRankGains = computed(() => buildGainMap(rankGain))

// Gains only look at snapshots TickGains tracked itself. Imported history before the player was added is
// months apart and would turn a 7-day window into the whole gap.
const trackedSnapshots = computed(() => {
  const created = player.value?.createdAt ? new Date(player.value.createdAt).getTime() - 60_000 : null
  const list = created == null ? snapshots.value : snapshots.value.filter((s) => new Date(s.capturedAt).getTime() >= created)
  return list.length ? list : snapshots.value
})

function buildGainMap(gainFn) {
  const map = {}
  for (const skill of HISCORES_SKILL_ORDER) {
    map[skill] = gainFn(trackedSnapshots.value, skill, period.value)
  }
  return map
}

function rankLabel(rank) {
  return rank ? rank.toLocaleString('en-US') : '--'
}

function gain(gainPeriod) {
  return xpGain(trackedSnapshots.value, selectedSkill.value, gainPeriod)
}

// Same "no-gain snapshots dropped" rule as snapshotRows below, so the chart
// doesn't draw flat segments for refreshes that gained nothing in this skill.
const chartPoints = computed(() => {
  const list = snapshots.value
  return list
    .filter((s, i) => i === 0 || xpForSkill(s, selectedSkill.value) > xpForSkill(list[i - 1], selectedSkill.value))
    .map((s) => ({ x: new Date(s.capturedAt).getTime(), y: xpForSkill(s, selectedSkill.value) }))
})

// Per-refresh xp/level/rank gained (the breakdown behind the daily totals
// shown inline above), each row's delta from the snapshot before it,
// newest first. Refreshes that gained no xp for this skill are left out,
// they're not meaningful "updates" to show in the breakdown.
const snapshotRows = computed(() => {
  const list = snapshots.value
  return [...list]
    .map((s, i) => {
      const prev = i > 0 ? list[i - 1] : null
      const rank = rankForSkill(s, selectedSkill.value)
      const prevRank = prev ? rankForSkill(prev, selectedSkill.value) : null
      return {
        capturedAt: s.capturedAt,
        rank,
        rankGain: prev && rank != null && prevRank != null ? prevRank - rank : null,
        level: levelForSkill(s, selectedSkill.value),
        levelGain: prev ? levelForSkill(s, selectedSkill.value) - levelForSkill(prev, selectedSkill.value) : null,
        xp: xpForSkill(s, selectedSkill.value),
        xpGain: prev ? xpForSkill(s, selectedSkill.value) - xpForSkill(prev, selectedSkill.value) : null,
      }
    })
    .filter((row) => row.xpGain == null || row.xpGain > 0)
    .reverse()
})

// Same rows, bucketed by calendar day (newest day first, same as
// snapshotRows) with per-day totals summed from each row's own gain,
// rows stay newest-first within a day too, so a group's first row is
// always its end-of-day snapshot.
const groupedSnapshotRows = computed(() => {
  const groups = []
  const byDay = new Map()
  for (const row of snapshotRows.value) {
    const key = gameDay(row.capturedAt)
    let group = byDay.get(key)
    if (!group) {
      group = {
        key,
        label: formatGameDay(key, withYearIfNotCurrent(new Date(`${key}T12:00:00Z`), { weekday: 'short', month: 'short', day: 'numeric' })),
        rows: [],
        rank: row.rank,
        level: row.level,
        xp: row.xp,
        rankGain: null,
        levelGain: null,
        xpGain: null,
      }
      byDay.set(key, group)
      groups.push(group)
    }
    group.rows.push(row)
    if (row.rankGain != null) group.rankGain = (group.rankGain ?? 0) + row.rankGain
    if (row.levelGain != null) group.levelGain = (group.levelGain ?? 0) + row.levelGain
    if (row.xpGain != null) group.xpGain = (group.xpGain ?? 0) + row.xpGain
  }
  return groups
})

const expandedDays = ref(new Set())
function toggleDay(key) {
  const next = new Set(expandedDays.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedDays.value = next
}

// Day groups bucketed by calendar month (newest month first, same ordering
// as groupedSnapshotRows), only actually used as a collapsing level when
// there's data outside the current month, so a freshly-added player's
// table stays a flat day list instead of a single redundant month wrapper.
const monthGroups = computed(() => {
  const groups = []
  const byMonth = new Map()
  for (const day of groupedSnapshotRows.value) {
    const key = gameMonthKey(day.key)
    let group = byMonth.get(key)
    if (!group) {
      group = {
        key,
        label: formatGameDay(`${key}-01`, { month: 'long', year: 'numeric' }),
        days: [],
        rank: day.rank,
        level: day.level,
        xp: day.xp,
        rankGain: null,
        levelGain: null,
        xpGain: null,
      }
      byMonth.set(key, group)
      groups.push(group)
    }
    group.days.push(day)
    if (day.rankGain != null) group.rankGain = (group.rankGain ?? 0) + day.rankGain
    if (day.levelGain != null) group.levelGain = (group.levelGain ?? 0) + day.levelGain
    if (day.xpGain != null) group.xpGain = (group.xpGain ?? 0) + day.xpGain
  }
  return groups
})

const showMonthGrouping = computed(() => {
  if (monthGroups.value.length > 1) return true
  const onlyMonth = monthGroups.value[0]
  if (!onlyMonth) return false
  return onlyMonth.key !== gameMonthKey(gameDay(Date.now()))
})

const expandedMonths = ref(new Set())
function toggleMonth(key) {
  const next = new Set(expandedMonths.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedMonths.value = next
}

async function refresh() {
  track('profile_refresh')
  refreshing.value = true
  try {
    await store.refreshPlayer(playerId.value)
    snapshots.value = currentLife(await snapshotsFor(playerId.value))
    showToast('Synced the latest hiscores.')
  } catch {
    showToast('Could not refresh right now.')
  } finally {
    refreshing.value = false
  }
}

async function checkWomHistory() {
  track('profile_check_history')
  checkingWomHistory.value = true
  try {
    await store.checkWomHistory(playerId.value)
    showToast('Checking Wise Old Man for historical data in the background.')
  } catch {
    showToast('Could not start the Wise Old Man check right now.')
  } finally {
    checkingWomHistory.value = false
  }
}
</script>
