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
 * DESDE 28/10 (pop-up de horários, "abertura otimizada"): as escalas vêm de
 * `pendenciasAnteriores.js`, que o provider da escala já pede na ABERTURA DO APP e que
 * guarda a última resposta no aparelho. A lista aparece no primeiro render da página; a
 * página ainda revalida ao montar, quando o dia vira e quando o app volta do segundo plano.
 * `pronto` diz se a lista deste dia já está decidida — é o que o pop-up espera para abrir.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useToast } from '@/design-system/components/ui/toast'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { CORTE_PENDENCIAS_MINHAS, pendenciasDeDiasAnteriores } from '@/lib/escalaHorarioPendente'
import { anestesistaDoCasoEh } from './utils'
import { aplicarNoGuardado, assinarAnteriores, buscarAnteriores, retratoAnteriores } from './pendenciasAnteriores'

const VAZIO = []
const SEM_LISTA = { guardado: null, pronto: true }

export default function useMinhasPendenciasAnteriores({ eu, hoje }) {
  const { toast } = useToast()
  const uid = eu?.uid || null
  const ativo = !!uid && !!hoje && hoje > CORTE_PENDENCIAS_MINHAS
  // o que já se sabe, sem esperar a rede (memória desta sessão ou o aparelho), e se a lista
  // deste dia já está decidida — lidos do módulo, que avisa quando a resposta ou uma gravação chega
  const { guardado, pronto } = useSyncExternalStore(
    assinarAnteriores,
    () => (ativo ? retratoAnteriores(uid, hoje) : SEM_LISTA),
  )
  const [resolvidos, setResolvidos] = useState(() => new Set())
  // quantas gravações deram certo: o "Seu preenchimento" busca o número de novo a cada uma
  const [gravados, setGravados] = useState(0)

  // sem login/dia: `itens` já sai vazio. O que foi resolvido AQUI continua fora da lista mesmo
  // que uma resposta lida antes da gravação chegue depois dela (sem isto a cirurgia voltava por
  // um instante); se a gravação falhar, `tirar(id, false)` a devolve.
  const recarregar = useCallback(
    () => (ativo ? buscarAnteriores({ uid, hoje }) : Promise.resolve(null)),
    [ativo, uid, hoje],
  )

  useEffect(() => { recarregar() }, [recarregar])
  useEffect(() => {
    if (!ativo || typeof document === 'undefined') return undefined
    const aoVoltar = () => { if (document.visibilityState === 'visible') recarregar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [ativo, recarregar])

  const escalas = guardado?.escalas || VAZIO
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
      aplicarNoGuardado(uid, caso.id, { inicioReal: inicio, terminoReal: termino, statusCirurgia: 'terminada' })
      setGravados((g) => g + 1)
      toast({ variant: 'success', title: 'Horário informado' })
    } catch (error) {
      tirar(caso.id, false)
      toast({ variant: 'error', title: 'Não foi possível gravar o horário', description: error.message })
    }
  }, [toast, uid])

  /** A cirurgia que não aconteceu: Suspensa (sai da conta, como na folha Antes de liberar). */
  const naoAconteceu = useCallback(async (item) => {
    const { caso } = item
    tirar(caso.id, true)
    try {
      await svc.updateStatusCirurgia(caso.id, 'suspensa')
      aplicarNoGuardado(uid, caso.id, { statusCirurgia: 'suspensa' })
      setGravados((g) => g + 1)
    } catch (error) {
      tirar(caso.id, false)
      toast({ variant: 'error', title: 'Não foi possível marcar como suspensa', description: error.message })
    }
  }, [toast, uid])

  return { itens, recarregar, informar, naoAconteceu, gravados, pronto }
}
