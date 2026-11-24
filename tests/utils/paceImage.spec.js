import { describe, expect, it } from 'vitest'
import { chartGeometry, chipRows, goalChipText, goalLabels, paceFileName, soloLabelText } from '@/utils/paceImage'

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

describe('goal labels', () => {
  const X = (d) => 100 + d * 40
  const Y = (xp) => 350 - xp * 0.3
  const marks = [
    { skill: 'Smithing', targetLevel: 70, day: 4, xp: 300 },
    { skill: 'Mining', targetLevel: 70, day: 4.2, xp: 320 },
    { skill: 'Agility', targetLevel: 99, day: 12, xp: 1000 },
  ]

  it('labels every goal with its target level, the last goal first', () => {
    const l = goalLabels([marks[0], marks[2]], X, Y)
    expect(l.map((x) => x.text)).toEqual(['Agility 99', 'Smithing 70'])
  })

  it('leaves out a label that would land on another, but never the last goal', () => {
    const l = goalLabels(marks, X, Y)
    expect(l[0].text).toBe('Agility 99')
    // Smithing and Mining are a fraction of a day apart: only one of them fits.
    expect(l.filter((x) => /Smithing|Mining/.test(x.text))).toHaveLength(1)
  })

  it('leaves out a label that would run off the chart', () => {
    const l = goalLabels([{ skill: 'Agility', targetLevel: 99, day: 0, xp: 0 }], X, Y, { box: { left: 95, right: 500, top: 0 } })
    expect(l).toEqual([])
  })

  it('wraps the goals into chips that fit the width', () => {
    const rows = chipRows(['Agility 99', 'Smithing 70', 'Mining 70', 'Thieving 94'], (t) => t.length * 10, 300)
    expect(rows.flat().map((c) => c.text)).toEqual(['Agility 99', 'Smithing 70', 'Mining 70', 'Thieving 94'])
    for (const r of rows) expect(r.reduce((n, c) => n + c.width, 0) + (r.length - 1) * 10).toBeLessThanOrEqual(300)
    expect(rows.length).toBeGreaterThan(1)
  })
})

describe('goal chips say where the player is now', () => {
  it('shows the current level and the goal, a finished goal as done, and just the goal when the level is not known', () => {
    expect(goalChipText({ skill: 'Agility', from: 91, to: 99, done: false })).toBe('Agility 91 → 99')
    expect(goalChipText({ skill: 'Agility', from: 99, to: 99, done: true })).toBe('Agility 99 ✓')
    expect(goalChipText({ skill: 'Agility', from: null, to: 99 })).toBe('Agility 99')
    expect(goalChipText({ skill: 'Agility', from: 99, to: 99, done: false })).toBe('Agility 99')
  })
})

describe('a plan of one skill', () => {
  it('writes where you are into the finish label, once, instead of a second label', () => {
    const X = (d) => 100 + d * 40
    const Y = (xp) => 350 - xp * 0.3
    const marks = [{ skill: 'Agility', targetLevel: 99, day: 12, xp: 1000 }]
    const solo = soloLabelText([{ skill: 'Agility', from: 98, to: 99, done: false }])
    expect(goalLabels(marks, X, Y, { text: solo }).map((l) => l.text)).toEqual(['Agility 98 → 99'])
    // several goals, a finished goal, or no known level: the default wording
    expect(soloLabelText([{ skill: 'A', from: 1, to: 2 }, { skill: 'B', from: 1, to: 2 }])).toBeNull()
    expect(soloLabelText([{ skill: 'A', from: 99, to: 99, done: true }])).toBeNull()
    expect(goalLabels(marks, X, Y, { text: null }).map((l) => l.text)).toEqual(['Agility 99'])
  })
})
