/**
 * useAdesaoEscala — relatório de adesão de UMA janela (30 ou 60 dias), com cache SWR.
 *
 * `idadeMaxMs`:
 *   - 0 (página do relatório): mostra o cache na hora e SEMPRE busca de novo ("ao vivo").
 *   - IDADE_CARD_MS (card da Home): só busca se o cache passou da idade — a Home não pode virar
 *     uma chamada ao banco por abertura.
 * `ativo=false` adia a busca (ex.: Home antes do sinal do DeferredReadyContext).
 */
import { useCallback, useEffect, useState } from 'react'
import { buscarAdesao, lerCacheAdesao } from '@/services/escalaAdesaoService'

export function useAdesaoEscala(dias, { idadeMaxMs = 0, ativo = true } = {}) {
  const [estado, setEstado] = useState(() => {
    const c = lerCacheAdesao(dias)
    return { dias, dados: c?.dados ?? null, em: c?.em ?? null, carregando: false, erro: null }
  })

  const carregar = useCallback(async () => {
    setEstado((s) => ({ ...s, carregando: true, erro: null }))
    try {
      const dados = await buscarAdesao(dias)
      setEstado({ dias, dados, em: Date.now(), carregando: false, erro: null })
    } catch (e) {
      setEstado((s) => ({ ...s, carregando: false, erro: e?.message || 'Erro ao carregar' }))
    }
  }, [dias])

  useEffect(() => {
    if (!ativo) return
    const c = lerCacheAdesao(dias)
    // troca de janela: mostra o cache daquela janela antes de buscar
    if (c) setEstado((s) => (s.dias === dias ? s : { dias, dados: c.dados, em: c.em, carregando: false, erro: null }))
    const velho = !c || Date.now() - c.em > idadeMaxMs
    if (velho) carregar()
  }, [dias, ativo, idadeMaxMs, carregar])

  const dadosDaJanela = estado.dias === dias ? estado.dados : null
  return { dados: dadosDaJanela, em: estado.em, carregando: estado.carregando, erro: estado.erro, recarregar: carregar }
}
