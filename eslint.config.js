import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .agents/** é tooling vendorizado de skills (CommonJS/Node), não código do app
  globalIgnores(['dist', '.claude/worktrees/**', '.agents/**', 'e2e/**', 'coverage/**', 'public/sw.js']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',
        __BUILD_ID__: 'readonly', // carimbo do build (vite define) — guarda de versão
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // react-jsx-uses-vars resolves no-unused-vars false-positives in JSX
      // member expressions like <motion.div>, <Tabs.List>.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]|^_',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // React Compiler advisory diagnostics (eslint-plugin-react-hooks v7+):
      // surfacing as warnings so they're visible during dev but don't block CI.
      // Rationale: these analyze potential perf/correctness concerns, but many
      // are intentional patterns (e.g., effects setting state on prop change).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/unsupported-syntax': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/incompatible-library': 'warn',
      'react-hooks/fbt': 'warn',
      'react-hooks/fire': 'warn',
      'react-hooks/gating': 'warn',
      'react-hooks/capitalized-calls': 'warn',
      'react-hooks/component-hook-factories': 'warn',
      'react-hooks/no-deriving-state-in-effects': 'warn',
      'react-hooks/memoized-effect-dependencies': 'warn',
      'react-hooks/automatic-effect-dependencies': 'warn',
      // HMR boundary heuristic is advisory; many helpers/legacy files mix exports.
      'react-refresh/only-export-components': 'warn',
    },
  },
  // Guardrail DS (Fase 1.6.1): proíbe re-introduzir o header fixo copy-paste.
  // Toda página deve usar <PageHeader> de @/components (src/components/PageHeader.jsx).
  // Exceção temporária: CateteresPeridualPage tem sub-barra fixa de hospitais que
  // requer enhancement no PageHeader (slot belowSlot + spacer ajustável).
  {
    files: ['src/pages/**/*.jsx'],
    ignores: ['src/pages/cateter-peridural/CateteresPeridualPage.jsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/fixed top-0 left-0 right-0 z-50/]",
          message:
            'Header fixo copy-paste proibido. Use <PageHeader> de @/components (Fase 1.6.1 DS).',
        },
      ],
    },
  },
  // Node.js scripts — ESM (.mjs, .js) modules with Node globals
  {
    files: [
      'scripts/**/*.{js,mjs}',
      'src/scripts/**/*.{js,mjs}',
      'functions/**/*.{js,mjs}',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'module',
    },
  },
  // Node.js scripts — CommonJS (.cjs)
  {
    files: [
      'scripts/**/*.cjs',
      'src/scripts/**/*.cjs',
      'functions/**/*.cjs',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
  },
  // Tests (browser + node + vitest globals)
  {
    files: [
      'src/**/__tests__/**/*.{js,jsx}',
      'src/**/*.test.{js,jsx}',
      'src/**/*.spec.{js,jsx}',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
])
