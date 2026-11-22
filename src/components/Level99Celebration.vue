<template>
  <div :key="run" class="l99" role="img" :aria-label="`${skill} level ${level} achieved. Congratulations!`" :style="{ '--skill-delay': '0s' }">
    <div class="l99-glow" aria-hidden="true" />
    <div class="l99-rays" aria-hidden="true" />
    <span class="l99-ring r1" aria-hidden="true" />
    <span class="l99-ring r2" aria-hidden="true" />

    <!-- A one-time burst of pixel confetti, then twinkling stars that stay -->
    <i v-for="c in confetti" :key="`c${c.i}`" class="l99-conf" :class="c.tone" :style="c.style" aria-hidden="true" />
    <svg v-for="s in stars" :key="`s${s.i}`" class="l99-star" viewBox="0 0 24 24" aria-hidden="true" :style="s.style"><path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z" /></svg>

    <div class="l99-badge">
      <div class="l99-tile">
        <img :src="skillIconSrc(skill)" :alt="''" width="16" height="16" class="l99-icon" />
        <span class="l99-shine" aria-hidden="true" />
      </div>
      <span class="l99-level" aria-hidden="true">{{ level }}</span>
    </div>

    <p class="l99-title">{{ skill }} mastered</p>
    <p class="l99-sub">Congratulations!</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { skillIconSrc } from '@/utils/osrsSkills'

// A short celebration for reaching a level: the skill's own icon pops in on a gold badge, a burst of pixel confetti, a shine across the
// badge, rays and stars behind it. Pure CSS, plays once when it appears (bump `run` to play it again) and settles into a gentle glow.
// With reduced motion it simply shows the finished badge.
defineProps({
  skill: { type: String, default: 'Agility' },
  level: { type: [Number, String], default: 99 },
  run: { type: Number, default: 0 },
})

const TONES = ['gold', 'gold', 'white', 'green', 'gold', 'red']
// Even and repeatable (no randomness), so the burst looks the same every time.
const confetti = computed(() =>
  Array.from({ length: 26 }, (_, i) => {
    const angle = (i / 26) * Math.PI * 2 + (i % 2) * 0.18
    const dist = 120 + ((i * 37) % 70)
    return {
      i,
      tone: TONES[i % TONES.length],
      style: {
        '--dx': `${Math.round(Math.cos(angle) * dist)}px`,
        '--dy': `${Math.round(Math.sin(angle) * dist * 0.8)}px`,
        '--s': `${5 + (i % 3) * 2}px`,
        '--r': `${(i * 53) % 360}deg`,
        '--d': `${0.62 + (i % 5) * 0.03}s`,
      },
    }
  }),
)
const SPOTS = [
  [-112, -58], [104, -70], [-92, 58], [118, 44], [-30, -112], [48, -104], [-130, 0], [136, -8], [10, 100], [-60, 104],
]
const stars = computed(() =>
  SPOTS.map(([x, y], i) => ({
    i,
    style: { '--x': `${x}px`, '--y': `${y}px`, '--sz': `${12 + (i % 3) * 5}px`, '--t': `${1.7 + (i % 4) * 0.35}s`, '--w': `${1.15 + i * 0.13}s` },
  })),
)
</script>

<style scoped>
.l99 {
  --gold: #e4b84f;
  --gold-hi: #fff0b8;
  --gold-lo: #8a6416;
  position: relative;
  display: grid;
  justify-items: center;
  align-content: center;
  width: min(100%, 420px);
  min-height: 380px;
  padding-top: 20px;
  margin: 0 auto;
  overflow: hidden;
  isolation: isolate;
  text-align: center;
}

