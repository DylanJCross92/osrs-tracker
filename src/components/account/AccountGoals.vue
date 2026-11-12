<template>
  <div>
    <p v-if="loading" class="card acc-empty">Loading…</p>
    <ProfileGoalsPublic v-else :username="profile.username" :display-name="profile.displayName" :goals="goals" is-owner @update="(g) => (goals = g)" @share="copyShare" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import ProfileGoalsPublic from '@/components/profile/ProfileGoalsPublic.vue'
import { goalsApi } from '@/api/goals'
import { useToast } from '@/composables/useToast'

const props = defineProps({ profile: { type: Object, required: true } })
const { showToast } = useToast()
const goals = ref([])
const loading = ref(true)

watch(
  () => props.profile.username,
  async (username) => {
    loading.value = true
    try {
      goals.value = (await goalsApi.list(username)).goals
    } catch {
      goals.value = []
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

async function copyShare(g) {
  try {
    await navigator.clipboard.writeText(goalsApi.shareUrl(props.profile.username, g.id))
    showToast('Goal link copied')
  } catch {
    showToast('Could not copy the link.')
  }
}
</script>
