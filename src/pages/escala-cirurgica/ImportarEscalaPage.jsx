/**
 * ImportarEscalaPage — confecção da escala pela secretária.
 * Fonte: Excel (Unimed) · Imagem/Vision (HRO/Materno) · Manual → base cirúrgica SEM
 * anestesista. A secretária ATRIBUI o anestesista de cada sala selecionando do roster
 * (login), o que resolve a identidade na origem (sem match por nome). Ao atribuir, o
 * apelido importado é aprendido no dicionário (apelido→login) p/ a próxima escala.
 */
import { useState, useMemo, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronLeft, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Pencil, Plus, Trash2, Sparkles, Loader2, Check, AlertTriangle, UserPlus } from 'lucide-react'
import { Button, ConfirmDialog, DatePicker, FileUpload, Input, Select, Sheet, SheetContent, SheetHeader, SheetTitle, useToast } from '@/design-system'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { useEscalaCirurgicaActions, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { parseExcelEscala } from '@/lib/excelEscala'
import { nomeCirurgiaoCurto, separarListaRodape, titleCaseNome } from '@/lib/colunaLiberacao'
import { aplicarHoraPadraoPosicoes, detectarItensDuplicados, ehPosicaoAssistencial, resumirItensEscala } from '@/lib/escalaCirurgicaItens'
import { ERRO_IA, classificarFalhaVision, mensagemFalhaVision } from '@/lib/escalaVisionFalha'
import { ehApelidoDePessoa, isPermissionError } from '@/services/supabaseEscalaAnestesistaService'
import { prepararImagemParaVision } from '@/lib/imagemVision'
import { iniciaisSeguras } from '@/lib/escalaCirurgicaPaciente'
import cirurgiasSvc from '@/services/supabaseCirurgiasParticularesService'
import SegmentedSelector from './SegmentedSelector'
import { linhaVazia, prepararCasosImportados as prepararCasos, normNome, candidatosPrimeiroNome, resumirRodape, casosQuePassamParaOTurno, presencaDoTurno, estaPresente, gruposAnestesista, chavesAnestesista, aplicarAtribuicoes, preAtribuicoesDoDicionario, azuisEmprestados, detectarConflitos, lerOverrideAnterior, paresDeclarados, planoExecucaoDeclarada, turnoAtual, familiaConvenio, mergeCasosPorTurno, mergeRodapeTurno, rodapeDoTurno, selecionarCasosDoTurno, turnoDeHora, formatData, salasDoHospital } from './utils'
import { mensagemErroPublicacao } from '@/lib/escalaPublicacaoErro'
import { podeEditarEscalaCirurgica } from './gate'
import { planoCruzamentoUrgencias, salasContrato } from '@/lib/escalaCirurgicaUrgencias'
import { hospitalPelaEstrutura } from '@/lib/escalaHospitalEstrutura'
import { ehDataFilaUnica, ehFeriado } from '@/lib/escalaFds'
import { ehHoraSequencialEscala } from '@/lib/escalaCirurgicaRegras'
import { detectarDuplicidadesEscala, formatarOcorrenciaDuplicidade, sugerirParceiroTroca } from '@/lib/escalaCirurgicaDuplicidades'

const HOSPITAL_OPCOES = Object.entries(HOSPITAL_LABEL).map(([value, label]) => ({ value, label }))
const PERIODO_OPCOES = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
]
const dataToISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Valida as horas do lote antes da publicação. Horas inválidas nunca podem
 * passar silenciosamente para a escala; horas válidas de outro turno são
 * mantidas no lote para o usuário ser avisado (o filtro de publicação já as
 * exclui do turno selecionado). Itens sem hora são esperados para SRPA/apoio e
 * pertencem ao turno escolhido.
 */
export const validarHorarioImportacao = (itens, periodo) => {
  const invalidos = []
  const incompatíveis = []
  let semHora = 0
  for (const item of itens || []) {
    const hora = String(item?.hora || '').trim()
    if (!hora) { semHora += 1; continue }
    if (ehHoraSequencialEscala(hora)) { semHora += 1; continue }
    const turnoHora = turnoDeHora(hora)
    if (!turnoHora) { invalidos.push(item); continue }
    if (turnoHora !== periodo) incompatíveis.push({ ...item, turnoHora })
  }
  return { invalidos, incompatíveis, semHora }
}

/**
 * Campo Sala — ESCOLHA entre as salas DAQUELE hospital, com saída para digitar
 * (dono 27/08: "quero que seja possível apenas selecionar a sala referente
 * àquele hospital e com a opção de digitar caso não haja nenhuma").
 *
 * Era um Input com `datalist`: no iPhone o datalist praticamente não abre, então
 * na prática a sala era sempre digitada — e é assim que "BLOCO M", "Bloco M" e
 * "bloco m" viram três blocos diferentes na mesma conferência. Agora a lista
 * manda; "Outra sala…" abre o campo livre para o que não estiver nela.
 *
 * O campo livre mantém o rascunho local comprometido no BLUR (bug 30/07): o
 * texto da sala alimenta a CHAVE do bloco — atualizar o estado global a cada
 * tecla trocava a key, o React remontava o bloco e o foco caía no body.
 */
const SALA_LIVRE = '__outra__'
function CampoSala({ valor, onCommit, opcoes = [] }) {
  const atual = String(valor || '')
  const naLista = opcoes.some((o) => o === atual)
  // sala que veio da leitura e não está na lista abre JÁ no campo livre — senão
  // o Select mostraria vazio e a sala lida sumiria da tela
  const [livre, setLivre] = useState(!!atual && !naLista)
  const [rasc, setRasc] = useState(null)

  if (livre) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus={!atual}
          placeholder="Digite a sala"
          value={rasc ?? atual}
          onChange={(e) => setRasc(e.target.value)}
          onBlur={() => {
            if (rasc != null && rasc.trim() !== atual) onCommit(rasc.trim())
            setRasc(null)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <button
          type="button"
          onClick={() => { setRasc(null); setLivre(false) }}
          aria-label="Escolher da lista de salas"
          className="shrink-0 rounded-lg px-2 py-2 text-xs font-semibold text-primary"
        >
          Lista
        </button>
      </div>
    )
  }
  return (
    <Select
      options={[...opcoes.map((o) => ({ value: o, label: o })), { value: SALA_LIVRE, label: 'Outra sala…' }]}
      value={naLista ? atual : ''}
      placeholder="Escolher a sala…"
      searchable
      className="w-full"
      onChange={(v) => {
        if (v === SALA_LIVRE) { setLivre(true); return }
        onCommit(v)
      }}
    />
  )
}

const primeiroNomeUpper = (nome) => normNome(String(nome || '').split(/\s+/)[0] || '')

/**
 * Linha de DECISÃO DO DIA dentro do cartão da fila (dono 31/08, modelo B).
 * Corpo tocável abre a folha; "Refazer" é botão irmão (nunca aninhado).
 * `ponto` troca o ícone pelo ponto âmbar — o mesmo da posição na fila.
 */
