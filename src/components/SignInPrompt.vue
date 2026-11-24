<template>
  <Teleport to="body">
    <div v-if="signInPrompt.open" class="modal-overlay" @click.self="close">
      <div class="modal-card sip" role="dialog" aria-modal="true" aria-labelledby="sip-title">
        <div class="share-modal-header">
          <h2 id="sip-title">{{ signInPrompt.title }}</h2>
          <button class="btn-text" type="button" aria-label="Close" @click="close">✕</button>
        </div>
        <p class="sip-text">{{ signInPrompt.text }}</p>
        <ul v-if="signInPrompt.points.length" class="claim-benefits">
          <li v-for="p in signInPrompt.points" :key="p"><span aria-hidden="true">✓</span><span>{{ p }}</span></li>
        </ul>
        <div class="claim-actions">
          <RouterLink class="btn btn-primary" :to="{ name: 'signup', query: { next } }" @click="go('signup')">Create a free account</RouterLink>
          <RouterLink class="btn btn-ghost" :to="{ name: 'login', query: { next } }" @click="go('login')">Log in</RouterLink>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { closeSignInPrompt, signInPrompt } from '@/composables/useSignInPrompt'
import { track } from '@/utils/analytics'

const route = useRoute()
const next = computed(() => signInPrompt.next || route.fullPath)
const close = closeSignInPrompt
function go(kind) {
  track('sign_in_prompt_go', { kind, title: signInPrompt.title })
  closeSignInPrompt()
}
const onKey = (e) => e.key === 'Escape' && signInPrompt.open && closeSignInPrompt()
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
