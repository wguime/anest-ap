/**
 * useAvisoPlantonista — o recado que o plantonista deixa na aba Liberações
 * (dono 2026-08-17).
 *
 * Fica FORA do EscalaCirurgicaContext de propósito: o recado não é parte da
 * escala (não entra em publicação, não vira override, não toca `ordem_liberacao`)
 * e o context já carrega três hospitais por data — pendurar mais um estado lá
 * significaria refazer o loadData inteiro por causa de uma faixa de texto.
 *
 * Regras escolhidas pelo dono:
 *   • ENVIA: só o plantonista daquele hospital/turno — quem decide é a VIEW, que
 *     é quem sabe qual linha da fila está com o selo (`podeEnviar` é prop);
 *   • SOME: cada pessoa confirma e o aviso sai da tela DELA. Por isso o que este
 *     hook devolve são os avisos NÃO confirmados por MIM, e não "os do turno";
 *   • ATÉ 3 na tela (dono 17/08, 2ª rodada): o plantonista manda até três e, ao
 *     confirmar um deles, abre vaga para o próximo. O teto existe para a fila não
 *     virar mural — foi o excesso que fez as notificações serem removidas.
 *
 * ⚠️ Não entra na CAIXA DE ENTRADA: a escala não manda notificação in-app desde
 * 30/07 (as 6 fontes por evento foram removidas porque a inbox tinha 99 não lidas
 * em 23 pessoas) e isso não mudou — o recado vive na tela, em realtime, e morre
 * na confirmação.
 *
 * O que mudou em 24/08 (dono): ao ENVIAR, o recado também sai como PUSH para
 * quem tem acesso à escala, para chegar com o celular bloqueado. Não é volta do
 * que foi cortado em 30/07: aquilo era aviso automático POR EVENTO (escalado,
 * liberado, sala encerrou…); este é uma frase que uma pessoa escolheu escrever, é
 * raro por construção (teto de 3 na tela) e não deixa não-lida acumulada em lugar
 * nenhum. O push é best-effort e não altera o fluxo: se falhar, o recado está na
 * tela do mesmo jeito.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { enviarPushBestEffort } from '@/services/pushDispatchService'
import { destinatariosEscala } from './destinatariosPush'

/** Teto de recados na frente da fila (dono 17/08). */
export const MAX_AVISOS = 3

export default function useAvisoPlantonista({ escalaId, turno, userId, userName, hospitalLabel }) {
  const [avisos, setAvisos] = useState([])
  const [enviando, setEnviando] = useState(false)
  // a demo é client-side (id 'demo-*') e não tem linha no banco para referenciar
  const ativo = !!escalaId && !String(escalaId).startsWith('demo-') && !!turno
  const ref = useRef({ escalaId, turno, hospitalLabel })
  ref.current = { escalaId, turno, hospitalLabel }

  const carregar = useCallback(async () => {
    const { escalaId: id, turno: t } = ref.current
    if (!id || String(id).startsWith('demo-') || !t) { setAvisos([]); return }
    try {
      setAvisos(await svc.fetchAvisos(id, t))
    } catch { /* toast do service; a tela segue sem o recado */ }
  }, [])

  useEffect(() => { carregar() }, [carregar, escalaId, turno])

  // Realtime nas DUAS tabelas: o texto novo e o placar de confirmações precisam
  // chegar sem recarregar — é um recado de centro cirúrgico em andamento.
  useEffect(() => {
    if (!ativo) return undefined
    const subs = ['escala_cirurgica_aviso', 'escala_cirurgica_aviso_confirmacao'].map((table) =>
      createReliableSubscription({
        channelName: `${table}-changes`,
        table,
        callback: carregar,
        onRefetch: carregar,
      })
    )
    return () => subs.forEach((s) => s.cleanup())
  }, [ativo, carregar])

  // O QUE APARECE: os que EU ainda não confirmei, do mais recente para o mais
  // antigo, no máximo MAX_AVISOS.
  const visiveis = useMemo(
    () => avisos.filter((a) => !a.confirmadoPor.includes(userId)).slice(0, MAX_AVISOS),
    [avisos, userId]
  )
  // Enquanto houver vaga, o plantonista pode mandar outro: confirmar um dos três
  // é o que libera o lugar (pedido do dono).
  const podeEnviar = visiveis.length < MAX_AVISOS

  const enviar = useCallback(async (texto) => {
    const limpo = String(texto || '').trim()
    const { escalaId: id, turno: t, hospitalLabel: hosp } = ref.current
    if (!limpo || !id || !t) return false
    setEnviando(true)
    try {
      await svc.criarAviso(id, t, limpo, { userName })
      await carregar()
      // PUSH DEPOIS DO INSERT, nunca antes: quem anuncia é o servidor. Se a
      // gravação falhar, ninguém recebe aviso de um recado que não existe.
      // Fire-and-forget — a tela já mostrou o recado e não espera a rede.
      ;(async () => {
        const alvos = await destinatariosEscala(userId)
        enviarPushBestEffort({
          userIds: alvos,
          title: hosp ? `Recado do plantonista · ${hosp}` : 'Recado do plantonista',
          body: userName ? `${userName}: ${limpo}` : limpo,
          url: '/escala-cirurgica',
          // MESMA tag para todos os recados: dois seguidos SUBSTITUEM na bandeja
          // em vez de empilhar — o teto de 3 na tela existe pela mesma razão.
          tag: 'escala-recado',
          // 'high' é o que faz o iOS acordar o aparelho em vez de agrupar a
          // entrega para depois; é recado de centro cirúrgico em andamento.
          priority: 'high',
        })
      })()
      return true
    } catch { return false } finally { setEnviando(false) }
  }, [carregar, userName, userId])

  const confirmar = useCallback(async (avisoId) => {
    if (!avisoId || !userId) return
    // otimista: tirar da tela na hora é o ponto do botão — o realtime confirma
    setAvisos((prev) => prev.map((a) => (a.id === avisoId
      ? { ...a, confirmadoPor: [...a.confirmadoPor, userId] }
      : a)))
    try {
      await svc.confirmarAviso(avisoId, { userId, userName })
    } catch { carregar() /* falhou: volta ao que o banco diz */ }
  }, [carregar, userId, userName])

  const excluir = useCallback(async (avisoId) => {
    if (!avisoId) return
    setAvisos((prev) => prev.filter((a) => a.id !== avisoId)) // otimista
    try {
      await svc.excluirAviso(avisoId)
    } catch { carregar() /* falhou: volta ao que o banco diz */ }
  }, [carregar])

  // HISTÓRICO: todas as mensagens do turno, inclusive as que EU já confirmei
  // (dono 17/08) — quem chega no meio do turno precisa poder ler o que passou.
  return { avisos: visiveis, historico: avisos, podeEnviar, enviar, confirmar, excluir, enviando, recarregar: carregar }
}
