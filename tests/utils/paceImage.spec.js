import { describe, expect, it } from 'vitest'
import { chartGeometry, paceFileName } from '@/utils/paceImage'

const series = {
  baseline: new Date('2026-11-01T00:00:00Z'),
  totalXp: 1000,
  plannedDays: 20,
  endDay: 24,
  nowDay: 10,
  projectedDay: 22,
  planned: [{ day: 0, xp: 0 }, { day: 20, xp: 1000 }],
  actual: [{ day: 0, xp: 0 }, { day: 10, xp: 600 }],
  projected: [{ day: 10, xp: 600 }, { day: 22, xp: 1000 }],
  marks: [{ day: 8, xp: 400 }, { day: 20, xp: 1000 }],
}
const area = { left: 100, top: 50, width: 800, height: 300 }

describe('pace chart picture', () => {
  it('puts the lines inside the chart area, the end of the plan at the top and today in between', () => {
    const g = chartGeometry(series, area)
    for (const p of [...g.planned, ...g.actual, ...g.projected]) {
      expect(p.x).toBeGreaterThanOrEqual(area.left)
      expect(p.x).toBeLessThanOrEqual(area.left + area.width)
      expect(p.y).toBeGreaterThanOrEqual(area.top)
      expect(p.y).toBeLessThanOrEqual(area.top + area.height)
    }
    expect(g.plannedEnd.y).toBe(area.top) // all the XP is the top of the chart
    expect(g.baselineY).toBe(area.top + area.height)
    expect(g.todayX).toBeGreaterThan(g.planned[0].x)
    expect(g.todayX).toBeLessThan(g.plannedEnd.x)
    expect(g.now.y).toBeGreaterThan(area.top)
    expect(g.marks).toHaveLength(1) // the last goal is the end marker
  })

  it('labels the axes: nought, half and all the XP, and dates from the start across', () => {
    const g = chartGeometry(series, area, { dateLabel: (d) => d.toISOString().slice(5, 10) })
    expect(g.yTicks.map((t) => t.label)).toEqual(['0', '500', '1K'])
    expect(g.xTicks).toHaveLength(5)
    expect(g.xTicks[0].label).toBe('11-01')
    expect(g.xTicks[0].anchor).toBe('left')
    expect(g.xTicks[4].anchor).toBe('right')
  })

  it('has no projection or today line when there is nothing to project or no time has passed', () => {
    const g = chartGeometry({ ...series, projected: null, nowDay: 0 }, area)
    expect(g.projected).toBeNull()
    expect(g.projectedEnd).toBeNull()
    expect(g.todayX).toBeNull()
  })

  it('names the file after the plan', () => {
    expect(paceFileName('My training plan')).toBe('tickgains-my-training-plan-pace.png')
    expect(paceFileName('')).toBe('tickgains-plan-pace.png')
    expect(paceFileName('  !!  ')).toBe('tickgains-plan-pace.png')
  })
})
