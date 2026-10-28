/**
 * useHorarioPendente — as cirurgias de HOJE sem início/término que já entraram no
 * alerta público (dono 05/10; regras em `src/lib/escalaHorarioPendente.js`).
 *
 * Lê as escalas carregadas no context (os três hospitais da data da tela) e só vale
 * quando a tela está em HOJE: o alerta dura o dia operacional; o que não foi
 * preenchido até a virada das 7h vai para o relatório de adesão.
 *
 * "Liberado" é lido de `escala.liberacoes` como a fila lê (`LiberacoesView.marcaDe`):
 * chave escopada pelo turno e a legada sem escopo, pelo uid e pelo nome normalizado; o
 * marcador `{ escalado: true }` do repasse NÃO é liberação. No fim de semana a fila é a
 * linha 'fds', então ela também é consultada.
 */
import { useCallback, useMemo } from 'react'
import { useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { agruparPorAnestesista, contaDoDia, pendenciasDoDia } from '@/lib/escalaHorarioPendente'
import useAgoraMinutoEscala from './useAgoraMinutoEscala'
import { nomeAnestesistaExibicao, normNome } from './utils'

const SEM_PENDENCIA = { itens: [], grupos: [], porCaso: new Map(), conta: [] }

export function liberadoEm(liberacoes, turno, chaves) {
  for (const k of chaves) {
    if (!k) continue
    const v = liberacoes?.[`${turno}:${k}`] ?? liberacoes?.[k]
    if (v && v.escalado !== true) return true
  }
  return false
}

export default function useHorarioPendente() {
  const { escalas, data, hoje } = useEscalaCirurgica()
  const agoraMin = useAgoraMinutoEscala()
  const { resolver, rosterByUid } = useRosterAnestesistas()
  const ativo = !!hoje && data === hoje

  const uidDe = useCallback((parte) => parte.uid || resolver(parte.alias) || null, [resolver])

  // `conta` = as cirurgias de hoje que já deviam ter horário, completas ou no aviso: a parte de
  // hoje do "Seu preenchimento" (dono 28/10), com as mesmas pendências
  const { itens, conta } = useMemo(() => {
    if (!ativo) return SEM_PENDENCIA
    const fds = escalas?.fds
    const liberado = (escala, turno, parte) => {
      const chaves = [uidDe(parte), normNome(parte.alias)]
      return liberadoEm(escala.liberacoes, turno, chaves)
        || (!!fds && fds.data === escala.data && liberadoEm(fds.liberacoes, turno, chaves))
    }
    const lista = ['unimed', 'hro', 'materno'].map((h) => escalas?.[h]).filter(Boolean)
    const pendencias = pendenciasDoDia(lista, { hoje, agoraMin, liberado })
    return { itens: pendencias, conta: contaDoDia(lista, { hoje, pendencias }) }
  }, [ativo, escalas, hoje, agoraMin, uidDe])

  return useMemo(() => {
    if (!itens.length) return conta.length ? { ...SEM_PENDENCIA, conta } : SEM_PENDENCIA
    const grupos = agruparPorAnestesista(itens, {
      chaveDe: (p) => uidDe(p) || normNome(p.alias),
      nomeDe: (p) => nomeAnestesistaExibicao({ uid: uidDe(p), alias: p.alias, rosterByUid }),
    })
    const porCaso = new Map(itens.filter((i) => i.caso.id).map((i) => [i.caso.id, i]))
    return { itens, grupos, porCaso, conta }
  }, [itens, conta, uidDe, rosterByUid])
}
