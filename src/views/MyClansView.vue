<template>
  <div class="clan clans-hub">
    <header class="card clan-head">
      <div class="clan-head-main">
        <h1>My clans</h1>
        <p class="clan-desc">Every clan you own or are a member of, with the competitions that are on or coming up.</p>
      </div>
      <RouterLink class="btn btn-primary" :to="{ name: 'clanNew' }">Start a clan</RouterLink>
    </header>

    <PageSkeleton v-if="loading" kind="my-clans" />

    <section v-else-if="failed" class="card clan-empty">
      <h2>Could not load your clans</h2>
      <p>Please try again in a moment.</p>
      <button class="btn btn-primary" type="button" @click="load">Try again</button>
    </section>

    <section v-else-if="!clans.length" class="card clan-empty">
      <h2>You are not in a clan yet</h2>
      <p>Start your own and send the invite link, or open an invite link a friend sent you. Clans you own, and clans with one of your verified profiles in them, show up here.</p>
      <div class="clan-empty-actions">
        <RouterLink class="btn btn-primary" :to="{ name: 'clanNew' }">Start a clan</RouterLink>
        <RouterLink class="btn btn-ghost" :to="{ name: 'clans' }">Browse clans</RouterLink>
      </div>
    </section>

    <template v-else>
      <section v-if="owned.length" class="clan-mine-group" aria-labelledby="mine-owned-h">
        <h2 id="mine-owned-h" class="clan-mine-group-h">Clans you own <small>{{ owned.length }}</small></h2>
        <div class="clan-mine-grid"><ClanMineCard v-for="c in owned" :key="c.slug" :clan="c" /></div>
      </section>
      <section v-if="joined.length" class="clan-mine-group" aria-labelledby="mine-joined-h">
        <h2 id="mine-joined-h" class="clan-mine-group-h">Clans you are in <small>{{ joined.length }}</small></h2>
        <div class="clan-mine-grid"><ClanMineCard v-for="c in joined" :key="c.slug" :clan="c" /></div>
      </section>
      <p class="clan-note">A clan shows here when you own it, or when a profile you have verified on TickGains is a member of it.</p>
    </template>
  </div>
</template>

<script setup>
import PageSkeleton from '@/components/PageSkeleton.vue'
import { computed, onMounted, ref } from 'vue'
import ClanMineCard from '@/components/clans/ClanMineCard.vue'
import { clansApi } from '@/api/clans'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({ title: 'My clans', description: 'The clans you own or belong to on TickGains.', path: '/clans/mine', noindex: true })

const clans = ref([])
const loading = ref(true)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    clans.value = (await clansApi.mine()).clans
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)

const owned = computed(() => clans.value.filter((c) => c.owner))
const joined = computed(() => clans.value.filter((c) => !c.owner))
</script>
