<template>
  <RouterLink class="clans-card" :to="{ name: 'clan', params: { slug: clan.slug } }">
    <div class="clans-card-top">
      <b>{{ clan.name }}</b>
      <span class="clans-card-tags">
        <span v-if="clan.role" class="clan-chip is-mine">{{ ROLE_LABELS[clan.role] }}</span>
        <span v-if="clan.visibility && clan.visibility !== 'public'" class="clan-listed">Unlisted</span>
        <span v-if="isNew" class="clan-chip">New</span>
        <span v-if="running" class="clan-status is-running">Competition on</span>
      </span>
    </div>
    <p class="clans-card-desc">{{ clan.description || 'No description yet.' }}</p>
    <div class="clans-card-stats">
      <span><b>{{ clan.memberCount }}</b> member{{ clan.memberCount === 1 ? '' : 's' }}</span>
      <span v-if="clan.competitionTitle" :class="{ 'stat-gain': clan.competitionGain > 0 }"><b>{{ clan.competitionGain > 0 ? `+${formatXp(clan.competitionGain)}` : '0' }}</b> XP in {{ clan.competitionTitle }}</span>
      <span v-else :class="{ 'stat-gain': clan.weekGain > 0 }"><b>{{ clan.weekGain > 0 ? `+${formatXp(clan.weekGain)}` : '-' }}</b> XP this week</span>
    </div>
    <div v-if="clan.competitions.length" class="clans-card-comp">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-for="d in RECORD_ICONS.trophy" :key="d" :d="d" /></svg>
      <span>{{ clan.competitions[0].label }} · {{ clan.competitions[0].status === 'running' ? `ends ${shortDate(clan.competitions[0].endsAt)}` : `starts ${shortDate(clan.competitions[0].startsAt)}` }}</span>
    </div>
    <div v-if="clan.topMembers.length" class="clans-card-people">
      <span class="clans-faces">
        <span v-for="m in clan.topMembers" :key="m.username" class="clans-face" :title="m.displayName"><PlayerAvatar :name="m.username" /></span>
      </span>
      <span class="clans-names">{{ clan.topMembers.map((m) => m.displayName).join(', ') }}<template v-if="clan.memberCount > clan.topMembers.length"> and {{ clan.memberCount - clan.topMembers.length }} more</template></span>
    </div>
  </RouterLink>
</template>

<script setup>
import { computed } from 'vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { formatXp } from '@/utils/osrsSkills'
import { RECORD_ICONS } from '@/utils/recordText'

const ROLE_LABELS = { owner: 'Owner', mod: 'Moderator', member: 'Member' }
const props = defineProps({ clan: { type: Object, required: true } })

const running = computed(() => props.clan.competitions.some((x) => x.status === 'running'))
// A clan counts as new for its first two weeks.
const isNew = computed(() => Date.now() - new Date(props.clan.createdAt).getTime() < 14 * 86_400_000)
const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
</script>
