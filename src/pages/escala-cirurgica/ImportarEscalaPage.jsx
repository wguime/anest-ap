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
import { nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import { isPermissionError } from '@/services/supabaseEscalaAnestesistaService'
import { prepararImagemParaVision } from '@/lib/imagemVision'
import cirurgiasSvc from '@/services/supabaseCirurgiasParticularesService'
import SegmentedSelector from './SegmentedSelector'
import { normNome, gruposAnestesista, chavesAnestesista, nomesImportados, aplicarAtribuicoes, detectarConflitos, normalizarSalaUnimed, normalizarSalaHro, blocoDaSalaUnimed, turnoAtual, turnoDeHora, familiaConvenio, mergeCasosPorTurno, mergeRodapeTurno, rodapeDoTurno } from './utils'
import { podeEditarEscalaCirurgica } from './gate'

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

/**
 * Campo Sala com rascunho local, comprometido no BLUR (bug 30/07): o texto da
 * sala alimenta a CHAVE do bloco de conferência — atualizar o estado global a
 * cada tecla trocava a key, o React remontava o bloco inteiro, o input saía do
 * DOM e o foco caía no body: só dava para digitar UMA letra por vez (e o bloco
 * ainda voltava fechado). A digitação fica local; o reagrupamento acontece uma
 * vez, ao sair do campo.
 */
function CampoSala({ valor, onCommit }) {
  const [rasc, setRasc] = useState(null)
  return (
    <Input
      placeholder="Sala"
      value={rasc ?? valor}
      onChange={(e) => setRasc(e.target.value)}
      onBlur={() => {
        if (rasc != null && rasc.trim() !== String(valor || '')) onCommit(rasc.trim())
        setRasc(null)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}

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

/**
 * Carimba o nome do anestesista COMO VEIO da escala (herança "//" já resolvida).
 * É a chave estável dos grupos da conferência: atribuir troca o texto da linha,
 * e sem o carimbo o grupo do colega se dissolveria no meio da conferência.
 * Campo só desta tela — o whitelist CASO_FIELDS do service não o publica.
 */
const carimbarImportado = (rows) => {
  const nomes = nomesImportados(rows)
  return rows.map((c, i) => ({ ...c, anestesistaImportado: nomes[i] }))
}
const prepararCasos = (rows, hosp) => carimbarImportado(normalizarCasosImportados(rows, hosp))

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

  const canEdit = podeEditarEscalaCirurgica(user)


  // GRUPOS DA CONFERÊNCIA (pedido do dono 27/07): sala com MAIS DE UM anestesista
  // (Exames, IOSC, Umanitá, seções de outro hospital) vira UM BLOCO POR
  // ANESTESISTA — cada um com os SEUS casos e cirurgiões — em vez de um bloco só
  // com todo mundo junto. Os índices apontam para o array plano (setCampo/
  // removeLinha seguem operando nele).
  const grupos = useMemo(() => gruposAnestesista(casos, hosp), [casos, hosp])
  const nomePorChave = useMemo(
    () => Object.fromEntries(grupos.map((g) => [g.chave, g.nome === '?' ? '' : g.nome])),
    [grupos]
  )

  // Cirurgiões de cada grupo (pedido do dono 26/07): conferir "quem opera onde" é
  // o que identifica a sala na imagem — sem isso a atribuição era às cegas.
  const cirurgioesGrupo = useMemo(() => {
    const m = {}
    for (const g of grupos) {
      const nomes = []
      for (const i of g.indices) {
        const nome = nomeCirurgiaoCurto(String(casos[i]?.cirurgiao || '').split('/')[0])
        if (nome && !nomes.includes(nome)) nomes.push(nome)
      }
      m[g.chave] = nomes
    }
    return m
  }, [grupos, casos])

  // Conferência dobrada (mobile): 29 cards planos viravam um rolo interminável.
  // Fechada por padrão — abre o bloco que precisa conferir.
  const [gruposAbertos, setGruposAbertos] = useState(() => new Set())
  /** Grupo inteiro SEM anestesista (pedido do dono 26/07) — marca os casos como "?". */
  const definirAnestesistaGrupo = (grupo, valor) => {
    const alvo = new Set(grupo.indices)
    if (valor === SEM_ANESTESISTA) {
      setAtribuicoes((p) => ({ ...p, [grupo.chave]: '' }))
      setCasos((cs) => cs.map((c, i) => (alvo.has(i)
        ? { ...c, semAnestesista: true, anestesistaManual: false, anestesistaUserId: null, anestesista: '?' }
        : c)))
      return
    }
    setAtribuicoes((p) => ({ ...p, [grupo.chave]: valor }))
    // grupo que estava todo "?" volta a ter dono: limpa o flag das linhas
    setCasos((cs) => cs.map((c, i) => (alvo.has(i) && c.semAnestesista
      ? { ...c, semAnestesista: false, anestesista: '' }
      : c)))
  }

  /** Valor do seletor do grupo: "?" quando TODOS os casos dele estão sem anestesista. */
  const valorAtribuicaoGrupo = (grupo) => {
    if (atribuicoes[grupo.chave]) return atribuicoes[grupo.chave]
    return grupo.indices.every((i) => casos[i]?.semAnestesista) ? SEM_ANESTESISTA : ''
  }

  const alternarGrupo = (chave) => setGruposAbertos((p) => {
    const n = new Set(p)
    if (n.has(chave)) n.delete(chave); else n.add(chave)
    return n
  })
  const todasAbertas = grupos.length > 0 && gruposAbertos.size === grupos.length

  // Pré-atribui pela resolução do apelido importado (dicionário), sem sobrescrever
  // escolha. Por GRUPO: no IOSC cada anestesista resolve o seu próprio login.
  useEffect(() => {
    setAtribuicoes((prev) => {
      let changed = false
      const next = { ...prev }
      for (const g of grupos) {
        if (next[g.chave] !== undefined || !g.nome || g.nome === '?') continue
        const uid = resolver(g.nome)
        if (uid) { next[g.chave] = uid; changed = true }
      }
      return changed ? next : prev
    })
  }, [grupos, resolver])

  // O login ESCOLHIDO no Select vence o texto importado — antes o texto vencia
  // e trocar o anestesista da sala na conferência (Janaina→Cury, 23/07)
  // publicava o display antigo ('JANAINA') com o uid novo: a Completa parecia
  // não ter mudado e a Liberações agrupava pela pessoa errada.
  const apelidoExibicao = useCallback((chave, uid) => {
    const r = rosterByUid.get(uid)
    if (r) return r.apelidos[0] || primeiroNomeUpper(r.nome)
    const txt = nomePorChave[chave]
    return txt ? normNome(txt) : ''
  }, [nomePorChave, rosterByUid])

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
        setCasos(prepararCasos(rows, hosp))
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
      // Reduz e re-codifica ANTES de enviar (bug 29/07): a imagem ia em base64 do
      // arquivo cru e o POST de 4–7 MB morria no navegador — só o preflight
      // chegava ao servidor, sem erro em lugar nenhum. Também é o que normaliza
      // HEIC do iPhone, que a Vision recusa.
      const img = await prepararImagemParaVision(file)
      const res = await svc.parseEscalaImagem({ imageBase64: img.base64, mimeType: img.mimeType, hospital: hospParam })
      setCasos(prepararCasos((res.casos || []).map((c) => ({ ...linhaVazia(), ...c })), hospParam))
      // SUBSTITUI, não "preenche se vier" (incidente 30/07): com o `if (length)`,
      // uma extração que não achou o rodapé/azul deixava no campo o valor da
      // importação ANTERIOR — outro hospital, outro dia. É o que explica a ajuda
      // idêntica em HRO e Unimed em 23, 24 e 29/07. Imagem nova manda: o que ela
      // não trouxe fica VAZIO e visível como vazio, para alguém preencher à mão.
      setOrdemTexto((res.ordemLiberacao || []).join(', '))
      setAjudaTexto((res.ajudaExterna || []).join(', '))
      // Layout de outro hospital? Sugere (o dono confirma — nunca troca sozinho).
      const det = String(res.hospitalDetectado || '')
      setSugestaoHosp(det && det !== hospParam ? { hospital: det, origem: 'vision' } : null)
      toast({ variant: 'success', title: `${res.casos?.length || 0} casos extraídos`, description: 'Confira e atribua o anestesista de cada sala.' })
    } catch (err) {
      // A falha tinha de ficar VISÍVEL e ACIONÁVEL: "Falha na extração — preencha
      // manualmente" era o mesmo texto para imagem que nem saiu do aparelho e
      // para extração que deu errado no servidor, e não dizia o que fazer.
      // ErroImagem já carrega a instrução certa para cada motivo.
      const daImagem = err?.name === 'ErroImagem'
      toast({
        variant: 'error',
        duration: 12000,
        title: daImagem ? 'A imagem não foi enviada' : 'Falha na extração',
        description: daImagem
          ? err.message
          : 'O servidor não conseguiu ler esta escala. Tente um print mais nítido, ou preencha manualmente.',
      })
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
  // Linha nova nasce com o bloco ABERTO: "+ Linha" criava o bloco "—" colapsado
  // e quem clicava "preencher manualmente" não via campo nenhum (bug 30/07).
  const addLinha = () => {
    const novos = [...casos, linhaVazia()]
    setCasos(novos)
    setGruposAbertos((p) => new Set(p).add(chavesAnestesista(novos)[novos.length - 1]))
  }
  // Sala muda a CHAVE do bloco (a linha migra de grupo no commit) — abre o bloco
  // de destino, senão os campos "somem" dentro de um bloco fechado.
  const commitSala = (i, valor) => {
    const novos = casos.map((c, k) => (k === i ? { ...c, sala: valor } : c))
    setCasos(novos)
    setGruposAbertos((p) => new Set(p).add(chavesAnestesista(novos)[i]))
  }
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
   * Sem escolha própria, mostra o RESPONSÁVEL do grupo (pedido do dono 26/07):
   * "mesmo da sala" não dizia quem era, e conferir exigia subir até o cabeçalho.
   * É só exibição — o caso segue o grupo até alguém escolher outro nome aqui.
   */
  const valorAnestesistaCaso = (c, chave) => {
    if (c.semAnestesista) return SEM_ANESTESISTA
    if (c.anestesistaUserId) return c.anestesistaUserId
    return atribuicoes[chave] || ''
  }

  const preencherRodape = () => {
    const nomes = grupos.map((g) => apelidoExibicao(g.chave, atribuicoes[g.chave])).filter(Boolean)
    setOrdemTexto([...new Set(nomes)].join(', '))
  }

  // Grupo 100% "?" não conta como pendência: ficar sem anestesista ali é a
  // informação da escala, não um esquecimento da atribuição (dono 26/07).
  const gruposSemAnestesista = useMemo(
    () => grupos.filter(
      (g) => !atribuicoes[g.chave] && g.indices.some((i) => !casos[i]?.semAnestesista)
    ).length,
    [grupos, atribuicoes, casos]
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

  // ── CRUZAMENTO COM AS ESCALAS JÁ PUBLICADAS (dono 30/07) ───────────────────
  //
  // "Ajuda" era derivada de UM sinal só: a COR da tinta no rodapé. Foi esse sinal
  // que falhou em 30/07 — a Vision não reconheceu o azul da Unimed e a escala
  // publicou sem ajuda nenhuma. As regras de cor CONTINUAM no prompt; isto é um
  // segundo sinal, INDEPENDENTE e estrutural: "esta pessoa está na escala de outro
  // hospital no mesmo turno e tem casos aqui". Dado contra dado, sem depender de
  // compressão de imagem nem de matiz.
  //
  // Assimétrico por natureza: o PRIMEIRO hospital publicado do dia não tem com o
  // que cruzar. Aparece no 2º e no 3º.
  const [outrasEscalas, setOutrasEscalas] = useState([])
  useEffect(() => {
    let vivo = true
    const outros = Object.keys(HOSPITAL_LABEL).filter((h) => h !== hosp)
    Promise.all(outros.map((h) => svc.fetchEscala(dataEscolhida, h).catch(() => null)))
      .then((rs) => { if (vivo) setOutrasEscalas(rs.filter(Boolean)) })
    return () => { vivo = false }
  }, [dataEscolhida, hosp])

  const cruzamento = useMemo(() => {
    if (!outrasEscalas.length || !casos.length) return { ajudaProvavel: [], conflitos: [] }
    const naAjuda = new Set(ajudaTexto.split(/[,\n]/).map((n) => normNome(n)).filter(Boolean))
    // quem tem caso AQUI, por chave de identidade (uid quando resolve, senão nome)
    const aqui = new Map()
    for (const c of casos) {
      const bruto = String(c.anestesista || '').trim()
      if (!bruto || bruto === '//' || /^\?+$/.test(bruto)) continue
      const chave = c.anestesistaUserId || resolver(bruto) || normNome(bruto)
      if (!aqui.has(chave)) aqui.set(chave, bruto)
    }
    const ajudaProvavel = []
    const conflitos = []
    for (const outra of outrasEscalas) {
      const label = HOSPITAL_LABEL[outra.hospital] || outra.hospital
      // presença no RODAPÉ do outro hospital, no mesmo turno
      const noRodape = new Set()
      for (const n of rodapeDoTurno(outra.ordemLiberacao, periodo)) {
        noRodape.add(resolver(n) || normNome(n))
      }
      // presença com CASOS no outro hospital, no mesmo turno
      const comCasos = new Map()
      for (const c of outra.casos || []) {
        if ((c.turno || periodo) !== periodo) continue
        const bruto = String(c.anestesista || '').trim()
        if (!bruto || bruto === '//') continue
        const chave = c.anestesistaUserId || resolver(bruto) || normNome(bruto)
        comCasos.set(chave, (comCasos.get(chave) || 0) + 1)
      }
      for (const [chave, nome] of aqui) {
        if (naAjuda.has(normNome(nome))) continue // já marcado, nada a sugerir
        if (comCasos.has(chave)) conflitos.push({ nome, hospital: label, casos: comCasos.get(chave) })
        else if (noRodape.has(chave)) ajudaProvavel.push({ nome, hospital: label })
      }
    }
    return { ajudaProvavel, conflitos }
  }, [outrasEscalas, casos, ajudaTexto, periodo, resolver])

  // GUARDRAIL INVERSO (incidente 30/07): anestesista COM CASO que não está no
  // rodapé nem na ajuda. Sem posição na ordem, `gerarColunaLiberacao` o joga como
  // linha EXTRA no fim da fila — e ele parece "não estar na escala". Foi o que
  // aconteceu com a CRISTINA nos Exames da Unimed: 2 casos, fora do rodapé, fora
  // da ajuda, nenhum aviso. O guardrail que existia só olhava o sentido oposto
  // (nome do rodapé sem caso), então este passava calado.
  //
  // Quase sempre é um dos dois: nome AZUL que a Vision não reconheceu como azul
  // (falta marcar como ajuda) ou nome que caiu do rodapé na leitura. Avisa e
  // aponta as duas saídas — não bloqueia, porque escala precisa publicar.
  const casosForaDoRodape = useMemo(() => {
    const naOrdem = ordemTexto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    const naAjuda = ajudaTexto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    if (!naOrdem.length) return [] // sem rodapé não há como validar
    // compara por UID quando resolve (vínculo) e por nome normalizado quando não
    const uidsRodape = new Set([...naOrdem, ...naAjuda].map((n) => resolver(n)).filter(Boolean))
    const nomesRodape = new Set([...naOrdem, ...naAjuda].map((n) => normNome(n)).filter(Boolean))
    // quem o CRUZAMENTO já explica não repete aqui: dois avisos com o mesmo botão
    // para a mesma pessoa é ruído, e a mensagem do cruzamento é mais específica
    // (diz em qual hospital a pessoa está).
    const jaExplicados = new Set([
      ...cruzamento.ajudaProvavel.map((a) => normNome(a.nome)),
      ...cruzamento.conflitos.map((c) => normNome(c.nome)),
    ])
    const fora = new Map() // nome exibido -> nº de casos
    for (const c of casos) {
      const bruto = String(c.anestesista || '').trim()
      if (!bruto || bruto === '//' || /^\?+$/.test(bruto)) continue
      const n = normNome(bruto)
      const uid = c.anestesistaUserId || resolver(bruto)
      if ((uid && uidsRodape.has(uid)) || nomesRodape.has(n)) continue
      if (jaExplicados.has(n)) continue
      fora.set(bruto, (fora.get(bruto) || 0) + 1)
    }
    return [...fora.entries()].map(([nome, n]) => ({ nome, casos: n }))
  }, [ordemTexto, ajudaTexto, casos, resolver, cruzamento])

  // ── Publicação ───────────────────────────────────────────────────────────────
  // GUARDRAIL ANTI-PERDA (incidente 23/07: publicar/importar com 1 caso APAGOU os
  // 31 da escala — publicar é DELETE+reinsert). Se a escala já publicada tem MAIS
  // casos do que os desta tela, confirma antes de substituir (perda irreversível).
  const [substituir, setSubstituir] = useState(null) // { atuais, novos }
  const publicar = async (confirmado = false) => {
    setPublicando(true)
    try {
      const userId = user?.uid || user?.id
      // Turno EXPLÍCITO no caso. A HORA decide quando existe — o mapa do Materno
      // vem com manhã e tarde no mesmo anexo, e carimbar tudo com o turno
      // publicado jogava a cirurgia das 14:30 para a lista da manhã (dono 27/07).
      // Sem hora (SRPA/Exames), vale o turno publicado — que é o que impede o
      // bloco da manhã de vazar para a tarde (bug 26/07).
      const casosNovos = aplicarAtribuicoes(casos, atribuicoes, apelidoExibicao, resolver)
        .map((c) => ({ ...c, turno: turnoDeHora(c.hora) || periodo }))
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
      // O erro aqui NÃO pode ser engolido (bug de 29/07): a RLS deixa cada um
      // vincular só o PRÓPRIO login, então vincular um colega toma 42501. Sem o
      // vínculo, o rodapé fica com o texto importado e o caso vai com o uid
      // escolhido — as duas metades caem em identidades diferentes e a pessoa
      // aparece como linha EXTRA no fim da fila enquanto a linha do rodapé fica
      // vazia. Para quem usa, é exatamente "a conferência não sincronizou".
      const semVinculo = []
      await Promise.all(grupos.map(async (g) => {
        const uid = atribuicoes[g.chave]
        const txt = g.nome === '?' ? '' : g.nome
        if (uid && txt && resolver(txt) == null) {
          try {
            await upsertAlias({ apelido: txt, userId: uid, createdBy: userId })
          } catch (err) {
            semVinculo.push({ nome: txt, permissao: isPermissionError(err) })
          }
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

      toast({ variant: 'success', title: 'Escala publicada', description: 'Disponível para toda a equipe em tempo real.' })

      // Aviso SEPARADO e depois do sucesso: a escala FOI publicada, e esconder
      // isso faria o usuário republicar à toa. Duração longa — é instrução, não
      // confirmação, e quem está no centro cirúrgico não volta para reler.
      if (semVinculo.length) {
        const nomes = semVinculo.map((v) => titleCaseNome(v.nome)).join(', ')
        const soPermissao = semVinculo.every((v) => v.permissao)
        toast({
          variant: 'warning',
          duration: 15000,
          title: `Escala publicada, mas ${semVinculo.length === 1 ? 'um nome ficou' : `${semVinculo.length} nomes ficaram`} sem vínculo`,
          description: soPermissao
            ? `${nomes}: você só pode vincular o seu próprio login. Peça à secretaria ou a um admin para vincular pelo 🔗 — até lá esse nome aparece duas vezes na fila (uma no rodapé, sem casos, e uma no fim da lista).`
            : `${nomes}: não foi possível salvar o vínculo. Tente de novo pelo 🔗 — até lá esse nome aparece duas vezes na fila.`,
        })
      }
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
            {/* CONFERÊNCIA POR ANESTESISTA (redesenho 26/07, split 27/07): a lista
                plana de N cards era impraticável no celular e ficava longe da
                atribuição, que vivia noutra seção. Agora cada bloco é dobrado,
                traz o que identifica a sala na imagem — cirurgiões — e o seletor
                do anestesista ali mesmo. Sala com VÁRIOS anestesistas (Exames,
                IOSC, seções de outro hospital) rende um bloco por anestesista:
                agrupar todo mundo numa sala só foi o que achatou o IOSC em 23/07. */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Conferir {grupos.length} bloco{grupos.length === 1 ? '' : 's'} · {casos.length} caso{casos.length === 1 ? '' : 's'}
              </h2>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost"
                  onClick={() => setGruposAbertos(todasAbertas ? new Set() : new Set(grupos.map((g) => g.chave)))}
                  aria-label={todasAbertas ? 'Recolher todos os blocos' : 'Expandir todos os blocos'}>
                  {todasAbertas ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={addLinha}><Plus className="w-4 h-4" /> Linha</Button>
              </div>
            </div>
            {gruposSemAnestesista > 0 && (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                {gruposSemAnestesista} bloco(s) ainda sem anestesista atribuído.
              </p>
            )}

            <div className="space-y-2">
              {grupos.map((g) => {
                const { chave, sala, indices } = g
                const itens = indices.map((i) => ({ c: casos[i], i })).filter(({ c }) => c)
                const aberta = gruposAbertos.has(chave)
                const cirurgioes = cirurgioesGrupo[chave] || []
                const semAnest = !atribuicoes[chave] && itens.some(({ c }) => !c.semAnestesista)
                const importado = g.nome && g.nome !== '?' ? g.nome : ''
                return (
                  <div key={chave} className={['rounded-xl border bg-card', semAnest ? 'border-warning/50' : 'border-border'].join(' ')}>
                    {/* cabeçalho: identifica o bloco (sala · anestesista importado)
                        pelos cirurgiões e abre os casos */}
                    <button type="button" onClick={() => alternarGrupo(chave)}
                      aria-expanded={aberta}
                      className="flex w-full items-center gap-2 p-3 text-left">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" title={sala}>
                          {sala}
                          {g.split && (
                            <span className="ml-1.5 font-medium text-primary">· {importado || 'sem anestesista'}</span>
                          )}
                        </p>
                        {cirurgioes.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground" title={cirurgioes.join(', ')}>
                            {cirurgioes.slice(0, 3).join(', ')}{cirurgioes.length > 3 ? ` +${cirurgioes.length - 3}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{itens.length} caso{itens.length > 1 ? 's' : ''}</span>
                      <ChevronDown className={['w-4 h-4 shrink-0 text-muted-foreground transition-transform', aberta && 'rotate-180'].filter(Boolean).join(' ')} />
                    </button>

                    {/* atribuição do bloco — SEMPRE visível (não exige abrir) */}
                    <div className="border-t border-border px-3 py-2">
                      <Select
                        options={[{ value: SEM_ANESTESISTA, label: 'Sem anestesista (?)' }, ...rosterOpcoes]}
                        value={valorAtribuicaoGrupo(g)}
                        onChange={(v) => definirAnestesistaGrupo(g, v)}
                        placeholder={importado ? `Importado: ${importado}` : 'Selecionar anestesista…'}
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
                              <CampoSala valor={c.sala} onCommit={(v) => commitSala(i, v)} />
                              <Input placeholder="Hora" value={c.hora} onChange={(e) => setCampo(i, 'hora', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Input placeholder="Cirurgião" value={c.cirurgiao} onChange={(e) => setCampo(i, 'cirurgiao', e.target.value)} />
                              <Input placeholder="Paciente (iniciais)" value={c.pacienteIniciais} onChange={(e) => setCampo(i, 'pacienteIniciais', e.target.value)} />
                            </div>
                            <Input placeholder="Procedimento" value={c.procedimento} onChange={(e) => setCampo(i, 'procedimento', e.target.value)} />
                            {/* anestesista DESTE caso: fura a atribuição do bloco
                                e é como se corrige um "?" */}
                            <Select
                              className="w-full"
                              options={[{ value: SEM_ANESTESISTA, label: 'Sem anestesista (?)' }, ...rosterOpcoes]}
                              value={valorAnestesistaCaso(c, chave)}
                              onChange={(v) => definirAnestesistaCaso(i, v)}
                              placeholder="Anestesista (defina o do bloco acima)"
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
              {/* CRUZAMENTO COM AS OUTRAS ESCALAS DO DIA (dono 30/07): sinal
                  ESTRUTURAL de ajuda, independente da cor da tinta — que é o que
                  falhou em 30/07. As regras de cor seguem no prompt da Vision;
                  isto confirma ou supre. Advisory, nunca bloqueia. */}
              {cruzamento.ajudaProvavel.length > 0 && (
                <div className="mt-1.5 rounded-lg bg-info/10 px-3 py-2 text-xs text-info">
                  <p>
                    Já publicado em outro hospital hoje, no mesmo turno:{' '}
                    <b>{cruzamento.ajudaProvavel.map((a) => `${titleCaseNome(a.nome)} (${a.hospital})`).join(', ')}</b>.
                    Está no rodapé de lá e tem caso aqui — provavelmente é ajuda.
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {cruzamento.ajudaProvavel.map((a) => (
                      <Button key={a.nome} size="sm" variant="outline"
                        onClick={() => setAjudaTexto((t) => [...t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean), a.nome].join(', '))}>
                        + {titleCaseNome(a.nome)} como ajuda
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {cruzamento.conflitos.length > 0 && (
                <p className="mt-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  ⚠ Com casos nos DOIS hospitais no mesmo turno:{' '}
                  <b>{cruzamento.conflitos.map((c) => `${titleCaseNome(c.nome)} (${c.hospital}: ${c.casos})`).join(', ')}</b>.
                  Pode ser intencional — nome em AMARELO na escala significa escalado em dois locais de
                  propósito. Confira antes de publicar.
                </p>
              )}
              {/* GUARDRAIL INVERSO (incidente 30/07 — Cristina nos Exames da
                  Unimed): quem tem caso e não está no rodapé cai como linha extra
                  no fim da fila e parece não estar na escala. Fica ao lado do campo
                  de AJUDA porque a causa mais comum é justamente nome azul que a
                  Vision não leu como azul. Um toque põe o nome na ajuda. */}
              {casosForaDoRodape.length > 0 && (
                <div className="mt-1.5 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  <p>
                    ⚠ Tem caso mas NÃO está na ordem de liberação nem na ajuda:{' '}
                    <b>{casosForaDoRodape.map((f) => `${titleCaseNome(f.nome)} (${f.casos})`).join(', ')}</b>.
                    Sem posição, essa pessoa entra como linha extra no fim da fila. Se o nome estava em
                    AZUL, marque como ajuda; se caiu do rodapé na leitura, acrescente na ordem acima.
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {casosForaDoRodape.map((f) => (
                      <Button key={f.nome} size="sm" variant="outline"
                        onClick={() => setAjudaTexto((t) => [...t.split(/[,\n]/).map((s) => s.trim()).filter(Boolean), f.nome].join(', '))}>
                        + {titleCaseNome(f.nome)} como ajuda
                      </Button>
                    ))}
                  </div>
                </div>
              )}
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
