<template>
  <div class="trk">
    <p v-if="loggedIn" class="trk-save is-saved">Saved to your account, so it follows you to every device and the Account Planner uses it for every plan.</p>
    <p v-else class="trk-save">
      Saved in this browser only. <RouterLink :to="{ name: 'signup', query: { next: '/quests' } }" @click="track('tracker_signup_click')">Create a free account</RouterLink> to keep your quests and diaries on every device and have the Account Planner use them for every plan. Already have one? <RouterLink :to="{ name: 'login', query: { next: '/quests' } }">Log in</RouterLink>.
    </p>

    <dl class="trk-sum">
      <div>
        <dt>Quests</dt>
        <dd><b>{{ questStats.done }}</b> of {{ questStats.total }}</dd>
        <i class="trk-bar" role="progressbar" :aria-valuenow="questStats.done" aria-valuemin="0" :aria-valuemax="questStats.total" aria-label="Quests done"><s :style="{ width: questStats.pct * 100 + '%' }" /></i>
      </div>
      <div>
        <dt>Quest points</dt>
        <dd><b>{{ qp.have }}</b> of {{ qp.total }}</dd>
        <i class="trk-bar" role="progressbar" :aria-valuenow="qp.have" aria-valuemin="0" :aria-valuemax="qp.total" aria-label="Quest points"><s :style="{ width: (qp.total ? (qp.have / qp.total) * 100 : 0) + '%' }" /></i>
      </div>
      <div>
        <dt>Diary tiers</dt>
        <dd><b>{{ diaryStats.done }}</b> of {{ diaryStats.total }}</dd>
        <i class="trk-bar" role="progressbar" :aria-valuenow="diaryStats.done" aria-valuemin="0" :aria-valuemax="diaryStats.total" aria-label="Diary tiers done"><s :style="{ width: diaryStats.pct * 100 + '%' }" /></i>
      </div>
    </dl>

    <div class="range-tabs trk-tabs" role="tablist" aria-label="Tracker">
      <button type="button" role="tab" :aria-selected="tab === 'quests'" :class="{ active: tab === 'quests' }" @click="$emit('update:tab', 'quests')">Quests</button>
      <button type="button" role="tab" :aria-selected="tab === 'diaries'" :class="{ active: tab === 'diaries' }" @click="$emit('update:tab', 'diaries')">Achievement diaries</button>
    </div>

    <QuestsTab v-if="tab === 'quests'" />
    <DiariesTab v-else />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRequirements } from '@/composables/useRequirements'
import { useAuth } from '@/composables/useAuth'
import { questPoints } from '@/utils/questProgress'
import { track } from '@/utils/analytics'
import QuestsTab from '@/components/tracker/QuestsTab.vue'
import DiariesTab from '@/components/tracker/DiariesTab.vue'

defineProps({ tab: { type: String, default: 'quests' } })
defineEmits(['update:tab'])

const { questStats, diaryStats, confirmations } = useRequirements()
const { loggedIn } = useAuth()
const qp = computed(() => questPoints(confirmations.value))
</script>
