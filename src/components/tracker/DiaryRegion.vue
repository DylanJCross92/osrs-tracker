<template>
  <section :id="`region-${region.slug}`" class="trk-region" :class="{ flash }" :aria-labelledby="`diary-${region.slug}`">
    <div class="trk-region-head">
      <h3 :id="`diary-${region.slug}`">{{ region.name }}</h3>
      <span class="trk-count">{{ doneCount }} of 4<small v-if="nextReady"> · next tier: you meet the levels</small></span>
      <div class="trk-tiers" role="group" :aria-label="`${region.name} diary tiers`">
        <label v-for="t in region.tiers" :key="t.id" class="trk-tier" :class="{ done: isDone(t), next: !isDone(t) && t.id === nextId }">
          <input type="checkbox" :checked="isDone(t)" :aria-label="t.name" @change="toggle(t, $event.target.checked)" />
          <span class="trk-tier-box" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
          <span>{{ t.label }}</span>
        </label>
      </div>
      <button type="button" class="trk-more" :aria-expanded="open" @click="open = !open">{{ open ? 'Hide details' : 'See requirements and rewards' }}<svg :class="{ open }" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></button>
    </div>

    <div v-if="open" class="trk-detail trk-dd">
      <div class="trk-ttabs" role="tablist" :aria-label="`${region.name} tier`">
        <button v-for="t in region.tiers" :key="t.key" type="button" role="tab" :aria-selected="tier === t.key" :class="{ active: tier === t.key, done: isDone(t) }" @click="tier = t.key">
          <svg v-if="isDone(t)" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{{ t.label }}
        </button>
      </div>

      <div class="trk-facts">
        <span class="trk-fact"><b class="trk-qp" aria-hidden="true">✓</b>{{ current.tasks.length }}<small>Tasks</small></span>
        <span v-if="lamp" class="trk-fact is-lamp"><b class="trk-qp" aria-hidden="true">✦</b>{{ lamp.xp }} XP<small>Lamp, level {{ lamp.level }}+</small></span>
        <span v-if="current.rewards.length" class="trk-fact"><b class="trk-qp" aria-hidden="true">★</b>{{ current.rewards.length }}<small>Reward{{ current.rewards.length === 1 ? '' : 's' }}</small></span>
        <span v-if="unlocks.length" class="trk-fact is-open"><b class="trk-qp" aria-hidden="true">↗</b>{{ unlocks.length }}<small>Planner method{{ unlocks.length === 1 ? '' : 's' }}</small></span>
      </div>

      <div class="trk-cols">
        <section class="trk-block">
          <h4>You need</h4>
          <SkillReqGrid :skills="current.skills" :levels="levels" :combat="current.combat" :qp="current.qp" :notes="notes" />
          <div v-if="current.quests.length || current.partial.length" class="trk-chips">
            <span class="trk-lead">Quests</span>
            <QuestChip v-for="q in current.quests" :key="q.name" :name="q.name" />
            <QuestChip v-for="q in current.partial" :key="`p-${q.name}`" :name="q.name" partial />
          </div>
          <p v-if="!hasNeeds" class="trk-none">Nothing to meet: you can start this tier now.</p>
          <p class="trk-note">Skill boosts count unless the Wiki says otherwise.<template v-if="current.key !== 'easy'"> The tier before it has to be done first.</template></p>
        </section>

        <section v-if="cards.length" class="trk-block">
          <h4>You get</h4>
          <ul class="trk-rewcards">
            <li v-for="(c, i) in cards" :key="i" :class="`is-${c.kind}`">
              <span class="trk-rewcards-ico" aria-hidden="true">{{ c.kind === 'lamp' ? '✦' : '◆' }}</span>
              <span class="trk-rewcards-main"><b>{{ c.title }}</b><small v-if="c.sub">{{ c.sub }}</small></span>
            </li>
          </ul>
        </section>
      </div>

      <section v-if="unlocks.length" class="trk-block">
        <h4>Opens in the planner</h4>
        <MethodCards :unlocks="unlocks" />
      </section>

      <details v-if="current.tasks.length" class="trk-tasks">
        <summary>All {{ current.tasks.length }} tasks</summary>
        <ol>
          <li v-for="(t, i) in current.tasks" :key="i">{{ t }}</li>
        </ol>
      </details>
      <p v-if="region.url" class="trk-wiki"><a :href="region.url" target="_blank" rel="noopener">{{ region.name }} Diary on the OSRS Wiki</a></p>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRequirements } from '@/composables/useRequirements'
