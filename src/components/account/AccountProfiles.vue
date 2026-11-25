<template>
  <section class="acp hub-card card" aria-labelledby="acp-h">
    <div class="acc-title"><h2 id="acp-h">Your profiles</h2></div>
    <p class="acc-note">The RuneScape profiles you own. Each profile's settings are used by the planner, the calculators and the Smart Planner whenever that profile is selected. Your main profile's settings are what everything starts from.</p>

    <p v-if="loading" class="acc-empty">Loading…</p>
    <template v-else>
      <div v-if="!verified.length" class="acp-none">
        <p class="acc-empty">No profile yet. Open a profile page and press Claim to make it yours; its settings appear here.</p>
        <RouterLink class="btn btn-primary" :to="{ name: 'players' }">Find your profile</RouterLink>
      </div>

      <ul v-else class="acp-list">
        <li v-for="c in verified" :key="c.id" class="acp-item">
          <div class="acp-head">
            <span class="ho-av"><PlayerAvatar :name="c.player.username" /></span>
            <div class="acp-id">
              <b>{{ c.player.displayName }}</b>
              <span class="claim-chip is-ok">Verified owner</span>
              <span v-if="isMain(c.player)" class="acp-main">Main profile</span>
              <button v-else type="button" class="btn-text" @click="makeMain(c.player)">Make this my main profile</button>
            </div>
            <div class="acp-links">
              <RouterLink :to="{ name: 'playerDetail', params: { username: c.player.username } }">Profile</RouterLink>
              <RouterLink :to="{ name: 'planner', query: { u: c.player.username } }">Planner</RouterLink>
            </div>
          </div>

          <div class="acp-settings">
            <AccountTypeToggle
              :model-value="of(c.player).members"
              :iron="of(c.player).iron"
              @update:model-value="(v) => change(c.player, { members: v })"
              @update:iron="(v) => change(c.player, { iron: v })"
            />
            <div class="acp-hours" role="group" :aria-label="`Hours ${c.player.displayName} plays a day`">
              <span class="acct-label">Hours played a day</span>
              <button type="button" aria-label="Half an hour less" :disabled="of(c.player).hours <= MIN_PLAY_HOURS" @click="change(c.player, { hours: of(c.player).hours - 0.5 })">−</button>
              <b>{{ of(c.player).hours }} h</b>
              <button type="button" aria-label="Half an hour more" :disabled="of(c.player).hours >= MAX_PLAY_HOURS" @click="change(c.player, { hours: of(c.player).hours + 0.5 })">+</button>
            </div>
          </div>
        </li>
      </ul>

      <ul v-if="waiting.length" class="acc-claims acp-waiting">
        <li v-for="c in waiting" :key="c.id">
          <div class="acc-claim-main">
            <RouterLink :to="{ name: 'playerDetail', params: { username: c.player.username } }">{{ c.player.displayName }}</RouterLink>
            <span class="claim-chip" :class="c.expired ? 'is-expired' : ''">{{ c.expired ? 'Expired' : 'Waiting for your code' }}</span>
          </div>
          <p v-if="!c.expired && c.code" class="acc-claim-code">Send <b class="claim-code-inline">{{ c.code }}</b> in game to <b>{{ contact }}</b> from {{ c.player.displayName }}.</p>
        </li>
      </ul>

      <p v-if="verified.length" class="acc-note acp-more">To claim another profile, open its profile page and press Claim.</p>
    </template>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import AccountTypeToggle from '@/components/AccountTypeToggle.vue'
import { claimsApi } from '@/api/claims'
import { useRivals } from '@/composables/useRivals'
import { MAX_PLAY_HOURS, MIN_PLAY_HOURS } from '@/composables/usePlayHours'
import { useProfileSettings } from '@/composables/useProfileSettings'
import { meForProfiles } from '@/utils/identity'
import { track } from '@/utils/analytics'

// The account's profiles, each with the settings that carry across the site: members or free-to-play, ironman, and the hours played a day.
const claims = ref([])
const contact = ref('')
const loading = ref(true)
const { me, setMe } = useRivals()
const settings = useProfileSettings()

const verified = computed(() => claims.value.filter((c) => c.status === 'verified'))
const waiting = computed(() => claims.value.filter((c) => c.status !== 'verified'))
const of = (player) => settings.settingsOf(player.displayName)
const mainName = computed(() => meForProfiles(verified.value.map((c) => c.player), me.value))
const isMain = (player) => mainName.value.toLowerCase() === String(player.displayName).toLowerCase()

function change(player, patch) {
  settings.set(player.displayName, patch)
  track('profile_setting_changed', { setting: Object.keys(patch)[0] })
}
async function makeMain(player) {
  setMe(player.displayName)
  // The name is written to storage a moment later; the settings follow the main profile, so wait for that first.
  await nextTick()
  settings.becameMain(player.displayName)
  track('profile_made_main')
}

onMounted(async () => {
  try {
    const res = await claimsApi.mine()
    claims.value = res.claims
    contact.value = res.contact
    // Every profile gets settings of its own, starting from what the planners have been using.
    settings.seed(verified.value.map((c) => c.player))
  } catch {
    claims.value = []
  } finally {
    loading.value = false
  }
})
</script>
