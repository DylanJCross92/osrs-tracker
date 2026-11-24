<template>
  <div v-if="data.rows.length || notes.length || itemFree" class="planner-materials">
    <div class="mat-head">
      <h4 class="goal-section-title">{{ ironModeRef ? 'Supplies to gather' : title }}</h4>
      <div v-if="data.rows.length" class="mat-badges gp-figure">
        <GePriceBadge />
        <PriceBasisToggle />
      </div>
    </div>
    <p v-if="itemFree" class="planner-hint">{{ ironModeRef ? 'This route uses no items you have to bring, so there is nothing to gather.' : 'This route uses no items you have to bring, so there is nothing to buy.' }}</p>
    <p v-if="ironModeRef && data.rows.length" class="planner-hint">The items to gather yourself for this route, with how many. Gathering them takes time too, which the hours above do not include.</p>
    <div v-if="data.rows.length" class="mat-scroll-x">
      <table class="mat-table">
        <thead>
          <tr><th>Item</th><th class="num">Needed</th><th class="mat-op gp-figure" aria-hidden="true" /><th class="num mat-each gp-figure">Price each</th><th class="mat-op gp-figure" aria-hidden="true" /><th class="num gp-figure">Cost</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in totals" :key="t.name">
            <td>
              <component :is="t.slug ? 'RouterLink' : 'span'" class="mat-item" :to="t.slug ? { name: 'item', params: { slug: t.slug } } : undefined" :title="t.slug ? `${t.name}: see its Grand Exchange price and history` : undefined" @click.capture="t.slug && onItemLinkClick($event, t.slug, 'materials')">
                <img :src="iconSrc(t.name)" alt="" width="26" height="26" loading="lazy" @error="hide" /><span>{{ t.name }}<small v-if="t.each != null" class="mat-sub gp-figure">{{ t.approx ? "~" : "" }}{{ formatNum(t.qty) }} × {{ gpText(t.each) }} gp</small></span>
              </component>
            </td>
            <td class="num">{{ t.approx ? "~" : "" }}{{ formatNum(t.qty) }}</td>
            <td class="mat-op gp-figure" aria-hidden="true">{{ t.each == null ? '' : '×' }}</td>
            <td class="num mat-each gp-figure">{{ t.each == null ? '-' : `${gpText(t.each)} gp` }}</td>
            <td class="mat-op gp-figure" aria-hidden="true">{{ t.each == null ? '' : '=' }}</td>
            <td class="num mat-cost gp-figure"><b v-if="t.cost != null">{{ gpText(t.cost) }} gp</b><span v-else class="mat-none" title="This item has no Grand Exchange price right now">no price</span></td>
          </tr>
        </tbody>
        <tfoot v-if="priced.total != null">
          <tr>
            <td class="mat-total-label">Total<small v-if="priced.missing"> ({{ priced.missing }} {{ priced.missing === 1 ? 'item has' : 'items have' }} no price and {{ priced.missing === 1 ? 'is' : 'are' }} not counted)</small></td>
            <td class="num mat-total-qty">{{ totalItems.approx ? "~" : "" }}{{ formatNum(totalItems.qty) }}</td>
            <td class="mat-op gp-figure" /><td class="mat-each gp-figure" /><td class="mat-op gp-figure" />
            <td class="num gp-figure"><b>{{ gpText(priced.total) }} gp</b></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <details v-if="data.rows.length" class="planner-all-methods">
      <summary>Materials for each level</summary>
      <div class="planner-table-scroll mat-scroll">
        <table class="planner-table">
          <thead><tr><th>To reach</th><th>Materials</th><th class="num gp-figure">Cost</th><th>Method</th></tr></thead>
          <tbody>
            <tr v-for="r in data.rows" :key="r.level + r.method">
              <td>Level {{ r.level }}</td>
              <td>
                <span v-for="it in r.items" :key="it.name" class="mat-inline">
                  <img :src="iconSrc(it.name)" :alt="it.name" width="22" height="22" loading="lazy" @error="hide" />{{ formatNum(it.qty) }} {{ it.name }}
                </span>
              </td>
              <td class="num mat-cost gp-figure">{{ rowCost(r) == null ? '-' : `${gpText(rowCost(r))} gp` }}</td>
              <td class="planner-table-note">{{ r.method }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
    <p v-for="n in notes" :key="n" class="planner-hint mat-note">{{ n }}</p>
    <p v-if="totals.some((t) => t.approx)" class="planner-hint">~ marks amounts that are estimates, because the xp for each item depends on what you make.</p>
    <p v-if="data.rows.length" class="planner-hint"><span class="gp-figure">{{ priceBasis === 'instant' ? 'Prices are what you pay buying at once, from the latest Grand Exchange trades on the OSRS Wiki.' : 'Prices are the middle of the latest Grand Exchange buy and sell price, from the OSRS Wiki.' }} </span>Quantities assume no burns, failures or lost items, and tools and gear are not listed. Item icons come from the OSRS Wiki.</p>
  </div>
</template>

<script setup>
import { ironModeRef } from '@/composables/useAccountType'
import { computed } from 'vue'
import { materialsForPlan } from '@/utils/plannerTools'
import { formatNum } from '@/utils/planner'
import { buyOf, iconOf, priceBasis, slugOf } from '@/utils/priceBook'
import { gpText, itemImage } from '@/utils/geFormat'
import GePriceBadge from '@/components/GePriceBadge.vue'
import PriceBasisToggle from '@/components/PriceBasisToggle.vue'
import { onItemLinkClick } from '@/composables/useItemModal'

const props = defineProps({ plan: { type: Object, required: true }, title: { type: String, default: 'Materials needed' } })
const data = computed(() => materialsForPlan(props.plan))
// What the list does not cover, so a missing item is never mistaken for one that is not needed.
const notes = computed(() => {
  const out = []
  if (data.value.untracked.length) out.push(`Not listed: what ${joinNames(data.value.untracked)} use${data.value.untracked.length === 1 ? 's' : ''} up is not tracked yet, so it is not in the quantities or the total.`)
  if (data.value.supplies.length) out.push(`Not listed: the food, potions and ammo for ${joinNames(data.value.supplies)} depend on how you train.`)
  return out
})
// Nothing to buy only when every method in the plan is known to need nothing.
const itemFree = computed(() => !data.value.rows.length && !data.value.untracked.length && !data.value.supplies.length)
const joinNames = (list) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`)
const rowCost = (r) => {
  let total = 0
  for (const it of r.items) {
    const each = buyOf(it.name)
    if (each == null) return null
    total += each * it.qty
  }
  return Math.round(total)
}
// The shopping list at today's prices (the middle of the buy and sell price, or instant buy prices), with what could not be priced counted apart.
const priced = computed(() => {
  let total = 0
  let missing = 0
  let any = false
  const costs = new Map()
  for (const t of data.value.totals) {
    const each = buyOf(t.name)
    if (each == null) missing++
    else {
      any = true
      costs.set(t.name, each * t.qty)
      total += each * t.qty
    }
  }
  return { total: any ? Math.round(total) : null, missing, costs }
})
// How many items the whole list needs, for the total line (marked as an estimate when any amount is).
const totalItems = computed(() => ({ qty: data.value.totals.reduce((sum, t) => sum + t.qty, 0), approx: data.value.totals.some((t) => t.approx) }))
const totals = computed(() =>
  data.value.totals
    .map((t) => ({ ...t, each: buyOf(t.name), slug: slugOf(t.name), cost: priced.value.costs.has(t.name) ? Math.round(priced.value.costs.get(t.name)) : null }))
    // The items that cost the most first.
    .sort((a, b) => (b.cost ?? -1) - (a.cost ?? -1)),
)
// The item's real picture once its price is known, otherwise the one its name suggests.
const iconSrc = (name) => itemImage(iconOf(name), name)
const hide = (e) => (e.target.style.visibility = 'hidden')
</script>
