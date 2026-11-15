<template>
  <article class="clan-mine">
    <header class="clan-mine-head">
      <RouterLink class="clan-mine-name" :to="{ name: 'clan', params: { slug: clan.slug } }">{{ clan.name }}</RouterLink>
      <span class="clan-mine-tags">
        <span class="clan-chip">{{ ROLE_LABELS[clan.role] }}</span>
        <span v-if="clan.visibility !== 'public'" class="clan-listed">Unlisted</span>
      </span>
    </header>
    <p class="clan-mine-stats">
      <span><b>{{ clan.memberCount }}</b> member{{ clan.memberCount === 1 ? '' : 's' }}</span>
      <span :class="{ 'stat-gain': clan.weekGain > 0 }"><b>{{ clan.weekGain > 0 ? `+${formatXp(clan.weekGain)}` : '-' }}</b> XP this week</span>
    </p>

    <ul v-if="clan.competitions.length" class="clan-mine-comps">
      <li v-for="c in clan.competitions" :key="c.id">
        <RouterLink class="clan-mine-comp" :to="{ name: 'competition', params: { id: c.id } }">
          <span class="clan-mine-comp-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-for="d in RECORD_ICONS.trophy" :key="d" :d="d" /></svg></span>
          <span class="clan-mine-comp-text">
            <b>{{ c.title }}</b>
            <small>{{ c.label }} · {{ c.entrants }} {{ c.entrants === 1 ? 'entrant' : 'entrants' }}</small>
            <small>{{ fullDateTime(c.startsAt) }} to {{ fullDateTime(c.endsAt) }}</small>
          </span>
          <span class="clan-status" :class="c.status === 'running' ? 'is-running' : 'is-scheduled'">{{ c.status === 'running' ? 'Running' : 'Upcoming' }}</span>
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
import { fullDateTime } from '@/utils/competitionForm'
import { formatXp } from '@/utils/osrsSkills'
import { RECORD_ICONS } from '@/utils/recordText'

defineProps({ clan: { type: Object, required: true } })
const ROLE_LABELS = { owner: 'Owner', mod: 'Moderator', member: 'Member' }
</script>
