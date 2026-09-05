/**
 * ImportarEscalaFdsPage — conferência do documento "ESCALA DE FINAL DE SEMANA"
 * (fila de liberação ÚNICA do sáb/dom, dono 15/08).
 *
 * Página IRMÃ da ImportarEscalaPage (fluxo e documento diferentes — não estende
 * as 1600 linhas de lá). A foto vai à edge em modo 'fds' e volta como
 * { dias, ignorados }; a secretária confere POR DIA: grade P1–P4 (3 faixas ×
 * 4 colunas), mapeamento Pn→pessoa (com Select de login — o login escolhido
 * VENCE o texto, regra da conferência normal) e a ordem de liberação POR TURNO,
 * exibida NA DIREÇÃO DO DOCUMENTO ("1º→último a ser liberado" — a conferência é
 * a transcrição da foto). A INVERSÃO para a convenção do rodapé acontece uma
 * única vez, no publicar (rodapeDeOrdemDoc).
 *
 * Turno sem a linha explícita no doc (ex.: domingo) nasce com a SUGESTÃO
 * (inverso da escalação, plantões Unimed/HRO por último) marcada "Sugerida —
 * ajuste antes de publicar" (decisão do dono 15/08).
 *
 * Funcionárias (bloco PLANTÃO MATERNO com datas) NUNCA viram posição — a edge
 * as devolve em `ignorados` e aqui viram só um informativo.
 *
 * MAPAS CIRÚRGICOS NA MESMA TELA (dono 2026-08-22): no fim de semana os arquivos
 * chegam TODOS JUNTOS no mesmo dia — a tabela de posições mais um mapa por
 * hospital e por dia. A página virou a LISTA DE DOCUMENTOS: a tabela é o
 * primeiro item (vale os dois dias) e cada mapa entra como um item que se
 * declara sozinho (hospital pelo layout, data pelo cabeçalho). Antes, os 4
 * arquivos de 22–23/08 custavam 6 leituras da Vision e 9 publicações, com
 * hospital/data/período trocados à mão entre elas.
 *
 * ⚠️ O dia útil ganhou o lote em 2026-08-27 (`ImportarEscalasPage`), com uma aba
 * por hospital. O que continua valendo do "não mexa" de 22/08 é o TURNO: lá as
 * escalas são postadas em turnos diferentes porque saem em horas diferentes, e o
 * lote de dia útil é de um turno só. As duas telas seguem separadas — o código
 * compartilhado é `prepararCasosImportados` e a ideia de lista de documentos.
 *
 * Publicar = até 4 chamadas rpc_publicar_escala_turno em hospital='fds'
 * (sáb-mat, sáb-vesp, dom-mat, dom-vesp) com casos [] — a fila única deriva dos
 * casos por hospital — MAIS uma chamada por (hospital, dia, turno) com casos,
 * vinda dos mapas. Republicar é idempotente.
 */
import { useMemo, useState, useEffect} from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronLeft, FileText, Loader2, Plus, Trash2, X } from 'lucide-react'
import { Badge, Button, ConfirmDialog, DatePicker, FileUpload, Input, Select, useToast } from '@/design-system'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { useEscalaCirurgicaActions, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { prepararImagemParaVision } from '@/lib/imagemVision'
import { ERRO_IA, classificarFalhaVision, mensagemFalhaVision } from '@/lib/escalaVisionFalha'
import { isPermissionError } from '@/services/supabaseEscalaAnestesistaService'
import {
  FDS_HOSPITAL, FAIXAS_FDS, normalizarPn, normalizarParseFds, sugerirRodapeFds,
  rodapeDeOrdemDoc, sabadoDoFimDeSemana, ehFeriado, ordensDocumentoFeriado,
} from '@/lib/escalaFds'
import {
  normNome, candidatosPrimeiroNome, formatData, prepararCasosFimDeSemana,
  aplicarAtribuicoes, gruposSemIdentidade, gruposAnestesista,
} from './utils'
import dadosNumerica from '@/data/escalaNumerica.json'
import { posicoesDoPegaPlantao, compararPosicoesFds, textoComparacaoFds } from '@/lib/escalaFdsPegaPlantao'
import { getPlantoes } from '@/services/pegaPlantaoApi'
import { compararComRodape, casarNomeComLegenda } from '@/lib/escalaNumerica'
import {
  carimbarTurnos, chaveMapa, classificarAnexoMapa, planoPublicacaoMapas,
  resumoMapa, HOSPITAIS_MAPA,
} from '@/lib/escalaFdsMapas'
import ConferirMapaFdsPage from './ConferirMapaFdsPage'
import { podeEditarEscalaCirurgica } from './gate'
import { segurarAtualizacao, liberarAtualizacao } from '@/lib/atualizacaoAdiada'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { useVoltarDoBrowser } from './useVoltarDoBrowser'

// Turnos PUBLICADOS como linha da fila única (a noite não é turno de caso no
// banco — a fila dela viaja no fds_meta.ordemNoite do mesmo payload).
const TURNOS = ['matutino', 'vespertino']
// Ordem de liberação conferida/editada: os dois turnos publicados MAIS a noite
// (dono 16/08: a fila noturna tem gente da lista numerada além da grade 19-07 —
// sáb P2,P1,P4,P3,P11,P8,P7 · dom P3,P4,P1,P2,P11,P6,P5).
const TURNOS_ORDEM = [...TURNOS, 'noturno']
const TURNO_LABEL = { matutino: 'Matutino', vespertino: 'Vespertino', noturno: 'Noturno' }
// rótulo curto das COLUNAS de liberação (dono 17/08: só o turno, sem "do
// documento"/"sugerida") — mesma grafia do seletor da escala: Manhã · Tarde
const TURNO_CURTO = { matutino: 'Manhã', vespertino: 'Tarde', noturno: 'Noite' }
const FAIXA_LABEL = { '7-13': '7–13h', '13-19': '13–19h', '19-07': '19–07h' }
const COLUNAS = [
  { key: 'unimed', label: 'Unimed' },
  { key: 'hro', label: 'HRO' },
  { key: 'ret1', label: '3ª (retaguarda)' },
  { key: 'ret2', label: '4ª (retaguarda)' },
]

const primeiroNomeUpper = (nome) => normNome(String(nome || '').split(/\s+/)[0] || '')
/** Nome curto para as colunas estreitas: "Guilherme D." em vez de CAIXA ALTA. */
const nomeCurtoFds = (nome) => {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return ''
  const tc = (w) => w.charAt(0) + w.slice(1).toLowerCase()
  return partes.length > 1 ? `${tc(partes[0])} ${partes[1][0]}.` : tc(partes[0])
}
const ordenarPn = (a, b) => Number(a.slice(1)) - Number(b.slice(1))
const proximoDia = (iso) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + 1)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

/** Uma frase para o item da lista quando a folha lida diverge da escala de feriados publicada. */
function textoCruzamentoFeriado(c) {
  if (!c || c.iguais) return ''
  const partes = []
  if (c.faltamNoRodape.length) partes.push(`falta(m): ${c.faltamNoRodape.join(', ')}`)
  if (c.sobramNoRodape.length) partes.push(`a mais: ${c.sobramNoRodape.join(', ')}`)
  if (c.foraDeOrdem.length) partes.push(`fora de ordem: ${c.foraDeOrdem.join(', ')}`)
  return `Difere da escala de ${c.nome} publicada — ${partes.join(' · ')}. Confira contra a foto; troca de plantão explica a diferença.`
}

