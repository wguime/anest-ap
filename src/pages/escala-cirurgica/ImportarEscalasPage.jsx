/**
 * ImportarEscalasPage — o LOTE do dia útil (dono 2026-08-27).
 *
 * "Ao adicionar os arquivos das escalas em dias úteis, quero que verifique a
 * possibilidade de adicionar como é feito no final de semana: adicionar todos os
 * arquivos e após fazer a conferência" + "na tela de conferência quero uma aba
 * de conferência para cada hospital para realizar ajustes".
 *
 * O que muda: o anexo aceita TODOS os arquivos de uma vez e cada um se declara
 * pelo layout (`hospitalDetectado`, que a leitura já devolvia e a tela só usava
 * como sugestão); a conferência ganha uma ABA por hospital.
 * O que NÃO muda (dono, na mesma conversa): "continuarei anexando as escalas um
 * turno por vez" — data e período são do LOTE, um só cartão —, e a conferência
 * de cada aba é a de sempre, inteira: rodapé, ajuda, duplicidades, trocas e
 * guardrails seguem em `ImportarEscalaPage`, que não foi refatorada.
 *
 * ⚠️ As abas são instâncias MONTADAS e escondidas (`oculta`), nunca `Tabs` do
 * DS: `TabsContent` desmonta o painel inativo e o estado local morre na troca
 * (limite do DS já registrado em `padroes-codigo.md`, com dado de paciente
 * perdido). Aqui, desmontar apagaria a conferência já feita naquele hospital.
 *
 * A publicação continua sendo UMA POR HOSPITAL, pela mesma via de sempre — a
 * folha de revisão só chama, em sequência, o `publicar` de cada aba.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import {
  Alert, Button, ConfirmDialog, DatePicker, FileUpload, Progress, Select,
  Sheet, SheetContent, SheetHeader, SheetTitle, useToast,
} from '@/design-system'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import { parseExcelEscala } from '@/lib/excelEscala'
import { prepararImagemParaVision } from '@/lib/imagemVision'
import { ERRO_IA, classificarFalhaVision, mensagemFalhaVision } from '@/lib/escalaVisionFalha'
import { ehDataFilaUnica, ehFeriado } from '@/lib/escalaFds'
import {
  HOSPITAIS_LOTE, classificarAnexoDiaUtil, estadoEscala,
  planoPublicacaoLote, rotuloPublicacaoLote, resumirPublicacaoLote,
} from '@/lib/escalaLoteImportacao'
import {
  chaveRascunho, lerRascunho, montarRascunho, criarGravadorRascunho, apagarRascunho,
  descreverMomentoRascunho, escalaMudouDepoisDoRascunho,
} from '@/lib/escalaLoteRascunho'
import { formatData, novaIdLinha, turnoAtual } from './utils'
import { segurarAtualizacao, liberarAtualizacao } from '@/lib/atualizacaoAdiada'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { normalizarTrabalho } from './trabalhoConferencia'
import { podeEditarEscalaCirurgica } from './gate'
import ImportarEscalaPage from './ImportarEscalaPage'
import SegmentedSelector from './SegmentedSelector'

const PERIODO_OPCOES = [
  { value: 'matutino', label: 'Manhã' },
  { value: 'vespertino', label: 'Tarde' },
]
const HOSPITAL_OPCOES = HOSPITAIS_LOTE.map((v) => ({ value: v, label: HOSPITAL_LABEL[v] || v }))
const dataToISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const ehPlanilha = (file) => /\.(xlsx?|csv)$/i.test(file?.name || '')
const rotulo = (h) => HOSPITAL_LABEL[h] || h || 'outro hospital'

/**
 * Selo de estado da aba — CÍRCULO (dono 27/08), mesmo diâmetro do badge do
 * SegmentedSelector do DS (h-5 = 20px). Vermelho é o que o `publicar` recusa
 * (nome ambíguo, duplicidade não classificada); âmbar é aviso, que publica
 * assim mesmo; ✓ é escala pronta. É a taxonomia que a barra de pendências da
 * conferência já usa — aqui ela só passa a ser visível POR HOSPITAL.
 */
