<template>
  <Teleport to="body">
    <!-- Rises from the bottom of the screen into its lowest third, over the profile (which stays usable). Every new 99 is there at once, side
         by side. After a few seconds each badge shrinks into the medal on its own row in the banner. -->
    <div ref="root" class="l99o" role="img" :aria-label="`${names.join(', ')} level 99`" :style="{ height: `${panel}px` }">
      <div ref="veil" class="l99o-veil" />
      <div class="l99o-row">
        <div v-for="(n, i) in names" :key="n" class="l99o-slot" :style="{ width: `${slotW}px` }">
          <div :ref="(el) => (flyEls[i] = el)" class="l99o-fly">
            <div class="l99o-scale" :style="{ transform: `scale(${k})` }">
              <Level99Celebration v-if="ready[i]" :skill="n" :level="99" :text="false" free />
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Level99Celebration from '@/components/Level99Celebration.vue'
import { SKILL_NAMES } from '@/utils/osrsSkills'

// The level 99 celebration over the profile: opened by new 99s, and by clicking a medal beside one to watch it again.
const props = defineProps({
  skills: { type: Array, required: true },
  // How long it plays before the badges start to leave, and how long the trip into the banner takes.
  showMs: { type: Number, default: 4200 },
  flyMs: { type: Number, default: 900 },
})
const emit = defineEmits(['close'])
const root = ref(null)
const veil = ref(null)
const flyEls = []
const names = computed(() => props.skills.map((s) => SKILL_NAMES.find((n) => n.toLowerCase() === String(s).trim().toLowerCase()) || s))
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

// The lowest third of the screen, how much to shrink the celebration (made for 380px) to fit in it, and how far apart the badges sit.
const vw = typeof window === 'undefined' ? 1024 : window.innerWidth
const panel = Math.max(200, Math.round((typeof window === 'undefined' ? 720 : window.innerHeight) / 3))
const k = Math.min(1, panel / 400)
const slotW = Math.round(Math.min(Math.max(140, 230 * k), (vw - 24) / names.value.length))

// Each badge comes in a moment after the one before it.
const STAGGER_MS = 180
const ready = ref(names.value.map((_, i) => i === 0))
const timers = []
let leaving = false

// A little bump on a medal when its badge arrives.
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
  names.value.forEach((name, i) => {
    const el = flyEls[i]
    if (!el) return
    const tile = el.querySelector('.l99-tile')
    const medal = document.querySelector(`[data-medal-skill="${name}"]`)
    const to = medal?.getBoundingClientRect()
    const from = tile?.getBoundingClientRect()
    const onScreen = to && to.width > 0 && to.bottom > 0 && to.top < window.innerHeight
    if (!onScreen || !from || reduced || !el.animate) {
      // Nowhere to fly to (its row is hidden or off screen): just fade away.
      el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })
      return
    }
    const wrap = el.getBoundingClientRect()
    const cx = from.left + from.width / 2
    const cy = from.top + from.height / 2
    const dx = to.left + to.width / 2 - cx
    const dy = to.top + to.height / 2 - cy
    const scale = to.width / from.width
    el.style.transformOrigin = `${cx - wrap.left}px ${cy - wrap.top}px`
    const delay = i * 90
    el.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1, offset: 0.82 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
      ],
      { duration: props.flyMs, delay, easing: 'cubic-bezier(0.55, 0, 0.25, 1)', fill: 'both' },
    )
    timers.push(setTimeout(() => pulse(medal), delay + props.flyMs))
  })
  veil.value?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: props.flyMs, fill: 'forwards' })
  // A timer, not the animations' end, so the page is never left covered if they cannot run.
  timers.push(setTimeout(() => emit('close'), props.flyMs + names.value.length * 90 + 40))
}

const onKey = (e) => e.key === 'Escape' && startFly()
onMounted(() => {
  document.addEventListener('keydown', onKey)
  names.value.forEach((_, i) => i > 0 && timers.push(setTimeout(() => (ready.value[i] = true), i * STAGGER_MS)))
  timers.push(setTimeout(startFly, reduced ? Math.min(2500, props.showMs) : props.showMs))
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  timers.forEach(clearTimeout)
})
</script>
