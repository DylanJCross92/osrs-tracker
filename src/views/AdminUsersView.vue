<template>
  <div class="st">
    <header class="st-head">
      <div>
        <h1>User Management</h1>
        <p>Everyone who has signed up: whether they confirmed their email, which players they claimed, when they joined and were last seen, and how active they are.</p>
      </div>
      <div class="st-range" role="group" aria-label="Activity range">
        <button v-for="d in RANGES" :key="d" type="button" class="st-range-btn" :class="{ on: days === d }" :aria-pressed="days === d" @click="days = d">{{ d }} days</button>
      </div>
    </header>
    <ClaimEmailCard />
    <UsersList :days="days" @go="openVisitor" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ClaimEmailCard from '@/components/admin/users/ClaimEmailCard.vue'
import UsersList from '@/components/admin/users/UsersList.vue'
import { setPageMeta } from '@/utils/pageMeta'

setPageMeta({ title: 'User Management', description: 'Accounts that have signed up.', path: '/admin/users', noindex: true })

const RANGES = [7, 30, 90]
const days = ref(30)
const router = useRouter()
// An account's steps open on the Visitors tab of the statistics page.
const openVisitor = (key) => router.push({ name: 'adminStats', query: { tab: 'visitors', v: key } })
</script>
