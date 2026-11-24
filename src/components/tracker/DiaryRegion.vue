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

    <div v-if="open" class="trk-detail">
      <div class="range-tabs" role="tablist" :aria-label="`${region.name} tier`">
        <button v-for="t in region.tiers" :key="t.key" type="button" role="tab" :aria-selected="tier === t.key" :class="{ active: tier === t.key }" @click="tier = t.key">{{ t.label }}</button>
      </div>

      <div class="trk-block">
        <h4>Needs</h4>
        <ul class="trk-skills">
          <li v-for="(level, skill) in current.skills" :key="skill" :class="{ short: levels && (levels[skill] ?? 1) < level }">{{ level }} {{ skill }}<small v-if="levels && (levels[skill] ?? 1) < level"> (you are {{ levels[skill] ?? 1 }})</small></li>
          <li v-if="current.combat">Combat level {{ current.combat }}</li>
          <li v-if="current.qp">{{ current.qp }} quest points</li>
          <li v-if="current.allQuests">Every quest</li>
          <li v-for="o in current.other" :key="o">{{ o }}</li>
          <li v-if="!Object.keys(current.skills).length && !current.combat && !current.qp && !current.allQuests && !current.quests.length && !current.other.length" class="trk-none">No skill requirements</li>
        </ul>
        <div v-if="current.quests.length || current.partial.length" class="trk-chips">
          <span class="trk-lead">Quests</span>
          <QuestChip v-for="q in current.quests" :key="q.name" :name="q.name" />
          <QuestChip v-for="q in current.partial" :key="`p-${q.name}`" :name="q.name" partial />
        </div>
        <p class="trk-note">Skill levels can be reached with a boost unless the Wiki says otherwise.<template v-if="current.key !== 'easy'"> The tier before it has to be done first, so ticking it also ticks the tiers below.</template></p>
      </div>

      <div v-if="current.rewards.length" class="trk-block">
        <h4>Rewards</h4>
        <ul class="trk-rewards">
          <li v-for="(r, i) in current.rewards" :key="i">
            {{ r.text }}
            <ul v-if="r.details.length"><li v-for="(d, j) in r.details" :key="j">{{ d }}</li></ul>
          </li>
        </ul>
      </div>

      <div v-if="unlocks.length" class="trk-block">
        <h4>Opens in the planner</h4>
        <p>{{ unlocks.map((u) => u.text).join(', ') }}.</p>
      </div>

      <details v-if="current.tasks.length" class="trk-tasks">
        <summary>{{ current.tasks.length }} tasks</summary>
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
