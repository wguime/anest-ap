/**
 * LiberacoesView — coluna de liberação do hospital (gerada pelas 18 regras).
 * Ordem exibida = ordem do rodapé da imagem: o nº 1 é o PLANTONISTA (último a ir
 * embora) e a liberação corre de baixo para cima. O plantonista marca liberado,
 * reordena, e ajusta a LINHA de um anestesista (local e/ou cirurgião) pelo ✏️ —
 * override estruturado que sobrevive à re-derivação. Realtime: reflete para todos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, ListOrdered, Loader2, MessageSquare, Moon, Pencil, Timer, UserPlus, X } from 'lucide-react'
import {
  Badge, Button, EmptyState, Input, Select, useToast,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { gerarColunaLiberacao, nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import { faseLiberacoes, plantonistasNoturnos, candidatosNome, linhasNoturnas, fundirLinhasNoturnas, marcarSelosNoTurno, ehDiaUtil, casarPorInicialSobrenome, P4_HOSPITAIS } from '@/lib/plantaoNoturno'
import { hojeISO, HOSPITAL_LABEL, OBSERVACAO_MAX } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import svc from '@/services/supabaseEscalaCirurgicaService'
import useAgoraMinuto from './useAgoraMinuto'
import PainelTempo, { formatFaltante } from './PainelTempo'
import { casoConcluido, casosResolvidos, compararSalas, filtrarPorTurno, formatRestante, LOCAIS_BASE, normNome, parseHoraMinutos, rodapeDoTurno, salaLiberacao } from './utils'
import { CasoCard } from './BoardView'
import CasoDetalheSheet from './CasoDetalheSheet'

// Sentinelas do dropdown de Local (valores impossíveis como nome de sala)
const LOCAL_AUTO = '__auto__'
const LOCAL_OUTRO = '__outro__'

// Cores do card por estado (pedido do dono): verde = escalado (em sala),
// amarelo = PRÓXIMO a ser liberado (último não-liberado — a liberação corre de
// baixo para cima), vermelho = já liberado.
// No dark a tinta /10 some no fundo escuro — tinta e borda mais fortes só lá.
// escalado = MESMO verde dos pills do seletor Unimed/HRO (pedido do dono 2026-07-21).
const CARD_ESTADO = {
  escalado: 'border-[hsl(var(--primary-hover))] bg-primary/10 dark:border-[hsl(var(--primary))] dark:bg-primary/20',
  proximo: 'border-warning/60 bg-warning/10 dark:border-warning/70 dark:bg-warning/20',
  liberado: 'border-destructive/40 bg-destructive/10 dark:border-destructive/70 dark:bg-destructive/20',
}

const primeiroNomeUpper = (nome) => String(nome || '').trim().split(/\s+/)[0]?.toUpperCase() || ''

// Selo P1–P4: VERDE ESCURO sólido, o mesmo da aba selecionada no seletor
// segmentado (pedido do dono 24/07 — o azul do variant info destoava).
const SELO_NOTURNO = 'gap-1 border-transparent bg-primary text-primary-foreground'

// P1/P2 são os plantonistas da noite — ficam até o fim e nunca entram na fila do
// "próximo a ser liberado" (pedido do dono 24/07). P3/P4 seguem a lógica do dia.
const SELO_SEM_PROXIMO = new Set(['P1', 'P2'])

// `meuUid`/`meuAlias`/`podeGerenciar` saíram das props em 29/07: existiam só para
// responder "sou eu quem comanda a fila?", que era a permissão da SUBSTITUIÇÃO de
// posição. Sem a troca, quem edita a escala (canEdit) opera a fila inteira e a
// ORDEM é que decide quem pode ser liberado agora.
export default function LiberacoesView({ escala, hospital, hospitalLabel, canEdit, turno, plantoes, p4Hospital = null, onDefinirP4, onDefinirCasos, onToggle, onToggleEscalado, onSetOverride, onAddAjuda, onRemoveAjuda, onReordenarAjuda }) {
  const { toast } = useToast()
  const isDemo = String(escala?.id || '').startsWith('demo-')
  // TURNO (23/07: manhã e tarde convivem no mesmo dia): a lista mostra só os casos
  // do turno selecionado e o rodapé (ordem de liberação) DAQUELE turno.
  const casosTurno = useMemo(() => filtrarPorTurno(escala?.casos || [], turno), [escala, turno])
  const rodapeTurno = useMemo(() => rodapeDoTurno(escala?.ordemLiberacao, turno), [escala, turno])
  const [editor, setEditor] = useState(null) // linha em edição (sheet)
  const [rascLocal, setRascLocal] = useState('')
  const [localOutro, setLocalOutro] = useState(false) // "Outro" no seletor de local
  const [rascCirurgiao, setRascCirurgiao] = useState('')
  const [rascTermino, setRascTermino] = useState('') // término manual "HH:MM"
  const [rascObservacao, setRascObservacao] = useState('') // recado operacional da linha
  const [alvoTempo, setAlvoTempo] = useState(null) // linha do sheet "Tempo faltante"
  const [salvandoEditor, setSalvandoEditor] = useState(false)
  const [casoAberto, setCasoAberto] = useState(null) // caso da linha aberto no detalhe (aba Completa)
  const [horaExata, setHoraExata] = useState('') // hora exata de término (HH:MM, Select DS)
  const [ajudaSheet, setAjudaSheet] = useState(false) // sheet "adicionar ajuda"
  const [ajudaUid, setAjudaUid] = useState('')
  const [p4Sheet, setP4Sheet] = useState(false) // sheet "Onde está o P4 hoje?"
  const [alvoSemAnest, setAlvoSemAnest] = useState(null) // alerta "?" sendo resolvido
  const [semAnestUid, setSemAnestUid] = useState('')

  // Cronômetro em tempo real: o texto é derivado puro de `agoraMin`. O hook
  // recalcula ao voltar do segundo plano (iOS/PWA mata o setInterval na
  // suspensão — pills congeladas o dia todo em produção, bug 2026-07-22).
  const agoraMin = useAgoraMinuto()

  // Anestesistas com caso reagendado p/ a tarde (status passa_tarde no board) —
  // compara por nome normalizado: a linha usa titleCase, o caso o texto importado.
  const nomesPassaTarde = useMemo(() => {
    const s = new Set()
    for (const c of casosResolvidos({ casos: casosTurno })) {
      // extra no campo novo; aceita o legado no principal (demo/dados antigos)
      if ((c.statusExtra === 'passa_tarde' || c.statusCirurgia === 'passa_tarde') && c.anestesista) {
        s.add(normNome(c.anestesista))
        if (c.anestesistaUserId) s.add(c.anestesistaUserId)
      }
    }
    return s
  }, [casosTurno])
  // casa por chave estável (uid) OU por nome normalizado (variantes de grafia)
  const temPassaTarde = (l) => nomesPassaTarde.has(l.chave) || nomesPassaTarde.has(normNome(l.anestesista))

  // Dicionário apelido→login: variantes do mesmo anestesista (rodapé × caso) colapsam
  // numa linha só — sem ele "GUILHERME D." virava linha extra no fim e roubava o
  // "próximo a ser liberado" do lugar certo (bug do piloto 2026-07-21).
  const { roster, options: opcoesRoster, resolver: resolverUid, rosterByUid, loading: rosterLoading } = useRosterAnestesistas()

  // Ajuda externa DO TURNO (nomes azuis) + opções do roster p/ o sheet de adicionar.
  const ajudaTurno = useMemo(() => rodapeDoTurno(escala?.ajudaExterna, turno), [escala, turno])

  // Anestesista LIVRE (pedido do dono 24/07): teve casos no turno e TODOS já
  // encerraram (terminada/suspensa) → badge "Livre". Conta por chave IGUAL à do
  // gerarColunaLiberacao (uid do vínculo/dicionário, senão nome normalizado) p/ casar
  // com linha.chave. O plantonista é avisado por notificação (no setStatusCirurgia).
  const statusPorChave = useMemo(() => {
    const m = new Map()
    const concl = (c) => c.statusCirurgia === 'terminada' || c.statusCirurgia === 'suspensa' || c.statusExtra === 'suspensa'
    for (const c of casosResolvidos({ casos: casosTurno })) {
      const nome = String(c.anestesista || '').trim()
      if (!nome || nome === '//') continue
      const partes = nome.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)
      const umSo = partes.length === 1
      for (const parte of partes) {
        const uid = (umSo ? c.anestesistaUserId : null) || resolverUid(parte) || null
        const key = uid || normNome(parte)
        const e = m.get(key) || { total: 0, concluidos: 0 }
        e.total += 1; if (concl(c)) e.concluidos += 1
        m.set(key, e)
      }
    }
    return m
  }, [casosTurno, resolverUid])
  const estaLivre = (l) => {
    const st = statusPorChave.get(l.chave)
    return !!st && st.total > 0 && st.concluidos === st.total
  }

  // Liberações SEMPRE com nome completo diferencial = 1º nome + último sobrenome
  // (pedido do dono 23/07: "Janaina" → "Janaína Favorito"). Vem do cadastro (uid);
  // sem vínculo, cai no titleCase do apelido dentro de gerarColunaLiberacao.
  // Dois CADASTROS diferentes podem cair no MESMO nome curto — "GUILHERME MELO" e
  // "GUILHERME SOUZA MELO" viram ambos "Guilherme Melo" (bug real 27/07: a mesma
  // pessoa apareceu em duas posições e não havia como distinguir na tela). Nome
  // curto ambíguo → mostra o nome COMPLETO, que é o que diferencia.
  const curtoAmbiguo = useMemo(() => {
    const cont = new Map()
    for (const r of roster || []) {
      if (!r?.nome) continue
      const k = normNome(nomeCirurgiaoCurto(r.nome))
      cont.set(k, (cont.get(k) || 0) + 1)
    }
    return cont
  }, [roster])
  const nomeExibicao = useCallback((uid) => {
    const r = rosterByUid.get(uid)
    if (!r?.nome) return null
    const curto = nomeCirurgiaoCurto(r.nome)
    return (curtoAmbiguo.get(normNome(curto)) || 0) > 1 ? titleCaseNome(r.nome) : curto
  }, [rosterByUid, curtoAmbiguo])

  const { linhas, semAnestesista } = useMemo(() => {
    if (!casosTurno.length) return { linhas: [], semAnestesista: [] }
    return gerarColunaLiberacao(casosTurno, rodapeTurno, {
      hospital: hospitalLabel,
      ajudaExterna: rodapeDoTurno(escala.ajudaExterna, turno), // AZUL, por-turno (ajuda da tarde ≠ da manhã)
      turno, // decide o "plantão da tarde" (último nome escalado do rodapé matutino)
      resolverUid,
      nomeExibicao,
    })
  }, [casosTurno, rodapeTurno, escala, hospitalLabel, turno, resolverUid, nomeExibicao])

  // Locais do hospital p/ o editor de linha (dropdown, pedido do dono 2026-07-22):
  // salas da escala do dia (ordem do board) + locais APRENDIDOS do histórico
  // (salas + ajustes de "Outro" dos últimos 60 dias — novo local salvo entra p/ todos).
  const [locaisAprendidos, setLocaisAprendidos] = useState([])
  useEffect(() => {
    let vivo = true
    const chaveHospital = String(hospitalLabel || '').toLowerCase()
    svc.fetchLocaisHospital(chaveHospital)
      .then((ls) => { if (vivo) setLocaisAprendidos(ls) })
      .catch(() => {}) // sem histórico → dropdown fica só com as salas do dia
    return () => { vivo = false }
  }, [hospitalLabel])

  const locaisHospital = useMemo(() => {
    const chaveHospital = String(hospitalLabel || '').toLowerCase()
    // TODAS as salas do hospital (base canônica), mesmo fora da escala do dia
    // (pedido do dono) ∪ salas do dia ∪ aprendidos; dedupe pelo rótulo exibido.
    const brutos = [
      ...(LOCAIS_BASE[chaveHospital] || []),
      ...(escala?.casos || []).map((c) => String(c.sala || '').trim()),
      ...locaisAprendidos,
    ]
    const vistos = new Set()
    const out = []
    for (const sala of brutos) {
      if (!sala) continue
      const label = salaLiberacao(sala)
      if (!vistos.has(label)) { vistos.add(label); out.push({ sala, label }) }
    }
    out.sort((a, b) => compararSalas(chaveHospital)(a.sala, b.sala))
    return out.map((x) => x.label)
  }, [escala, hospitalLabel, locaisAprendidos])

  const liberacoes = escala?.liberacoes || {}
  // overrides estruturados { local?, cirurgioes? }; string = formato legado (demo antigo)
  const overrides = escala?.linhaOverrides || {}
  // Leitura pela CHAVE ESTÁVEL (linha.chave = uid do vínculo ou nome normalizado),
  // com fallback no nome exibido p/ dados gravados no esquema antigo — o display
  // muda com vínculos e órfã marcações (bug real 2026-07-22).
  // Card do plantão noturno NÃO tem fallback pelo nome exibido: a chave dele é
  // namespaced ('noite:') justamente p/ não herdar o status do dia — ler o
  // esquema legado traria a marcação diurna de volta (pedido do dono 24/07).
  const marcaDe = (l) => (l.noturno ? liberacoes[l.chave] : liberacoes[l.chave] ?? liberacoes[l.anestesista])
  const overrideDe = (l) => {
    const ov = l.noturno ? overrides[l.chave] : overrides[l.chave] ?? overrides[l.anestesista]
    return typeof ov === 'string' ? { local: ov } : ov || null
  }
  // A troca saiu do app em 29/07, mas escalas ANTIGAS ainda têm a nota `troca`
  // gravada na linha. Ela vira TEXTO de observação (é exatamente o recado que a
  // observação passou a carregar) em vez de sumir ou quebrar o card — e some
  // assim que alguém escreve uma observação de verdade ou restaura a linha.
  const observacaoDe = (ov) => {
    if (ov?.observacao) return String(ov.observacao)
    const t = ov?.troca
    if (!t?.com) return ''
    return `Troca com ${titleCaseNome(t.com)}${t.hospital ? ` · ${HOSPITAL_LABEL[t.hospital] || t.hospital}` : ''}`
  }

  // FASE NOTURNA (decisões do dono 23/07 + redesenho 24/07): seg–sex (feriado
  // incluso), escala de HOJE — das 19h às 22h cada plantonista noturno vira um
  // CARD da lista com selo P1–P4 (HRO P1→P4 · Unimed P2→P3→P4 · Materno P4) e a
  // lista vespertina segue abaixo; às 22h a lista ZERA. Tudo derivado do relógio
  // (zero escrita na escala/rodapé — a corrupção de 22/07 veio de reescrevê-lo).
  const chaveHospital = hospital || String(hospitalLabel || '').toLowerCase()
  const noturnos = useMemo(() => plantonistasNoturnos(plantoes), [plantoes])
  const fase = faseLiberacoes({ agoraMin, dataEscala: escala?.data, hojeIso: hojeISO() })
  // nome do PegaPlantao ("G. Staub") → uid do vínculo, via candidatos do dicionário
  const resolverNomeCompleto = (nome) => {
    for (const cand of candidatosNome(nome)) {
      const uid = resolverUid(cand)
      if (uid) return uid
    }
    // "A. Schmidt": a inicial é o que desambigua e candidatosNome a descarta —
    // sem isto o P3 ficava sem badge na vespertina (bug 27/07).
    return casarPorInicialSobrenome(nome, roster, normNome)
  }

  // Dicionário de vínculos ainda carregando: NÃO renderizar a lista — um render sem
  // aliases classifica errado (variante não casada parece "sem caso" → afunda como
  // liberada) e a lista PULA quando os vínculos chegam (flake real visto 2026-07-21).
  if (rosterLoading) {
    return (
      <p className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </p>
    )
  }

  // Plantonistas noturnos do hospital (a partir das 19h) fundidos com a lista do
  // turno: vão para o TOPO com selo P1–P4 e a vespertina segue abaixo. Quem já
  // está na lista é HOISTADO (mesma chave/marcações, sem duplicar); quem não
  // está vira card `sintetico` (não existe no rodapé → não reordena).
  // Às 23h a lista do dia ZERA e sobram SÓ os P1–P4 (pedido do dono 24/07) —
  // filtrar os fundidos preserva as marcações de quem foi hoistado.
  const linhasNoite = fase === 'dia' ? [] : linhasNoturnas(chaveHospital, noturnos, p4Hospital)
  // Antes das 19h, no VESPERTINO da escala de HOJE: quem entra no plantão hoje já
  // aparece com o selo P1–P4 na lista da tarde (pedido do dono 25/07) — só o
  // aviso, sem `noturno`: posição, cor e liberação seguem a lógica do dia.
  // Só DIA ÚTIL: o plantão P1–P4 ainda não está estruturado p/ o fim de semana
  // (decisão do dono 25/07) — avisar no sábado seria informação inventada.
  const avisarSelos = fase === 'dia' && turno === 'vespertino'
    && escala?.data === hojeISO() && ehDiaUtil(escala?.data)
  const fundidas = linhasNoite.length
    ? fundirLinhasNoturnas(linhas, linhasNoite, {
        resolverUid: resolverNomeCompleto,
        normalizar: normNome,
        display: (nome, uid) => (uid && nomeExibicao(uid)) || titleCaseNome(nome),
      })
    : avisarSelos
      ? marcarSelosNoTurno(linhas, noturnos, { resolverUid: resolverNomeCompleto, normalizar: normNome })
      : linhas
  const linhasFase = fase === 'zerada' ? fundidas.filter((l) => l.noturno) : fundidas

  if (!escala || !linhasFase.length) {
    return fase === 'zerada' ? (
      <EmptyState
        icon={<Moon className="w-6 h-6" />}
        title="Liberações do dia encerradas"
        description="A lista zera às 23h e ficam só os plantonistas da noite — nenhum escalado para este hospital."
      />
    ) : (
      <EmptyState
        icon={<ListOrdered className="w-6 h-6" />}
        title="Sem liberações"
        description="Importe a escala deste hospital para gerar a ordem de liberação."
      />
    )
  }

  // A ORDEM É IMUTÁVEL NO APP (pedido do dono 2026-07-27): ninguém reordena a
  // fila — nem o plantonista. Ela vale como veio no rodapé vermelho da escala;
  // mudar a ordem é refazer/republicar a escala. As setas ↑↓ saíram da tela.
  // Desde 29/07 NADA nesta aba escreve em `ordem_liberacao` nem troca o dono de
  // um caso a partir da fila: a substituição de posição saiu junto com a troca.
  // Com ela saiu também a única leitura de "sou o plantonista?" — quem libera é
  // qualquer `canEdit`, e quem pode liberar AGORA é decidido pela ORDEM da fila.
  // marcar onde o coringa está é da equipe toda (mesma permissão de editar a lista)
  const podeMarcarP4 = !!canEdit && !!onDefinirP4

  // não escalado = está no rodapé mas NUNCA teve caso no dia → liberado por
  // definição (vermelho desde a publicação). Quem TEVE casos e todos encerraram
  // fica ATIVO (o conteúdo sai da linha, mas quem libera é o plantonista).
  const naoEscalado = (l) => !l.teveCasos && !(l.salas?.length) && !(l.cirurgioes?.length)
  const estaLiberada = (l) => {
    const m = marcaDe(l)
    const forcadoEscalado = m?.escalado === true // entrou na escala no meio do dia
    return (!!m && !forcadoEscalado) || (naoEscalado(l) && !forcadoEscalado)
  }
  // Liberados AFUNDAM para o fim da lista (pedido do dono 2026-07-21): a liberação
  // corre de baixo para cima, então o "próximo a ser liberado" fica sempre logo
  // ACIMA do bloco vermelho — nunca abaixo de quem já saiu. Ordem relativa
  // preservada dentro de cada grupo; persistir (setas) grava a ordem exibida.
  // Plantão noturno tem posição FIXA (pedido do dono 24/07): liberado NÃO afunda —
  // o P2 liberado volta para o lugar de P2, independente de onde estava escalado
  // no dia. O afundamento vale só para a lista do turno.
  // total de ajudas persistidas (= tamanho do array `ajuda_externa[turno]`), que é
  // o que limita as setas do bloco. Usa o maior `ajudaIdx` visto +1 em vez do
  // tamanho da lista exibida: quem virou plantão do contraturno saiu do bloco mas
  // continua ocupando posição no array.
  const totalAjudas = linhas.reduce((m, l) => (l.ajudaIdx != null ? Math.max(m, l.ajudaIdx + 1) : m), 0)
  const doTurno = linhasFase.filter((l) => !l.noturno)
  const linhasExibicao = [
    ...linhasFase.filter((l) => l.noturno),
    ...doTurno.filter((l) => !estaLiberada(l)),
    ...doTurno.filter(estaLiberada),
  ]

  // Reordenar persiste os NOMES ORIGINAIS do rodapé na ordem-base (sem o
  // afundamento de liberados da exibição). Persistir o nome EXIBIDO corrompia o
  // rodapé (duplicatas reais em 22/07 — o nome transformado não casava mais com
  // o dicionário e a linha se duplicava a cada re-derivação).
  /**
   * LIBERAÇÃO SÓ NA ORDEM (pedido do dono 2026-07-27): a fila corre de baixo p/
   * cima e apenas o "próximo a ser liberado" pode sair. Tocar em qualquer outro
   * avisa quantos vêm antes em vez de liberar — furar a ordem era o que
   * bagunçava a fila e obrigava a corrigir depois no banco.
   * `bloqueio` = { faltam, proximo } quando a linha não é a próxima.
   */
  const toggle = async (linha, liberado, bloqueio = null) => {
    if (bloqueio) {
      toast({
        variant: 'warning',
        // 12s: o aviso é a única resposta ao toque — sumir em 5s no meio do
        // centro cirúrgico fazia parecer que o app simplesmente não reagiu.
        duration: 12000,
        title: `Libere ${bloqueio.proximo} primeiro`,
        description: `${bloqueio.faltam === 1 ? 'Falta 1 anestesista' : `Faltam ${bloqueio.faltam} anestesistas`} antes de ${linha.anestesista} na ordem de liberação.`,
      })
      return
    }
    try {
      // aguarda a persistência ANTES do toast — sucesso mentiroso em falha de RPC
      // foi flagrado na auditoria F1.6 (toast aparecia e o banco ficava vazio)
      await onToggle?.(linha)
      if (!liberado) {
        toast({
          variant: 'success',
          title: `${linha.anestesista} liberado`,
          action: { label: 'Desfazer', onClick: () => onToggle?.(linha) },
        })
      }
    } catch { /* toast de erro já vem do context */ }
  }

  /**
   * Ids dos casos do turno que são DESTA linha. Casos com dois anestesistas
   * ("A + B") ficam de fora: mover levaria o caso inteiro e apagaria o colega —
   * esses se ajustam pelo detalhe do caso na Completa.
   */
  /**
   * Casos do turno que são DESTA linha, como OBJETOS — é o que liga a fila à aba
   * Completa: o plantonista abre o caso e marca terminada / define anestesista /
   * troca a sala sem sair das Liberações (pedido do dono 29/07).
   * Sala compartilhada ("A + B") entra aqui (o caso é dos dois) — só não entra
   * na lista que MOVE casos, onde levar o caso apagaria o colega.
   */
  const casosObjDaLinha = (linha) => casosResolvidos({ casos: casosTurno })
    .filter((c) => {
      const nome = String(c.anestesista || '').trim()
      if (!nome || nome === '//') return false
      return nome.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean).some((parte, _i, todas) => {
        const uid = (todas.length === 1 ? c.anestesistaUserId : null) || resolverUid(parte) || null
        return (uid || normNome(parte)) === linha.chave
      })
    })
    .sort((a, b) => String(a.hora || '99:99').localeCompare(String(b.hora || '99:99')))

  const abrirEditor = (linha) => {
    const ov = overrideDe(linha)
    const loc = ov?.local || ''
    setRascLocal(loc)
    setLocalOutro(!!loc && !locaisHospital.includes(loc)) // local livre já salvo → modo "Outro"
    setRascCirurgiao(ov?.cirurgioes || '')
    setRascTermino(ov?.termino || '')
    setRascObservacao(observacaoDe(ov))
    setEditor(linha)
  }
  // Salvar ESPERA a persistência antes de fechar (o padrão do `toggle`): fechar
  // antes era o "sucesso mentiroso" que a auditoria F1.6 flagrou.
  // Campos vazios NÃO são "restaurar automático" — mandar `null` aqui apagava o
  // flag `renovado` da linha e ressuscitava sala/cirurgião da manhã (bug 29/07).
  const salvarEditor = async () => {
    if (salvandoEditor) return
    const local = rascLocal.trim()
    const cirurgioes = rascCirurgiao.trim()
    const termino = rascTermino.trim()
    const observacao = rascObservacao.trim()
    setSalvandoEditor(true)
    try {
      await onSetOverride?.(editor, { local, cirurgioes, termino, observacao })
      // local novo (digitado em "Outro") entra na lista NA HORA; os demais aparelhos
      // aprendem no próximo load (o override salvo é a fonte do histórico)
      if (local && !locaisHospital.includes(local)) setLocaisAprendidos((prev) => [...prev, local])
      setEditor(null)
    } catch { /* toast de erro vem do context */ } finally { setSalvandoEditor(false) }
  }
  const restaurarEditor = async () => {
    if (salvandoEditor) return
    setSalvandoEditor(true)
    try {
      await onSetOverride?.(editor, null) // null = restauração explícita (limpa flags)
      setEditor(null)
    } catch { /* toast no context */ } finally { setSalvandoEditor(false) }
  }

  // "Tempo faltante": grava override.termino (agora + duração, ou hora exata),
  // PRESERVANDO local/cirurgiões/observação já ajustados — o override é gravado
  // inteiro, então um campo omitido aqui seria APAGADO.
  const definirTempo = async (linha, terminoHHMM) => {
    const ov = overrideDe(linha) || {}
    setRascTermino(terminoHHMM || '')
    try {
      await onSetOverride?.(linha, {
        local: ov.local || '',
        cirurgioes: ov.cirurgioes || '',
        termino: terminoHHMM || '',
        observacao: observacaoDe(ov),
      })
    } catch { /* toast no context */ }
    setAlvoTempo(null)
    setHoraExata('')
  }
  // Alerta "?" → dono: grava no caso (o alerta sai daqui E da Completa juntos).
  const confirmarSemAnest = async () => {
    const r = rosterByUid.get(semAnestUid)
    if (!r || !alvoSemAnest?.id) return
    try {
      await onDefinirCasos?.([alvoSemAnest.id], {
        uid: r.uid,
        apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome),
        rotulo: [alvoSemAnest.hora, salaLiberacao(alvoSemAnest.sala)].filter(Boolean).join(' '),
      })
      setAlvoSemAnest(null)
      setSemAnestUid('')
    } catch { /* toast de erro já vem do context */ }
  }

  /**
   * Marcar/desmarcar AJUDA à mão (pedido do dono 29/07): a ajuda vem dos nomes em
   * AZUL do rodapé, mas nem toda escala traz isso — e quando não vem, não havia
   * como marcar. Fonte ÚNICA com a aba Completa: as duas escrevem em
   * `ajudaExterna[turno]`, então marcar numa reflete na outra na hora.
   *
   * Ao REMOVER, tira a entrada exata que está no array (casada pela chave
   * resolvida, não pelo texto): o rodapé pode ter "CURY" e a linha exibir
   * "Marcos Cury" — comparar o nome exibido não removeria nada.
   * Ao ADICIONAR, entra no FIM do array, que é a ordem que a fila respeita: a
   * ÚLTIMA ajuda escrita é a primeira a sair.
   */
  const nomeAjudaDe = (linha) =>
    ajudaTurno.find((n) => (resolverUid(n) || normNome(n)) === linha.chave) || null
  const toggleAjuda = async (linha) => {
    const existente = nomeAjudaDe(linha)
    if (existente) await onRemoveAjuda?.(existente)
    else await onAddAjuda?.(linha.nomeOriginal || linha.anestesista)
  }

  // adicionar ajuda: resolve o roster → nome (apelido p/ casar no dicionário) → onAddAjuda
  const confirmarAjuda = () => {
    const r = rosterByUid.get(ajudaUid)
    if (!r) return
    onAddAjuda?.(r.apelidos?.[0] || primeiroNomeUpper(r.nome))
    setAjudaUid('')
    setAjudaSheet(false)
  }
  return (
    <div className="space-y-3">
      {/* Procedimentos sem anestesista NO TOPO (pedido do dono 24/07): o plantonista
          precisa cobrir. Somem sozinhos ao serem marcados como terminados/suspensos
          (concluído é filtrado em gerarColunaLiberacao). Hora em destaque, por horário. */}
      {fase !== 'zerada' && semAnestesista.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1 px-1 text-xs font-semibold text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Procedimentos sem anestesista
          </p>
          <div className="space-y-1.5">
            {semAnestesista.map((i, k) => {
              // Tocar no alerta define o responsável (pedido do dono 26/07) — o
              // caso sai da lista sozinho, aqui e na Completa (mesma fonte).
              const definivel = canEdit && !!i.id && !!onDefinirCasos
              const Wrapper = definivel ? 'button' : 'div'
              return (
                <Wrapper
                  key={i.id || k}
                  {...(definivel ? {
                    type: 'button',
                    onClick: () => { setAlvoSemAnest(i); setSemAnestUid('') },
                    'aria-label': `Definir anestesista de ${i.cirurgiao || i.sala || 'procedimento sem anestesista'}`,
                  } : {})}
                  className={[
                    'w-full rounded-xl border border-warning/50 bg-warning/10 p-2.5 text-left text-sm',
                    'dark:border-warning/60 dark:bg-warning/15',
                    definivel && 'active:opacity-70',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{i.hora || '—'}</span>
                    {i.sala && <span className="min-w-0 truncate font-semibold" title={i.sala}>{salaLiberacao(i.sala)}</span>}
                    <Badge variant="warning" badgeStyle="subtle" className="ml-auto shrink-0">Sem anestesista</Badge>
                  </div>
                  {(i.procedimento || i.cirurgiao) && (
                    <p className="mt-0.5 text-foreground/90">
                      {[i.procedimento, i.cirurgiao].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {definivel && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                      <UserPlus className="h-3 w-3 shrink-0" /> Toque para definir o anestesista
                    </p>
                  )}
                </Wrapper>
              )
            })}
          </div>
        </div>
      )}
      {/* div simples de propósito: animação de layout + reload do realtime moviam a
          linha sob o dedo (mesma classe do bug da inbox, fix 956aedd) */}
      <div className="space-y-1.5">
        {(() => {
          // Está na FILA de liberação? P1/P2 são os plantonistas da noite: nunca
          // entram no "próximo a ser liberado" (pedido do dono 24/07). P3/P4 entram.
          const naFila = (l) => {
            if (l.noturno && SELO_SEM_PROXIMO.has(l.selo)) return false
            const m = marcaDe(l)
            const emSala = m?.escalado === true || !naoEscalado(l)
            return !(m && !m.escalado) && emSala
          }
          // próximo a ser liberado = ÚLTIMO não-liberado ainda EM SALA
          let idxProximo = -1
          for (let i = linhasExibicao.length - 1; i >= 0; i--) {
            if (naFila(linhasExibicao[i])) { idxProximo = i; break }
          }
          const proximoNome = idxProximo >= 0 ? linhasExibicao[idxProximo].anestesista : null
          return linhasExibicao.map((linha, idx) => {
          // PLANTÃO NOTURNO (pedido do dono 24/07): ao virar P1–P4 a pessoa SAI da
          // posição em que estava — independente de hospital e de já ter sido
          // liberada no dia — e assume o posto TRABALHANDO (card verde). Nada da
          // situação diurna atravessa a virada: `linha.chave` do card noturno é
          // namespaced ('noite:'), então as marcações do dia não são lidas e uma
          // liberação feita À NOITE (P3/P4 seguem a lógica normal) persiste sozinha.
          const noturno = !!linha.noturno
          const semEscala = !noturno && naoEscalado(linha)
          const marcacao = marcaDe(linha)
          const forcadoEscalado = marcacao?.escalado === true // entrou na escala no meio do dia
          const liberadoReal = !!marcacao && !forcadoEscalado
          const liberado = liberadoReal || (semEscala && !forcadoEscalado)
          const estado = liberado ? 'liberado' : idx === idxProximo ? 'proximo' : 'escalado'
          // Bloqueio da liberação fora de ordem: só o "próximo" sai. Desfazer
          // (linha já liberada) e P1/P2 — que não estão na fila — nunca bloqueiam.
          const bloqueioOrdem = (!liberadoReal && !semEscala && idxProximo >= 0 && idx !== idxProximo && naFila(linha))
            ? { faltam: linhasExibicao.slice(idx + 1).filter(naFila).length, proximo: proximoNome }
            : null
          // LIVRE: terminou todos os casos do turno (aguardando o plantonista liberar)
          const livre = !noturno && !liberado && estaLivre(linha)
          const ov = overrideDe(linha)
          // linha RENOVADA (voltou de liberação): infos da manhã não valem mais —
          // derivado suprimido; só o que for preenchido manualmente aparece.
          const renovado = !!ov?.renovado
          // >1 cirurgião = lista (1 por linha); override manual = 1 linha como digitado
          const listaCirurgioes = ov?.cirurgioes
            ? [ov.cirurgioes]
            : (renovado || semEscala) ? [] : linha.cirurgioes.length ? linha.cirurgioes : ['…']
          const salasAuto = renovado ? '' : (linha.salas || []).map(salaLiberacao).join('/')
          const localExibido = ov?.local || salasAuto
          const observacaoLinha = observacaoDe(ov)
          // Cronômetro 100% MANUAL (decisão do dono 23/07): TODA linha nasce em
          // branco ("Tempo faltante") e só conta depois que alguém preenche —
          // a estimativa automática (hora+tempo dos casos da manhã) enchia a
          // coluna de "+8h53" sem sentido conforme o dia avançava.
          const cronometro = (() => {
            // terminou TUDO (badge Livre): o tempo que sobrou é informação vencida
            // — mostrar "~1h20" ao lado de "Livre" fazia o card se contradizer.
            if (liberado || livre) return null
            const manual = parseHoraMinutos(ov?.termino)
            if (manual == null) return null
            return {
              ...formatFaltante(manual, agoraMin),        // curto p/ a coluna
              titulo: formatRestante(manual, agoraMin),   // frase completa no title
            }
          })()
          // Tempo de CADA CIRURGIA (dono 29/07), ao lado do cirurgião a que pertence.
          // Linha com cirurgião AJUSTADO à mão vira texto livre: não há caso para
          // casar, então não há chip (o tempo segue no detalhe do caso).
          const terminoDoToken = (token) =>
            (renovado || semEscala || ov?.cirurgioes) ? null : parseHoraMinutos(linha.tokenTermino?.[token])
          return (
            <div
              // chave ESTÁVEL (uid do vínculo ou nome normalizado) — o nome EXIBIDO
              // não é único: rodapé sem vínculo + caso com uid geram duas linhas da
              // mesma pessoa e o React omitia/duplicava uma delas.
              key={linha.chave}
              // âncoras de teste: ordem da lista, nome e selo do plantão noturno (e2e)
              data-linha={linha.chave}
              data-nome={linha.anestesista}
              data-selo={linha.selo || undefined}
              className={['flex min-h-[68px] items-center rounded-xl border transition-colors', CARD_ESTADO[estado]].join(' ')}
            >
              <span className="w-5 shrink-0 pl-1 text-center text-xs font-semibold text-muted-foreground">{idx + 1}</span>

              {/* setas de reordenar REMOVIDAS (pedido do dono 2026-07-27): a ordem
                  do rodapé é imutável no app — nem o plantonista mexe. */}

              {/* marcar liberado: alvo 44px, círculo visual 28px (não escalado já nasce liberado) */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => (semEscala ? onToggleEscalado?.(linha) : toggle(linha, liberadoReal, bloqueioOrdem))}
                aria-label={semEscala
                  ? (forcadoEscalado ? `Voltar ${linha.anestesista} para não escalado` : `Marcar ${linha.anestesista} como escalado`)
                  : liberadoReal ? `Desfazer liberação de ${linha.anestesista}` : `Marcar ${linha.anestesista} liberado`}
                className={['flex h-11 w-9 shrink-0 items-center justify-center', canEdit ? 'cursor-pointer' : 'cursor-default'].join(' ')}
              >
                <span className={[
                  'flex h-7 w-7 items-center justify-center rounded-full border-2',
                  // vazio precisa de presença: border-border sumia sobre os cards tintados no dark
                  liberado
                    ? 'border-destructive bg-destructive text-white'
                    : 'border-muted-foreground/50 bg-background/40 text-transparent dark:border-muted-foreground/80',
                ].join(' ')}>
                  <Check className="w-4 h-4" />
                </span>
              </button>

              {/* corpo em 2 níveis: nome em destaque, cirurgião(ões) abaixo */}
              <div className="min-w-0 flex-1 py-2.5 pl-1">
                {/* flex + truncate: badge SEMPRE ao lado do nome (sem quebrar p/ baixo) */}
                <p className={['flex items-center gap-1.5 text-[15px] font-semibold leading-tight', liberadoReal && 'line-through opacity-60'].filter(Boolean).join(' ')}>
                  {/* SELO do plantão noturno ANTES do nome (pedido do dono 24/07).
                      No P4 o selo é o BOTÃO que abre "Onde está o P4 hoje?" — área
                      de toque esticada por padding negativo (≥44px sem inchar a linha). */}
                  {linha.selo && (linha.selo === 'P4' && podeMarcarP4 ? (
                    <button
                      type="button"
                      onClick={() => setP4Sheet(true)}
                      aria-label="Definir em qual hospital o P4 está hoje"
                      className="-my-2.5 -mx-1 shrink-0 px-1 py-2.5"
                    >
                      <Badge className={SELO_NOTURNO}>
                        {linha.selo} <Pencil className="h-3 w-3" />
                      </Badge>
                    </button>
                  ) : (
                    <Badge className={`shrink-0 ${SELO_NOTURNO}`}>{linha.selo}</Badge>
                  ))}
                  <span className="min-w-0 truncate">{linha.anestesista}</span>
                  {/* liberado = card enxuto (pedido do dono): só nome + badge Liberado + lápis */}
                  {!liberadoReal && linha.isPlantonista && (
                    <Badge variant="secondary"
                      className="shrink-0 dark:bg-[hsl(var(--badge-success))] dark:text-[hsl(var(--badge-success-foreground))]">
                      Plantonista
                    </Badge>
                  )}
                  {/* AZUL SÓLIDO (pedido do dono 2026-07-21) — mesmo destaque do Plantonista */}
                  {!liberadoReal && linha.isAjuda && (
                    <Badge variant="info" className="shrink-0">Ajuda</Badge>
                  )}
                  {/* último nome escalado do rodapé = plantonista do turno SEGUINTE:
                      sai primeiro (regra do dono 29/07, nos dois turnos). Verde
                      sólido, a cor dos plantões. O rótulo vem da lib — de manhã é
                      "Plantão da tarde", à tarde "Plantão da manhã". */}
                  {!liberadoReal && linha.isProximoPlantao && (
                    <Badge className="shrink-0 border-transparent bg-primary text-primary-foreground">
                      {linha.plantaoLabel}
                    </Badge>
                  )}
                  {/* LIVRE (verde): terminou todos os casos — o plantonista também é notificado */}
                  {livre && (
                    <Badge variant="success" className="shrink-0">Livre</Badge>
                  )}
                  {/* caso reagendado p/ a tarde (status no board) — o plantonista precisa saber ao
                      liberar. Linha RENOVADA não herda: o passa-tarde era da escala de antes. */}
                  {!liberadoReal && !renovado && !noturno && temPassaTarde(linha) && (
                    <Badge className="shrink-0 border-transparent bg-category-purple text-white">
                      Passa para tarde
                    </Badge>
                  )}
                </p>
                {/* 2ª linha: infos à esquerda; cronômetro + lápis à direita (o nome acima
                    fica com a LARGURA TODA — badge ao lado sem truncar o nome) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* card vermelho = badge "Liberado", sempre em linha própria
                        (vale p/ liberado de fato E p/ não escalado, que já nasce liberado) */}
                    {liberado && (
                      <div className="mt-1">
                        <Badge variant="destructive" badgeStyle="subtle" className="dark:bg-destructive/25">Liberado</Badge>
                      </div>
                    )}
                    {/* papel no plantão noturno. Quem é plantonista já tem o BADGE
                        ao lado do nome — repetir a palavra na linha de baixo era
                        redundante. No P4 sem marcação, diz que está nos três. */}
                    {!liberadoReal && linha.papelNoturno && !linha.isPlantonista && (
                      <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        {linha.papelNoturno}
                        {linha.selo === 'P4' && !p4Hospital && ' · nos três hospitais'}
                      </p>
                    )}
                    {/* cirurgiões em ORDEM DE HORÁRIO, 1 por linha, SEM bolinha (pedido do dono 24/07).
                        Cada um leva o tempo faltante DA SUA CIRURGIA num chip cinza pequeno
                        (dono 29/07) — a pílula verde à direita é o total da PESSOA. */}
                    {!liberadoReal && listaCirurgioes.length > 0 && (
                      <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        {listaCirurgioes.map((c, i) => {
                          const alvo = terminoDoToken(c)
                          // CONTAGEM SÓ NA CIRURGIA EM ANDAMENTO. Agendada mostra a
                          // HORA. Com no máximo uma contagem por pessoa, "~45min"
                          // não pode ser lido como o total dela.
                          const andando = !!linha.tokenAndamento?.[c]
                          const falta = andando && alvo != null ? formatFaltante(alvo, agoraMin) : null
                          const hora = linha.tokenTermino?.[c] || null
                          return (
                            <p key={i} className="flex items-center gap-1.5">
                              {andando && (
                                <span className="shrink-0 text-primary" title="Cirurgia em andamento" aria-label="em andamento">▶</span>
                              )}
                              <span className="min-w-0 truncate">{c}</span>
                              {i === 0 && ov?.cirurgioes && <span className="shrink-0 text-xs text-primary">· ajustado</span>}
                              {(falta || hora) && (
                                <span
                                  title={andando
                                    ? `Esta cirurgia (em andamento) termina às ${hora}`
                                    : `Esta cirurgia está prevista para terminar às ${hora}`}
                                  className={[
                                    'inline-flex shrink-0 items-center gap-0.5 rounded-md border px-1 py-px text-xs font-medium',
                                    falta?.atrasada
                                      ? 'border-warning/50 bg-warning/10 text-warning'
                                      : 'border-border bg-muted/60 text-foreground/80',
                                  ].join(' ')}
                                >
                                  <Timer className="h-3 w-3 shrink-0" /> {falta ? falta.texto : hora}
                                </span>
                              )}
                            </p>
                          )
                        })}
                        {/* COBERTURA: sem isto, uma pessoa com 3 cirurgias e 1
                            término informado parecia ter o quadro completo. Só
                            aparece quando há mais de uma cirurgia — numa só o
                            número já é evidente. */}
                        {linha.casosAtivos > 1 && (
                          <p className="mt-0.5 text-xs text-muted-foreground/80">
                            {linha.casosAtivos} cirurgias · {linha.casosComTermino} com término informado
                          </p>
                        )}
                      </div>
                    )}
                    {/* sala/local abaixo do cirurgião (pedido do dono 2026-07-20) */}
                    {!liberadoReal && localExibido && (
                      <p
                        className={['mt-0.5 truncate text-xs font-semibold', ov?.local ? 'text-primary' : 'text-foreground/80'].join(' ')}
                        title={ov?.local ? 'Local ajustado' : localExibido}
                      >
                        {localExibido}
                      </p>
                    )}
                    {/* OBSERVAÇÃO da linha (dono 29/07, no lugar da troca): recado
                        operacional escrito à mão — "trocou com o Fulano no HRO",
                        "sai mais cedo", "está no consultório". Fica LOGO ABAIXO do
                        local, onde já moram as infos da linha, e em cor de destaque
                        (é a única coisa do card que ninguém deriva sozinho). */}
                    {!liberadoReal && observacaoLinha && (
                      <p className="mt-0.5 flex items-start gap-1 text-[13px] font-medium leading-snug text-primary">
                        <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="min-w-0">{observacaoLinha}</span>
                      </p>
                    )}
                    {/* card amarelo: deixa explícito o PORQUÊ da cor */}
                    {estado === 'proximo' && (
                      <div className="mt-1">
                        <Badge variant="warning" badgeStyle="subtle" className="dark:bg-warning/25">Próximo a ser liberado</Badge>
                      </div>
                    )}
                  </div>

                  {/* direita: cronômetro OU "Tempo faltante"; liberado = card enxuto (só lápis) */}
                  <div className="flex shrink-0 items-center">
                    {!liberadoReal && (cronometro ? (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => canEdit && setAlvoTempo(linha)}
                        title={`${cronometro.titulo} — toque para ajustar`}
                        className="flex min-h-[26px] items-center gap-1 whitespace-nowrap rounded-full
                                   bg-primary px-2.5 text-sm font-semibold text-primary-foreground"
                      >
                        <Timer className="h-3.5 w-3.5 shrink-0" /> {cronometro.texto}
                      </button>
                    ) : (canEdit && (
                      <button
                        type="button"
                        onClick={() => setAlvoTempo(linha)}
                        aria-label={`Definir tempo faltante de ${linha.anestesista}`}
                        className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-primary active:bg-muted"
                      >
                        <Timer className="mr-0.5 inline h-3 w-3" /> Tempo faltante
                      </button>
                    )))}
                    {/* SETAS SÓ NO BLOCO DE AJUDA (dono 30/07). O rodapé segue
                        IMUTÁVEL — reescrevê-lo corrompeu a escala em 22/07 e há
                        teste travando isso. Aqui a ordem persistida é o próprio
                        array `ajuda_externa[turno]`, um campo separado, e só o
                        subconjunto azul se move. O contraturno fica de fora: ele é
                        posição fixa (último), não escolha. */}
                    {canEdit && linha.isAjuda && !linha.isProximoPlantao && linha.ajudaIdx != null && (
                      <>
                        <button
                          type="button"
                          onClick={() => onReordenarAjuda?.(linha.ajudaIdx, linha.ajudaIdx - 1)}
                          disabled={linha.ajudaIdx === 0}
                          aria-label={`Subir ${linha.anestesista} na ordem das ajudas`}
                          className="flex h-11 w-7 shrink-0 items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onReordenarAjuda?.(linha.ajudaIdx, linha.ajudaIdx + 1)}
                          disabled={linha.ajudaIdx >= totalAjudas - 1}
                          aria-label={`Descer ${linha.anestesista} na ordem das ajudas`}
                          className="flex h-11 w-7 shrink-0 items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => abrirEditor(linha)}
                        aria-label={`Editar local/cirurgião de ${linha.anestesista}`}
                        className="flex h-11 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
          })
        })()}
      </div>

      {/* Adicionar anestesista de OUTRO hospital como AJUDA (pedido do dono 24/07):
          entra ao fim da coluna (badge Ajuda azul, primeiro a ser liberado). */}
      {canEdit && fase !== 'zerada' && (
        <Button variant="outline" className="w-full" onClick={() => setAjudaSheet(true)}>
          <UserPlus className="w-4 h-4" /> Adicionar anestesista (ajuda)
        </Button>
      )}

      {/* Painel da linha (✏️): casos da pessoa (ponte com a Completa) + tempo +
          ajustes de exibição + quem ocupa a posição. Redesenho 29/07: antes era só
          "local e cirurgião" e o plantonista precisava trocar de aba p/ tudo. */}
      <Sheet open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <SheetContent side="bottom" className="max-h-[88vh]">
          <SheetHeader>
            <SheetTitle className="flex flex-wrap items-center gap-2">
              {editor?.anestesista}
              {editor?.isPlantonista && <Badge variant="secondary">Plantonista</Badge>}
              {editor?.isAjuda && <Badge variant="info">Ajuda</Badge>}
              {editor?.isProximoPlantao && (
                <Badge className="border-transparent bg-primary text-primary-foreground">{editor.plantaoLabel}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          {editor && (
            <div className="space-y-3 px-1 pb-4">
              {/* ── CASOS DESTA PESSOA — ponte com a aba Completa (dono 29/07) ── */}
              {(() => {
                const meus = casosObjDaLinha(editor)
                if (!meus.length) return null
                const pendentes = meus.filter((c) => !casoConcluido(c)).length
                return (
                  <div>
                    <p className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Casos no turno</span>
                      <span className="normal-case tracking-normal">
                        {pendentes ? `${pendentes} em aberto` : 'todos encerrados'}
                      </span>
                    </p>
                    <div className="space-y-1.5">
                      {meus.map((c) => (
                        <CasoCard
                          key={c.id || `${c.sala}-${c.ordem}`}
                          caso={c}
                          salaLabel={salaLiberacao(c.sala)}
                          agoraMin={agoraMin}
                          onClick={() => { setEditor(null); setCasoAberto(c) }}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Toque no caso para marcar andamento, definir anestesista ou trocar a sala — o mesmo detalhe da aba Completa.
                    </p>
                  </div>
                )
              })()}

              {/* ── AJUDA à mão (dono 29/07) — card noturno fica de fora: ele é
                  sintetizado do plantão, não existe no rodapé do turno. ── */}
              {canEdit && !editor.noturno && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => { await toggleAjuda(editor); setEditor(null) }}
                >
                  <UserPlus className="w-4 h-4" />
                  {editor.isAjuda ? 'Não é ajuda de outro hospital' : 'Marcar como ajuda de outro hospital'}
                </Button>
              )}

              {/* ── OBSERVAÇÃO (dono 29/07, no lugar da troca) ──────────────────
                  "Retire a funcionalidade de troca (apenas deixe um campo em aberto
                  para observação)". Quem trocou de hospital ou de sala escreve aqui;
                  o plantonista lê e resolve. Nada reescreve o rodapé nem move casos. */}
              <div>
                <label htmlFor="editor-observacao" className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Observação
                </label>
                <Input
                  id="editor-observacao"
                  value={rascObservacao}
                  maxLength={OBSERVACAO_MAX}
                  onChange={(e) => setRascObservacao(e.target.value)}
                  placeholder="ex.: trocou com o Cury no HRO"
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                />
                {/* LGPD: campo aberto que o grupo TODO enxerga. A escala só guarda
                    iniciais de paciente e um texto livre não pode furar isso. */}
                <p className="mt-1 text-xs text-muted-foreground">
                  Recado operacional para a equipe — aparece no card da fila. Não escreva nome de paciente (a escala só guarda iniciais).
                </p>
              </div>

              {/* ── TEMPO DA PESSOA SAIU DAQUI (dono 29/07). Havia DOIS lugares
                  editando o mesmo `linha_overrides[chave].termino`: este bloco e o
                  sheet do ⏱ da própria linha. Um campo com dois donos na tela é o
                  que fazia ninguém saber qual valia — e este painel é justamente o
                  que estourava a altura do sheet. Ficou o ⏱, que já explica o que
                  o número significa. NÃO reintroduzir aqui. ── */}

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Local</p>
                {editor.salas?.length > 0 && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    Automático (dos casos): <b className="text-foreground/80">{editor.salas.map(salaLiberacao).join('/')}</b>
                  </p>
                )}
                {/* dropdown com os locais do hospital (dia + aprendidos); "Outro" abre digitação */}
                <Select
                  id="editor-local-select"
                  className="w-full"
                  options={[
                    { value: LOCAL_AUTO, label: 'Automático (derivado dos casos)' },
                    ...locaisHospital.map((l) => ({ value: l, label: l })),
                    { value: LOCAL_OUTRO, label: 'Outro… (digitar)' },
                  ]}
                  value={localOutro ? LOCAL_OUTRO : (rascLocal || LOCAL_AUTO)}
                  onChange={(v) => {
                    if (v === LOCAL_OUTRO) { setLocalOutro(true); setRascLocal('') }
                    else { setLocalOutro(false); setRascLocal(v === LOCAL_AUTO ? '' : v) }
                  }}
                  placeholder="Local"
                />
                {localOutro && (
                  <Input
                    id="editor-local"
                    autoFocus
                    className="mt-2"
                    value={rascLocal}
                    onChange={(e) => setRascLocal(e.target.value)}
                    placeholder="ex.: Coronel Freitas"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                  />
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Local novo digitado em "Outro" entra na lista para as próximas vezes.
                </p>
              </div>
              <div>
                <label htmlFor="editor-cirurgiao" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Cirurgião(ões)</label>
                {editor.cirurgioes?.length > 0 && (
                  <p className="mb-1 text-xs text-muted-foreground">
                    Automático (dos casos): <b className="text-foreground/80">{editor.cirurgioes.join(' · ')}</b>
                  </p>
                )}
                <Input
                  id="editor-cirurgiao"
                  value={rascCirurgiao}
                  onChange={(e) => setRascCirurgiao(e.target.value)}
                  placeholder={editor.cirurgioes.length ? editor.cirurgioes.join(' · ') : 'ex.: Liana W'}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Campo vazio segue o automático. "Restaurar automático" limpa também o cronômetro e as marcas desta linha.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled={salvandoEditor} onClick={restaurarEditor}>
                  Restaurar automático
                </Button>
                <Button className="flex-1" disabled={salvandoEditor} onClick={salvarEditor}>
                  {salvandoEditor ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Tempo faltante — 1 toque define o término e liga o cronômetro do card */}
      <Sheet open={!!alvoTempo} onOpenChange={(o) => { if (!o) { setAlvoTempo(null); setHoraExata('') } }}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Timer className="w-4 h-4 shrink-0" /> {alvoTempo?.anestesista || 'Tempo'}
            </SheetTitle>
            <p className="text-sm text-muted-foreground">Tempo para término ou horário de término de todos os seus casos</p>
          </SheetHeader>
          {alvoTempo && (
            <div className="space-y-5 px-1 pb-6 pt-2">
              {/* Sem parágrafo explicativo (dono 29/07: "muito texto e ninguém vai
                  ler"). O subtítulo do header carrega o essencial — é o TOTAL dos
                  casos da pessoa, não o término de UMA cirurgia. E nunca é a soma
                  deles: estimativa que estoura não converge para zero. */}
              <PainelTempo
                atual={overrideDe(alvoTempo)?.termino || ''}
                horaExata={horaExata}
                onHoraExata={setHoraExata}
                onDefinir={(hhmm) => definirTempo(alvoTempo, hhmm)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Adicionar/remover ajuda (anestesista de outro hospital) — turno atual */}
      <Sheet open={ajudaSheet} onOpenChange={(o) => { if (!o) { setAjudaSheet(false); setAjudaUid('') } }}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 shrink-0" /> Adicionar anestesista (ajuda)
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              Anestesista de outra escala que está ajudando no {hospitalLabel} — entra ao fim da liberação (badge Ajuda, primeiro a ser liberado).
            </p>
          </SheetHeader>
          <div className="space-y-4 px-1 pb-6 pt-2">
            {/* ajudas já cadastradas neste turno (com remover) */}
            {ajudaTurno.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ajudas no turno</p>
                {ajudaTurno.map((nome) => (
                  <div key={nome} className="flex items-center gap-2 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5">
                    <Badge variant="info" className="shrink-0">Ajuda</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{titleCaseNome(nome)}</span>
                    <button type="button" aria-label={`Remover ${nome}`} onClick={() => onRemoveAjuda?.(nome)}
                      className="shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {rosterLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando roster…
              </p>
            ) : (
              <Select className="w-full" searchable options={opcoesRoster} value={ajudaUid}
                onChange={setAjudaUid} placeholder="Escolha o anestesista" />
            )}
            <Button className="w-full" disabled={!ajudaUid} onClick={confirmarAjuda}>Adicionar como ajuda</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Definir o anestesista de um procedimento "?" direto da aba Liberações
          (pedido do dono 26/07). Grava no CASO — a Completa e o alerta daqui
          derivam da mesma fonte, então o alerta some nas duas na hora. */}
      <Sheet open={!!alvoSemAnest} onOpenChange={(o) => { if (!o) { setAlvoSemAnest(null); setSemAnestUid('') } }}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Quem assume este procedimento?</SheetTitle>
          </SheetHeader>
          {alvoSemAnest && (
            <div className="space-y-3 p-1">
              <div className="rounded-xl border border-border bg-muted/30 p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold tabular-nums">{alvoSemAnest.hora || '—'}</span>
                  {alvoSemAnest.sala && <span className="min-w-0 truncate font-semibold">{salaLiberacao(alvoSemAnest.sala)}</span>}
                </div>
                {(alvoSemAnest.procedimento || alvoSemAnest.cirurgiao) && (
                  <p className="mt-0.5 text-muted-foreground">
                    {[alvoSemAnest.procedimento, alvoSemAnest.cirurgiao].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <Select className="w-full" searchable options={opcoesRoster} value={semAnestUid}
                onChange={setSemAnestUid} placeholder="Escolha o anestesista" />
              <Button className="w-full" disabled={!semAnestUid} onClick={confirmarSemAnest}>
                Definir anestesista
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Onde está o P4 (coringa) hoje — marcação do DIA, compartilhada com o
          grupo em realtime. Marcado, o P4 some dos outros dois hospitais. */}
      <Sheet open={p4Sheet} onOpenChange={(o) => !o && setP4Sheet(false)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Onde está o P4 hoje?</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 p-1">
            <p className="text-sm text-muted-foreground">
              O P4 é coringa: sem definição, ele aparece nos três hospitais. A marcação vale para hoje e todos veem.
            </p>
            <div className="space-y-2">
              {P4_HOSPITAIS.map((h) => (
                <Button
                  key={h}
                  variant={p4Hospital === h ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => { setP4Sheet(false); onDefinirP4?.(h) }}
                >
                  {HOSPITAL_LABEL[h]}
                  {p4Hospital === h && <Check className="ml-1 h-4 w-4" />}
                </Button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detalhe do caso vindo da LINHA (dono 29/07): é o MESMO sheet da aba
          Completa — andamento, "definir anestesista deste caso" e trocar sala saem
          daqui, sem trocar de aba. Sheet aninhado não: fecha o painel da linha e
          abre este (mesmo padrão do board ao definir anestesista). */}
      {casoAberto && (
        <CasoDetalheSheet
          escala={escala}
          caso={casoAberto}
          onClose={() => setCasoAberto(null)}
          podeEditar={canEdit && !isDemo}
          podeDefinirAnestesista={() => canEdit && !isDemo && !!onDefinirCasos}
          onDefinirAnestesista={(sala, caso) => {
            setCasoAberto(null)
            setAlvoSemAnest({
              id: caso?.id || null, sala, hora: caso?.hora || '',
              procedimento: caso?.procedimento || '', cirurgiao: caso?.cirurgiao || '',
            })
            setSemAnestUid('')
          }}
        />
      )}
    </div>
  )
}