import { tierDone } from '@/utils/diaryProgress'
import { unlocksFor } from '@/utils/trackerUnlocks'
import { track } from '@/utils/analytics'
import { useTrackerPlayer } from '@/composables/useTrackerPlayer'
import { shortfalls } from '@/utils/trackerSuggestions'
import QuestChip from '@/components/tracker/QuestChip.vue'
import SkillReqGrid from '@/components/tracker/SkillReqGrid.vue'
import MethodCards from '@/components/tracker/MethodCards.vue'

const props = defineProps({ region: { type: Object, required: true }, focus: { type: Object, default: null } })
const emit = defineEmits(['focused'])
const { levels } = useTrackerPlayer()
const { confirmations, setDiaryDone } = useRequirements()

const isDone = (t) => tierDone(t.id, confirmations.value)
const doneCount = computed(() => props.region.tiers.filter(isDone).length)
const open = ref(false)
// Open on the first tier still to do, or the last one when all are done.
const tier = ref(props.region.tiers.find((t) => !isDone(t))?.key || 'elite')
const current = computed(() => props.region.tiers.find((t) => t.key === tier.value))
const unlocks = computed(() => unlocksFor(current.value.id))
const nextTier = computed(() => props.region.tiers.find((t) => !isDone(t)) || null)
const nextId = computed(() => nextTier.value?.id || '')
// With a player's levels: the next tier's skill levels are all met (the quests it needs are checked in its details).
const nextReady = computed(() => !!levels.value && !!nextTier.value && shortfalls(nextTier.value.skills, levels.value).length === 0)
const hasNeeds = computed(() => {
  const t = current.value
  return !!(Object.keys(t.skills).length || t.combat || t.qp || t.allQuests || t.quests.length || t.partial.length || t.other.length)
})
const notes = computed(() => [...(current.value.allQuests ? ['Every quest'] : []), ...current.value.other])
// The antique lamp a tier gives, read from its reward text ("Antique lamp worth 5,000 experience in any skill of at least level 30").
const LAMP = /antique lamp worth ([\d,]+) experience in any skill of (?:at least level (\d+)|any level)/i
const lamp = computed(() => {
  const r = current.value.rewards.find((x) => LAMP.test(x.text))
  const m = r?.text.match(LAMP)
  return m ? { xp: m[1], level: m[2] || '1' } : null
})
// Rewards as short cards: the lamp as "XP lamp", the rest by name with a line or two of what they do.
const cards = computed(() =>
  current.value.rewards.map((r) => {
    if (LAMP.test(r.text)) return { kind: 'lamp', title: `XP lamp: ${lamp.value?.xp ?? ''} XP`, sub: `Any skill, level ${lamp.value?.level}+` }
    return { kind: 'item', title: r.text.replace(/\s*\([^)]*\)\s*$/, ''), sub: r.details.slice(0, 2).join('. ') }
  }),
)
const flash = ref(false)
// A suggestion's "Details": open this region on that tier and bring it into view.
watch(
  () => props.focus,
  async (f) => {
    if (!f || f.kind !== 'diary') return
    const t = props.region.tiers.find((x) => x.id === f.id)
    if (!t) return
    tier.value = t.key
    open.value = true
    await nextTick()
    document.getElementById(`region-${props.region.slug}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    flash.value = true
    setTimeout(() => (flash.value = false), 1600)
    emit('focused')
  },
  { immediate: true },
)

function toggle(t, checked) {
  setDiaryDone(t.id, checked)
  track('diary_tracker_toggled', { tier: t.key, enabled: checked })
}
</script>
