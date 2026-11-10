<template>
  <div class="auth-page">
    <section class="card auth-card">
      <h1>{{ heading }}</h1>
      <p class="auth-sub">{{ subheading }}</p>

      <!-- Opening the link from the confirmation email. -->
      <template v-if="mode === 'verify'">
        <p v-if="verifyError" class="auth-error" role="alert">{{ verifyError }}</p>
        <p v-else class="auth-done" role="status">One moment…</p>
      </template>

      <!-- Account created (or found unconfirmed): waiting for the email link. -->
      <div v-else-if="pending" class="auth-pending">
        <p class="auth-done" role="status">
          <span aria-hidden="true">✉</span>
          <template v-if="pending.emailSent">We sent a confirmation link to <b>{{ pending.email }}</b>. Open it to finish creating your account. It can take a minute, and it may land in spam.</template>
          <template v-else>We could not send the confirmation email to <b>{{ pending.email }}</b> just now. Try the button below in a minute.</template>
        </p>
        <p v-if="resendNote" class="auth-fine" role="status">{{ resendNote }}</p>
        <button class="btn btn-ghost auth-submit" type="button" :disabled="cooldown > 0 || busy" @click="resend">{{ cooldown > 0 ? `Send it again in ${cooldown}s` : 'Send the email again' }}</button>
        <button class="btn-text auth-restart" type="button" @click="restart">Use a different email</button>
      </div>

      <form v-else-if="!sent" class="auth-form" novalidate @submit.prevent="submit">
        <label v-if="mode !== 'reset'" class="auth-field">
          <span>Email</span>
          <input ref="emailEl" v-model="email" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="you@example.com" :disabled="busy" />
        </label>

        <label v-if="mode !== 'forgot'" class="auth-field">
          <span>{{ mode === 'reset' ? 'New password' : 'Password' }}</span>
          <span class="auth-pw">
            <input v-model="password" :type="showPw ? 'text' : 'password'" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" maxlength="128" :placeholder="mode === 'login' ? 'Your password' : 'At least 8 characters'" :disabled="busy" />
            <button type="button" class="auth-pw-toggle" :aria-pressed="showPw" :aria-label="showPw ? 'Hide password' : 'Show password'" @click="showPw = !showPw">{{ showPw ? 'Hide' : 'Show' }}</button>
          </span>
        </label>

        <label v-if="mode === 'signup' || mode === 'reset'" class="auth-field">
          <span>Confirm password</span>
          <input v-model="confirmPassword" :type="showPw ? 'text' : 'password'" autocomplete="new-password" maxlength="128" placeholder="Type it again" :disabled="busy" />
        </label>

        <!-- Honeypot: invisible to people, tempting to bots. -->
        <input v-if="mode === 'signup'" v-model="website" class="signup-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />

        <label v-if="mode === 'signup'" class="auth-check">
          <input v-model="newsletter" type="checkbox" />
          <span>Email me news and new features, like claiming your profile. Unsubscribe anytime.</span>
        </label>

        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <button class="btn btn-primary auth-submit" type="submit" :disabled="busy">{{ busy ? 'One moment…' : copy.button }}</button>
      </form>

      <p v-else class="auth-done" role="status"><span aria-hidden="true">✓</span> If there is an account for that email, a reset link is on its way. It works once and expires in an hour.</p>

      <p v-if="mode === 'login' && !pending" class="auth-links">
        <RouterLink :to="{ name: 'forgotPassword' }">Forgot your password?</RouterLink>
      </p>
      <p class="auth-switch">
        <template v-if="mode === 'login'">New here? <RouterLink :to="{ name: 'signup', query: route.query }">Create an account</RouterLink></template>
        <template v-else-if="mode === 'signup'">Already have an account? <RouterLink :to="{ name: 'login', query: route.query }">Log in</RouterLink></template>
        <template v-else><RouterLink :to="{ name: 'login' }">Back to log in</RouterLink></template>
      </p>
      <p v-if="mode === 'signup' && !pending" class="auth-fine">
        An account saves your settings, like your OSRS name and rivals, so they follow you to any device. We will email you a link to confirm your address. You never need an account to track players, and TickGains never asks for your OSRS login.
        See the <RouterLink to="/privacy">privacy page</RouterLink>.
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { authApi } from '@/api/auth'
import { confirmEmail, logIn, resetPassword, signUp } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { setPageMeta } from '@/utils/pageMeta'
import { track } from '@/utils/analytics'

