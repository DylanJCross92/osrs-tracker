<template>
  <div v-if="loading" class="card"><p class="empty-hint">Loading card…</p></div>

  <div v-else-if="!card" class="card">
    <p class="empty-hint">This card couldn't be found.</p>
  </div>

  <template v-else>
    <a href="#" class="btn-text share-back-link" @click.prevent="router.push({ name: 'playerDetail', params: { username } })">
      ← Back to {{ card.displayName }}
    </a>

    <div class="card share-card-combined">
      <img :src="imageUrl" :alt="`${card.displayName}'s weekly XP gains`" class="share-card-image" />
      <div class="share-card-actions">
        <button class="btn btn-primary" @click="copyLink">{{ copied ? 'Link copied!' : 'Copy Link' }}</button>
        <a class="btn btn-ghost" :href="imageUrl" target="_blank" rel="noopener">Download Image</a>
        <button v-if="canNativeShare" class="btn btn-ghost" @click="nativeShare">Share…</button>
      </div>
    </div>

    <p class="share-card-footer-cta">
      Like what you see?
      <a href="/">Track your own OSRS progress, it's free →</a>
    </p>
  </template>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { cardsApi } from '@/api/cards'
import { useToast } from '@/composables/useToast'
import { setPageMeta } from '@/utils/pageMeta'
import { formatXp } from '@/utils/osrsSkills'

const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const username = computed(() => route.params.username)
const slug = computed(() => route.params.slug || null)
const isFrozen = computed(() => Boolean(slug.value))
const skillParam = computed(() => route.query.skill || 'Overall')
const periodParam = computed(() => (['day', 'month'].includes(route.query.period) ? route.query.period : 'week'))
const PERIOD_ADJ = { day: 'Daily', week: 'Weekly', month: 'Monthly' }
const PERIOD_PHRASE = { day: 'today', week: 'this week', month: 'in the last 30 days' }
const cardPeriod = computed(() => card.value?.period || periodParam.value)

const loading = ref(true)
const card = ref(null)
const copied = ref(false)

const skillSuffix = computed(() => (card.value?.skill && card.value.skill !== 'Overall' ? ` ${card.value.skill}` : ''))

const imageUrl = computed(() =>
  isFrozen.value ? cardsApi.frozenImageUrl(slug.value) : cardsApi.weeklyImageUrl(username.value, skillParam.value, periodParam.value),
)
const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

onMounted(async () => {
  try {
    card.value = isFrozen.value
      ? await cardsApi.getFrozen(slug.value)
      : await cardsApi.getWeeklyData(username.value, skillParam.value, periodParam.value)
  } catch {
    card.value = null
  } finally {
    loading.value = false
  }

  if (card.value) {
    const skillQuery = cardsApi.cardQuery(card.value.skill, cardPeriod.value)
    setPageMeta({
      title: `${card.value.displayName}'s ${PERIOD_ADJ[cardPeriod.value]}${skillSuffix.value} XP Gains`,
      description: `${card.value.displayName} gained ${formatXp(card.value.xpGained)}${skillSuffix.value} XP ${PERIOD_PHRASE[cardPeriod.value]} on TickGains.`,
      path: isFrozen.value
        ? `/player/${encodeURIComponent(username.value)}/card/weekly/${slug.value}`
        : `/player/${encodeURIComponent(username.value)}/card/weekly${skillQuery}`,
    })
  }
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    showToast('Could not copy the link, copy it from the address bar instead.')
  }
}

async function nativeShare() {
  try {
    await navigator.share({
      title: `${card.value.displayName}'s ${PERIOD_ADJ[cardPeriod.value]} XP Gains | TickGains`,
      url: window.location.href,
    })
  } catch {
    // User cancelled the share sheet, not an error.
  }
}
</script>
