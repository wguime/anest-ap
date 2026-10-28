/**
 * useMinhasPendenciasAnteriores — as cirurgias de DIAS ANTERIORES de quem está logado que
 * ainda estão sem horário (dono 27/10: "pendências que ficam na aba Minhas até serem
 * preenchidas, a partir de 27/10/2026").
 *
 * Por que um hook à parte: o context só carrega a escala do DIA da tela. Aqui a busca é por
 * pessoa e período (`fetchCasosDaPessoa`: login gravado no caso + as duplas "A + B", que não
 * têm login), e "em aberto" sai de `pendenciasDeDiasAnteriores` — a MESMA regra da faixa,
 * com o dia já virado. Gravar é pelo id do caso (`updateCaso` + o status), fora do context:
 * a escala daquele dia não está carregada; o item sai da lista na hora (otimista) e volta
 * com um aviso se a gravação falhar.
 *
 * Recarrega ao montar, quando o dia vira e quando o app volta do segundo plano.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/design-system/components/ui/toast'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { CORTE_PENDENCIAS_MINHAS, pendenciasDeDiasAnteriores } from '@/lib/escalaHorarioPendente'
import { anestesistaDoCasoEh } from './utils'

const VAZIO = []

export default function useMinhasPendenciasAnteriores({ eu, hoje }) {
  const { toast } = useToast()
  const [escalas, setEscalas] = useState(VAZIO)
  const [resolvidos, setResolvidos] = useState(() => new Set())
  // quantas gravações deram certo: o "Seu preenchimento" busca o número de novo a cada uma
  const [gravados, setGravados] = useState(0)
  const pedido = useRef(0)
  const uid = eu?.uid || null
  const ativo = !!uid && !!hoje && hoje > CORTE_PENDENCIAS_MINHAS

  const recarregar = useCallback(async () => {
    if (!ativo) return // sem login/dia: `itens` já sai vazio
    const n = ++pedido.current
    try {
      const lidas = await svc.fetchCasosDaPessoa({ uid, desde: CORTE_PENDENCIAS_MINHAS, ate: hoje })
      if (n === pedido.current) { setEscalas(lidas); setResolvidos(new Set()) }
    } catch {
      // sem a lista, a aba segue com as pendências de hoje — não derruba nada
    }
  }, [ativo, uid, hoje])

  useEffect(() => { recarregar() }, [recarregar])
  useEffect(() => {
    if (!ativo || typeof document === 'undefined') return undefined
    const aoVoltar = () => { if (document.visibilityState === 'visible') recarregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [ativo, recarregar])

  const itens = useMemo(() => {
    if (!ativo || !escalas.length) return VAZIO
    // a conta roda com os dois cards de cada par manhã × continuação (o do colega vem junto);
    // depois fica só o que é cobrado de quem está logado — as duplas vêm todas do período
    return pendenciasDeDiasAnteriores(escalas, { hoje })
      .filter((i) => anestesistaDoCasoEh(i.caso, eu) && !resolvidos.has(i.caso.id))
  }, [ativo, escalas, eu, hoje, resolvidos])

  const tirar = (id, sim) => setResolvidos((r) => {
    const n = new Set(r)
    if (sim) n.add(id); else n.delete(id)
    return n
  })

  /** Início e término de uma cirurgia de outro dia; a que ficou aberta passa a Terminada. */
  const informar = useCallback(async (item, { inicio, termino }) => {
    const { caso } = item
    tirar(caso.id, true)
    try {
      await svc.updateCaso(caso.id, { inicioReal: inicio, terminoReal: termino })
      if ((caso.statusCirurgia || 'agendada') !== 'terminada') await svc.updateStatusCirurgia(caso.id, 'terminada')
      setGravados((g) => g + 1)
      toast({ variant: 'success', title: 'Horário informado' })
    } catch (error) {
      tirar(caso.id, false)
      toast({ variant: 'error', title: 'Não foi possível gravar o horário', description: error.message })
    }
  }, [toast])

  /** A cirurgia que não aconteceu: Suspensa (sai da conta, como na folha Antes de liberar). */
  const naoAconteceu = useCallback(async (item) => {
    const { caso } = item
    tirar(caso.id, true)
    try {
      await svc.updateStatusCirurgia(caso.id, 'suspensa')
      setGravados((g) => g + 1)
    } catch (error) {
      tirar(caso.id, false)
      toast({ variant: 'error', title: 'Não foi possível marcar como suspensa', description: error.message })
    }
  }, [toast])

  return { itens, recarregar, informar, naoAconteceu, gravados }
}
