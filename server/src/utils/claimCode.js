import crypto from 'node:crypto'

// Claim codes are typed into an in-game private message, so they are short and easy to read out: six characters, no
// 0/O or 1/I/L look-alikes, case does not matter. About 800 million possibilities, and a code only has to be unique
// among claims that are still waiting.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

export function generateClaimCode() {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return code
}

/** What someone typed or pasted, tidied into a code: upper case, spaces and dashes removed. Null if it cannot be one. */
export function normalizeClaimCode(value) {
  if (typeof value !== 'string') return null
  const code = value.toUpperCase().replace(/[\s-]/g, '')
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null
}
