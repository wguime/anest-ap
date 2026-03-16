/**
 * Check-in Code Generator — TOTP-like rotating codes for meeting attendance
 *
 * Generates deterministic 4-digit codes that rotate every 60 seconds.
 * Uses djb2 hash for simplicity (no crypto dependency for generation).
 */

/**
 * djb2 hash — fast, deterministic string hash
 */
function djb2(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
  }
  return hash
}

/**
 * Generate a 4-digit check-in code from seed + time window
 * @param {string} seed - The meeting's unique seed
 * @param {number} windowIndex - Time window index (changes every 60s)
 * @returns {string} 4-digit zero-padded code
 */
export function generateCheckinCode(seed, windowIndex) {
  const input = `${seed}_${windowIndex}`
  const hash = djb2(input)
  return String(hash % 10000).padStart(4, '0')
}

/**
 * Get the current 60-second window index
 * @returns {number}
 */
export function getCurrentWindowIndex() {
  return Math.floor(Date.now() / 60000)
}

/**
 * Get seconds remaining until the next window rotation
 * @returns {number} Seconds until next code change (0-59)
 */
export function getSecondsUntilNextWindow() {
  return 60 - Math.floor((Date.now() % 60000) / 1000)
}

/**
 * Generate a random 16-hex-char seed for a meeting
 * @returns {string}
 */
export function generateRandomSeed() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
