<template>
  <div class="acct-toggle" role="group" aria-label="Account type">
    <span v-if="label" class="acct-label">{{ label }}</span>
    <div class="range-tabs">
      <button type="button" :class="{ active: modelValue }" :aria-pressed="modelValue" title="Every skill and training method" @click="$emit('update:modelValue', true)">Members</button>
      <button type="button" :class="{ active: !modelValue }" :aria-pressed="!modelValue" title="Only free methods, from the wiki's free-to-play guides" @click="$emit('update:modelValue', false)">Free-to-play</button>
    </div>
  </div>
</template>

<script setup>
// The members / free-to-play switch used in the planners and calculators.
defineProps({ modelValue: { type: Boolean, default: true }, label: { type: String, default: '' } })
defineEmits(['update:modelValue'])
</script>
