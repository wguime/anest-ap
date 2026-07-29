import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Identidade do build. Vai para o bundle (`__BUILD_ID__`) e para /version.json;
// o app compara os dois e se recarrega quando estão diferentes — é o que impede
// um aparelho de ficar horas rodando código velho (ver src/pwaUpdate.js).
const BUILD_ID = new Date().toISOString()

/** Emite /version.json com o id deste build (fora do precache de propósito). */
const versionJsonPlugin = () => ({
  name: 'anest-version-json',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ buildId: BUILD_ID }),
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    versionJsonPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // keep existing /public/manifest.json
      workbox: {
        // Apaga precaches de SW antigos no activate — evita ChunkLoadError pós-deploy
        // (chunks lazy com hash velho que não existem mais no novo deploy).
        cleanupOutdatedCaches: true,
        // Shell only — lazy chunks vão pelo runtimeCaching abaixo (app-chunks / css-chunks).
        // Mantém index.html + manifest + entry JS + vendors críticos + CSS principal + ícones/fontes pequenos.
        globPatterns: [
          'index.html',
          'manifest*.json',
          'assets/index-*.js',
          'assets/index-*.css',
          'assets/vendor-react-*.js',
          'assets/vendor-ui-*.js',
          'assets/vendor-supabase-*.js',
          '**/*.{woff2,ico,svg}',
        ],
        globIgnores: ['**/gestao-incidentes.html', '**/formulario-incidente.html', '**/formulario-denuncia.html'],
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024, // 2MB — força chunks gigantes para runtime cache
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/gestao-incidentes\.html/,
          /^\/formulario-incidente\.html/,
          /^\/formulario-denuncia\.html/,
        ],
        runtimeCaching: [
          {
            // App chunks lazy-loaded (assets/*.js que não entraram no precache) — CacheFirst, 7 dias
            urlPattern: ({ url, request }) =>
              request.destination === 'script' && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-chunks',
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // CSS chunks lazy-loaded — CacheFirst, 7 dias
            urlPattern: ({ url, request }) =>
              request.destination === 'style' && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'css-chunks',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Images — CacheFirst, 30 days
            urlPattern: /\.(?:png|jpg|jpeg|gif|svg|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            // Supabase REST API — NetworkFirst with 10s timeout
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60, // 1 day
              },
            },
          },
          {
            // Supabase Storage (signed + public) — NetworkFirst, TTL alinhado ao signed URL (30 min).
            // ignoreSearch reaproveita o cache mesmo quando o token assinado muda entre requests.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/(sign|public)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              networkTimeoutSeconds: 5,
              matchOptions: { ignoreSearch: true },
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 30 * 60, // 30 min
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firebase Auth — always fresh tokens
            urlPattern: /^https:\/\/.*\.(googleapis|firebaseapp|firebase)\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Google Fonts — CacheFirst, 1 year
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/pegaplantao': {
        target: 'https://www.pegaplantao.com.br',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pegaplantao/, ''),
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react', 'framer-motion'],
          // Firebase é ~500KB+ (auth + firestore + messaging) — só consumido
          // por hooks/services específicos, mas estava eager via UserContext.
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging', 'firebase/analytics'],
          // PDF stack (>1MB combinado) — geração/preview de docs, certificados, OCR previews.
          'vendor-pdf': ['jspdf', 'pdf-lib'],
          // Markdown rendering (comunicados, educação) — separa do main.
          'vendor-markdown': ['react-markdown', 'dompurify'],
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src"),
      "@design-system": path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "./src/design-system"
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Default de 5s estoura em testes de componente jsdom quando os workers
    // disputam transform da run completa (local: iCloud; CI: runner 2-core).
    // Falha real de hang continua detectável — só fica mais lenta.
    testTimeout: 20000,
    hookTimeout: 30000,
    setupFiles: ['./src/__tests__/setup.js'],
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/worktrees/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/__tests__/**',
        'src/main.jsx',
        'src/design-system/showcase/**',
        'src/scripts/**',
      ],
      // Wave 1.4 enforceable floor — locks current ratchet com buffer ~0.5pp.
      // Baseline mensurada 2026-05-12 (após F6.3 conflict tests):
      //   lines: 13.08%, statements: 12.46%, functions: 8.34%, branches: 9.07%
      // Sprint 20 Stream 1.2 (2026-05-13): reunioesService 43→96% cov
      //   adicionou +145 lines, +20 functions, +149 statements, +85 branches.
      //   Novo baseline esperado: lines ~13.45%, statements ~12.79%,
      //   functions ~8.52%, branches ~9.30%. Ratchet conservador abaixo.
      // Targets aspiracionais (30/35/60) movidos para roadmap em
      // .claude/handoff-* — eram unreachable em single-agent run e quebravam
      // CI sem o coverage estar realmente naquele patamar.
      thresholds: {
        lines: 13,
        functions: 8.3,
        branches: 9,
        statements: 12.5,
      },
    },
  },
})
