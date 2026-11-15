import { describe, it, expect } from 'vitest'
import { meForProfiles } from '@/utils/identity'

const mine = [{ username: 'Dylanz297', displayName: 'Dylanz297' }]

describe('meForProfiles', () => {
  it('keeps the saved name when the account owns no verified profile', () => {
    expect(meForProfiles([], 'oo Jake')).toBe('oo Jake')
    expect(meForProfiles(null, 'oo Jake')).toBe('oo Jake')
    expect(meForProfiles([], '')).toBe('')
  })
  it('replaces a saved name that is not one of the account\'s own profiles', () => {
    expect(meForProfiles(mine, 'oo Jake')).toBe('Dylanz297')
    expect(meForProfiles(mine, '')).toBe('Dylanz297')
    expect(meForProfiles(mine, undefined)).toBe('Dylanz297')
  })
  it('keeps the saved name when it is one of them, ignoring case', () => {
    expect(meForProfiles(mine, 'dylanz297')).toBe('Dylanz297')
    const two = [...mine, { username: 'Alt Account', displayName: 'Alt Account' }]
    expect(meForProfiles(two, 'alt account')).toBe('Alt Account')
    expect(meForProfiles(two, 'someone else')).toBe('Dylanz297')
  })
})
