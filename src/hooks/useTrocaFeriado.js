/**
 * useTrocaFeriado — identidade, gate, assinatura e ações das trocas de feriado.
 *
 * Identidade em dois níveis, porque as duas coisas são necessárias e diferentes:
 *   - `numero` da legenda: é quem está NA FILA do feriado (o dataset não conhece uid);
 *   - `uid` do Firebase: é quem AGE e quem RECEBE a notificação.
 * O roster de anestesistas (`useRosterAnestesistas`) faz a ponte apelido → uid.
 *
 * Quem pode pedir: quem a legenda reconhece. Não há card de permissão novo — estar na
 * escala numérica já é a credencial, e o hub Gestão › Escalas já governa quem chega aqui.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useMessages } from '@/contexts/MessagesContext'
import useRosterAnestesistas from './useRosterAnestesistas'
import dadosNumerica from '@/data/escalaNumerica.json'
import { identificarNaLegenda } from '@/lib/trocasFeriado'
import {
  createTradeRequest, acceptTrade, rejectTrade, cancelTrade, subscribeTrocas,
} from '@/services/trocaFeriadoService'
import {
  buildFeriadoTrocaNotificationContent, getFeriadoTrocaNotificationRecipients, FERIADO_TROCA_NOTIF_META,
} from '@/utils/feriadoTrocaNotifications'

const VAZIO = { todas: [], aceitas: [], minhas: [], pendentesParaMim: [], erro: null }

export default function useTrocaFeriado() {
  const { user } = useUser()
  const { createSystemNotification } = useMessages()
  const { resolver, roster } = useRosterAnestesistas()

  const [estado, setEstado] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)

  /**
   * Quem eu sou na legenda. O roster é a primeira fonte porque ele É o dicionário de apelidos
   * da escala (`escala_anestesista_alias`): o apelido casa direto com a legenda, sem depender
   * da grafia do nome de login. O nome do cadastro fica de reserva para quem ainda não tem
   * apelido registrado.
   */
  const eu = useMemo(() => {
    const meu = roster.find((r) => r.uid === user?.uid)
    for (const apelido of meu?.apelidos || []) {
      const achado = identificarNaLegenda(dadosNumerica, apelido)
      if (achado) return achado
    }
    return identificarNaLegenda(dadosNumerica, meu?.nome || user?.nome || user?.displayName || '')
  }, [roster, user?.uid, user?.nome, user?.displayName])
  // ref para o listener não reassinar a cada render só porque o número mudou de identidade
  const numeroRef = useRef(eu?.numero || null)
  numeroRef.current = eu?.numero || null

  useEffect(() => {
    if (!user?.uid) { setEstado(VAZIO); return undefined }
    const cleanup = subscribeTrocas(user.uid, () => numeroRef.current, setEstado)
    return cleanup
  }, [user?.uid])

  /** Nome da legenda → uid do Firebase, pelo dicionário de apelidos da escala. */
  const uidDaLegenda = useCallback((nomeLegenda) => (nomeLegenda ? resolver(nomeLegenda) : null), [resolver])
  const nomeCompletoDoUid = useCallback(
    (uid) => roster.find((r) => r.uid === uid)?.nome || null,
    [roster]
  )

  const notificar = useCallback(async (event, trade) => {
    const destinatarios = getFeriadoTrocaNotificationRecipients(event, trade)
    if (!destinatarios.length) return
    const { subject, content } = buildFeriadoTrocaNotificationContent(event, trade, { actorNome: user?.nome })
    try {
      await createSystemNotification({
        category: FERIADO_TROCA_NOTIF_META.CATEGORY,
        priority: FERIADO_TROCA_NOTIF_META.PRIORITY,
        actionUrl: FERIADO_TROCA_NOTIF_META.ACTION_URL,
        actionLabel: FERIADO_TROCA_NOTIF_META.ACTION_LABEL,
        subject,
        content,
        recipientIds: destinatarios,
      })
    } catch (e) {
      // a troca já está gravada: falhar o aviso não pode desfazer o fato
      console.warn('[trocaFeriado] notificação falhou:', e?.message)
    }
  }, [createSystemNotification, user?.nome])

  const pedir = useCallback(async ({ escopo, feriadoData, feriadoDesejado, destinatarioNumero, destinatarioNome, descricao }) => {
    setSalvando(true)
    try {
      const { trade, error } = await createTradeRequest({
        solicitanteUid: user?.uid,
        solicitanteNome: eu?.nome,
        solicitanteNumero: eu?.numero,
        destinatarioUid: uidDaLegenda(destinatarioNome),
        destinatarioNome,
        destinatarioNumero,
        escopo,
        feriadoData,
        feriadoDesejado,
        descricao,
      })
      if (trade) await notificar('created', trade)
      return { trade, error }
    } finally {
      setSalvando(false)
    }
  }, [user?.uid, eu, uidDaLegenda, notificar])

  const responder = useCallback(async (codigo, aceitar) => {
    setSalvando(true)
    try {
      const acao = aceitar ? acceptTrade : rejectTrade
      const r = await acao(codigo, { uid: user?.uid, nome: eu?.nome || user?.nome, numero: eu?.numero })
      if (r.success) await notificar(aceitar ? 'accepted' : 'rejected', r.trade)
      return r
    } finally {
      setSalvando(false)
    }
  }, [user?.uid, user?.nome, eu, notificar])

  const cancelar = useCallback(async (codigo) => {
    setSalvando(true)
    try {
      const r = await cancelTrade(codigo, user?.uid)
      if (r.success) await notificar('cancelled', r.trade)
      return r
    } finally {
      setSalvando(false)
    }
  }, [user?.uid, notificar])

  return {
    eu,
    podePedir: Boolean(eu && user?.uid),
    ...estado,
    salvando,
    pedir,
    responder,
    cancelar,
    uidDaLegenda,
    nomeCompletoDoUid,
  }
}
