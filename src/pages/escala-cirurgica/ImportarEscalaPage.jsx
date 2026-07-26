/**
 * ImportarEscalaPage — confecção da escala pela secretária.
 * Fonte: Excel (Unimed) · Imagem/Vision (HRO/Materno) · Manual → base cirúrgica SEM
 * anestesista. A secretária ATRIBUI o anestesista de cada sala selecionando do roster
 * (login), o que resolve a identidade na origem (sem match por nome). Ao atribuir, o
 * apelido importado é aprendido no dicionário (apelido→login) p/ a próxima escala.
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronDown, ChevronsDownUp, ChevronsUpDown, Plus, Trash2, Sparkles, Loader2, Check, AlertTriangle } from 'lucide-react'
import { Button, ConfirmDialog, DatePicker, FileUpload, Input, Select, useToast } from '@/design-system'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { useEscalaCirurgicaActions, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { parseExcelEscala } from '@/lib/excelEscala'
import { nomeCirurgiaoCurto } from '@/lib/colunaLiberacao'
import cirurgiasSvc from '@/services/supabaseCirurgiasParticularesService'
import SegmentedSelector from './SegmentedSelector'
import { normNome, agruparPorSala, compararSalas, aplicarAtribuicoes, detectarConflitos, normalizarSalaUnimed, normalizarSalaHro, blocoDaSalaUnimed, turnoAtual, familiaConvenio, mergeCasosPorTurno, mergeRodapeTurno } from './utils'

const HOSPITAL_OPCOES = Object.entries(HOSPITAL_LABEL).map(([value, label]) => ({ value, label }))
const PERIODO_OPCOES = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
]
const dataToISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const linhaVazia = (sala = '') => ({
  sala, hora: '', pacienteIniciais: '', procedimento: '',
  cirurgiao: '', anestesista: '', bloco: 'normal', tipo: 'eletiva',
})

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })

const primeiroNomeUpper = (nome) => normNome(String(nome || '').split(/\s+/)[0] || '')

// Sentinela do seletor por caso: deixar a linha SEM anestesista de propósito
// ("?" da escala). Valor impossível como uid.
const SEM_ANESTESISTA = '__sem__'

// Normalização de salas na importação (pedidos 2026-07-21):
// Unimed — "CENTRO CIRÚRGICO - SALA 1" → "CC - Sala 1" + bloco pela seção;
// HRO — "CO" → "Sala 7 - CO", "HO" → "Hospital de Olhos".
const normalizarCasosImportados = (rows, hosp) => {
  if (hosp === 'unimed') {
    return rows.map((c) => {
      const sala = normalizarSalaUnimed(c.sala)
      return { ...c, sala, bloco: c.bloco && c.bloco !== 'normal' ? c.bloco : blocoDaSalaUnimed(sala) }
    })
  }
  if (hosp === 'hro') return rows.map((c) => ({ ...c, sala: normalizarSalaHro(c.sala) }))
  return rows
}

export default function ImportarEscalaPage({ hospital, data, onClose }) {
  const { toast } = useToast()
  const { salvarEscala } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { options: rosterOpcoes, rosterByUid, resolver, upsertAlias } = useRosterAnestesistas()

  const [casos, setCasos] = useState([])
  const [atribuicoes, setAtribuicoes] = useState({}) // sala -> uid
  const [ordemTexto, setOrdemTexto] = useState('')
  const [ajudaTexto, setAjudaTexto] = useState('') // nomes em AZUL (ajuda de outro hospital)
  const [carregando, setCarregando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  // Hospital da escala é escolhido AQUI (pedido do dono 2026-07-21) — entra
  // pré-selecionado com o hospital da página, mas a escala pode ser de outro.
  const [hosp, setHosp] = useState(hospital || 'unimed')
  // Data + período NO CORPO (pedido 2026-07-22 — a data era fixa no header)
  const [dataEscolhida, setDataEscolhida] = useState(data)
  const [periodo, setPeriodo] = useState(() => turnoAtual())
  // Sugestão de hospital pelo layout do anexo (Vision/Excel) — confirmar, nunca trocar sozinho.
  const [sugestaoHosp, setSugestaoHosp] = useState(null) // { hospital, origem: 'vision'|'excel' }
  const [ultimoArquivo, setUltimoArquivo] = useState(null) // p/ reler a imagem com o hint certo

  const canEdit = !!(user?.isAdmin || ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria'].includes((user?.role || '').toLowerCase()))


  // Salas distintas (ordenadas) + texto de anestesista importado por sala.
  const salas = useMemo(() => [...agruparPorSala(casos).keys()].sort(compararSalas(hosp)), [casos, hosp])
  const textoSala = useMemo(() => {
    const m = {}
    for (const c of casos) {
      if (c.semAnestesista) continue // "?" não é nome importado (espelha aplicarAtribuicoes)
      const t = String(c.anestesista || '').trim()
      if (t && t !== '//' && !/^\?+$/.test(t) && !m[c.sala]) m[c.sala] = t
    }
    return m
  }, [casos])

  // Cirurgiões de cada sala (pedido do dono 26/07): conferir "quem opera onde" é
  // o que identifica a sala na imagem — sem isso a atribuição era às cegas.
  const cirurgioesSala = useMemo(() => {
    const m = {}
    for (const c of casos) {
      const nome = nomeCirurgiaoCurto(String(c.cirurgiao || '').split('/')[0])
      if (!nome) continue
      if (!m[c.sala]) m[c.sala] = []
      if (!m[c.sala].includes(nome)) m[c.sala].push(nome)
    }
    return m
  }, [casos])

  // Casos agrupados por sala PRESERVANDO o índice original (setCampo/removeLinha
  // continuam operando no array plano).
  const gruposConferencia = useMemo(() => {
    const m = new Map()
    casos.forEach((c, i) => {
      const sala = c.sala || 'sem sala'
      if (!m.has(sala)) m.set(sala, [])
      m.get(sala).push({ c, i })
    })
    return [...m.entries()]
      .sort((a, b) => compararSalas(hosp)(a[0], b[0]))
      .map(([sala, itens]) => ({ sala, itens }))
  }, [casos, hosp])

  // Conferência dobrada por sala (mobile): 29 cards planos viravam um rolo
  // interminável. Fechada por padrão — abre a sala que precisa conferir.
  const [salasAbertas, setSalasAbertas] = useState(() => new Set())
  const alternarSala = (sala) => setSalasAbertas((p) => {
    const n = new Set(p)
    if (n.has(sala)) n.delete(sala); else n.add(sala)
    return n
  })
  const todasAbertas = gruposConferencia.length > 0 && salasAbertas.size === gruposConferencia.length

  // Pré-atribui pela resolução do apelido importado (dicionário), sem sobrescrever escolha.
  useEffect(() => {
    setAtribuicoes((prev) => {
      let changed = false
      const next = { ...prev }
      for (const sala of salas) {
        if (next[sala] !== undefined) continue
        const uid = resolver(textoSala[sala] || '')
        if (uid) { next[sala] = uid; changed = true }
      }
      return changed ? next : prev
    })
  }, [salas, textoSala, resolver])

  // O login ESCOLHIDO no Select vence o texto importado — antes o texto vencia
  // e trocar o anestesista da sala na conferência (Janaina→Cury, 23/07)
  // publicava o display antigo ('JANAINA') com o uid novo: a Completa parecia
  // não ter mudado e a Liberações agrupava pela pessoa errada.
  const apelidoExibicao = useCallback((sala, uid) => {
    const r = rosterByUid.get(uid)
    if (r) return r.apelidos[0] || primeiroNomeUpper(r.nome)
    const txt = textoSala[sala]
    return txt ? normNome(txt) : ''
  }, [textoSala, rosterByUid])

  // Conflito: mesmo login em 2 salas com horário sobreposto (avisa, não bloqueia).
  const conflitos = useMemo(
    () => (casos.length ? detectarConflitos(aplicarAtribuicoes(casos, atribuicoes, apelidoExibicao, resolver)) : []),
    [casos, atribuicoes, apelidoExibicao, resolver]
  )

  // GUARDRAIL 2 (revisão 23/07): nos blocos multi-anestesista (Exames/Umanitá/
  // IOSC) cada linha costuma ter o SEU anestesista — 2+ linhas todas com o MESMO
  // nome é a assinatura da propagação indevida (Exames 3×PAULO, IOSC 3×CURY).
  const blocosRepetidos = useMemo(() => {
    const MULTI = new Set(['exames', 'umanita', 'iosc'])
    const porSala = new Map()
    for (const c of casos) {
      if (!MULTI.has(String(c.bloco || ''))) continue
      const t = String(c.anestesista || '').trim()
      if (!t || t === '//') continue
      if (!porSala.has(c.sala)) porSala.set(c.sala, [])
      porSala.get(c.sala).push(t)
    }
    const out = []
    for (const [sala, nomes] of porSala) {
      if (nomes.length >= 2 && new Set(nomes.map(normNome)).size === 1) {
        out.push({ sala, nome: nomes[0], n: nomes.length })
      }
    }
    return out
  }, [casos])

  // ── Importação ─────────────────────────────────────────────────────────────
  // Roteia pelo tipo do arquivo: planilha → parser local; imagem → Vision.
  const importarArquivo = (file) => {
    if (!file) return
    setUltimoArquivo(file)
    setSugestaoHosp(null)
    if (/\.(xlsx?|csv)$/i.test(file.name || '')) {
      // Excel/CSV é o export padrão da Unimed — sugere se o hospital escolhido for outro
      if (hosp !== 'unimed') setSugestaoHosp({ hospital: 'unimed', origem: 'excel' })
      return importarExcel(file)
    }
    if (String(file.type || '').startsWith('image/')) return importarImagem(file)
    toast({ variant: 'error', title: 'Formato não suportado', description: 'Envie Excel (.xlsx/.xls/.csv) ou uma imagem da escala.' })
  }

  const importarExcel = async (file) => {
    if (!file) return
    setCarregando(true)
    try {
      const { casos: rows, headerScore } = await parseExcelEscala(file)
      if (!rows.length) {
        toast({ variant: 'error', title: 'Não consegui ler a planilha', description: 'Confira o arquivo ou use entrada manual.' })
        setCasos([linhaVazia()])
      } else {
        setCasos(normalizarCasosImportados(rows, hosp))
        toast({ variant: 'success', title: `${rows.length} casos lidos`, description: `Atribua o anestesista de cada sala. (colunas reconhecidas: ${headerScore})` })
      }
    } catch {
      toast({ variant: 'error', title: 'Falha ao ler Excel', description: 'Preencha manualmente.' })
      setCasos([linhaVazia()])
    } finally { setCarregando(false) }
  }

  const importarImagem = async (file, hospParam = hosp) => {
    if (!file) return
    setCarregando(true)
    try {
      const imageBase64 = await fileToBase64(file)
      const res = await svc.parseEscalaImagem({ imageBase64, mimeType: file.type, hospital: hospParam })
      setCasos(normalizarCasosImportados((res.casos || []).map((c) => ({ ...linhaVazia(), ...c })), hospParam))
      if (res.ordemLiberacao?.length) setOrdemTexto(res.ordemLiberacao.join(', '))
      if (res.ajudaExterna?.length) setAjudaTexto(res.ajudaExterna.join(', '))
      // Layout de outro hospital? Sugere (o dono confirma — nunca troca sozinho).
      const det = String(res.hospitalDetectado || '')
      setSugestaoHosp(det && det !== hospParam ? { hospital: det, origem: 'vision' } : null)
      toast({ variant: 'success', title: `${res.casos?.length || 0} casos extraídos`, description: 'Confira e atribua o anestesista de cada sala.' })
    } catch {
      toast({ variant: 'error', title: 'Falha na extração', description: 'Preencha manualmente.' })
      if (!casos.length) setCasos([linhaVazia()])
    } finally { setCarregando(false) }
  }

  // Aceita a sugestão: troca o hospital e, se veio da Vision, RELÊ a imagem com o
  // hint certo (o prompt por formato extrai melhor com o hospital correto).
  const aplicarSugestaoHosp = () => {
    if (!sugestaoHosp) return
    const d = sugestaoHosp.hospital
    setHosp(d)
    const relerImagem = sugestaoHosp.origem === 'vision' && ultimoArquivo
    setSugestaoHosp(null)
    if (relerImagem) importarImagem(ultimoArquivo, d)
  }

  // ── Edição da base ───────────────────────────────────────────────────────────
  const setCampo = (i, campo, valor) => setCasos((cs) => cs.map((c, k) => (k === i ? { ...c, [campo]: valor } : c)))
  const addLinha = () => setCasos((cs) => [...cs, linhaVazia()])
  const removeLinha = (i) => setCasos((cs) => cs.filter((_, k) => k !== i))

  // Anestesista DO CASO (pedido do dono 26/07): salas multi-anestesista
  // (IOSC/Exames) e correção de caso "?" precisam furar a atribuição por sala.
  // '' = segue a sala · SEM_ANESTESISTA = fica "?" de propósito · uid = manual.
  const definirAnestesistaCaso = (i, valor) => setCasos((cs) => cs.map((c, k) => {
    if (k !== i) return c
    if (valor === SEM_ANESTESISTA) {
      return { ...c, semAnestesista: true, anestesistaManual: false, anestesistaUserId: null, anestesista: '?' }
    }
    if (!valor) {
      return { ...c, semAnestesista: false, anestesistaManual: false, anestesistaUserId: null, anestesista: '' }
    }
    const r = rosterByUid.get(valor)
    return {
      ...c,
      semAnestesista: false,
      anestesistaManual: true,
      anestesistaUserId: valor,
      anestesista: r ? (r.apelidos[0] || primeiroNomeUpper(r.nome)) : c.anestesista,
    }
  }))

  /**
   * Valor do seletor de anestesista do caso (deriva do estado, sem estado extra).
   * Sem escolha própria, mostra o RESPONSÁVEL da sala (pedido do dono 26/07):
   * "mesmo da sala" não dizia quem era, e conferir exigia subir até o cabeçalho.
   * É só exibição — o caso segue a sala até alguém escolher outro nome aqui.
   */
  const valorAnestesistaCaso = (c) => {
    if (c.semAnestesista) return SEM_ANESTESISTA
    if (c.anestesistaUserId) return c.anestesistaUserId
    const t = String(c.anestesista || '').trim()
    const base = textoSala[c.sala] || ''
    // nome PRÓPRIO da linha (bloco multi) que o dicionário reconhece: mostra quem é
    if (t && t !== '//' && base && normNome(t) !== normNome(base)) return resolver(t) || ''
    return atribuicoes[c.sala] || ''
  }

  const preencherRodape = () => {
    const nomes = salas.map((s) => apelidoExibicao(s, atribuicoes[s])).filter(Boolean)
    setOrdemTexto([...new Set(nomes)].join(', '))
  }

  // Sala 100% "?" não conta como pendência: ficar sem anestesista ali é a
  // informação da escala, não um esquecimento da atribuição (dono 26/07).
  const salasSemAnestesista = useMemo(
    () => gruposConferencia.filter(
      ({ sala, itens }) => !atribuicoes[sala] && itens.some(({ c }) => !c.semAnestesista)
    ).length,
    [gruposConferencia, atribuicoes]
  )

  // GUARDRAIL (regra do dono 23/07): a última linha em VERMELHO é a ordem de
  // liberação — SEMPRE segui-la. Nome do rodapé SEM NENHUM caso, com vizinho
  // escalado, é o sinal clássico de extração errada (IOSC 23/07: as linhas de
  // Didomenico/Melo saíram p/ outro e os dois "sumiram" da escala). Avisa, não bloqueia.
  const rodapeSuspeitos = useMemo(() => {
    const nomes = ordemTexto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    if (nomes.length < 2) return []
    const uids = new Set(Object.values(atribuicoes).filter(Boolean))
    const nomesEscalados = new Set()
    for (const c of casos) {
      const n = normNome(c.anestesista)
      if (n && n !== '//') nomesEscalados.add(n)
      const uid = c.anestesistaUserId || (n && n !== '//' ? resolver(c.anestesista) : null)
      if (uid) uids.add(uid)
    }
    const temCaso = (nome) => {
      const uid = resolver(nome)
      return (uid && uids.has(uid)) || nomesEscalados.has(normNome(nome))
    }
    const flags = nomes.map(temCaso)
    return nomes.filter((n, i) => !flags[i] && (flags[i - 1] || flags[i + 1]))
  }, [ordemTexto, atribuicoes, casos, resolver])

  // ── Publicação ───────────────────────────────────────────────────────────────
  // GUARDRAIL ANTI-PERDA (incidente 23/07: publicar/importar com 1 caso APAGOU os
  // 31 da escala — publicar é DELETE+reinsert). Se a escala já publicada tem MAIS
  // casos do que os desta tela, confirma antes de substituir (perda irreversível).
  const [substituir, setSubstituir] = useState(null) // { atuais, novos }
  const publicar = async (confirmado = false) => {
    setPublicando(true)
    try {
      const userId = user?.uid || user?.id
      const casosNovos = aplicarAtribuicoes(casos, atribuicoes, apelidoExibicao, resolver)
      const ordemNova = ordemTexto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
      const ajudaNova = ajudaTexto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)

      // CONVIVÊNCIA MANHÃ/TARDE (23/07): publicar é DELETE+reinsert do DIA inteiro
      // — publicar a tarde apagava a manhã. Mescla: mantém o OUTRO turno e grava o
      // rodapé E a ajuda externa por-turno. `periodo` é o turno sendo publicado.
      let existente = null
      try { existente = await svc.fetchEscala(dataEscolhida, hosp) } catch { existente = null }
      const casosOut = mergeCasosPorTurno(existente?.casos || [], casosNovos, periodo)
      const ordemLiberacao = mergeRodapeTurno(existente?.ordemLiberacao, periodo, ordemNova)
      const ajudaExterna = mergeRodapeTurno(existente?.ajudaExterna, periodo, ajudaNova)

      // Guardrail anti-perda: só alerta se o DIA (já mesclado) ENCOLHER — perda real
      // do outro turno ou re-publicação menor do mesmo turno.
      if (!confirmado) {
        const atuais = existente?.casos?.length || 0
        if (atuais >= 3 && atuais > casosOut.length) {
          setPublicando(false)
          setSubstituir({ atuais, novos: casosOut.length })
          return
        }
      }

      // Aprende apelido→login SÓ quando o apelido é DESCONHECIDO do dicionário.
      // Se já resolve p/ outra pessoa, é REATRIBUIÇÃO da sala (não um apelido
      // novo) — aprender aqui gravaria o apelido de A apontando p/ B (classe do
      // erro JANAINA→Cury encontrado no dicionário em 23/07).
      await Promise.all(salas.map(async (sala) => {
        const uid = atribuicoes[sala]
        const txt = textoSala[sala]
        if (uid && txt && resolver(txt) == null) {
          try { await upsertAlias({ apelido: txt, userId: uid, createdBy: userId }) } catch { /* segue */ }
        }
      }))

      const saved = await salvarEscala(
        { data: dataEscolhida, hospital: hosp, casos: casosOut, ordemLiberacao, ajudaExterna, status: 'publicada' },
        { userId, userName: user?.displayName }
      )

      // Nome completo → cobrança: caso PARTICULAR extraído com pacienteNome
      // (Vision/Excel) completa o rascunho auto-criado pelo trigger. Match por
      // sala|ordem (a RPC devolve os casos salvos ordenados por sala,ordem; a
      // ordem efetiva replica `{ ordem: i, ...c }` do service). Fire-and-forget:
      // falha deixa o rascunho com iniciais + badge "Completar dados".
      try {
        const ordemEfetiva = (c, i) => {
          const o = 'ordem' in c ? c.ordem : i
          return Number.isFinite(Number(o)) ? Number(o) : 0
        }
        const comNome = casosOut
          .map((c, i) => ({ c, key: `${c.sala}|${ordemEfetiva(c, i)}` }))
          .filter(({ c }) => c.pacienteNome && familiaConvenio(c.convenio) === 'particular')
        if (comNome.length && saved?.casos?.length) {
          const idPorChave = new Map(saved.casos.map((s) => [`${s.sala}|${s.ordem}`, s.id]))
          await Promise.all(comNome.map(({ c, key }) => {
            const casoId = idPorChave.get(key)
            if (!casoId) return null
            return cirurgiasSvc
              .completarPacienteDoCaso(casoId, c.pacienteNome, { userId, userName: user?.displayName })
              .catch(() => {})
          }))
        }
      } catch { /* rascunho segue com iniciais */ }

      toast({ variant: 'success', title: 'Escala publicada', description: 'Anestesistas atribuídos serão notificados.' })
      // devolve onde publicou → a página aterrissa na escala certa (data/hospital/período)
      onClose?.({ data: dataEscolhida, hospital: hosp, turno: periodo })
    } catch {
      /* toast no context */
    } finally { setPublicando(false) }
  }

  const temBase = casos.length > 0

  return (
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto">
      {/* Header STICKY próprio (2026-07-22): o PageHeader é position:fixed com spacer
          de altura fixa — no PWA (safe-area do iPhone) ele cobria os seletores.
          Sticky dimensiona pelo conteúdo, respeita o notch e nunca sobrepõe. */}
      <div className="sticky top-0 z-10 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Cancelar"
            className="flex min-h-[44px] min-w-[70px] items-center gap-1 text-primary active:opacity-60"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Cancelar</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-foreground">
            Confeccionar · {HOSPITAL_LABEL[hosp]}
          </h1>
          <span className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto p-4 pb-28 space-y-4">
        {!canEdit && (
          <p className="rounded-lg bg-warning/10 text-warning text-sm p-3">Você não tem permissão para confeccionar escalas.</p>
        )}

        {/* Data + período da escala NO CORPO (pedido 2026-07-22 — antes era fixo no header) */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Data e período da escala</label>
          <div className="flex items-stretch gap-2">
            <DatePicker
              className="flex-1 min-w-0"
              value={(() => { const [y, m, d] = String(dataEscolhida || '').split('-').map(Number); return y ? new Date(y, m - 1, d) : new Date() })()}
              onChange={(d) => d && setDataEscolhida(dataToISO(d))}
              placeholder="Data da escala"
            />
            <SegmentedSelector className="flex-1" options={PERIODO_OPCOES} value={periodo} onChange={setPeriodo} />
          </div>
        </div>

        {/* Hospital da escala (pedido do dono 2026-07-21): editável aqui — a escala
            pode ser de outro hospital que não o selecionado na página. */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Hospital desta escala</label>
          <SegmentedSelector options={HOSPITAL_OPCOES} value={hosp} onChange={(v) => { setHosp(v); setSugestaoHosp(null) }} />
        </div>

        {/* Sugestão pelo layout do anexo — confirmar, nunca trocar sozinho */}
        {sugestaoHosp && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-warning flex-1">
              O anexo parece ser do <strong>{HOSPITAL_LABEL[sugestaoHosp.hospital]}</strong>
              {sugestaoHosp.origem === 'excel' ? ' (Excel é o export padrão da Unimed)' : ' (pelo layout da imagem)'}.
            </p>
            <Button size="sm" variant="outline" onClick={aplicarSugestaoHosp}>
              Usar {HOSPITAL_LABEL[sugestaoHosp.hospital]}{sugestaoHosp.origem === 'vision' ? ' e reler' : ''}
            </Button>
          </div>
        )}

        {/* Anexo ÚNICO multi-formato (pedido do dono 2026-07-21): Excel/CSV → parser
            local; imagem → Vision. Roteia pelo tipo do arquivo — sem seletor de fonte. */}
        <FileUpload accept=".xlsx,.xls,.csv,image/*" maxSize={15 * 1024 * 1024} variant="dropzone"
          label="Arquivo da escala"
          description="Excel/CSV do hospital ou foto/print da escala — a leitura é automática (paciente só por iniciais)."
          onChange={(f) => importarArquivo(Array.isArray(f) ? f[0] : f)} disabled={carregando || !canEdit} />
        {!temBase && canEdit && (
          <Button variant="outline" onClick={addLinha} className="w-full"><Plus className="w-4 h-4" /> Ou preencher manualmente</Button>
        )}

        {carregando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lendo…</p>
        )}

        {/* Conflitos de horário (aviso, não bloqueia) */}
        {conflitos.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-1.5">
            <p className="text-sm font-semibold text-warning flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {conflitos.length === 1 ? '1 conflito de horário' : `${conflitos.length} conflitos de horário`}
            </p>
            <p className="text-xs text-muted-foreground">Mesmo anestesista em 2 salas no mesmo horário. Pode publicar mesmo assim — revise se foi intencional.</p>
            <ul className="space-y-0.5">
              {conflitos.map((c, i) => (
                <li key={i} className="text-xs text-warning">{c.nome || 'Anestesista'} — {c.sala1} ({c.hora1}) e {c.sala2} ({c.hora2})</li>
              ))}
            </ul>
          </div>
        )}

        {/* Blocos multi-anestesista com todas as linhas iguais (aviso, não bloqueia) */}
        {blocosRepetidos.length > 0 && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-1">
            <p className="text-sm font-semibold text-warning flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Mesmo anestesista em todas as linhas
            </p>
            {blocosRepetidos.map((b) => (
              <p key={b.sala} className="text-xs text-warning">
                {b.sala}: {b.nome} nas {b.n} linhas — nesses blocos cada linha costuma ter o SEU anestesista; confira a imagem.
              </p>
            ))}
          </div>
        )}

        {/* Conferência da base */}
        {temBase && (
          <>
            {/* CONFERÊNCIA POR SALA (redesenho 26/07): a lista plana de N cards
                era impraticável no celular e ficava longe da atribuição, que
                vivia noutra seção. Agora cada sala é um bloco dobrado com o que
                identifica ela na imagem — cirurgiões — e o seletor do
                anestesista ali mesmo. Os casos abrem só quando for conferir. */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Conferir {gruposConferencia.length} sala{gruposConferencia.length === 1 ? '' : 's'} · {casos.length} caso{casos.length === 1 ? '' : 's'}
              </h2>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost"
                  onClick={() => setSalasAbertas(todasAbertas ? new Set() : new Set(gruposConferencia.map((g) => g.sala)))}
                  aria-label={todasAbertas ? 'Recolher todas as salas' : 'Expandir todas as salas'}>
                  {todasAbertas ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={addLinha}><Plus className="w-4 h-4" /> Linha</Button>
              </div>
            </div>
            {salasSemAnestesista > 0 && (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                {salasSemAnestesista} sala(s) ainda sem anestesista atribuído.
              </p>
            )}

            <div className="space-y-2">
              {gruposConferencia.map(({ sala, itens }) => {
                const aberta = salasAbertas.has(sala)
                const cirurgioes = cirurgioesSala[sala] || []
                const semAnest = !atribuicoes[sala] && itens.some(({ c }) => !c.semAnestesista)
                return (
                  <div key={sala} className={['rounded-xl border bg-card', semAnest ? 'border-warning/50' : 'border-border'].join(' ')}>
                    {/* cabeçalho: identifica a sala (cirurgiões) e abre os casos */}
                    <button type="button" onClick={() => alternarSala(sala)}
                      aria-expanded={aberta}
                      className="flex w-full items-center gap-2 p-3 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" title={sala}>{sala}</p>
                        {cirurgioes.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground" title={cirurgioes.join(', ')}>
                            {cirurgioes.slice(0, 3).join(', ')}{cirurgioes.length > 3 ? ` +${cirurgioes.length - 3}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{itens.length} caso{itens.length > 1 ? 's' : ''}</span>
                      <ChevronDown className={['w-4 h-4 shrink-0 text-muted-foreground transition-transform', aberta && 'rotate-180'].filter(Boolean).join(' ')} />
                    </button>

                    {/* atribuição da sala — SEMPRE visível (não exige abrir) */}
                    <div className="border-t border-border px-3 py-2">
                      <Select options={rosterOpcoes} value={atribuicoes[sala] || ''}
                        onChange={(v) => setAtribuicoes((p) => ({ ...p, [sala]: v }))}
                        placeholder={textoSala[sala] ? `Importado: ${textoSala[sala]}` : 'Selecionar anestesista…'}
                        searchable className="w-full" />
                    </div>

                    {aberta && (
                      <div className="space-y-2 border-t border-border p-3">
                        {itens.map(({ c, i }) => (
                          <div key={i} className="rounded-lg border border-border/70 bg-background p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-muted-foreground">#{i + 1}</span>
                              {c.semAnestesista && (
                                <span className="rounded-md bg-warning/15 px-1.5 py-0.5 font-semibold text-warning">Sem anestesista</span>
                              )}
                              <button type="button" onClick={() => removeLinha(i)} aria-label={`Remover caso ${i + 1}`}
                                className="ml-auto text-destructive"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-[1fr_5.5rem] gap-1.5">
                              <Input placeholder="Sala" value={c.sala} onChange={(e) => setCampo(i, 'sala', e.target.value)} />
                              <Input placeholder="Hora" value={c.hora} onChange={(e) => setCampo(i, 'hora', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Input placeholder="Cirurgião" value={c.cirurgiao} onChange={(e) => setCampo(i, 'cirurgiao', e.target.value)} />
                              <Input placeholder="Paciente (iniciais)" value={c.pacienteIniciais} onChange={(e) => setCampo(i, 'pacienteIniciais', e.target.value)} />
                            </div>
                            <Input placeholder="Procedimento" value={c.procedimento} onChange={(e) => setCampo(i, 'procedimento', e.target.value)} />
                            {/* anestesista DESTE caso: fura a atribuição da sala
                                (IOSC/Exames) e é como se corrige um "?" */}
                            <Select
                              className="w-full"
                              options={[{ value: SEM_ANESTESISTA, label: 'Sem anestesista (?)' }, ...rosterOpcoes]}
                              value={valorAnestesistaCaso(c)}
                              onChange={(v) => definirAnestesistaCaso(i, v)}
                              placeholder="Anestesista (defina o da sala acima)"
                              searchable
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">Ordem de liberação (rodapé)</label>
                <Button size="sm" variant="ghost" onClick={preencherRodape}>Preencher da atribuição</Button>
              </div>
              <Input placeholder="Leonardo, Marilio, Diego, …" value={ordemTexto} onChange={(e) => setOrdemTexto(e.target.value)} />
              {rodapeSuspeitos.length > 0 && (
                <p className="mt-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  ⚠ Na ordem de liberação mas SEM nenhum caso: <b>{rodapeSuspeitos.join(', ')}</b> —
                  confira a extração: as linhas desses anestesistas podem ter saído para outra pessoa
                  (foi o que sumiu com Didomenico/Melo no IOSC em 23/07).
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Ajuda de outro hospital (nomes em AZUL no rodapé)
              </label>
              <Input placeholder="ex.: Diego, Cury — vão ao fim da liberação (primeiros a sair)"
                value={ajudaTexto} onChange={(e) => setAjudaTexto(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {temBase && canEdit && (
        <div className="fixed bottom-0 inset-x-0 z-modal border-t border-border bg-card p-3 flex gap-2 max-w-3xl mx-auto">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => publicar()} disabled={publicando} className="flex-1">
            {publicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Publicar
          </Button>
        </div>
      )}

      {/* Confirmação anti-perda: substituir uma escala maior por uma menor apaga casos */}
      {substituir && (
        <ConfirmDialog
          open
          variant="danger"
          onClose={() => setSubstituir(null)}
          onConfirm={() => { setSubstituir(null); publicar(true) }}
          title="Isso vai reduzir a escala do dia?"
          description={`O dia tem ${substituir.atuais} casos e esta publicação deixaria ${substituir.novos} — ${substituir.atuais - substituir.novos} caso(s) seriam apagados e não dá para desfazer. Se você só quer acrescentar um caso, cancele e use "Adicionar caso" na aba Completa.`}
          confirmText="Substituir mesmo assim"
          cancelText="Cancelar"
        />
      )}
    </div>
  )
}
