<template>
  <article class="trk-page gb-page">
    <header class="pgh">
      <div class="pgh-title">
        <h1>{{ state === 'manual' ? 'Restore your data' : 'Bringing your session back' }}</h1>
        <p class="pgh-sub">
          <template v-if="state === 'working'">Reading your saved session…</template>
          <template v-else-if="state === 'done'">Restored. Taking you there…</template>
          <template v-else>Paste a save code or link to add what it holds to this browser. Nothing here is removed.</template>
        </p>
      </div>
    </header>

    <section v-if="state === 'done'" class="gb-pane gb-done" role="status">
      <ul class="gb-has">
        <li v-for="r in restored" :key="r.name"><template v-if="r.count != null"><b>{{ r.count }}</b>&nbsp;</template>{{ r.label }}</li>
      </ul>
    </section>

    <template v-else-if="state === 'manual'">
      <p v-if="failed" class="gb-error">That link did not hold a valid saved session. Check that the whole link was copied, or paste a save code below.</p>
      <GuestBackup start="restore" />
    </template>
  </article>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { setPageMeta } from '@/utils/pageMeta'
import { applyBackup, decodeBackup } from '@/utils/guestBackup'
import { track } from '@/utils/analytics'
import GuestBackup from '@/components/guest/GuestBackup.vue'

setPageMeta({ title: 'Restore your TickGains session', description: 'Bring a saved TickGains session back to this browser.', path: '/restore', noindex: true })

// A link made by "Copy link to save session" carries everything after the # (which the site never receives). Opening it adds all of that to this browser
// (nothing is removed) and goes on to the page that matters most; without a valid link the person can paste a code instead.
const state = ref('working') // 'working' | 'done' | 'manual'
const failed = ref(false)
const restored = ref([])

function destination(data = {}) {
  if (data.me) return '/'
  const done = Object.keys(data.requirements || {}).some((k) => /^(quest|diary):/.test(k))
  if (done) return '/quests'
  if (data.plans?.length || data.planner?.goals?.length) return '/planner'
  return '/'
}

onMounted(async () => {
  const code = decodeURIComponent(window.location.hash.replace(/^#/, ''))
  if (!code) {
    state.value = 'manual'
    return
  }
  const backup = await decodeBackup(code)
  if (!backup) {
    failed.value = true
    state.value = 'manual'
    return
  }
  restored.value = applyBackup(backup)
  state.value = 'done'
  track('session_link_restore', { pieces: restored.value.length })
  // Everything reads its storage when the page starts, so a full load of the next page is the simplest way for all of it to pick the data up.
  setTimeout(() => window.location.assign(destination(backup.data)), 1400)
})
</script>
