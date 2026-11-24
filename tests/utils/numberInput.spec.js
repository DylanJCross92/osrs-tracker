import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NumberInput from '@/components/NumberInput.vue'

const type = async (w, text) => {
  const input = w.find('input')
  input.element.value = text
  input.element.setSelectionRange?.(text.length, text.length)
  await input.trigger('input')
}

describe('NumberInput', () => {
  it('passes every keystroke on by default', async () => {
    const w = mount(NumberInput, { props: { modelValue: 29, min: 1, max: 126 } })
    await type(w, '8')
    await type(w, '86')
    expect(w.emitted('update:modelValue').map((e) => e[0])).toEqual([8, 86])
  })

  it('with commit="blur" waits until the person leaves the box, then passes on the finished number once', async () => {
    const w = mount(NumberInput, { props: { modelValue: 29, min: 1, max: 126, commit: 'blur' } })
    await type(w, '8')
    await type(w, '86')
    expect(w.emitted('update:modelValue')).toBeUndefined() // nothing while typing
    expect(w.find('input').element.value).toBe('86') // but the box shows what was typed
    await w.find('input').trigger('blur')
    expect(w.emitted('update:modelValue').map((e) => e[0])).toEqual([86])
  })

  it('commits on Enter too, clamps to the limits, and says nothing when the number did not change', async () => {
    const w = mount(NumberInput, { props: { modelValue: 29, min: 2, max: 126, commit: 'blur' } })
    await type(w, '500')
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue').map((e) => e[0])).toEqual([126])
    const same = mount(NumberInput, { props: { modelValue: 29, min: 1, max: 126, commit: 'blur' } })
    await type(same, '29')
    await same.find('input').trigger('blur')
    expect(same.emitted('update:modelValue')).toBeUndefined()
  })

  it('an emptied box goes back to the lowest allowed number when left', async () => {
    const w = mount(NumberInput, { props: { modelValue: 29, min: 2, max: 126, commit: 'blur' } })
    await type(w, '')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    await w.find('input').trigger('blur')
    expect(w.emitted('update:modelValue').map((e) => e[0])).toEqual([2])
  })
})
