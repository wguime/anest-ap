/**
 * User Matching Service
 * Matches API names (e.g. "Eduardo Savoldi") to Supabase profile IDs
 * using fuzzy matching strategies.
 */
import supabaseUsersService from './supabaseUsersService'

// ============================================================================
// CACHE
// ============================================================================

let profilesCache = null
let cacheTimestamp = 0
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

async function getCachedProfiles() {
  if (profilesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return profilesCache
  }
  const users = await supabaseUsersService.fetchAllUsers({ active: true })
  profilesCache = users
  cacheTimestamp = Date.now()
  return profilesCache
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalize a name: uppercase, strip accents, remove "Dr./Dra."
 */
function normalize(name) {
  if (!name) return ''
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^(DR\.|DRA\.)\s*/i, '')
    .trim()
}

/**
 * Tokenize a normalized name into words
 */
function tokenize(normalizedName) {
  return normalizedName.split(/\s+/).filter(Boolean)
}

// ============================================================================
// MATCHING STRATEGIES
// ============================================================================

/**
 * Strategy 1: Exact normalized match
 */
function matchExact(apiNorm, profiles) {
  return profiles.filter(p => normalize(p.nome) === apiNorm)
}

/**
 * Strategy 2: All API tokens found in profile tokens
 */
function matchAllTokens(apiTokens, profiles) {
  return profiles.filter(p => {
    const profileTokens = tokenize(normalize(p.nome))
    return apiTokens.every(t => profileTokens.includes(t))
  })
}

/**
 * Strategy 3: Initial + surname — "G. Melo" → initial "G" + "MELO"
 */
function matchInitialSurname(apiTokens, profiles) {
  // Check if first token is a single letter or letter followed by period
  const first = apiTokens[0]
  if (!first) return []

  const isInitial = first.length === 1 || (first.length === 2 && first.endsWith('.'))
  if (!isInitial || apiTokens.length < 2) return []

  const initial = first.charAt(0)
  const surnames = apiTokens.slice(1)

  return profiles.filter(p => {
    const profileTokens = tokenize(normalize(p.nome))
    if (profileTokens.length === 0) return false
    // First name starts with the initial
    const firstNameMatch = profileTokens[0].startsWith(initial)
    // All surnames are found in profile
    const surnameMatch = surnames.every(s => profileTokens.includes(s))
    return firstNameMatch && surnameMatch
  })
}

/**
 * Strategy 4: Disambiguate by first name if multiple matches
 */
function disambiguateByFirstName(apiTokens, candidates) {
  if (candidates.length <= 1 || apiTokens.length === 0) return candidates
  const apiFirst = apiTokens[0]
  const filtered = candidates.filter(p => {
    const profileTokens = tokenize(normalize(p.nome))
    return profileTokens[0] === apiFirst
  })
  return filtered.length > 0 ? filtered : candidates
}

/**
 * Strategy 5: Unique surname fallback
 */
function matchUniqueSurname(apiTokens, profiles) {
  if (apiTokens.length < 2) return []
  const surname = apiTokens[apiTokens.length - 1]

  const matches = profiles.filter(p => {
    const profileTokens = tokenize(normalize(p.nome))
    return profileTokens.includes(surname)
  })

  // Only return if surname is unique to one profile
  return matches.length === 1 ? matches : []
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Match an array of API names to Supabase profiles.
 * @param {string[]} apiNames - Names from Pega Plantao API
 * @returns {Promise<Map<string, {id: string, nome: string}>>} - Map of apiName → profile
 */
export async function matchNamesToProfiles(apiNames) {
  const profiles = await getCachedProfiles()
  const result = new Map()

  for (const apiName of apiNames) {
    if (!apiName || result.has(apiName)) continue

    const apiNorm = normalize(apiName)
    const apiTokens = tokenize(apiNorm)

    // Strategy 1: exact match
    let candidates = matchExact(apiNorm, profiles)

    // Strategy 2: all tokens
    if (candidates.length === 0) {
      candidates = matchAllTokens(apiTokens, profiles)
    }

    // Strategy 3: initial + surname
    if (candidates.length === 0) {
      candidates = matchInitialSurname(apiTokens, profiles)
    }

    // Strategy 4: disambiguate
    if (candidates.length > 1) {
      candidates = disambiguateByFirstName(apiTokens, candidates)
    }

    // Strategy 5: unique surname
    if (candidates.length === 0) {
      candidates = matchUniqueSurname(apiTokens, profiles)
    }

    if (candidates.length >= 1) {
      const match = candidates[0]
      result.set(apiName, { id: match.uid || match.id, nome: match.nome })
    } else {
      console.warn(`[UserMatching] No match for "${apiName}"`)
    }
  }

  return result
}
