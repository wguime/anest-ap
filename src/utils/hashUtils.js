/**
 * hashUtils — SHA-256 helpers for document signing infrastructure.
 *
 * Wave Onda1-1: produces deterministic, lowercase-hex hashes of arbitrary
 * inputs (Blob, ArrayBuffer, Uint8Array, string) using the Web Crypto API
 * (`crypto.subtle.digest`). The same primitive is exposed in browsers
 * and in Node 16+ (via `node:crypto`'s `webcrypto`), so the helper is
 * isomorphic — production runs in the browser, vitest runs the same code
 * under jsdom with the polyfill installed in `src/__tests__/setup.js`.
 *
 * Algorithm: SHA-256 (NIST FIPS 180-4). 64-char lowercase hex output.
 *
 * @module utils/hashUtils
 */

/**
 * Convert an ArrayBuffer to lowercase hex string.
 * @param {ArrayBuffer} buf
 * @returns {string} 64-char lowercase hex
 */
function bufferToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Normalize input into an ArrayBuffer / Uint8Array suitable for
 * `crypto.subtle.digest`. Accepts Blob, ArrayBuffer, Uint8Array, or string.
 *
 * @param {Blob|ArrayBuffer|Uint8Array|string} input
 * @returns {Promise<ArrayBuffer|Uint8Array>}
 */
async function toBytes(input) {
  if (input == null) {
    throw new TypeError('hashUtils.sha256: input is required')
  }
  // String → UTF-8 bytes
  if (typeof input === 'string') {
    return new TextEncoder().encode(input)
  }
  // Uint8Array (and other typed arrays) — check first because TypedArrays
  // are also "object", and `ArrayBuffer.isView` is realm-safe.
  if (ArrayBuffer.isView(input)) {
    return input
  }
  // ArrayBuffer — `instanceof` can fail across realms (jsdom/node polyfill),
  // so use a duck-type check on the prototype tag as fallback.
  if (
    input instanceof ArrayBuffer ||
    Object.prototype.toString.call(input) === '[object ArrayBuffer]'
  ) {
    return input
  }
  // Blob / File — read as ArrayBuffer
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return await input.arrayBuffer()
  }
  // Duck-typing fallback for Blob-like objects
  if (typeof input.arrayBuffer === 'function') {
    return await input.arrayBuffer()
  }
  throw new TypeError(
    'hashUtils.sha256: unsupported input type (expected Blob, ArrayBuffer, Uint8Array, or string)'
  )
}

/**
 * Compute SHA-256 hash of arbitrary input.
 *
 * @param {Blob|ArrayBuffer|Uint8Array|string} input
 * @returns {Promise<string>} 64-char lowercase hex digest
 *
 * @example
 *   await sha256('hello')
 *   // => '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
 */
export async function sha256(input) {
  const bytes = await toBytes(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return bufferToHex(digest)
}

/**
 * Convenience wrapper: compute SHA-256 of a Blob (e.g. PDF file in memory).
 *
 * @param {Blob} blob
 * @returns {Promise<string>} 64-char lowercase hex digest
 */
export async function sha256OfBlob(blob) {
  if (typeof Blob === 'undefined' || !(blob instanceof Blob)) {
    throw new TypeError('hashUtils.sha256OfBlob: argument must be a Blob')
  }
  return sha256(blob)
}