function LinhaDecisao({ tom = 'am', icone = null, ponto = false, titulo, sub, onClick, onRefazer }) {
  const iconeCls = tom === 'az' ? 'bg-info/15 text-info' : tom === 'vd' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
  const Corpo = onClick ? 'button' : 'div'
  return (
    <div className="flex items-center gap-1 border-t border-border/70">
      <Corpo
        {...(onClick ? { type: 'button', onClick } : {})}
        className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${iconeCls}`}>
          {ponto ? <span className="h-[9px] w-[9px] rounded-full bg-warning" aria-hidden="true" /> : icone}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-foreground">{titulo}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">{sub}</span>
        </span>
        {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </Corpo>
      {onRefazer && (
        <button
          type="button"
          onClick={onRefazer}
          className="mr-1.5 shrink-0 rounded-lg px-2 py-2.5 text-xs font-semibold text-primary"
        >
          Refazer
        </button>
      )}
    </div>
  )
}

// Sentinela do seletor por caso: deixar a linha SEM anestesista de propósito
// ("?" da escala). Valor impossível como uid.
const SEM_ANESTESISTA = '__sem__'

/**
 * MODO LOTE (dono 2026-08-27) — "adicionar todos os arquivos e após fazer a
 * conferência", como no fim de semana, com UMA ABA por hospital.
 *
 * A conferência não foi refatorada: `ImportarEscalasPage` monta uma instância
 * DESTA página por hospital anexado e esconde as inativas (`oculta`), de modo
 * que cada aba guarda o seu próprio estado — casos, atribuições, rodapé, ajuda,
 * decisões de duplicidade — exatamente como quando era uma escala por vez.
 * O que sobe para o pai no modo `embutida`: header, cartão de data/período (que
 * são do LOTE — o dono segue anexando um turno por vez), anexo e barra de
 * publicar. O que desce: `dataLote`/`periodoLote`, o `loteInicial` já lido e as
 * `escalasIrmas` (as outras abas), que entram no cruzamento entre hospitais.
 */
const ImportarEscalaPage = forwardRef(function ImportarEscalaPage({
  hospital, data, turno: turnoInicial, onClose, onAbrirFds,
  embutida = false, oculta = false, loteInicial = null,
  dataLote, periodoLote, escalasIrmas = [], onResumo,
  decisoesLote = null, onDecisoesLote = null, trocasLote = null, onTrocasLote = null,
}, ref) {
  const { toast } = useToast()
  const { salvarEscalaTurno, salvarEscala, executarSubstituicao } = useEscalaCirurgicaActions()
  // Compatibilidade com fixtures/testes e integrações antigas; em produção o
  // provider sempre expõe a publicação transacional por turno.
  const publicarEscala = salvarEscalaTurno || salvarEscala
  const { user } = useUser()
  const { roster, options: rosterOpcoes, rosterByUid, resolver, upsertAlias } = useRosterAnestesistas()

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
  // Herda o contexto da tela anterior, inclusive quando o relógio local já
  // virou para a tarde (ex.: usuário abriu a importação matutina às 13h10).
  // O seletor continua editável manualmente.
  const [periodo, setPeriodo] = useState(() => (
    turnoInicial === 'matutino' || turnoInicial === 'vespertino' ? turnoInicial : turnoAtual()
  ))
  // Sugestão de hospital pelo layout do anexo (Vision/Excel) — confirmar, nunca trocar sozinho.
  const [sugestaoHosp, setSugestaoHosp] = useState(null) // { hospital, origem: 'vision'|'excel' }
  const [sugestaoData, setSugestaoData] = useState(null)
  const [ultimoArquivo, setUltimoArquivo] = useState(null) // p/ reler a imagem com o hint certo
  // Guarda o lote completo para trocar Manhã↔Tarde sem chamar a Vision de novo.
  const [loteAnexo, setLoteAnexo] = useState(null)
  const [ignoradosOutroTurno, setIgnoradosOutroTurno] = useState(0)

  const canEdit = podeEditarEscalaCirurgica(user)


  // GRUPOS DA CONFERÊNCIA (pedido do dono 27/07): sala com MAIS DE UM anestesista
  // (Exames, IOSC, Umanitá, seções de outro hospital) vira UM BLOCO POR
  // ANESTESISTA — cada um com os SEUS casos e cirurgiões — em vez de um bloco só
  // com todo mundo junto. Os índices apontam para o array plano (setCampo/
  // removeLinha seguem operando nele).
  const grupos = useMemo(() => gruposAnestesista(casos, hosp), [casos, hosp])
  // A lista é a ordem operacional do hospital: salas já usadas primeiro,
  // depois locais válidos do cadastro. O input continua aceitando uma sala
  // nova, mas a seleção evita que "BLOCO M", "IOSC" e "HO" virem grafias
  // diferentes e criem blocos separados por acidente.
  const salasDisponiveis = useMemo(() => salasDoHospital(hosp, casos), [hosp, casos])
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

  const aplicarPeriodoAoLote = (lote, turno = periodo) => {
    const selecionados = selecionarCasosDoTurno(lote, turno)
    setCasos(selecionados)
    setIgnoradosOutroTurno(Math.max(0, lote.length - selecionados.length))
    setAtribuicoes({})
    setGruposAbertos(new Set())
    setCasoEmEdicao(null)
    setDecisaoAberta(null)
    return selecionados
  }

  const carregarLoteImportado = (rows, hospParam, posicoes = []) => {
    // Itens sem hora pertencem ao período selecionado NO MOMENTO DO UPLOAD.
    // Depois disso, alternar manhã/tarde só filtra; não move SRPA entre turnos.
    // A SRPA da Unimed entra às 09:00 e o mapa nunca escreve esse horário — o
    // carimbo entra ANTES do turno para que hora e turno concordem, e entra AQUI
    // (não na publicação) porque a conferência é onde se corrige o que veio
    // torto: o 09:00 aparece na linha, editável como qualquer outro campo.
    const lote = aplicarHoraPadraoPosicoes(prepararCasos(rows, hospParam, posicoes), hospParam, periodo)
      .map((c) => ({
        ...c,
        turno: turnoDeHora(c.hora) || periodo,
      }))
    setLoteAnexo(lote)
    return { lote, selecionados: aplicarPeriodoAoLote(lote) }
  }

  const mudarPeriodo = (novoPeriodo, { silencioso = false } = {}) => {
    setPeriodo(novoPeriodo)
    if (!loteAnexo) return
    const selecionados = aplicarPeriodoAoLote(loteAnexo, novoPeriodo)
    // No lote quem troca o turno é o cartão do PAI, uma vez só: três instâncias
    // toastando a mesma troca viraria três avisos idênticos na mesma tela.
    if (silencioso) return
    toast({
      title: novoPeriodo === 'matutino' ? 'Turno matutino selecionado' : 'Turno vespertino selecionado',
      description: `${resumoTexto(selecionados)} do anexo. As atribuições manuais foram reiniciadas para conferência.`,
    })
  }

  // ── SINCRONIA COM O LOTE (modo embutido) ─────────────────────────────────
  // Data e período são do LOTE, não da aba: o dono anexa um turno por vez e as
  // três escalas do dia são do mesmo dia e do mesmo turno. Trocar o turno no
  // cartão refiltra as três abas pela HORA de cada caso, que é a regra de
  // sempre — sem toast, porque o aviso é do cartão que fez a troca.
  useEffect(() => {
    if (!embutida || !dataLote || dataLote === dataEscolhida) return
    setDataEscolhida(dataLote)
  }, [embutida, dataLote, dataEscolhida])
  useEffect(() => {
    if (!embutida || !periodoLote || periodoLote === periodo) return
    mudarPeriodo(periodoLote, { silencioso: true })
    // mudarPeriodo é recriado a cada render; a dependência é o período do pai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embutida, periodoLote])

  // O lote desta aba já foi LIDO pelo pai (uma leitura por arquivo, no anexo em
  // lote). Aqui ele só entra na conferência — a página não relê nada. A
  // referência do objeto muda quando o mesmo hospital é reanexado: a foto nova
  // manda, como sempre (incidente 30/07 — ordem/ajuda SUBSTITUEM, não completam).
  useEffect(() => {
    if (!loteInicial) return
    carregarLoteImportado(loteInicial.rows || [], hosp, loteInicial.posicoes || [])
    setOrdemTexto((loteInicial.ordemLiberacao || []).join(', '))
    setAjudaTexto((loteInicial.ajudaExterna || []).join(', '))
    setAzuisDaLeitura(loteInicial.ajudaExterna || [])
    setAzuisRealocados([])
    setPosSel(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteInicial])

  // Pré-atribui pela resolução do apelido importado (dicionário), sem sobrescrever
  // escolha. Por GRUPO: no IOSC cada anestesista resolve o seu próprio login.
  useEffect(() => {
    setAtribuicoes((prev) => preAtribuicoesDoDicionario(grupos, prev, resolver))
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
    setSugestaoData(null)
    if (/\.(xlsx?|csv)$/i.test(file.name || '')) {
      // a sugestão sai do CABEÇALHO da planilha, dentro de importarExcel — a
      // suposição de extensão ("planilha = Unimed") ficou como último recurso
      return importarExcel(file)
    }
    if (String(file.type || '').startsWith('image/')) return importarImagem(file)
    toast({ variant: 'error', title: 'Formato não suportado', description: 'Envie Excel (.xlsx/.xls/.csv) ou uma imagem da escala.' })
  }

  const importarExcel = async (file) => {
    if (!file) return
    setCarregando(true)
    try {
      const { casos: rows, headerScore, headers } = await parseExcelEscala(file)
      if (!rows.length) {
        toast({ variant: 'error', title: 'Não consegui ler a planilha', description: 'Confira o arquivo ou use entrada manual.' })
        setCasos([linhaVazia()])
      } else {
        // A PLANILHA SE DECLARA PELO CABEÇALHO (auditoria 31/08): o lote ganhou
        // isso em 30/08 — LEITO é do mapa do HRO; IDADE/TEMPO, do export da
        // Unimed — e este fluxo seguia com "planilha = Unimed" por extensão:
        // recebendo o xlsx do HRO com o HRO já escolhido, a tela sugeria "Usar
        // Unimed". Sem marca nenhuma, vale o fallback de sempre (Unimed).
        const estr = hospitalPelaEstrutura({ casos: rows, headers })
        const palpite = estr.hospital || 'unimed'
        setSugestaoHosp(palpite !== hosp
          ? { hospital: palpite, origem: estr.hospital ? 'estrutura' : 'excel' }
          : null)
        const { selecionados, lote } = carregarLoteImportado(rows, hosp)
        const fora = lote.length - selecionados.length
        toast({ variant: 'success', title: `${resumoTexto(selecionados)} do turno`, description: `${fora ? `${fora} item(ns) do outro turno ficaram fora. ` : ''}Atribua o anestesista de cada sala. (colunas reconhecidas: ${headerScore})` })
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
      // Extração cortada no meio (escala longa demais para uma resposta só): o
      // servidor devolve 200 com o motivo em vez de estourar. Sem este ramo a
      // tela publicava a escala faltando as últimas linhas, sem avisar ninguém.
      // A IA não leu a imagem por CONTA/CHAVE/sobrecarga: cada motivo tem uma
      // saída diferente, e mandar "tente de novo" para todos foi o que fez a
      // foto ser reenviada oito vezes em 18/08 com a chave sem crédito.
      if (res?.error === ERRO_IA) {
        toast({
          variant: 'error',
          duration: 12000,
          ...mensagemFalhaVision(
            classificarFalhaVision({ status: res.iaStatus, tipo: res.iaTipo, mensagem: res.iaMensagem }),
            'importe a planilha ou preencha à mão',
          ),
        })
        if (!casos.length) setCasos([linhaVazia()])
        return
      }
      if (res?.error === 'extracao_truncada' || res?.error === 'json_invalido') {
        toast({
          variant: 'error',
          duration: 12000,
          title: 'A escala não coube em uma leitura',
          description: 'Envie em duas partes (um print da metade de cima e outro da de baixo), ou preencha manualmente.',
        })
        if (!casos.length) setCasos([linhaVazia()])
        return
      }
      const { selecionados, lote } = carregarLoteImportado(
        (res.casos || []).map((c) => ({ ...linhaVazia(), ...c })),
        hospParam,
        res.posicoesAssistenciais || [],
      )
      // SUBSTITUI, não "preenche se vier" (incidente 30/07): com o `if (length)`,
      // uma extração que não achou o rodapé/azul deixava no campo o valor da
      // importação ANTERIOR — outro hospital, outro dia. É o que explica a ajuda
      // idêntica em HRO e Unimed em 23, 24 e 29/07. Imagem nova manda: o que ela
      // não trouxe fica VAZIO e visível como vazio, para alguém preencher à mão.
      setOrdemTexto((res.ordemLiberacao || []).join(', '))
      setAjudaTexto((res.ajudaExterna || []).join(', '))
      // azuis DA LEITURA ficam elegíveis à realocação de emprestado (01/09);
      // marca feita à mão nunca entra aqui — e nunca é tocada
      setAzuisDaLeitura(res.ajudaExterna || [])
      setAzuisRealocados([])
      setPosSel(null)   // rodapé novo: nenhuma posição em edição
      // Layout de outro hospital? Sugere (o dono confirma — nunca troca sozinho).
      const det = String(res.hospitalDetectado || '')
      setSugestaoHosp(det && det !== hospParam ? { hospital: det, origem: 'vision' } : null)
      const dataDet = String(res.dataDetectada || '')
      setSugestaoData(/^\d{4}-\d{2}-\d{2}$/.test(dataDet) && dataDet !== dataEscolhida ? dataDet : null)
      const fora = lote.length - selecionados.length
      toast({
        variant: res?.truncado ? 'warning' : 'success',
        duration: res?.truncado ? 12000 : undefined,
        title: res?.truncado ? 'Leitura incompleta — confira o fim da lista' : `${resumoTexto(selecionados)} do turno`,
        description: res?.truncado
          ? `Vieram ${resumoTexto(selecionados)}, mas a leitura foi cortada: as últimas linhas do mapa podem estar faltando.`
          : `${fora ? `${fora} item(ns) do outro turno ficaram fora. ` : ''}Confira e atribua o anestesista de cada sala.`,
      })
    } catch (err) {
      // A falha tinha de ficar VISÍVEL e ACIONÁVEL: "Falha na extração — preencha
      // manualmente" era o mesmo texto para imagem que nem saiu do aparelho e
      // para extração que deu errado no servidor, e não dizia o que fazer.
      // ErroImagem já carrega a instrução certa para cada motivo.
      const daImagem = err?.name === 'ErroImagem'
      toast({
        variant: 'error',
        duration: 12000,
        // NÃO culpar a nitidez (incidente 06/08): quando o erro não é do envio,
        // a imagem já chegou ao servidor — mandar um print melhor não resolve.
        // O texto sem diagnóstico é o mesmo da lib, para a tela falar uma língua
        // só com o ramo que recebe o motivo da edge.
        ...(daImagem
          ? { title: 'A imagem não foi enviada', description: err.message }
          : mensagemFalhaVision(null, 'importe a planilha ou preencha à mão')),
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

  // O ANESTESISTA É PERGUNTADO UMA VEZ POR BLOCO (dono 31/08, modelo B do
  // protótipo). O Select repetido em cada caso era a mesma pergunta N vezes —
  // medido no banco: 63% dos blocos têm 1 caso e só 22% das salas têm mais de
  // um anestesista, então ele quase nunca trabalhava. A linha do caso passa a
  // LER o nome efetivo; o seletor abre só pelo lápis (mesma gravação de antes).
  const [casoEmEdicao, setCasoEmEdicao] = useState(null)
  const rotuloAnestesistaCaso = (c, chave) => {
    if (c.semAnestesista) return { nome: 'Sem anestesista (?)', origem: '' }
    if (c.anestesistaUserId) {
      return { nome: apelidoExibicao(chave, c.anestesistaUserId) || c.anestesista, origem: 'deste caso' }
    }
    const uid = atribuicoes[chave]
    if (uid) return { nome: apelidoExibicao(chave, uid), origem: 'do bloco' }
    const txt = String(c.anestesista || '').trim()
    return { nome: txt && txt !== '?' ? txt : '—', origem: 'do bloco' }
  }

  const preencherRodape = () => {
    const atuais = separarListaRodape(ordemTexto)
    const chavesAtuais = new Set(atuais.map(normNome))
    const nomes = grupos.map((g) => apelidoExibicao(g.chave, atribuicoes[g.chave])).filter(Boolean)
    // Nunca substitui o rodapé extraído: posições sem caso como
    // "MATHEUS (CONSULTORIO)" não aparecem nos grupos e seriam apagadas.
    // O botão apenas acrescenta responsáveis ausentes, preservando texto e ordem.
    const faltantes = nomes.filter((n) => {
      const chave = normNome(n)
      if (!chave || chavesAtuais.has(chave)) return false
      chavesAtuais.add(chave)
      return true
    })
    setOrdemTexto([...atuais, ...faltantes].join(', '))
  }

  // ── EDIÇÃO DO RODAPÉ PELA PRÓPRIA LISTA (dono 11/08) ───────────────────────
  //
  // O campo de texto saiu: a lista numerada é a única superfície. Editar aqui é
  // legítimo — é a transcrição da FOTO, e a conferência é o último ponto em que
  // ainda dá para consertar o que a Vision leu torto. (A ordem só é imutável
  // DEPOIS de publicada: lá, mudar = republicar.)
  //
  // `ordemTexto` continua sendo a fonte da verdade; os controles reescrevem a
  // string. Assim publicar, cruzamento e "Preencher da atribuição" seguem
  // enxergando exatamente o mesmo dado de antes.
  const [posSel, setPosSel] = useState(null)      // posição aberta para edição
  const [rascunhoNome, setRascunhoNome] = useState('')

  const gravarOrdem = (nomes) => setOrdemTexto(nomes.filter(Boolean).join(', '))
  // Vírgula é o separador da string — deixá-la passar partiria o nome em dois.
  const limparNome = (v) => String(v || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()

  const abrirPosicao = (i, nome) => {
    if (posSel === i) { setPosSel(null); return }
    setPosSel(i)
    setRascunhoNome(nome)
  }

  const moverPosicao = (i, delta) => {
    const nomes = separarListaRodape(ordemTexto)
    const j = i + delta
    if (j < 0 || j >= nomes.length) return
    ;[nomes[i], nomes[j]] = [nomes[j], nomes[i]]
    gravarOrdem(nomes)
    setPosSel(j)                                   // o painel acompanha o nome
  }

  const removerPosicao = (i) => {
    const nomes = separarListaRodape(ordemTexto)
    const [fora] = nomes.splice(i, 1)
    gravarOrdem(nomes)
    marcarAjuda(fora, false)                       // não deixa ajuda órfã
    setPosSel(null)
  }

  const renomearPosicao = () => {
    if (posSel == null) return
    const nomes = separarListaRodape(ordemTexto)
    const novo = limparNome(rascunhoNome)
    const antigo = nomes[posSel]
    if (!novo || !antigo || novo === antigo) { setRascunhoNome(antigo || ''); return }
    nomes[posSel] = novo
    gravarOrdem(nomes)
    if (ehAjuda(antigo)) { marcarAjuda(antigo, false); marcarAjuda(novo, true) }
  }

  // Acrescentar é POR LOGIN, não digitando (dono 11/08: "para evitar
  // duplicidades"). Texto livre aqui criava a mesma pessoa duas vezes — o
  // rodapé é casado por apelido, e "CURY" digitado ao lado de um caso do
  // "GUSTAVO" vira duas linhas na fila. O texto inserido é o MESMO que
  // "Preencher da atribuição" usa (apelido do dicionário), então rodapé e casos
  // caem na mesma identidade. Nome fora do cadastro ainda entra corrigindo o
  // texto de uma posição existente.
  const adicionarNoRodape = (uid) => {
    const novo = apelidoExibicao(null, uid)
    if (!novo) return
    const nomes = separarListaRodape(ordemTexto)
    if (nomes.some((n) => normNome(n) === normNome(novo) || resolver(n) === uid)) return
    gravarOrdem([...nomes, novo])
  }

  // Quem já está no rodapé sai do picker: a lista mostra só quem FALTA.
  const opcoesParaAcrescentar = useMemo(() => {
    const nomes = separarListaRodape(ordemTexto)
    const uids = new Set(nomes.map((n) => resolver(n)).filter(Boolean))
    const textos = new Set(nomes.map(normNome))
    return rosterOpcoes.filter((o) => {
      if (uids.has(o.value)) return false
      const apelido = apelidoExibicao(null, o.value)
      return !apelido || !textos.has(normNome(apelido))
    })
  }, [ordemTexto, rosterOpcoes, resolver, apelidoExibicao])

  // AJUDA é o único selo que não vem da posição — e é o que mais falha na
  // extração (30/07: a Vision não reconheceu o azul do rodapé e a escala foi ao
  // ar sem ajuda nenhuma). Fonte única: o mesmo `ajudaTexto` do campo abaixo.
  const ehAjuda = (nome) => separarListaRodape(ajudaTexto).some((n) => normNome(n) === normNome(nome))
  const marcarAjuda = (nome, ligar) => {
    const atuais = separarListaRodape(ajudaTexto)
    const fora = atuais.filter((n) => normNome(n) !== normNome(nome))
    setAjudaTexto((ligar ? [...fora, nome] : fora).join(', '))
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
    const nomes = separarListaRodape(ordemTexto)
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

  // Ordem NUMERADA para conferir contra a imagem (dono 11/08): o rodapé é lido
  // por POSIÇÃO, e num input de uma linha só davam para ver os 4 primeiros de 17.
  const ordemNumerada = useMemo(
    () => resumirRodape(separarListaRodape(ordemTexto), casos, resolver, separarListaRodape(ajudaTexto)),
    [ordemTexto, ajudaTexto, casos, resolver],
  )

  // Escala JÁ PUBLICADA deste mesmo hospital/dia — é dela que saem as cirurgias
  // da manhã marcadas "passa para tarde" (o lote em conferência não as contém).
  const [escalaPublicada, setEscalaPublicada] = useState(null)
  useEffect(() => {
    let vivo = true
    svc.fetchEscala(dataEscolhida, hosp)
      .then((r) => { if (vivo) setEscalaPublicada(r || null) })
      .catch(() => { if (vivo) setEscalaPublicada(null) })
    return () => { vivo = false }
  }, [dataEscolhida, hosp])

  // ── O QUE A PUBLICAÇÃO VAI FAZER COM QUEM ESTÁ SEM CIRURGIA (dono 24/08) ──
  // "Nenhum dos dois apareceu na tela de confirmação antes da publicação."
  // O aviso de extração acima existe desde 23/07, mas ele fala de SUSPEITA
  // ("confira a extração"); o que faltava era a CONSEQUÊNCIA — quem fecha a
  // ordem sem cirurgia nasce vermelho na fila (regra de 21/08) e, se aquilo era
  // erro de leitura, a conferência é o último lugar onde dá para consertar.
  // Mesma conta da fila: fronteira = último nome da ORDEM com trabalho; sem
  // ninguém com trabalho não existe cauda (22/08). Ajuda conta como trabalho —
  // na fila ela nunca nasce liberada.
  const caudaLiberada = useMemo(() => {
    let ultimo = -1
    for (let i = ordemNumerada.length - 1; i >= 0; i--) {
      if (ordemNumerada[i].casos > 0 || ordemNumerada[i].ajuda) { ultimo = i; break }
    }
    if (ultimo < 0) return []
    return ordemNumerada.slice(ultimo + 1).filter((p) => p.casos === 0 && !p.ajuda)
  }, [ordemNumerada])
  const nomesCauda = useMemo(() => new Set(caudaLiberada.map((p) => p.nome)), [caudaLiberada])
  // UM aviso por nome: quem está na cauda é coberto pelo aviso acima, que diz a
  // mesma coisa ("a linha dele pode ter saído para outra pessoa") E o que vai
  // acontecer. Contar duas vezes a mesma pessoa inflava o número de pendências.
  const suspeitosExtracao = useMemo(
    () => rodapeSuspeitos.filter((n) => !nomesCauda.has(n)),
    [rodapeSuspeitos, nomesCauda],
  )

  // ── CIRURGIA DA MANHÃ QUE ATRAVESSA PARA ESTE TURNO (dono 24/08) ──────────
  // A cirurgia marcada "Passa para tarde" segue valendo à tarde (22/08). Quando
  // o anestesista dela NÃO está na escala da tarde, ela fica sem dono presente:
  // em 24/08 a cirurgia das 07:00 da Gabriela passou para a tarde e ela estava
  // no HRO — a fila da Unimed inventou uma linha dela, com badge "Ajuda".
  // A fila não a cria mais (`casosDaFilaDoTurno`), mas a cirurgia continua
  // existindo e alguém precisa decidir: reatribuir a quem está na sala à tarde,
  // ou desmarcar o "passa para tarde". Isto é o aviso — nunca a decisão.
  const travessiasOrfas = useMemo(() => {
    if (periodo !== 'vespertino' || !escalaPublicada) return []
    const atravessam = casosQuePassamParaOTurno(escalaPublicada.casos || [], 'vespertino')
    if (!atravessam.length) return []
    const presentes = presencaDoTurno(separarListaRodape(ordemTexto), casos, resolver)
    return atravessam.filter((c) => !estaPresente(presentes, c, resolver))
  }, [escalaPublicada, periodo, ordemTexto, casos, resolver])

  // GUARDRAIL DE NOME AMBÍGUO (dono 11/08) — BLOQUEIA a publicação.
  // A escala veio com "JOAO" na CO - Cesárea e o rodapé tinha JOAO HENRIQUE e
  // JOAO RICARDO: o dicionário não resolve primeiro nome com dois donos (regra
  // da casa: perguntar, nunca chutar), os 3 casos ficaram órfãos numa linha
  // "Fora do rodapé" e o dono deles nasceu liberado por aparecer sem cirurgia.
  // Aqui é o único ponto onde ainda dá para pedir o sobrenome a quem tem a
  // imagem na mão — depois de publicado, só no banco.
  const gruposAmbiguos = useMemo(() => {
    if (!roster?.length) return []
    return grupos
      .filter((g) => !atribuicoes[g.chave] && !g.indices.every((i) => casos[i]?.semAnestesista))
      .map((g) => ({ grupo: g, candidatos: candidatosPrimeiroNome(g.nome, roster) }))
      .filter(({ candidatos }) => candidatos.length > 1)
  }, [grupos, atribuicoes, casos, roster])

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
  const [outrasPublicadas, setOutrasPublicadas] = useState([])
  // A DECISÃO DE DUPLICIDADE É DO LOTE, NÃO DA ABA (dono 30/08: "tive que clicar
  // a mesma informação nas 3 abas dos hospitais, mesmo já tendo informado e no
  // caso não tendo relação com o Materno"). A duplicidade é da PESSOA, e a chave
  // dela é a mesma em qualquer aba: responder uma vez responde para todas. Fora
  // do lote (tela de uma escala só) o estado continua local, como sempre foi.
  const [decisoesLocais, setDecisoesLocais] = useState({})
  const [trocaLocal, setTrocaLocal] = useState({})
  const duplicidadeDecisoes = decisoesLote || decisoesLocais
  const setDuplicidadeDecisoes = onDecisoesLote || setDecisoesLocais
  const trocaEscolhida = trocasLote || trocaLocal
  const setTrocaEscolhida = onTrocasLote || setTrocaLocal
  useEffect(() => {
    // quem manda no ciclo de vida do estado compartilhado é o lote
    if (decisoesLote) return
    setDecisoesLocais({}); setTrocaLocal({})
  }, [dataEscolhida, hosp, periodo, decisoesLote])
  useEffect(() => {
    let vivo = true
    const outros = Object.keys(HOSPITAL_LABEL).filter((h) => h !== hosp)
    Promise.all(outros.map((h) => svc.fetchEscala(dataEscolhida, h).catch(() => null)))
      .then((rs) => { if (vivo) setOutrasPublicadas(rs.filter(Boolean)) })
    return () => { vivo = false }
  }, [dataEscolhida, hosp])

  // A ABA IRMÃ VENCE O QUE ESTÁ PUBLICADO (dono 27/08). O cruzamento entre
  // hospitais nasceu assimétrico: comparando só com o que JÁ está no banco, o
  // primeiro hospital publicado do dia não tem com o que cruzar e o último
  // decide sozinho pelos dois. Com as escalas do lote na tela, a aba do HRO em
  // conferência é uma fonte tão boa quanto a escala publicada dele — e mais
  // nova. Ela entra no lugar da publicada do mesmo hospital; os hospitais que
  // não estão no lote seguem vindo do banco.
  const outrasEscalas = useMemo(() => {
    const irmas = (escalasIrmas || []).filter((e) => e?.hospital && e.hospital !== hosp)
    const cobertos = new Set(irmas.map((e) => e.hospital))
    return [...irmas, ...outrasPublicadas.filter((e) => !cobertos.has(e?.hospital))]
  }, [escalasIrmas, outrasPublicadas, hosp])

  const cruzamento = useMemo(() => {
    if (!outrasEscalas.length || !casos.length) return { ajudaProvavel: [], conflitos: [] }
    const naAjuda = new Set(separarListaRodape(ajudaTexto).map((n) => normNome(n)).filter(Boolean))
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

  const duplicidades = useMemo(() => detectarDuplicidadesEscala({
    casos,
    hospitalAtual: hosp,
    hospitalAtualLabel: HOSPITAL_LABEL[hosp] || hosp,
    ordemAtual: separarListaRodape(ordemTexto),
    periodo,
    outrasEscalas,
    // AJUDA JÁ DECLARADA no rodapé (aqui ou lá) responde a pergunta do painel
    ajudas: [
      { hospitalLabel: HOSPITAL_LABEL[hosp] || hosp, nomes: separarListaRodape(ajudaTexto) },
      ...outrasEscalas.map((o) => ({
        hospitalLabel: HOSPITAL_LABEL[o?.hospital] || o?.hospital,
        nomes: rodapeDoTurno(o?.ajudaExterna, periodo),
      })),
    ],
    resolver,
    // MESMA normalização de `linha.chave` na coluna de liberação: é a chave por
    // onde a troca declarada é gravada e reencontrada lá.
    normalizar: normNome,
    hospitalLabelFor: (hospital) => HOSPITAL_LABEL[hospital] || hospital,
  }), [casos, hosp, ordemTexto, ajudaTexto, periodo, outrasEscalas, resolver])

  // A decisão é local à conferência desta publicação. Ela nunca reescreve o
  // anestesista nem transforma uma duplicidade em ajuda automaticamente.
  // Ajuda declarada NÃO fica pendente: o rodapé já disse que a pessoa está nos
  // dois de propósito (dono 30/08 — "foi identificado como ajuda e mesmo assim
  // a escala não pôde ser publicada"). O item continua VISÍVEL no painel, como
  // informação; o que ele deixa de fazer é travar a publicação.
  const duplicidadesPendentes = duplicidades.filter((d) => !d.ajudaDeclarada && !duplicidadeDecisoes[d.key])

  // PAR PROPOSTO (Fase 2.2, dono 07/08): a leitura das DUAS escalas sugere o
  // parceiro simétrico (rodapé em A com casos em B ↔ rodapé em B com casos em
  // A) e PRÉ-PREENCHE o seletor — a secretária só confirma (ou corrige). A
  // sugestão nunca classifica sozinha: sem o toque em "Confirmar troca", nada
  // é gravado.
  useEffect(() => {
    if (!duplicidades.length) return
    const sugestoes = sugerirParceiroTroca(duplicidades)
    if (!sugestoes.size) return
    setTrocaEscolhida((atual) => {
      let mudou = false
      const prox = { ...atual }
      for (const [key, parceiroKey] of sugestoes) {
        // só chave que resolve para login vira valor de Select — e nunca por
        // cima de escolha já feita
        if (!prox[key] && rosterByUid.has(parceiroKey)) { prox[key] = parceiroKey; mudou = true }
      }
      return mudou ? prox : atual
    })
  }, [duplicidades, rosterByUid, setTrocaEscolhida])

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
    const naOrdem = separarListaRodape(ordemTexto)
    const naAjuda = separarListaRodape(ajudaTexto)
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

  // SEÇÕES DO HRO QUE COSTUMAM SUMIR NA LEITURA (dono 27/08: "várias vezes na
  // escala do HRO não está fazendo leitura dos locais: Imagem, Exames,
  // hemodinâmica"). Elas ficam fora da grade principal do mapa e a extração as
  // pula em silêncio — o que some não deixa rastro nenhum na tela. Não dá para
  // inventar o que não foi lido; dá para AVISAR que não veio nada delas, que é o
  // suficiente para conferir contra a imagem. Aviso, nunca bloqueio: tem dia sem
  // essas seções.
  const secoesAusentesHro = useMemo(() => {
    if (hosp !== 'hro' || !casos.length) return []
    const alvo = { Exames: /^EXAMES?$/, Imagem: /^IMAGEM$/, 'Hemodinâmica': /^HEMO/ }
    const presentes = new Set(casos.map((c) => normNome(c.sala)))
    return Object.entries(alvo)
      .filter(([, re]) => ![...presentes].some((s) => re.test(s)))
      .map(([nome]) => nome)
  }, [hosp, casos])
  // ⚠️ POR SEÇÃO, não "só quando faltam as três" (dono 28/08: "sempre aparece
  // descrito na escala do HRO"). Medido em produção nas 41 importações do HRO
  // dos últimos 60 dias: Exames chega em 90%, Hemodinâmica em 49% e Imagem em
  // 15% — o "nenhuma das três" pegava 3 dessas 41, enquanto a Imagem se perde em
  // 35. Se as três estão sempre no papel, faltar UMA já é leitura incompleta.

  // ── DECISÕES DO DIA (dono 31/08, modelo B escolhido em protótipo) ─────────
  //
  // As decisões operacionais — ajuda de fora, pessoa em dois hospitais, caso
  // fora da ordem — moravam no FIM da página como avisos espalhados, sem lugar
  // de preencher. Agora são LINHAS dentro do cartão da fila, porque toda
  // decisão dessas é sobre quem entra, sai ou muda de lugar NESTA fila; cada
  // linha abre uma folha com as saídas explícitas. Medido no banco (desde
  // 25/06): ajuda é semanal, duplicidade ~3/semana, alguém fora da ordem em
  // 31% dos turnos. Os dados gravados são os MESMOS de sempre (ajudaTexto,
  // duplicidadeDecisoes, ordemTexto) — a reforma é de superfície.
  const [decisaoAberta, setDecisaoAberta] = useState(null) // { tipo, key?, nome?, ... }

  // Ajuda marcada que NÃO está na ordem não aparece na lista numerada — sem
  // esta linha ela ficaria invisível e irremovível (era o Input de texto que
  // dava a remoção; ele saiu).
  const ajudasForaDaOrdem = useMemo(() => {
    const naOrdem = new Set(separarListaRodape(ordemTexto).map(normNome))
    return separarListaRodape(ajudaTexto).filter((n) => !naOrdem.has(normNome(n)))
  }, [ajudaTexto, ordemTexto])

  // "Na ordem sem cirurgia" agora tem SAÍDAS (dono 31/08: a folha só com
  // "Entendi" era um beco — "nada acontece depois de clicar, não faz sentido").
  // Quem já está marcado como AJUDA sai da lista: ajuda sem caso aqui é o
  // normal dela, não suspeita de extração.
  const conferenciasSemCirurgia = useMemo(() => {
    const daCauda = new Set(caudaLiberada.map((p) => p.nome))
    return [...suspeitosExtracao, ...caudaLiberada.map((p) => p.nome)]
      .filter((nome) => !ehAjuda(nome))
      .map((nome) => ({
        nome,
        cauda: daCauda.has(nome),
        pos: ordemNumerada.findIndex((p) => p.nome === nome) + 1,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suspeitosExtracao, caudaLiberada, ordemNumerada, ajudaTexto])

  // A "ajuda provável" do cruzamento (rodapé lá + caso aqui) é a MESMA pessoa
  // que a lib de duplicidades já pendura como pendência — duas linhas para a
  // mesma pergunta seria o defeito antigo em outra roupa. A linha fica UMA, a
  // da duplicidade (azul quando lá é só rodapé); a sugestão do cruzamento só
  // vira linha própria se nenhuma duplicidade a cobre.
  const chaveDup = useCallback((nome) => resolver(nome) || normNome(nome), [resolver])
  const ajudaProvavelSemDup = useMemo(
    () => cruzamento.ajudaProvavel.filter((a) => !duplicidades.some((d) => d.key === chaveDup(a.nome))),
    [cruzamento.ajudaProvavel, duplicidades, chaveDup],
  )

  // AZUL DE EMPRESTADO realocado na leitura (dono 01/09 — caso Eduardo,
  // corrigido à mão duas vezes em dois dias): o azul de quem está no rodapé
  // daqui com o trabalho em OUTRO hospital não vira ajuda DAQUI. One-shot por
  // nome e SÓ sobre o que veio da leitura: a marca manual nunca é tocada
  // (lição do campo grudento, 30/07). O "mantém a posição na origem / sai
  // primeiro onde ajuda" já deriva dos casos — nada é gravado no outro lado.
  const [azuisDaLeitura, setAzuisDaLeitura] = useState([])
  const [azuisRealocados, setAzuisRealocados] = useState([])
  useEffect(() => {
    if (!azuisDaLeitura.length) return
    const atuais = separarListaRodape(ajudaTexto)
    const candidatos = azuisDaLeitura.filter((n) => atuais.some((a) => normNome(a) === normNome(n)))
    if (!candidatos.length) return
    const emprestados = azuisEmprestados({
      azuis: candidatos,
      ordem: separarListaRodape(ordemTexto),
      casos,
      outrasEscalas,
      turno: periodo,
      resolver,
      hospitalLabelFor: (h) => HOSPITAL_LABEL[h] || h,
    })
    if (!emprestados.length) return
    const norms = new Set(emprestados.map((e) => normNome(e.nome)))
    setAjudaTexto(atuais.filter((a) => !norms.has(normNome(a))).join(', '))
    setAzuisRealocados((p) => [
      ...p,
      ...emprestados.filter((e) => !p.some((x) => normNome(x.nome) === normNome(e.nome))),
    ])
    setAzuisDaLeitura((p) => p.filter((n) => !norms.has(normNome(n))))
  }, [azuisDaLeitura, ajudaTexto, ordemTexto, casos, outrasEscalas, periodo, resolver])

  // LADO DE DESTINO da realocação (lote): a irmã que realocou um azul aponta
  // PARA CÁ — se a pessoa tem caso aqui e ainda não está na ajuda daqui, ela
  // entra (é a declaração da foto do outro hospital aplicada no lugar certo, e
  // é o que faz "sai primeiro onde ajuda" valer sem pergunta nova). One-shot
  // por nome; remover à mão não volta.
  const [entrantesProcessados, setEntrantesProcessados] = useState([])
  useEffect(() => {
    const entrantes = []
    for (const irma of escalasIrmas || []) {
      for (const a of irma?.azuisRealocados || []) {
        if (a?.hospital !== hosp) continue
        const n = normNome(a.nome)
        if (!n || entrantesProcessados.includes(n)) continue
        const temCasoAqui = casos.some((c) => (c.turno || periodo) === periodo
          && normNome(c.anestesista) === n)
        if (!temCasoAqui) continue
        entrantes.push(a.nome)
      }
    }
    if (!entrantes.length) return
    const atuais = separarListaRodape(ajudaTexto)
    const novos = entrantes.filter((nome) => !atuais.some((x) => normNome(x) === normNome(nome)))
    if (novos.length) setAjudaTexto([...atuais, ...novos].join(', '))
    setEntrantesProcessados((p) => [...p, ...entrantes.map(normNome)])
  }, [escalasIrmas, hosp, casos, periodo, ajudaTexto, entrantesProcessados])

  const decisoesAbertas = duplicidadesPendentes.length + ajudaProvavelSemDup.length
    + casosForaDoRodape.length
  const temDecisoes = duplicidades.length > 0 || ajudaProvavelSemDup.length > 0
    || casosForaDoRodape.length > 0 || ajudasForaDaOrdem.length > 0
    || conferenciasSemCirurgia.length > 0 || azuisRealocados.length > 0

  /** Acrescenta um nome (texto) ao FIM da ordem — a saída "caiu do rodapé na leitura". */
  const acrescentarNaOrdem = (nome) => {
    const nomes = separarListaRodape(ordemTexto)
    if (nomes.some((n) => normNome(n) === normNome(nome))) return
    gravarOrdem([...nomes, nome])
  }

  // ── Publicação ───────────────────────────────────────────────────────────────
  // GUARDRAIL ANTI-PERDA (incidente 23/07: publicar/importar com 1 caso APAGOU os
  // 31 da escala — publicar é DELETE+reinsert). Se a escala já publicada tem MAIS
  // casos do que os desta tela, confirma antes de substituir (perda irreversível).
  const [substituir, setSubstituir] = useState(null) // { atuais, novos }
  const [confirmacaoPublicacao, setConfirmacaoPublicacao] = useState(false)
  const publicar = async ({ confirmacao = false, substituicao = false } = {}) => {
    // EM LOTE A ABA NÃO FALA (dono 02/09: três toasts ao mesmo tempo, um deles VERDE, com o
    // hospital que falhou no meio). Ela devolve o que teria dito; a folha de revisão dá UMA
    // notícia no fim, com o motivo humano de quem não subiu. Fora do lote, nada muda.
    const avisos = []
    const avisar = (t) => { if (embutida) avisos.push(t); else toast(t) }
    const recusar = (motivo, mensagem) => ({ ok: false, hospital: hosp, motivo, mensagem, avisos })
    const loteParaValidar = loteAnexo || casos
    const horario = validarHorarioImportacao(loteParaValidar, periodo)
    if (horario.invalidos.length) {
      avisar({
        variant: 'error',
        title: 'Hora inválida na escala',
        description: `${horario.invalidos.length} item(ns) têm hora inválida. Corrija antes de publicar (use HH:MM, por exemplo 08:30).`,
      })
      return recusar('hora inválida', `${horario.invalidos.length} item(ns) com hora inválida — corrija antes de publicar.`)
    }
    // NOME AMBÍGUO BLOQUEIA (dono 11/08): publicar "JOAO" com dois Joãos no
    // rodapé deixa a sala órfã e o dono dela fora da fila. Só quem está com a
    // imagem na mão sabe o sobrenome.
    if (gruposAmbiguos.length) {
      const { grupo, candidatos } = gruposAmbiguos[0]
      avisar({
        variant: 'error',
        duration: 12000,
        title: `"${grupo.nome}" — qual deles?`,
        description: `${candidatos.map((c) => nomeCirurgiaoCurto(titleCaseNome(c.nome))).join(' ou ')}. Escolha o login na conferência${gruposAmbiguos.length > 1 ? ` (e em mais ${gruposAmbiguos.length - 1} nome[s] igual[is])` : ''} — sem sobrenome a sala fica sem dono na fila.`,
      })
      return recusar('nome ambíguo', `"${gruposAmbiguos[0].grupo.nome}" pode ser mais de uma pessoa — escolha o login na conferência.`)
    }
    if (duplicidadesPendentes.length) {
      avisar({
        variant: 'warning',
        title: 'Confirme as duplicidades antes de publicar',
        description: `${duplicidadesPendentes.length} pessoa(s) aparecem em mais de um hospital no mesmo turno. Diga se trabalha nos dois de propósito ou escolha com quem trocou.`,
      })
      return recusar('duplicidade não classificada', `${duplicidadesPendentes.length} pessoa(s) em dois hospitais — responda em Decisões.`)
    }
    if (horario.incompatíveis.length) {
      avisar({
        variant: 'warning',
        title: 'Há itens de outro turno',
        description: `${horario.incompatíveis.length} item(ns) têm horário incompatível com o turno ${periodo === 'matutino' ? 'matutino' : 'vespertino'} e ficarão fora desta publicação.`,
      })
    }
    if (!confirmacao && salvarEscalaTurno) {
      setConfirmacaoPublicacao(true)
      return recusar('aguardando confirmação', '')
    }
    setPublicando(true)
    try {
      const userId = user?.uid || user?.id
      // Defesa final: a HORA decide e casos do outro turno ficam fora. O mapa do
      // Materno traz o dia todo; publicar manhã e depois tarde com o lote integral
      // duplicava o período anterior. Sem hora, vale o turno selecionado.
      const casosNovos = selecionarCasosDoTurno(
        aplicarAtribuicoes(casos, atribuicoes, apelidoExibicao, resolver),
        periodo,
      )
      const ordemNova = separarListaRodape(ordemTexto)
      const ajudaNova = separarListaRodape(ajudaTexto)

      // A publicação é transacional e substitui somente o turno selecionado; o
      // servidor preserva casos, liberações e rodapé do outro turno.
      let existente = null
      try { existente = await svc.fetchEscala(dataEscolhida, hosp) } catch { existente = null }
      const legado = !salvarEscalaTurno
      const casosOut = legado ? mergeCasosPorTurno(existente?.casos || [], casosNovos, periodo) : casosNovos
      const ordemPublicacao = legado ? mergeRodapeTurno(existente?.ordemLiberacao, periodo, ordemNova) : ordemNova
      const ajudaPublicacao = legado ? mergeRodapeTurno(existente?.ajudaExterna, periodo, ajudaNova) : ajudaNova
      // Guardrail anti-perda: alerta apenas se o turno selecionado encolher.
      if (!substituicao) {
        const atuais = (existente?.casos || []).filter((c) => (c.turno || periodo) === periodo).length
        if (atuais >= 3 && atuais > casosNovos.length) {
          setPublicando(false)
          setSubstituir({ atuais, novos: casosOut.length })
          return recusar('encolhimento não confirmado', `Esta publicação reduziria de ${atuais} para ${casosNovos.length} casos.`)
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
        // Texto que NÃO é nome de pessoa nunca vira apelido (incidente 02/09):
        // "GABRIELA + ?" aprendido como apelido do Oscar rebatizou o Oscar em
        // todo o app. `ehApelidoDePessoa` é a mesma regra que o service recusa.
        const txt = g.nome === '?' || !ehApelidoDePessoa(g.nome) ? '' : g.nome
        if (uid && txt && resolver(txt) == null) {
          try {
            await upsertAlias({ apelido: txt, userId: uid, createdBy: userId })
          } catch (err) {
            semVinculo.push({ nome: txt, permissao: isPermissionError(err) })
          }
        }
      }))

      const saved = await publicarEscala(
        legado
          ? { data: dataEscolhida, hospital: hosp, casos: casosOut, ordemLiberacao: ordemPublicacao, ajudaExterna: ajudaPublicacao, status: 'publicada' }
          : { data: dataEscolhida, hospital: hosp, turno: periodo, casos: casosNovos, ordemLiberacao: ordemNova, ajudaExterna: ajudaNova, status: 'publicada' },
        { userId, userName: user?.displayName },
        // em lote o erro vira a frase da folha; o context não abre toast por cima
        { silencioso: embutida },
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
        const comNome = casosNovos
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

      // TROCA a partir da conferência (dono 06/08; EXECUÇÃO automática 07/08 —
      // "as trocas não saem de forma automática após leitura das escalas").
      // A decisão "troca" agora: (1) DECLARA o trocaCom (rastro, badge nos dois
      // lados) e (2) EXECUTA o swap quando o plano fecha — os dois lados com uid
      // resolvido, ou assunção de um lado só (colega sem escala publicada). O
      // que não fecha fica declarado, com o aviso do que falta.
      //
      // Snapshot explícito (saved + outras escalas): o estado do context ainda
      // não viu a publicação — sem corrida com o realtime. Registro ÚNICO na
      // linha do duplicado; fire-and-forget em relação à publicação (falhar aqui
      // NUNCA desfaz o que já publicou).
      let trocasExecutadas = []
      let trocasPendentes = []
      try {
        const trocas = Object.entries(duplicidadeDecisoes)
          .filter(([, d]) => d?.tipo === 'troca' && (d.parceiroUid || d.parceiroNome))
        if (saved?.id && (trocas.length || outrasEscalas.length)) {
          const snapshot = { [hosp]: saved }
          for (const o of outrasEscalas) if (o?.hospital) snapshot[o.hospital] = o
          const agoraIso = () => new Date().toISOString()

          for (const [chave, d] of trocas) {
            const scoped = `${periodo}:${chave}`
            // cadeia de fallback (defeito D6): o override pode viver em chave
            // legada; ler só a scoped duplicaria a entrada
            const { valor: anterior } = lerOverrideAnterior(saved.linhaOverrides, chave, periodo)
            const { trocaCom: _sai, por: _p, em: _e, ...resto } = anterior || {}
            // duplicidade entre hospitais É o tipo 'entre_hospitais' por definição
            const trocaCom = { uid: d.parceiroUid || null, nome: d.parceiroNome || '', tipo: 'entre_hospitais', por: userId || null, em: agoraIso() }
            await svc.patchLinhaOverride(saved.id, scoped, { ...resto, trocaCom, por: userId || null, em: agoraIso() }).catch(() => {})
            // espelha no snapshot: a convergência abaixo lê daqui
            snapshot[hosp] = {
              ...snapshot[hosp],
              linhaOverrides: { ...(snapshot[hosp].linhaOverrides || {}), [scoped]: { ...resto, trocaCom } },
            }
          }

          // CONVERGÊNCIA: varre TODOS os pares declarados (os desta publicação e
          // os que esperavam o parceiro chegar — inclusive re-execução pós-
          // republicação, que zera os overrides) e executa os que fecham. A
          // idempotência (D10) pula o que já está executado.
          for (const par of paresDeclarados(snapshot)) {
            const aUid = rosterByUid.has(par.chave) ? par.chave : resolver(par.chave)
            const rA = aUid ? rosterByUid.get(aUid) : null
            const rB = par.b.uid ? rosterByUid.get(par.b.uid) : null
            const a = { uid: aUid || null, nome: rA?.nome || par.chave, apelido: rA?.apelidos?.[0] || par.chave }
            const bPar = { uid: par.b.uid, nome: rB?.nome || par.b.nome, apelido: rB?.apelidos?.[0] || String(par.b.nome).split(/\s+/)[0]?.toUpperCase() || '' }
            // plano ANCORADO na declaração — o varre-tudo do ✏️ trocaria também a
            // posição onde o duplicado VAI FICAR (caso canônico Didomenico⇄Paulo)
            const plan = planoExecucaoDeclarada({ escalas: snapshot, resolverUid: resolver, par: { ...par, turno: par.turno || periodo }, a, b: bPar })
            const meta = { tipo: par.tipo || 'entre_hospitais', ...(par.motivo && { motivo: par.motivo }) }
            // executa quando TODO lado tem quem assumir com uid (2 lados = swap;
            // 1 lado = assunção por colega de fora). Senão: fica declarado.
            if (plan.lados.length && plan.lados.every((l) => l.para.uid)) {
              try {
                await executarSubstituicao(
                  { ...plan, lados: plan.lados.map((l) => ({ ...l, ...meta })) },
                  { userId, userName: user?.displayName },
                  { escalasOverride: snapshot },
                )
                trocasExecutadas.push(`${nomeCirurgiaoCurto(a.nome)} ⇄ ${nomeCirurgiaoCurto(bPar.nome)}`)
              } catch { trocasPendentes.push(`${nomeCirurgiaoCurto(bPar.nome)}: a execução falhou — execute pelo ✏️ das Liberações`) }
            } else if (plan.pendencias.length) {
              trocasPendentes.push(...plan.pendencias.map((pe) => pe.motivo === 'sem_uid'
                ? `${nomeCirurgiaoCurto(pe.pessoa.nome)} sem vínculo de login — vincule pelo 🔗 e execute pelas Liberações`
                : `${nomeCirurgiaoCurto(pe.pessoa.nome)} sem posição publicada — executa quando a escala dele(a) for publicada`))
            }
          }
        }
      } catch { /* escala publicada; a troca pode ser declarada/executada pelo ✏️ */ }

      // CRUZAMENTO DA URGÊNCIA QUE ATRAVESSA O TURNO (dono 21/08): a urgência
      // aberta é do DIA, não do turno — às 13h ela segue ocupando uma sala, mas
      // quem responde por ela passa a ser quem esta escala colocou naquela sala.
      // Antes era conserto à mão, caso a caso, depois de cada publicação.
      // Só HRO (é o contrato dele) e fire-and-forget: falhar aqui NUNCA desfaz a
      // publicação. O toast diz o que mudou — reatribuir anestesista é decisão
      // clínica, não pode acontecer em silêncio.
      let cruzadas = 0
      let cruzadasSemDono = 0
      try {
        if (hosp === 'hro' && saved?.casos?.length) {
          const plano = planoCruzamentoUrgencias(saved.casos, periodo, {
            salas: salasContrato(saved.urgenciasMeta, periodo),
          })
          for (const a of plano.atribuir) {
            await svc.updateAnestesistaCasos([a.caso.id], { uid: a.uid, apelido: a.apelido })
          }
          if (plano.semAnestesista.length) {
            await svc.updateAnestesistaCasos(
              plano.semAnestesista.map((x) => x.caso.id), { uid: null, apelido: '' },
            )
          }
          cruzadas = plano.atribuir.length
          cruzadasSemDono = plano.semAnestesista.length
        }
      } catch { /* a escala está publicada; o ajuste pode ser feito no card */ }

      avisar({
        variant: 'success',
        title: 'Escala publicada',
        description: trocasExecutadas.length
          ? `Troca executada: ${[...new Set(trocasExecutadas)].join(' · ')}.`
          : 'Disponível para toda a equipe em tempo real.',
      })
      if (cruzadas || cruzadasSemDono) {
        const partes = []
        if (cruzadas) partes.push(`${cruzadas} passou para o anestesista desta escala`)
        if (cruzadasSemDono) partes.push(`${cruzadasSemDono} ficou sem anestesista (ninguém escalado na sala) e segue na fila`)
        avisar({
          variant: cruzadasSemDono ? 'warning' : 'info',
          duration: 12000,
          title: 'Urgência aberta do turno anterior',
          description: `${partes.join(' · ')}.`,
        })
      }
      if (trocasPendentes.length) {
        avisar({
          variant: 'warning', duration: 12000,
          title: 'Troca declarada, ainda não executada',
          description: [...new Set(trocasPendentes)].join(' · '),
        })
      }

      // Aviso SEPARADO e depois do sucesso: a escala FOI publicada, e esconder
      // isso faria o usuário republicar à toa. Duração longa — é instrução, não
      // confirmação, e quem está no centro cirúrgico não volta para reler.
      if (semVinculo.length) {
        const nomes = semVinculo.map((v) => titleCaseNome(v.nome)).join(', ')
        const soPermissao = semVinculo.every((v) => v.permissao)
        avisar({
          variant: 'warning',
          duration: 15000,
          title: `Escala publicada, mas ${semVinculo.length === 1 ? 'um nome ficou' : `${semVinculo.length} nomes ficaram`} sem vínculo`,
          description: soPermissao
            ? `${nomes}: você só pode vincular o seu próprio login. Peça à secretaria ou a um admin para vincular pelo 🔗 — até lá esse nome aparece duas vezes na fila (uma no rodapé, sem casos, e uma no fim da lista).`
            : `${nomes}: não foi possível salvar o vínculo. Tente de novo pelo 🔗 — até lá esse nome aparece duas vezes na fila.`,
        })
      }
      // No lote quem fecha a tela é o pai, DEPOIS da última escala — fechar aqui
      // desmontaria as abas que ainda não publicaram.
      if (!embutida) {
        // devolve onde publicou → a página aterrissa na escala certa (data/hospital/período)
        onClose?.({ data: dataEscolhida, hospital: hosp, turno: periodo })
      }
      return { ok: true, hospital: hosp, avisos }
    } catch (err) {
      // fora do lote o context já avisou; em lote a frase sobe para a folha
      return { ok: false, hospital: hosp, motivo: 'erro', mensagem: mensagemErroPublicacao(err), avisos }
    } finally { setPublicando(false) }
  }

  const temBase = casos.length > 0
  const duplicados = useMemo(() => detectarItensDuplicados(casos), [casos])
  // Placar da conferência (dono 17/08): a barra de atalhos precisa dizer, sem
  // rolar, quanta coisa ainda impede publicar. BLOQUEIO é o que o `publicar`
  // recusa — nome ambíguo e duplicidade não classificada; o resto é AVISO, que
  // só pede conferência.
  const bloqueiosConferencia = gruposAmbiguos.length + duplicidadesPendentes.length
  const avisosConferencia = suspeitosExtracao.length + caudaLiberada.length
    + conflitos.length + blocosRepetidos.length + travessiasOrfas.length
    + duplicados.length + casosForaDoRodape.length + gruposSemAnestesista
    + secoesAusentesHro.length
  const totalPendencias = bloqueiosConferencia + avisosConferencia
  // O QUE são as pendências, não só quantas (dono 27/08: "quero que a descrição
  // das pendências fique abaixo desses cards"). O número no chip dizia que havia
  // algo a resolver, mas obrigava a rolar até o fim da tela para descobrir o
  // quê. Cada linha é curta e diz a AÇÃO; o detalhe continua em Pendências.
  const resumoPendencias = useMemo(() => {
    const l = []
    const n = (q, um, muitos) => `${q} ${q === 1 ? um : muitos}`
    if (gruposAmbiguos.length) l.push({ trava: true, txt: `${n(gruposAmbiguos.length, 'nome ambíguo', 'nomes ambíguos')} — escolha o login` })
    if (duplicidadesPendentes.length) l.push({ trava: true, txt: `${n(duplicidadesPendentes.length, 'pessoa', 'pessoas')} em dois hospitais — responda em Decisões` })
    if (gruposSemAnestesista) l.push({ trava: false, txt: `${n(gruposSemAnestesista, 'bloco', 'blocos')} sem anestesista` })
    if (casosForaDoRodape.length) l.push({ trava: false, txt: `${n(casosForaDoRodape.length, 'anestesista', 'anestesistas')} com caso fora da ordem — responda em Decisões` })
    if (caudaLiberada.length) l.push({ trava: false, txt: `${n(caudaLiberada.length, 'nome nasce', 'nomes nascem')} LIBERADO sem cirurgia` })
    if (suspeitosExtracao.length) l.push({ trava: false, txt: `${n(suspeitosExtracao.length, 'nome', 'nomes')} na ordem sem nenhum caso` })
    if (conflitos.length) l.push({ trava: false, txt: `${n(conflitos.length, 'conflito', 'conflitos')} de horário` })
    if (blocosRepetidos.length) l.push({ trava: false, txt: `${n(blocosRepetidos.length, 'bloco', 'blocos')} com o mesmo nome em todas as linhas` })
    if (travessiasOrfas.length) l.push({ trava: false, txt: `${n(travessiasOrfas.length, 'cirurgia que atravessa', 'cirurgias que atravessam')} sem dono presente` })
    if (duplicados.length) l.push({ trava: false, txt: `${n(duplicados.length, 'item repetido', 'itens repetidos')}` })
    if (secoesAusentesHro.length) {
      l.push({ trava: false, txt: `sem ${secoesAusentesHro.join(', ')} na leitura — confira o mapa` })
    }
    return l
  }, [gruposAmbiguos, duplicidadesPendentes, gruposSemAnestesista, casosForaDoRodape, caudaLiberada,
    suspeitosExtracao, conflitos, blocosRepetidos, travessiasOrfas, duplicados, secoesAusentesHro])

  // ── O QUE ESTA ABA CONTA AO LOTE (dono 27/08) ────────────────────────────
  // Dois consumidores: o SELO da aba (pronto · trava · avisa, mesma taxonomia
  // da barra de pendências) e as ABAS IRMÃS, que usam estes casos e este rodapé
  // para cruzar duplicidade e ajuda antes de qualquer publicação.
  const casosAtribuidosDoTurno = useMemo(
    () => selecionarCasosDoTurno(aplicarAtribuicoes(casos, atribuicoes, apelidoExibicao, resolver), periodo),
    [casos, atribuicoes, apelidoExibicao, resolver, periodo],
  )
  const resumoAba = useMemo(() => ({
    hospital: hosp,
    casos: casosAtribuidosDoTurno,
    totalCasos: casosAtribuidosDoTurno.length,
    ordemLiberacao: separarListaRodape(ordemTexto),
    ajudaExterna: separarListaRodape(ajudaTexto),
    // azuis realocados DESTA aba (emprestados): a aba de DESTINO os incorpora
    // à ajuda dela — é a declaração da foto aplicada no lugar certo (01/09)
    azuisRealocados,
    bloqueios: bloqueiosConferencia,
    avisos: avisosConferencia,
    // guardrail anti-perda por escala, para a folha avisar ANTES: o turno
    // publicado tem mais casos do que este lote (publicar é DELETE+reinsert)
    publicados: (escalaPublicada?.casos || []).filter((c) => (c.turno || periodo) === periodo).length,
  }), [hosp, casosAtribuidosDoTurno, ordemTexto, ajudaTexto, azuisRealocados,
    bloqueiosConferencia, avisosConferencia, escalaPublicada, periodo])
  // Assinatura estável: sem ela, um objeto novo a cada render realimentaria o
  // estado do pai e a árvore inteira giraria em laço.
  const assinaturaAba = [
    hosp, periodo, resumoAba.totalCasos, resumoAba.bloqueios, resumoAba.avisos, resumoAba.publicados,
    resumoAba.ordemLiberacao.join('~'), resumoAba.ajudaExterna.join('~'),
    azuisRealocados.map((a) => `${a.hospital}:${a.nome}`).join('~'),
    casosAtribuidosDoTurno.map((c) => `${c.sala}:${c.anestesistaUserId || c.anestesista}`).join('~'),
  ].join('|')
  useEffect(() => {
    onResumo?.(resumoAba)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinaturaAba])

  // A folha de revisão do lote publica cada hospital pela MESMA via de sempre —
  // é esta função, a da aba, chamada uma vez por escala.
  useImperativeHandle(ref, () => ({
    hospital: hosp,
    publicar: (opts) => publicar({ confirmacao: true, substituicao: true, ...opts }),
  }))
  // Posição aberta para edição — o editor mora FORA das duas colunas da fila
  const posAberta = ordemNumerada.find((p) => p.i === posSel) || null
  /** Rola até a seção da conferência (o scroll é do container, não da janela).
      Optional call: jsdom não implementa scrollIntoView e o clique vindo da
      folha de decisão estourava como unhandled error na suíte. */
  const irPara = (id) => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  const resumoTexto = (itens) => {
    const r = resumirItensEscala(itens)
    const partes = []
    if (r.cirurgias) partes.push(`${r.cirurgias} cirurgia${r.cirurgias === 1 ? '' : 's'}`)
    if (r.posicoes) partes.push(`${r.posicoes} posiç${r.posicoes === 1 ? 'ão' : 'ões'}`)
    return partes.join(' + ') || 'nenhum item'
  }

  return (
    // Embutida no lote: sem moldura própria e SEM DESMONTAR quando muda de aba
    // (`hidden`) — desmontar apagaria a conferência já feita naquele hospital.
    <div className={embutida
      ? (oculta ? 'hidden' : '')
      : 'fixed inset-0 z-modal bg-background overflow-y-auto'}
      {...(embutida ? { 'aria-hidden': oculta || undefined } : {})}
    >
      {/* Header STICKY próprio (2026-07-22): o PageHeader é position:fixed com spacer
          de altura fixa — no PWA (safe-area do iPhone) ele cobria os seletores.
          Sticky dimensiona pelo conteúdo, respeita o notch e nunca sobrepõe.
          No lote quem desenha o header é `ImportarEscalasPage`, uma vez só. */}
      {!embutida && (
      <div className="sticky top-0 z-10 border-b border-border bg-card shadow-sm pt-[env(safe-area-inset-top)]">
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
          <div className="min-w-0 flex-1 mx-2 text-center">
            <h1 className="truncate text-base font-semibold text-foreground">
              Confeccionar · {HOSPITAL_LABEL[hosp]}
            </h1>
            <p className="truncate text-xs text-muted-foreground -mt-0.5">
              {formatData(dataEscolhida)} · {periodo === 'matutino' ? 'Matutino' : 'Vespertino'}
            </p>
          </div>
          <span className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>
      )}
      <div className={embutida ? 'space-y-4' : 'max-w-3xl mx-auto p-4 pb-28 space-y-4'}>
        {!canEdit && (
          <p className="rounded-lg bg-warning/10 text-warning text-sm p-3">Você não tem permissão para confeccionar escalas.</p>
        )}

        {!embutida && (<>
        {/* DOIS PASSOS DECLARADOS (dono 17/08): anexar e conferir são dois momentos
            para quem usa — a secretária anexa e só depois confere. O stepper diz em
            qual deles ela está; o passo 2 acende quando a base entra. */}
        <ol className="flex items-center gap-2" aria-label="Etapas da importação">
          {[{ n: 1, label: 'Anexar', on: !temBase }, { n: 2, label: 'Conferir', on: temBase }].map((p, i) => (
            <li key={p.n} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-border-strong" aria-hidden="true" />}
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${p.on ? 'text-primary' : 'text-muted-foreground'}`}>
                <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px]
                  ${p.on ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{p.n}</span>
                {p.label}
              </span>
            </li>
          ))}
        </ol>

        {/* PARA QUAL ESCALA — hospital, data e período num cartão só (dono 17/08).
            Soltos no corpo, os três pareciam etapas independentes; juntos são a
            pergunta única que o anexo responde. */}
        <section className="space-y-3 rounded-2xl border border-border-strong bg-card p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-primary">Para qual escala</h2>
          <div>
            {/* Hospital da escala (pedido do dono 2026-07-21): editável aqui — a escala
                pode ser de outro hospital que não o selecionado na página. */}
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Hospital</label>
            <SegmentedSelector options={HOSPITAL_OPCOES} value={hosp} onChange={(v) => { setHosp(v); setSugestaoHosp(null) }} />
          </div>
          {/* items-start: o DatePicker é mais alto que o seletor de período — alinhar
              pelo fim descolava os dois rótulos */}
          <div className="grid grid-cols-[1.15fr_1fr] items-start gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data</label>
              <DatePicker
                className="w-full min-w-0"
                value={(() => { const [y, m, d] = String(dataEscolhida || '').split('-').map(Number); return y ? new Date(y, m - 1, d) : new Date() })()}
                onChange={(d) => { if (d) { setDataEscolhida(dataToISO(d)); setSugestaoData(null) } }}
                placeholder="Data da escala"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
              <SegmentedSelector options={PERIODO_OPCOES} value={periodo} onChange={mudarPeriodo} />
            </div>
          </div>
        </section>

        {/* Sugestão pelo layout do anexo — confirmar, nunca trocar sozinho */}
        {sugestaoHosp && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-warning flex-1">
              O anexo parece ser do <strong>{HOSPITAL_LABEL[sugestaoHosp.hospital]}</strong>
              {sugestaoHosp.origem === 'excel' && ' (Excel é o export padrão da Unimed)'}
              {sugestaoHosp.origem === 'estrutura' && ' (pelas colunas da planilha)'}
              {sugestaoHosp.origem === 'vision' && ' (pelo layout da imagem)'}.
            </p>
            <Button size="sm" variant="outline" onClick={aplicarSugestaoHosp}>
              Usar {HOSPITAL_LABEL[sugestaoHosp.hospital]}{sugestaoHosp.origem === 'vision' ? ' e reler' : ''}
            </Button>
          </div>
        )}

        {sugestaoData && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <p className="text-xs text-warning flex-1">
              O anexo mostra a data <strong>{formatData(sugestaoData)}</strong>, diferente da data selecionada.
            </p>
            <Button size="sm" variant="outline" onClick={() => { setDataEscolhida(sugestaoData); setSugestaoData(null) }}>
              Usar esta data
            </Button>
          </div>
        )}
        </>)}

        {!embutida && (<>
        {/* Anexo ÚNICO multi-formato (pedido do dono 2026-07-21): Excel/CSV → parser
            local; imagem → Vision. Roteia pelo tipo do arquivo — sem seletor de fonte. */}
        <FileUpload accept=".xlsx,.xls,.csv,image/*" maxSize={15 * 1024 * 1024} variant="dropzone"
          label="Arquivo da escala"
          description="Excel/CSV do hospital ou foto/print da escala — a leitura é automática (paciente só por iniciais)."
          onChange={(f) => importarArquivo(Array.isArray(f) ? f[0] : f)} disabled={carregando || !canEdit} />
        {!temBase && canEdit && (
          <Button variant="outline" onClick={addLinha} className="w-full"><Plus className="w-4 h-4" /> Ou preencher manualmente</Button>
        )}

        {/* Documento de FIM DE SEMANA (fila única, dono 15/08): é outro documento
            e outra conferência — destacado quando a data escolhida é sáb/dom.
            Fica DEPOIS do anexo (dono 17/08): é desvio de rota, não etapa. */}
        {onAbrirFds && (
          <button
            type="button"
            onClick={() => onAbrirFds(dataEscolhida)}
            className={[
              'w-full rounded-xl border p-3 text-left text-sm active:opacity-70',
              ehDataFilaUnica(dataEscolhida)
                ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                : 'border-border bg-muted/30 text-muted-foreground',
            ].join(' ')}
          >
            {ehDataFilaUnica(dataEscolhida)
              ? (ehFeriado(dataEscolhida)
                  ? 'Esta data é feriado — a ordem de liberação é ÚNICA (todos os hospitais). Importar lista e mapas ›'
                  : 'Esta data é fim de semana — a ordem de liberação é ÚNICA (todos os hospitais). Importar o documento de FDS ›')
              : 'Escala de fim de semana? Importe o documento de FDS (fila única) ›'}
          </button>
        )}
        </>)}

        {carregando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Lendo…</p>
        )}

        {ignoradosOutroTurno > 0 && !carregando && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            {ignoradosOutroTurno} item(ns) do outro turno não serão adicionados. Selecione o outro período acima para conferi-los.
          </p>
        )}

        {/* Conferência da base */}
        {temBase && (
          <>
            {/* TRÊS DESTINOS NUMA ROLAGEM SÓ (dono 17/08, escolha em protótipo):
                Blocos · Liberações · Pendências ROLAM até a seção em vez de trocar
                de aba — bloco e fila precisam poder ser lidos na mesma passada. A
                faixa de bloqueio fica fixa embaixo dos atalhos: o problema pode
                sair da tela, não da barra. */}
            <nav
              className={`sticky z-10 -mx-4 border-b border-border bg-background px-4 pb-2 pt-1
                ${embutida ? 'top-[110px]' : 'top-14'}`}
              aria-label="Seções da conferência"
            >
              <div className="flex gap-1.5 overflow-x-auto">
                {[
                  { id: 'conf-blocos', label: 'Blocos', n: grupos.length },
                  // O chip do meio carrega o estado das DECISÕES (dono 31/08):
                  // âmbar = por responder/conferir; ✓ = todas respondidas;
                  // sem decisão nenhuma, volta a contar os nomes da ordem.
                  {
                    id: 'conf-liberacoes',
                    label: 'Ordem e decisões',
                    n: decisoesAbertas + conferenciasSemCirurgia.length > 0
                      ? decisoesAbertas + conferenciasSemCirurgia.length
                      : (temDecisoes ? '✓' : ordemNumerada.length),
                    aten: decisoesAbertas + conferenciasSemCirurgia.length > 0,
                    ok: decisoesAbertas + conferenciasSemCirurgia.length === 0 && temDecisoes,
                  },
                  { id: 'conf-pendencias', label: 'Pendências', n: totalPendencias, alerta: bloqueiosConferencia > 0 },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => irPara(s.id)}
                    className="inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-[10px] bg-muted px-2.5
                               text-xs font-bold text-muted-foreground transition-transform active:scale-95"
                  >
                    {s.label}
                    <span className={[
                      'rounded-md px-1.5 text-[10px]',
                      s.alerta ? 'bg-destructive text-destructive-foreground' : '',
                      s.aten ? 'bg-warning text-warning-foreground' : '',
                      s.ok ? 'bg-success text-success-foreground' : '',
                    ].filter(Boolean).join(' ')}>
                      {s.n}
                    </span>
                  </button>
                ))}
              </div>
            </nav>

            {/* DESCRIÇÃO DAS PENDÊNCIAS logo abaixo dos chips (dono 27/08) — fora
                da barra sticky de propósito: dentro dela, uma lista de 4 linhas
                comeria altura fixa da conferência inteira. Toque leva ao detalhe. */}
            {resumoPendencias.length > 0 && (
              <button
                type="button"
                // toque leva para onde a resposta mora: decisão aberta → cartão
                // da fila; só avisos → Pendências (dono 31/08)
                onClick={() => irPara(decisoesAbertas > 0 ? 'conf-liberacoes' : 'conf-pendencias')}
                // nome acessível PRÓPRIO: o texto do cartão contém "impede
                // publicar" e sem isto ele disputa com o botão Publicar
                aria-label={`Ver as ${resumoPendencias.length} pendência(s) da conferência`}
                className={[
                  'w-full rounded-xl border px-3 py-2.5 text-left',
                  bloqueiosConferencia > 0
                    ? 'border-destructive/40 bg-destructive/10'
                    : 'border-warning/40 bg-warning/10',
                ].join(' ')}
              >
                <p className={`flex items-center gap-1.5 text-xs font-bold ${bloqueiosConferencia > 0 ? 'text-destructive' : 'text-warning'}`}>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {bloqueiosConferencia > 0
                    ? `${bloqueiosConferencia === 1 ? '1 bloqueio impede' : `${bloqueiosConferencia} bloqueios impedem`} publicar`
                    : `${avisosConferencia === 1 ? '1 aviso' : `${avisosConferencia} avisos`} — publica assim mesmo`}
                  {bloqueiosConferencia > 0 && avisosConferencia > 0 && ` · ${avisosConferencia} aviso${avisosConferencia > 1 ? 's' : ''}`}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {resumoPendencias.slice(0, 4).map((p) => (
                    <li key={p.txt} className={`flex gap-1.5 text-xs ${p.trava ? 'font-semibold text-destructive' : 'text-warning'}`}>
                      <span aria-hidden="true">{p.trava ? '⛔' : '·'}</span>{p.txt}
                    </li>
                  ))}
                  {resumoPendencias.length > 4 && (
                    <li className="text-xs text-muted-foreground">e mais {resumoPendencias.length - 4} — toque para ver</li>
                  )}
                </ul>
              </button>
            )}

            {/* CONFERÊNCIA POR ANESTESISTA (redesenho 26/07, split 27/07): a lista
                plana de N cards era impraticável no celular e ficava longe da
                atribuição, que vivia noutra seção. Agora cada bloco é dobrado,
                traz o que identifica a sala na imagem — cirurgiões — e o seletor
                do anestesista ali mesmo. Sala com VÁRIOS anestesistas (Exames,
                IOSC, seções de outro hospital) rende um bloco por anestesista:
                agrupar todo mundo numa sala só foi o que achatou o IOSC em 23/07. */}
            <section id="conf-blocos" className="scroll-mt-28">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex min-w-0 items-center gap-1.5 text-[15px] font-extrabold">
                <Sparkles className="w-4 h-4 shrink-0 text-primary" />
                <span className="truncate">Blocos por anestesista</span>
              </h2>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-[11.5px] text-muted-foreground">{resumoTexto(casos)}</span>
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
                const somentePosicoes = itens.length > 0 && itens.every(({ c }) => ehPosicaoAssistencial(c))
                return (
                  <div key={chave} className={['rounded-xl border bg-card', semAnest ? 'border-warning/50' : 'border-border'].join(' ')}>
                    {/* cabeçalho: identifica o bloco (sala · anestesista importado)
                        pelos cirurgiões e abre os casos */}
                    <button type="button" onClick={() => alternarGrupo(chave)}
                      aria-expanded={aberta}
                      className="flex w-full items-center gap-2 p-3 text-left">
                      {/* SALA · CIRURGIÃO, e o anestesista só no seletor (dono 27/08:
                          "nomes dos anestesistas estão duplicados"). O nome importado
                          aparecia no título E no placeholder do Select logo abaixo —
                          duas grafias da mesma pessoa, uma delas a que a leitura chutou.
                          O cirurgião é quem identifica a sala na imagem, então ele sobe
                          para a linha da sala. ⚠️ bloco DIVIDIDO por anestesista e SEM
                          cirurgião (posição assistencial) ficaria idêntico ao irmão:
                          só nesse caso o nome importado continua, como desambiguador. */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" title={[sala, ...cirurgioes].join(' · ')}>
                          {sala}
                          {cirurgioes.length > 0 ? (
                            <span className="ml-1.5 font-normal text-muted-foreground">
                              · {cirurgioes.slice(0, 2).join(', ')}{cirurgioes.length > 2 ? ` +${cirurgioes.length - 2}` : ''}
                            </span>
                          ) : g.split && (
                            <span className="ml-1.5 font-medium text-primary">· {importado || 'sem anestesista'}</span>
                          )}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {somentePosicoes ? `${itens.length} posiç${itens.length === 1 ? 'ão' : 'ões'}` : `${itens.length} caso${itens.length > 1 ? 's' : ''}`}
                      </span>
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
                              {ehPosicaoAssistencial(c) && (
                                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">Posição assistencial · não é cirurgia</span>
                              )}
                              <button type="button" onClick={() => removeLinha(i)} aria-label={`Remover ${ehPosicaoAssistencial(c) ? 'posição' : 'caso'} ${i + 1}`}
                                className="ml-auto text-destructive"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-[1fr_5.5rem] gap-1.5">
                              <CampoSala valor={c.sala} onCommit={(v) => commitSala(i, v)} opcoes={salasDisponiveis} />
                              <Input placeholder="Hora" value={c.hora} onChange={(e) => setCampo(i, 'hora', e.target.value)} />
                            </div>
                            {!ehPosicaoAssistencial(c) && (
                              <>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <Input placeholder="Cirurgião" value={c.cirurgiao} onChange={(e) => setCampo(i, 'cirurgiao', e.target.value)} />
                                  <Input placeholder="Paciente (iniciais)" value={c.pacienteIniciais} onChange={(e) => setCampo(i, 'pacienteIniciais', e.target.value)} onBlur={(e) => setCampo(i, 'pacienteIniciais', iniciaisSeguras(e.target.value))} />
                                </div>
                                <Input placeholder="Procedimento" value={c.procedimento} onChange={(e) => setCampo(i, 'procedimento', e.target.value)} />
                              </>
                            )}
                            {/* anestesista DESTE caso: fura a atribuição do bloco
                                e é como se corrige um "?".
                                ⚠️ SÓ com 2+ casos (dono 30/08: "aparece duas vezes
                                para selecionar o anestesista"). E desde 31/08 a
                                linha LÊ o nome herdado — o seletor abre só pelo
                                lápis: renderizado sempre, era a mesma pergunta N
                                vezes no mesmo bloco, e furar é a exceção (22% das
                                salas têm 2+ anestesistas, medido no banco). */}
                            {itens.length > 1 && (casoEmEdicao === i ? (
                              <Select
                                className="w-full"
                                options={[{ value: SEM_ANESTESISTA, label: 'Sem anestesista (?)' }, ...rosterOpcoes]}
                                value={valorAnestesistaCaso(c, chave)}
                                onChange={(v) => { definirAnestesistaCaso(i, v); setCasoEmEdicao(null) }}
                                placeholder="Anestesista (defina o do bloco acima)"
                                searchable
                              />
                            ) : (() => {
                              const r = rotuloAnestesistaCaso(c, chave)
                              return (
                                <button
                                  type="button"
                                  onClick={() => setCasoEmEdicao(i)}
                                  aria-label={`Alterar o anestesista deste caso (${r.nome})`}
                                  className="flex min-h-[32px] w-full items-center gap-1.5 rounded-lg bg-muted/55 px-2.5 text-left text-xs"
                                >
                                  <span className="min-w-0 flex-1 truncate">
                                    Com <b className="font-bold">{r.nome}</b>
                                    {r.origem && <span className="text-muted-foreground"> · {r.origem}</span>}
                                  </span>
                                  <Pencil className="h-3.5 w-3.5 shrink-0 text-primary" />
                                </button>
                              )
                            })())}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            </section>

            <section id="conf-liberacoes" className="scroll-mt-28">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-extrabold">Ordem de liberação</h2>
                <Button size="sm" variant="ghost" onClick={preencherRodape}>Preencher da atribuição</Button>
              </div>
              {/* A ordem é o dado mais SAGRADO da importação e cabia numa linha
                  só: com 17 nomes apareciam 4 (dono 11/08, "difícil de
                  visualizar"). O campo de texto SAIU (dono 11/08): a lista
                  numerada é a única superfície — se confere contra a foto
                  posição por posição e se corrige na própria posição.
                  Desde 17/08 ela corre em DUAS COLUNAS, para baixo: a esquerda
                  inteira e só então a direita — 15 nomes cabem sem rolar. */}
              <p className="mb-1.5 text-[11.5px] text-muted-foreground">
                1º = plantonista · último sai 1º. A ordem corre para baixo: a coluna da esquerda inteira, depois a direita.
              </p>
              <div className="overflow-hidden rounded-xl border border-border-strong bg-card">
                <ul className="columns-2 gap-x-3 px-2.5 py-1">
                  {ordemNumerada.map(({ nome, i, papel, ajuda }) => {
                    // ponto âmbar = "na ordem sem nenhuma cirurgia": o vizinho
                    // escalado (extração torta, 23/07) OU a cauda que vai nascer
                    // liberada (24/08) — os dois são o mesmo fato na posição.
                    const suspeito = rodapeSuspeitos.includes(nome) || nomesCauda.has(nome)
                    return (
                      <li key={i} className="break-inside-avoid border-b border-border/60">
                        <button
                          type="button"
                          onClick={() => abrirPosicao(i, nome)}
                          aria-expanded={posSel === i}
                          className={`flex w-full items-center gap-1.5 py-1.5 text-left ${posSel === i ? 'text-primary' : ''}`}
                        >
                          <span className="w-4 shrink-0 text-right text-[11px] font-bold tabular-nums text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">{nome}</span>
                          {papel && <span className="shrink-0 rounded-md bg-primary/10 px-1 py-0.5 text-[9.5px] font-bold text-primary">{papel}</span>}
                          {ajuda && <span className="shrink-0 rounded-md bg-info/15 px-1 py-0.5 text-[9.5px] font-bold text-info">ajuda</span>}
                          {/* SEM a contagem de casos (dono 17/08): o número por
                              pessoa confundia quem confere. Quem está na ordem sem
                              cirurgia nenhuma — o detector da extração torta (IOSC,
                              23/07) — fica com o ponto âmbar, e o porquê é lido uma
                              vez em Pendências. */}
                          {suspeito && (
                            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-warning" title="na ordem sem nenhuma cirurgia" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                  {ordemNumerada.length === 0 && (
                    <li className="px-2.5 py-3 text-xs text-muted-foreground">
                      Nenhum nome lido do rodapé — acrescente abaixo ou use “Preencher da atribuição”.
                    </li>
                  )}
                </ul>
                {/* Editor da posição FORA do fluxo de colunas: dentro de uma coluna
                    de ~200px os quatro botões não cabem lado a lado. */}
                {posAberta && (
                  <div className="space-y-2 border-t border-border bg-muted/30 px-2.5 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Posição {posAberta.i + 1}
                    </p>
                    <Input
                      aria-label={`Nome na posição ${posAberta.i + 1}`}
                      value={rascunhoNome}
                      onChange={(e) => setRascunhoNome(e.target.value)}
                      onBlur={renomearPosicao}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" disabled={posAberta.i === 0}
                        onClick={() => moverPosicao(posAberta.i, -1)} aria-label="Subir uma posição">
                        <ArrowUp className="h-4 w-4" /> Subir
                      </Button>
                      <Button size="sm" variant="outline" disabled={posAberta.i === ordemNumerada.length - 1}
                        onClick={() => moverPosicao(posAberta.i, 1)} aria-label="Descer uma posição">
                        <ArrowDown className="h-4 w-4" /> Descer
                      </Button>
                      <Button size="sm" variant={posAberta.ajuda ? 'primary' : 'outline'}
                        onClick={() => marcarAjuda(posAberta.nome, !posAberta.ajuda)} aria-pressed={posAberta.ajuda}>
                        Ajuda
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removerPosicao(posAberta.i)}>
                        <Trash2 className="h-4 w-4" /> Remover
                      </Button>
                    </div>
                    {/* Plantonista e "sai 1º" são da POSIÇÃO, não da
                        pessoa — por isso não têm botão: quem muda esses
                        selos é mover o nome. */}
                    <p className="text-xs text-muted-foreground">
                      1ª posição = plantonista · última = sai 1º (plantão do turno seguinte).
                      Mova o nome para mudar esses selos. Marque <b>Ajuda</b> em quem veio de outro
                      hospital (nome em AZUL no rodapé).
                    </p>
                  </div>
                )}
                {/* DECISÕES DO DIA (dono 31/08, modelo B): coladas na fila que
                    elas mudam. A linha aberta abre a folha; a respondida fica
                    verde com "Refazer". A explicação de cada uma mora na folha,
                    não em aviso solto no fim da página. */}
                {temDecisoes && (
                  <div>
                    <div className="flex items-center gap-1.5 border-t border-border bg-muted/45 px-2.5 py-2">
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-[11px] font-extrabold uppercase tracking-wide text-primary">Decisões do dia</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {decisoesAbertas > 0 ? `${decisoesAbertas} por responder` : 'tudo respondido'}
                        {conferenciasSemCirurgia.length > 0 ? ` · ${conferenciasSemCirurgia.length} para conferir` : ''}
                      </span>
                    </div>

                    {duplicidades.map((d) => {
                      const decisao = duplicidadeDecisoes[d.key]
                      const lados = d.ocorrencias
                        .filter((o) => o.casos.length > 0)
                        .map((o) => `${o.hospitalLabel}: ${o.casos.length}`)
                        .join(' · ')
                      // rodapé lá SEM caso lá = a forma clássica da AJUDA (é o
                      // que o cruzamento sugeria) — a linha fica azul e a folha
                      // abre com "Marcar como ajuda" na frente
                      const deFora = d.ocorrencias.filter((o) => o.hospital !== hosp)
                      const soRodapeLa = deFora.length > 0 && deFora.every((o) => o.casos.length === 0)
                      const hospLa = deFora.find((o) => o.noRodape)?.hospitalLabel || deFora[0]?.hospitalLabel
                      if (d.ajudaDeclarada) {
                        // a ajuda marcada AQUI já tem linha verde própria (com o
                        // Refazer); repetir a mesma pessoa em duas linhas verdes
                        // é o ruído que esta reforma veio tirar
                        if (ajudasForaDaOrdem.some((n) => chaveDup(n) === d.key)) return null
                        return (
                          <LinhaDecisao key={`dup-${d.key}`} tom="vd" icone={<Check className="h-4 w-4" />}
                            titulo={`${titleCaseNome(d.nome)} — em dois hospitais`}
                            sub={`Já está como ajuda no rodapé do ${d.ajudaDeclarada} — nada a classificar.`} />
                        )
                      }
                      if (decisao) {
                        return (
                          <LinhaDecisao key={`dup-${d.key}`} tom="vd" icone={<Check className="h-4 w-4" />}
                            titulo={decisao.tipo === 'troca'
                              ? `${titleCaseNome(d.nome)} ⇄ ${nomeCirurgiaoCurto(titleCaseNome(decisao.parceiroNome))} — troca declarada`
                              : `${titleCaseNome(d.nome)} — trabalha nos dois hoje`}
                            sub={decisao.tipo === 'troca'
                              ? 'Executa ao publicar · badge nos dois lados.'
                              : 'Duplicidade confirmada como intencional.'}
                            onRefazer={() => setDuplicidadeDecisoes((p) => {
                              const { [d.key]: _fora, ...resto } = p
                              return resto
                            })} />
                        )
                      }
                      if (soRodapeLa) {
                        return (
                          <LinhaDecisao key={`dup-${d.key}`} tom="az" icone={<UserPlus className="h-4 w-4" />}
                            titulo={`${titleCaseNome(d.nome)} — ajuda de fora?`}
                            sub={`No rodapé da ${hospLa} hoje e com caso aqui.`}
                            onClick={() => setDecisaoAberta({ tipo: 'duplicidade', key: d.key, soRodapeLa: true, hospLa })} />
                        )
                      }
                      return (
                        <LinhaDecisao key={`dup-${d.key}`} tom="am" icone={<ArrowLeftRight className="h-4 w-4" />}
                          titulo={`${titleCaseNome(d.nome)} — em dois hospitais`}
                          sub={`No mesmo turno (${lados}) — troca? intencional? ajuda?`}
                          onClick={() => setDecisaoAberta({ tipo: 'duplicidade', key: d.key })} />
                      )
                    })}

                    {ajudaProvavelSemDup.map((a) => (
                      <LinhaDecisao key={`aj-${a.nome}`} tom="az" icone={<UserPlus className="h-4 w-4" />}
                        titulo={`${titleCaseNome(a.nome)} — ajuda de fora?`}
                        sub={`No rodapé da ${a.hospital} hoje e com caso aqui.`}
                        onClick={() => setDecisaoAberta({ tipo: 'ajudaSugerida', nome: a.nome, hospital: a.hospital })} />
                    ))}

                    {ajudasForaDaOrdem.map((nome) => (
                      <LinhaDecisao key={`ajm-${nome}`} tom="vd" icone={<Check className="h-4 w-4" />}
                        titulo={`${titleCaseNome(nome)} — marcado como ajuda`}
                        sub="Vai ao fim da fila e sai primeiro."
                        onRefazer={() => marcarAjuda(nome, false)} />
                    ))}

                    {azuisRealocados.map((a) => (
                      <LinhaDecisao key={`empr-${normNome(a.nome)}`} tom="az" icone={<UserPlus className="h-4 w-4" />}
                        titulo={`${titleCaseNome(a.nome)} — emprestado ao ${a.hospitalLabel}`}
                        sub={'O azul do mapa é "nosso, emprestado": mantém a posição daqui e sai primeiro lá.'}
                        onRefazer={() => {
                          marcarAjuda(a.nome, true)
                          setAzuisRealocados((p) => p.filter((x) => normNome(x.nome) !== normNome(a.nome)))
                        }} />
                    ))}

                    {casosForaDoRodape.map((f) => (
                      <LinhaDecisao key={`fora-${f.nome}`} tom="am" icone={<AlertTriangle className="h-4 w-4" />}
                        titulo={`${titleCaseNome(f.nome)} — com caso, fora da ordem`}
                        sub={`${f.casos} caso${f.casos > 1 ? 's' : ''} e não está na ordem nem na ajuda.`}
                        onClick={() => setDecisaoAberta({ tipo: 'foraDaOrdem', nome: f.nome, casos: f.casos })} />
                    ))}

                    {conferenciasSemCirurgia.map((p) => (
                      <LinhaDecisao key={`semc-${p.nome}`} tom="am" ponto
                        titulo={`${p.nome} — na ordem, sem cirurgia`}
                        sub={`${p.pos > 0 ? `${p.pos}ª posição · ` : ''}confira a extração contra a foto.`}
                        onClick={() => setDecisaoAberta({ tipo: 'semCirurgia', nome: p.nome, cauda: p.cauda, pos: p.pos })} />
                    ))}
                  </div>
                )}
                <div className="border-t border-border bg-muted/40 px-2.5 py-2">
                  <Select
                    aria-label="Acrescentar anestesista ao fim do rodapé"
                    placeholder="+ Acrescentar anestesista no fim…"
                    value=""
                    onChange={adicionarNoRodape}
                    options={opcoesParaAcrescentar}
                    searchable
                  />
                </div>
                {ordemNumerada.length > 0 && (
                  <p className="border-t border-border px-2.5 py-2 text-xs text-muted-foreground">
                    {ordemNumerada.length} {ordemNumerada.length === 1 ? 'nome' : 'nomes'} — confira contra o rodapé da imagem:
                    o 1º é o plantonista e o último sai primeiro (plantão do turno seguinte).
                    Toque num nome para corrigir, mover ou marcar ajuda.
                  </p>
                )}
              </div>
              {/* NOME AMBÍGUO (dono 11/08) — vermelho: isto impede publicar */}
            </section>

            {/* PENDÊNCIAS num lugar só (dono 17/08): o que impede publicar e o que
                pede conferência ficavam espalhados entre os seletores, os blocos e
                a fila. Aqui a ordem é a da gravidade — vermelho primeiro. */}
            <section id="conf-pendencias" className="scroll-mt-28 space-y-2">
              <h2 className="text-[15px] font-extrabold">
                Pendências
                {totalPendencias > 0 && (
                  <span className="ml-1.5 text-[11.5px] font-semibold text-muted-foreground">
                    {bloqueiosConferencia > 0 && `${bloqueiosConferencia} bloqueia${bloqueiosConferencia > 1 ? 'm' : ''}`}
                    {bloqueiosConferencia > 0 && avisosConferencia > 0 && ' · '}
                    {avisosConferencia > 0 && `${avisosConferencia} aviso${avisosConferencia > 1 ? 's' : ''}`}
                  </span>
                )}
              </h2>
              {totalPendencias === 0 && (
                <p className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                  Nada pendente — confira os blocos e a ordem e publique.
                </p>
              )}

              {/* NOME AMBÍGUO (dono 11/08) — vermelho: isto impede publicar */}
              {gruposAmbiguos.length > 0 && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {gruposAmbiguos.map(({ grupo, candidatos }) => (
                    <p key={grupo.chave}>
                      ⛔ <b>{grupo.nome}</b> em {grupo.sala || 'sala sem nome'}: pode ser{' '}
                      {candidatos.map((c) => nomeCirurgiaoCurto(titleCaseNome(c.nome))).join(' ou ')}.
                      Escolha o login — sem sobrenome a sala fica sem dono e some da ordem de liberação.
                    </p>
                  ))}
                </div>
              )}
              {/* "Na ordem sem cirurgia" saiu daqui (dono 31/08): virou linha de
                  DECISÃO no cartão da fila, com o porquê na folha — o aviso
                  solto obrigava a ligar o ponto âmbar de lá com o texto daqui. */}

              {secoesAusentesHro.length > 0 && (
                <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                  ⚠ A leitura não trouxe nenhuma linha de{' '}
                  <b>{secoesAusentesHro.join(', ')}</b>. Essas seções ficam fora da grade principal do
                  mapa do HRO e são as que mais escapam da extração — nas escalas publicadas até 28/08,
                  a Imagem chegou em 15% das importações e a Hemodinâmica em 49%. Confira a imagem e
                  acrescente à mão o que faltar (+ Linha), ou reimporte um print que mostre o mapa inteiro.
                </p>
              )}

              {/* Cirurgia da manhã que atravessa e fica sem dono presente */}
              {travessiasOrfas.length > 0 && (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-1">
                  <p className="text-sm font-semibold text-warning flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {travessiasOrfas.length === 1 ? '1 cirurgia da manhã passa para esta tarde' : `${travessiasOrfas.length} cirurgias da manhã passam para esta tarde`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Marcadas “passa para tarde” e o anestesista delas não está nesta ordem de liberação.
                    Publique e resolva na aba Completa (grupo “Ainda abertas — Manhã”): reatribua a quem está na sala à tarde,
                    ou desmarque o “passa para tarde”. Elas não entram na fila desta tarde.
                  </p>
                  <ul className="space-y-0.5">
                    {travessiasOrfas.map((c) => (
                      <li key={c.id} className="text-xs text-warning">
                        {titleCaseNome(c.anestesista || 'sem anestesista')} · {c.sala || 'sem sala'}
                        {c.hora ? ` · ${c.hora}` : ''}{c.cirurgiao ? ` · ${nomeCirurgiaoCurto(titleCaseNome(c.cirurgiao))}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {duplicados.length > 0 && (
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-1">
                  <p className="text-sm font-semibold text-warning flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Possíveis cirurgias duplicadas
                  </p>
                  {duplicados.map(({ item, quantidade }, i) => (
                    <p key={`${item.sala}-${item.hora}-${i}`} className="text-xs text-warning">
                      {item.sala || 'Sem sala'} · {item.hora || 'sem hora'} · {item.procedimento || item.cirurgiao || 'sem descrição'} aparece {quantidade} vezes. Confira o anexo; nada foi removido automaticamente.
                    </p>
                  ))}
                </div>
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

              {/* Ajuda, cruzamento, duplicidade e fora-da-ordem SAÍRAM daqui
                  (dono 31/08, modelo B): viraram DECISÕES DO DIA no cartão da
                  fila, cada uma com folha própria — aqui era aviso espalhado,
                  sem lugar de preencher. A gravação é a mesma (ajudaTexto,
                  duplicidadeDecisoes, ordemTexto). */}
            </section>
          </>
        )}
      </div>

      {!embutida && temBase && canEdit && (
        <div className="fixed bottom-0 inset-x-0 z-modal border-t border-border bg-card p-3 flex gap-2 max-w-3xl mx-auto">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
          {/* A contagem no botão é a última conferência antes de gravar (dono
              17/08): publicar "3 casos" quando a foto tinha 12 é o erro que a
              secretária pega aqui, não depois. */}
          <Button onClick={() => publicar()} disabled={publicando} className="flex-1">
            {publicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Publicar {selecionarCasosDoTurno(casos, periodo).length} caso{selecionarCasosDoTurno(casos, periodo).length === 1 ? '' : 's'}
          </Button>
        </div>
      )}

      {/* FOLHA DE DECISÃO (dono 31/08, modelo B): uma pergunta por vez, as
          saídas explícitas em botões de largura inteira. Cada botão grava o
          MESMO dado que a superfície antiga gravava — a folha é só o lugar. */}
      {decisaoAberta && (() => {
        const fechar = () => setDecisaoAberta(null)
        const dup = decisaoAberta.tipo === 'duplicidade'
          ? duplicidades.find((d) => d.key === decisaoAberta.key)
          : null
        if (decisaoAberta.tipo === 'duplicidade' && !dup) return null
        const parceiro = dup ? rosterByUid.get(trocaEscolhida[dup.key]) : null
        const nomeCurto = (n) => nomeCirurgiaoCurto(titleCaseNome(n))
        return (
          <Sheet open onOpenChange={(o) => !o && fechar()}>
            <SheetContent side="bottom" className="!h-auto max-h-[88vh] overflow-y-auto">
              {decisaoAberta.tipo === 'duplicidade' && (
                <>
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      {decisaoAberta.soRodapeLa
                        ? <UserPlus className="h-5 w-5 shrink-0 text-info" />
                        : <ArrowLeftRight className="h-5 w-5 shrink-0 text-warning" />}
                      {decisaoAberta.soRodapeLa
                        ? `${nomeCurto(dup.nome)} — ajuda de fora?`
                        : `${nomeCurto(dup.nome)} aparece em dois hospitais`}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3 pb-2">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {decisaoAberta.soRodapeLa
                        ? `Está no rodapé da ${decisaoAberta.hospLa} hoje, no mesmo turno, e tem caso aqui. Nome em AZUL no rodapé é ajuda: vai ao fim da fila e sai primeiro.`
                        : `No mesmo turno (${periodo === 'matutino' ? 'matutino' : 'vespertino'}). Na foto, nome em AMARELO costuma ser intencional — a pessoa trabalha nos dois de propósito.`}
                    </p>
                    {decisaoAberta.soRodapeLa && (
                      <Button className="w-full" onClick={() => { marcarAjuda(dup.nome, true); fechar() }}>
                        Marcar como ajuda — vai ao fim da fila
                      </Button>
                    )}
                    <div className="space-y-1.5">
                      {dup.ocorrencias.map((ocorrencia) => (
                        <div key={`${dup.key}-${ocorrencia.hospital}`}
                          className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
                          <p className="font-semibold text-foreground">{formatarOcorrenciaDuplicidade(ocorrencia)}</p>
                          {ocorrencia.casos.length > 0 && (
                            <p className="mt-0.5 text-muted-foreground">
                              {ocorrencia.casos.map((caso) => `${caso.sala} · ${caso.hora} · ${caso.procedimento}`).join(' | ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Com QUEM trocou é escolha de quem publica: o colega não é
                        deduzível da imagem. O par simétrico vem pré-sugerido
                        (sugerirParceiroTroca) quando é único. */}
                    <Select
                      searchable
                      className="w-full"
                      placeholder="Trocou com quem?"
                      value={trocaEscolhida[dup.key] || ''}
                      onChange={(v) => setTrocaEscolhida((p) => ({ ...p, [dup.key]: v }))}
                      options={rosterOpcoes.filter((o) => o.value !== dup.key)}
                    />
                    <div className="space-y-1.5">
                      <Button
                        className="w-full"
                        disabled={!parceiro}
                        onClick={() => {
                          if (!parceiro) return
                          // nome COMPLETO do cadastro: o cruzamento entre
                          // hospitais casa por normNome do nome completo
                          setDuplicidadeDecisoes((p) => ({
                            ...p,
                            [dup.key]: { tipo: 'troca', parceiroUid: parceiro.uid, parceiroNome: parceiro.nome },
                          }))
                          fechar()
                        }}
                      >
                        {parceiro ? `Trocou com ${nomeCurto(parceiro.nome)} — declarar a troca` : 'Declarar a troca — escolha o colega'}
                      </Button>
                      <Button variant="outline" className="w-full"
                        onClick={() => { setDuplicidadeDecisoes((p) => ({ ...p, [dup.key]: { tipo: 'intencional' } })); fechar() }}>
                        Trabalha nos dois hoje (intencional)
                      </Button>
                      {!decisaoAberta.soRodapeLa && (
                        <Button variant="outline" className="w-full"
                          onClick={() => { marcarAjuda(dup.nome, true); fechar() }}>
                          É ajuda aqui — vai ao fim da fila
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      A troca declarada executa ao publicar e aparece com badge nos dois lados. Nada muda na ordem publicada.
                    </p>
                  </div>
                </>
              )}

              {decisaoAberta.tipo === 'ajudaSugerida' && (
                <>
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5 shrink-0 text-info" />
                      {nomeCurto(decisaoAberta.nome)} — ajuda de fora?
                    </SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3 pb-2">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Está no rodapé da {decisaoAberta.hospital} hoje, no mesmo turno, e tem caso aqui.
                      Nome em AZUL no rodapé é ajuda: vai ao fim da fila e sai primeiro.
                    </p>
                    <div className="space-y-1.5">
                      <Button className="w-full"
                        onClick={() => { marcarAjuda(decisaoAberta.nome, true); fechar() }}>
                        Marcar como ajuda
                      </Button>
                      <Button variant="outline" className="w-full"
                        onClick={() => { acrescentarNaOrdem(decisaoAberta.nome); fechar() }}>
                        Não é ajuda — acrescentar à ordem no fim
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {decisaoAberta.tipo === 'foraDaOrdem' && (
                <>
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                      {nomeCurto(decisaoAberta.nome)} tem caso e está fora da ordem
                    </SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3 pb-2">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Sem posição, entra como linha extra no fim da fila e parece não estar na escala.
                      Quase sempre é um dos dois: nome em AZUL que a leitura não reconheceu (é ajuda),
                      ou nome que caiu do rodapé na leitura.
                    </p>
                    <div className="space-y-1.5">
                      <Button className="w-full"
                        onClick={() => { marcarAjuda(decisaoAberta.nome, true); fechar() }}>
                        Marcar como ajuda
                      </Button>
                      <Button variant="outline" className="w-full"
                        onClick={() => { acrescentarNaOrdem(decisaoAberta.nome); fechar() }}>
                        Acrescentar à ordem (no fim)
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {decisaoAberta.tipo === 'semCirurgia' && (
                <>
                  <SheetHeader>
                    <SheetTitle>{decisaoAberta.nome} está na ordem sem nenhuma cirurgia</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-3 pb-2">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Confira a extração contra a foto: a linha dela pode ter saído para outra pessoa
                      (foi o que sumiu com Didomenico/Melo no IOSC em 23/07).
                    </p>
                    {decisaoAberta.cauda && (
                      <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                        Fechando a lista sem cirurgia, vai nascer <b>LIBERADO</b> (vermelho) na fila desta publicação.
                      </p>
                    )}
                    {/* SAÍDAS, não "Entendi" (dono 31/08): as três respostas
                        reais para o nome sem caso — é ajuda (azul não lido), a
                        posição precisa de conserto, ou o nome sobrou da leitura. */}
                    <div className="space-y-1.5">
                      <Button variant="outline" className="w-full"
                        onClick={() => { marcarAjuda(decisaoAberta.nome, true); fechar() }}>
                        Marcar como ajuda (nome em AZUL não lido)
                      </Button>
                      {decisaoAberta.pos > 0 && (
                        <Button variant="outline" className="w-full"
                          onClick={() => {
                            fechar()
                            abrirPosicao(decisaoAberta.pos - 1, decisaoAberta.nome)
                            irPara('conf-liberacoes')
                          }}>
                          Corrigir a posição na ordem
                        </Button>
                      )}
                      {decisaoAberta.pos > 0 && (
                        <Button variant="outline" className="w-full"
                          onClick={() => { removerPosicao(decisaoAberta.pos - 1); fechar() }}>
                          Remover da ordem
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      Se foi troca, a duplicidade aparece nas decisões quando a escala do outro hospital é lida.
                    </p>
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        )
      })()}

      {/* Confirmação anti-perda: substituir uma escala maior por uma menor apaga casos */}
      {substituir && (
        <ConfirmDialog
          open
          variant="danger"
          onClose={() => setSubstituir(null)}
          onConfirm={() => { setSubstituir(null); publicar({ confirmacao: true, substituicao: true }) }}
          title="Isso vai reduzir a escala do dia?"
          description={`O dia tem ${substituir.atuais} itens e esta publicação deixaria ${substituir.novos} — ${substituir.atuais - substituir.novos} item(ns) seriam apagados e não dá para desfazer. Se você só quer acrescentar uma cirurgia, cancele e use "Adicionar caso" na aba Completa.`}
          confirmText="Republicar por cima"
          cancelText="Cancelar"
        />
      )}

      <ConfirmDialog
        open={confirmacaoPublicacao}
        onClose={() => setConfirmacaoPublicacao(false)}
        onConfirm={() => { setConfirmacaoPublicacao(false); publicar({ confirmacao: true }) }}
        title="Confirmar publicação da escala"
        description={`${HOSPITAL_LABEL[hosp]} · ${formatData(dataEscolhida)} · ${periodo === 'matutino' ? 'Matutino' : 'Vespertino'}. Serão publicados ${resumoTexto(selecionarCasosDoTurno(casos, periodo))}. Confirme hospital, data e turno antes de continuar.`}
        confirmText="Publicar escala"
        cancelText="Voltar e revisar"
      />
    </div>
  )
})

export default ImportarEscalaPage
