/**
 * Recados do lote (dono 09/10/2026): o que foi colado (texto ou print), o plano de
 * marcações e o que já foi aplicado/desfeito.
 *
 * "Quero que entrem aplicadas": toda ação CLARA do plano é aplicada sozinha, uma vez só —
 * a chave da ação (mensagem · tipo · hospital · pessoa) fica em `aplicadas`, e desfazer a
 * põe em `desfeitas` para ela não voltar sozinha. O plano é recalculado a cada mudança do
 * lote: um recado colado ANTES das fotos espera e se aplica quando a escala entra.
 *
 * As escolhas de "quem é" (dois Guilhermes) ficam neste aparelho (`localStorage`), por
 * menção: o "@Guilherme R1" de amanhã já sai resolvido.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lerMensagens, planejarRecados } from '@/lib/escalaRecados'

const CHAVE_LEMBRADOS = 'escala-recados-apelidos'
const lerLembrados = () => {
  try { return JSON.parse(localStorage.getItem(CHAVE_LEMBRADOS) || '{}') || {} } catch { return {} }
}
const normMencao = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

export const chaveAcao = (msgId, a) => [
  msgId, a.tipo, a.hospital || '', a.nomeNaOrdem || '', a.pessoa?.uid || normMencao(a.pessoa?.mencao), a.parceiro?.uid || '',
].join('|')

/**
 * @param {object} p
 * @param {'matutino'|'vespertino'} p.periodo
 * @param {Record<string, {ordemLiberacao: string[]}>} p.resumos   o que cada aba conta ao lote
 * @param {Array} p.roster
 * @param {Function} p.resolver
 * @param {(acao) => void} p.aplicar      grava a marcação na aba
 * @param {(acao) => void} p.desfazer     tira a marcação
 */
export function useRecadosLote({ periodo, resumos, roster, resolver, aplicar, desfazer }) {
  const [entradas, setEntradas] = useState([]) // [{ id, fonte, nome, mensagens, lendo, erro }]
  const [aplicadas, setAplicadas] = useState(() => new Set())
  const [desfeitas, setDesfeitas] = useState(() => new Set())
  const [lembrados, setLembrados] = useState(lerLembrados)
  const seq = useRef(0)

  const hospitais = useMemo(() => Object.fromEntries(
    Object.entries(resumos || {}).map(([h, r]) => [h, { ordem: r?.ordemLiberacao || [] }]),
  ), [resumos])

  const plano = useMemo(() => entradas.map((e) => ({
    ...e,
    itens: e.lendo || e.erro ? [] : planejarRecados({
      mensagens: e.mensagens, hospitais, turno: periodo, resolver, roster, lembrados,
    }).map((m) => ({
      ...m,
      id: `${e.id}:${m.id}`,
      acoes: m.acoes.map((a) => ({ ...a, chave: chaveAcao(`${e.id}:${m.id}`, a) })),
    })),
  })), [entradas, hospitais, periodo, resolver, roster, lembrados])

  // aplica o que é claro, uma vez por ação
  const aplicarRef = useRef(aplicar)
  aplicarRef.current = aplicar
  useEffect(() => {
    const novas = []
    for (const e of plano) for (const m of e.itens) for (const a of m.acoes) {
      if (a.estado !== 'pronta' || aplicadas.has(a.chave) || desfeitas.has(a.chave)) continue
      aplicarRef.current(a)
      novas.push(a.chave)
    }
    if (novas.length) setAplicadas((s) => new Set([...s, ...novas]))
  }, [plano, aplicadas, desfeitas])

  const adicionarTexto = useCallback((texto, { fonte = 'texto', nome = '' } = {}) => {
    const mensagens = lerMensagens(texto)
    if (!mensagens.length) return null
    seq.current += 1
    const id = `e${seq.current}`
    setEntradas((p) => [...p, { id, fonte, nome, mensagens }])
    return id
  }, [])

  /** Print: entra já como "lendo" e recebe as mensagens quando a transcrição volta. */
  const iniciarPrint = useCallback((nome, arquivo = null) => {
    seq.current += 1
    const id = `e${seq.current}`
    // miniatura do print ao lado da transcrição (só na memória desta tela)
    let miniatura = null
    try { miniatura = arquivo ? URL.createObjectURL(arquivo) : null } catch { miniatura = null }
    setEntradas((p) => [...p, { id, fonte: 'print', nome, mensagens: [], lendo: true, miniatura }])
    return id
  }, [])
  const concluirPrint = useCallback((id, { mensagens = [], erro = null } = {}) => {
    // a transcrição já chega uma mensagem por balão — o mesmo formato que o leitor devolve
    const lidas = erro ? [] : mensagens
      .map((m) => ({ hora: /^\d{1,2}:\d{2}$/.test(String(m.hora || '')) ? String(m.hora).padStart(5, '0') : null, autor: null, texto: String(m.texto || '').trim() }))
      .filter((m) => m.texto)
    setEntradas((p) => p.map((e) => (e.id === id ? { ...e, lendo: false, erro, mensagens: lidas } : e)))
  }, [])

  const desfazerAcao = useCallback((a) => {
    if (!aplicadas.has(a.chave)) return
    desfazer(a)
    setAplicadas((s) => { const n = new Set(s); n.delete(a.chave); return n })
    setDesfeitas((s) => new Set(s).add(a.chave))
  }, [aplicadas, desfazer])

  const reaplicarAcao = useCallback((a) => {
    setDesfeitas((s) => { const n = new Set(s); n.delete(a.chave); return n })
  }, [])

  const desfazerEntrada = useCallback((id) => {
    const e = plano.find((x) => x.id === id)
    for (const m of e?.itens || []) for (const a of m.acoes) if (aplicadas.has(a.chave)) desfazerAcao(a)
  }, [plano, aplicadas, desfazerAcao])

  const removerEntrada = useCallback((id) => {
    desfazerEntrada(id)
    setEntradas((p) => {
      const sai = p.find((e) => e.id === id)
      if (sai?.miniatura) { try { URL.revokeObjectURL(sai.miniatura) } catch { /* nada */ } }
      return p.filter((e) => e.id !== id)
    })
  }, [desfazerEntrada])

  /** "Quem é?" — guarda a escolha neste aparelho; o plano refaz e a ação se aplica. */
  const escolherPessoa = useCallback((mencao, uid) => {
    setLembrados((p) => {
      const prox = { ...p, [normMencao(mencao)]: uid }
      try { localStorage.setItem(CHAVE_LEMBRADOS, JSON.stringify(prox)) } catch { /* sem storage: vale só nesta sessão */ }
      return prox
    })
  }, [])

  const contagem = useMemo(() => {
    let aplic = 0; let decidir = 0; let info = 0; let semAlvo = 0
    for (const e of plano) for (const m of e.itens) for (const a of m.acoes) {
      if (aplicadas.has(a.chave)) aplic += 1
      else if (a.estado === 'ambigua') decidir += 1
      else if (a.estado === 'sem_alvo') semAlvo += 1
      else if (a.estado === 'info') info += 1
    }
    return { aplicadas: aplic, decidir, info, semAlvo, lendo: entradas.some((e) => e.lendo), entradas: entradas.length }
  }, [plano, aplicadas, entradas])

  return {
    plano, aplicadas, desfeitas, contagem,
    adicionarTexto, iniciarPrint, concluirPrint,
    desfazerAcao, reaplicarAcao, desfazerEntrada, removerEntrada, escolherPessoa,
  }
}