const props = defineProps({ mode: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const { showToast } = useToast()

const COPY = {
  login: { title: 'Log in', sub: 'Welcome back. Your settings will be right where you left them.', button: 'Log in', path: '/login' },
  signup: { title: 'Create your account', sub: 'Save your settings and use them on any device. It takes a few seconds.', button: 'Create account', path: '/signup' },
  forgot: { title: 'Reset your password', sub: 'Enter your email and we will send you a link to choose a new password.', button: 'Send reset link', path: '/forgot-password' },
  reset: { title: 'Choose a new password', sub: 'Pick something you have not used here before.', button: 'Save new password', path: '/reset-password' },
  verify: { title: 'Confirming your email', sub: '', button: '', path: '/verify-email' },
}
const copy = computed(() => COPY[props.mode])
setPageMeta({ title: copy.value.title, description: 'Log in or create a TickGains account to keep your settings on every device.', path: copy.value.path, noindex: true })

const emailEl = ref(null)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const website = ref('')
const newsletter = ref(false)
const showPw = ref(false)
const busy = ref(false)
const error = ref('')
const sent = ref(false)
// Set once an account exists but its email is not confirmed yet: { email, emailSent }.
const pending = ref(null)
const resendNote = ref('')
const cooldown = ref(0)
const verifyError = ref('')

const heading = computed(() => (pending.value ? 'Check your email' : copy.value.title))
const subheading = computed(() => (pending.value ? 'One more step before your account is ready.' : copy.value.sub))

let tick = null
function startCooldown(seconds = 60) {
  cooldown.value = seconds
  clearInterval(tick)
  tick = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) clearInterval(tick)
  }, 1000)
}
onBeforeUnmount(() => clearInterval(tick))

// Where to go afterwards: a page the visitor was sent here from (same site only), else the account page after signing up.
function destination() {
  const next = String(route.query.next || '')
  if (next.startsWith('/') && !next.startsWith('//')) return next
  return props.mode === 'reset' ? '/account' : '/'
}

onMounted(async () => {
  if (props.mode === 'verify') {
    try {
      await confirmEmail(String(route.query.t || ''))
      track('sign_up', { method: 'email' })
      showToast('Email confirmed. Welcome to TickGains!')
      router.replace('/account')
    } catch (err) {
      verifyError.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
    }
    return
  }
  nextTick(() => emailEl.value?.focus())
})

async function submit() {
  if (busy.value) return
  error.value = ''
  if ((props.mode === 'signup' || props.mode === 'reset') && password.value !== confirmPassword.value) {
    error.value = 'The two passwords do not match.'
    return
  }
  busy.value = true
  try {
    if (props.mode === 'login') {
      await logIn(email.value, password.value)
      track('login')
    } else if (props.mode === 'signup') {
      const res = await signUp({ email: email.value, password: password.value, confirmPassword: confirmPassword.value, newsletter: newsletter.value, website: website.value })
      pending.value = { email: res.email, emailSent: res.emailSent }
      track('sign_up_started', { method: 'email', newsletter: newsletter.value })
      if (res.emailSent) startCooldown()
      nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
      return
    } else if (props.mode === 'forgot') {
      await authApi.forgot(email.value)
      sent.value = true
      track('password_reset_requested')
      return
    } else {
      await resetPassword(String(route.query.t || ''), password.value)
      track('password_reset_done')
    }
    router.replace(destination())
  } catch (err) {
    // Right password, but the email was never confirmed: show the same "check your email" step.
    if (err instanceof ApiError && err.code === 'email_not_verified') {
      pending.value = { email: email.value.trim(), emailSent: true }
      resendNote.value = 'This account has not been confirmed yet. Use the link we emailed you, or ask for a new one.'
      return
    }
    error.value = err instanceof ApiError ? err.message : 'Something went wrong, please try again.'
  } finally {
    busy.value = false
  }
}

async function resend() {
  if (!pending.value || cooldown.value > 0 || busy.value) return
  busy.value = true
  try {
    await authApi.resend(pending.value.email)
    resendNote.value = 'Sent. If it does not show up, check your spam folder.'
    track('verification_resent')
    startCooldown()
  } catch (err) {
    resendNote.value = err instanceof ApiError ? err.message : 'Could not send it, please try again.'
  } finally {
    busy.value = false
  }
}

function restart() {
  pending.value = null
  resendNote.value = ''
  password.value = ''
  confirmPassword.value = ''
  cooldown.value = 0
  clearInterval(tick)
  nextTick(() => emailEl.value?.focus())
}
</script>
