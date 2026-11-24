import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

// Following a player needs an account: signed out, the visitor is asked to create one or log in and nothing is saved. Unfollowing stays possible.
const loggedIn = ref(false)
vi.mock('@/composables/useAuth', () => ({ useAuth: () => ({ loggedIn }) }))
vi.mock('@/api/follows', () => ({ followsApi: { follow: vi.fn().mockResolvedValue({}), unfollow: vi.fn().mockResolvedValue({}) } }))

const load = async () => {
  vi.resetModules()
  localStorage.clear()
  const prompt = await import('@/composables/useSignInPrompt')
  const { useFollowing } = await import('@/composables/useFollowing')
  return { prompt, ...useFollowing() }
}

describe('following needs an account', () => {
  beforeEach(() => {
    loggedIn.value = false
  })

  it('asks a signed-out visitor to sign up or log in, and follows nobody', async () => {
    const f = await load()
    expect(await f.follow('Zezima')).toBeNull()
    expect(f.following.value).toEqual([])
    expect(f.prompt.signInPrompt.open).toBe(true)
    expect(f.prompt.signInPrompt.title).toMatch(/account/i)
    expect(f.prompt.signInPrompt.text).toMatch(/Zezima/)
    expect(await f.toggle('Zezima')).toBeNull()
  })

  it('follows once signed in', async () => {
    const f = await load()
    loggedIn.value = true
    expect(await f.follow('Zezima')).toBe(true)
    expect(f.following.value).toEqual(['Zezima'])
    expect(f.prompt.signInPrompt.open).toBe(false)
  })

  it('still lets a signed-out visitor unfollow a player followed before this rule', async () => {
    const f = await load()
    loggedIn.value = true
    await f.follow('Zezima')
    loggedIn.value = false
    expect(await f.toggle('Zezima')).toBe(false)
    expect(f.following.value).toEqual([])
  })
})
