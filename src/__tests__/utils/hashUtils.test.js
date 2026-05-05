/**
 * Tests for src/utils/hashUtils.js — Onda1-1 (SHA-256 helpers).
 *
 * Vetores de SHA-256 conhecidos (validáveis em qualquer implementação NIST):
 *   sha256("")      = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 *   sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
 *   sha256("abc")   = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
 *
 * `crypto.subtle` é polyfilled para jsdom em `src/__tests__/setup.js`
 * (importa `node:crypto` webcrypto).
 */
import { describe, it, expect } from 'vitest'
import { sha256, sha256OfBlob } from '../../utils/hashUtils'

const EMPTY_HASH =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const HELLO_HASH =
  '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
const ABC_HASH =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

describe('sha256', () => {
  it('returns the canonical SHA-256 hash of "hello"', async () => {
    expect(await sha256('hello')).toBe(HELLO_HASH)
  })

  it('returns the canonical hash of the empty string', async () => {
    expect(await sha256('')).toBe(EMPTY_HASH)
  })

  it('returns the canonical hash of "abc"', async () => {
    expect(await sha256('abc')).toBe(ABC_HASH)
  })

  it('produces 64-char lowercase hex output', async () => {
    const h = await sha256('any input goes here')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashes ArrayBuffer and Uint8Array equivalent to string with same UTF-8 bytes', async () => {
    const bytes = new TextEncoder().encode('hello')
    expect(await sha256(bytes)).toBe(HELLO_HASH)
    expect(await sha256(bytes.buffer)).toBe(HELLO_HASH)
  })

  it('rejects nullish input', async () => {
    await expect(sha256(null)).rejects.toThrow(/required/)
    await expect(sha256(undefined)).rejects.toThrow(/required/)
  })

  it('rejects unsupported input types', async () => {
    await expect(sha256(42)).rejects.toThrow(/unsupported input type/)
    await expect(sha256({ foo: 'bar' })).rejects.toThrow(/unsupported input type/)
  })
})

describe('sha256OfBlob', () => {
  it('hashes a Blob with the same digest as its string content', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' })
    expect(await sha256OfBlob(blob)).toBe(HELLO_HASH)
  })

  it('produces identical hashes for blobs with identical content but different types', async () => {
    const a = new Blob(['hello'], { type: 'application/pdf' })
    const b = new Blob(['hello'], { type: 'text/plain' })
    expect(await sha256OfBlob(a)).toBe(await sha256OfBlob(b))
  })

  it('produces different hashes for different content', async () => {
    const a = new Blob(['foo'])
    const b = new Blob(['bar'])
    expect(await sha256OfBlob(a)).not.toBe(await sha256OfBlob(b))
  })

  it('rejects non-Blob arguments', async () => {
    await expect(sha256OfBlob('not a blob')).rejects.toThrow(/must be a Blob/)
    await expect(sha256OfBlob(null)).rejects.toThrow(/must be a Blob/)
  })
})
