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
 *     hook devolve é o aviso NÃO confirmado por MIM, e não "o aviso do turno".
 *
 * ⚠️ Não notifica ninguém: a escala não manda mensagem desde 30/07 (as 6 fontes
 * foram removidas porque a inbox tinha 99 não lidas em 23 pessoas). O recado vive
 * na tela, em realtime, e morre na confirmação.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'

export default function useAvisoPlantonista({ escalaId, turno, userId, userName }) {
  const [avisos, setAvisos] = useState([])
  const [enviando, setEnviando] = useState(false)
  // a demo é client-side (id 'demo-*') e não tem linha no banco para referenciar
  const ativo = !!escalaId && !String(escalaId).startsWith('demo-') && !!turno
  const ref = useRef({ escalaId, turno })
  ref.current = { escalaId, turno }

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

  // O QUE APARECE: o mais recente que EU ainda não confirmei. Um de cada vez —
  // empilhar recados na frente da fila devolveria o problema que a inbox tinha.
  const aviso = useMemo(
    () => avisos.find((a) => !a.confirmadoPor.includes(userId)) || null,
    [avisos, userId]
  )

  const enviar = useCallback(async (texto) => {
    const limpo = String(texto || '').trim()
    const { escalaId: id, turno: t } = ref.current
    if (!limpo || !id || !t) return false
    setEnviando(true)
    try {
      await svc.criarAviso(id, t, limpo, { userName })
      await carregar()
      return true
    } catch { return false } finally { setEnviando(false) }
  }, [carregar, userName])

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

  return { aviso, enviar, confirmar, enviando, recarregar: carregar }
}
