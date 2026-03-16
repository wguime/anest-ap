import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import path from "node:path"
import { fileURLToPath } from "node:url"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: false, // keep existing /public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        globIgnores: ['**/gestao-incidentes.html', '**/formulario-incidente.html', '**/formulario-denuncia.html'],
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB — main chunk is ~4.6MB
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/gestao-incidentes\.html/,
          /^\/formulario-incidente\.html/,
          /^\/formulario-denuncia\.html/,
        ],
        runtimeCaching: [
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
    setupFiles: ['./src/__tests__/setup.js'],
  },
})
