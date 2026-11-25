<template>
  <section id="race" class="cn-stage" aria-labelledby="cn-race-h">
    <div class="cn-stage-top">
      <p class="cn-eyebrow"><i class="cn-live" :class="{ on: live }" aria-hidden="true" />This week's race</p>
      <p v-if="weekly.current" class="cn-clock" :class="{ on: live }">{{ clockText(weekly.current, now) }}</p>
    </div>
    <h2 id="cn-race-h">The most overall XP wins</h2>
    <p class="cn-stage-sub">
      <template v-if="weekly.current">{{ range }} · </template>Open to every player<template v-if="weekly.current && weekly.current.entrants"> · {{ weekly.current.entrants }} racing</template>
    </p>

    <div class="cn-stage-body">
      <div class="cn-board">
        <ol v-if="weekly.top.length" class="cn-top">
          <li v-for="r in weekly.top" :key="r.username">
            <span class="cn-rank" :class="{ gold: r.rank === 1 }">{{ r.rank }}</span>
            <RouterLink class="cn-face" :to="{ name: 'playerDetail', params: { username: r.username } }" :aria-label="`Open ${r.displayName}'s profile`"><PlayerAvatar :name="r.username" /></RouterLink>
            <span class="cn-who">
              <RouterLink :to="{ name: 'playerDetail', params: { username: r.username } }">{{ r.displayName }}</RouterLink>
              <span class="cn-bar" aria-hidden="true"><i :style="{ width: barWidth(r.gain) }" /></span>
            </span>
            <b class="cn-gain">{{ r.gain > 0 ? `+${formatXp(r.gain)}` : '-' }}</b>
          </li>
        </ol>
        <!-- Nobody yet: the shape of the board with the first places waiting, so it reads as an invitation and not an empty box -->
        <ol v-else class="cn-top is-ghost" aria-label="The board is empty">
          <li v-for="n in 3" :key="n">
            <span class="cn-rank">{{ n }}</span>
            <span class="cn-face" aria-hidden="true" />
            <span class="cn-who"><span class="cn-ghost-name">{{ n === 1 ? 'Your name here' : 'Open place' }}</span><span class="cn-bar" aria-hidden="true"><i style="width: 0" /></span></span>
            <b class="cn-gain">-</b>
          </li>
        </ol>
      </div>

      <div class="cn-join">
        <h3>{{ youIn ? 'You are in the race' : 'Join the race' }}</h3>
        <p v-if="youIn">
          <template v-if="yourPlace">You are <b>number {{ yourPlace }}</b> right now. </template>Your XP counts from the moment you joined. Change the name to enter another player.
        </p>
        <p v-else>Add your RuneScape name and you are in. Your XP counts from the moment you join.</p>
        <ClanAskToJoin :slug="weekly.clan.slug" instant from="weekly" :members="weekly.members || []" @joined="$emit('joined')" />
      </div>
    </div>

    <div class="cn-stage-foot">
      <p v-if="weekly.last && weekly.last.winners.length">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" /></svg>
        <span>Last week's winner: <b>{{ weekly.last.winners.map((w) => w.displayName).join(' and ') }}</b>, +{{ formatXp(weekly.last.winners[0].gain) }} XP</span>
      </p>
      <p v-else class="cn-foot-muted">A new race starts every Monday.</p>
      <RouterLink v-if="weekly.current" class="cn-more" :to="{ name: 'competition', params: { id: weekly.current.id } }">Full board →</RouterLink>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import ClanAskToJoin from '@/components/clans/ClanAskToJoin.vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { useTrackerPlayer } from '@/composables/useTrackerPlayer'
import { clockText } from '@/utils/competitionForm'
import { formatXp } from '@/utils/osrsSkills'

// The site's own weekly XP race, the one featured panel on the Clans page: time left, who leads, and a box to join in one step.
const props = defineProps({ weekly: { type: Object, required: true } })
defineEmits(['joined'])

const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => clearInterval(timer))

// The player loaded in the join box (the visitor's own, once they have said who they are): are they already racing, and where do they stand?
const { player } = useTrackerPlayer()
const youIn = computed(() => Boolean(player.value && (props.weekly.members || []).includes(player.value.username.toLowerCase())))
const yourPlace = computed(() => (youIn.value ? props.weekly.top.find((r) => r.username.toLowerCase() === player.value.username.toLowerCase())?.rank || null : null))

const live = computed(() => props.weekly.current?.status === 'running')
const day = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
// The race ends at midnight, so the last day it counts is the one before.
const range = computed(() => (props.weekly.current ? `${day(props.weekly.current.startsAt)} to ${day(new Date(props.weekly.current.endsAt).getTime() - 3_600_000)}` : ''))
// Each leader's bar is measured against the one in front.
const barWidth = (gain) => {
  const lead = props.weekly.top[0]?.gain || 0
  return lead > 0 ? `${Math.max(Math.round((gain / lead) * 100), gain > 0 ? 4 : 0)}%` : '0'
}
</script>
