<template>
  <section class="card hub-card">
    <div class="hub-card-head">
      <div>
        <h2>Your plans</h2>
        <p class="acc-note">Every plan you have saved, for any player. They follow your account to any device you log in on.</p>
      </div>
      <RouterLink class="btn btn-primary" :to="{ name: 'planner' }">+ New plan</RouterLink>
    </div>

    <p v-if="!rows.length" class="acc-empty">No saved plans yet. Build one in the Account Planner and press Save plan.</p>
    <ul v-else class="hp-list">
      <li v-for="r in rows" :key="r.plan.id" class="hp-row">
        <div class="hp-main">
          <RouterLink class="hp-name" :to="{ name: 'planner', query: { plan: r.plan.id } }">{{ r.plan.name }}</RouterLink>
          <span v-if="r.share" class="sp-public" :title="r.share.mode === 'live' ? 'Public with live progress' : 'Public snapshot'">Public</span>
          <div class="hp-meta">
            <span v-if="r.plan.player?.rsn">For {{ r.plan.player.rsn }}</span>
            <span>{{ r.plan.goals.length }} goal{{ r.plan.goals.length === 1 ? '' : 's' }}</span>
            <span>{{ formatHours(r.summary.totalHours) }}<template v-if="r.summary.days != null"> · {{ r.summary.days.toLocaleString('en-US') }} days at {{ r.plan.hoursPerDay }} h/day</template></span>
            <span>Updated {{ formatRelative(r.plan.updatedAt) }}</span>
          </div>
          <div class="hp-skills" aria-hidden="true">
            <img v-for="g in r.plan.goals.slice(0, 10)" :key="g.skill" :src="skillIconSrc(g.skill)" :alt="g.skill" width="18" height="18" :title="g.skill" />
            <span v-if="r.plan.goals.length > 10">+{{ r.plan.goals.length - 10 }}</span>
          </div>
        </div>
        <div class="hp-actions">
          <RouterLink class="btn btn-ghost" :to="{ name: 'planner', query: { plan: r.plan.id } }">Open</RouterLink>
          <button v-if="r.share" class="btn-text" type="button" @click="copyShare(r.share)">Copy public link</button>
          <template v-if="confirming !== r.plan.id">
            <button class="btn-text hp-del" type="button" @click="confirming = r.plan.id">Delete</button>
          </template>
          <template v-else>
            <button class="btn-text hp-del" type="button" @click="remove(r.plan)">Yes, delete</button>
            <button class="btn-text" type="button" @click="confirming = ''">Keep</button>
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { sharedPlansApi } from '@/api/sharedPlans'
import { useSharedPlans } from '@/composables/useSharedPlans'
import { useToast } from '@/composables/useToast'
import { deletePlan, listSavedPlans, summarizePlan } from '@/utils/plannerTools'
import { formatHours } from '@/utils/planner'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'

const { shareFor, stop } = useSharedPlans()
const { showToast } = useToast()
const plans = ref(listSavedPlans())
const confirming = ref('')

const rows = computed(() => plans.value.map((plan) => ({ plan, share: shareFor(plan.id), summary: summarizePlan(plan) })))

async function copyShare(share) {
  try {
    await navigator.clipboard.writeText(sharedPlansApi.pageUrl(share.slug))
    showToast('Public link copied')
  } catch {
    showToast('Could not copy the link.')
  }
}
async function remove(plan) {
  const share = shareFor(plan.id)
  // A deleted plan must not stay public.
  if (share) await stop(share.slug).catch(() => {})
  deletePlan(plan.id)
  plans.value = listSavedPlans()
  confirming.value = ''
  showToast(`Deleted "${plan.name}".`)
}
</script>
