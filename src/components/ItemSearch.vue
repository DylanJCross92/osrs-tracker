<template>
  <div ref="root" class="gxs" :class="size === 'hero' ? 'is-hero' : 'is-compact'">
    <div class="gxs-box" :class="{ 'is-open': showList }">
      <svg class="gxs-ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input
        ref="input"
        v-model="query"
        class="gxs-input"
        type="search"
        role="combobox"
        :placeholder="placeholder"
        aria-label="Search items"
        aria-autocomplete="list"
        aria-controls="gxs-list"
        :aria-expanded="showList"
        :aria-activedescendant="active >= 0 ? `gxs-opt-${active}` : undefined"
        autocomplete="off"
        data-1p-ignore
        @focus="onFocus"
        @keydown="onKey"
      />
      <button v-if="query" type="button" class="gxs-clear" aria-label="Clear the search" @click="clear">×</button>
    </div>
    <ul v-if="showList" id="gxs-list" class="gxs-list" role="listbox" aria-label="Matching items">
      <li v-for="(r, i) in results" :id="`gxs-opt-${i}`" :key="r.id" role="option" :aria-selected="i === active" :class="{ on: i === active }" @mouseenter="active = i" @mousedown.prevent="pick(r)">
        <img :src="itemImage('', r.name)" alt="" width="28" height="28" @error="hideImage" />
        <span class="gxs-name"><b>{{ r.name }}</b><small v-if="r.members">Members</small></span>
        <span class="gxs-price">{{ gpText(r.price) }} <small>gp</small></span>
        <span class="gxs-change" :class="changeClass(r.change7)">{{ pctText(r.change7) }}</span>
      </li>
      <li class="gxs-all" role="option" :aria-selected="active === results.length" :class="{ on: active === results.length }" :id="`gxs-opt-${results.length}`" @mouseenter="active = results.length" @mousedown.prevent="submit">
        See every item matching "{{ query.trim() }}"
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { changeClass, gpText, itemImage, pctText } from '@/utils/geFormat'
import { searchItems } from '@/utils/geTrending'

const props = defineProps({
  rows: { type: Array, required: true },
  // hero: the big box on the GE prices page; compact: the same look, a little smaller, for the other pages.
  size: { type: String, default: 'compact' },
  placeholder: { type: String, default: 'Search items' },
  autofocus: { type: Boolean, default: false },
})
// pick: one of the suggestions was chosen; submit: Enter (or the last line) with the text typed.
const emit = defineEmits(['pick', 'submit', 'focus'])

const root = ref(null)
const input = ref(null)
const query = ref('')
const open = ref(false)
const active = ref(-1)

const results = computed(() => searchItems(props.rows, query.value, 7))
const showList = computed(() => open.value && query.value.trim().length > 0 && results.value.length > 0)
watch(query, () => {
  active.value = -1
  open.value = true
})

// The first focus lets a page that loads the items late start loading them.
function onFocus() {
  open.value = true
  emit('focus')
}
function pick(r) {
  open.value = false
  emit('pick', r)
}
function submit() {
  open.value = false
  emit('submit', query.value.trim())
}
function clear() {
  query.value = ''
  input.value?.focus()
}
function onKey(e) {
  const last = results.value.length
  if (e.key === 'ArrowDown' && showList.value) {
    e.preventDefault()
    active.value = active.value >= last ? 0 : active.value + 1
  } else if (e.key === 'ArrowUp' && showList.value) {
    e.preventDefault()
    active.value = active.value <= 0 ? last : active.value - 1
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (showList.value && active.value >= 0 && active.value < last) pick(results.value[active.value])
    else if (query.value.trim()) submit()
  } else if (e.key === 'Escape') {
    if (open.value) open.value = false
    else query.value = ''
  }
}
const onOutside = (e) => {
  if (root.value && !root.value.contains(e.target)) open.value = false
}
const hideImage = (e) => {
  e.target.style.visibility = 'hidden'
}
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  if (props.autofocus) input.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
defineExpose({ focus: () => input.value?.focus() })
</script>
