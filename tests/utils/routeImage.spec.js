import { describe, expect, it } from 'vitest'
import { imageFileName, rowsForImage, routeLevels, routeSubtitle } from '@/utils/routeImage'
import { planGoal, xpAtLevel, AUTO_FAST } from '@/utils/planner'
import { TRAINING_METHODS } from '@/data/trainingMethods'
import { methodIconSrc } from '@/data/methodIcons'

describe('rowsForImage', () => {
  it('turns a 1 to 99 route into rows with levels, method, rates and time', () => {
    const plan = planGoal({ skill: 'Runecraft', currentXp: 0, targetXp: xpAtLevel(99), methodId: AUTO_FAST })
    const { rows, more } = rowsForImage(plan.segments)
    expect(rows.length + more).toBe(plan.segments.length)
    expect(rows[0].levels).toBe('1 to ' + plan.segments[0].endLevel)
    for (const r of rows) {
      expect(r.name).toBeTruthy()
      expect(r.hours).not.toBe('')
    }
  })

  it('folds a very long route into "more" and marks unpriced steps', () => {
    const segs = Array.from({ length: 20 }, (_, i) => ({ startLevel: i + 1, endLevel: i + 2, method: { name: 'M', id: 'x' }, xpPerHour: 1000, netGp: null, hours: 1 }))
    const { rows, more } = rowsForImage(segs)
    expect(rows).toHaveLength(14)
    expect(more).toBe(6)
    expect(rows[0].gp).toBe('No GP data')
    expect(rows[0].gpSign).toBe(0)
  })

  it('handles no route', () => {
    expect(rowsForImage(null)).toEqual({ rows: [], more: 0 })
  })
})

describe('imageFileName', () => {
  it('is a safe png name', () => {
    expect(imageFileName('Runecraft', 1, 99)).toBe('tickgains-runecraft-1-99.png')
  })
})

describe('runecraft nature runes', () => {
  it('has a double nature (Abyss) method from 91 and every nature method has an icon', () => {
    const m = TRAINING_METHODS.find((x) => x.id === 'runecraft-nature-double')
    expect(m).toMatchObject({ skill: 'Runecraft', minLevel: 91 })
    for (const id of ['runecraft-nature', 'runecraft-nature-double', 'runecraft-nature-cape']) {
      expect(methodIconSrc({ id }), id).toBeTruthy()
    }
  })
})

describe('routeSubtitle and routeLevels', () => {
  const seg = (name, kind, startLevel, endLevel) => ({ method: { name }, kind, startLevel, endLevel })

  it('names the one method the route really uses, whatever the goal setting says', () => {
    expect(routeSubtitle([seg('Ardougne Rooftop', 'manual', 95, 99)], 'Using Hallowed Sepulchre')).toBe('Using Ardougne Rooftop')
  })

  it('says Custom route when levels were picked by hand among other methods, else the strategy wording', () => {
    expect(routeSubtitle([seg('A', 'auto', 1, 50), seg('B', 'manual', 50, 99)], 'Fastest route')).toBe('Custom route')
    expect(routeSubtitle([seg('A', 'auto', 1, 50), seg('B', 'auto', 50, 99)], 'Fastest route')).toBe('Fastest route')
    expect(routeSubtitle([], 'Cheapest route')).toBe('Cheapest route')
  })

  it('takes the levels from the steps, since quest xp can move the start up', () => {
    expect(routeLevels([seg('A', 'auto', 95, 97), seg('B', 'auto', 97, 99)], 93, 99)).toEqual({ from: 95, to: 99 })
    expect(routeLevels([], 93, 99)).toEqual({ from: 93, to: 99 })
  })
})
