<template>
  <div class="trk-quests">
    <div class="trk-ctl">
      <label class="trk-search">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input v-model="search" type="search" name="quest-filter" placeholder="Search quests" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search quests" data-1p-ignore data-lpignore="true" />
      </label>
      <div class="trk-pills" role="group" aria-label="Show">
        <button v-for="t in statusTabs" :key="t.key" type="button" :class="{ on: status === t.key }" :aria-pressed="status === t.key" @click="status = t.key">{{ t.label }}<small>{{ t.count }}</small></button>
      </div>
      <div class="trk-pills" role="group" aria-label="Quest type">
        <button type="button" :class="{ on: type === '' }" :aria-pressed="type === ''" @click="type = ''">Any type</button>
        <button v-for="(label, key) in QUEST_TYPES" :key="key" type="button" :class="{ on: type === key }" :aria-pressed="type === key" @click="type = key">{{ label }}</button>
      </div>
      <label class="trk-sort">Sort
        <select v-model="sort" aria-label="Sort quests">
          <option value="az">By type, A to Z</option>
          <option value="useful">Most useful for training</option>
          <option value="short">Shortest first</option>
        </select>
      </label>
    </div>

    <p v-if="!shown.length" class="acc-empty">No quests match. <button class="btn-text" type="button" @click="reset">Clear the filters</button></p>
    <template v-else>
      <section v-for="g in groups" :key="g.key" class="trk-group">
        <header v-if="g.title" class="trk-group-head">
          <h3>{{ g.title }}</h3>
          <span>{{ g.done }} of {{ g.rows.length }} done</span>
          <button class="btn-text" type="button" :disabled="g.done === g.rows.length" @click="markGroup(g, true)">Mark all done</button>
        </header>
        <ul class="trk-list">
          <li v-for="r in g.rows" :id="`quest-${r.slug}`" :key="r.slug" class="trk-row" :class="{ done: r.done, open: open.has(r.slug), flash: flashSlug === r.slug }">
            <div class="trk-line">
              <label class="trk-check" :title="r.done ? 'Done. Click to undo' : 'Mark as done'">
                <input type="checkbox" :checked="r.done" :aria-label="`${r.name} done`" @change="toggle(r, $event.target.checked)" />
                <span class="trk-box" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
              </label>
              <button type="button" class="trk-name" :aria-expanded="open.has(r.slug)" @click="flip(r.slug)">
                <b>{{ r.name }}</b>
                <small v-if="r.state === 'missing'" class="trk-flag" title="You told the planner you have not done this quest. Ticking the box changes that.">marked not done</small>
                <span class="trk-meta">
                  <span v-if="r.info?.difficulty">{{ r.info.difficulty }}</span>
                  <span v-if="r.info?.length">{{ r.info.length }}</span>
                  <span v-if="r.info?.qp">{{ r.info.qp }} QP</span>
                </span>
              </button>
              <span class="trk-gives">
                <i v-if="!r.done && r.ready === 'locked'" class="trk-tag is-locked" :title="r.lockText">Needs {{ r.lockShort }}</i>
                <i v-else-if="!r.done && r.ready === 'ready'" class="trk-tag is-ready">Ready</i>
                <i v-if="r.unlocks.length" class="trk-tag is-unlock" :title="r.unlocks.map((u) => u.text).join(', ')">Opens {{ r.unlocks.length }}</i>
                <i v-if="r.xp" class="trk-tag is-xp" :title="r.gain ? `${r.xpText}. Takes you up ${r.gain} level${r.gain === 1 ? '' : 's'}.` : r.xpText">{{ formatXp(r.xp) }} XP<template v-if="r.gain && !r.done"> · +{{ r.gain }} lvl</template></i>
              </span>
              <button type="button" class="trk-chev" :class="{ open: open.has(r.slug) }" :aria-label="open.has(r.slug) ? 'Hide details' : 'Show details'" tabindex="-1" @click="flip(r.slug)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </button>
            </div>

            <div v-if="open.has(r.slug)" class="trk-detail trk-qd">
              <div class="trk-facts">
                <span v-if="r.info?.difficulty" class="trk-fact"><i class="trk-dot" :class="`d-${r.info.difficulty.toLowerCase()}`" aria-hidden="true" />{{ r.info.difficulty }}<small>Difficulty</small></span>
                <span v-if="r.info?.length" class="trk-fact"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{{ timeText(r) }}<small>{{ r.info.length }}</small></span>
                <span v-if="r.info?.qp" class="trk-fact"><b class="trk-qp" aria-hidden="true">QP</b>{{ r.info.qp }}<small>Quest point{{ r.info.qp === 1 ? '' : 's' }}</small></span>
                <span class="trk-fact">{{ r.type === 'F' ? 'Free-to-play' : r.type === 'MQ' ? 'Miniquest' : 'Members' }}</span>
              </div>

              <div class="trk-cols">
                <section class="trk-block">
                  <h4>You need</h4>
                  <SkillReqGrid :skills="r.info?.reqs || {}" :levels="levels" :combat="r.info && !r.info.combatGuess ? r.info.combat : null" :qp="r.info?.qpReq || 0" />
                  <div v-if="r.prereq.length" class="trk-chips"><span class="trk-lead">Finish first</span><QuestChip v-for="p in r.prereq" :key="p" :name="p" /></div>
                  <p v-if="!hasNeeds(r)" class="trk-none">{{ r.info ? 'Nothing to meet: you can start it now.' : 'Requirements are not listed yet.' }}</p>
                </section>
                <section class="trk-block">
                  <h4>You get</h4>
                  <ul v-if="r.xp" class="trk-gets">
                    <li v-for="g in gets(r)" :key="g.skill">
                      <img :src="skillIconSrc(g.skill)" :alt="g.skill" width="22" height="22" />
                      <span class="trk-gets-main"><b>{{ formatXp(g.xp) }} XP</b><small>{{ g.skill }}</small></span>
                      <span class="trk-gets-right">
                        <i class="trk-gets-bar" aria-hidden="true"><s :style="{ width: `${g.pct}%` }" /></i>
                        <span v-if="g.change" class="trk-gets-lvl" :class="{ up: g.change.gain > 0 }">
                          <template v-if="g.change.gain > 0">Level {{ g.change.from }} <span aria-hidden="true">→</span> <b>{{ g.change.to }}</b> <em>+{{ g.change.gain }} level{{ g.change.gain === 1 ? '' : 's' }}</em></template>
                          <template v-else-if="g.change.to >= 99">Level {{ g.change.from }}, already maxed</template>
                          <template v-else>Level {{ g.change.from }}, {{ g.change.pct }}% to {{ g.change.to + 1 }}</template>
                        </span>
                      </span>
                    </li>
                  </ul>
                  <p v-if="r.info?.lamps?.length" class="trk-lamp"><span aria-hidden="true">✦</span> Also an XP lamp. Its skill is your choice, so it is not counted in plans.</p>
                  <p v-if="!r.xp && !r.info?.lamps?.length" class="trk-lamp">No set XP reward.<template v-if="r.info?.qp"> Worth {{ r.info.qp }} quest point{{ r.info.qp === 1 ? '' : 's' }}.</template></p>
                </section>
              </div>

              <section v-if="r.unlocks.length" class="trk-block">
                <h4>Opens in the planner</h4>
                <MethodCards :unlocks="r.unlocks" />
              </section>
              <p v-if="r.info?.url" class="trk-wiki"><a :href="r.info.url" target="_blank" rel="noopener">{{ r.name }} on the OSRS Wiki</a></p>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <div class="trk-bulk">
      <button class="btn-text" type="button" :disabled="!shown.length || allShownDone" @click="markShown(true)">Mark the {{ shown.length }} shown as done</button>
      <button class="btn-text" type="button" :disabled="!shown.some((r) => r.done)" @click="markShown(false)">Clear the shown</button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { QUEST_LIST, QUEST_TYPES } from '@/data/questList'
