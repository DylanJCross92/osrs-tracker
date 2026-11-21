import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PriceSpark from '@/components/PriceSpark.vue'

describe('the small price line', () => {
  it('draws a line across the width, coloured by where it ended against where it started', () => {
    const up = mount(PriceSpark, { props: { values: [10, 12, 11, 15] } })
    expect(up.classes()).toContain('up')
    const pts = up.find('polyline').attributes('points').split(' ')
    expect(pts).toHaveLength(4)
    expect(pts[0].startsWith('0.0,')).toBe(true)
    expect(pts[3].startsWith('72.0,')).toBe(true)
    expect(mount(PriceSpark, { props: { values: [15, 12, 11, 10] } }).classes()).toContain('down')
    expect(mount(PriceSpark, { props: { values: [5, 6, 5] } }).classes()).toContain('flat')
  })
  it('draws a flat price as a level line and nothing when there is too little to draw', () => {
    const flat = mount(PriceSpark, { props: { values: [2, 2, 2, 2] } })
    const ys = flat.find('polyline').attributes('points').split(' ').map((p) => p.split(',')[1])
    expect(new Set(ys).size).toBe(1)
    expect(mount(PriceSpark, { props: { values: [3] } }).find('svg').exists()).toBe(false)
    expect(mount(PriceSpark, { props: { values: undefined } }).find('svg').exists()).toBe(false)
  })
})
