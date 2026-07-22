/* eslint-disable react-refresh/only-export-components */
/**
 * EscalaCirurgicaContext — escala cirúrgica do dia (3 hospitais) em tempo real.
 *
 * Split State/Actions (mesmo padrão de ComunicadosContext):
 *   - State  → escalas por hospital, data selecionada, loading (re-render on data)
 *   - Actions → callbacks memoizados (identidade estável)
 *
 * Realtime: subscreve as duas tabelas e recarrega a data corrente em qualquer
 * mudança (board ao vivo: importação, edição, liberação refletem para todos).
 */
import { createContext, useContext, useReducer, useMemo, useCallback, useEffect, useState, useRef } from 'react'
import svc from '@/services/supabaseEscalaCirurgicaService'
import trocasSvc from '@/services/supabaseTrocasCirurgicasService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { useToast } from '@/design-system/components/ui/toast'
import { resolverAnestesistas } from '@/lib/colunaLiberacao'
import { familiaConvenio } from '@/pages/escala-cirurgica/utils'
import { notifyUsers } from '@/services/notificationService'
import { getDemoEscala } from '@/data/escalaCirurgicaDemo'

export const HOSPITAIS = ['unimed', 'hro', 'materno']
export const HOSPITAL_LABEL = { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' }

const normNome = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^\s*ped\s+/i, '').trim().toUpperCase()
const formatData = (iso) => {
  const [a, m, d] = String(iso || '').split('-')
  return d ? `${d}/${m}/${a}` : iso
}

/** Notifica cada anestesista (login) sobre os casos em que foi escalado. Por uid (robusto). */
async function notificarEscalados(escala) {
  const casos = resolverAnestesistas(escala?.casos || [])
  const porUid = {}
  for (const c of casos) {
    if (c.semAnestesista || !c.anestesistaUserId) continue
    porUid[c.anestesistaUserId] = (porUid[c.anestesistaUserId] || 0) + 1
  }
  if (!Object.keys(porUid).length) return
  // allSettled: uma falha de rede num login não impede os demais de serem notificados.
  const results = await Promise.allSettled(Object.entries(porUid).map(([uid, n]) =>
    notifyUsers([uid], {
      category: 'escala',
      subject: 'Você foi escalado',
      content: `${n} caso(s) no ${HOSPITAL_LABEL[escala.hospital]} em ${formatData(escala.data)}.`,
      senderName: 'Escala Cirúrgica',
      priority: 'normal',
      actionUrl: 'escalaCirurgica',
      relatedEntityType: 'escala_cirurgica',
      relatedEntityId: `${escala.id}-escalado-${uid}`,
    })
  ))
  const falhas = results.filter((r) => r.status === 'rejected').length
  if (falhas) console.warn('[EscalaCirurgica] notificarEscalados: %d falha(s)', falhas)
}

/** Data local YYYY-MM-DD (sem fuso UTC). */
export function hojeISO(d = new Date()) {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

const EscalaStateContext = createContext(null)
const EscalaActionsContext = createContext(null)

const initialState = { escalas: { unimed: null, hro: null, materno: null }, trocasPendentes: [], trocasAceitas: [] }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ALL':
      return { ...state, escalas: action.payload }
    case 'SET_HOSPITAL':
      return { ...state, escalas: { ...state.escalas, [action.hospital]: action.payload } }
    case 'SET_TROCAS':
      return { ...state, trocasPendentes: action.payload }
    case 'SET_TROCAS_ACEITAS':
      return { ...state, trocasAceitas: action.payload }
    default:
      return state
  }
}

