<template>
  <section class="trk-region" :aria-labelledby="`diary-${region.slug}`">
    <div class="trk-region-head">
      <h3 :id="`diary-${region.slug}`">{{ region.name }}</h3>
      <span class="trk-count">{{ doneCount }} of 4</span>
      <div class="trk-tiers" role="group" :aria-label="`${region.name} diary tiers`">
        <label v-for="t in region.tiers" :key="t.id" class="trk-tier" :class="{ done: isDone(t) }">
          <input type="checkbox" :checked="isDone(t)" :aria-label="t.name" @change="toggle(t, $event.target.checked)" />
          <span>{{ t.label }}</span>
        </label>
      </div>
      <button type="button" class="btn-text trk-more" :aria-expanded="open" @click="open = !open">{{ open ? 'Hide details' : 'Requirements, rewards, tasks' }}</button>
    </div>

    <div v-if="open" class="trk-detail">
      <div class="range-tabs" role="tablist" :aria-label="`${region.name} tier`">
        <button v-for="t in region.tiers" :key="t.key" type="button" role="tab" :aria-selected="tier === t.key" :class="{ active: tier === t.key }" @click="tier = t.key">{{ t.label }}</button>
      </div>

      <div class="trk-block">
        <h4>Needs</h4>
        <ul class="trk-skills">
          <li v-for="(level, skill) in current.skills" :key="skill">{{ level }} {{ skill }}</li>
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
import { computed, ref } from 'vue'
import { useRequirements } from '@/composables/useRequirements'
import { tierDone } from '@/utils/diaryProgress'
import { unlocksFor } from '@/utils/trackerUnlocks'
import { track } from '@/utils/analytics'
import QuestChip from '@/components/tracker/QuestChip.vue'

const props = defineProps({ region: { type: Object, required: true } })
const { confirmations, setDiaryDone } = useRequirements()

const isDone = (t) => tierDone(t.id, confirmations.value)
const doneCount = computed(() => props.region.tiers.filter(isDone).length)
const open = ref(false)
// Open on the first tier still to do, or the last one when all are done.
const tier = ref(props.region.tiers.find((t) => !isDone(t))?.key || 'elite')
const current = computed(() => props.region.tiers.find((t) => t.key === tier.value))
const unlocks = computed(() => unlocksFor(current.value.id))

function toggle(t, checked) {
  setDiaryDone(t.id, checked)
  track('diary_tracker_toggled', { tier: t.key, enabled: checked })
}
</script>
