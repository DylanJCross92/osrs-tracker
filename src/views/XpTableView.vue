<template>
  <div class="calc-dir planner xt">
    <section class="card xt-main">
      <span class="calc-eyebrow">Levels 1 to {{ MAX_VIRTUAL_LEVEL }}</span>
      <h1>OSRS <span class="home-accent">XP</span> Table</h1>
      <p class="calc-lead">{{ page.lead }}</p>
      <div class="planner-table-scroll">
        <table class="planner-table xt-table">
          <caption class="sr-only">Experience needed for each level</caption>
          <thead><tr><th>Level</th><th class="num">Total XP</th><th class="num">To next</th><th class="num">Of level 99</th></tr></thead>
          <tbody>
            <tr v-for="r in page.rows" :key="r.level" :class="{ 'xt-key': KEY_LEVELS.has(r.level), 'xt-past': r.level > 99 }">
              <td>{{ r.level }}</td>
              <td class="num">{{ formatNum(r.xp) }}</td>
              <td class="num">{{ r.toNext == null ? '' : formatNum(r.toNext) }}</td>
              <td class="num">{{ r.level > 99 ? '' : `${r.pctOf99 < 10 ? r.pctOf99.toFixed(1) : Math.round(r.pctOf99)}%` }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="planner-hint">Every skill uses this same table. Levels above 99 are virtual: they show on the hiscores but unlock nothing new.</p>
    </section>

    <section class="card goal-faq">
      <h2>Common questions</h2>
      <div v-for="f in page.faq" :key="f.q" class="goal-faq-item">
        <h3>{{ f.q }}</h3>
        <p>{{ f.a }}</p>
      </div>
    </section>

    <section class="card">
      <h2>Work out your own numbers</h2>
      <p class="calc-lead">Pick a <RouterLink to="/calculators">skill calculator</RouterLink> for hours and gp, or see a <RouterLink to="/plans">whole-account plan guide</RouterLink> such as the <RouterLink to="/plans/max-cape">max cape plan</RouterLink>.</p>
    </section>
  </div>
</template>

<script setup>
import { setPageMeta } from '@/utils/pageMeta'
import { buildXpTable } from '@/data/xpTable'
import { MAX_VIRTUAL_LEVEL, formatNum } from '@/utils/planner'

const page = buildXpTable()
setPageMeta({ title: page.title.replace(' | TickGains', ''), description: page.description, path: page.path })

const KEY_LEVELS = new Set([50, 70, 80, 90, 92, 99, 126])
</script>
