<template>
  <div class="trk-quests">
    <section v-if="upNext.length && !search && status !== 'done'" class="trk-next" aria-labelledby="trk-next-h">
      <h3 id="trk-next-h">Good quests to do next</h3>
      <p>Quests you can start (what they need is done) that open the most training methods or give the most XP.</p>
      <ul>
        <li v-for="r in upNext" :key="r.slug">
          <button type="button" class="trk-next-name" @click="focusQuest(r)">{{ r.name }}</button>
          <span class="trk-next-why">{{ r.why }}</span>
        </li>
      </ul>
    </section>

    <div class="trk-ctl">
      <input v-model="search" type="search" name="quest-filter" placeholder="Search quests" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search quests" data-1p-ignore data-lpignore="true" />
      <div class="range-tabs" role="group" aria-label="Show">
        <button v-for="t in STATUS_TABS" :key="t.key" type="button" :class="{ active: status === t.key }" @click="status = t.key">{{ t.label }}</button>
      </div>
      <div class="range-tabs" role="group" aria-label="Quest type">
        <button type="button" :class="{ active: type === '' }" @click="type = ''">All types</button>
        <button v-for="(label, key) in QUEST_TYPES" :key="key" type="button" :class="{ active: type === key }" @click="type = key">{{ label }}</button>
      </div>
      <label class="trk-sort">Sort
        <select v-model="sort" aria-label="Sort quests">
          <option value="az">A to Z</option>
          <option value="useful">Most useful for training</option>
          <option value="short">Shortest first</option>
        </select>
      </label>
    </div>

    <p v-if="!shown.length" class="acc-empty">No quests match.</p>
    <ul v-else class="trk-list">
      <li v-for="r in shown" :id="`quest-${r.slug}`" :key="r.slug" class="trk-row" :class="{ done: r.done, open: open.has(r.slug) }">
        <div class="trk-line">
          <label class="trk-check">
            <input type="checkbox" :checked="r.done" :aria-label="`${r.name} done`" @change="toggle(r, $event.target.checked)" />
          </label>
          <button type="button" class="trk-name" :aria-expanded="open.has(r.slug)" @click="flip(r.slug)">
            <b>{{ r.name }}</b>
            <small v-if="r.state === 'missing'" class="trk-flag" title="You told the planner you have not done this quest. Ticking the box changes that.">marked not done</small>
          </button>
          <span class="trk-meta">
            <span v-if="r.info?.difficulty">{{ r.info.difficulty }}</span>
            <span v-if="r.info?.length">{{ r.info.length }}</span>
            <span v-if="r.info?.qp">{{ r.info.qp }} QP</span>
            <span>{{ QUEST_TYPES[r.type] }}</span>
          </span>
          <span v-if="r.unlocks.length || r.xp" class="trk-gives">
            <i v-if="r.unlocks.length" class="trk-tag is-unlock" :title="r.unlocks.map((u) => u.text).join(', ')">Opens {{ r.unlocks.length }} method{{ r.unlocks.length === 1 ? '' : 's' }}</i>
            <i v-if="r.xp" class="trk-tag is-xp" :title="r.xpText">{{ formatXp(r.xp) }} XP</i>
          </span>
        </div>

        <div v-if="open.has(r.slug)" class="trk-detail">
          <div v-if="r.needs.length || r.info?.qpReq || r.prereq.length" class="trk-block">
            <h4>Needs</h4>
            <ul class="trk-skills">
              <li v-for="n in r.needs" :key="n">{{ n }}</li>
              <li v-if="r.info?.qpReq">{{ r.info.qpReq }} quest points</li>
            </ul>
            <div v-if="r.prereq.length" class="trk-chips"><span class="trk-lead">Quests first</span><QuestChip v-for="p in r.prereq" :key="p" :name="p" /></div>
          </div>
          <div v-if="r.xp || r.info?.qp || r.info?.lamps?.length" class="trk-block">
            <h4>Gives</h4>
            <p>
              <template v-if="r.info?.qp">{{ r.info.qp }} quest point{{ r.info.qp === 1 ? '' : 's' }}. </template>
              <template v-if="r.xp">{{ r.xpText }}. </template>
              <template v-if="r.info?.lamps?.length">Also an XP lamp (its skill is your choice, not counted).</template>
            </p>
          </div>
          <div v-if="r.unlocks.length" class="trk-block">
            <h4>Opens in the planner</h4>
            <p>{{ r.unlocks.map((u) => u.text).join(', ') }}.</p>
          </div>
          <p v-if="r.info?.url" class="trk-wiki"><a :href="r.info.url" target="_blank" rel="noopener">{{ r.name }} on the OSRS Wiki</a></p>
        </div>
      </li>
    </ul>

    <div class="trk-bulk">
      <button class="btn-text" type="button" :disabled="!shown.length || allShownDone" @click="markShown(true)">Mark the {{ shown.length }} shown as done</button>
      <button class="btn-text" type="button" :disabled="!shown.some((r) => r.done)" @click="markShown(false)">Clear the shown</button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { QUEST_LIST, QUEST_TYPES } from '@/data/questList'