import { LENGTH_MINUTES, getQuest } from '@/data/quests'
import { useRequirements } from '@/composables/useRequirements'
import { useTrackerPlayer } from '@/composables/useTrackerPlayer'
import { levelAtXp, xpAtLevel } from '@/utils/planner'
import { questSlug } from '@/utils/questSlug'
import { unlocksFor } from '@/utils/trackerUnlocks'
import { shortfalls } from '@/utils/trackerSuggestions'
import { formatXp, skillIconSrc } from '@/utils/osrsSkills'
import { track } from '@/utils/analytics'
import QuestChip from '@/components/tracker/QuestChip.vue'
import SkillReqGrid from '@/components/tracker/SkillReqGrid.vue'
import MethodCards from '@/components/tracker/MethodCards.vue'

const props = defineProps({ focus: { type: Object, default: null } })
const emit = defineEmits(['focused'])
const { confirmations, setQuestDone, setMany } = useRequirements()
const { levels, xp: playerXp } = useTrackerPlayer()

const search = ref('')
const status = ref('all')
const type = ref('')
const sort = ref('az')
const open = ref(new Set())
const flashSlug = ref('')

const hasNeeds = (r) => !!(r.info && (Object.keys(r.info.reqs).length || r.info.qpReq || r.prereq.length || (r.info.combat && !r.info.combatGuess)))
const timeText = (r) => {
  const m = LENGTH_MINUTES[r.info.length]
  return m >= 60 ? `About ${m / 60 === Math.floor(m / 60) ? m / 60 : (m / 60).toFixed(1)} h` : `About ${m} min`
}
// The skills a quest gives XP in, biggest first, each with how big it is next to the biggest.
// With a player's XP: the level they are at and the level the reward takes them to.
const levelChange = (skill, reward) => {
  const have = playerXp.value?.[skill]
  if (have == null) return null
  const from = levelAtXp(have, true)
  const to = levelAtXp(have + reward, true)
  // How far through the level you would be after the reward (for when it does not reach the next one).
  const after = have + reward
  const span = to >= 99 ? 0 : xpAtLevel(to + 1) - xpAtLevel(to)
  return { from, to, gain: to - from, pct: span ? Math.round(((after - xpAtLevel(to)) / span) * 100) : 100 }
}
const gets = (r) => {
  const list = Object.entries(r.info.rewards).map(([skill, xp]) => ({ skill, xp })).sort((a, b) => b.xp - a.xp)
  const top = list[0]?.xp || 1
  return list.map((g) => ({ ...g, pct: Math.max(8, Math.round((g.xp / top) * 100)), change: levelChange(g.skill, g.xp) }))
}
// Levels a whole quest would give across its skills (0 without a player).
const levelsGained = (info) => (info && playerXp.value ? Object.entries(info.rewards).reduce((sum, [skill, reward]) => sum + (levelChange(skill, reward)?.gain || 0), 0) : 0)
const xpOf = (info) => (info ? Object.values(info.rewards).reduce((s, n) => s + n, 0) : 0)
const xpText = (info) => (info ? Object.entries(info.rewards).map(([k, v]) => `${formatXp(v)} ${k}`).join(', ') : '')
// Quest ids in data/quests.js are the slug of the name, except three old ones; the tracker's own slug always comes from the name.
const slugOfId = (id) => (getQuest(id) ? questSlug(getQuest(id).name) : id)

