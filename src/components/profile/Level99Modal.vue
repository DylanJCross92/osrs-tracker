<template>
  <Teleport to="body">
    <!-- Rises from the bottom of the screen into its lowest third, over the profile (which stays usable). After about five seconds the badge
         shrinks into the medal in the banner. -->
    <div ref="root" class="l99o" role="img" :aria-label="`${skillName} level 99`" :style="{ height: `${panel}px` }">
      <div ref="veil" class="l99o-veil" />
      <div ref="fly" class="l99o-fly">
        <div class="l99o-scale" :style="{ transform: `scale(${k})` }">
          <Level99Celebration :skill="skillName" :level="99" :run="run" :text="false" free />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Level99Celebration from '@/components/Level99Celebration.vue'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// The level 99 celebration over the profile: opened by a fresh 99, and by clicking the medal beside it to watch it again.
const props = defineProps({ skill: { type: String, required: true } })
const emit = defineEmits(['close'])
const root = ref(null)
const veil = ref(null)
const fly = ref(null)
const run = ref(0)
const skillName = computed(() => SKILL_NAMES.find((n) => n.toLowerCase() === String(props.skill).trim().toLowerCase()) || props.skill)
// The lowest third of the screen, and how much to shrink the celebration (made for 380px) to fit in it.
const panel = Math.max(200, Math.round((typeof window === 'undefined' ? 720 : window.innerHeight) / 3))
const k = Math.min(1, panel / 400)
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

const SHOW_MS = 4000 // how long it plays before it starts to leave
const FLY_MS = 900 // the trip into the banner (so about five seconds in all)
let showTimer = 0
let endTimer = 0
let leaving = false

// A little bump on the medal when the badge arrives.
function pulse(medal) {
  try {
    medal.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.4)', filter: 'brightness(1.5)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 520, easing: 'ease-out' })
  } catch {
    /* animations unavailable */
  }
}

function startFly() {
  if (leaving) return
  leaving = true
  clearTimeout(showTimer)
  const tile = root.value?.querySelector('.l99-tile')
  const medal = document.querySelector(`[data-medal-skill="${skillName.value}"]`)
  const to = medal?.getBoundingClientRect()
  const from = tile?.getBoundingClientRect()
  const onScreen = to && to.width > 0 && to.bottom > 0 && to.top < window.innerHeight
  if (!onScreen || !from || reduced || !fly.value?.animate) {
    // Nowhere to fly to (the banner is hidden or off screen): just fade away.
    veil.value?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
    fly.value?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
    endTimer = setTimeout(() => emit('close'), 320)
    return
  }
  const wrap = fly.value.getBoundingClientRect()
  const cx = from.left + from.width / 2
  const cy = from.top + from.height / 2
  const dx = to.left + to.width / 2 - cx
  const dy = to.top + to.height / 2 - cy
  const scale = to.width / from.width
  fly.value.style.transformOrigin = `${cx - wrap.left}px ${cy - wrap.top}px`
  fly.value.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1, offset: 0.82 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(0.55, 0, 0.25, 1)', fill: 'forwards' },
  )
  veil.value?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: FLY_MS, fill: 'forwards' })
  // A timer, not the animation's end, so the page is never left covered if the animation cannot run.
  endTimer = setTimeout(() => {
    pulse(medal)
    emit('close')
  }, FLY_MS + 20)
}

const onKey = (e) => e.key === 'Escape' && startFly()
onMounted(() => {
  document.addEventListener('keydown', onKey)
  showTimer = setTimeout(startFly, reduced ? 2500 : SHOW_MS)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  clearTimeout(showTimer)
  clearTimeout(endTimer)
})
</script>
