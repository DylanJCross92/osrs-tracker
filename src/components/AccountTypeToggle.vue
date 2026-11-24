<template>
  <div class="acct-toggle" role="group" aria-label="Account type">
    <span v-if="label" class="acct-label">{{ label }}</span>
    <div class="range-tabs">
      <button type="button" :class="{ active: modelValue }" :aria-pressed="modelValue" title="Every skill and training method" @click="$emit('update:modelValue', true)">Members</button>
      <button type="button" :class="{ active: !modelValue }" :aria-pressed="!modelValue" title="Only free methods, from the wiki's free-to-play guides" @click="$emit('update:modelValue', false)">Free-to-play</button>
    </div>
    <!-- Main account or ironman (shown where the page can use it) -->
    <div v-if="iron !== undefined" class="range-tabs" role="group" aria-label="Main account or ironman">
      <button type="button" :class="{ active: !iron }" :aria-pressed="!iron" title="You can buy and sell on the Grand Exchange" @click="$emit('update:iron', false)">Main</button>
      <button type="button" :class="{ active: iron }" :aria-pressed="iron" title="You gather everything yourself: gp does not matter, the cheapest routes lead" @click="$emit('update:iron', true)">Ironman</button>
    </div>
  </div>
</template>

<script setup>
// The members / free-to-play switch, and (when `iron` is given) the main account / ironman switch, used in the planners and calculators.
defineProps({ modelValue: { type: Boolean, default: true }, iron: { type: Boolean, default: undefined }, label: { type: String, default: '' } })
defineEmits(['update:modelValue', 'update:iron'])
</script>
