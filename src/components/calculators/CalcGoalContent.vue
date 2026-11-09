<template>
  <div class="goal-content">
    <section class="card goal-answer">
      <h2>{{ content.skill }} {{ content.label }}: the quick answer</h2>
      <p>{{ content.summary }}</p>
      <div class="planner-table-scroll">
        <table class="planner-table">
          <caption class="sr-only">{{ content.skill }} {{ content.label }} routes compared</caption>
          <thead><tr><th>Route</th><th class="num">Time</th><th class="num">Net GP</th><th class="num">At {{ perDay }} h a day</th></tr></thead>
          <tbody>
            <tr v-for="r in content.routes" :key="r.id">
              <td>{{ r.label }}</td>
              <td class="num">{{ r.hoursText }}</td>
              <td class="num" :class="gpClass(r.netGp)">{{ r.gpText }}</td>
              <td class="num">{{ days(r.hours) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="planner-hint">Estimates use typical xp and gp rates for each method. Enter your current XP in the calculator above for numbers that fit your account.</p>
    </section>

    <section class="card">
      <h2>Fastest route, level by level</h2>
      <div class="planner-table-scroll">
        <table class="planner-table">
          <caption class="sr-only">Fastest {{ content.skill }} route from {{ content.from }} to {{ content.to }}</caption>
          <thead><tr><th>Levels</th><th>Method</th><th class="num">XP</th><th class="num">XP per hour</th><th class="num">Time</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in fastSteps" :key="i">
              <td>{{ s.from }} to {{ s.to }}</td>
              <td>{{ s.method }}</td>
              <td class="num">{{ formatNum(s.xp) }}</td>
              <td class="num">{{ formatNum(s.xpPerHour) }}</td>
              <td class="num">{{ s.hoursText }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2>{{ content.skill }} methods between level {{ content.from }} and {{ content.to }}</h2>
      <div class="planner-table-scroll">
        <table class="planner-table">
          <caption class="sr-only">{{ content.skill }} training methods</caption>
          <thead><tr><th>Method</th><th>Levels</th><th class="num">XP per hour</th><th class="num">GP per hour</th></tr></thead>
          <tbody>
            <tr v-for="m in content.methods" :key="m.name">
              <td>{{ m.name }}</td>
              <td>{{ m.minLevel }}{{ m.maxLevel != null ? ` to ${m.maxLevel}` : '+' }}</td>
              <td class="num">{{ formatNum(m.xpPerHour) }}</td>
              <td class="num" :class="gpClass(m.gpPerHour)">{{ m.gpText }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h2>{{ content.skill }} XP milestones</h2>
      <div class="planner-table-scroll">
        <table class="planner-table">
          <caption class="sr-only">{{ content.skill }} XP needed per level</caption>
          <thead><tr><th>Level</th><th class="num">Total XP</th><th class="num">XP from level {{ content.from }}</th></tr></thead>
          <tbody>
            <tr v-for="m in content.milestones" :key="m.level">
              <td>{{ m.level }}</td>
              <td class="num">{{ formatNum(m.totalXp) }}</td>
              <td class="num">{{ formatNum(m.fromStart) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card goal-faq">
      <h2>{{ content.skill }} {{ content.label }}: common questions</h2>
      <div v-for="f in content.faq" :key="f.q" class="goal-faq-item">
        <h3>{{ f.q }}</h3>
        <p>{{ f.a }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatNum } from '@/utils/planner'

const props = defineProps({ content: { type: Object, required: true } })
const perDay = 2
const fastSteps = computed(() => props.content.routes.find((r) => r.id === 'fast')?.steps || [])
const gpClass = (gp) => (gp == null ? '' : gp >= 0 ? 'planner-gain' : 'planner-cost')
const days = (h) => {
  const d = Math.max(Math.ceil(h / perDay), 1)
  return `${d.toLocaleString('en-US')} day${d === 1 ? '' : 's'}`
}
</script>