function SeloEstado({ estado, ativa }) {
  const anel = ativa ? 'ring-[1.5px] ring-white/55' : ''
  if (estado.tipo === 'trava') {
    return (
      <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1
        text-[11px] font-bold leading-none bg-destructive text-destructive-foreground ${anel}`}>
        {estado.n}
      </span>
    )
  }
  if (estado.tipo === 'avisa') {
    return (
      <span className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1
        text-[11px] font-bold leading-none bg-warning text-warning-foreground ${anel}`}>
        {estado.n}
      </span>
    )
  }
  if (estado.tipo === 'vazio') return null
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full
      bg-success text-success-foreground ${anel}`} aria-label="pronta">
      <Check className="h-[13px] w-[13px]" strokeWidth={2.6} />
    </span>
  )
}

export default function ImportarEscalasPage({ hospital, data, turno: turnoInicial, onClose, onAbrirFds }) {
  const { toast } = useToast()
  const { user } = useUser()
  const canEdit = podeEditarEscalaCirurgica(user)

  const [dataEscolhida, setDataEscolhida] = useState(data)
  // trocar o dia ou o período do lote invalida toda decisão já tomada
  const [periodo, setPeriodo] = useState(() => (
    turnoInicial === 'matutino' || turnoInicial === 'vespertino' ? turnoInicial : turnoAtual()
  ))
  // hospital -> lote LIDO (rows + rodapé), a matéria-prima da aba
  const [itens, setItens] = useState({})
  // arquivos que a leitura não conseguiu atribuir: o item pede o hospital em
  // vez de a tela escolher sozinha (regra da casa: sugere, nunca troca sozinho)
  const [pendentes, setPendentes] = useState([])
  const [abaAtiva, setAbaAtiva] = useState(hospital || null)
  const [resumos, setResumos] = useState({})
  const [carregando, setCarregando] = useState(false)
  const [progresso, setProgresso] = useState(null) // { feitos, total } durante a leitura
  // ESTADO POR ARQUIVO (dono 03/09, protótipo L8): a espera durava de 30 a 90 s numa linha
  // de texto só, e os problemas chegavam num toast de 12 s que sumia sozinho. Agora cada
  // arquivo diz em que pé está, e o que deu errado FICA na tela até a pessoa tirar.
  const [arquivos, setArquivos] = useState([]) // [{ nome, estado, resultado, problemas[] }]
  // decisões de duplicidade valem para o LOTE inteiro: a duplicidade é da
  // pessoa, não da aba (dono 30/08) — ver `ImportarEscalaPage`
  const [duplicidadeDecisoes, setDuplicidadeDecisoes] = useState({})
  const [trocaEscolhida, setTrocaEscolhida] = useState({})
  const [revisar, setRevisar] = useState(false)
  const [publicandoLote, setPublicandoLote] = useState(false)
  const [encolhimentos, setEncolhimentos] = useState(null)
  const [publicados, setPublicados] = useState([])
  // resultado da última tentativa, por hospital: a FOLHA é a superfície do resultado
  const [resultados, setResultados] = useState({})
  const [publicandoAgora, setPublicandoAgora] = useState(null)
  const refs = useRef({})
  // hospital -> TRABALHO da aba (ver `trabalhoConferencia.js`): o pai é o dono para poder
  // gravar o rascunho; a aba lê e escreve por `onTrabalho(updater)`
  const [trabalhos, setTrabalhos] = useState({})
  const onTrabalhoRefs = useRef({})
  const onTrabalhoDe = (h) => {
    if (!onTrabalhoRefs.current[h]) {
      onTrabalhoRefs.current[h] = (updater) => setTrabalhos((prev) => {
        const atual = prev[h] || null
        const novo = typeof updater === 'function' ? updater(atual) : updater
        return novo === atual ? prev : { ...prev, [h]: novo }
      })
    }
    return onTrabalhoRefs.current[h]
  }
  // rascunho restaurado ao abrir (faixa + comparação com a escala publicada)
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(null)
  const [descartarAberto, setDescartarAberto] = useState(false)
  const [republicarAlvo, setRepublicarAlvo] = useState(null)
  const criadoEmRef = useRef(null)
  // desligado depois de publicar tudo ou descartar: o efeito de gravação não pode
  // reescrever o que acabou de ser apagado
  const rascunhoDesligadoRef = useRef(false)

  // trocar o dia ou o período do lote invalida toda decisão já tomada
  useEffect(() => { setDuplicidadeDecisoes({}); setTrocaEscolhida({}) }, [dataEscolhida, periodo])

  const hospitaisDoLote = useMemo(
    () => HOSPITAIS_LOTE.filter((h) => itens[h]),
    [itens],
  )
  const temLote = hospitaisDoLote.length > 0
  const aba = abaAtiva && itens[abaAtiva] ? abaAtiva : hospitaisDoLote[0] || null

  // ── RASCUNHO DURÁVEL (Onda 2; audit A7) ─────────────────────────────────────
  // A conferência vivia só na memória do React e o app se recarrega sozinho (deploy ao
  // voltar do 2º plano, a cada 15 min, iOS matando a PWA). Tudo que a secretária faz
  // vai para `escala-lote:<data>:<turno>` com 500 ms de debounce; ao reabrir a mesma data
  // e turno, volta com a faixa "Rascunho de HH:MM restaurado". Nunca a imagem.
  const chave = chaveRascunho(dataEscolhida, periodo)
  const gravador = useMemo(() => criarGravadorRascunho({ chave }), [chave])
  // ao trocar de chave (data/período) ou desmontar, o pendente da chave anterior é gravado
  useEffect(() => () => { gravador.flush() }, [gravador])
  // a chave mudou COM lote na mão: o trabalho foi junto, então o rascunho antigo sai
  const chaveAnteriorRef = useRef(chave)
  useEffect(() => {
    const anterior = chaveAnteriorRef.current
    chaveAnteriorRef.current = chave
    if (anterior && anterior !== chave && temLote) apagarRascunho(anterior)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  // Restaura ao abrir (e ao trocar data/período sem lote na mão — quem abre de manhã e
  // vai para "Tarde" encontra a conferência da tarde). Com lote na tela, o que está na
  // tela manda.
  useEffect(() => {
    if (temLote || !chave) return
    const r = lerRascunho(chave)
    if (!r.ok) return
    const { rascunho } = r
    const itensR = {}
    const trabalhosR = {}
    for (const [h, v] of Object.entries(rascunho.hospitais)) {
      if (!HOSPITAIS_LOTE.includes(h) || !v?.lido?.lote) continue
      itensR[h] = { hospital: h, nome: v.lido.nome || '', truncado: !!v.lido.truncado, lote: v.lido.lote }
      if (v.trabalho) trabalhosR[h] = normalizarTrabalho(v.trabalho)
    }
    if (!Object.keys(itensR).length) return
    rascunhoDesligadoRef.current = false
    criadoEmRef.current = rascunho.criadoEm
    setItens(itensR)
    setTrabalhos(trabalhosR)
    setDuplicidadeDecisoes(rascunho.decisoes || {})
    setTrocaEscolhida(rascunho.trocas || {})
    setPublicados((rascunho.publicados || []).filter((h) => itensR[h]))
    setAbaAtiva(rascunho.abaAtiva && itensR[rascunho.abaAtiva] ? rascunho.abaAtiva : Object.keys(itensR)[0])
    setRascunhoRestaurado({
      criadoEm: rascunho.criadoEm,
      atualizadoEm: rascunho.atualizadoEm,
      hospitais: Object.fromEntries(Object.keys(itensR).map((h) => [h, {
        escalaPublicadaUpdatedAt: rascunho.hospitais[h]?.escalaPublicadaUpdatedAt || null,
      }])),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  // Grava a cada mudança (debounce no gravador). O `updated_at` da escala publicada de
  // cada hospital vai junto — é o que permite avisar, ao restaurar, se ela mudou depois.
  useEffect(() => {
    if (!temLote || rascunhoDesligadoRef.current) return
    const rascunho = montarRascunho({
      data: dataEscolhida,
      turno: periodo,
      hospitais: Object.fromEntries(hospitaisDoLote.map((h) => [h, {
        lido: { nome: itens[h].nome, truncado: !!itens[h].truncado, lote: itens[h].lote },
        trabalho: trabalhos[h] || null,
        escalaPublicadaUpdatedAt: resumos[h]?.publicadaAtualizadaEm || null,
      }])),
      decisoes: duplicidadeDecisoes,
      trocas: trocaEscolhida,
      publicados,
      abaAtiva: aba,
      criadoEm: criadoEmRef.current,
    })
    if (!rascunho) return
    criadoEmRef.current = rascunho.criadoEm
    gravador.agendar(rascunho)
  }, [gravador, temLote, hospitaisDoLote, itens, trabalhos, resumos, duplicidadeDecisoes, trocaEscolhida,
    publicados, aba, dataEscolhida, periodo])

  // O iOS mata a PWA em 2º plano sem esperar timer nenhum: ao esconder a página, grava já.
  useEffect(() => {
    const aoEsconder = () => { if (document.visibilityState === 'hidden') gravador.flush() }
    const aoSair = () => { gravador.flush() }
    document.addEventListener('visibilitychange', aoEsconder)
    window.addEventListener('pagehide', aoSair)
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder)
      window.removeEventListener('pagehide', aoSair)
    }
  }, [gravador])

  // ── O APP PARA DE SE RECARREGAR NO MEIO (Onda 2, item 2.3) ─────────────────
  // Com lote aberto, `pwaUpdate` adia o reload (deploy ao voltar do 2º plano, intervalo
  // de 15 min) até esta tela fechar. Declarado DEPOIS dos efeitos do rascunho de
  // propósito: ao desmontar, o flush grava antes de o reload devido acontecer.
  useEffect(() => {
    if (!temLote) return undefined
    segurarAtualizacao('escala-lote')
    return () => liberarAtualizacao('escala-lote')
  }, [temLote])

  // "Cancelar" com trabalho pendente PERGUNTA (protótipo O2-B). Sair não apaga o rascunho —
  // ele volta na próxima abertura da mesma data e turno; o diálogo diz isso.
  const trabalhoPendente = temLote && hospitaisDoLote.some((h) => !publicados.includes(h))
  const guardaSaida = useUnsavedChangesGuard(trabalhoPendente)
  const cancelar = () => guardaSaida.requestClose(() => onClose?.())

  const descartarRascunho = () => {
    rascunhoDesligadoRef.current = true
    gravador.apagar()
    setDescartarAberto(false)
    setRascunhoRestaurado(null)
    criadoEmRef.current = null
    setItens({})
    setTrabalhos({})
    setResumos({})
    setDuplicidadeDecisoes({})
    setTrocaEscolhida({})
    setPublicados([])
    setResultados({})
    setPendentes([])
    refs.current = {}
    setAbaAtiva(null)
  }

  // Hospitais cuja escala publicada mudou DEPOIS do rascunho (outro aparelho publicou, ou
  // a equipe marcou liberações): a aba avisa e, na folha, saem do botão grande — publicar
  // por cima é ação explícita ("Republicar"), como quem já subiu neste lote.
  const alteradasDepois = useMemo(() => {
    if (!rascunhoRestaurado) return []
    return hospitaisDoLote.filter((h) => !publicados.includes(h)
      && escalaMudouDepoisDoRascunho(rascunhoRestaurado, h, resumos[h]?.publicadaAtualizadaEm))
  }, [rascunhoRestaurado, hospitaisDoLote, publicados, resumos])

  /**
   * Leitura nova de um hospital: identidade de linha nasce AQUI (`_lid`), na leitura, para
   * o rascunho e a aba falarem da mesma linha; e trabalho novo — a aba recarrega a
   * conferência a partir da leitura (a foto nova manda, como sempre).
   */
  const receberLeituras = (novos) => {
    const carimbados = {}
    for (const [h, item] of Object.entries(novos)) {
      const lote = item.lote || {}
      carimbados[h] = {
        ...item,
        lote: {
          ...lote,
          rows: (lote.rows || []).map((r) => ({ ...r, _lid: r._lid || novaIdLinha() })),
          posicoes: (lote.posicoes || []).map((r) => ({ ...r, _lid: r._lid || novaIdLinha() })),
        },
      }
    }
    rascunhoDesligadoRef.current = false
    setItens((prev) => ({ ...prev, ...carimbados }))
    setTrabalhos((prev) => {
      const p = { ...prev }
      for (const h of Object.keys(carimbados)) delete p[h]
      return p
    })
  }

  /** O que cada aba conta ao lote (selo, folha de revisão e cruzamento). */
  const receberResumo = useCallback((resumo) => {
    if (!resumo?.hospital) return
    setResumos((prev) => ({ ...prev, [resumo.hospital]: resumo }))
  }, [])

  // Cada aba enxerga as OUTRAS abas — é o que faz a duplicidade entre hospitais
  // existir antes da primeira publicação (antes, o cruzamento só via o que já
  // estava publicado: o primeiro hospital do dia não tinha com o que cruzar).
  const irmasPara = useCallback((hosp) => (
    Object.values(resumos)
      .filter((r) => r.hospital !== hosp && r.totalCasos >= 0)
      .map((r) => ({
        hospital: r.hospital,
        casos: r.casos,
        ordemLiberacao: r.ordemLiberacao,
        ajudaExterna: r.ajudaExterna,
        // azul de EMPRESTADO realocado na aba de origem (01/09): a aba de
        // DESTINO o incorpora à ajuda dela — declaração da foto no lugar certo
        azuisRealocados: r.azuisRealocados,
      }))
  ), [resumos])

  const estadoDe = useCallback((hosp) => {
    const r = resumos[hosp]
    return estadoEscala({ casos: r?.totalCasos || 0, bloqueios: r?.bloqueios || 0, avisos: r?.avisos || 0 })
  }, [resumos])

  // ── LEITURA EM LOTE ────────────────────────────────────────────────────────
  // Um arquivo, uma leitura. Sem hint de hospital (o hospital é justamente o que
  // se quer descobrir) — é como o fim de semana já lê os mapas desde 22/08.
  // Corrigir o hospital à mão no item RELÊ com o hint certo, que é o mecanismo
  // que a tela de uma escala só já tinha.
  const lerArquivo = async (file) => {
    if (ehPlanilha(file)) {
      const { casos: rows, headers } = await parseExcelEscala(file)
      if (!rows.length) return { erro: 'não consegui ler a planilha' }
      // cabeçalho + salas vão junto: é o que separa a planilha do HRO (coluna
      // LEITO) do export da Unimed (IDADE/TEMPO) — antes, toda planilha era
      // Unimed por definição
      const cls = classificarAnexoDiaUtil({ casos: rows, headers }, { planilha: true, dataDoLote: dataEscolhida })
      return { cls, lote: { rows, posicoes: [], ordemLiberacao: [], ajudaExterna: [] }, nome: file.name }
    }
    if (!String(file.type || '').startsWith('image/')) {
      return { erro: 'formato não suportado — envie Excel/CSV ou uma imagem' }
    }
    const img = await prepararImagemParaVision(file)
    const res = await svc.parseEscalaImagem({ imageBase64: img.base64, mimeType: img.mimeType })
    if (res?.error === ERRO_IA) {
      const m = mensagemFalhaVision(
        classificarFalhaVision({ status: res.iaStatus, tipo: res.iaTipo, mensagem: res.iaMensagem }),
      )
      return { erro: m.title }
    }
    if (res?.error === 'extracao_truncada' || res?.error === 'json_invalido') {
      return { erro: 'a leitura foi cortada — envie um print mais fechado' }
    }
    if (!(res.casos || []).length) return { erro: 'nenhuma cirurgia reconhecida' }
    const cls = classificarAnexoDiaUtil(res, { dataDoLote: dataEscolhida })
    return {
      cls,
      nome: file.name,
      arquivo: file,
      truncado: !!res.truncado,
      lote: {
        rows: res.casos || [],
        posicoes: res.posicoesAssistenciais || [],
        // rodapé SUBSTITUI (incidente 30/07): o que a imagem não trouxe fica
        // vazio e visível como vazio, nunca com o valor do anexo anterior
        ordemLiberacao: res.ordemLiberacao || [],
        ajudaExterna: res.ajudaExterna || [],
      },
    }
  }

  const importarArquivos = async (files) => {
    const lista = (Array.isArray(files) ? files : [files]).filter(Boolean)
    if (!lista.length) return
    setCarregando(true)
    setProgresso({ feitos: 0, total: lista.length })
    setArquivos(lista.map((f) => ({ nome: f.name, estado: 'aguardando', problemas: [] })))
    const marcar = (nome, patch) => setArquivos((prev) => prev.map((a) => (a.nome === nome ? { ...a, ...patch } : a)))
    const problemas = []
    const semHospital = []
    const deduzidos = []
    // A CONFERÊNCIA SÓ ABRE COM O LOTE INTEIRO LIDO (dono 27/08): entregando aba
    // por aba, quem anexou três arquivos começava a conferir o primeiro enquanto
    // os outros ainda estavam na Vision — e a tela mudava de tamanho embaixo do
    // dedo, com "Lendo…" ao lado de uma escala já aberta. Aqui as leituras são
    // acumuladas e entram JUNTAS, no fim.
    const prontos = {}
    let lidos = 0
    try {
      for (const [n, file] of lista.entries()) {
        const meus = []
        try {
          marcar(file.name, { estado: 'lendo' })
          const r = await lerArquivo(file)
          if (r.erro) { problemas.push(`${file.name}: ${r.erro}`); marcar(file.name, { estado: 'erro', problemas: [r.erro] }); continue }
          if (r.cls.dataDivergente) {
            problemas.push(`${file.name}: o arquivo mostra ${formatData(r.cls.dataDivergente)}, e o lote é de ${formatData(dataEscolhida)}`)
            meus.push(`data ${formatData(r.cls.dataDivergente)} ≠ lote ${formatData(dataEscolhida)} — confira se é a escala de hoje`)
          }
          // LEITURA CORTADA NÃO ENTRA EM SILÊNCIO (auditoria 31/08): a tela de
          // uma escala avisa isto desde 06/08 e o lote guardava o flag sem
          // avisar nada — a escala sem as últimas linhas ia para a conferência
          // como se estivesse inteira, o modo de falha que o teto de tokens da
          // edge existe para expor.
          if (r.truncado) {
            problemas.push(`${file.name}: a leitura foi cortada — as últimas linhas do mapa podem estar faltando; confira o fim da lista`)
            meus.push('leitura cortada — confira o fim do mapa')
          }
          if (!r.cls.hospital) {
            // conflito entre layout e conteúdo tem motivo próprio: "não
            // reconheci" mandaria procurar defeito na foto, e o problema é outro
            const motivo = r.cls.conflitoHospital
              ? `o conteúdo é do ${rotulo(r.cls.conflitoHospital)}, mas o layout foi lido como ${rotulo(r.cls.hospitalLido)}.`
              : 'não reconheci o hospital pelo layout.'
            semHospital.push({ id: `${file.name}-${semHospital.length}`, nome: file.name, motivo, ...r })
            marcar(file.name, { estado: 'pergunta', problemas: meus, resultado: 'aguardando você dizer o hospital' })
            continue
          }
          const hosp = r.cls.hospital
          // DOIS ARQUIVOS PARA O MESMO HOSPITAL no mesmo lote não é reanexo, é
          // classificação errada de um dos dois (dono 30/08: a escala do HRO
          // não aparecia). Substituir em silêncio apagaria uma escala inteira
          // que a tela já dizia ter lido — então o segundo PERGUNTA de quem é.
          // Reanexar em OUTRO lote continua substituindo, como sempre.
          if (prontos[hosp]) {
            semHospital.push({
              id: `${file.name}-${semHospital.length}`,
              nome: file.name,
              motivo: `o lote já tem uma escala do ${rotulo(hosp)} (${prontos[hosp].nome}).`,
              colisao: true,
              ...r,
            })
            marcar(file.name, { estado: 'pergunta', problemas: meus, resultado: 'aguardando você dizer o hospital' })
            continue
          }
          prontos[hosp] = { hospital: hosp, nome: r.nome, arquivo: r.arquivo, truncado: r.truncado, lote: r.lote }
          lidos += 1
          marcar(file.name, {
            estado: 'ok', problemas: meus,
            resultado: `${rotulo(hosp)} · ${(r.lote?.rows || []).length} caso${(r.lote?.rows || []).length === 1 ? '' : 's'}${r.lote?.ordemLiberacao?.length ? ` · ${r.lote.ordemLiberacao.length} na ordem` : ''}`,
          })
        } catch (err) {
          const msg = err?.name === 'ErroImagem' ? err.message : 'falha na leitura'
          problemas.push(`${file.name}: ${msg}`)
          marcar(file.name, { estado: 'erro', problemas: [msg] })
        } finally {
          setProgresso({ feitos: n + 1, total: lista.length })
        }
      }
    } finally {
      setCarregando(false)
      setProgresso(null)
    }
    // ELIMINAÇÃO NO LOTE (dono 30/08, 2ª rodada: "mesmo após mudanças não
    // reconheceu a escala do HRO, mas apareceu opção de selecionar o hospital").
    //
    // O mapa daquela segunda não tinha marca nenhuma: as salas eram "Sala 3",
    // "Sala 6" — e "Sala N" pelado é dos dois hospitais (o da Unimed às vezes
    // vem só com o número). Mas o LOTE sabe uma coisa que o arquivo sozinho não
    // sabe: se os outros dois já são Unimed e Materno, o que sobra é o HRO. Não
    // é palpite, é conta — e por isso ela só fecha quando sobra UM arquivo para
    // UMA vaga. Com duas vagas livres continua perguntando.
    const naoIdentificados = semHospital.filter((p) => !p.colisao)
    if (naoIdentificados.length === 1) {
      const ocupados = new Set([...Object.keys(prontos), ...Object.keys(itens)])
      const livres = HOSPITAIS_LOTE.filter((h) => !ocupados.has(h))
      if (livres.length === 1) {
        const p = naoIdentificados[0]
        prontos[livres[0]] = { hospital: livres[0], nome: p.nome, arquivo: p.arquivo, truncado: p.truncado, lote: p.lote }
        deduzidos.push({ hospital: livres[0], nome: p.nome })
        marcar(p.nome, { estado: 'ok', resultado: `${rotulo(livres[0])} · por eliminação`, problemas: [`entrou como ${rotulo(livres[0])} por eliminação — confira a aba`] })
        semHospital.splice(semHospital.indexOf(p), 1)
        lidos += 1
      }
    }
    if (Object.keys(prontos).length) {
      receberLeituras(prontos)
      setAbaAtiva((atual) => atual || Object.keys(prontos)[0])
    }
    if (semHospital.length) setPendentes((p) => [...p, ...semHospital])
    if (deduzidos.length) {
      problemas.push(...deduzidos.map((d) => (
        `${d.nome}: entrou como ${rotulo(d.hospital)} — era o único hospital que faltava no lote. Confira a aba.`
      )))
    }
    if (lidos || semHospital.length) {
      toast({
        variant: problemas.length ? 'warning' : 'success',
        duration: problemas.length ? 12000 : undefined,
        title: `${lidos + semHospital.length} escala${lidos + semHospital.length > 1 ? 's lidas' : ' lida'}`,
        description: problemas.length
          ? problemas.join(' · ')
          : (semHospital.length
            ? 'Diga de qual hospital é o arquivo que não se identificou.'
            : 'Confira cada hospital nas abas e publique.'),
      })
    } else {
      toast({
        variant: 'error', duration: 12000,
        title: 'Nenhuma escala foi lida',
        description: problemas.join(' · ') || 'Tente outro arquivo.',
      })
    }
  }

  /** Item que não se identificou: o hospital escolhido à mão RELÊ com o hint. */
  const resolverPendente = async (pendente, hosp) => {
    setPendentes((p) => p.filter((x) => x.id !== pendente.id))
    if (!hosp) return
    if (pendente.arquivo) {
      setCarregando(true)
      try {
        const img = await prepararImagemParaVision(pendente.arquivo)
        const res = await svc.parseEscalaImagem({
          imageBase64: img.base64, mimeType: img.mimeType, hospital: hosp,
        })
        if (!res?.error && (res.casos || []).length) {
          receberLeituras({
            [hosp]: {
              hospital: hosp, nome: pendente.nome, arquivo: pendente.arquivo, truncado: !!res.truncado,
              lote: {
                rows: res.casos, posicoes: res.posicoesAssistenciais || [],
                ordemLiberacao: res.ordemLiberacao || [], ajudaExterna: res.ajudaExterna || [],
              },
            },
          })
          setAbaAtiva((atual) => atual || hosp)
          setCarregando(false)
          return
        }
      } catch { /* cai para o lote já lido */ } finally { setCarregando(false) }
    }
    // releitura não deu: entra com o que já tinha sido lido, sem perder o anexo
    // (nem a marca de truncado — a leitura antiga cortada continua cortada)
    receberLeituras({ [hosp]: { hospital: hosp, nome: pendente.nome, arquivo: pendente.arquivo, truncado: !!pendente.truncado, lote: pendente.lote } })
    setAbaAtiva((atual) => atual || hosp)
  }

  const removerEscala = (hosp) => {
    setItens((prev) => { const p = { ...prev }; delete p[hosp]; return p })
    setTrabalhos((prev) => { const p = { ...prev }; delete p[hosp]; return p })
    setResumos((prev) => { const p = { ...prev }; delete p[hosp]; return p })
    delete refs.current[hosp]
    setAbaAtiva(null)
  }

  // ── PUBLICAÇÃO ─────────────────────────────────────────────────────────────
  const plano = useMemo(
    () => planoPublicacaoLote(hospitaisDoLote.map((h) => ({
      hospital: h,
      casos: resumos[h]?.totalCasos || 0,
      bloqueios: resumos[h]?.bloqueios || 0,
      avisos: resumos[h]?.avisos || 0,
    })), { jaPublicadas: publicados, reservadas: alteradasDepois }),
    [hospitaisDoLote, resumos, publicados, alteradasDepois],
  )

  // Guardrail anti-perda (incidente 23/07: publicar com 1 caso APAGOU os 31 da
  // escala — publicar é DELETE+reinsert). Na tela de uma escala só ele é um
  // diálogo por publicação; no lote precisa ser ANTES, junto, senão a folha
  // dispararia três diálogos em sequência no meio da publicação.
  const encolhem = useMemo(() => plano.publicar
    .map((p) => ({ ...p, publicados: resumos[p.hospital]?.publicados || 0 }))
    .filter((p) => p.publicados >= 3 && p.publicados > p.casos), [plano, resumos])

  const publicarAlvos = async (alvos, { republicacao = false } = {}) => {
    setEncolhimentos(null)
    setPublicandoLote(true)
    setPublicandoAgora(null)
    // republicar um hospital só limpa o resultado DELE; o lote recomeça do zero
    setResultados((p) => (republicacao
      ? Object.fromEntries(Object.entries(p).filter(([h]) => !alvos.some((a) => a.hospital === h)))
      : {}))
    const resultados = []
    try {
      for (const alvo of alvos) {
        const api = refs.current[alvo.hospital]
        if (!api?.publicar) {
          resultados.push({ hospital: alvo.hospital, ok: false, mensagem: 'A aba deste hospital não está pronta — abra e confira.' })
          setResultados((p) => ({ ...p, [alvo.hospital]: { ok: false, mensagem: 'A aba deste hospital não está pronta — abra e confira.' } }))
          continue
        }
        // sequencial de propósito: publicar as três ao mesmo tempo faria três
        // conferências de duplicidade correrem sobre o mesmo dia
        setPublicandoAgora(alvo.hospital)
        // exceção de uma aba não pode derrubar o laço sem resumo (audit A9)
        let r
        try { r = await api.publicar() } catch (err) { r = { ok: false, mensagem: err?.message || 'Falha inesperada nesta escala.' } }
        resultados.push({ hospital: alvo.hospital, ok: !!r?.ok, mensagem: r?.mensagem, motivo: r?.motivo, avisos: r?.avisos })
        setResultados((p) => ({ ...p, [alvo.hospital]: { ok: !!r?.ok, mensagem: r?.mensagem, avisos: r?.avisos, em: new Date() } }))
      }
    } finally { setPublicandoLote(false); setPublicandoAgora(null) }
    const { ok, falhou, tudoCerto } = resumirPublicacaoLote(resultados)
    // acumula: quem subiu numa tentativa anterior continua publicado
    const noAr = [...new Set([...publicados, ...ok])]
    setPublicados(noAr)
    // tudo no ar: o rascunho cumpriu o papel — e não pode voltar amanhã como conferência
    // pendente de uma escala que já está publicada
    if (hospitaisDoLote.every((h) => noAr.includes(h))) {
      rascunhoDesligadoRef.current = true
      gravador.apagar()
    }
    const nomes = (lista) => lista.map((h) => HOSPITAL_LABEL[h] || h).join(', ')
    if (tudoCerto && republicacao) {
      toast({
        variant: 'success',
        title: ok.length > 1 ? `${ok.length} escalas republicadas` : 'Escala republicada',
        description: `${nomes(ok)} · ${formatData(dataEscolhida)} · ${periodo === 'matutino' ? 'Matutino' : 'Vespertino'}.`,
      })
      return
    }
    if (tudoCerto) {
      setRevisar(false)
      toast({
        variant: 'success',
        title: ok.length > 1 ? `${ok.length} escalas publicadas` : 'Escala publicada',
        description: `${nomes(ok)} · ${formatData(dataEscolhida)} · ${periodo === 'matutino' ? 'Matutino' : 'Vespertino'}.`,
      })
      onClose?.({ data: dataEscolhida, hospital: ok[ok.length - 1], turno: periodo })
      return
    }
    // A publicação NÃO é transacional entre hospitais: dizer o que JÁ subiu é o
    // que evita republicar por cima do que está no ar. UM aviso só, com o MOTIVO —
    // a folha fica aberta mostrando o estado de cada hospital (dono 02/09: o erro cru do
    // banco, um verde de outra aba e o "publicação parcial" apareceram juntos na tela).
    const motivo = resultados.find((r) => !r.ok && r.mensagem)?.mensagem
    toast({
      variant: 'error',
      duration: 15000,
      title: ok.length ? `Publicada ${ok.length} de ${resultados.length}` : 'Não foi possível publicar',
      description: [
        ok.length ? `${nomes(ok)} no ar.` : 'Nenhuma escala do lote foi alterada.',
        `${nomes(falhou)}: ${motivo || 'não publicou'}.`,
        ok.length ? 'Corrija e toque de novo — só o que faltou é publicado.' : '',
      ].filter(Boolean).join(' '),
    })
  }

  const publicarLote = () => publicarAlvos(plano.publicar)
  const republicar = (h) => publicarAlvos([{ hospital: h }], { republicacao: true })

  const rotuloBotao = rotuloPublicacaoLote(plano, { rotulos: HOSPITAL_LABEL })
  const podePublicar = plano.publicar.length > 0 && canEdit && !publicandoLote

  return (
    // `data-no-swipe-back`: o gesto da borda esquerda (`useSwipeBack` no <main> do App) é
    // desligado com a conferência aberta — ele fechava a tela inteira sem pergunta (audit A7-iii)
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto" data-no-swipe-back="true">
      {/* Header no padrão do PageHeader do DS — altura 56, sombra, título com
          subtítulo e slot à direita. Continua STICKY em vez de `fixed` (o
          PageHeader é fixed com spacer e, no PWA do iPhone, cobria os
          seletores — motivo já registrado na tela de uma escala só). */}
      <div className="sticky top-0 z-20 border-b border-border bg-card shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button
            type="button"
            onClick={cancelar}
            aria-label="Cancelar"
            className="flex min-h-[44px] min-w-[70px] items-center gap-1 text-primary active:opacity-60"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Cancelar</span>
          </button>
          <div className="mx-2 min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-semibold text-foreground">Confeccionar escalas</h1>
            <p className="-mt-0.5 truncate text-xs text-muted-foreground">
              {formatData(dataEscolhida)} · {periodo === 'matutino' ? 'Matutino' : 'Vespertino'}
            </p>
          </div>
          <div className="flex min-w-[70px] justify-end">
            {temLote && (
              <span className="inline-flex items-center gap-1 rounded-[10px] bg-muted px-2.5 py-1.5
                               text-xs font-bold text-muted-foreground">
                {hospitaisDoLote.length}
                <FileText className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-28">
        {!canEdit && (
          <p className="rounded-lg border-l-4 border-warning bg-warning/10 p-3 text-sm text-foreground dark:bg-warning/15">
            Você não tem permissão para confeccionar escalas.
          </p>
        )}

        {/* RASCUNHO RESTAURADO (Onda 2; protótipo O2-A): a conferência voltou sozinha e a
            faixa diz de quando é. Fica até ser descartada ou até publicar — some sozinha
            seria mais uma coisa que "não persistiu". */}
        {rascunhoRestaurado && temLote && (
          <Alert
            variant="info"
            title={`Rascunho de ${descreverMomentoRascunho(rascunhoRestaurado)} restaurado`}
            action={{ label: 'Descartar', onClick: () => setDescartarAberto(true) }}
            data-testid="faixa-rascunho"
          >
            {hospitaisDoLote.map(rotulo).join(' · ')}.{' '}
            {publicados.length
              ? `Já publicado: ${publicados.map(rotulo).join(', ')}.`
              : 'Nada foi publicado ainda.'}
          </Alert>
        )}

        {/* Data e período são do LOTE: o dono anexa um turno por vez, e as
            escalas dos hospitais são do mesmo dia e do mesmo turno. */}
        <section className="space-y-3 rounded-2xl border border-border-strong bg-card p-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">Para qual escala</h3>
          <div className="grid grid-cols-[1.15fr_1fr] items-start gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Data</label>
              <DatePicker
                className="w-full min-w-0"
                value={(() => { const [y, m, d] = String(dataEscolhida || '').split('-').map(Number); return y ? new Date(y, m - 1, d) : new Date() })()}
                onChange={(d) => { if (d) setDataEscolhida(dataToISO(d)) }}
                placeholder="Data da escala"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Período</label>
              {/* sem size="xs": a 40px o botão ficava mais baixo que o DatePicker
                  e o cartão saía torto (dono 27/08). O padrão do DS é 44px, a
                  mesma altura do campo de data. */}
              <SegmentedSelector options={PERIODO_OPCOES} value={periodo} onChange={setPeriodo} />
            </div>
          </div>
        </section>

        {/* Com o lote na mão o anexo vira BOTÃO: o dropzone tem 126px e, depois
            que as escalas entraram, ele só empurra as abas e a conferência
            para baixo — quem já anexou está conferindo, não anexando. */}
        <FileUpload
          accept=".xlsx,.xls,.csv,image/*"
          multiple
          maxSize={15 * 1024 * 1024}
          variant={temLote ? 'button' : 'dropzone'}
          label={temLote ? 'Falta alguma escala?' : 'Arquivos das escalas'}
          description={temLote
            ? undefined
            : 'Pode soltar todos de uma vez — o hospital sai do próprio arquivo. Excel/CSV ou foto (paciente só por iniciais).'}
          onChange={(f) => importarArquivos(f)}
          disabled={carregando || !canEdit}
        />

        {/* ESPERA COM ESTADO POR ARQUIVO (dono 03/09, protótipo L8). A leitura leva de 30 a
            90 s e mostrava uma linha de texto; os problemas chegavam depois, num toast de
            12 s que cobria o header e sumia sozinho. Agora a barra diz quanto falta, cada
            arquivo diz em que pé está, e o que deu errado FICA na tela até a pessoa tirar. */}
        {(carregando || arquivos.some((a) => a.problemas?.length)) && arquivos.length > 0 && (
          <section className="space-y-2 rounded-2xl border border-border-strong bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {carregando ? 'Lendo as escalas…' : 'Leitura com ressalvas'}
              </p>
              {progresso?.total > 1 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.min(progresso.feitos, progresso.total)} de {progresso.total}
                </span>
              )}
            </div>
            {carregando && progresso?.total > 0 && (
              <Progress value={progresso.feitos} max={progresso.total} size="sm" aria-label="Progresso da leitura" />
            )}
            <ul className="space-y-1.5">
              {arquivos.map((a) => (
                <li key={a.nome} className="space-y-1">
                  <p className="flex items-start gap-2 text-xs">
                    {a.estado === 'lendo' && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />}
                    {a.estado === 'ok' && <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
                    {(a.estado === 'erro' || a.estado === 'pergunta') && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
                    {a.estado === 'aguardando' && <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border-strong" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">{a.nome}</span>
                      {a.resultado && <span className="block text-muted-foreground">{a.resultado}</span>}
                      {a.estado === 'lendo' && <span className="block text-muted-foreground">lendo…</span>}
                    </span>
                  </p>
                  {a.problemas?.map((prob) => (
                    <p key={prob} className="ml-6 rounded-md border-l-4 border-warning bg-warning/10 px-2 py-1 text-xs text-foreground dark:bg-warning/15">
                      {prob}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            {carregando && arquivos.length > 1 && (
              <p className="text-xs text-muted-foreground">A conferência abre quando todas terminarem.</p>
            )}
            {!carregando && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setArquivos([])}>
                Tirar estes avisos
              </Button>
            )}
          </section>
        )}

        {/* Arquivo que não se identificou: PERGUNTA o hospital, não chuta */}
        {pendentes.map((p) => (
          <div key={p.id} className="space-y-2 rounded-xl border border-l-4 border-warning bg-warning/10 p-3 dark:bg-warning/15">
            <p className="flex items-center gap-2 text-xs font-semibold text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {p.nome}: {p.motivo || 'não reconheci o hospital pelo layout.'}
            </p>
            <Select
              options={HOSPITAL_OPCOES}
              value=""
              placeholder="Escolher o hospital"
              onChange={(v) => resolverPendente(p, v)}
            />
          </div>
        ))}

        {/* Atalho do documento de FDS — desvio de rota, não etapa (dono 17/08) */}
        {!temLote && onAbrirFds && (
          <button
            type="button"
            onClick={() => onAbrirFds(ehDataFilaUnica(dataEscolhida) ? dataEscolhida : undefined)}
            className={[
              'w-full rounded-xl border px-3 py-2.5 text-left text-xs',
              ehDataFilaUnica(dataEscolhida)
                ? 'border-primary/50 bg-primary/10 font-medium text-primary'
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

        {/* ── ABAS ── mesmo visual do SegmentedSelector variant="filled" do DS.
            Não é o componente porque o selo de estado é colorido por hospital,
            e mexer no SegmentedSelector alcançaria o app inteiro (Regra #2). */}
        {temLote && (
          <div className="sticky top-14 z-10 -mx-4 bg-background px-4 pb-1 pt-2">
            <div
              className="grid gap-1 rounded-[16px] bg-primary/5 p-1 dark:bg-primary/10"
              style={{ gridTemplateColumns: `repeat(${hospitaisDoLote.length}, minmax(0, 1fr))` }}
              role="tablist"
              aria-label="Hospitais do lote"
            >
              {hospitaisDoLote.map((h) => {
                const ativa = h === aba
                return (
                  <button
                    key={h}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => setAbaAtiva(h)}
                    className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[12px]
                      px-3 py-2.5 text-sm transition-all active:scale-95 ${ativa
                        ? 'bg-primary font-semibold text-primary-foreground shadow-sm'
                        : 'bg-transparent font-medium text-muted-foreground'}`}
                  >
                    {HOSPITAL_LABEL[h] || h}
                    <SeloEstado estado={estadoDe(h)} ativa={ativa} />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Uma instância por hospital: a inativa fica ESCONDIDA, nunca desmontada */}
        {hospitaisDoLote.map((h) => (
          <ImportarEscalaPage
            key={h}
            ref={(api) => { if (api) refs.current[h] = api; else delete refs.current[h] }}
            embutida
            oculta={h !== aba}
            hospital={h}
            data={dataEscolhida}
            turno={periodo}
            dataLote={dataEscolhida}
            periodoLote={periodo}
            loteInicial={itens[h]?.lote}
            trabalho={trabalhos[h] || null}
            onTrabalho={onTrabalhoDe(h)}
            alteradaDepoisDoRascunho={alteradasDepois.includes(h) ? (resumos[h]?.publicadaAtualizadaEm || null) : null}
            escalasIrmas={irmasPara(h)}
            decisoesLote={duplicidadeDecisoes}
            onDecisoesLote={setDuplicidadeDecisoes}
            trocasLote={trocaEscolhida}
            onTrocasLote={setTrocaEscolhida}
            onResumo={receberResumo}
            onClose={() => {}}
          />
        ))}

        {temLote && (
          <button
            type="button"
            onClick={() => removerEscala(aba)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground active:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Tirar {HOSPITAL_LABEL[aba] || aba} do lote
          </button>
        )}
      </div>

      {temLote && canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-modal mx-auto flex max-w-3xl gap-2 border-t border-border bg-card p-3">
          <Button variant="ghost" onClick={cancelar} className="flex-1">Cancelar</Button>
          <Button onClick={() => setRevisar(true)} className="flex-1">
            <Check className="h-4 w-4" /> Revisar e publicar
          </Button>
        </div>
      )}

      {/* ── FOLHA DE REVISÃO (R2, escolhido pelo dono em protótipo) ──
          `!h-auto max-h-[88vh]`: o bottom-sheet do DS fixa h-[85vh] e nasceria
          com 85% da tela mesmo com três linhas (limite já registrado nas rules
          da escala — "a tela fica quase vazia"). */}
      <Sheet open={revisar} onOpenChange={(o) => !o && !publicandoLote && setRevisar(false)}>
        <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
          <SheetHeader className="pb-2">
            <SheetTitle>Revisar antes de publicar</SheetTitle>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              {formatData(dataEscolhida)} · {periodo === 'matutino' ? 'Matutino' : 'Vespertino'}.
              Cada hospital é publicado na sua própria escala, uma de cada vez — como sempre.
            </p>
          </SheetHeader>
          <div className="space-y-2 px-6 pb-2">
            {hospitaisDoLote.map((h) => {
              const r = resumos[h]
              const estado = estadoDe(h)
              const travada = estado.tipo === 'trava'
              const encolhe = encolhem.find((e) => e.hospital === h)
              // A FOLHA É A SUPERFÍCIE DO RESULTADO (dono 02/09): publicada com a hora,
              // publicando agora, ou não publicada COM O MOTIVO em letra legível.
              const res = resultados[h]
              const subiu = publicados.includes(h)
              const alterada = alteradasDepois.includes(h)
              const agora = publicandoAgora === h
              const falhou = res && !res.ok
              return (
                <div
                  key={h}
                  className={`flex w-full items-start gap-2.5 rounded-[13px] border p-3 text-left
                    ${falhou || travada ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-card-elevated'}`}
                >
                  {agora
                    ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
                    : <SeloEstado estado={subiu ? { tipo: 'pronto', n: 0 } : estado} ativa={subiu} />}
                  <span className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => { setAbaAtiva(h); setRevisar(false) }}
                    className="block w-full text-left"
                  >
                    <span className="block text-sm font-bold">{HOSPITAL_LABEL[h] || h}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {subiu && `Publicada${res?.em ? ` · ${res.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''} · `}
                      {agora && 'Publicando… · '}
                      {r?.totalCasos || 0} caso{(r?.totalCasos || 0) === 1 ? '' : 's'}
                      {r?.ordemLiberacao?.length ? ` · ${r.ordemLiberacao.length} na ordem` : ''}
                      {!subiu && travada && ` · ${estado.n} bloqueio${estado.n > 1 ? 's' : ''} — resolva para publicar`}
                      {!subiu && !travada && estado.tipo === 'avisa' && ` · publica com ${estado.n} aviso${estado.n > 1 ? 's' : ''}`}
                      {!subiu && encolhe && ` · reduz de ${encolhe.publicados} para ${encolhe.casos}`}
                    </span>
                    {!subiu && !agora && r?.pendencias?.length > 0 && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {r.pendencias.map((linha) => <span key={linha} className="block">· {linha}</span>)}
                        {r.totalPendencias > r.pendencias.length && (
                          <span className="block">e mais {r.totalPendencias - r.pendencias.length} — toque para ver</span>
                        )}
                      </span>
                    )}
                    {falhou && res.mensagem && (
                      <span className="mt-1.5 block rounded-md border-l-[3px] border-destructive bg-destructive/10 px-2 py-1.5 text-xs text-foreground">
                        {res.mensagem}
                      </span>
                    )}
                  </button>
                  {/* Quem já está no ar (subiu neste lote, ou a escala publicada mudou depois do
                      rascunho) sai do botão grande e ganha o seu "Republicar" — publicar por
                      cima zera as liberações do turno, então é toque próprio, com aviso. */}
                  {alterada && !subiu && !agora && (
                    <span className="mt-1.5 block rounded-md border-l-[3px] border-warning bg-warning/10 px-2 py-1.5 text-xs text-foreground dark:bg-warning/15">
                      A escala {h === 'unimed' ? 'da Unimed' : `do ${HOSPITAL_LABEL[h] || h}`} mudou às{' '}
                      {new Date(resumos[h]?.publicadaAtualizadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })},
                      depois deste rascunho. Fica fora de “{rotuloBotao}”: republicar zera as liberações marcadas.
                    </span>
                  )}
                  {(subiu || alterada) && !agora && canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={publicandoLote || travada}
                      onClick={() => setRepublicarAlvo(h)}
                    >
                      <RefreshCw className="h-4 w-4" /> Republicar {HOSPITAL_LABEL[h] || h}
                    </Button>
                  )}
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              )
            })}
            {plano.foraDoLote.some((f) => f.motivo === 'bloqueio') && (
              <p className="rounded-lg border-l-4 border-destructive bg-destructive/10 px-3 py-2 text-xs text-foreground dark:bg-destructive/15">
                Quem tem bloqueio fica de fora desta publicação — os outros hospitais publicam
                normalmente. Toque no hospital para resolver e publique de novo.
              </p>
            )}
          </div>
          <div className="flex gap-2 px-6 pb-6 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setRevisar(false)} disabled={publicandoLote}>
              Voltar
            </Button>
            <Button
              className="flex-1"
              disabled={!podePublicar}
              onClick={() => (encolhem.length ? setEncolhimentos(encolhem) : publicarLote())}
            >
              {publicandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {rotuloBotao}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Anti-perda do lote inteiro, numa pergunta só */}
      {encolhimentos && (
        <ConfirmDialog
          open
          variant="danger"
          onClose={() => setEncolhimentos(null)}
          onConfirm={publicarLote}
          title="Isso vai reduzir escala publicada?"
          description={`${encolhimentos.map((e) => `${HOSPITAL_LABEL[e.hospital] || e.hospital}: ${e.publicados} → ${e.casos}`).join(' · ')}. Os casos a mais seriam apagados e não dá para desfazer. Se você só quer acrescentar uma cirurgia, cancele e use "Adicionar caso" na aba Completa.`}
          confirmText="Republicar por cima"
          cancelText="Cancelar"
        />
      )}

      {/* Sair com trabalho pendente pergunta — e diz que o rascunho fica (protótipo O2-B) */}
      <ConfirmDialog
        open={guardaSaida.confirmOpen}
        onClose={guardaSaida.cancelClose}
        onConfirm={guardaSaida.confirmClose}
        title="Sair da conferência?"
        description={`O que você já conferiu fica guardado neste aparelho e volta quando você abrir de novo a importação de ${formatData(dataEscolhida)} · ${periodo === 'matutino' ? 'Manhã' : 'Tarde'}. Nada foi publicado.`}
        confirmText="Sair"
        cancelText="Continuar conferindo"
      />

      {/* Descartar o rascunho restaurado: some deste aparelho; as escalas publicadas não mudam */}
      <ConfirmDialog
        open={descartarAberto}
        variant="danger"
        onClose={() => setDescartarAberto(false)}
        onConfirm={descartarRascunho}
        title="Descartar o rascunho?"
        description={`A conferência de ${hospitaisDoLote.map(rotulo).join(', ')} guardada ${rascunhoRestaurado ? `às ${descreverMomentoRascunho(rascunhoRestaurado)}` : 'neste aparelho'} some daqui. As escalas já publicadas não mudam.`}
        confirmText="Descartar"
        cancelText="Manter"
      />

      {/* Republicar por cima do que está no ar: DELETE+reinsert zera liberações e tempos do turno */}
      <ConfirmDialog
        open={!!republicarAlvo}
        variant="danger"
        onClose={() => setRepublicarAlvo(null)}
        onConfirm={() => { const h = republicarAlvo; setRepublicarAlvo(null); if (h) republicar(h) }}
        title={`Republicar ${republicarAlvo ? (HOSPITAL_LABEL[republicarAlvo] || republicarAlvo) : ''}?`}
        description={`Publicar por cima substitui o turno inteiro desta escala: as liberações marcadas e os tempos deste turno são zerados e não dá para desfazer. ${formatData(dataEscolhida)} · ${periodo === 'matutino' ? 'Matutino' : 'Vespertino'}.`}
        confirmText="Republicar por cima"
        cancelText="Cancelar"
      />

      {/* Publicação parcial: as abas que subiram ficam ditas na tela, não só no
          toast, porque o toast some e a tela continua aberta. */}
      {publicados.length > 0 && !publicandoLote && !revisar && (
        <div className="fixed inset-x-0 bottom-[76px] z-modal mx-auto max-w-3xl px-4">
          <p className="rounded-lg border-l-4 border-success bg-success/10 px-3 py-2 text-xs text-foreground dark:bg-success/15">
            Já publicado neste lote: {publicados.map((h) => HOSPITAL_LABEL[h] || h).join(', ')}.
          </p>
        </div>
      )}
    </div>
  )
}
