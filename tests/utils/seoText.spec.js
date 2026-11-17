import { describe, expect, it } from 'vitest'
import * as client from '@/utils/seoText'
import * as server from '../../server/src/utils/seoText.js'
import { allGoalPages } from '@/data/calculatorGoals'
import { allPlanGuides } from '@/data/planGuides'
import { SKILL_INFO, calculatorDescription, calculatorTitle } from '@/data/skillInfo'
import { XP_TABLE_DESCRIPTION, XP_TABLE_TITLE } from '@/data/xpTable'

for (const [label, lib] of [['client', client], ['server', server]]) {
  describe(`withBrand and fitTitle (${label})`, () => {
    it('adds the brand when the whole title fits', () => {
      expect(lib.withBrand('OSRS Leaderboard')).toBe('OSRS Leaderboard | TickGains')
    })
    it('drops the brand when it would pass 60 characters', () => {
      const long = 'Fastest Way to 99 Construction in OSRS: XP and Hours'
      expect(lib.withBrand(long)).toBe(long)
      expect(lib.withBrand(long, 100)).toBe(`${long} | TickGains`)
    })
    it('does not double the brand', () => {
      expect(lib.withBrand('Planner | TickGains')).toBe('Planner | TickGains')
    })
    it('fitTitle leaves a title without the brand suffix alone', () => {
      expect(lib.fitTitle('Alice | TickGains training plan')).toBe('Alice | TickGains training plan')
      expect(lib.fitTitle('A very long title that has the brand on the end of it | TickGains')).toBe('A very long title that has the brand on the end of it')
    })
  })

  describe(`fitDescription (${label})`, () => {
    it('leaves a short description alone', () => {
      expect(lib.fitDescription('Short and sweet.')).toBe('Short and sweet.')
    })
    it('cuts a long one at a word with an ellipsis, inside the limit', () => {
      const out = lib.fitDescription('word '.repeat(80))
      expect(out.length).toBeLessThanOrEqual(158)
      expect(out.endsWith('…')).toBe(true)
      expect(out).not.toMatch(/\s…$/)
    })
  })
}

describe('what the site generates fits a search result', () => {
  const fits = (title, description) => {
    expect(client.withBrand(title).length).toBeLessThanOrEqual(60)
    expect(description.length).toBeLessThanOrEqual(160)
  }
  it('skill calculator pages', () => {
    for (const info of SKILL_INFO) fits(calculatorTitle(info), calculatorDescription(info))
  })
  it('every calculator goal page', () => {
    const pages = allGoalPages()
    expect(pages.length).toBeGreaterThan(100)
    for (const g of pages) fits(g.title, g.description)
  })
  it('plan guides and the XP table', () => {
    for (const g of allPlanGuides()) fits(g.title, g.description)
    fits(XP_TABLE_TITLE, XP_TABLE_DESCRIPTION)
  })
})
