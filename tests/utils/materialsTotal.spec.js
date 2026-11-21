import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlannerMaterials from '@/components/planner/PlannerMaterials.vue'
import { getMethod } from '@/data/trainingMethods'
import { resetPrices, setPrices } from '@/utils/priceBook'

beforeEach(() => resetPrices())

const seg = (id, fromXp, toXp) => ({ method: getMethod(id), fromXp, toXp })
const stubs = { RouterLink: { props: ['to'], template: '<a><slot /></a>' }, GePriceBadge: true, PriceBasisToggle: true }

describe('the materials total line', () => {
  it('says Total, with the number of items needed under Needed and the cost under Cost, and the working between the columns', () => {
    setPrices({ 'raw shark': [400, 380, 'raw-shark'], 'dragon bones': [3800, 3700, 'dragon-bones'] }, { updatedAt: new Date().toISOString(), stale: false })
    const plan = { segments: [seg('cooking-sharks', 1_986_068, 1_988_168)] }
    const w = mount(PlannerMaterials, { props: { plan }, global: { stubs } })
    const foot = w.find('tfoot tr')
    expect(foot.exists()).toBe(true)
    const cells = foot.findAll('td')
    expect(cells[0].text()).toBe('Total')
    expect(cells[1].text()).toBe('10') // the same ten raw sharks as the one row above
    expect(cells.at(-1).text()).toContain('gp')
    // The × and = sit between the columns of each item row.
    const ops = w.findAll('tbody tr:first-child .mat-op').map((c) => c.text())
    expect(ops).toEqual(['×', '='])
  })
})
