<template>
  <section class="cmp-skills">
    <div class="cmp-skills-head">
      <h2>Skill by skill</h2>
      <div class="range-tabs" role="group" aria-label="Sort skills">
        <button v-for="m in MODES" :key="m.key" :class="{ active: mode === m.key }" @click="mode = m.key">{{ m.label }}</button>
      </div>
    </div>

    <!-- Scoreboard: who wins more skills. Each card also filters the grid to that player's wins. -->
    <div class="cmp-board" role="group" aria-label="Skills won">
      <button class="cmp-board-card cmp-board-a" :class="{ active: filter === 'a', ahead: leads.a > leads.b }" :aria-pressed="filter === 'a'" @click="toggle('a')">
        <span class="cmp-board-name"><i class="cmp-key cmp-key-a" />{{ nameA }}</span>
        <b>{{ leads.a }}</b>
        <small>skills won</small>
      </button>
      <span class="cmp-board-vs" aria-hidden="true">VS</span>
      <button class="cmp-board-card cmp-board-b" :class="{ active: filter === 'b', ahead: leads.b > leads.a }" :aria-pressed="filter === 'b'" @click="toggle('b')">
        <span class="cmp-board-name"><i class="cmp-key cmp-key-b" />{{ nameB }}</span>
        <b>{{ leads.b }}</b>
        <small>skills won</small>
      </button>
    </div>
    <p class="cmp-rule">Each skill is won by whoever gained more XP {{ phrase }}. The star marks the winner of each row. Tap a player above to see only their wins.</p>

    <div v-if="shown.length" class="cmp-rows">
      <div class="cmp-rows-head" aria-hidden="true">
        <span class="cmp-rh-a"><i class="cmp-key cmp-key-a" />{{ nameA }}</span>
        <span class="cmp-rh-mid">Skill</span>
        <span class="cmp-rh-b">{{ nameB }}<i class="cmp-key cmp-key-b" /></span>
      </div>
      <div v-for="r in shown" :key="r.skill" class="cmp-row2" :class="r.winner ? `is-${r.winner}` : 'is-tie'">
        <div class="cmp-r-side cmp-r-a" :class="sideClass(r, 'a')">
          <div class="cmp-r-top">
            <small class="cmp-r-lv">Lv {{ r.a.level.toLocaleString('en-US') }}</small>
            <span class="cmp-r-gain"><b :class="{ 'cmp-gain': r.a.gain > 0 }">{{ gainText(r.a.gain) }}</b><em v-if="r.winner === 'a'" class="cmp-r-star" title="Wins this skill">★</em></span>
          </div>
          <div class="cmp-r-bar" aria-hidden="true"><i :style="{ width: width(r.a.gain) }" /></div>
        </div>
        <div class="cmp-r-mid">
          <img :src="skillIconSrc(r.skill)" :alt="r.skill" width="24" height="24" />
          <span>{{ r.skill }}</span>
        </div>
        <div class="cmp-r-side cmp-r-b" :class="sideClass(r, 'b')">
          <div class="cmp-r-top">
            <span class="cmp-r-gain"><em v-if="r.winner === 'b'" class="cmp-r-star" title="Wins this skill">★</em><b :class="{ 'cmp-gain': r.b.gain > 0 }">{{ gainText(r.b.gain) }}</b></span>
            <small class="cmp-r-lv">Lv {{ r.b.level.toLocaleString('en-US') }}</small>
          </div>
          <div class="cmp-r-bar" aria-hidden="true"><i :style="{ width: width(r.b.gain) }" /></div>
        </div>
      </div>
    </div>
    <p v-else class="empty-hint cmp-empty">{{ filter ? 'No skills to show for that filter.' : `Neither player has gained XP in any skill ${phrase}.` }}</p>

    <details v-if="sorted.idle.length && !filter" class="cmp-idle">
      <summary>{{ sorted.idle.length }} skills with no gains {{ phrase }}</summary>
      <div class="cmp-idle-chips">
        <span v-for="r in sorted.idle" :key="r.skill" class="cmp-chip" :title="`${r.skill}: ${nameA} Lv ${r.a.level}, ${nameB} Lv ${r.b.level}`"><img :src="skillIconSrc(r.skill)" :alt="r.skill" width="16" height="16" /><span class="cmp-lv-a">{{ r.a.level }}</span><em>:</em><span class="cmp-lv-b">{{ r.b.level }}</span></span>
      </div>
    </details>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { skillIconSrc, formatXp } from '@/utils/osrsSkills'
import { sortSkillRows, skillLeads } from '@/utils/compare'

const props = defineProps({
  rows: { type: Array, required: true },
  nameA: { type: String, required: true },
  nameB: { type: String, required: true },
  phrase: { type: String, default: '' },
})

const MODES = [
  { key: 'total', label: 'Most XP' },
  { key: 'gap', label: 'Biggest gap' },
  { key: 'skill', label: 'Skill order' },
]
const mode = ref('total')
const filter = ref('')
const toggle = (side) => (filter.value = filter.value === side ? '' : side)

const sorted = computed(() => sortSkillRows(props.rows, mode.value))
const leads = computed(() => skillLeads(props.rows))
const shown = computed(() => (filter.value ? sorted.value.active.filter((r) => r.winner === filter.value) : sorted.value.active))
// One scale for every skill so bars are comparable down the whole list.
const max = computed(() => Math.max(1, ...sorted.value.active.flatMap((r) => [r.a.gain, r.b.gain])))
const width = (g) => (g > 0 ? `${Math.max((g / max.value) * 100, 3)}%` : '0%')
const gainText = (g) => (g > 0 ? `+${formatXp(g)}` : '-')
// The winner's column is full strength; the loser's is dimmed so the result reads at a glance.
const sideClass = (r, side) => (r.winner === side ? 'is-win' : r.winner ? 'is-lose' : '')
</script>
