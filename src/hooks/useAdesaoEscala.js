/**
 * Hooks do relatório de adesão à Escala, todos com cache SWR em localStorage.
 *
 * `idadeMaxMs`:
 *   - 0 (página do relatório): mostra o cache na hora e SEMPRE busca de novo ("ao vivo").
 *   - IDADE_CARD_MS (card da Home): só busca se o cache passou da idade — a Home não pode virar
 *     uma chamada ao banco por abertura.
 * `ativo=false` adia a busca (ex.: Home antes do sinal do DeferredReadyContext; aba de mês que
 * ninguém abriu).
 */
import { useCallback, useEffect, useState } from 'react'
import {
  buscarAdesao, buscarAdesaoPeriodo, buscarAdesaoEvolucao, lerCacheAdesao,
} from '@/services/escalaAdesaoService'
import { limitesMes } from '@/lib/escalaAdesao'

function useConsultaAdesao(id, buscar, { idadeMaxMs = 0, ativo = true } = {}) {
  const [estado, setEstado] = useState(() => {
    const c = id != null ? lerCacheAdesao(id) : null
    return { id, dados: c?.dados ?? null, em: c?.em ?? null, carregando: false, erro: null }
  })

  const carregar = useCallback(async () => {
    if (id == null) return
    setEstado((s) => ({ ...s, carregando: true, erro: null }))
    try {
      const dados = await buscar()
      setEstado({ id, dados, em: Date.now(), carregando: false, erro: null })
    } catch (e) {
      setEstado((s) => ({ ...s, carregando: false, erro: e?.message || 'Erro ao carregar' }))
    }
    // `buscar` muda a cada render; o que identifica a consulta é o `id`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!ativo || id == null) return
    const c = lerCacheAdesao(id)
    // troca de consulta: mostra o cache dela antes de buscar
    if (c) setEstado((s) => (s.id === id ? s : { id, dados: c.dados, em: c.em, carregando: false, erro: null }))
    const velho = !c || Date.now() - c.em > idadeMaxMs
    if (velho) carregar()
  }, [id, ativo, idadeMaxMs, carregar])

  const dados = estado.id === id ? estado.dados : null
  return { dados, em: estado.em, carregando: estado.carregando, erro: estado.erro, recarregar: carregar }
}

/** Janela móvel ao vivo (30 ou 60 dias). */
export function useAdesaoEscala(dias, opcoes) {
  return useConsultaAdesao(dias, () => buscarAdesao(dias), opcoes)
}

/** Um mês ('2026-09') a partir do histórico diário; null = não buscar. */
export function useAdesaoMes(mes, opcoes) {
  const id = mes ? `mes:${mes}` : null
  return useConsultaAdesao(id, () => {
    const { desde, ate } = limitesMes(mes)
    return buscarAdesaoPeriodo(id, desde, ate)
  }, opcoes)
}

/** Evolução semanal + meses disponíveis. */
export function useAdesaoEvolucao(opcoes) {
  return useConsultaAdesao('evolucao', buscarAdesaoEvolucao, opcoes)
}
