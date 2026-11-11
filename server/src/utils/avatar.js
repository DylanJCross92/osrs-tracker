// Generated player pictures: a small symmetric pixel pattern and a colour pair, both derived from the username, so
// every account gets its own picture with no upload and no account. Same name, same picture, everywhere.

// Background pair (top-left to bottom-right) and the pattern colour. Dark, warm-leaning backgrounds with a bright
// pattern so they sit well on the site's dark theme.
const PALETTES = [
  { bg1: '#4a3814', bg2: '#251c0a', fg: '#f0c976' }, // gold
  { bg1: '#25401f', bg2: '#12240f', fg: '#93d77e' }, // green
  { bg1: '#133f3d', bg2: '#0a2322', fg: '#6fd9d2' }, // teal
  { bg1: '#4a1a1d', bg2: '#270c0e', fg: '#f28f8f' }, // crimson
  { bg1: '#33224f', bg2: '#1a1131', fg: '#bda0f5' }, // violet
  { bg1: '#172c4d', bg2: '#0c1731', fg: '#82b4f7' }, // blue
  { bg1: '#4c2c11', bg2: '#2a1709', fg: '#f7aa5e' }, // orange
  { bg1: '#4c1c38', bg2: '#2b0f20', fg: '#f28fc4' }, // rose
]

// FNV-1a, 32 bit: tiny, stable across browsers.
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// Seeded random numbers (mulberry32), so one hash can drive the whole picture.
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SIZE = 5 // the pattern is SIZE x SIZE cells, mirrored left to right
const MIN_CELLS = 10

/**
 * The picture for a name: { palette, cells: [{ x, y, o }] } on a 7x7 grid (the pattern sits inside a 1 cell margin).
 * Names compare case-insensitively with spaces/underscores treated alike, the way OSRS treats them.
 */
export function avatarFor(name) {
  const key = String(name || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim()
  const seed = hash(key)
  const rand = rng(seed)
  const palette = PALETTES[seed % PALETTES.length]
  const half = Math.ceil(SIZE / 2)

  let on
  let count
  do {
    on = []
    count = 0
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < half; x++) {
        const filled = rand() < 0.55
        on.push(filled)
        if (filled) count += x === half - 1 ? 1 : 2
      }
    }
  } while (count < MIN_CELLS)

  const cells = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < half; x++) {
      if (!on[y * half + x]) continue
      // The centre column is the brightest, the outer columns a little softer, which gives the pattern some depth.
      const o = x === half - 1 ? 1 : x === 0 ? 0.62 : 0.82
      cells.push({ x: x + 1, y: y + 1, o })
      const mx = SIZE - 1 - x
      if (mx !== x) cells.push({ x: mx + 1, y: y + 1, o })
    }
  }
  return { palette, cells }
}
