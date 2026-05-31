import { QueryClient } from '@tanstack/react-query'

/**
 * QueryClient singleton (Fase 2.3 — PoC TanStack Query).
 *
 * Defaults pensados p/ o ANEST (app médico mobile, dados Supabase via JWT custom):
 * - staleTime 30s: evita refetch agressivo entre navegações curtas.
 * - retry 1: o supabase client já tem _authReady + retry de token; não empilhar.
 * - refetchOnWindowFocus false: app mobile, foco troca muito (teclado, share sheet).
 * - gcTime 5min: mantém cache aquecido durante a sessão.
 *
 * Adoção é incremental e atrás da flag VITE_ENABLE_TANSTACK_QUERY — ver useComunicadosQuery.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/** Flag de adoção (build-time). Quando false, nada de TanStack roda em produção. */
export const TANSTACK_ENABLED = import.meta.env.VITE_ENABLE_TANSTACK_QUERY === 'true'
