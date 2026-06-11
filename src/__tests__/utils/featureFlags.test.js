/**
 * Tests for src/utils/featureFlags.js
 *
 * Flags lidas de import.meta.env (VITE_FEATURE_*), default seguro = false.
 * No Vitest, vi.stubEnv() afeta import.meta.env, então dá para testar o
 * parsing real sem mockar o módulo.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  readEnvFlag,
  isHashSignatureEnabled,
  isWatermarkEnabled,
  isRetentionEnabled,
  isConfidentialityEnabled,
  isMultiStepApprovalEnabled,
  isOcrEnabled,
  isBulkImportEnabled,
  isPdfaEnabled,
} from '../../utils/featureFlags'

afterEach(() => vi.unstubAllEnvs())

describe('featureFlags.readEnvFlag', () => {
  it('returns false (safe default) when the var is not set', () => {
    expect(readEnvFlag('VITE_FEATURE_DOES_NOT_EXIST')).toBe(false)
  })

  it('honors an explicit defaultValue when the var is not set', () => {
    expect(readEnvFlag('VITE_FEATURE_DOES_NOT_EXIST', true)).toBe(true)
  })

  it('returns true for the string "true" (case-insensitive)', () => {
    vi.stubEnv('VITE_FEATURE_X', 'true')
    expect(readEnvFlag('VITE_FEATURE_X')).toBe(true)

    vi.stubEnv('VITE_FEATURE_X', 'TRUE')
    expect(readEnvFlag('VITE_FEATURE_X')).toBe(true)

    vi.stubEnv('VITE_FEATURE_X', 'True')
    expect(readEnvFlag('VITE_FEATURE_X')).toBe(true)
  })

  it('returns false for "false" and anything that is not "true"', () => {
    for (const value of ['false', '1', '0', 'yes', 'on', 'enabled', ' true ']) {
      vi.stubEnv('VITE_FEATURE_X', value)
      expect(readEnvFlag('VITE_FEATURE_X'), `value="${value}"`).toBe(false)
    }
  })

  it('returns false for empty string (set but blank)', () => {
    vi.stubEnv('VITE_FEATURE_X', '')
    expect(readEnvFlag('VITE_FEATURE_X')).toBe(false)
  })

  it('passes through native boolean env values (Vite injects DEV/PROD as boolean)', () => {
    // No Vitest, import.meta.env.DEV é boolean true — exercita o branch
    // `typeof value === 'boolean'` sem stub.
    expect(readEnvFlag('DEV')).toBe(import.meta.env.DEV)
    expect(typeof readEnvFlag('DEV')).toBe('boolean')
  })
})

describe('featureFlags — exported flag readers', () => {
  const FLAGS = [
    ['VITE_FEATURE_HASH_SIGNATURE', isHashSignatureEnabled],
    ['VITE_FEATURE_WATERMARK', isWatermarkEnabled],
    ['VITE_FEATURE_RETENTION', isRetentionEnabled],
    ['VITE_FEATURE_CONFIDENTIALITY', isConfidentialityEnabled],
    ['VITE_FEATURE_MULTI_STEP_APPROVAL', isMultiStepApprovalEnabled],
    ['VITE_FEATURE_OCR', isOcrEnabled],
    ['VITE_FEATURE_BULK_IMPORT', isBulkImportEnabled],
    ['VITE_FEATURE_PDFA', isPdfaEnabled],
  ]

  it.each(FLAGS)('%s: defaults to false when unset', (envName, reader) => {
    vi.stubEnv(envName, undefined)
    expect(reader()).toBe(false)
  })

  it.each(FLAGS)('%s: returns true when env is "true"', (envName, reader) => {
    vi.stubEnv(envName, 'true')
    expect(reader()).toBe(true)
  })

  it.each(FLAGS)('%s: returns false when env is "false"', (envName, reader) => {
    vi.stubEnv(envName, 'false')
    expect(reader()).toBe(false)
  })

  it('flags are independent — enabling one does not enable others', () => {
    vi.stubEnv('VITE_FEATURE_OCR', 'true')
    expect(isOcrEnabled()).toBe(true)
    expect(isWatermarkEnabled()).toBe(false)
    expect(isPdfaEnabled()).toBe(false)
  })

  it('flags are read lazily — value changes are picked up per call', () => {
    expect(isRetentionEnabled()).toBe(false)
    vi.stubEnv('VITE_FEATURE_RETENTION', 'true')
    expect(isRetentionEnabled()).toBe(true)
    vi.unstubAllEnvs()
    expect(isRetentionEnabled()).toBe(false)
  })
})