export default function ImportarEscalaFdsPage({ data, onClose }) {
  const { toast } = useToast()
  const { salvarEscalaTurno } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { roster, options: rosterOpcoes, rosterByUid, resolver, upsertAlias } = useRosterAnestesistas()
  const canEdit = podeEditarEscalaCirurgica(user)

  // O mesmo fluxo aceita dois formatos: FDS (sábado+domingo) e feriado (um dia).
  // O nome histórico `sabadoISO` é mantido localmente para reduzir o risco de
  // regressão no fluxo já publicado; em feriado ele guarda a própria data.
  const [sabadoISO, setSabadoISO] = useState(() => ehFeriado(data) ? data : (sabadoDoFimDeSemana(data) || data))
  const feriado = ehFeriado(sabadoISO)
  const domingoISO = useMemo(() => feriado ? null : proximoDia(sabadoISO), [feriado, sabadoISO])
  const datasSelecionadas = useMemo(() => feriado ? [sabadoISO] : [sabadoISO, domingoISO], [feriado, sabadoISO, domingoISO])
  const turnosOrdem = feriado ? TURNOS : TURNOS_ORDEM

  const [dias, setDias] = useState({})       // { [iso]: { grade, posicoes, escalacao, ordem, ordemFonte } }
  const [logins, setLogins] = useState({})   // `${iso}|${pn}` → uid escolhido
  const [ignorados, setIgnorados] = useState([])
  const [avisos, setAvisos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [addSel, setAddSel] = useState({})   // `${iso}|${turno}` → uid do "acrescentar"
  // seleção aberta para edição — o par texto+login e os botões de mover moram
  // FORA das colunas (não cabem em ~130px)
  const [posSel, setPosSel] = useState(null)   // { iso, pn }
  const [ordemSel, setOrdemSel] = useState(null) // { iso, turno, i }
  // MAPAS CIRÚRGICOS: chaveMapa(hospital, data) → { id, nome, hospital, data,
  // casos, atribuicoes: {turno: {chave: uid}}, sugeridos, turnoAberto }.
  // A chave é hospital+dia porque reanexar o MESMO par substitui (a foto nova
  // manda, como no rodapé da conferência de dia útil) — dois itens do mesmo par
  // publicariam duas vezes sobre a mesma escala.
  const [mapas, setMapas] = useState({})
  // 'lista' (documentos) · 'grade' (conferência da tabela de posições) · chave de um mapa
  const [vista, setVista] = useState('lista')
  const [encolhimentos, setEncolhimentos] = useState(null) // guardrail anti-perda

  // ── AS MESMAS GUARDAS DO LOTE DE DIA ÚTIL (Onda 2, item 2.3) ─────────────────
  // O fim de semana NÃO tem rascunho: aqui o que protege a conferência é não deixar o
  // app recarregar no meio (deploy ao voltar do 2º plano, intervalo de 15 min), o gesto
  // da borda desligado e o "Cancelar"/"voltar" perguntando antes de jogar fora o documento
  // e os mapas anexados.
  const temTrabalhoFds = Object.keys(dias).length > 0 || Object.keys(mapas).length > 0
  useEffect(() => {
    if (!temTrabalhoFds) return undefined
    segurarAtualizacao('escala-fds')
    return () => liberarAtualizacao('escala-fds')
  }, [temTrabalhoFds])
  const guardaSaida = useUnsavedChangesGuard(temTrabalhoFds)
  const cancelar = () => guardaSaida.requestClose(() => onClose?.())
  useVoltarDoBrowser(cancelar)

  const diasAlvo = datasSelecionadas.filter((iso) => dias[iso])

  const importarImagem = async (file) => {
    if (!file) return
    setCarregando(true)
    try {
      // mesma redução/normalização do fluxo normal (HEIC do iPhone, POST gigante)
      const img = await prepararImagemParaVision(file)
      const res = await svc.parseEscalaImagem({
        imageBase64: img.base64, mimeType: img.mimeType,
        modo: 'fds',
        ...(feriado ? { refFeriado: sabadoISO } : { refSabado: sabadoISO, refDomingo: domingoISO }),
      })
      // Falha da IA (conta/chave/sobrecarga) — o mesmo diagnóstico da
      // importação normal; aqui a única saída é reimportar quando voltar.
      if (res?.error === ERRO_IA) {
        toast({
          variant: 'error',
          duration: 12000,
          ...mensagemFalhaVision(
            classificarFalhaVision({ status: res.iaStatus, tipo: res.iaTipo, mensagem: res.iaMensagem }),
            'reimporte o documento quando a leitura voltar',
          ),
        })
        return
      }
      if (res?.error === 'extracao_truncada' || res?.error === 'json_invalido') {
        toast({
          variant: 'error', duration: 12000,
          title: 'O documento não coube em uma leitura',
          description: 'Tente um print mais fechado (um dia por vez) — o app aceita reimportar por cima.',
        })
        return
      }
      const norm = normalizarParseFds(res)
      const porData = {}
      const fora = []
      for (const d of norm.dias) {
        if (!datasSelecionadas.includes(d.data)) { fora.push(d.data); continue }
        const ordem = {}
        const ordemFonte = {}
        for (const turno of turnosOrdem) {
          if (d.ordemDoc[turno]?.length) {
            ordem[turno] = d.ordemDoc[turno]
            ordemFonte[turno] = 'documento'
          } else {
            // SUGESTÃO (decisão 2 do dono): inverso da escalação, exibido na
            // direção do documento — reverse(rodapé sugerido)
            ordem[turno] = [...sugerirRodapeFds(d, turno)].reverse()
            ordemFonte[turno] = 'sugerida'
          }
        }
        porData[d.data] = {
          tipo: d.tipo, grade: d.grade, posicoes: d.posicoes, escalacao: d.escalacao,
          listaFeriado: d.listaFeriado || [], ordem, ordemFonte,
        }
      }
      setDias(porData)
      setLogins({})
      setIgnorados(norm.ignorados)
      setAvisos([
        ...norm.avisos,
        ...fora.map((f) => `${formatData(f)} não é o fim de semana selecionado — dia descartado`),
        ...(res?.truncado ? ['Leitura cortada no fim — confira o domingo antes de publicar'] : []),
      ])
      const n = Object.keys(porData).length
      if (!n) {
        toast({
          variant: 'error',
          title: feriado ? 'Lista do feriado não reconhecida' : 'Nenhum dia do FDS reconhecido',
          description: feriado
            ? 'Confira se a foto mostra o título do feriado e a lista completa de nomes.'
            : 'Confira se a foto é do documento de fim de semana e se o sábado selecionado está certo.',
        })
      } else {
        toast({ variant: 'success', title: `${n} dia${n > 1 ? 's' : ''} lido${n > 1 ? 's' : ''} — confira e publique` })
      }
    } catch (err) {
      console.error('[ImportarEscalaFds] falha na leitura:', err)
      toast({ variant: 'error', title: 'Falha ao ler a imagem', description: 'Tente outra foto/print do documento.' })
    } finally { setCarregando(false) }
  }

  // ── MAPAS CIRÚRGICOS ──────────────────────────────────────────────────────
  // Vários de uma vez: o fim de semana chega como um lote. Cada arquivo é lido
  // com `secoesTurno` — a edge devolve o turno POR CASO, pela faixa MATUTINO/
  // VESPERTINO do documento. É isso que faz uma leitura servir os dois turnos:
  // sem a faixa, as linhas "AS" (6 das 15 cirurgias do HRO em 22/08) herdam o
  // período do anexo e a tarde se perde.
  const importarMapas = async (files) => {
    const lista = (Array.isArray(files) ? files : [files]).filter(Boolean)
    if (!lista.length) return
    setCarregando(true)
    const problemas = []
    let lidos = 0
    try {
      for (const file of lista) {
        try {
          const img = await prepararImagemParaVision(file)
          const res = await svc.parseEscalaImagem({
            imageBase64: img.base64, mimeType: img.mimeType, secoesTurno: true,
          })
          if (res?.error === ERRO_IA) {
            problemas.push(`${file.name}: ${mensagemFalhaVision(
              classificarFalhaVision({ status: res.iaStatus, tipo: res.iaTipo, mensagem: res.iaMensagem }),
            ).title}`)
            continue
          }
          if (res?.error === 'extracao_truncada' || res?.error === 'json_invalido') {
            problemas.push(`${file.name}: a leitura foi cortada — envie um print mais fechado`)
            continue
          }
          const cls = classificarAnexoMapa(res, { sabadoISO, domingoISO, datasAlvo: datasSelecionadas })
          if (!(res.casos || []).length) {
            problemas.push(`${file.name}: nenhuma cirurgia reconhecida`)
            continue
          }
          // hospital indefinido não impede entrar na lista — o item pede a
          // confirmação em vez de a tela escolher por conta própria
          // por TURNO: a herança de "//" não pode atravessar a faixa
          // MATUTINO/VESPERTINO (ver prepararCasosFimDeSemana)
          // FERIADO usa o MESMO caso do fim de semana, inteiro. Reduzi-lo a
          // sala/cirurgião/anestesista (a leitura literal de "o que o card
          // mostra") derrubaria em silêncio o convênio — e é o convênio que o
          // trigger `fn_sync_cirurgia_particular` casa para abrir a cobrança
          // particular. Só o mapa da Unimed de 25/08 traz 6 PARTICULAR.
          const casos = carimbarTurnos(
            prepararCasosFimDeSemana(res.casos, cls.hospital, res.posicoesAssistenciais || []),
            'matutino',
          )
          const chave = chaveMapa(cls.hospital, cls.data)
          setMapas((prev) => ({
            ...prev,
            [chave]: {
              id: chave, nome: file.name, hospital: cls.hospital, data: cls.data,
              dataForaDoFimDeSemana: cls.dataForaDoFimDeSemana, confirmar: cls.confirmar,
              casos, atribuicoes: {}, sugeridos: {}, turnoAberto: null,
              truncado: !!res.truncado, conferido: false,
            },
          }))
          lidos += 1
        } catch (err) {
          problemas.push(`${file.name}: ${err?.name === 'ErroImagem' ? err.message : 'falha na leitura'}`)
        }
      }
    } finally { setCarregando(false) }
    if (lidos) {
      toast({
        variant: problemas.length ? 'warning' : 'success',
        duration: problemas.length ? 12000 : undefined,
        title: `${lidos} mapa${lidos > 1 ? 's' : ''} lido${lidos > 1 ? 's' : ''}`,
        description: problemas.length ? problemas.join(' · ') : 'Confira o anestesista de cada sala antes de publicar.',
      })
    } else {
      toast({
        variant: 'error', duration: 12000,
        title: 'Nenhum mapa foi lido',
        description: problemas.join(' · ') || 'Tente outro print do mapa cirúrgico.',
      })
    }
  }

  const salvarMapa = (mapa, { silencioso = false } = {}) => {
    setMapas((prev) => ({ ...prev, [mapa.id]: mapa }))
    if (!silencioso) setVista('lista')
  }
  const removerMapa = (chave) => {
    setMapas((prev) => { const p = { ...prev }; delete p[chave]; return p })
    setVista('lista')
  }
  /** Hospital/data confirmados à mão re-chaveiam o item (o par é a identidade). */
  const redefinirMapa = (chave, campos) => setMapas((prev) => {
    const atual = prev[chave]
    if (!atual) return prev
    const proximo = { ...atual, ...campos }
    proximo.confirmar = [!proximo.hospital && 'hospital', !proximo.data && 'data'].filter(Boolean)
    const novaChave = chaveMapa(proximo.hospital, proximo.data)
    const p = { ...prev }
    delete p[chave]
    // sala canônica depende do hospital: trocar o hospital re-prepara o lote
    if (campos.hospital && campos.hospital !== atual.hospital) {
      proximo.casos = carimbarTurnos(prepararCasosFimDeSemana(proximo.casos, proximo.hospital), 'matutino')
      proximo.atribuicoes = {}
      proximo.sugeridos = {}
    }
    p[novaChave] = { ...proximo, id: novaChave }
    return p
  })

  const listaMapas = useMemo(
    () => Object.values(mapas).sort((a, b) =>
      String(a.data).localeCompare(String(b.data)) || String(a.hospital).localeCompare(String(b.hospital))),
    [mapas],
  )

  // ── edição ────────────────────────────────────────────────────────────────
  const mudarDia = (iso, mut) => setDias((prev) => ({ ...prev, [iso]: mut(prev[iso]) }))
  // O que a TELA mostra e EDITA. No feriado é a folha, na ordem em que foi
  // escrita: a conferência é a transcrição do documento, e é por ela que
  // Subir/Descer/Remover indexam. A direção de cada turno entra só na
  // publicação (`ordensDocumentoFeriado`) — inverter aqui faria o botão mexer
  // na linha errada.
  const ordemDoDia = (dia, turno) => feriado
    ? (dia?.listaFeriado || [])
    : (dia?.ordem?.[turno] || [])
  const mudarListaFeriado = (iso, mut) => mudarDia(iso, (d) => ({ ...d, listaFeriado: mut(d.listaFeriado || []) }))
  const setCelula = (iso, faixa, col, valor) => mudarDia(iso, (d) => ({
    ...d, grade: { ...d.grade, [faixa]: { ...d.grade[faixa], [col]: valor } },
  }))
  const setPosicao = (iso, pn, nome) => mudarDia(iso, (d) => ({
    ...d, posicoes: { ...d.posicoes, [pn]: nome },
  }))
  const moverOrdem = (iso, turno, i, delta) => mudarDia(iso, (d) => {
    if (feriado) {
      const arr = [...(d.listaFeriado || [])]
      const j = i + delta
      if (j < 0 || j >= arr.length) return d
      arr.splice(j, 0, ...arr.splice(i, 1))
      return { ...d, listaFeriado: arr }
    }
    const arr = [...d.ordem[turno]]
    const j = i + delta
    if (j < 0 || j >= arr.length) return d
    arr.splice(j, 0, ...arr.splice(i, 1))
    return { ...d, ordem: { ...d.ordem, [turno]: arr } }
  })
  const removerOrdem = (iso, turno, i) => mudarDia(iso, (d) => {
    if (feriado) return { ...d, listaFeriado: (d.listaFeriado || []).filter((_, k) => k !== i) }
    const arr = d.ordem[turno].filter((_, k) => k !== i)
    return { ...d, ordem: { ...d.ordem, [turno]: arr } }
  })
  // Acrescentar é por LOGIN (regra 11/08 da conferência normal: texto livre
  // criava a mesma pessoa 2× na fila) — insere o apelido do dicionário.
  const acrescentarOrdem = (iso, turno) => {
    const uid = addSel[`${iso}|${turno}`]
    const r = uid ? rosterByUid.get(uid) : null
    if (!r) return
    const texto = r.apelidos?.[0] || primeiroNomeUpper(r.nome)
    if (feriado) {
      mudarListaFeriado(iso, (lista) => lista.some((t) => normNome(t) === normNome(texto)) ? lista : [...lista, texto])
    } else {
      mudarDia(iso, (d) => (
        d.ordem[turno].some((t) => normNome(nomeDoToken(dias[iso], t)) === normNome(texto))
          ? d
          : { ...d, ordem: { ...d.ordem, [turno]: [...d.ordem[turno], texto] } }
      ))
    }
    setAddSel((p) => ({ ...p, [`${iso}|${turno}`]: '' }))
  }

  // ── resolução/validação ───────────────────────────────────────────────────
  const nomeDoToken = (dia, token) => {
    const pn = normalizarPn(token)
    return pn ? (dia?.posicoes?.[pn] || null) : String(token || '').trim()
  }
  // nome PUBLICADO da posição: o login escolhido vence o texto do documento
  const posicoesEfetivas = (iso) => {
    const dia = dias[iso]
    const out = {}
    for (const [pn, nome] of Object.entries(dia?.posicoes || {})) {
      const r = rosterByUid.get(logins[`${iso}|${pn}`] || '')
      out[pn] = r ? (r.apelidos?.[0] || primeiroNomeUpper(r.nome)) : nome
    }
    return out
  }
  // token de NOME que corresponde a uma posição vira o código Pn (para o login
  // escolhido valer também no caminho da sugestão, que é escrita por nomes)
  const tokenParaPn = (dia, token) => {
    if (normalizarPn(token)) return token
    const alvo = normNome(token)
    const hit = Object.entries(dia?.posicoes || {}).find(([, n]) => normNome(n) === alvo)
    return hit ? hit[0] : token
  }
  const ordemPublicacao = (iso, turno) => {
    const dia = dias[iso]
    // FERIADO: a folha vale os dois turnos em sentidos opostos. `ordensDocumentoFeriado`
    // devolve a convenção do documento e `rodapeDeOrdemDoc` inverte UMA vez, como no FDS.
    const tokens = feriado
      ? (ordensDocumentoFeriado(dia?.listaFeriado)[turno] || [])
      : ordemDoDia(dia, turno).map((t) => tokenParaPn(dia, t))
    return rodapeDeOrdemDoc(tokens, posicoesEfetivas(iso))
  }
  /** Bloqueios de publicação por dia+turno (regra da casa: nunca chutar identidade). */
  const bloqueiosDe = (iso, turno) => {
    const dia = dias[iso]
    const out = []
    const tokens = ordemDoDia(dia, turno)
    if (!tokens.length) {
      // NOITE sem ordem não trava a publicação: a fila cai na linha 19-07 da
      // grade, que é o comportamento de sempre. Manhã e tarde não têm essa
      // rede — sem rodapé a fila seria inventada dos casos.
      if (turno !== 'noturno') out.push('Ordem de liberação vazia — sem ela a fila seria inventada dos casos.')
      return out
    }
    const { semDono } = ordemPublicacao(iso, turno)
    if (semDono.length) out.push(`Posição sem pessoa no mapeamento: ${semDono.join(', ')} — complete acima.`)
    // primeiro nome com 2+ candidatos no cadastro e sem login escolhido:
    // publicar chutaria a identidade (incidente "JOAO" 11/08)
    for (const token of tokens) {
      const pn = normalizarPn(tokenParaPn(dia, token))
      const nome = nomeDoToken(dia, token)
      if (!nome) continue
      const uidEscolhido = pn ? logins[`${iso}|${pn}`] : null
      if (uidEscolhido || resolver(nome)) continue
      if (candidatosPrimeiroNome(nome, roster).length >= 2) {
        out.push(`"${nome}" tem mais de um candidato no cadastro — escolha o login na lista de posições.`)
      }
    }
    return [...new Set(out)]
  }
  const todosBloqueios = diasAlvo.flatMap((iso) => turnosOrdem.flatMap((t) =>
    bloqueiosDe(iso, t).map((b) => `${formatData(iso)} · ${TURNO_LABEL[t]}: ${b}`)))

  /**
   * A TABELA DE POSIÇÕES LIDA × O PEGA PLANTÃO (dono 04/09).
   *
   * "A escala é vista no Pega Plantão: de P1 a P4 a ordem pode variar entre esses quatro —
   * verificação deve ser feita ao adicionar a escala de final de semana; de P5 a P12 a
   * ordem está correta." É a segunda fonte que faltava no fim de semana: a fila do sábado e
   * do domingo sai de UMA tabela fotografada e, quando a leitura troca dois nomes, o fim de
   * semana inteiro nasce errado. Só o SÁBADO é consultado — a tabela vale os dois dias.
   */
  const [posicoesPP, setPosicoesPP] = useState(null)
  useEffect(() => {
    if (feriado || !sabadoISO) { setPosicoesPP(null); return }
    let vivo = true
    getPlantoes({ dataInicio: `${sabadoISO}T00:00:00`, dataFim: `${sabadoISO}T23:59:59` })
      .then((raw) => { if (vivo) setPosicoesPP(posicoesDoPegaPlantao(raw, sabadoISO)) })
      .catch(() => { if (vivo) setPosicoesPP(null) })
    return () => { vivo = false }
  }, [feriado, sabadoISO])

  const cruzamentoPosicoes = useMemo(() => {
    if (feriado || !posicoesPP || !Object.keys(posicoesPP).length) return null
    const lidas = dias[sabadoISO]?.posicoes || {}
    if (!Object.keys(lidas).length) return null
    // Três camadas, da mais forte para a mais fraca: o dicionário de apelidos (identidade
    // real), o mapa curado apelido→cadastro (`casarNomeComLegenda`, que sabe que "COSTA" é
    // o Marcos e não o Gabriel) e, por último, o casamento por tokens consecutivos da lib,
    // que resolve "DIDOMENICO" × "Di Domenico".
    const casar = (a, b) => {
      const ua = resolver(a); const ub = resolver(b)
      if (ua && ub) return ua === ub
      return casarNomeComLegenda(a, b) || casarNomeComLegenda(b, a)
    }
    return compararPosicoesFds(lidas, posicoesPP, { casar })
  }, [feriado, posicoesPP, dias, sabadoISO, resolver])

  /**
   * A LISTA LIDA × A ESCALA DE FERIADOS PUBLICADA (dono 03/09; o mesmo cruzamento que a
   * conferência de dia útil faz com a escala numérica).
   *
   * No feriado a fila do dia inteiro sai de UMA folha fotografada: se a leitura troca,
   * perde ou embaralha um nome, a fila nasce errada e não há segunda fonte na tela. O
   * documento "FERIADOS <ano>" que o grupo publica é essa segunda fonte, e ele vive no
   * mesmo dataset da escala numérica. Divergência NÃO é erro — troca de plantão acontece —,
   * então isto é AVISO, nunca bloqueio.
   */
  const cruzamentoFeriado = useMemo(() => {
    if (!feriado || !sabadoISO) return null
    const publicada = dadosNumerica?.feriados?.dias?.[sabadoISO]
    const lida = (dias[sabadoISO]?.listaFeriado || []).map((n) => String(n || '').trim()).filter(Boolean)
    if (!publicada?.lista?.length || !lida.length) return null
    const esperada = publicada.lista.map((nome, i) => ({ posicao: i + 1, nome }))
    const c = compararComRodape(esperada, lida)
    return c.iguais ? { iguais: true, nome: publicada.nome } : { ...c, iguais: false, nome: publicada.nome }
  }, [feriado, sabadoISO, dias])

  // Mapa sem hospital ou sem data não tem para onde ir — bloqueia, porque
  // publicar "no palpite" põe cirurgia no hospital errado.
  const bloqueiosMapas = listaMapas
    .filter((m) => m.confirmar?.length)
    .map((m) => `${m.nome}: falta ${m.confirmar.join(' e ')} — complete no item.`)
  const planoMapas = useMemo(() => planoPublicacaoMapas(listaMapas), [listaMapas])
  const totalCasos = planoMapas.reduce((n, p) => n + p.casos.length, 0)

  // ── publicação ────────────────────────────────────────────────────────────
  /**
   * GUARDRAIL ANTI-PERDA (incidente 23/07 no fluxo de dia útil: publicar com 1
   * caso APAGOU os 31 da escala — publicar é DELETE+reinsert). Aqui o risco é o
   * mesmo: reimportar um print cortado por cima de uma escala cheia. Compara com
   * o que está publicado e pede confirmação antes de encolher.
   */
  const conferirEncolhimento = async () => {
    const achados = []
    const porEscala = new Map()
    for (const item of planoMapas) {
      const k = `${item.data}|${item.hospital}`
      if (!porEscala.has(k)) {
        porEscala.set(k, await svc.fetchEscala(item.data, item.hospital).catch(() => null))
      }
      const existente = porEscala.get(k)
      const atuais = (existente?.casos || []).filter((c) => (c.turno || 'matutino') === item.turno).length
      if (atuais >= 3 && atuais > item.casos.length) {
        achados.push(`${HOSPITAL_LABEL[item.hospital] || item.hospital} ${formatData(item.data)} ${TURNO_LABEL[item.turno]}: ${atuais} → ${item.casos.length}`)
      }
    }
    return achados
  }

  const publicar = async ({ confirmado = false } = {}) => {
    if (publicando || !diasAlvo.length || todosBloqueios.length || bloqueiosMapas.length) return
    if (!confirmado && planoMapas.length) {
      setPublicando(true)
      let achados = []
      try { achados = await conferirEncolhimento() } finally { setPublicando(false) }
      if (achados.length) { setEncolhimentos(achados); return }
    }
    setPublicando(true)
    const publicados = []
    const falhas = []
    try {
      // aprendizado de alias: SÓ apelido DESCONHECIDO (regra 23/07 — reatribuição
      // não ensina A→B); falha de RLS não trava a publicação
      for (const iso of diasAlvo) {
        for (const [pn, nome] of Object.entries(dias[iso].posicoes)) {
          const uid = logins[`${iso}|${pn}`]
          const txt = String(nome || '').trim()
          if (uid && txt && resolver(txt) == null) {
            try { await upsertAlias({ apelido: txt, userId: uid, createdBy: user?.uid || user?.id }) }
            catch (err) { if (!isPermissionError(err)) console.warn('[ImportarEscalaFds] alias não aprendido:', err) }
          }
        }
      }
      for (const iso of diasAlvo) {
        const dia = dias[iso]
        for (const turno of TURNOS) {
          const { rodape } = ordemPublicacao(iso, turno)
          try {
            await salvarEscalaTurno({
              data: iso, hospital: FDS_HOSPITAL, turno,
              casos: [], // a fila deriva dos casos POR HOSPITAL (importação normal)
              ordemLiberacao: rodape,
              ajudaExterna: [],
              // convenção: o meta COMPLETO vai em toda publicação (a RPC preserva
              // quando ausente; não existe "limpar" via RPC)
              fdsMeta: {
                grade: dia.grade,
                posicoes: posicoesEfetivas(iso),
                escalacao: dia.escalacao,
                tipo: feriado ? 'feriado' : 'fim_de_semana',
                ...(feriado ? { listaFonte: [...(dia.listaFeriado || [])] } : {}),
                ordemFonte: dia.ordemFonte,
                // fila da NOITE (nomes, convenção do rodapé): vai no meta porque
                // 'noturno' não é turno de publicação no banco. Republicar sem
                // este campo apagaria a ordem ditada em silêncio.
                ordemNoite: feriado ? [] : ordemPublicacao(iso, 'noturno').rodape,
              },
              status: 'publicada',
            }, { userName: user?.displayName })
            publicados.push(`${formatData(iso)} ${TURNO_LABEL[turno]}`)
          } catch (err) {
            falhas.push(`${formatData(iso)} ${TURNO_LABEL[turno]}: ${err.message}`)
          }
        }
      }
      // MAPAS: uma publicação por (hospital, dia, turno) COM casos. O turno sem
      // caso nenhum não é publicado — a RPC substitui o turno inteiro, e mandar
      // vazio apagaria o que já estivesse lá.
      for (const item of planoMapas) {
        const atribuicoesDoTurno = mapas[item.mapaId]?.atribuicoes?.[item.turno] || {}
        const casos = aplicarAtribuicoes(
          item.casos,
          atribuicoesDoTurno,
          (chave, uid) => {
            const r = rosterByUid.get(uid)
            if (r) return r.apelidos?.[0] || primeiroNomeUpper(r.nome)
            const g = gruposAnestesista(item.casos, item.hospital).find((x) => x.chave === chave)
            return g?.nome ? normNome(g.nome) : ''
          },
          resolver,
        )
        const rotulo = `${HOSPITAL_LABEL[item.hospital] || item.hospital} ${formatData(item.data)} ${TURNO_LABEL[item.turno]}`
        try {
          await salvarEscalaTurno({
            data: item.data, hospital: item.hospital, turno: item.turno,
            casos,
            // No fim de semana o mapa NÃO traz rodapé: a fila é a da linha 'fds'.
            // Publicar rodapé aqui criaria uma segunda ordem, concorrente da única.
            ordemLiberacao: [], ajudaExterna: [],
            status: 'publicada',
          }, { userName: user?.displayName })
          publicados.push(`${rotulo} (${casos.length})`)
        } catch (err) {
          falhas.push(`${rotulo}: ${err.message}`)
        }
      }
      if (falhas.length) {
        toast({
          variant: 'warning', duration: 12000,
          title: `Publicado parcialmente (${publicados.length}/${publicados.length + falhas.length})`,
          description: `Republicar é seguro (substitui o turno). Falhou: ${falhas.join(' · ')}`,
        })
      } else {
        toast({
          variant: 'success',
          title: feriado ? 'Feriado publicado' : 'Fim de semana publicado',
          description: `${diasAlvo.length * TURNOS.length} turno(s) na fila única${totalCasos ? ` · ${totalCasos} cirurgia(s) em ${planoMapas.length} turno(s) de hospital` : ''}.`,
        })
      }
      if (publicados.length) onClose?.({ data: sabadoISO })
    } finally { setPublicando(false) }
  }

  // ── VISTA: conferência da TABELA DE POSIÇÕES (o documento de fim de semana) ─
  const renderGrade = () => (
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto" data-no-swipe-back="true">
      <div className="sticky top-0 z-10 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button type="button" onClick={() => setVista('lista')} aria-label="Voltar para os documentos"
            className="flex min-h-[44px] min-w-[70px] items-center gap-1 text-primary active:opacity-60">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-foreground">
            {feriado ? 'Lista e fila' : 'Posições e fila'}
          </h1>
          <span className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto p-4 pb-28 space-y-4">
        {!canEdit && (
          <p className="rounded-lg bg-warning/10 text-warning text-sm p-3">Você não tem permissão para confeccionar escalas.</p>
        )}
        <p className="text-sm text-muted-foreground">
          {feriado
            ? 'Lista simples do feriado: a manhã sai na ordem da folha e a tarde usa a mesma lista de trás para frente — uma fila só para todos os hospitais.'
            : 'Documento "ESCALA DE FINAL DE SEMANA": grade P1–P4, numeração das posições e a ordem de liberação de cada turno — uma fila só para todos os hospitais.'}
          {' '}Os mapas cirúrgicos entram como documentos próprios na lista anterior.
        </p>

        <FileUpload accept="image/*" maxSize={15 * 1024 * 1024} variant="dropzone"
          label={feriado ? 'Foto da lista do feriado' : 'Foto do documento de fim de semana'}
          description={feriado
            ? `Print/foto da lista de ${formatData(sabadoISO)}. Sem dado de paciente.`
            : 'Print/foto da ESCALA DE FINAL DE SEMANA (sábado e domingo juntos). Sem dado de paciente.'}
          onChange={(f) => importarImagem(Array.isArray(f) ? f[0] : f)} disabled={carregando || !canEdit} />

        {carregando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Lendo o documento…
          </p>
        )}

        {ignorados.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground/80 mb-1">Fora da escala (funcionárias têm escala própria):</p>
            {ignorados.map((l, i) => <p key={i}>· {l}</p>)}
          </div>
        )}
        {avisos.map((a, i) => (
          <p key={i} className="flex items-start gap-2 rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
          </p>
        ))}

        {diasAlvo.map((iso) => {
          const dia = dias[iso]
          const pns = Object.keys(dia.posicoes).filter((k) => normalizarPn(k)).sort(ordenarPn)
          return (
            <section key={iso} className="rounded-2xl border border-border-strong bg-card p-3 space-y-4">
              <h2 className="text-sm font-bold text-foreground">{formatData(iso)}</h2>

              {/* Feriado não tem grade nem posições numeradas: mostra só a lista. */}
              {!feriado && <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plantões (grade)</p>
                {FAIXAS_FDS.map((faixa) => (
                  <div key={faixa}>
                    <p className="mb-1 text-xs font-semibold text-foreground/80">{FAIXA_LABEL[faixa]}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {COLUNAS.map((c) => (
                        <div key={c.key}>
                          <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{c.label}</label>
                          <Input value={dia.grade[faixa]?.[c.key] || ''}
                            onChange={(e) => setCelula(iso, faixa, c.key, e.target.value)} placeholder="—" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>}

              {/* Pn → pessoa (login vence o texto; domingo herda o sábado).
                  DUAS COLUNAS correndo para BAIXO (dono 17/08): P1..P6 na
                  esquerda, P7..P12 na direita — em linha, as doze posições
                  empurravam a ordem de liberação para fora da tela. O par
                  texto+login abre embaixo, fora das colunas: os dois campos não
                  cabem numa coluna de ~200px. */}
              {!feriado && <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Posições (Pn → pessoa)</p>
                <div className="columns-2 gap-x-2">
                  {pns.map((pn) => {
                    const nome = dia.posicoes[pn]
                    const uid = logins[`${iso}|${pn}`] || ''
                    const ambiguo = !uid && !resolver(nome) && candidatosPrimeiroNomeMemo(nome, roster)
                    const aberta = posSel?.iso === iso && posSel?.pn === pn
                    return (
                      <button
                        key={pn}
                        type="button"
                        onClick={() => setPosSel(aberta ? null : { iso, pn })}
                        aria-expanded={aberta}
                        className={[
                          'mb-1.5 flex w-full break-inside-avoid items-center gap-1.5 rounded-[10px] border px-1.5 py-1 text-left',
                          'min-h-[40px]',
                          ambiguo ? 'border-destructive/55' : aberta ? 'border-primary' : 'border-border',
                        ].join(' ')}
                      >
                        <Badge className="shrink-0 border-transparent bg-primary text-primary-foreground">{pn}</Badge>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] font-semibold">{nomeCurtoFds(nome)}</span>
                          <span className={`block truncate text-[10px] ${uid ? 'text-muted-foreground' : ambiguo ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                            {uid ? `✓ ${rosterByUid.get(uid)?.nome ? nomeCurtoFds(rosterByUid.get(uid).nome) : 'login'}` : 'sem login'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {posSel?.iso === iso && dia.posicoes[posSel.pn] !== undefined && (
                  <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Posição {posSel.pn}</p>
                    <Input
                      aria-label={`Nome de ${posSel.pn}`}
                      value={dia.posicoes[posSel.pn]}
                      onChange={(e) => setPosicao(iso, posSel.pn, e.target.value)}
                    />
                    <Select
                      className="w-full"
                      searchable
                      options={[{ value: '', label: '— login —' }, ...rosterOpcoes]}
                      value={logins[`${iso}|${posSel.pn}`] || ''}
                      onChange={(v) => setLogins((p) => ({ ...p, [`${iso}|${posSel.pn}`]: v }))}
                      placeholder="Login"
                    />
                    <p className="text-[11px] text-muted-foreground">O login escolhido vence o texto lido da foto.</p>
                  </div>
                )}
                {!pns.length && <p className="text-xs text-muted-foreground">Nenhuma posição lida — reimporte ou preencha a ordem por login abaixo.</p>}
              </div>}

              {/* ORDEM DE LIBERAÇÃO EM TRÊS COLUNAS (dono 17/08): manhã · tarde ·
                  noite lado a lado, na direção do DOCUMENTO. Empilhadas, as três
                  listas somavam mais de uma tela e a comparação entre turnos —
                  que é o que a conferência faz — exigia rolar para frente e para
                  trás. O cabeçalho leva SÓ o nome do turno (sem "do documento"/
                  "sugerida") e o ordinal vem colado ao nome. */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {feriado ? 'Lista do feriado — na ordem da folha' : 'Ordem de liberação — 1º ao último'}
                </p>
                {feriado && (
                  <p className="text-[11px] text-muted-foreground">
                    A manhã sai nesta ordem; a tarde, de trás para frente. Em cada turno, quem
                    está no FIM da fila é o primeiro a ser liberado.
                  </p>
                )}
                <div className={`grid ${feriado ? 'grid-cols-1' : 'grid-cols-3'} gap-1.5`}>
                  {(feriado ? ['matutino'] : turnosOrdem).map((turno) => {
                    const tokens = ordemDoDia(dia, turno)
                    return (
                      <div key={turno} className="min-w-0">
                        <p className="mb-1 rounded-[9px] bg-primary/10 px-1 py-1 text-center text-[11.5px] font-bold text-primary">
                          {TURNO_CURTO[turno]}
                        </p>
                        <ol className="space-y-1">
                          {tokens.map((token, i) => {
                            const pn = normalizarPn(tokenParaPn(dia, token))
                            const nome = nomeDoToken(dia, token)
                            const aberta = ordemSel?.iso === iso && ordemSel?.turno === turno && ordemSel?.i === i
                            return (
                              <li key={`${token}-${i}`}>
                                <button
                                  type="button"
                                  aria-expanded={aberta}
                                  aria-label={`Posição ${i + 1} de ${TURNO_CURTO[turno]}: ${nome || token}`}
                                  onClick={() => setOrdemSel(aberta ? null : { iso, turno, i })}
                                  className={`w-full rounded-lg px-1.5 py-1 text-left ${aberta ? 'bg-primary/20' : 'bg-muted'}`}
                                >
                                  {pn && <span className="block text-[9.5px] font-extrabold text-muted-foreground">{pn}</span>}
                                  <span className={`block truncate text-[11px] font-bold ${nome ? '' : 'text-destructive'}`}>
                                    <span className="text-primary">{i + 1}º</span> {nome ? nomeCurtoFds(nome) : 'sem pessoa'}
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                          {!tokens.length && <li className="px-1 text-[11px] text-muted-foreground">—</li>}
                        </ol>
                      </div>
                    )
                  })}
                </div>

                {/* mover/remover FORA das colunas: três botões não cabem em ~130px */}
                {ordemSel?.iso === iso && (
                  <div className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {TURNO_CURTO[ordemSel.turno]} · posição {ordemSel.i + 1}º —{' '}
                      {nomeDoToken(dia, ordemDoDia(dia, ordemSel.turno)[ordemSel.i]) || 'sem pessoa'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" disabled={ordemSel.i === 0}
                        onClick={() => moverOrdem(iso, ordemSel.turno, ordemSel.i, -1)}
                        aria-label="Subir uma posição">
                        <ArrowUp className="h-4 w-4" /> Subir
                      </Button>
                      <Button size="sm" variant="outline"
                        disabled={ordemSel.i === ordemDoDia(dia, ordemSel.turno).length - 1}
                        onClick={() => moverOrdem(iso, ordemSel.turno, ordemSel.i, +1)}
                        aria-label="Descer uma posição">
                        <ArrowDown className="h-4 w-4" /> Descer
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => { removerOrdem(iso, ordemSel.turno, ordemSel.i); setOrdemSel(null) }}>
                        <Trash2 className="h-4 w-4" /> Remover
                      </Button>
                    </div>
                  </div>
                )}

                {/* acrescentar por LOGIN, um turno por linha (regra 11/08: texto
                    livre criava a mesma pessoa 2× na fila) */}
                {(feriado ? ['matutino'] : turnosOrdem).map((turno) => (
                  <div key={`add-${turno}`} className="flex items-center gap-1.5">
                    <span className="w-12 shrink-0 text-[11px] font-semibold text-muted-foreground">{feriado ? 'Lista' : TURNO_CURTO[turno]}</span>
                    <Select className="min-w-0 flex-1" searchable options={rosterOpcoes}
                      value={addSel[`${iso}|${turno}`] || ''}
                      onChange={(v) => setAddSel((p) => ({ ...p, [`${iso}|${turno}`]: v }))}
                      placeholder="Acrescentar por login (entra no fim)" />
                    <Button size="sm" variant="outline" disabled={!addSel[`${iso}|${turno}`]}
                      onClick={() => acrescentarOrdem(iso, turno)}
                      aria-label={`Acrescentar em ${TURNO_CURTO[turno]}`}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {turnosOrdem.flatMap((turno) => bloqueiosDe(iso, turno).map((b, i) => (
                  <p key={`${turno}-${i}`} className="flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span><b>{TURNO_CURTO[turno]}:</b> {b}</span>
                  </p>
                )))}
              </div>
            </section>
          )
        })}

        {diasAlvo.length > 0 && (
          <Button className="w-full" variant="outline" onClick={() => setVista('lista')}>
            <Check className="h-4 w-4" /> Concluir conferência
          </Button>
        )}
      </div>
    </div>
  )

  // ── VISTA: LISTA DE DOCUMENTOS (modelo escolhido pelo dono 2026-08-22) ──────
  // Um item por arquivo, na ordem em que chegam. A tabela de posições é o
  // primeiro item porque vale os DOIS dias; cada mapa vira um item que se
  // declara sozinho. O que ainda impede publicar aparece no próprio item.
  const gradeLida = diasAlvo.length > 0
  const itemGrade = {
    estado: gradeLida ? (todosBloqueios.length ? 'erro' : 'ok') : 'vazio',
    titulo: feriado ? 'Lista e fila' : 'Posições e fila',
    sub: gradeLida
      ? (feriado
          ? `${dias[sabadoISO]?.listaFeriado?.length || 0} nomes · filas de manhã e tarde`
          : `${Object.keys(dias[sabadoISO]?.posicoes || {}).length} posições · filas de manhã, tarde e noite`)
      : (feriado
          ? 'Lista do feriado — uma ordem, lida em sentidos opostos por turno'
          : 'Documento "ESCALA DE FINAL DE SEMANA" — grade e ordem de liberação'),
    pendencia: todosBloqueios[0]
      || textoCruzamentoFeriado(cruzamentoFeriado)
      || textoComparacaoFds(cruzamentoPosicoes),
    erro: !!todosBloqueios.length,
  }

  const renderLista = () => (
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto" data-no-swipe-back="true">
      <div className="sticky top-0 z-10 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button type="button" onClick={cancelar} aria-label="Cancelar"
            className="flex min-h-[44px] min-w-[70px] items-center gap-1 text-primary active:opacity-60">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Cancelar</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-foreground">
            {feriado ? 'Feriado' : 'Fim de semana'}
          </h1>
          <span className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-3 p-4 pb-32">
        {!canEdit && (
          <p className="rounded-lg bg-warning/10 p-3 text-sm text-warning">Você não tem permissão para confeccionar escalas.</p>
        )}

        {/* dois passos declarados, mesma gramática da importação de dia útil */}
        <ol className="flex items-center gap-2" aria-label="Etapas da importação">
          {[{ n: 1, label: 'Anexar', on: !gradeLida && !listaMapas.length }, { n: 2, label: 'Conferir', on: gradeLida || listaMapas.length > 0 }].map((passo, i) => (
            <li key={passo.n} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-border-strong" aria-hidden="true" />}
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${passo.on ? 'text-primary' : 'text-muted-foreground'}`}>
                <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] ${passo.on ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  {passo.n}
                </span>
                {passo.label}
              </span>
            </li>
          ))}
        </ol>

        <section className="space-y-2 rounded-2xl border border-border-strong bg-card p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-primary">{feriado ? 'Qual feriado' : 'Qual fim de semana'}</h2>
          <DatePicker
            className="w-full min-w-0"
            value={(() => { const [y, m, d] = String(sabadoISO || '').split('-').map(Number); return y ? new Date(y, m - 1, d) : new Date() })()}
            onChange={(d) => {
              if (!d) return
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              setSabadoISO(ehFeriado(iso) ? iso : (sabadoDoFimDeSemana(iso) || iso))
            }}
            placeholder={feriado ? 'Feriado' : 'Sábado'}
          />
          <p className="text-xs text-muted-foreground">
            {feriado ? `Feriado ${formatData(sabadoISO)}` : `Sábado ${formatData(sabadoISO)} · Domingo ${formatData(domingoISO)}`}
          </p>
        </section>

        <div className="flex items-baseline gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-primary">Documentos</h2>
          <span className="text-[11px] text-muted-foreground">
            {(gradeLida ? 1 : 0) + listaMapas.length} de {1 + listaMapas.length} lido
            {1 + listaMapas.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border-strong bg-card">
          {/* item fixo: a tabela de posições vale os dois dias */}
          <ItemDocumento
            estado={itemGrade.estado}
            titulo={itemGrade.titulo}
            sub={itemGrade.sub}
            pendencia={itemGrade.pendencia}
            erro={itemGrade.erro}
            acao={gradeLida ? 'Conferir' : 'Anexar'}
            onAbrir={() => setVista('grade')}
          />
          {listaMapas.map((m) => {
            const r = resumoMapa(m.casos)
            const sem = gruposSemIdentidade(m)
            const semTotal = sem.matutino + sem.vespertino
            return (
              <ItemDocumento
                key={m.id}
                estado={m.confirmar?.length ? 'erro' : semTotal ? 'aviso' : 'ok'}
                erro={!!m.confirmar?.length}
                titulo={`${m.hospital ? HOSPITAL_LABEL[m.hospital] : 'Hospital?'} · ${m.data ? formatData(m.data) : 'data?'}`}
                sub={`${r.total} cirurgia${r.total === 1 ? '' : 's'} — manhã ${r.matutino} · tarde ${r.vespertino}`}
                pendencia={
                  m.confirmar?.length
                    ? `Falta ${m.confirmar.join(' e ')}${m.dataForaDoFimDeSemana ? ` — o arquivo mostra ${formatData(m.dataForaDoFimDeSemana)}` : ''}`
                    : semTotal
                      ? `${semTotal} sala(s) sem anestesista`
                      : m.truncado ? 'Leitura cortada no fim — confira as últimas linhas' : ''
                }
                acao="Conferir"
                onAbrir={() => setVista(m.id)}
                onRemover={() => removerMapa(m.id)}
              >
                {/* HOSPITAL E DIA SEMPRE EDITÁVEIS (dono 25/08, "e se houver
                    confusão como resolver?"). Antes os dois Selects só nasciam
                    quando a leitura FALHAVA (`confirmar`), e leitura CONFIANTE
                    E ERRADA não tinha conserto: o item dizia "Unimed · 25/08" e
                    não havia por onde trocar — remover e reanexar reclassifica
                    igual. O risco é concreto: o mapa do HRO de FERIADO não tem
                    coluna ANEST (o anestesista vem em "Observação") nem rodapé
                    vermelho, que são as duas assinaturas do HRO no prompt, e
                    casa quase palavra por palavra com a descrição do MATERNO.
                    `redefinirMapa` já re-chaveia e re-prepara o lote com as
                    salas canônicas do hospital novo — só faltava o caminho. */}
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                    <Select
                      className="min-w-0"
                      aria-label="Hospital do mapa"
                      options={HOSPITAIS_MAPA.map((h) => ({ value: h, label: HOSPITAL_LABEL[h] || h }))}
                      value={m.hospital || ''}
                      onChange={(v) => redefinirMapa(m.id, { hospital: v })}
                      placeholder="Hospital"
                    />
                    <Select
                      className="min-w-0"
                      aria-label="Dia do mapa"
                      options={datasSelecionadas.map((iso, i) => ({
                        value: iso,
                        label: feriado ? `Feriado ${formatData(iso)}` : `${i === 0 ? 'Sábado' : 'Domingo'} ${formatData(iso)}`,
                      }))}
                      value={m.data || ''}
                      onChange={(v) => redefinirMapa(m.id, { data: v })}
                      placeholder="Dia"
                    />
                </div>
              </ItemDocumento>
            )
          })}
        </div>

        <FileUpload
          accept="image/*"
          multiple
          maxSize={15 * 1024 * 1024}
          variant="dropzone"
          label="Adicionar mapas cirúrgicos"
          description="Pode soltar vários de uma vez — hospital e dia saem do próprio arquivo. Paciente só por iniciais."
          onChange={(f) => importarMapas(f)}
          disabled={carregando || !canEdit}
        />

        {carregando && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo os documentos…
          </p>
        )}

        {[...todosBloqueios, ...bloqueiosMapas].map((b, i) => (
          <p key={i} className="flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {b}
          </p>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl space-y-2">
          <p className="text-center text-[11px] text-muted-foreground">
            {gradeLida
              ? `${diasAlvo.length * TURNOS.length} filas${planoMapas.length ? ` · ${planoMapas.length} turnos de cirurgias · ${totalCasos} casos` : ' · nenhum mapa cirúrgico anexado'}`
              : (feriado ? 'Anexe a lista do feriado — é ela que traz a fila de liberação' : 'Anexe a tabela de posições — é ela que traz a fila de liberação')}
          </p>
          <Button
            className="w-full"
            disabled={!canEdit || publicando || !gradeLida || !!todosBloqueios.length || !!bloqueiosMapas.length}
            onClick={() => publicar()}
          >
            {publicando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {feriado ? 'Publicar feriado' : 'Publicar fim de semana'}
          </Button>
        </div>
      </div>

      {/* Sair com documento/mapas anexados pergunta: o fim de semana não tem rascunho */}
      <ConfirmDialog
        open={guardaSaida.confirmOpen}
        variant="danger"
        onClose={guardaSaida.cancelClose}
        onConfirm={guardaSaida.confirmClose}
        title="Sair da conferência?"
        description="O documento e os mapas anexados serão perdidos — o fim de semana não guarda rascunho. Nada foi publicado."
        confirmText="Sair"
        cancelText="Continuar conferindo"
      />

      <ConfirmDialog
        open={!!encolhimentos}
        variant="danger"
        onClose={() => setEncolhimentos(null)}
        onCancel={() => setEncolhimentos(null)}
        onConfirm={() => { setEncolhimentos(null); publicar({ confirmado: true }) }}
        title="A escala publicada tem mais cirurgias"
        description={`O anexo traz menos casos do que já está publicado: ${(encolhimentos || []).join(' · ')}. Publicar substitui o turno inteiro — o que está lá some. Confira se o print pegou o mapa completo.`}
        confirmText="Republicar por cima"
      />
    </div>
  )

  const mapaAberto = mapas[vista]
  if (mapaAberto) {
    return (
      <ConferirMapaFdsPage
        mapa={mapaAberto}
        grade={dias[mapaAberto.data]?.grade || null}
        canEdit={canEdit}
        onSalvar={salvarMapa}
        onVoltar={() => setVista('lista')}
      />
    )
  }
  return vista === 'grade' ? renderGrade() : renderLista()
}

/**
 * Uma linha da lista de documentos. O alvo de toque do "Conferir" é 44px — o
 * badge sozinho media 31px, abaixo da regra da casa.
 */
function ItemDocumento({ estado, titulo, sub, pendencia, erro, acao, onAbrir, onRemover, children }) {
  const marca = {
    ok: { classe: 'bg-success text-white', simbolo: '✓' },
    aviso: { classe: 'bg-warning text-warning-foreground', simbolo: '!' },
    erro: { classe: 'bg-destructive text-white', simbolo: '!' },
    vazio: { classe: 'border border-dashed border-border-strong text-muted-foreground', simbolo: '' },
  }[estado] || { classe: 'bg-muted', simbolo: '' }
  return (
    <div className="border-b border-border last:border-b-0 px-3 py-2.5">
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true"
          className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold ${marca.classe}`}>
          {marca.simbolo || <FileText className="h-3 w-3" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-foreground">{titulo}</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>
          {pendencia && (
            <p className={`mt-0.5 text-xs font-semibold ${erro ? 'text-destructive' : 'text-warning'}`}>{pendencia}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 self-center">
          <button type="button" onClick={onAbrir}
            className="flex min-h-[44px] items-center rounded-[10px] border border-primary/45 px-2.5 text-[12.5px] font-bold text-primary active:opacity-60">
            {acao} ›
          </button>
          {onRemover && (
            <button type="button" onClick={onRemover} aria-label={`Remover ${titulo}`}
              className="text-[11px] font-semibold text-muted-foreground active:opacity-60">
              Remover
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

// memo leve fora do render de linha: 12 posições × render — suficiente sem cache
function candidatosPrimeiroNomeMemo(nome, roster) {
  return candidatosPrimeiroNome(nome, roster).length >= 2
}
