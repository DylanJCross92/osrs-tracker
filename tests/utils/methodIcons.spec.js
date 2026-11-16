import { describe, expect, it } from 'vitest'
import { METHOD_ICONS, methodIconSrc } from '@/data/methodIcons'
import { TRAINING_METHODS } from '@/data/trainingMethods'

describe('methodIconSrc', () => {
  it('is null for a method with no picture', () => {
    expect(methodIconSrc({ id: 'not-a-method' })).toBeNull()
    expect(methodIconSrc(null)).toBeNull()
  })

  it('resolves a file name under the method icons folder, and leaves full paths and addresses alone', () => {
    expect(methodIconSrc({ id: 'x', icon: 'rod.png' })).toBe('/icons/methods/rod.png')
    expect(methodIconSrc({ id: 'x', icon: '/img/rod.png' })).toBe('/img/rod.png')
    expect(methodIconSrc({ id: 'x', icon: 'https://example.com/rod.png' })).toBe('https://example.com/rod.png')
  })

  it('only points at real methods, and the picture files exist', async () => {
    const fs = await import('node:fs')
    const ids = new Set(TRAINING_METHODS.map((m) => m.id))
    for (const [id, file] of Object.entries(METHOD_ICONS)) {
      expect(ids.has(id), id).toBe(true)
      expect(fs.existsSync(`public/icons/methods/${file}`), file).toBe(true)
    }
  })

  it('has a picture for the Woodcutting trees', () => {
    for (const id of ['woodcutting-teak', 'woodcutting-willow', 'woodcutting-yew', 'woodcutting-magic']) expect(METHOD_ICONS[id], id).toBeTruthy()
  })
})
