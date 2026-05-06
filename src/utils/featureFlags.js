/**
 * Feature flags ANEST.
 *
 * Padrão: variável `VITE_FEATURE_*` em .env / .env.production. Default seguro
 * é `false`. Lê via `import.meta.env` (substituído em build time pelo Vite).
 *
 * Para testes (Node/Vitest), `import.meta.env` é populado pelo Vitest com
 * processo.env — exporta também versão pura para fácil mock.
 */

function readEnvFlag(name, defaultValue = false) {
  try {
    const value = import.meta.env?.[name]
    if (value === undefined || value === null) return defaultValue
    if (typeof value === 'boolean') return value
    return String(value).toLowerCase() === 'true'
  } catch {
    return defaultValue
  }
}

export const isHashSignatureEnabled = () => readEnvFlag('VITE_FEATURE_HASH_SIGNATURE')
export const isWatermarkEnabled = () => readEnvFlag('VITE_FEATURE_WATERMARK')
export const isRetentionEnabled = () => readEnvFlag('VITE_FEATURE_RETENTION')
export const isConfidentialityEnabled = () => readEnvFlag('VITE_FEATURE_CONFIDENTIALITY')
export const isMultiStepApprovalEnabled = () => readEnvFlag('VITE_FEATURE_MULTI_STEP_APPROVAL')
export const isOcrEnabled = () => readEnvFlag('VITE_FEATURE_OCR')

export { readEnvFlag }
