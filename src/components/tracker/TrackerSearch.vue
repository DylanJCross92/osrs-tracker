<template>
  <div class="trk-search-wrap" @focusout="onFocusOut">
    <label class="trk-search">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
      <!-- The rest of the top suggestion, in grey behind what is typed: Tab or the right arrow accepts it. -->
      <span v-if="ghost" class="trk-ghost" aria-hidden="true"><i>{{ modelValue }}</i>{{ ghost }}</span>
      <input
        ref="input"
        :value="modelValue"
        type="search"
        role="combobox"
        :placeholder="placeholder"
        :aria-label="ariaLabel"
        aria-autocomplete="both"
        :aria-expanded="show"
        :aria-controls="listId"
        :aria-activedescendant="active >= 0 ? `${listId}-${active}` : undefined"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        data-1p-ignore
        data-lpignore="true"
        @input="onInput"
        @focus="focused = true"
        @keydown="onKey"
      />
    </label>
    <ul v-if="show" :id="listId" class="trk-sugg" role="listbox" :aria-label="`${ariaLabel} suggestions`" @mousedown.prevent>
      <li v-for="(s, i) in suggestions" :id="`${listId}-${i}`" :key="s.value" role="option" :aria-selected="i === active" :class="{ on: i === active }" @mouseenter="active = i" @click="choose(s)">
        <span class="trk-sugg-main"><span v-html="mark(s.label)" /><small v-if="s.sub">{{ s.sub }}</small></span>
        <span v-if="s.badges?.length" class="trk-sugg-badges">
          <i v-for="b in s.badges" :key="b.text" :class="`is-${b.kind}`" :title="b.title">{{ b.text }}</i>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

// A search box that suggests as you type (matches at the start of a name first), completes the top one in grey, and can be driven from the keyboard:
// arrows move, Enter picks, Tab or the right arrow completes, Escape closes. items: [{ label, value, sub?, badges?: [{ text, kind, title? }] }].
const props = defineProps({
  modelValue: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Search' },
  ariaLabel: { type: String, default: 'Search' },
  max: { type: Number, default: 8 },
})
const emit = defineEmits(['update:modelValue', 'pick'])

const input = ref(null)
const focused = ref(false)
const dismissed = ref(false)
const active = ref(-1)
const listId = `trk-sugg-${Math.random().toString(36).slice(2, 8)}`

const norm = (s) => String(s).toLowerCase()
const suggestions = computed(() => {
  const term = norm(props.modelValue).trim()
  if (term.length < 1) return []
  const starts = []
  const inside = []
  for (const it of props.items) {
    const l = norm(it.label)
    if (l === term) continue
    if (l.startsWith(term)) starts.push(it)
    else if (l.includes(term) || l.split(/[\s'-]+/).some((w) => w.startsWith(term))) inside.push(it)
  }
  return [...starts, ...inside].slice(0, props.max)
})
const show = computed(() => focused.value && !dismissed.value && suggestions.value.length > 0)
// What to complete the text with: the rest of the first suggestion that starts with it, when the cursor is at the end.
const ghost = computed(() => {
  const term = props.modelValue
  const top = suggestions.value.find((s) => norm(s.label).startsWith(norm(term)))
  return focused.value && term.trim() && top && !dismissed.value ? top.label.slice(term.length) : ''
})

function onInput(e) {
  dismissed.value = false
  active.value = -1
  emit('update:modelValue', e.target.value)
}
function choose(s) {
  emit('update:modelValue', s.label)
  emit('pick', s)
  dismissed.value = true
  active.value = -1
}
function onKey(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!suggestions.value.length) return
    e.preventDefault()
    dismissed.value = false
    const n = suggestions.value.length
    active.value = e.key === 'ArrowDown' ? (active.value + 1) % n : (active.value - 1 + n) % n
  } else if (e.key === 'Enter') {
    const s = suggestions.value[active.value >= 0 ? active.value : 0]
    if (s && show.value) {
      e.preventDefault()
      choose(s)
    }
  } else if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghost.value && input.value && input.value.selectionStart === props.modelValue.length) {
    const top = suggestions.value.find((s) => norm(s.label).startsWith(norm(props.modelValue)))
    if (top) {
      e.preventDefault()
      emit('update:modelValue', top.label)
    }
  } else if (e.key === 'Escape' && show.value) {
    e.preventDefault()
    dismissed.value = true
  }
}
function onFocusOut(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) focused.value = false
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// The label with the part that matches what is typed in bold.
function mark(label) {
  const term = props.modelValue.trim()
  const at = norm(label).indexOf(norm(term))
  if (!term || at < 0) return esc(label)
  return `${esc(label.slice(0, at))}<b>${esc(label.slice(at, at + term.length))}</b>${esc(label.slice(at + term.length))}`
}
</script>
