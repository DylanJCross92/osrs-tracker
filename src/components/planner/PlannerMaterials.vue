<template>
  <div v-if="data.rows.length" class="planner-materials">
    <h4 class="goal-section-title">Materials needed</h4>
    <ul class="mat-totals">
      <li v-for="t in data.totals" :key="t.name" class="mat-chip">
        <img :src="itemIconUrl(t.name)" :alt="t.name" width="28" height="28" loading="lazy" @error="hide" />
        <span><b>{{ formatNum(t.qty) }}</b> {{ t.name }}</span>
      </li>
    </ul>
    <details class="planner-all-methods">
      <summary>Materials for each level</summary>
      <div class="planner-table-scroll mat-scroll">
        <table class="planner-table">
          <thead><tr><th>To reach</th><th>Materials</th><th>Method</th></tr></thead>
          <tbody>
            <tr v-for="r in data.rows" :key="r.level + r.method">
              <td>Level {{ r.level }}</td>
              <td>
                <span v-for="it in r.items" :key="it.name" class="mat-inline">
                  <img :src="itemIconUrl(it.name)" :alt="it.name" width="22" height="22" loading="lazy" @error="hide" />{{ formatNum(it.qty) }} {{ it.name }}
                </span>
              </td>
              <td class="planner-table-note">{{ r.method }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
    <p class="planner-hint">Quantities assume no burns, failures or lost items. Tools and gear are not listed. Item icons come from the OSRS Wiki.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { itemIconUrl } from '@/data/methodMaterials'
import { materialsForPlan } from '@/utils/plannerTools'
import { formatNum } from '@/utils/planner'

const props = defineProps({ plan: { type: Object, required: true } })
const data = computed(() => materialsForPlan(props.plan))
const hide = (e) => (e.target.style.visibility = 'hidden')
</script>
