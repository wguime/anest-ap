/**
 * useComunicadosQuery — PoC TanStack Query para Comunicados (Fase 2.3).
 *
 * Demonstra o padrão de data-layer com cache + dedupe + invalidação, como
 * alternativa ao fetch manual do ComunicadosContext. Atrás da flag
 * VITE_ENABLE_TANSTACK_QUERY (ver TANSTACK_ENABLED) — quando off, `enabled`
 * fica false e nenhuma query dispara (zero impacto em produção).
 *
 * NOTA de arquitetura:
 * - O supabase client já aguarda `_authReady` internamente antes de cada query,
 *   então o cold-start do JWT é respeitado sem precisar awaitar aqui; basta o
 *   gate `enabled: !!user?.id`.
 * - Field-mapping camelCase↔snake_case é feito DENTRO do service
 *   (fetch*WithDetails / confirmLeitura) — o hook só orquestra cache.
 * - Real-time: este PoC não assina mudanças (o Context faz). Para o PoC de
 *   leitura + confirmação isso é suficiente; mutações invalidam a query.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import supabaseComunicadosService from '@/services/supabaseComunicadosService'

const COMUNICADOS_KEY = (adminMode) => ['comunicados', adminMode ? 'all' : 'publicados']

/**
 * Lista de comunicados via TanStack Query.
 * @param {object} opts
 * @param {boolean} opts.enabled - dispara a query só quando true (gate de auth/flag)
 * @param {boolean} opts.adminMode - true → todos os status; false → só publicados
 */
export function useComunicadosQuery({ enabled = false, adminMode = false } = {}) {
  return useQuery({
    queryKey: COMUNICADOS_KEY(adminMode),
    queryFn: () =>
      adminMode
        ? supabaseComunicadosService.fetchAllWithDetails()
        : supabaseComunicadosService.fetchPublicadosWithDetails(),
    enabled,
  })
}

/**
 * Mutation de confirmação de leitura. Em sucesso, invalida ambas as chaves
 * (publicados/all) para refletir a nova confirmação na lista cacheada.
 */
export function useConfirmLeituraMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ comunicadoId, userId, userName }) =>
      supabaseComunicadosService.confirmLeitura(comunicadoId, userId, userName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comunicados'] })
    },
  })
}
