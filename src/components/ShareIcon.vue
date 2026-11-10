<template>
  <svg v-if="name === 'x'" viewBox="0 0 24 24" :width="size" :height="size" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3zm-1.1 16.2h1.7L7.2 4.7H5.4l11.3 14.5z" /></svg>
  <svg v-else viewBox="0 0 24 24" :width="size" :height="size" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'link'"><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1" /></template>
    <template v-else-if="name === 'reddit'"><circle cx="12" cy="13" r="7" /><path d="M9 15.2c1.7 1.3 4.3 1.3 6 0" /><circle cx="9.3" cy="12.2" r="0.6" fill="currentColor" /><circle cx="14.7" cy="12.2" r="0.6" fill="currentColor" /><path d="M12 6l1.2-3 3 .8" /></template>
    <template v-else-if="name === 'message'"><path d="M21 12a8 8 0 01-11.8 7L4 20l1.2-4.4A8 8 0 1121 12z" /></template>
    <template v-else-if="name === 'image'"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 9" /></template>
    <template v-else-if="name === 'share'"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.7l6.8-4M8.6 13.3l6.8 4" /></template>
    <template v-else-if="name === 'snapshot'"><path d="M4 8a2 2 0 012-2h2l1.5-2h5L16 6h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" /><circle cx="12" cy="13" r="3.5" /></template>
    <template v-else-if="name === 'live'"><circle cx="12" cy="12" r="2.4" fill="currentColor" /><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9" /></template>
    <template v-else-if="name === 'download'"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" /></template>
  </svg>
</template>

<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 16 },
})
</script>
