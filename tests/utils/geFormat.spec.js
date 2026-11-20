import { describe, it, expect } from 'vitest'
import { changeClass, gpAxis, gpText, itemImage, pctText, rowsFromIndex, signedGp } from '@/utils/geFormat'
import { methodsUsingItem } from '@/utils/itemMethods'

describe('geFormat', () => {
  it('writes prices in whole coins up to 10M and shortened after', () => {
    expect(gpText(3727)).toBe('3,727')
    expect(gpText(9_999_999)).toBe('9,999,999')
    expect(gpText(18_500_000)).toBe('18.5M')
    expect(gpText(2_147_000_000)).toBe('2.15B')
    expect(gpText(null)).toBe('-')
  })
  it('shortens chart axis labels', () => {
    expect(gpAxis(950)).toBe('950')
    expect(gpAxis(3500)).toBe('3.5k')
    expect(gpAxis(45_000)).toBe('45k')
    expect(gpAxis(2_400_000)).toBe('2.4M')
    expect(gpAxis(15_000_000)).toBe('15M')
  })
  it('signs changes and colours them', () => {
    expect(pctText(4.2)).toBe('+4.2%')
    expect(pctText(-3)).toBe('-3%')
    expect(pctText(null)).toBe('-')
    expect(signedGp(42)).toBe('+42')
    expect(signedGp(-1500)).toBe('-1,500')
    expect(changeClass(1)).toBe('planner-gain')
    expect(changeClass(-1)).toBe('planner-cost')
    expect(changeClass(0)).toBe('')
  })
  it('turns the server rows into items with a middle price', () => {
    const [a, b] = rowsFromIndex([[536, 'Dragon bones', 'dragon-bones', 1, 3783, 3666, 98459, 7500, 1.5, -4, 17.5, 38], [7, 'Odd', 'odd', 0, null, 12, 0, null, null, null, null, null]])
    expect(a).toMatchObject({ id: 536, members: true, price: 3725, margin: 38, change7: -4, icon: '' })
    expect(b).toMatchObject({ members: false, price: 12 })
    // Stackable items have a picture file that is not just their name.
    expect(rowsFromIndex([[561, 'Nature rune', 'nature-rune', 0, 170, 169, 1, 25000, 0, 0, 0, 1, 'Nature rune 5.png']])[0].icon).toBe('Nature rune 5.png')
  })
  it('builds an image address from the icon or the name', () => {
    expect(itemImage('Dragon bones.png', 'x')).toBe('https://oldschool.runescape.wiki/images/Dragon_bones.png')
    expect(itemImage('', 'Rune essence')).toBe('https://oldschool.runescape.wiki/images/Rune_essence.png')
  })
})

describe('methodsUsingItem', () => {
  it('finds the methods that use an item up, whatever the case', () => {
    const found = methodsUsingItem('dragon bones')
    expect(found.length).toBeGreaterThan(0)
    expect(found.every((m) => m.skill === 'Prayer' && m.path === '/calculators/prayer')).toBe(true)
  })
  it('also finds items an action uses as an extra', () => {
    expect(methodsUsingItem('Coal').length).toBeGreaterThan(0)
  })
  it('is empty for an item no method uses', () => {
    expect(methodsUsingItem('Twisted bow')).toEqual([])
  })
})