/* ---- Behind the badge: a warm glow and slowly turning rays ---- */
.l99-glow {
  position: absolute;
  left: 50%;
  top: 190px;
  width: 300px;
  height: 300px;
  margin: -150px 0 0 -150px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 214, 110, 0.55) 0%, rgba(228, 184, 79, 0.16) 42%, transparent 68%);
  opacity: 0;
  z-index: -1;
  animation: l99-glow-in 0.9s 0.25s ease-out forwards, l99-breathe 3.6s 1.2s ease-in-out infinite;
}
.l99-rays {
  position: absolute;
  left: 50%;
  top: 190px;
  width: 380px;
  height: 380px;
  margin: -190px 0 0 -190px;
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255, 224, 140, 0.34) 0deg 7deg, transparent 7deg 20deg);
  -webkit-mask-image: radial-gradient(circle, #000 8%, transparent 66%);
  mask-image: radial-gradient(circle, #000 8%, transparent 66%);
  opacity: 0;
  z-index: -1;
  animation: l99-rays-in 1s 0.35s ease-out forwards, l99-spin 26s linear infinite;
}
.l99-ring {
  position: absolute;
  left: 50%;
  top: 190px;
  width: 120px;
  height: 120px;
  margin: -60px 0 0 -60px;
  border: 3px solid var(--gold-hi);
  border-radius: 50%;
  opacity: 0;
  z-index: -1;
  animation: l99-ring 1.15s 0.5s ease-out forwards;
}
.l99-ring.r2 { animation-delay: 0.75s; border-width: 2px; }

/* ---- The badge: the skill's own icon, enlarged without blurring the pixels ---- */
.l99-badge {
  position: relative;
  display: grid;
  justify-items: center;
  opacity: 0;
  transform: scale(0.1) rotate(-24deg);
  animation: l99-pop 0.85s 0.35s cubic-bezier(0.2, 1.45, 0.4, 1) forwards, l99-float 3.4s 1.5s ease-in-out infinite;
}
.l99-tile {
  position: relative;
  display: grid;
  place-items: center;
  width: 124px;
  height: 124px;
  border-radius: 28px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 28%, #fff4c9 0%, #f2cd78 46%, #cf9f3c 100%);
  box-shadow: 0 0 0 3px var(--gold), 0 0 0 6px rgba(26, 20, 8, 0.9), 0 0 0 8px var(--gold-lo), 0 10px 34px rgba(228, 184, 79, 0.45), inset 0 -8px 18px rgba(140, 95, 15, 0.35);
  animation: l99-tile-glow 2.8s 1.6s ease-in-out infinite;
}
.l99-icon {
  width: 80px;
  height: 80px;
  image-rendering: pixelated;
  filter: drop-shadow(0 3px 0 rgba(120, 80, 10, 0.4));
  animation: l99-icon-hit 0.6s 0.95s ease-out both;
}
.l99-shine {
  position: absolute;
  top: -20%;
  bottom: -20%;
  width: 46%;
  left: -70%;
  background: linear-gradient(100deg, transparent 0%, rgba(255, 255, 255, 0.05) 30%, rgba(255, 255, 255, 0.7) 50%, rgba(255, 255, 255, 0.05) 70%, transparent 100%);
  transform: skewX(-18deg);
  animation: l99-shine 0.9s 1.05s ease-in-out both, l99-shine 0.9s 4.6s ease-in-out infinite;
}
.l99-level {
  position: relative;
  margin-top: -17px;
  min-width: 58px;
  padding: 3px 14px 4px;
  border-radius: 999px;
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.02em;
  color: var(--gold-hi);
  background: linear-gradient(180deg, #2c210d, #17110a);
  box-shadow: 0 0 0 2px var(--gold), 0 0 0 4px rgba(26, 20, 8, 0.9), 0 4px 12px rgba(0, 0, 0, 0.45);
  font-variant-numeric: tabular-nums;
  animation: l99-level-in 0.5s 1.05s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}

/* ---- Words ---- */
.l99-title {
  margin: 22px 0 0;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.01em;
  background: linear-gradient(100deg, #f6d98a 20%, #fff7da 40%, #f0c976 60%, #d9af52 80%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  opacity: 0;
  transform: translateY(10px);
  animation: l99-text 0.6s 1.25s ease-out forwards, l99-text-shimmer 3.4s 2s ease-in-out infinite;
}
.l99-sub {
  margin: 4px 0 0;
  color: var(--muted, #b9ad94);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0;
  transform: translateY(8px);
  animation: l99-text 0.6s 1.45s ease-out forwards;
}

/* ---- Pixel confetti: one burst out of the badge, falling a little as it fades ---- */
.l99-conf {
  position: absolute;
  left: 50%;
  top: 190px;
  width: var(--s);
  height: var(--s);
  margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
  opacity: 0;
  z-index: 2;
  animation: l99-burst var(--d) 0.72s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
}
.l99-conf.gold { background: var(--gold); }
.l99-conf.white { background: #fff7da; }
.l99-conf.green { background: #7cd06a; }
.l99-conf.red { background: #e07a63; }

/* ---- Stars that stay and twinkle around the badge ---- */
.l99-star {
  position: absolute;
  left: 50%;
  top: 190px;
  width: var(--sz);
  height: var(--sz);
  margin: calc(var(--sz) / -2) 0 0 calc(var(--sz) / -2);
  fill: var(--gold-hi);
  filter: drop-shadow(0 0 5px rgba(255, 214, 110, 0.9));
  opacity: 0;
  transform: translate(var(--x), var(--y)) scale(0);
  animation: l99-twinkle var(--t) var(--w) ease-in-out infinite;
}

@keyframes l99-pop {
  0% { opacity: 0; transform: scale(0.1) rotate(-24deg); }
  55% { opacity: 1; transform: scale(1.22) rotate(5deg); }
  78% { transform: scale(0.94) rotate(-2deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes l99-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes l99-icon-hit {
  0% { transform: scale(1); filter: drop-shadow(0 3px 0 rgba(120, 80, 10, 0.4)) brightness(1); }
  35% { transform: scale(1.18); filter: drop-shadow(0 0 12px rgba(255, 250, 220, 0.95)) brightness(1.35); }
  100% { transform: scale(1); filter: drop-shadow(0 3px 0 rgba(120, 80, 10, 0.4)) brightness(1); }
}
@keyframes l99-shine {
  from { left: -70%; }
  to { left: 130%; }
}
@keyframes l99-tile-glow {
  0%, 100% { box-shadow: 0 0 0 3px var(--gold), 0 0 0 6px rgba(26, 20, 8, 0.9), 0 0 0 8px var(--gold-lo), 0 10px 34px rgba(228, 184, 79, 0.45), inset 0 -8px 18px rgba(140, 95, 15, 0.35); }
  50% { box-shadow: 0 0 0 3px #f6d070, 0 0 0 6px rgba(26, 20, 8, 0.9), 0 0 0 8px var(--gold-lo), 0 10px 46px rgba(255, 214, 110, 0.7), inset 0 -8px 18px rgba(140, 95, 15, 0.2); }
}
@keyframes l99-level-in {
  from { opacity: 0; transform: translateY(8px) scale(0.5); }
  to { opacity: 1; transform: none; }
}
@keyframes l99-text {
  to { opacity: 1; transform: none; }
}
@keyframes l99-text-shimmer {
  0%, 100% { background-position: 100% 0; }
  50% { background-position: 0 0; }
}
@keyframes l99-glow-in {
  to { opacity: 1; }
}
@keyframes l99-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.12); opacity: 0.75; }
}
@keyframes l99-rays-in {
  to { opacity: 1; }
}
@keyframes l99-spin {
  to { transform: rotate(360deg); }
}
@keyframes l99-ring {
  0% { opacity: 0.9; transform: scale(0.6); }
  100% { opacity: 0; transform: scale(3.1); }
}
@keyframes l99-burst {
  0% { opacity: 1; transform: translate(0, 0) rotate(0) scale(1); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 46px)) rotate(var(--r)) scale(0.4); }
}
@keyframes l99-twinkle {
  0%, 100% { opacity: 0; transform: translate(var(--x), var(--y)) scale(0); }
  45% { opacity: 1; transform: translate(var(--x), var(--y)) scale(1) rotate(20deg); }
  70% { opacity: 0.4; transform: translate(var(--x), var(--y)) scale(0.6) rotate(45deg); }
}

@media (prefers-reduced-motion: reduce) {
  .l99-glow, .l99-rays, .l99-badge, .l99-title, .l99-sub, .l99-level, .l99-icon, .l99-tile { animation: none; }
  .l99-glow, .l99-rays, .l99-badge, .l99-title, .l99-sub { opacity: 1; transform: none; }
  .l99-rays { transform: none; }
  .l99-ring, .l99-conf, .l99-star, .l99-shine { display: none; }
}
</style>
