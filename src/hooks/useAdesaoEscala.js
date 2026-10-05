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
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buscarAdesao, buscarAdesaoPeriodo, buscarAdesaoEvolucao, buscarHorarioNaoPreenchido, lerCacheAdesao,
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

/**
 * Um mês ('2026-09') a partir do histórico diário; null = não buscar. `gravadoAte` (da evolução)
 * deixa o mês corrente ir até HOJE quando o dia já foi gravado à noite (dono 24/09).
 */
export function useAdesaoMes(mes, gravadoAte = null, opcoes) {
  const id = mes ? `mes:${mes}` : null
  // ref: `carregar` é memoizado pelo id — o valor mais recente precisa chegar mesmo assim
  // (o efeito abaixo roda antes do efeito de busca do useConsultaAdesao, declarado depois)
  const gravado = useRef(gravadoAte)
  useEffect(() => { gravado.current = gravadoAte }, [gravadoAte])
  return useConsultaAdesao(id, () => {
    const { desde, ate } = limitesMes(mes, new Date(), gravado.current)
    return buscarAdesaoPeriodo(id, desde, ate)
  }, opcoes)
}

/** Evolução semanal + meses disponíveis. */
export function useAdesaoEvolucao(opcoes) {
  return useConsultaAdesao('evolucao', buscarAdesaoEvolucao, opcoes)
}

/**
 * Horário não preenchido no dia (dono 05/10), na janela da ABA da página: '30' e '60' =
 * últimos N dias encerrados; 'AAAA-MM' = o mês inteiro (a função corta no último dia
 * encerrado e na tarde de 05/10, quando a contagem começou).
 */
export function useHorarioNaoPreenchido(aba, opcoes) {
  const id = aba ? `horario:${aba}` : null
  return useConsultaAdesao(id, () => {
    if (/^\d{4}-\d{2}$/.test(aba)) {
      const [a, m] = aba.split('-').map(Number)
      const ultimo = new Date(a, m, 0).getDate()
      return buscarHorarioNaoPreenchido(id, `${aba}-01`, `${aba}-${String(ultimo).padStart(2, '0')}`)
    }
    if (aba === '60') {
      const d = new Date()
      d.setDate(d.getDate() - 60)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return buscarHorarioNaoPreenchido(id, iso, null)
    }
    return buscarHorarioNaoPreenchido(id)
  }, opcoes)
}
