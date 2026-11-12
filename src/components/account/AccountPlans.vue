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
          <div v-if="r.share && (r.share.stats.views || r.share.stats.uses)" class="hp-stats" :aria-label="`${r.share.stats.views} views, ${r.share.stats.uses} people used this plan`">
            <div class="hp-stat"><b>{{ r.share.stats.views.toLocaleString('en-US') }}</b><span>views</span><small v-if="r.share.stats.viewsWeek">+{{ r.share.stats.viewsWeek.toLocaleString('en-US') }} this week</small></div>
            <div class="hp-stat"><b>{{ r.share.stats.uses.toLocaleString('en-US') }}</b><span>{{ r.share.stats.uses === 1 ? 'person used it' : 'people used it' }}</span><small v-if="r.share.stats.usesWeek">+{{ r.share.stats.usesWeek.toLocaleString('en-US') }} this week</small></div>
            <div class="hp-spark" role="img" :aria-label="`Views over the last 14 days`">
              <i v-for="d in r.share.stats.series" :key="d.day" :style="{ height: barHeight(d.views, r.share.stats) + '%' }" :title="`${d.day}: ${d.views} view${d.views === 1 ? '' : 's'}, ${d.uses} use${d.uses === 1 ? '' : 's'}`" />
            </div>
          </div>
          <div class="hp-skills" aria-hidden="true">
            <img v-for="g in r.plan.goals.slice(0, 10)" :key="g.skill" :src="skillIconSrc(g.skill)" :alt="g.skill" width="18" height="18" :title="g.skill" />
            <span v-if="r.plan.goals.length > 10">+{{ r.plan.goals.length - 10 }}</span>
          </div>
        </div>
        <div class="hp-actions">
          <button v-if="r.share" class="sp-icon" type="button" title="Copy public link" aria-label="Copy public link" @click="copyShare(r.share)">
            <ShareIcon name="link" :size="19" />
          </button>
          <RouterLink class="btn btn-ghost" :to="{ name: 'planner', query: { plan: r.plan.id } }">Open</RouterLink>
          <button v-if="confirming !== r.plan.id" class="sp-icon hp-del" type="button" title="Delete plan" aria-label="Delete plan" @click="confirming = r.plan.id">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
          </button>
          <button v-else class="hp-confirm" type="button" title="Press again to delete this plan" ref="confirmBtn" @click="remove(r.plan)" @blur="confirming = ''">Delete?</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import ShareIcon from '@/components/ShareIcon.vue'
import { sharedPlansApi } from '@/api/sharedPlans'
import { useSharedPlans } from '@/composables/useSharedPlans'
import { useToast } from '@/composables/useToast'
import { deletePlan, listSavedPlans, summarizePlan } from '@/utils/plannerTools'
import { formatHours } from '@/utils/planner'
import { skillIconSrc } from '@/utils/osrsSkills'
import { formatRelative } from '@/utils/time'

const { shareFor, stop, reload } = useSharedPlans()
// Counts move while you are away, so read them fresh whenever this opens.
reload()
const { showToast } = useToast()
const plans = ref(listSavedPlans())
const confirming = ref('')
const confirmBtn = ref(null)
// The confirm button takes focus so clicking anywhere else cancels the delete.
watch(confirming, (id) => id && nextTick(() => (Array.isArray(confirmBtn.value) ? confirmBtn.value[0] : confirmBtn.value)?.focus()))

const rows = computed(() => plans.value.map((plan) => ({ plan, share: shareFor(plan.id), summary: summarizePlan(plan) })))

const barHeight = (n, stats) => (n ? Math.max(12, Math.round((n / Math.max(...stats.series.map((d) => d.views), 1)) * 100)) : 4)
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