export function EscalaCirurgicaProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [data, setData] = useState(() => hojeISO())
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // evita stale closure no onRefetch da subscription
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  const loadData = useCallback(async (dia) => {
    setLoading(true)
    try {
      const results = await Promise.all(HOSPITAIS.map((h) => svc.fetchEscala(dia, h).catch(() => null)))
      const escalas = {}
      // Sem escala no banco para a data de demonstração → carrega fixture (teste de UI).
      HOSPITAIS.forEach((h, i) => { escalas[h] = results[i] || getDemoEscala(dia, h) })
      dispatch({ type: 'SET_ALL', payload: escalas })
      // trocas pendentes das escalas reais (demo-* não têm troca)
      const ids = Object.values(escalas).filter((e) => e && !String(e.id).startsWith('demo-')).map((e) => e.id)
      try {
        const [pendentes, aceitas] = ids.length
          ? await Promise.all([trocasSvc.fetchTrocasPendentes(ids), trocasSvc.fetchTrocasAceitas(ids)])
          : [[], []]
        dispatch({ type: 'SET_TROCAS', payload: pendentes })
        // aplicadas do dia → aviso visível na aba Minhas (trocas diretas desde 22/07)
        dispatch({ type: 'SET_TROCAS_ACEITAS', payload: aceitas })
      } catch { /* RLS/cold start */ }
    } catch (err) {
      console.error('[EscalaCirurgicaContext] load falhou:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Recarrega quando a data muda (sem recriar subscriptions).
  useEffect(() => { loadData(data) }, [data, loadData])

  // Subscriptions realtime — montadas uma única vez (loadData é estável). Separadas
  // da troca de data p/ não abrir janela de eventos perdidos ao reconectar canais.
  useEffect(() => {
    const subs = ['escala_cirurgica', 'escala_cirurgica_caso', 'trocas_cirurgicas'].map((table) =>
      createReliableSubscription({
        channelName: `${table}-changes`,
        table,
        callback: () => loadData(dataRef.current),
        onRefetch: () => loadData(dataRef.current),
      })
    )
    return () => subs.forEach((s) => s.cleanup())
  }, [loadData])

  // ── Actions ──────────────────────────────────────────────────────────────
  const salvarEscala = useCallback(async (payload, userInfo) => {
    try {
      const saved = await svc.salvarEscala(payload, userInfo)
      dispatch({ type: 'SET_HOSPITAL', hospital: payload.hospital, payload: saved })
      if (saved?.status === 'publicada') {
        notificarEscalados(saved)
        // Auto-import de cobrança (trigger no banco): avisa quantos particulares
        // viraram rascunho em Cirurgias Particulares nesta publicação.
        const particulares = (saved.casos || []).filter(
          (c) => familiaConvenio(c.convenio) === 'particular' && c.statusExtra !== 'suspensa'
        ).length
        if (particulares > 0) {
          toast({
            variant: 'info',
            title: `${particulares} caso${particulares > 1 ? 's' : ''} particular${particulares > 1 ? 'es' : ''} → cobrança`,
            description: 'Rascunho criado em Cirurgias Particulares (Menu). Complete nome e valor.',
          })
        }
      }
      return saved
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao salvar escala', description: error.message })
      throw error
    }
  }, [toast])

  const reordenarLiberacao = useCallback(async (escala, novaOrdem) => {
    try {
      const isDemo = String(escala.id).startsWith('demo-')
      if (!isDemo) await svc.updateOrdemLiberacao(escala.id, novaOrdem)
      dispatch({ type: 'SET_HOSPITAL', hospital: escala.hospital, payload: { ...escala, ordemLiberacao: novaOrdem } })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao reordenar', description: error.message })
      throw error
    }
  }, [toast])

  // linha = { chave, anestesista, uid, nomeOriginal } vinda da coluna (aceita string
  // legada). Marcações são gravadas pela CHAVE ESTÁVEL (uid do vínculo ou nome
  // normalizado): o nome EXIBIDO muda com vínculos/diferenciação e órfã as marcações —
  // bug real de 2026-07-22 ("liberados desliberaram" após uma troca). A chave legada
  // (nome exibido) é limpa junto para não ressuscitar como fantasma.
  const linhaDe = (l) => (typeof l === 'string' ? { chave: l, anestesista: l, uid: null } : l)

  const toggleLiberacao = useCallback(async (escala, linhaArg, userInfo = {}) => {
    const linha = linhaDe(linhaArg)
    const chave = linha.chave || linha.anestesista
    const legada = linha.anestesista && linha.anestesista !== chave ? linha.anestesista : null
    try {
      const atual = escala.liberacoes || {}
      const jaLiberado = !!(atual[chave] ?? (legada ? atual[legada] : undefined))
      const valor = jaLiberado ? null : { liberadoEm: new Date().toISOString(), por: userInfo.userId || null }
      const liberacoes = { ...atual }
      if (jaLiberado) { delete liberacoes[chave]; if (legada) delete liberacoes[legada] }
      else liberacoes[chave] = valor
      const isDemo = String(escala.id).startsWith('demo-')
      // merge por chave no servidor — marcações simultâneas de 2 plantonistas não se apagam
      if (!isDemo) {
        await svc.patchLiberacao(escala.id, chave, valor)
        if (legada && atual[legada] !== undefined) await svc.patchLiberacao(escala.id, legada, null)
      }
      // Voltou a ser escalado (liberação desfeita)? A situação é NOVA — marca a linha
      // como RENOVADA: apaga ajustes antigos E suprime o derivado dos casos da manhã
      // (sala/cirurgião/tempo vêm em branco p/ preencher do zero).
      const linhaOverrides = { ...(escala.linhaOverrides || {}) }
      if (jaLiberado) {
        const marcador = { renovado: true, por: userInfo.userId || null, em: new Date().toISOString() }
        linhaOverrides[chave] = marcador
        if (legada) delete linhaOverrides[legada]
        if (!isDemo) {
          await svc.patchLinhaOverride(escala.id, chave, marcador)
          if (legada) await svc.patchLinhaOverride(escala.id, legada, null)
        }
      }
      dispatch({ type: 'SET_HOSPITAL', hospital: escala.hospital, payload: { ...escala, liberacoes, linhaOverrides } })
      // Notifica o anestesista (login) quando é marcado como liberado.
      const uid = linha.uid
        || (escala.casos || []).find((c) => normNome(c.anestesista) === normNome(linha.anestesista))?.anestesistaUserId
      if (uid && !jaLiberado) {
        notifyUsers([uid], {
          category: 'escala',
          subject: 'Você foi liberado',
          content: `Liberado no ${HOSPITAL_LABEL[escala.hospital]} em ${formatData(escala.data)}.`,
          senderName: 'Escala Cirúrgica',
          priority: 'normal',
          actionUrl: 'escalaCirurgica',
          relatedEntityType: 'escala_cirurgica',
          relatedEntityId: `${escala.id}-liberado-${uid}-${Date.now()}`,
        }).catch(() => {})
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao liberar', description: error.message })
      throw error
    }
  }, [toast])

  // "Não escalado" é reversível: quem entra na escala no meio do dia é marcado
  // como ESCALADO ({ escalado: true } no mapa de liberações — o card volta a verde);
  // desmarcar remove a chave (volta ao vermelho automático).
  const toggleEscalado = useCallback(async (escala, linhaArg, userInfo = {}) => {
    const linha = linhaDe(linhaArg)
    const chave = linha.chave || linha.anestesista
    const legada = linha.anestesista && linha.anestesista !== chave ? linha.anestesista : null
    try {
      const atual = escala.liberacoes || {}
      const jaForcado = (atual[chave] ?? (legada ? atual[legada] : undefined))?.escalado === true
      const valor = jaForcado ? null : { escalado: true, por: userInfo.userId || null, em: new Date().toISOString() }
      const liberacoes = { ...atual }
      if (jaForcado) { delete liberacoes[chave]; if (legada) delete liberacoes[legada] }
      else liberacoes[chave] = valor
      const isDemo = String(escala.id).startsWith('demo-')
      if (!isDemo) {
        await svc.patchLiberacao(escala.id, chave, valor)
        if (legada && atual[legada] !== undefined) await svc.patchLiberacao(escala.id, legada, null)
      }
      // Entrou na escala agora (não-escalado → escalado): ajustes antigos da linha
      // são de antes — limpa p/ preencher do zero (sala/local, cirurgião, tempo faltante).
      const linhaOverrides = { ...(escala.linhaOverrides || {}) }
      for (const k of [chave, legada].filter(Boolean)) {
        if (!jaForcado && linhaOverrides[k]) {
          delete linhaOverrides[k]
          if (!isDemo) await svc.patchLinhaOverride(escala.id, k, null)
        }
      }
      dispatch({ type: 'SET_HOSPITAL', hospital: escala.hospital, payload: { ...escala, liberacoes, linhaOverrides } })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao marcar escalado', description: error.message })
      throw error
    }
  }, [toast])

  // Plantonista ajusta a LINHA de um anestesista na coluna (local e/ou cirurgião),
  // conforme o plantão evolui. Override estruturado { local?, cirurgioes? } por chave;
  // override = null limpa (volta ao derivado dos casos).
  const setLinhaOverride = useCallback(async (escala, linhaArg, override, userInfo = {}) => {
    const linha = linhaDe(linhaArg)
    const chave = linha.chave || linha.anestesista
    const legada = linha.anestesista && linha.anestesista !== chave ? linha.anestesista : null
    try {
      const local = String(override?.local || '').trim()
      const cirurgioes = String(override?.cirurgioes || '').trim()
      const termino = String(override?.termino || '').trim() // "HH:MM" — cronômetro manual
      // linha renovada (voltou de liberação): o flag persiste nos ajustes seguintes —
      // preencher só o tempo não pode ressuscitar sala/cirurgião da manhã.
      // "Restaurar automático" (override null) limpa o flag e volta ao derivado.
      const renovado = !!(escala.linhaOverrides?.[chave]?.renovado || (legada && escala.linhaOverrides?.[legada]?.renovado))
      const valor = (local || cirurgioes || termino)
        ? { ...(local && { local }), ...(cirurgioes && { cirurgioes }), ...(termino && { termino }), ...(renovado && { renovado: true }), por: userInfo.userId || null, em: new Date().toISOString() }
        : null
      const linhaOverrides = { ...(escala.linhaOverrides || {}) }
      if (valor) linhaOverrides[chave] = valor
      else delete linhaOverrides[chave]
      if (legada) delete linhaOverrides[legada]
      const isDemo = String(escala.id).startsWith('demo-')
      if (!isDemo) {
        await svc.patchLinhaOverride(escala.id, chave, valor)
        if (legada && escala.linhaOverrides?.[legada] !== undefined) await svc.patchLinhaOverride(escala.id, legada, null)
      }
      dispatch({ type: 'SET_HOSPITAL', hospital: escala.hospital, payload: { ...escala, linhaOverrides } })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao ajustar linha', description: error.message })
      throw error
    }
  }, [toast])

  // Compat com a UI atual (edita só o local); o editor da F1 usa setLinhaOverride direto.
  const setLocalAnestesista = useCallback(
    (escala, anestesista, texto, userInfo = {}) =>
      setLinhaOverride(escala, anestesista, texto ? { local: texto } : null, userInfo),
    [setLinhaOverride]
  )

  // Status da cirurgia em DOIS eixos — principal (agendada/iniciada/terminada, exclusivo)
  // e extra (atrasada/suspensa/passa_tarde, toggle; terminada limpa e bloqueia).
  // Espelha a regra da RPC no update otimista. Qualquer clínico atualiza.
  // Quando a ÚLTIMA cirurgia da sala conclui (terminada ou suspensa), o plantonista é avisado.
  const setStatusCirurgia = useCallback(async (escala, caso, status) => {
    const EXTRAS = ['atrasada', 'suspensa', 'passa_tarde']
    const isDemo = String(escala.id).startsWith('demo-')
    const aplicar = (c) => EXTRAS.includes(status)
      ? { ...c, statusExtra: c.statusExtra === status ? null : status }
      : { ...c, statusCirurgia: status, ...(status === 'terminada' && { statusExtra: null }) }
    const casos = (escala.casos || []).map((c) =>
      (caso.id ? c.id === caso.id : c === caso) ? aplicar(c) : c
    )
    // OTIMISTA: pinta a UI já (a demora do RPC deixava o botão "morto" — reclamação
    // do dono em produção); erro reverte pro estado anterior + toast no catch.
    dispatch({ type: 'SET_HOSPITAL', hospital: escala.hospital, payload: { ...escala, casos } })
    try {
      if (!isDemo && caso.id) await svc.updateStatusCirurgia(caso.id, status)

      // concluída = terminada (principal) OU suspensa (extra) — fecha a sala p/ notificação
      const concluido = (c) => (c.statusCirurgia || 'agendada') === 'terminada' || c.statusExtra === 'suspensa'
      if ((status === 'terminada' || status === 'suspensa') && caso.sala) {
        const daSala = casos.filter((c) => c.sala === caso.sala)
        const encerrouSala = daSala.length > 0 && daSala.every(concluido)
        const plantonista = (escala.ordemLiberacao || [])[0]
        const uid = plantonista
          ? casos.find((c) => c.anestesistaUserId && normNome(c.anestesista) === normNome(plantonista))?.anestesistaUserId
          : null
        if (encerrouSala && uid) {
          notifyUsers([uid], {
            category: 'escala',
            subject: `${caso.sala} encerrou`,
            content: `Último caso da ${caso.sala} terminado no ${HOSPITAL_LABEL[escala.hospital]}.`,
            senderName: 'Escala Cirúrgica', priority: 'alta', actionUrl: 'escalaCirurgica',
            relatedEntityType: 'escala_cirurgica',
            relatedEntityId: `${escala.id}-sala-${caso.sala}-encerrada`,
          }).catch(() => {})
        }
      }
    } catch (error) {
      // reverte o otimista (o servidor recusou — ex.: extra em caso terminada)
      dispatch({ type: 'SET_HOSPITAL', hospital: escala.hospital, payload: escala })
      toast({ variant: 'error', title: 'Erro ao atualizar status', description: error.message })
      throw error
    }
  }, [toast])

  // Acrescenta um procedimento à escala do dia (urgência/encaixe/fora do mapa).
  // Integra como os demais: board re-agrupa e a coluna de liberação re-deriva.
  const adicionarCaso = useCallback(async (escala, caso) => {
    if (String(escala.id).startsWith('demo-')) {
      toast({ variant: 'warning', title: 'Indisponível na demonstração' })
      return null
    }
    try {
      const novo = await svc.addCaso(escala.id, caso)
      dispatch({ type: 'SET_HOSPITAL', hospital: escala.hospital, payload: { ...escala, casos: [...(escala.casos || []), novo] } })
      if (novo.anestesistaUserId) {
        notifyUsers([novo.anestesistaUserId], {
          category: 'escala',
          subject: 'Novo caso na sua sala',
          content: `${novo.sala || 'Sala'}${novo.hora ? ` às ${novo.hora}` : ''} — ${novo.procedimento || 'procedimento'} (${HOSPITAL_LABEL[escala.hospital]}).`,
          senderName: 'Escala Cirúrgica', priority: 'alta', actionUrl: 'escalaCirurgica',
          relatedEntityType: 'escala_cirurgica', relatedEntityId: `${escala.id}-caso-${novo.id}`,
        }).catch(() => {})
      }
      toast({ variant: 'success', title: 'Caso adicionado', description: `${novo.sala || ''} ${novo.hora || ''}`.trim() })
      return novo
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao adicionar caso', description: error.message })
      throw error
    }
  }, [toast])

  // ── Troca de sala entre anestesistas ───────────────────────────────────────
  const propoTroca = useCallback(async (escala, payload, userInfo = {}) => {
    if (String(escala.id).startsWith('demo-')) { toast({ variant: 'warning', title: 'Indisponível na demonstração' }); return }
    try {
      const troca = await trocasSvc.propoTroca({ escalaId: escala.id, solicitadoPor: userInfo.userId, ...payload })
      notifyUsers([payload.uidB], {
        category: 'escala', subject: 'Solicitação de troca de sala',
        content: `${payload.aliasA} propõe trocar: você iria para a ${payload.salaA}. Código: ${troca.codigo}`,
        senderName: 'Escala Cirúrgica', priority: 'alta', actionUrl: 'escalaCirurgica',
        relatedEntityType: 'troca_cirurgica', relatedEntityId: troca.id,
      }).catch(() => {})
      return troca
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao propor troca', description: error.message }); throw error
    }
  }, [toast])

  // Troca DIRETA (decisão do dono 2026-07-22): sem etapa de aceite — cria e aplica
  // na sequência (a RPC autoriza o solicitante desde 20260722210000). Os DOIS
  // envolvidos recebem notificação; a aba Minhas mostra o aviso da troca aplicada.
  const trocarSala = useCallback(async (escala, payload, userInfo = {}) => {
    if (String(escala.id).startsWith('demo-')) { toast({ variant: 'warning', title: 'Indisponível na demonstração' }); return }
    try {
      const troca = await trocasSvc.propoTroca({ escalaId: escala.id, solicitadoPor: userInfo.userId, ...payload })
      await trocasSvc.aceitarTroca(troca.id) // ator = firebase_uid() no servidor
      Promise.allSettled([
        notifyUsers([payload.uidA], { category: 'escala', subject: 'Troca de sala aplicada', content: `Você agora cobre a ${payload.salaB} (troca com ${payload.aliasB}). Código: ${troca.codigo || '—'}`, senderName: 'Escala Cirúrgica', priority: 'alta', actionUrl: 'escalaCirurgica', relatedEntityType: 'troca_cirurgica', relatedEntityId: `${troca.id}-a` }),
        notifyUsers([payload.uidB], { category: 'escala', subject: 'Troca de sala aplicada', content: `${payload.aliasA} aplicou uma troca: você agora cobre a ${payload.salaA}. Código: ${troca.codigo || '—'}`, senderName: 'Escala Cirúrgica', priority: 'alta', actionUrl: 'escalaCirurgica', relatedEntityType: 'troca_cirurgica', relatedEntityId: `${troca.id}-b` }),
      ])
      dispatch({ type: 'SET_TROCAS_ACEITAS', payload: [{ ...troca, status: 'aceita' }, ...(state.trocasAceitas || [])] })
      return troca
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao trocar sala', description: error.message }); throw error
    }
  }, [toast, state.trocasAceitas])

  const aceitarTroca = useCallback(async (troca) => {
    try {
      await trocasSvc.aceitarTroca(troca.id) // ator = firebase_uid() no servidor
      Promise.allSettled([
        notifyUsers([troca.uidA], { category: 'escala', subject: 'Troca de sala confirmada', content: `Você passa a cobrir a ${troca.salaB}. Código: ${troca.codigo || '—'}`, senderName: 'Escala Cirúrgica', priority: 'alta', actionUrl: 'escalaCirurgica', relatedEntityType: 'troca_cirurgica', relatedEntityId: `${troca.id}-a` }),
        notifyUsers([troca.uidB], { category: 'escala', subject: 'Troca de sala confirmada', content: `Você passa a cobrir a ${troca.salaA}. Código: ${troca.codigo || '—'}`, senderName: 'Escala Cirúrgica', priority: 'alta', actionUrl: 'escalaCirurgica', relatedEntityType: 'troca_cirurgica', relatedEntityId: `${troca.id}-b` }),
      ])
      // realtime dos casos recarrega o board + re-deriva a liberação
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao aceitar troca', description: error.message }); throw error
    }
  }, [toast])

  const recusarTroca = useCallback(async (troca, userInfo = {}) => {
    try {
      await trocasSvc.recusarTroca(troca.id, userInfo.userId)
      notifyUsers([troca.uidA], { category: 'escala', subject: 'Troca recusada', content: `Sua troca com a ${troca.salaB} foi recusada (${troca.codigo || 'sem código'}). Você pode propor outra.`, senderName: 'Escala Cirúrgica', priority: 'normal', actionUrl: 'escalaCirurgica', relatedEntityType: 'troca_cirurgica', relatedEntityId: `${troca.id}-rec` }).catch(() => {})
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao recusar troca', description: error.message }); throw error
    }
  }, [toast])

  const cancelarTroca = useCallback(async (troca, userInfo = {}) => {
    try {
      await trocasSvc.cancelarTroca(troca.id, userInfo.userId)
      // padrão das trocas de plantão: proposta direcionada cancelada avisa o alvo
      notifyUsers([troca.uidB], {
        category: 'escala', subject: 'Troca de sala cancelada',
        content: `${troca.aliasA} cancelou a solicitação de troca (${troca.codigo || 'sem código'}).`,
        senderName: 'Escala Cirúrgica', priority: 'normal', actionUrl: 'escalaCirurgica',
        relatedEntityType: 'troca_cirurgica', relatedEntityId: `${troca.id}-cancel`,
      }).catch(() => {})
    }
    catch (error) { toast({ variant: 'error', title: 'Erro ao cancelar troca', description: error.message }); throw error }
  }, [toast])

  const refresh = useCallback(() => loadData(dataRef.current), [loadData])

  const actionsValue = useMemo(() => ({
    setData, salvarEscala, reordenarLiberacao, toggleLiberacao, toggleEscalado, setLinhaOverride, setLocalAnestesista,
    setStatusCirurgia, adicionarCaso,
    propoTroca, aceitarTroca, recusarTroca, cancelarTroca, trocarSala, refresh,
  }), [salvarEscala, reordenarLiberacao, toggleLiberacao, toggleEscalado, setLinhaOverride, setLocalAnestesista, setStatusCirurgia, adicionarCaso, propoTroca, aceitarTroca, recusarTroca, cancelarTroca, trocarSala, refresh])

  const stateValue = useMemo(() => ({
    escalas: state.escalas, trocasPendentes: state.trocasPendentes, trocasAceitas: state.trocasAceitas, data, loading,
  }), [state.escalas, state.trocasPendentes, state.trocasAceitas, data, loading])

  return (
    <EscalaActionsContext.Provider value={actionsValue}>
      <EscalaStateContext.Provider value={stateValue}>
        {children}
      </EscalaStateContext.Provider>
    </EscalaActionsContext.Provider>
  )
}

const STATE_FALLBACK = { escalas: { unimed: null, hro: null, materno: null }, trocasPendentes: [], trocasAceitas: [], data: hojeISO(), loading: true }
const ACTIONS_FALLBACK = {
  setData: () => {}, salvarEscala: async () => {}, reordenarLiberacao: async () => {},
  toggleLiberacao: async () => {}, setLocalAnestesista: async () => {},
  propoTroca: async () => {}, aceitarTroca: async () => {}, recusarTroca: async () => {}, cancelarTroca: async () => {}, trocarSala: async () => {},
  refresh: async () => {},
}

export function useEscalaCirurgicaActions() {
  return useContext(EscalaActionsContext) ?? ACTIONS_FALLBACK
}

export function useEscalaCirurgica() {
  const s = useContext(EscalaStateContext)
  const a = useContext(EscalaActionsContext)
  return { ...(s ?? STATE_FALLBACK), ...(a ?? ACTIONS_FALLBACK) }
}
