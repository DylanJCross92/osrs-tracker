import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'

// After the build, write the calculator page text (titles, descriptions, guides) next to the bundle so the
// server can bake them into the HTML crawlers see. src/data/skillInfo.js stays the single source of truth.
function calculatorMeta() {
  return {
    name: 'tickgains-calculator-meta',
    apply: 'build',
    async closeBundle() {
      const mod = await import(new URL('./src/data/skillInfo.js', import.meta.url).href)
      const out = mod.SKILL_INFO.map((i) => ({
        slug: i.slug,
        name: i.name,
        category: i.category,
        short: i.short,
        lead: i.lead,
        guide: i.guide,
        title: mod.calculatorTitle(i),
        description: mod.calculatorDescription(i),
      }))
      const dir = fileURLToPath(new URL('./dist', import.meta.url))
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(`${dir}/calculators.json`, JSON.stringify(out))
    },
  }
}

export default defineConfig({
  plugins: [vue(), calculatorMeta()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
