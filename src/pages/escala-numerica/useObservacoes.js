/**
 * Observações do dia na Escala Numérica (dono 08/10). Uma leitura por data, com os dois
 * turnos: trocar de turno não consulta de novo. Sem tempo real — relê ao trocar a data, no
 * botão de atualizar e depois de cada gravação (aí o autor vem do banco, não da tela).
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { listarObservacoes, salvarObservacao } from '@/services/escalaNumericaObservacaoService'

export const chaveObservacao = (turno, hospital) => `${turno}:${hospital}`

export function useObservacoes(dataISO) {
  // o estado guarda de QUAL data é a resposta — "carregando" é derivado disso
  const [resposta, setResposta] = useState(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let vivo = true
    listarObservacoes(dataISO)
      .then((lista) => { if (vivo) setResposta({ dataISO, lista, erro: null }) })
      .catch((e) => { if (vivo) setResposta((r) => ({ dataISO, lista: r?.dataISO === dataISO ? r.lista : [], erro: e?.message || 'falha' })) })
    return () => { vivo = false }
  }, [dataISO, versao])

  const pronto = resposta?.dataISO === dataISO
  const lista = pronto ? resposta.lista : null
  const porChave = useMemo(
    () => Object.fromEntries((lista || []).map((o) => [chaveObservacao(o.turno, o.hospital), o])),
    [lista]
  )

  const salvar = useCallback(async ({ turno, hospital, texto }, userInfo) => {
    const limpo = await salvarObservacao({ data: dataISO, turno, hospital, texto }, userInfo)
    // a tela já mostra o que foi gravado; a releitura traz o autor e a hora do servidor
    setResposta((r) => {
      if (r?.dataISO !== dataISO) return r
      const outras = r.lista.filter((o) => !(o.turno === turno && o.hospital === hospital))
      const nova = { turno, hospital, texto: limpo, autorNome: userInfo?.userName || null, atualizadoEm: new Date().toISOString() }
      return { ...r, lista: limpo ? [...outras, nova] : outras }
    })
    setVersao((v) => v + 1)
  }, [dataISO])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  return { porChave, carregando: !pronto, erro: pronto ? resposta.erro : null, salvar, recarregar }
}