import { LENGTH_MINUTES, getQuest } from '@/data/quests'
import { useRequirements } from '@/composables/useRequirements'
import { questSlug } from '@/utils/questSlug'
import { unlocksFor } from '@/utils/trackerUnlocks'
import { formatXp } from '@/utils/osrsSkills'
import { track } from '@/utils/analytics'
import QuestChip from '@/components/tracker/QuestChip.vue'

const { confirmations, setQuestDone, setMany } = useRequirements()

const search = ref('')
const status = ref('all')
const type = ref('')
const sort = ref('az')
const open = ref(new Set())
const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'Not done' },
  { key: 'done', label: 'Done' },
]

const xpOf = (info) => (info ? Object.values(info.rewards).reduce((s, n) => s + n, 0) : 0)
const xpText = (info) => (info ? Object.entries(info.rewards).map(([k, v]) => `${formatXp(v)} ${k}`).join(', ') : '')

// The facts about each quest, once. What changes with the player's answers is read below.
const BASE = QUEST_LIST.map((q) => {
  const info = getQuest(q.slug)
  const unlocks = unlocksFor(q.id)
  const needs = info ? Object.entries(info.reqs).map(([skill, level]) => `${level} ${skill}`) : []
  return { ...q, info, unlocks, xp: xpOf(info), xpText: xpText(info), needs, prereq: info ? info.requires.map((id) => getQuest(id)?.name).filter(Boolean) : [] }
})
const rows = computed(() => BASE.map((r) => ({ ...r, done: confirmations.value[r.id] === 'have', state: confirmations.value[r.id] || null })))
// Quest ids in data/quests.js are the slug of the name, except three old ones; the tracker's own slug always comes from the name.
const slugOfId = (id) => (getQuest(id) ? questSlug(getQuest(id).name) : id)
const doneSlugs = computed(() => new Set(rows.value.filter((r) => r.done).map((r) => r.slug)))

// How useful a quest is for training: the methods it opens count most, then its XP.
const score = (r) => r.unlocks.length * 3 + Math.min(r.xp / 10000, 10)
const minutesOf = (r) => (r.info?.length ? LENGTH_MINUTES[r.info.length] : 9999)

const upNext = computed(() => {
  return rows.value
    .filter((r) => !r.done && r.info && !r.info.incomplete && score(r) > 0 && r.info.requires.every((id) => doneSlugs.value.has(slugOfId(id))))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 4)
    .map((r) => ({ ...r, why: [r.unlocks.length ? `opens ${r.unlocks.slice(0, 2).map((u) => u.name).join(', ')}${r.unlocks.length > 2 ? ' and more' : ''}` : '', r.xp ? `${formatXp(r.xp)} XP` : ''].filter(Boolean).join(', ') }))
})

const shown = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = rows.value.filter((r) => {
    if (type.value && r.type !== type.value) return false
    if (term && !r.name.toLowerCase().includes(term)) return false
    if (status.value === 'done' && !r.done) return false
    if (status.value === 'todo' && r.done) return false
    return true
  })
  if (sort.value === 'useful') return [...list].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
  if (sort.value === 'short') return [...list].sort((a, b) => minutesOf(a) - minutesOf(b) || a.name.localeCompare(b.name))
  return list
})
const allShownDone = computed(() => shown.value.every((r) => r.done))

function flip(slug) {
  const next = new Set(open.value)
  if (!next.delete(slug)) next.add(slug)
  open.value = next
}
async function focusQuest(r) {
  search.value = ''
  status.value = 'all'
  type.value = ''
  open.value = new Set([...open.value, r.slug])
  await nextTick()
  document.getElementById(`quest-${r.slug}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
function toggle(r, checked) {
  setQuestDone(r.name, checked)
  track('quest_tracker_toggled', { enabled: checked })
}
function markShown(done) {
  const patch = {}
  for (const r of shown.value) if (r.done !== done) patch[r.id] = done ? 'have' : null
  setMany(patch)
  track('quest_tracker_bulk', { done, count: shown.value.length })
}
</script>
