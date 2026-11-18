<template>
  <div class="ppb">
    <div v-if="player && !editing" class="pt-player">
      <RouterLink class="pt-avatar pt-profile-link" :to="{ name: 'playerDetail', params: { username: player.username } }" :aria-label="`Open ${player.displayName}'s profile`"><PlayerAvatar :name="player.username" /></RouterLink>
      <div class="pt-player-main">
        <RouterLink class="pt-name" :to="{ name: 'playerDetail', params: { username: player.username } }">{{ player.displayName }}</RouterLink>
        <span class="pt-stats">
          <span class="ovr"><img class="ovr-ic" :src="skillIconSrc('Overall')" alt="" width="16" height="16" />Overall <i>{{ player.latest.overallLevel.toLocaleString('en-US') }}</i></span>
          <span><i>{{ formatNum(player.latest.overallXp) }}</i> XP</span>
          <span>Updated {{ formatRelative(player.latest.capturedAt) }}</span>
        </span>
      </div>
      <div class="pt-player-actions">
        <button class="pt-link" type="button" @click="$emit('change')">Change</button>
      </div>
    </div>
    <template v-else>
      <div class="suggest-wrap pt-find">
        <form class="add-player-form" autocomplete="off" @submit.prevent="$emit('submit')">
          <svg class="pt-find-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input :value="username" type="search" name="osrs-player-lookup" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="Enter your OSRS username" autocomplete="off" maxlength="12" :disabled="lookingUp" data-1p-ignore data-lpignore="true" @input="$emit('update:username', $event.target.value)" @focus="$emit('focus')" @blur="$emit('blur')" />
        </form>
        <RecentPlayers v-if="showRecent" @pick="(p) => $emit('pick', p)" />
        <ul v-if="suggestions.length" class="search-suggest">
          <li class="suggest-head">Already tracked</li>
          <li v-for="sg in suggestions" :key="sg.username">
            <a href="#" class="suggest-row" @click.prevent="$emit('pick', sg)"><PlayerSuggestRow :player="sg" /></a>
          </li>
        </ul>
      </div>
      <p v-if="lookupError" class="planner-error">{{ lookupError }} You can still plan without a name.</p>
      <slot v-else name="hint">
        <p v-if="lookingUp" class="pt-hint">Loading stats…</p>
        <p v-else class="pt-hint">Press Enter to load a player<template v-if="player"> · <button class="btn-text" type="button" @click="$emit('cancel')">Cancel</button></template></p>
      </slot>
    </template>
  </div>
</template>

<script setup>
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import PlayerSuggestRow from '@/components/PlayerSuggestRow.vue'
import RecentPlayers from '@/components/RecentPlayers.vue'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatNum } from '@/utils/planner'
import { formatRelative } from '@/utils/time'

// The "who is this plan for" box: the loaded player, or a name search. All the state lives in the page.
defineProps({
  player: { type: Object, default: null },
  editing: { type: Boolean, default: false },
  username: { type: String, default: '' },
  lookingUp: { type: Boolean, default: false },
  lookupError: { type: String, default: '' },
  suggestions: { type: Array, default: () => [] },
  showRecent: { type: Boolean, default: false },
})
defineEmits(['update:username', 'submit', 'change', 'cancel', 'pick', 'focus', 'blur'])
</script>
