<template>
  <input
    ref="el"
    type="text"
    inputmode="numeric"
    autocomplete="off"
    :value="display"
    @input="onInput"
    @blur="onBlur"
    @keydown.enter="onBlur"
  />
</template>

<script setup>
import { ref, watch } from 'vue'

// Whole-number field that groups thousands as you type (1,234,567), strips
// anything that isn't a digit, and clamps to [min, max] — max immediately,
// min on blur so you can still clear the box and retype.
const props = defineProps({
  modelValue: { type: Number, default: null },
  min: { type: Number, default: 0 },
  max: { type: Number, default: Number.MAX_SAFE_INTEGER },
})
const emit = defineEmits(['update:modelValue'])

const el = ref(null)
const fmt = (n) => (n == null || Number.isNaN(n) ? '' : Math.floor(n).toLocaleString('en-US'))
const display = ref(fmt(props.modelValue))

watch(
  () => props.modelValue,
  (v) => {
    const typed = parseInt(display.value.replace(/,/g, ''), 10)
    if (v == null ? display.value !== '' && !Number.isNaN(typed) : typed !== v) display.value = fmt(v)
  },
)

function onInput(e) {
  const input = e.target
  const caretDigits = input.value.slice(0, input.selectionStart).replace(/\D/g, '').length
  const digits = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
  if (digits === '') {
    display.value = ''
    input.value = ''
    emit('update:modelValue', null)
    return
  }
  const n = Math.min(parseInt(digits, 10), props.max)
  display.value = fmt(n)
  input.value = display.value
  emit('update:modelValue', n)
  // Put the caret back after the same number of digits it was after.
  let pos = 0
  let seen = 0
  while (pos < display.value.length && seen < caretDigits) {
    if (/\d/.test(display.value[pos])) seen++
    pos++
  }
  input.setSelectionRange(pos, pos)
}

function onBlur() {
  const typed = parseInt(display.value.replace(/,/g, ''), 10)
  const n = Math.min(Math.max(Number.isNaN(typed) ? props.min : typed, props.min), props.max)
  display.value = fmt(n)
  if (el.value) el.value.value = display.value
  emit('update:modelValue', n)
}
</script>