// The facts about each quest, once. What changes with the player's answers and levels is read below.
const BASE = QUEST_LIST.map((q) => {
  const info = getQuest(q.slug)
  const unlocks = unlocksFor(q.id)
  return { ...q, info, unlocks, xp: xpOf(info), xpText: xpText(info), needs: info ? Object.entries(info.reqs) : [], prereq: info ? info.requires.map((id) => getQuest(id)?.name).filter(Boolean) : [] }
})

const doneSlugs = computed(() => new Set(BASE.filter((r) => confirmations.value[r.id] === 'have').map((r) => r.slug)))
const rows = computed(() =>
  BASE.map((r) => {
    const done = confirmations.value[r.id] === 'have'
    const gaps = shortfalls(r.info?.reqs, levels.value)
    const firstUndone = r.info ? r.info.requires.filter((id) => !doneSlugs.value.has(slugOfId(id))) : []
    // 'ready' / 'locked' only when a player's levels are known and the quest has details to check.
    const ready = levels.value && r.info && !r.info.incomplete ? (gaps.length || firstUndone.length ? 'locked' : 'ready') : null
    const lockText = [gaps.length ? gaps.map((g) => `${g.need} ${g.skill} (you are ${g.have})`).join(', ') : '', firstUndone.length ? `Quests first: ${firstUndone.map((id) => getQuest(id).name).join(', ')}` : ''].filter(Boolean).join('. ')
    const lockShort = gaps.length ? `${gaps[0].need} ${gaps[0].skill}${gaps.length > 1 ? ` +${gaps.length - 1}` : ''}` : 'a quest first'
    return { ...r, done, state: confirmations.value[r.id] || null, ready, lockText, lockShort, gain: levelsGained(r.info) }
  }),
)

