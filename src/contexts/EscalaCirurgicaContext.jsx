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
import { createReliableSubscription } from '@/services/supabaseSubscriptionHelper'
import { useToast } from '@/design-system/components/ui/toast'
import { ajudasPreservadasNoRepasse, familiaConvenio, lerOverrideAnterior, mergeRodapeTurno, rodapeDoTurno, snapshotCasos } from '@/pages/escala-cirurgica/utils'
import { nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import { ehFimDeSemana, FDS_HOSPITAL } from '@/lib/escalaFds'
import { getDemoEscala } from '@/data/escalaCirurgicaDemo'
import { agora } from '@/lib/devClock'

// ⚠️ 'fds' NÃO entra aqui: HomeCard, HOSPITAL_OPCOES da página e o loadData
// iteram esta constante — a linha da fila única do FDS é um slot EXTRA do
// estado (escalas.fds), carregado à parte só em sáb/dom (padrão p4Hospital).
export const HOSPITAIS = ['unimed', 'hro', 'materno']
export const HOSPITAL_LABEL = { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' }

/**
 * Teto da observação da linha (dono 29/07). É recado operacional curto, lido de
 * relance no card da fila — e é campo aberto que o grupo TODO enxerga, então o
 * limite também segura o impulso de escrever mais do que a escala pode guardar
 * (paciente só por iniciais, LGPD).
 */
export const OBSERVACAO_MAX = 120

const normNome = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^\s*ped[.\s]\s*/i, '').trim().toUpperCase()
// Decisão do dono 30/07: a escala NÃO manda notificação nenhuma (escalado/
// liberado/sala encerrou/livre/assumiu caso/novo caso — tudo removido). O
// volume lotava a inbox com informação que ninguém lia; a tela realtime é a
// fonte. Se algum aviso voltar um dia, que seja opt-in e agregado, não por evento.

/** Data local YYYY-MM-DD (sem fuso UTC). */
export function hojeISO(d = agora()) {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

const EscalaStateContext = createContext(null)
const EscalaActionsContext = createContext(null)

// p4Hospital: onde o coringa da noite está hoje (null = aparece nos 3 hospitais)
// escalas.fds: linha da fila única do FDS (null em dia útil — nem é buscada)
const initialState = { escalas: { unimed: null, hro: null, materno: null, fds: null }, p4Hospital: null }

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ALL':
      return { ...state, escalas: action.payload }
    case 'SET_HOSPITAL':
      return { ...state, escalas: { ...state.escalas, [action.hospital]: action.payload } }
    // PATCH_HOSPITAL faz merge sobre o estado ATUAL, não sobre o objeto `escala`
    // que a action recebeu por parâmetro. Numa sequência de escritas (substituir
    // posição = casos + rodapé + marcas), cada dispatch com `{...escala, X}` usava
    // o snapshot do closure e REVERTIA o passo anterior — a posição não mudava na
    // tela até o realtime recarregar (bug 29/07).
    case 'PATCH_HOSPITAL':
      return {
        ...state,
        escalas: {
          ...state.escalas,
          [action.hospital]: { ...(state.escalas[action.hospital] || {}), ...action.patch },
        },
      }
    case 'SET_P4_HOSPITAL':
      return { ...state, p4Hospital: action.payload }
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

  // Escalas atuais p/ actions multi-hospital (executar/desfazer troca escrevem
  // nas DUAS escalas): ref em vez de dep — pôr state.escalas nas deps recriaria
  // todas as actions a cada realtime e quebraria o split State/Actions.
  const escalasRef = useRef(state.escalas)
  useEffect(() => { escalasRef.current = state.escalas }, [state.escalas])

  // CACHE POR DATA (dono 16/08: "transição de hoje para amanhã está lenta e
  // demorando a aparecer informações"). Duas coisas aconteciam ao trocar de
  // data: a tela seguia mostrando a escala da data ANTERIOR até a resposta
  // chegar (informação errada no ar) e voltar para "hoje" refazia tudo do
  // zero. Agora: data já vista aparece na hora (e revalida em segundo plano),
  // data nova limpa a tela antes de buscar — nunca mostra o dia errado.
  const cacheRef = useRef(new Map())

  const loadData = useCallback(async (dia) => {
    const emCache = cacheRef.current.get(dia)
    if (emCache) {
      dispatch({ type: 'SET_ALL', payload: emCache.escalas })
      dispatch({ type: 'SET_P4_HOSPITAL', payload: emCache.p4Hospital ?? null })
      setLoading(false)
    } else {
      // sem cache: zera para não exibir a data anterior enquanto busca
      dispatch({ type: 'SET_ALL', payload: { unimed: null, hro: null, materno: null, fds: null } })
      setLoading(true)
    }
    try {
      const [results, fdsRow] = await Promise.all([
        Promise.all(HOSPITAIS.map((h) => svc.fetchEscala(dia, h).catch(() => null))),
        // fila única do FDS: linha pseudo-hospital 'fds' (uma por sáb/dom).
        // Dia útil nem faz a request; falha cai em null (modo FDS não liga e a
        // tela segue no comportamento por hospital — rollout seguro).
        ehFimDeSemana(dia) ? svc.fetchEscala(dia, FDS_HOSPITAL).catch(() => null) : Promise.resolve(null),
      ])
      // Fixture demo é ferramenta de DEV/e2e (testes determinísticos) — PRODUÇÃO
      // nunca vê demo (pedido do dono 23/07: botão e dados de demonstração excluídos).
      const escalas = { fds: fdsRow || (import.meta.env.DEV ? getDemoEscala(dia, FDS_HOSPITAL) : null) }
      HOSPITAIS.forEach((h, i) => { escalas[h] = results[i] || (import.meta.env.DEV ? getDemoEscala(dia, h) : null) })
      dispatch({ type: 'SET_ALL', payload: escalas })
      // marcação do P4 do dia (fase noturna das Liberações) — falha vira null,
      // que é o padrão seguro: o coringa aparece nos 3 hospitais.
      let p4 = null
      try {
        p4 = await svc.fetchP4Hospital(dia)
      } catch { p4 = null }
      dispatch({ type: 'SET_P4_HOSPITAL', payload: p4 })
      // guarda para a próxima visita à mesma data (o realtime revalida)
      cacheRef.current.set(dia, { escalas, p4Hospital: p4 })
      if (cacheRef.current.size > 8) {
        cacheRef.current.delete(cacheRef.current.keys().next().value)
      }
    } catch (err) {
      console.error('[EscalaCirurgicaContext] load falhou:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Pré-carrega uma data em segundo plano (dono 16/08: "transição de hoje para
   * amanhã está lenta"). A página chama para AMANHÃ assim que descobre que a
   * escala de lá está publicada — quando o usuário toca, já está em cache.
   * Silencioso: falha aqui não aparece na tela; o load normal tenta de novo.
   */
  const prefetch = useCallback(async (dia) => {
    if (!dia || cacheRef.current.has(dia)) return
    try {
      const [results, fdsRow] = await Promise.all([
        Promise.all(HOSPITAIS.map((h) => svc.fetchEscala(dia, h).catch(() => null))),
        ehFimDeSemana(dia) ? svc.fetchEscala(dia, FDS_HOSPITAL).catch(() => null) : Promise.resolve(null),
      ])
      if (!results.some(Boolean) && !fdsRow) return // nada publicado: não cacheia
      const escalas = { fds: fdsRow }
      HOSPITAIS.forEach((h, i) => { escalas[h] = results[i] || null })
      let p4 = null
      try { p4 = await svc.fetchP4Hospital(dia) } catch { p4 = null }
      cacheRef.current.set(dia, { escalas, p4Hospital: p4 })
    } catch { /* silencioso: é adiantamento, não caminho crítico */ }
  }, [])

  // Recarrega quando a data muda (sem recriar subscriptions).
  useEffect(() => { loadData(data) }, [data, loadData])

  // VIRADA DA MEIA-NOITE (pedido do dono 24/07): quem deixa o app aberto durante
  // o plantão ficava vendo a escala de ONTEM — e a lista voltava INTEIRA, porque
  // a fase noturna só vale p/ a escala de hoje (00h05 = 'dia' na data de ontem).
  // Passada a meia-noite, a data avança sozinha e só a escala do dia novo fica.
  // Só mexe em quem estava vendo HOJE: quem foi ao calendário continua onde está.
  // Timer + visibilitychange/pageshow/focus porque iOS/PWA mata o setInterval na
  // suspensão (mesma lição do cronômetro, bug 2026-07-22).
  // `hoje` é ESTADO (não useMemo na página): só assim o rótulo "Hoje" e o atalho
  // "Amanhã" acompanham a virada num app que ficou aberto a noite toda.
  const [hoje, setHoje] = useState(() => hojeISO())
  const hojeRef = useRef(hoje)
  useEffect(() => {
    const checar = () => {
      const novo = hojeISO()
      if (novo === hojeRef.current) return
      const anterior = hojeRef.current
      hojeRef.current = novo
      setHoje(novo)
      setData((atual) => (atual === anterior ? novo : atual))
    }
    const id = setInterval(checar, 30_000)
    document.addEventListener('visibilitychange', checar)
    window.addEventListener('pageshow', checar)
    window.addEventListener('focus', checar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', checar)
      window.removeEventListener('pageshow', checar)
      window.removeEventListener('focus', checar)
    }
  }, [])

  // PWA de volta do 2º plano: a suspensão mata websockets — o realtime pode não
  // reconectar e o estado vira FANTASMA (aviso de troca já excluída do banco
  // preso na tela o dia todo, bug real 2026-07-22). Visível de novo → recarrega.
  useEffect(() => {
    const retomar = () => { if (!document.hidden) loadData(dataRef.current) }
    document.addEventListener('visibilitychange', retomar)
    window.addEventListener('pageshow', retomar)
    return () => {
      document.removeEventListener('visibilitychange', retomar)
      window.removeEventListener('pageshow', retomar)
    }
  }, [loadData])

  // Subscriptions realtime — montadas uma única vez (loadData é estável). Separadas
  // da troca de data p/ não abrir janela de eventos perdidos ao reconectar canais.
  useEffect(() => {
    const subs = ['escala_cirurgica', 'escala_cirurgica_caso', 'escala_plantao_p4_diario'].map((table) =>
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
      // Regra do dono 23/07: a escala recém-postada é a VÁLIDA — publicar um turno
      // novo ZERA as liberações do dia (ignora as do turno anterior; começa limpo).
      if (saved?.status === 'publicada' && !String(saved.id).startsWith('demo-')) {
        try { await svc.resetLiberacoesDia(saved.id) } catch { /* segue publicado */ }
        saved.liberacoes = {}
        saved.linhaOverrides = {}
      }
      dispatch({ type: 'SET_HOSPITAL', hospital: payload.hospital, payload: saved })
      if (saved?.status === 'publicada') {
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

  const salvarEscalaTurno = useCallback(async (payload, userInfo) => {
    try {
      const saved = await svc.salvarEscalaTurno(payload, userInfo)
      dispatch({ type: 'SET_HOSPITAL', hospital: payload.hospital, payload: saved })
      return saved
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao publicar turno', description: error.message })
      throw error
    }
  }, [toast])

  // Reordena a liberação DO TURNO preservando a do outro (23/07: manhã e tarde
  // convivem). turno ausente = legado (grava o array antigo, compat).
  const reordenarLiberacao = useCallback(async (escala, novaOrdem, turno) => {
    try {
      const ordemLiberacao = turno ? mergeRodapeTurno(escala.ordemLiberacao, turno, novaOrdem) : novaOrdem
      const isDemo = String(escala.id).startsWith('demo-')
      if (!isDemo) await svc.updateOrdemLiberacao(escala.id, ordemLiberacao)
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { ordemLiberacao } })
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
  const chaveTurno = (turno, chave) => turno && (turno === 'matutino' || turno === 'vespertino') ? `${turno}:${chave}` : chave

  const toggleLiberacao = useCallback(async (escala, linhaArg, userInfo = {}, turno) => {
    const linha = linhaDe(linhaArg)
    const chave = linha.chave || linha.anestesista
    const legada = !linha.selo && linha.anestesista && linha.anestesista !== chave ? linha.anestesista : null
    try {
      const atual = escala.liberacoes || {}
      const scoped = chaveTurno(turno, chave)
      const scopedLegada = legada && chaveTurno(turno, legada)
      const jaLiberado = !!(atual[scoped] ?? (scopedLegada ? atual[scopedLegada] : undefined) ?? atual[chave] ?? (legada ? atual[legada] : undefined))
      const valor = jaLiberado ? null : { liberadoEm: new Date().toISOString(), por: userInfo.userId || null }
      const liberacoes = { ...atual }
      if (jaLiberado) { delete liberacoes[scoped]; if (scopedLegada) delete liberacoes[scopedLegada]; delete liberacoes[chave]; if (legada) delete liberacoes[legada] }
      else liberacoes[scoped] = valor
      const isDemo = String(escala.id).startsWith('demo-')
      // Voltou a ser escalado (liberação desfeita)? A situação é NOVA — marca a linha
      // como RENOVADA: apaga ajustes antigos E suprime o derivado dos casos da manhã
      // (sala/cirurgião/tempo vêm em branco p/ preencher do zero).
      // trocaCom/assumidaPor SOBREVIVEM: são identidade do slot/par declarado, não
      // ajuste de exibição — sem isto, desfazer uma liberação devolveria o slot ao
      // dono antigo e a pessoa que assumiu viraria linha extra de novo.
      const linhaOverrides = { ...(escala.linhaOverrides || {}) }
      let marcador = null
      if (jaLiberado) {
        const flags = linhaOverrides[scoped] || linhaOverrides[chave] || (legada ? linhaOverrides[legada] : null) || {}
        marcador = {
          renovado: true,
          ...(flags.trocaCom && { trocaCom: flags.trocaCom }),
          ...(flags.assumidaPor && { assumidaPor: flags.assumidaPor }),
          por: userInfo.userId || null, em: new Date().toISOString(),
        }
        linhaOverrides[scoped] = marcador
        if (legada) { delete linhaOverrides[legada]; if (scopedLegada) delete linhaOverrides[scopedLegada] }
      }
      // OTIMISTA (dono 19/08, "resposta tátil imediata"): liberar é o toque mais
      // frequente do módulo e esperava a ida ao servidor antes de pintar. Pinta
      // já; erro reverte os DOIS campos ao snapshot + toast. O toast de sucesso
      // da view continua atrás do await (honestidade da auditoria F1.6 intacta).
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { liberacoes, linhaOverrides } })
      // merge por chave no servidor — marcações simultâneas de 2 plantonistas não se apagam
      if (!isDemo) {
        await svc.patchLiberacao(escala.id, scoped, valor)
        if (scopedLegada && atual[scopedLegada] !== undefined) await svc.patchLiberacao(escala.id, scopedLegada, null)
        if (marcador) {
          await svc.patchLinhaOverride(escala.id, scoped, marcador)
          if (scopedLegada) await svc.patchLinhaOverride(escala.id, scopedLegada, null)
        }
      }
    } catch (error) {
      dispatch({
        type: 'PATCH_HOSPITAL', hospital: escala.hospital,
        patch: { liberacoes: escala.liberacoes || {}, linhaOverrides: escala.linhaOverrides || {} },
      })
      toast({ variant: 'error', title: 'Erro ao liberar', description: error.message })
      throw error
    }
  }, [toast])

  // "Não escalado" é reversível: quem entra na escala no meio do dia é marcado
  // como ESCALADO ({ escalado: true } no mapa de liberações — o card volta a verde);
  // desmarcar remove a chave (volta ao vermelho automático).
  const toggleEscalado = useCallback(async (escala, linhaArg, userInfo = {}, turno) => {
    const linha = linhaDe(linhaArg)
    const chave = linha.chave || linha.anestesista
    const legada = !linha.selo && linha.anestesista && linha.anestesista !== chave ? linha.anestesista : null
    try {
      const atual = escala.liberacoes || {}
      const scoped = chaveTurno(turno, chave)
      const jaForcado = (atual[scoped] ?? atual[chave] ?? (legada ? atual[legada] : undefined))?.escalado === true
      const valor = jaForcado ? null : { escalado: true, por: userInfo.userId || null, em: new Date().toISOString() }
      const liberacoes = { ...atual }
      if (jaForcado) { delete liberacoes[scoped]; delete liberacoes[chave]; if (legada) { delete liberacoes[legada]; delete liberacoes[chaveTurno(turno, legada)] } }
      else liberacoes[scoped] = valor
      const isDemo = String(escala.id).startsWith('demo-')
      // Entrou na escala agora (não-escalado → escalado): ajustes antigos da linha
      // são de antes — limpa p/ preencher do zero (sala/local, cirurgião, tempo
      // faltante). trocaCom/assumidaPor ficam: identidade do slot/par, não ajuste.
      const linhaOverrides = { ...(escala.linhaOverrides || {}) }
      const patchesOverride = []
      for (const k of [scoped, chave, legada, legada && chaveTurno(turno, legada)].filter(Boolean)) {
        if (!jaForcado && linhaOverrides[k]) {
          const { trocaCom, assumidaPor } = linhaOverrides[k]
          const restante = (trocaCom || assumidaPor)
            ? { ...(trocaCom && { trocaCom }), ...(assumidaPor && { assumidaPor }), por: userInfo.userId || null, em: new Date().toISOString() }
            : null
          if (restante) linhaOverrides[k] = restante
          else delete linhaOverrides[k]
          patchesOverride.push([k, restante])
        }
      }
      // OTIMISTA (dono 19/08): pinta antes do servidor; erro reverte + toast.
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { liberacoes, linhaOverrides } })
      if (!isDemo) {
        await svc.patchLiberacao(escala.id, scoped, valor)
        if (legada) await svc.patchLiberacao(escala.id, chaveTurno(turno, legada), null)
        for (const [k, restante] of patchesOverride) await svc.patchLinhaOverride(escala.id, k, restante)
      }
    } catch (error) {
      dispatch({
        type: 'PATCH_HOSPITAL', hospital: escala.hospital,
        patch: { liberacoes: escala.liberacoes || {}, linhaOverrides: escala.linhaOverrides || {} },
      })
      toast({ variant: 'error', title: 'Erro ao marcar escalado', description: error.message })
      throw error
    }
  }, [toast])

  // Plantonista ajusta a LINHA de um anestesista na coluna (local e/ou cirurgião),
  // conforme o plantão evolui. Override estruturado { local?, cirurgioes? } por chave;
  // override = null limpa (volta ao derivado dos casos).
  const setLinhaOverride = useCallback(async (escala, linhaArg, override, userInfo = {}, turno) => {
    const linha = linhaDe(linhaArg)
    const chave = linha.chave || linha.anestesista
    const legada = !linha.selo && linha.anestesista && linha.anestesista !== chave ? linha.anestesista : null
    try {
      // `override === null` é o "Restaurar automático" EXPLÍCITO: limpa tudo,
      // inclusive os flags. Objeto com campos vazios NÃO é restauração — salvar o
      // editor sem preencher nada apagava `renovado` e ressuscitava sala/cirurgião
      // da manhã numa linha que tinha voltado de liberação (bug encontrado 29/07).
      const restaurar = override == null
      const local = String(override?.local || '').trim()
      const cirurgioes = String(override?.cirurgioes || '').trim()
      const termino = String(override?.termino || '').trim() // "HH:MM" — cronômetro manual
      // OBSERVAÇÃO (dono 29/07): recado operacional livre na linha, no lugar da
      // funcionalidade de troca — quem trocou de hospital/sala escreve aqui e o
      // plantonista lê. Campo comum: some no "Restaurar automático" e sobrevive a
      // um salvar com os demais vazios (o editor manda os 4 campos juntos).
      const observacao = String(override?.observacao || '').trim().slice(0, OBSERVACAO_MAX)
      // linha renovada (voltou de liberação): o flag persiste nos ajustes seguintes —
      // preencher só o tempo não pode ressuscitar sala/cirurgião da manhã.
      const scoped = chaveTurno(turno, chave)
      const anterior = escala.linhaOverrides?.[scoped] || escala.linhaOverrides?.[chave] || (legada ? escala.linhaOverrides?.[legada] : null) || {}
      const renovado = !restaurar && !!anterior.renovado
      // trocaCom/assumidaPor sobrevivem a QUALQUER salvar do editor E ao "Restaurar
      // automático": restaurar limpa a EXIBIÇÃO da linha (local/cirurgião/tempo/
      // observação); troca declarada e posição assumida se desfazem pelos botões
      // próprios — apagá-las aqui devolveria o slot ao dono antigo em silêncio.
      const trocaCom = anterior.trocaCom || null
      const assumidaPor = anterior.assumidaPor || null
      const valor = (local || cirurgioes || termino || observacao || renovado || trocaCom || assumidaPor)
        ? { ...(local && { local }), ...(cirurgioes && { cirurgioes }), ...(termino && { termino }), ...(observacao && { observacao }), ...(renovado && { renovado: true }), ...(trocaCom && { trocaCom }), ...(assumidaPor && { assumidaPor }), por: userInfo.userId || null, em: new Date().toISOString() }
        : null
      const linhaOverrides = { ...(escala.linhaOverrides || {}) }
      if (valor) linhaOverrides[scoped] = valor
      else delete linhaOverrides[scoped]
      if (legada) delete linhaOverrides[legada]
      const isDemo = String(escala.id).startsWith('demo-')
      // OTIMISTA (dono 19/08): o cronômetro/local/observação pintam no toque;
      // erro reverte ao snapshot + toast. Quem espera o resolve (painel Salvar)
      // continua esperando a persistência real — só a pintura adiantou.
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { linhaOverrides } })
      if (!isDemo) {
        await svc.patchLinhaOverride(escala.id, scoped, valor)
        if (legada) await svc.patchLinhaOverride(escala.id, chaveTurno(turno, legada), null)
      }
    } catch (error) {
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { linhaOverrides: escala.linhaOverrides || {} } })
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
    dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { casos } })
    try {
      if (!isDemo && caso.id) await svc.updateStatusCirurgia(caso.id, status)
      // (Os avisos "sala encerrou" e "anestesista livre" p/ o plantonista saíram
      // em 30/07 junto com as demais notificações da escala — ver nota no topo.)
    } catch (error) {
      // reverte o otimista (o servidor recusou — ex.: extra em caso terminada)
      dispatch({ type: 'SET_HOSPITAL', hospital: escala.hospital, payload: escala })
      toast({ variant: 'error', title: 'Erro ao atualizar status', description: error.message })
      throw error
    }
  }, [toast])

  // Troca o responsável de CASOS específicos (substitui o sistema de trocas,
  // aposentado 2026-07-23). ⚠️ Recebe IDS decididos por alvosTrocaResponsavel —
  // NUNCA a sala inteira às cegas: o update sala-wide achatou o IOSC (multi-
  // anestesista) p/ uma pessoa e dois anestesistas SUMIRAM da escala (23/07).
  // Completa/Liberações/Minhas derivam dos casos → atualizam juntas p/ todos.
  const setAnestesistaCasos = useCallback(async (escala, casoIds, { uid, apelido, dupla = false }, { rotulo = '' } = {}) => {
    if (String(escala.id).startsWith('demo-')) {
      toast({ variant: 'warning', title: 'Indisponível na demonstração' })
      return
    }
    const ids = (casoIds || []).filter(Boolean)
    if (!ids.length) return
    try {
      const idSet = new Set(ids)
      await svc.updateAnestesistaCasos(ids, { uid, apelido, dupla })
      // espelha o service: dupla mantém o texto "A + B" sem uid (não é "sem
      // anestesista"); sem uid e sem dupla o caso volta a ser "?" (e ao alerta)
      const patch = dupla
        ? { anestesista: apelido, anestesistaUserId: null, semAnestesista: false }
        : uid
          ? { anestesista: apelido, anestesistaUserId: uid, semAnestesista: false }
          : { anestesista: '?', anestesistaUserId: null, semAnestesista: true }
      const casos = (escala.casos || []).map((c) => (idSet.has(c.id) ? { ...c, ...patch } : c))
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { casos } })
      // VISITANTE PRESERVADO NO REPASSE (dono 31/07 — caso LEONARDO): quem veio
      // de fora e ficou sem caso aqui entra em ajuda_externa[turno] — a linha das
      // Liberações sobrevive ao repasse (era a única evidência de presença dele).
      // Best-effort: falha aqui NÃO desfaz o repasse (dá p/ marcar ajuda à mão).
      try {
        let ajudaExterna = escala.ajudaExterna
        for (const { nome, turno } of ajudasPreservadasNoRepasse(escala.casos, casos, idSet, escala)) {
          const atual = rodapeDoTurno(ajudaExterna, turno)
          ajudaExterna = mergeRodapeTurno(ajudaExterna, turno, [...atual, nome])
        }
        if (ajudaExterna !== escala.ajudaExterna) {
          await svc.updateAjudaExterna(escala.id, ajudaExterna)
          dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { ajudaExterna } })
        }
      } catch { /* repasse já está feito; a ajuda pode ser marcada à mão */ }
      toast({
        variant: 'success',
        title: dupla ? 'Dois anestesistas na cirurgia' : uid ? 'Responsável atualizado' : 'Caso sem anestesista',
        description: `${rotulo || `${ids.length} caso(s)`} → ${dupla || uid ? apelido : 'sem anestesista (?)'}`,
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao definir anestesista', description: error.message })
      throw error
    }
  }, [toast])

  // ── TROCA DECLARADA (dono 30/07) — par declarado + execução de um toque ────
  // NÃO é a troca antiga (removida 2×): é um PAR de pessoas do dia, badge nos
  // dois lados e swap SIMULTÂNEO na execução. ordem_liberacao NUNCA é escrita —
  // a substituição troca a IDENTIDADE do slot via linha_overrides[chave].assumidaPor.

  /** Marca/desmarca "Trocado com" na linha. colega = { uid, nome } | null.
   *  Preserva os demais campos do override (override parcial apaga — regra da casa). */
  const marcarTroca = useCallback(async (escala, linhaArg, colega, userInfo = {}, turno) => {
    const linha = linhaDe(linhaArg)
    const chave = linha.chave || linha.anestesista
    // chave `uid#casos` é o namespace da linha-espelho (dono de slot assumido
    // reaparecendo com casos) — troca gravada nela fica órfã: nem a coluna nem
    // paresTroca a leem (defeito D7, 07/08). A UI já esconde o bloco; isto é
    // defesa contra chamador novo.
    if (String(chave).includes('#')) {
      toast({ variant: 'warning', title: 'Esta linha não aceita troca', description: 'Ela espelha casos re-importados. Ajuste pelo Definir anestesista ou pela linha principal da pessoa.' })
      return
    }
    const scoped = chaveTurno(turno, chave)
    try {
      // MESMA cadeia de fallback do setLinhaOverride (defeito 07/08): ler só a
      // chave namespaced criava uma SEGUNDA entrada quando o override vivia em
      // chave legada — e o local/observação da entrada antiga sumia da UI.
      const legada = linha.anestesista && linha.anestesista !== chave ? linha.anestesista : null
      const { valor: anterior, chaveEncontrada } = lerOverrideAnterior(escala.linhaOverrides, chave, turno, [legada])
      const { trocaCom: _sai, por: _p, em: _e, ...resto } = anterior || {}
      const temResto = Object.keys(resto).length > 0
      // tipo/motivo (dono 07/08) viajam DENTRO do jsonb — sem migration; o
      // trigger de eventos audita o detalhe inteiro de graça
      // `apenasRegistro` (dono 10/08): a escala já saiu trocada e ninguém muda
      // de lugar — só o rastro. Não é declaração pendente: a convergência da
      // importação a ignora (senão a próxima publicação executaria o swap).
      const valor = colega
        // `local` = onde o colega está quando ele não tem posição no turno
        // (Consultório, Materno, folga…). Ele vinha do TrocaSheet e era
        // DESCARTADO aqui: o dono informou "consultório" para dois colegas em
        // 16/08 e a fila não mostrava nada entre parênteses (defeito real).
        ? { ...resto, trocaCom: { uid: colega.uid || null, nome: colega.nome || '', ...(colega.tipo && { tipo: colega.tipo }), ...(colega.motivo && { motivo: colega.motivo }), ...(colega.local && { local: colega.local }), ...(colega.apenasRegistro && { apenasRegistro: true }), por: userInfo.userId || null, em: new Date().toISOString() }, por: userInfo.userId || null, em: new Date().toISOString() }
        : temResto ? { ...resto, por: userInfo.userId || null, em: new Date().toISOString() } : null
      const migrarLegada = chaveEncontrada && chaveEncontrada !== scoped
      // demo opera EM MEMÓRIA (padrão do toggleLiberacao) — base dos e2e determinísticos
      if (!String(escala.id).startsWith('demo-')) {
        await svc.patchLinhaOverride(escala.id, scoped, valor)
        // a entrada migrou para a chave namespaced; a legada sai (padrão do setLinhaOverride)
        if (migrarLegada) await svc.patchLinhaOverride(escala.id, chaveEncontrada, null)
      }
      const linhaOverrides = { ...(escala.linhaOverrides || {}) }
      if (valor) linhaOverrides[scoped] = valor
      else delete linhaOverrides[scoped]
      if (migrarLegada) delete linhaOverrides[chaveEncontrada]
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { linhaOverrides } })
      toast({
        variant: 'success',
        title: colega ? (colega.apenasRegistro ? 'Troca registrada' : 'Troca declarada') : 'Troca desfeita',
        description: colega ? `${linha.anestesista} ⇄ ${nomeCirurgiaoCurto(colega.nome)} — badge nos dois lados.` : undefined,
      })
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao marcar troca', description: error.message })
      throw error
    }
  }, [toast])

  /**
   * Executa a substituição (plano de utils: planoExecucaoTroca ou 1 lado do
   * DefinirAnestesistaSheet). Por lado: assumidaPor no slot + casos transferidos.
   * Os efeitos vão JUNTOS ou NENHUM: falha no meio desfaz o que já foi escrito
   * (rollback best-effort) e, se o rollback também falhar, recarrega do banco e
   * avisa — nunca deixa a tela fingindo sucesso (lição F1.6).
   */
  const executarSubstituicao = useCallback(async ({ lados = [], limparTroca = [] }, userInfo = {}, { escalasOverride = null } = {}) => {
    if (!lados.length) return
    // escalasOverride (Fase 2, importação): a publicação acabou de acontecer e o
    // estado do context ainda não a viu — o plano opera sobre o snapshot que o
    // chamador montou (saved + outras escalas), sem corrida com o realtime. O
    // dispatch local é pulado: quem usa override recarrega do banco em seguida.
    const escalas = escalasOverride || escalasRef.current
    const agoraIso = new Date().toISOString()
    const rollback = [] // LIFO
    const porHospital = {} // patches locais pós-sucesso
    const patchLocal = (hospital, mut) => {
      const esc = escalas[hospital]
      if (!porHospital[hospital]) {
        porHospital[hospital] = { linhaOverrides: { ...(esc.linhaOverrides || {}) }, casos: [...(esc.casos || [])] }
      }
      mut(porHospital[hospital])
    }
    const escalaDe = (escalaId) => Object.values(escalas).find((e) => e?.id === escalaId)
    try {
      const pendentesLimpar = new Set(limparTroca.map((x) => `${x.escalaId}|${x.chave}`))
      let ladosPulados = 0
      for (const lado of lados) {
        const esc = escalas[lado.hospital]
        if (!esc || esc.id !== lado.escalaId) throw new Error('A escala mudou — recarregue e tente de novo.')
        const demo = String(lado.escalaId).startsWith('demo-') // demo: só em memória
        const scoped = chaveTurno(lado.turno, lado.chaveSlot)
        const anterior = (esc.linhaOverrides || {})[scoped] ?? null
        // IDEMPOTÊNCIA (defeito D10, 07/08): o slot já está assumido por quem
        // este lado quer pôr → pular o lado INTEIRO. Re-executar (2º toque,
        // convergência pós-publicação, dois plantonistas ao mesmo tempo)
        // re-transferia casos que agora pertencem ao outro lado do swap.
        const asmAtual = anterior?.assumidaPor
        const jaAssumido = asmAtual && (
          asmAtual.uid ? asmAtual.uid === lado.para.uid
            : (!lado.para.uid && normNome(asmAtual.nome || '') === normNome(lado.para.nome || ''))
        )
        if (jaAssumido) { ladosPulados += 1; pendentesLimpar.delete(`${lado.escalaId}|${lado.chaveSlot}`); continue }
        const { trocaCom: _sai, ...resto } = anterior || {}
        pendentesLimpar.delete(`${lado.escalaId}|${lado.chaveSlot}`)
        const valor = {
          ...resto,
          // `casoIds` = o que ESTA execução moveu (incidente 10/08): sem esse
          // recibo o desfazer devolvia todos os casos abertos do assumente no
          // hospital, inclusive os do outro turno, que nunca saíram do lugar.
          // `de` = RECIBO DO DONO do slot (18/08). planoDesfazerTroca varre os
          // assumidaPor do par no turno e deduzia o dono como "o outro do par":
          // quem assumiu DUAS posições no mesmo turno (dois hospitais) via a
          // segunda vaga ser desfeita junto com a primeira, devolvida à pessoa
          // errada e com os casos dela. Registro antigo (sem `de`) mantém o
          // comportamento anterior.
          assumidaPor: { uid: lado.para.uid, nome: lado.para.nome, de: { uid: lado.de?.uid || null, nome: lado.de?.nome || '' }, ...(lado.tipo && { tipo: lado.tipo }), ...(lado.motivo && { motivo: lado.motivo }), ...(lado.local && { local: lado.local }), casoIds: lado.casoIds || [], por: userInfo.userId || null, em: agoraIso },
          por: userInfo.userId || null, em: agoraIso,
        }
        if (!demo) {
          await svc.patchLinhaOverride(lado.escalaId, scoped, valor)
          rollback.push(() => svc.patchLinhaOverride(lado.escalaId, scoped, anterior))
        }
        patchLocal(lado.hospital, (p) => { p.linhaOverrides[scoped] = valor })
        if (lado.casoIds?.length) {
          if (!demo) {
            // Rollback por SNAPSHOT do que estava lá. Reverter com {uid: de.uid}
            // apagava o anestesista quando o dono não tinha vínculo: uid null
            // faz o service gravar '?' + sem_anestesista (defeito 07/08).
            const antes = snapshotCasos(esc, lado.casoIds)
            await svc.updateAnestesistaCasos(lado.casoIds, { uid: lado.para.uid, apelido: lado.para.apelido })
            rollback.push(() => svc.restaurarAnestesistaCasos(antes))
          }
          const ids = new Set(lado.casoIds)
          patchLocal(lado.hospital, (p) => {
            p.casos = p.casos.map((c) => ids.has(c.id)
              ? { ...c, anestesista: lado.para.apelido, anestesistaUserId: lado.para.uid, semAnestesista: false }
              : c)
          })
        }
      }
      // trocaCom declarado em OUTRA chave que não os slots (ex.: na linha de quem
      // assumiu): limpa também — o badge some dos dois lados após a execução.
      for (const item of limparTroca) {
        if (!pendentesLimpar.has(`${item.escalaId}|${item.chave}`)) continue
        const esc = escalaDe(item.escalaId)
        const scoped = chaveTurno(item.turno, item.chave)
        const ant = (esc?.linhaOverrides || {})[scoped]
        if (!ant?.trocaCom) continue
        const { trocaCom: _t, por: _p, em: _e, ...resto } = ant
        const v = Object.keys(resto).length ? { ...resto, por: userInfo.userId || null, em: agoraIso } : null
        if (!String(item.escalaId).startsWith('demo-')) {
          await svc.patchLinhaOverride(item.escalaId, scoped, v)
          rollback.push(() => svc.patchLinhaOverride(item.escalaId, scoped, ant))
        }
        patchLocal(item.hospital, (p) => {
          if (v) p.linhaOverrides[scoped] = v
          else delete p.linhaOverrides[scoped]
        })
      }
      if (!escalasOverride) {
        for (const [hospital, patch] of Object.entries(porHospital)) {
          dispatch({ type: 'PATCH_HOSPITAL', hospital, patch })
        }
      }
      // todos os lados já estavam no estado-alvo: nada foi escrito (D10)
      if (ladosPulados === lados.length) {
        toast({ variant: 'success', title: 'Troca já executada', description: 'Nada a refazer — a posição já estava assumida.' })
        return
      }
      const nomes = [...new Set(lados.map((l) =>
        `${nomeCirurgiaoCurto(l.para.nome)} → posição de ${titleCaseNome(l.nomeSlot || l.de.nome)}`))]
      toast({ variant: 'success', title: 'Troca executada', description: nomes.join(' · ') })
    } catch (error) {
      let restaurou = true
      for (const desfaz of rollback.reverse()) {
        try { await desfaz() } catch { restaurou = false }
      }
      loadData(dataRef.current)
      toast({
        variant: 'error',
        title: 'Troca não concluída',
        description: restaurou
          ? `${error.message} Nada foi alterado.`
          : `${error.message} Parte foi revertida — confira a lista antes de repetir.`,
      })
      throw error
    }
  }, [toast, loadData])

  /** Desfaz a substituição (plano de planoDesfazerTroca): limpa assumidaPor e
   *  devolve os casos ao dono original do slot. Dono sem uid → só limpa (avisa). */
  const desfazerSubstituicao = useCallback(async ({ lados = [] }, userInfo = {}) => {
    if (!lados.length) return
    const escalas = escalasRef.current
    const agoraIso = new Date().toISOString()
    const rollback = []
    const porHospital = {}
    try {
      for (const lado of lados) {
        const esc = escalas[lado.hospital]
        if (!esc || esc.id !== lado.escalaId) throw new Error('A escala mudou — recarregue e tente de novo.')
        const demo = String(lado.escalaId).startsWith('demo-') // demo: só em memória
        const scoped = chaveTurno(lado.turno, lado.chaveSlot)
        const anterior = (esc.linhaOverrides || {})[scoped] ?? null
        const { assumidaPor: _sai, por: _p, em: _e, ...resto } = anterior || {}
        const valor = Object.keys(resto).length ? { ...resto, por: userInfo.userId || null, em: agoraIso } : null
        if (!demo) {
          await svc.patchLinhaOverride(lado.escalaId, scoped, valor)
          rollback.push(() => svc.patchLinhaOverride(lado.escalaId, scoped, anterior))
        }
        if (!porHospital[lado.hospital]) {
          porHospital[lado.hospital] = { linhaOverrides: { ...(esc.linhaOverrides || {}) }, casos: [...(esc.casos || [])] }
        }
        const p = porHospital[lado.hospital]
        if (valor) p.linhaOverrides[scoped] = valor
        else delete p.linhaOverrides[scoped]
        if (lado.para?.uid && lado.casoIds?.length) {
          if (!demo) {
            // mesmo snapshot do executar: rollback restaura o que estava lá,
            // nunca re-deriva do uid (uid null viraria '?')
            const antes = snapshotCasos(esc, lado.casoIds)
            await svc.updateAnestesistaCasos(lado.casoIds, { uid: lado.para.uid, apelido: lado.para.apelido })
            rollback.push(() => svc.restaurarAnestesistaCasos(antes))
          }
          const ids = new Set(lado.casoIds)
          p.casos = p.casos.map((c) => ids.has(c.id)
            ? { ...c, anestesista: lado.para.apelido, anestesistaUserId: lado.para.uid, semAnestesista: false }
            : c)
        }
      }
      for (const [hospital, patch] of Object.entries(porHospital)) {
        dispatch({ type: 'PATCH_HOSPITAL', hospital, patch })
      }
      const semVolta = lados.filter((l) => !l.para?.uid)
      toast({
        variant: semVolta.length ? 'warning' : 'success',
        title: 'Troca desfeita',
        description: semVolta.length
          ? `Casos seguem com ${semVolta.map((l) => nomeCirurgiaoCurto(l.de.nome)).join(', ')} — ajuste pelo Definir anestesista se preciso.`
          : undefined,
      })
    } catch (error) {
      let restaurou = true
      for (const desfaz of rollback.reverse()) {
        try { await desfaz() } catch { restaurou = false }
      }
      loadData(dataRef.current)
      toast({
        variant: 'error',
        title: 'Desfazer não concluído',
        description: restaurou ? `${error.message} Nada foi alterado.` : `${error.message} Confira a lista antes de repetir.`,
      })
      throw error
    }
  }, [toast, loadData])

  // Edita SALA/LOCAL (ou outro campo) de UM caso — aba Completa → detalhe do caso
  // (pedido do dono 24/07: além do anestesista, poder corrigir onde o procedimento
  // acontece). Otimista; board re-agrupa e a coluna de liberação re-deriva (realtime).
  const atualizarCaso = useCallback(async (escala, casoId, updates) => {
    if (String(escala.id).startsWith('demo-')) {
      toast({ variant: 'warning', title: 'Indisponível na demonstração' })
      return
    }
    try {
      // OTIMISTA (dono 19/08): gravidade/término/sala/cirurgião/residente pintam
      // no toque (era daqui o delay do card Andamento); erro reverte + toast. O
      // toast de sucesso segue atrás do await — só sai com o dado persistido.
      const casos = (escala.casos || []).map((c) => (c.id === casoId ? { ...c, ...updates } : c))
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { casos } })
      await svc.updateCaso(casoId, updates)
      toast({ variant: 'success', title: 'Caso atualizado' })
    } catch (error) {
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { casos: escala.casos || [] } })
      toast({ variant: 'error', title: 'Erro ao atualizar caso', description: error.message })
      throw error
    }
  }, [toast])

  // Acrescenta um anestesista de OUTRO hospital (AJUDA) à coluna de liberação DO
  // TURNO (pedido do dono 24/07): vai para o FIM (primeiro a ser liberado, badge
  // Ajuda azul). Preserva a ajuda do outro turno (mesma mecânica do rodapé por-turno).
  /**
   * Reordena o BLOCO DE AJUDA (decisão do dono 30/07: blocos fixos no fim, com
   * ordem manual DENTRO do bloco).
   *
   * Persiste reordenando o próprio array `ajuda_externa[turno]` — que é a fonte da
   * ordem do bloco na lib. NUNCA toca em `ordem_liberacao`: o rodapé é imutável no
   * app desde 27/07 e reescrevê-lo foi o que corrompeu a escala em 22/07 (há teste
   * travando isso). Aqui só o subconjunto azul se move, e dentro do próprio campo.
   *
   * @param {number} de    índice atual no bloco
   * @param {number} para  índice destino no bloco
   */
  const reordenarAjuda = useCallback(async (escala, turno, de, para) => {
    if (String(escala.id).startsWith('demo-')) {
      toast({ variant: 'warning', title: 'Indisponível na demonstração' })
      return
    }
    const atual = rodapeDoTurno(escala.ajudaExterna, turno)
    if (de === para || de < 0 || para < 0 || de >= atual.length || para >= atual.length) return
    const nova = [...atual]
    nova.splice(para, 0, ...nova.splice(de, 1))
    const ajudaExterna = mergeRodapeTurno(escala.ajudaExterna, turno, nova)
    // otimista: a fila reordena na hora e o erro reverte com toast
    dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { ajudaExterna } })
    try {
      await svc.updateAjudaExterna(escala.id, ajudaExterna)
    } catch (error) {
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { ajudaExterna: escala.ajudaExterna } })
      toast({ variant: 'error', title: 'Erro ao reordenar ajuda', description: error.message })
      throw error
    }
  }, [toast])

  const adicionarAjuda = useCallback(async (escala, turno, nome) => {
    const nm = String(nome || '').trim()
    if (!nm) return
    if (String(escala.id).startsWith('demo-')) {
      toast({ variant: 'warning', title: 'Indisponível na demonstração' })
      return
    }
    try {
      const atual = rodapeDoTurno(escala.ajudaExterna, turno)
      if (atual.some((n) => normNome(n) === normNome(nm))) return // já é ajuda
      const ajudaExterna = mergeRodapeTurno(escala.ajudaExterna, turno, [...atual, nm])
      // otimista (dono 19/08): o badge aparece no toque; erro reverte + toast
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { ajudaExterna } })
      await svc.updateAjudaExterna(escala.id, ajudaExterna)
      toast({ variant: 'success', title: `${nm} adicionado como ajuda` })
    } catch (error) {
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { ajudaExterna: escala.ajudaExterna } })
      toast({ variant: 'error', title: 'Erro ao adicionar ajuda', description: error.message })
      throw error
    }
  }, [toast])

  const removerAjuda = useCallback(async (escala, turno, nome) => {
    if (String(escala.id).startsWith('demo-')) return
    try {
      const atual = rodapeDoTurno(escala.ajudaExterna, turno)
      const ajudaExterna = mergeRodapeTurno(escala.ajudaExterna, turno, atual.filter((n) => normNome(n) !== normNome(nome)))
      // otimista (dono 19/08): erro reverte + toast
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { ajudaExterna } })
      await svc.updateAjudaExterna(escala.id, ajudaExterna)
    } catch (error) {
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { ajudaExterna: escala.ajudaExterna } })
      toast({ variant: 'error', title: 'Erro ao remover ajuda', description: error.message })
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
      toast({ variant: 'success', title: 'Caso adicionado', description: `${novo.sala || ''} ${novo.hora || ''}`.trim() })
      return novo
    } catch (error) {
      toast({ variant: 'error', title: 'Erro ao adicionar caso', description: error.message })
      throw error
    }
  }, [toast])

  // TROCA REMOVIDA DO APP (decisão do dono 29/07): "retire a funcionalidade de
  // troca (apenas deixe um campo em aberto para observação)". Caiu tudo — o
  // sistema de propor/aceitar (aposentado em 23/07), a substituição de posição
  // entre hospitais (27/07) e o service/tabela que os alimentava. Quem troca de
  // hospital ou de sala escreve uma linha em `linha_overrides[chave].observacao`
  // (ver setLinhaOverride) e o plantonista lê e resolve. A tabela
  // `trocas_cirurgicas` segue no banco: apagar dado é irreversível.

  const refresh = useCallback(() => loadData(dataRef.current), [loadData])

  /**
   * Marca em qual hospital o P4 (coringa da noite) está escalado no dia exibido.
   * Marcação COMPARTILHADA (realtime): some dos outros dois hospitais para todos.
   * NÃO toca na escala nem no rodapé — é uma tabela à parte, só de exibição.
   */
  const definirP4Hospital = useCallback(async (hospital, userInfo = {}) => {
    const dia = dataRef.current
    const anterior = state.p4Hospital
    dispatch({ type: 'SET_P4_HOSPITAL', payload: hospital }) // otimista
    try {
      await svc.setP4Hospital(dia, hospital, { userName: userInfo.userName || null })
      toast({ variant: 'success', title: 'P4 definido', description: `Plantão noturno do P4 no ${HOSPITAL_LABEL[hospital] || hospital}.` })
    } catch (error) {
      dispatch({ type: 'SET_P4_HOSPITAL', payload: anterior })
      toast({ variant: 'error', title: 'Erro ao definir o P4', description: error.message })
      throw error
    }
  }, [state.p4Hospital, toast])

  // Salas dos papéis do contrato de urgência do HRO, POR TURNO (dono 18/08):
  // { orto?, co?, plantao?, sobreaviso? } — null/ausente = automático; cfg null
  // limpa o turno inteiro. Otimista como as demais: a faixa reflete na hora e
  // o realtime confirma para o resto da equipe.
  const definirSalasUrgencia = useCallback(async (escala, turno, cfg) => {
    if (String(escala.id).startsWith('demo-')) {
      toast({ variant: 'warning', title: 'Indisponível na demonstração' })
      return
    }
    const chave = turno === 'vespertino' ? 'vespertino' : 'matutino'
    const anterior = escala.urgenciasMeta || {}
    const urgenciasMeta = cfg == null
      ? Object.fromEntries(Object.entries(anterior).filter(([k]) => k !== chave))
      : { ...anterior, [chave]: cfg }
    dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { urgenciasMeta } })
    try {
      await svc.patchUrgenciasMeta(escala.id, chave, cfg)
    } catch (error) {
      dispatch({ type: 'PATCH_HOSPITAL', hospital: escala.hospital, patch: { urgenciasMeta: anterior } })
      toast({ variant: 'error', title: 'Erro ao salvar as salas', description: error.message })
      throw error
    }
  }, [toast])

  const actionsValue = useMemo(() => ({
    setData, prefetch, salvarEscala, salvarEscalaTurno, reordenarLiberacao, toggleLiberacao, toggleEscalado, setLinhaOverride, setLocalAnestesista,
    setStatusCirurgia, adicionarCaso, setAnestesistaCasos, atualizarCaso, adicionarAjuda, removerAjuda,
    reordenarAjuda, definirP4Hospital, marcarTroca, executarSubstituicao, desfazerSubstituicao, definirSalasUrgencia, refresh,
  }), [prefetch, salvarEscala, salvarEscalaTurno, reordenarLiberacao, toggleLiberacao, toggleEscalado, setLinhaOverride, setLocalAnestesista, setStatusCirurgia, adicionarCaso, setAnestesistaCasos, atualizarCaso, adicionarAjuda, removerAjuda, reordenarAjuda, definirP4Hospital, marcarTroca, executarSubstituicao, desfazerSubstituicao, definirSalasUrgencia, refresh])

  const stateValue = useMemo(() => ({
    escalas: state.escalas, p4Hospital: state.p4Hospital, data, loading, hoje,
  }), [state.escalas, state.p4Hospital, data, loading, hoje])

  return (
    <EscalaActionsContext.Provider value={actionsValue}>
      <EscalaStateContext.Provider value={stateValue}>
        {children}
      </EscalaStateContext.Provider>
    </EscalaActionsContext.Provider>
  )
}

const STATE_FALLBACK = { escalas: { unimed: null, hro: null, materno: null, fds: null }, p4Hospital: null, data: hojeISO(), loading: true, hoje: hojeISO() }
const ACTIONS_FALLBACK = {
  setData: () => {}, prefetch: async () => {}, salvarEscala: async () => {}, salvarEscalaTurno: async () => {}, reordenarLiberacao: async () => {},
  toggleLiberacao: async () => {}, setLocalAnestesista: async () => {}, setAnestesistaCasos: async () => {},
  atualizarCaso: async () => {}, adicionarAjuda: async () => {}, removerAjuda: async () => {},
  definirP4Hospital: async () => {}, marcarTroca: async () => {}, executarSubstituicao: async () => {},
  desfazerSubstituicao: async () => {}, definirSalasUrgencia: async () => {}, refresh: async () => {},
}

export function useEscalaCirurgicaActions() {
  return useContext(EscalaActionsContext) ?? ACTIONS_FALLBACK
}

export function useEscalaCirurgica() {
  const s = useContext(EscalaStateContext)
  const a = useContext(EscalaActionsContext)
  return { ...(s ?? STATE_FALLBACK), ...(a ?? ACTIONS_FALLBACK) }
}
