<template>
  <div class="card info-page">
    <h1>Unsubscribe</h1>
    <p v-if="state === 'working'" class="info-updated">One moment…</p>
    <template v-else-if="state === 'done'">
      <p><b>You're unsubscribed.</b> We won't email you again. If that was a mistake, you can sign up again from the footer of any page.</p>
    </template>
    <template v-else>
      <p>That unsubscribe link isn't valid. If you still get emails from us, reply to one and we'll remove you by hand, or use the <RouterLink to="/contact">contact page</RouterLink>.</p>
    </template>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { newsletterApi } from '@/api/newsletter'
import { setPageMeta } from '@/utils/pageMeta'

const route = useRoute()
const state = ref('working')

setPageMeta({ title: 'Unsubscribe', description: 'Unsubscribe from TickGains news emails.', path: '/unsubscribe' })

// Keep this page out of search results.
let robots = null
onMounted(async () => {
  robots = document.createElement('meta')
  robots.name = 'robots'
  robots.content = 'noindex'
  document.head.appendChild(robots)
  const token = typeof route.query.t === 'string' ? route.query.t : ''
  try {
    await newsletterApi.unsubscribe(token)
    state.value = 'done'
  } catch {
    state.value = 'invalid'
  }
})
onBeforeUnmount(() => robots?.remove())
</script>
