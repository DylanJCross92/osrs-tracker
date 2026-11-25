<template>
  <RouterLink class="cn-row" :to="{ name: 'clan', params: { slug: clan.slug } }">
    <span class="cn-row-faces" aria-hidden="true">
      <span v-for="m in clan.topMembers" :key="m.username" class="cn-row-face"><PlayerAvatar :name="m.username" /></span>
      <span v-if="!clan.topMembers.length" class="cn-row-face is-empty" />
    </span>

    <span class="cn-row-main">
      <span class="cn-row-name">
        <b>{{ clan.name }}</b>
        <i v-if="clan.role" class="cn-tag is-mine">{{ ROLE_LABELS[clan.role] }}</i>
        <i v-if="isNew" class="cn-tag">New</i>
        <i v-if="running" class="cn-tag is-live">Competition on</i>
      </span>
      <span class="cn-row-desc">{{ clan.description || 'No description yet.' }}</span>
    </span>

    <span class="cn-row-stats">
      <span><b>{{ clan.memberCount }}</b> {{ clan.memberCount === 1 ? 'member' : 'members' }}</span>
      <span :class="{ 'is-gain': clan.weekGain > 0 }"><b>{{ clan.weekGain > 0 ? `+${formatXp(clan.weekGain)}` : '-' }}</b> XP this week</span>
    </span>

    <span class="cn-row-go">
      <template v-if="clan.role">Open</template>
      <template v-else-if="clan.acceptingRequests">Ask to join</template>
      <template v-else>View</template>
      <i aria-hidden="true">→</i>
    </span>
  </RouterLink>
</template>

<script setup>
import { computed } from 'vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { formatXp } from '@/utils/osrsSkills'

// One clan in the directory on the Clans page: who is in it, how it is doing this week, and what you can do about it.
const ROLE_LABELS = { owner: 'Owner', mod: 'Moderator', member: 'Member' }
const props = defineProps({ clan: { type: Object, required: true } })

const running = computed(() => props.clan.competitions.some((x) => x.status === 'running'))
// A clan counts as new for its first two weeks.
const isNew = computed(() => Date.now() - new Date(props.clan.createdAt).getTime() < 14 * 86_400_000)
</script>
