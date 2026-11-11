import { describe, it, expect } from 'vitest'
import { cleanLink, sanitizeProfilePage, sniffImageType, MAX_BIO, MAX_LINKS } from '../../server/src/utils/profilePage.js'

describe('cleanLink', () => {
  it('accepts https links to the right site only', () => {
    expect(cleanLink({ kind: 'discord', url: 'https://discord.gg/abc123' })).toEqual({ kind: 'discord', url: 'https://discord.gg/abc123' })
    expect(cleanLink({ kind: 'twitch', url: 'https://www.twitch.tv/someone' })?.kind).toBe('twitch')
    expect(cleanLink({ kind: 'youtube', url: 'https://youtu.be/xyz' })?.kind).toBe('youtube')
    expect(cleanLink({ kind: 'twitter', url: 'https://x.com/someone' })?.kind).toBe('twitter')
  })
  it('rejects other sites, other schemes and trick URLs', () => {
    for (const bad of [
      { kind: 'discord', url: 'https://evil.com/discord.gg' },
      { kind: 'twitch', url: 'http://twitch.tv/x' },
      { kind: 'youtube', url: 'javascript:alert(1)' },
      { kind: 'discord', url: 'https://discord.gg.evil.com/x' },
      { kind: 'discord', url: 'https://user:pw@discord.gg/x' },
      { kind: 'website', url: 'https://example.com' },
      { kind: 'discord', url: 'not a url' },
      null,
      'x',
    ]) expect(cleanLink(bad)).toBeNull()
  })
})

describe('sanitizeProfilePage', () => {
  it('flattens the bio to one paragraph and enforces its limit', () => {
    const out = sanitizeProfilePage({ bio: `  Hello\n\nworld\t${'x'.repeat(400)} ` })
    expect(out.bio.startsWith('Hello world x')).toBe(true)
    expect(out.bio.length).toBe(MAX_BIO)
    expect(out.bio).not.toContain('\n')
  })
  it('keeps at most MAX_LINKS unique valid links', () => {
    const links = Array.from({ length: 9 }, (_, i) => ({ kind: 'discord', url: `https://discord.gg/room${i}` }))
    const out = sanitizeProfilePage({ links: [...links, { kind: 'discord', url: 'https://discord.gg/room0' }, { kind: 'bad', url: 'x' }] })
    expect(out.links).toHaveLength(MAX_LINKS)
  })
  it('leaves missing fields out so a partial save cannot wipe the rest', () => {
    expect(sanitizeProfilePage({ bio: 'Hi' })).toEqual({ bio: 'Hi' })
    expect(sanitizeProfilePage({ status: 'ignored now' })).toEqual({})
    for (const bad of [null, undefined, 5, 'x', []]) expect(sanitizeProfilePage(bad)).toEqual({})
  })
})

describe('sniffImageType', () => {
  const pad = (b) => Buffer.concat([Buffer.from(b), Buffer.alloc(20)])
  it('recognises real images by their first bytes', () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]))).toBe('image/webp')
  })
  it('rejects everything else, whatever the filename or header said', () => {
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull()
    expect(sniffImageType(Buffer.from('GIF89a......'))).toBeNull()
    expect(sniffImageType(Buffer.from('short'))).toBeNull()
    expect(sniffImageType(null)).toBeNull()
  })
})
