<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card share-modal-card cz-modal" role="dialog" aria-modal="true" aria-label="Customize your profile">
      <div class="share-modal-header">
        <h2>Customize your profile</h2>
        <button class="btn-text" type="button" aria-label="Close" @click="$emit('close')">✕</button>
      </div>

      <div class="cz-body">
        <section class="cz-block">
          <h3>Picture and bio</h3>
          <div class="cz-profile">
            <div class="cz-pic" :class="{ 'is-busy': busyPic }">
              <span class="cz-pic-frame">
                <PlayerAvatar :name="username" :key="pictureKey" />
                <span class="cz-pic-overlay">
                  <label class="cz-pic-btn">
                    {{ busyPic ? 'Uploading…' : 'Upload' }}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" :disabled="busyPic" aria-label="Upload a picture" @change="pickPicture" />
                  </label>
                  <button v-if="current.hasAvatar" class="cz-pic-btn is-remove" type="button" :disabled="busyPic" @click="removePicture">Remove</button>
                </span>
              </span>
            </div>
            <div class="cz-bio">
              <textarea v-model="form.bio" maxlength="300" aria-label="Bio" placeholder="Write a bio: a line or two about you and your account"></textarea>
              <small class="cz-bio-count" aria-hidden="true">{{ form.bio.length }}/300</small>
            </div>
          </div>
          <small class="cz-pic-hint">Hover your picture to change or remove it. Squares work best; it is shrunk to 256 pixels before upload.</small>
          <p v-if="picError" class="auth-error" role="alert">{{ picError }}</p>
        </section>

        <section class="cz-block">
          <h3>Pinned achievement</h3>
          <label class="cz-field">
            <span>Shown at the top of your profile</span>
            <select v-model="form.pinned" :disabled="!pinChoices.length">
              <option value="">{{ pinChoices.length ? 'None' : 'Nothing earned yet' }}</option>
              <optgroup v-for="g in pinChoices" :key="g.category" :label="g.category">
                <option v-for="a in g.items" :key="a.key" :value="a.key">{{ a.title }}</option>
              </optgroup>
            </select>
          </label>
        </section>

        <section class="cz-block">
          <h3>Links</h3>
          <div v-for="(l, i) in form.links" :key="i" class="cz-link">
            <select v-model="l.kind" :aria-label="`Link ${i + 1} site`"><option v-for="k in KINDS" :key="k.key" :value="k.key">{{ k.label }}</option></select>
            <input v-model="l.url" type="url" maxlength="200" :placeholder="KINDS.find((k) => k.key === l.kind).example" :aria-label="`Link ${i + 1} address`" autocomplete="off" data-1p-ignore />
            <button type="button" class="cz-x" :aria-label="`Remove link ${i + 1}`" @click="form.links.splice(i, 1)">×</button>
          </div>
          <button v-if="form.links.length < 5" class="btn btn-ghost cz-add" type="button" @click="form.links.push({ kind: 'discord', url: '' })">Add a link</button>
        </section>

      </div>

      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <div class="cz-actions">
        <button class="btn btn-ghost" type="button" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" type="button" :disabled="busy" @click="save">{{ busy ? 'Saving…' : 'Save changes' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import PlayerAvatar from '@/components/PlayerAvatar.vue'
import { ApiError } from '@/api/client'
import { profilePageApi } from '@/api/profilePage'
import { usePlayersStore } from '@/stores/players'
import { useAvatarsStore } from '@/stores/avatars'
import { refreshProfiles } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { squareJpeg } from '@/utils/imageResize'
import { pinOptions } from '@/utils/badges'
import { track } from '@/utils/analytics'

const props = defineProps({
  username: { type: String, required: true },
  page: { type: Object, required: true },
  // The profile's achievements, so the owner can pin one they have earned.
  achievements: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'saved'])
const { showToast } = useToast()
const store = usePlayersStore()
const avatarsStore = useAvatarsStore()

const KINDS = [
  { key: 'discord', label: 'Discord', example: 'https://discord.gg/yourinvite' },
  { key: 'twitch', label: 'Twitch', example: 'https://twitch.tv/yourname' },
  { key: 'youtube', label: 'YouTube', example: 'https://youtube.com/@yourname' },
  { key: 'twitter', label: 'X', example: 'https://x.com/yourname' },
]

const current = reactive({ ...props.page })
const pinChoices = pinOptions(props.achievements)
const form = reactive({ bio: props.page.bio || '', pinned: props.page.pinnedAchievement || '', links: (props.page.links || []).map((l) => ({ ...l })) })
const busy = ref(false)
const busyPic = ref(false)
const error = ref('')
const picError = ref('')
const pictureKey = ref(0)

const message = (err) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong, please try again.')

// The picture is saved as soon as it is picked; the text fields wait for "Save changes".
async function pickPicture(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  picError.value = ''
  busyPic.value = true
  try {
    const blob = await squareJpeg(file)
    Object.assign(current, await profilePageApi.uploadAvatar(props.username, blob))
    await Promise.all([store.loadPlayers().catch(() => {}), avatarsStore.refresh()])
    pictureKey.value++
    refreshProfiles()
    track('profile_picture', { action: 'upload' })
    emit('saved', { ...current })
  } catch (err) {
    picError.value = message(err)
  } finally {
    busyPic.value = false
  }
}
async function removePicture() {
  picError.value = ''
  busyPic.value = true
  try {
    Object.assign(current, await profilePageApi.removeAvatar(props.username))
    await Promise.all([store.loadPlayers().catch(() => {}), avatarsStore.refresh()])
    pictureKey.value++
    refreshProfiles()
    track('profile_picture', { action: 'remove' })
    emit('saved', { ...current })
  } catch (err) {
    picError.value = message(err)
  } finally {
    busyPic.value = false
  }
}

async function save() {
  busy.value = true
  error.value = ''
  try {
    const links = form.links.filter((l) => l.url.trim()).map((l) => ({ kind: l.kind, url: l.url.trim() }))
    const saved = await profilePageApi.save(props.username, { bio: form.bio, links, pinnedAchievement: form.pinned })
    track('profile_customize')
    showToast('Profile saved.')
    emit('saved', saved)
    emit('close')
  } catch (err) {
    error.value = message(err)
  } finally {
    busy.value = false
  }
}

const onKey = (e) => e.key === 'Escape' && emit('close')
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>
