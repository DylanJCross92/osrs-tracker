<template>
  <article class="clan-mine">
    <header class="clan-mine-head">
      <RouterLink class="clan-mine-name" :to="{ name: 'clan', params: { slug: clan.slug } }">{{ clan.name }}</RouterLink>
      <span class="clan-mine-tags">
        <RouterLink v-if="clan.pendingRequests" class="clan-status is-scheduled clan-reqchip" :to="{ name: 'clan', params: { slug: clan.slug } }">{{ clan.pendingRequests }} {{ clan.pendingRequests === 1 ? 'request' : 'requests' }}</RouterLink>
        <span class="clan-chip">{{ ROLE_LABELS[clan.role] }}</span>
      </span>
    </header>
    <p class="clan-mine-stats">
      <span><b>{{ clan.memberCount }}</b> member{{ clan.memberCount === 1 ? '' : 's' }}</span>
      <span :class="{ 'stat-gain': clan.weekGain > 0 }"><b>{{ clan.weekGain > 0 ? `+${formatXp(clan.weekGain)}` : '-' }}</b> XP this week</span>
    </p>

    <ul v-if="clan.competitions.length" class="clan-mine-comps">
      <li v-for="c in clan.competitions" :key="c.id">
        <RouterLink class="clan-mine-comp" :to="{ name: 'competition', params: { id: c.id } }">
          <span class="clan-mine-comp-ico" aria-hidden="true"><img :src="skillIconSrc(skillOf(c))" alt="" width="22" height="22" /></span>
          <span class="clan-mine-comp-text">
            <span class="clan-mine-comp-top">
              <b>{{ c.title }}</b>
              <span class="clan-status" :class="c.status === 'running' ? 'is-running' : 'is-scheduled'">{{ c.status === 'running' ? 'Running' : 'Upcoming' }}</span>
            </span>
            <small>{{ c.label }} · {{ c.entrants }} {{ c.entrants === 1 ? 'member' : 'members' }}</small>
            <small class="clan-mine-when"><span>{{ dayText(c.startsAt) }}, {{ timeText(c.startsAt) }}</span> <span class="clan-mine-to">to {{ dayText(c.endsAt) }}, {{ timeText(c.endsAt) }}</span></small>
          </span>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="clan-mine-none">
      No competition on.
      <RouterLink v-if="clan.role !== 'member'" :to="{ name: 'clan', params: { slug: clan.slug } }">Start one</RouterLink>
    </p>

    <div v-if="clan.topMembers.length" class="clans-card-people">
      <span class="clans-faces">
        <span v-for="m in clan.topMembers" :key="m.username" class="clans-face" :title="m.displayName"><PlayerAvatar :name="m.username" /></span>
      </span>
      <span class="clans-names">{{ clan.topMembers.map((m) => m.displayName).join(', ') }}<template v-if="clan.memberCount > clan.topMembers.length"> and {{ clan.memberCount - clan.topMembers.length }} more</template></span>
    </div>
  </article>
</template>

<script setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'

defineProps({ clan: { type: Object, required: true } })
// The skill behind a label such as "Agility XP" (or "Overall XP"), for its icon.
const skillOf = (c) => String(c.label || '').replace(/ XP$/, '') || 'Overall'
const dayText = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(new Date(d).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
const timeText = (d) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const ROLE_LABELS = { owner: 'Owner', mod: 'Moderator', member: 'Member' }
</script>
