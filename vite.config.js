import { fileURLToPath, URL } from 'node:url'
import { defineConfig, createServer } from 'vite'
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

      // Goal pages (/calculators/agility/1-to-99) need the planner engine, which imports through the "@" alias,
      // so they are computed through a throwaway module loader rather than a plain import.
      const loader = await createServer({
        configFile: false,
        root: fileURLToPath(new URL('.', import.meta.url)),
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true, hmr: false, watch: null },
        resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
      })
      try {
        const goals = await loader.ssrLoadModule('/src/data/calculatorGoals.js')
        writeFileSync(`${dir}/calculator-goals.json`, JSON.stringify(goals.allGoalPages()))
        // The XP table and the plan guide pages (/osrs-xp-table, /plans/max-cape) are computed the same way.
        const guides = await loader.ssrLoadModule('/src/data/planGuides.js')
        writeFileSync(`${dir}/plan-guides.json`, JSON.stringify(guides.allPlanGuides()))
        const table = await loader.ssrLoadModule('/src/data/xpTable.js')
        writeFileSync(`${dir}/xp-table.json`, JSON.stringify(table.buildXpTable()))
      } finally {
        await loader.close()
      }
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
