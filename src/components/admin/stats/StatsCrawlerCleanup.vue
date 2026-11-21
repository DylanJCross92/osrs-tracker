<template>
  <section class="cc" aria-labelledby="cc-h">
    <h2 id="cc-h">Crawler cleanup <small>temporary</small></h2>
    <p class="cc-text">A crawler once opened every item page, and each page counted as a new visitor. Check what is left of that, and remove it. Nothing is deleted until you confirm.</p>
    <div class="cc-actions">
      <button class="btn btn-ghost" type="button" :disabled="busy" @click="check">{{ busy && !report ? 'Checking…' : report ? 'Check again' : 'Check' }}</button>
      <button v-if="report && report.visitors" class="btn po-delete" type="button" :disabled="busy" @click="asking = true">Delete {{ report.visitors.toLocaleString('en-US') }} visitors</button>
    </div>
    <p v-if="error" class="cl-banner is-error" role="alert">{{ error }}</p>
    <p v-if="done" class="cc-result" role="status">Deleted {{ done.visitors.toLocaleString('en-US') }} visitors and {{ done.events.toLocaleString('en-US') }} events.</p>
    <template v-if="report">
      <p v-if="!report.visitors" class="cc-result">Nothing to clean since {{ report.since }}.</p>
      <template v-else>
        <p class="cc-result">Found {{ report.visitors.toLocaleString('en-US') }} visitors ({{ report.events.toLocaleString('en-US') }} events) in {{ report.minutes.length }} busy {{ report.minutes.length === 1 ? 'minute' : 'minutes' }} since {{ report.since }}: each had a couple of steps in the same second, all on {{ report.prefix }} pages.</p>
        <ul class="cc-minutes">
          <li v-for="m in report.minutes" :key="m.minute"><time :datetime="m.minute">{{ when(m.minute) }}</time> <b>{{ m.visitors.toLocaleString('en-US') }}</b> visitors</li>
        </ul>
      </template>
    </template>
    <ConfirmDelete :open="asking" title="Delete these visitors?" :name="`${report?.visitors?.toLocaleString('en-US') || 0} visitors`" text="and their events will be deleted for good. This cannot be undone." cancel-label="Keep them" confirm-label="Delete" @cancel="asking = false" @confirm="remove" />
  </section>
</template>

<script setup>
import { ref } from 'vue'
import ConfirmDelete from '@/components/ConfirmDelete.vue'
import { ApiError } from '@/api/client'
import { statsApi } from '@/api/stats'

// TEMPORARY: removes the visitor records one crawler left behind (see server/src/services/crawlerCleanup.service.js). Delete this
// component, its use in StatsVisitors.vue, the statsApi calls and the two admin routes once it has been run.
const report = ref(null)
const done = ref(null)
const error = ref('')
const busy = ref(false)
const asking = ref(false)

const when = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const message = (err) => (err instanceof ApiError ? err.message : 'Something went wrong. Try again.')

async function check() {
  busy.value = true
  error.value = ''
  try {
    report.value = await statsApi.crawlerBursts()
  } catch (err) {
    error.value = message(err)
  } finally {
    busy.value = false
  }
}
async function remove() {
  asking.value = false
  busy.value = true
  error.value = ''
  try {
    done.value = await statsApi.deleteCrawlerBursts(report.value?.since, report.value?.min)
    report.value = await statsApi.crawlerBursts()
  } catch (err) {
    error.value = message(err)
  } finally {
    busy.value = false
  }
}
</script>
