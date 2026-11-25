<template>
  <section class="acp" aria-labelledby="acp-h">
    <header class="acp-intro">
      <h2 id="acp-h">Your profiles</h2>
      <p>Each profile's settings are used by the planner, the calculators and the Smart Planner whenever that profile is selected. Your main profile's settings are the default everywhere.</p>
    </header>

    <p v-if="loading" class="acc-empty">Loading…</p>
    <template v-else>
      <div v-if="!verified.length" class="acp-none">
        <p class="acc-empty">No profile yet. Open a profile page and press Claim to make it yours; its settings appear here.</p>
        <RouterLink class="btn btn-primary" :to="{ name: 'players' }">Find your profile</RouterLink>
      </div>

      <ul v-else class="acp-list">
        <li v-for="c in verified" :key="c.id" class="acp-item" :class="{ 'is-main': isMain(c.player) }">
          <div class="acp-head">
            <span class="acp-av"><PlayerAvatar :name="c.player.username" /></span>
            <div class="acp-id">
              <div class="acp-name">
                <b>{{ c.player.displayName }}</b>
                <span class="acp-chip is-ok"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Verified owner</span>
                <span v-if="isMain(c.player)" class="acp-chip is-main"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></svg>Main profile</span>
                <button v-else type="button" class="acp-makemain" @click="makeMain(c.player)">Make main</button>
              </div>
              <small>{{ isMain(c.player) ? 'These settings are what every planner and calculator starts from.' : 'Used when this profile is selected in a planner or calculator.' }}</small>
            </div>
            <div class="acp-links">
              <RouterLink :to="{ name: 'playerDetail', params: { username: c.player.username } }">Profile <span aria-hidden="true">→</span></RouterLink>
              <RouterLink :to="{ name: 'planner', query: { u: c.player.username } }">Planner <span aria-hidden="true">→</span></RouterLink>
            </div>
          </div>

          <div class="acp-grid">
            <AccountTypeToggle
              :model-value="of(c.player).members"
              :iron="of(c.player).iron"
              @update:model-value="(v) => change(c.player, { members: v })"
              @update:iron="(v) => change(c.player, { iron: v })"
            />
            <span class="acct-label">Hours played a day</span>
            <div class="acp-hours" role="group" :aria-label="`Hours ${c.player.displayName} plays a day`">
              <button type="button" aria-label="Half an hour less" :disabled="of(c.player).hours <= MIN_PLAY_HOURS" @click="change(c.player, { hours: of(c.player).hours - 0.5 })">−</button>
              <b>{{ of(c.player).hours }} h</b>
              <button type="button" aria-label="Half an hour more" :disabled="of(c.player).hours >= MAX_PLAY_HOURS" @click="change(c.player, { hours: of(c.player).hours + 0.5 })">+</button>
            </div>
          </div>
        </li>

        <li v-for="c in waiting" :key="c.id" class="acp-wait">
          <div>
            <div class="acp-name"><RouterLink :to="{ name: 'playerDetail', params: { username: c.player.username } }"><b>{{ c.player.displayName }}</b></RouterLink><span class="acp-chip" :class="c.expired ? 'is-bad' : ''">{{ c.expired ? 'Claim expired' : 'Waiting for your code' }}</span></div>
            <small v-if="!c.expired && c.code">Send this code in game to <b>{{ contact }}</b> from {{ c.player.displayName }}.</small>
          </div>
          <code v-if="!c.expired && c.code" class="acp-code">{{ c.code }}</code>
        </li>

        <li class="acp-claim">
          <RouterLink :to="{ name: 'players' }">
            <span class="acp-plus" aria-hidden="true">+</span>
            <span><b>Claim another profile</b><small>Open its profile page and press Claim.</small></span>
          </RouterLink>
        </li>
      </ul>
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