const statusTabs = computed(() => {
  const list = rows.value.filter((r) => !type.value || r.type === type.value)
  const tabs = [
    { key: 'all', label: 'All', count: list.length },
    { key: 'todo', label: 'To do', count: list.filter((r) => !r.done).length },
  ]
  if (levels.value) tabs.push({ key: 'ready', label: 'Ready now', count: list.filter((r) => !r.done && r.ready === 'ready').length })
  tabs.push({ key: 'done', label: 'Done', count: list.filter((r) => r.done).length })
  return tabs
})

// How useful a quest is for training: the methods it opens count most, then its XP.
const score = (r) => r.unlocks.length * 3 + Math.min(r.xp / 10000, 10)
const minutesOf = (r) => (r.info?.length ? LENGTH_MINUTES[r.info.length] : 9999)

const shown = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = rows.value.filter((r) => {
    if (type.value && r.type !== type.value) return false
    if (term && !r.name.toLowerCase().includes(term)) return false
    if (status.value === 'done' && !r.done) return false
    if (status.value === 'todo' && r.done) return false
    if (status.value === 'ready' && (r.done || r.ready !== 'ready')) return false
    return true
  })
  if (sort.value === 'useful') return [...list].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
  if (sort.value === 'short') return [...list].sort((a, b) => minutesOf(a) - minutesOf(b) || a.name.localeCompare(b.name))
  return list
})
// By type (free, members, miniquests) when sorted by type; one list when sorted another way.
const groups = computed(() => {
  if (sort.value !== 'az' || type.value) return [{ key: 'all', title: '', done: 0, rows: shown.value }]
  return Object.entries(QUEST_TYPES)
    .map(([key, label]) => {
      const list = shown.value.filter((r) => r.type === key)
      return { key, title: key === 'F' ? 'Free-to-play quests' : key === 'M' ? 'Members quests' : 'Miniquests', label, done: list.filter((r) => r.done).length, rows: list }
    })
    .filter((g) => g.rows.length)
})
const allShownDone = computed(() => shown.value.every((r) => r.done))

function flip(slug) {
  const next = new Set(open.value)
  if (!next.delete(slug)) next.add(slug)
  open.value = next
}
function reset() {
  search.value = ''
  status.value = 'all'
  type.value = ''
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
function markGroup(g, done) {
  const patch = {}
  for (const r of g.rows) if (r.done !== done) patch[r.id] = done ? 'have' : null
  setMany(patch)
  track('quest_tracker_bulk', { done, count: g.rows.length, group: g.key })
}

// A suggestion's "Details": open that quest and bring it into view.
watch(
  () => props.focus,
  async (f) => {
    if (!f || f.kind !== 'quest') return
    const slug = f.id.replace(/^quest:/, '')
    reset()
    open.value = new Set([...open.value, slug])
    await nextTick()
    const el = document.getElementById(`quest-${slug}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    flashSlug.value = slug
    setTimeout(() => (flashSlug.value = ''), 1600)
    emit('focused')
  },
  { immediate: true },
)
</script>
