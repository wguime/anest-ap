/**
 * LiberacoesView — coluna de liberação do hospital (gerada pelas 18 regras).
 * Ordem exibida = ordem do rodapé da imagem: o nº 1 é o PLANTONISTA (último a ir
 * embora) e a liberação corre de baixo para cima. O plantonista marca liberado,
 * reordena, e ajusta a LINHA de um anestesista (local e/ou cirurgião) pelo ✏️ —
 * override estruturado que sobrevive à re-derivação. Realtime: reflete para todos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeftRight, Check, ChevronDown, ChevronRight, ChevronUp, History, ListOrdered, Loader2, MessageSquare, Moon, Pencil, Plus, Timer, UserPlus, X } from 'lucide-react'
import {
  Badge, Button, ConfirmDialog, EmptyState, Input, Select, useToast,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { gerarColunaLiberacao, nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import { faseLiberacoes, plantonistasNoturnos, candidatosNome, linhasNoturnas, fundirLinhasNoturnas, marcarSelosNoTurno, ehDiaUtil, casarPorInicialSobrenome, P4_HOSPITAIS } from '@/lib/plantaoNoturno'
import { marcarSelosFds, linhasNoturnasFds, plantonistasFaixaFds, FDS_TURNO_FAIXA, resolverNomeEstrito, ehFeriado } from '@/lib/escalaFds'
import { passaTurnoLabel } from '@/lib/escalaCirurgicaRegras'
import { hojeISO, HOSPITAL_LABEL, OBSERVACAO_MAX } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import svc from '@/services/supabaseEscalaCirurgicaService'
import useAgoraMinuto from './useAgoraMinuto'
import useAvisoPlantonista from './useAvisoPlantonista'
import { AvisoTempoEstourado } from './useAvisoTempoEstourado'
import PainelTempo, { formatFaltante, fraseCronometro, fraseFaltante } from './PainelTempo'
import AddCasoSheet from './AddCasoSheet'
import { casoConcluido, casosDaFilaDoTurno, casosResolvidos, chaveSalaEscolha, compararSalas, formatRestante, LOCAIS_BASE, normNome, observacaoDaLinha, parseHoraMinutos, rodapeDoTurno, salaLiberacao, turnoDoCaso } from './utils'

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
// MODO FDS (dono 15/08): fila de liberação ÚNICA do fim de semana — `escala` é a
// linha pseudo-hospital 'fds', `casosFds` traz os casos dos 3 hospitais (cada um
// anotado com hospitalOrigem, campo só de exibição) e `fdsMeta` é o payload do
// documento (grade P1–P4, Pn→pessoa, escalação). Troca/P4-coringa ficam FORA do
// modo FDS (a fila única já modela "pega caso em qualquer hospital").
// Teto do recado do plantonista — o mesmo do CHECK da tabela. É aviso de
// corredor, não comunicado (para comunicado o app tem o módulo Comunicados).
const AVISO_MAX = 160

// Hospitais que a fila única cobre — o rótulo é o que vai para o override e o
// que o card mostra, então sai do MESMO mapa que o resto do módulo usa.
const HOSPITAIS_FILA = ['unimed', 'hro', 'materno'].map((v) => ({ value: v, label: HOSPITAL_LABEL[v] || v }))

export default function LiberacoesView({ escala, hospital, hospitalLabel, canEdit, turno, plantoes, meuUid = null, meuAlias = '', meuNome = '', p4Hospital = null, onDefinirP4, onDefinirCasos, onTrocarResponsavel, onDevolverResponsavel, onTrocarPosicao, onToggle, onToggleEscalado, onSetOverride, onAddAjuda, onRemoveAjuda, onReordenarAjuda, contraturnoOutros = [], presencaOutros = [], paresTroca = [], onMarcarTroca, onAbrirTroca, onExecutarTroca, onDesfazerSubstituicao, modoFds = false, casosFds = null, fdsMeta = null, escalaCasoNovo = null, onGarantirEscala, onNavigate }) {
  const { toast } = useToast()
  // TURNO (23/07: manhã e tarde convivem no mesmo dia): a lista mostra só os casos
  // do turno selecionado e o rodapé (ordem de liberação) DAQUELE turno.
  // Turno NOTURNO do FDS não tem casos próprios (o CHECK do banco só aceita
  // matutino/vespertino): as cirurgias em curso à noite são as da TARDE — a
  // base é o vespertino e o card do plantonista herda o que ele está operando.
  const turnoBase = turno === 'noturno' ? 'vespertino' : turno
  // Dicionário apelido→login: variantes do mesmo anestesista (rodapé × caso) colapsam
  // numa linha só — sem ele "GUILHERME D." virava linha extra no fim e roubava o
  // "próximo a ser liberado" do lugar certo (bug do piloto 2026-07-21).
  const { roster, options: opcoesRoster, resolver: resolverUid, rosterByUid, loading: rosterLoading } = useRosterAnestesistas()

  const rodapeTurno = useMemo(() => rodapeDoTurno(escala?.ordemLiberacao, turnoBase), [escala, turnoBase])
  // ⚠️ `casosDaFilaDoTurno`, e não `filtrarPorTurnoExibicao`: a cirurgia que
  // atravessa o turno ("Passa para tarde") conta para quem JÁ está no turno e
  // nunca cria posição na fila para quem não está — ver o cabeçalho do helper
  // (caso Gabriela, Unimed, 24/08). No quadro da Completa e na aba Minhas ela
  // segue aparecendo: lá a pergunta é "esta cirurgia existe?", aqui é "quem
  // está nesta fila?".
  const casosTurno = useMemo(
    () => casosDaFilaDoTurno((modoFds && casosFds) ? casosFds : (escala?.casos || []), turnoBase, rodapeTurno, resolverUid),
    [escala, turnoBase, modoFds, casosFds, rodapeTurno, resolverUid]
  )
  const [editor, setEditor] = useState(null) // linha em edição (sheet)
  const [rascLocal, setRascLocal] = useState('')
  const [rascHospital, setRascHospital] = useState('') // hospital da linha (só fila única)
  const [respUid, setRespUid] = useState('')            // novo responsável pela posição
  const [posColega, setPosColega] = useState('')        // colega com quem trocar de posição
  const [trocandoResp, setTrocandoResp] = useState(false)
  const [localOutro, setLocalOutro] = useState(false) // "Outro" no seletor de local
  const [rascCirurgiao, setRascCirurgiao] = useState('')
  const [rascTermino, setRascTermino] = useState('') // término manual "HH:MM"
  const [rascObservacao, setRascObservacao] = useState('') // recado operacional da linha
  // Qual linha do painel está com o editor aberto ('recado'|'local'|'cirurgiao'|
  // 'troca'|null). Uma por vez: a lista mostra, o editor abre abaixo dela.
  const [abaPainel, setAbaPainel] = useState(null)
  const [alvoTempo, setAlvoTempo] = useState(null) // linha do sheet "Tempo faltante"
  const [horaExata, setHoraExata] = useState('') // hora exata de término (HH:MM, Select DS)
  const [ajudaSheet, setAjudaSheet] = useState(false) // sheet "adicionar ajuda"
  const [ajudaUid, setAjudaUid] = useState('')
  const [p4Sheet, setP4Sheet] = useState(false) // sheet "Onde está o P4 hoje?"
  const [alvoSemAnest, setAlvoSemAnest] = useState(null)
  const [semAnestUid, setSemAnestUid] = useState('')
  const [executandoTroca, setExecutandoTroca] = useState(false)
  const [confirmarTroca, setConfirmarTroca] = useState(null) // par aguardando o pop-up (dono 18/08)
  const [addCaso, setAddCaso] = useState(false) // urgência/encaixe direto da fila (dono 16/08)
  const [escalaDoCasoNovo, setEscalaDoCasoNovo] = useState(null) // criada sob demanda
  const [criandoEscala, setCriandoEscala] = useState(false)
  const [avisoSheet, setAvisoSheet] = useState(false) // compor recado do plantonista
  const [historicoSheet, setHistoricoSheet] = useState(false) // ler o que já passou no turno
  const [rascAviso, setRascAviso] = useState('')

  // RECADO DO PLANTONISTA (dono 17/08). Fora do context de propósito — ver o
  // cabeçalho de useAvisoPlantonista.
  // a identidade vem das PROPS (a página já a tem): puxar `useUser` aqui obrigaria
  // um UserProvider em volta da view em todo teste que a monta, por um dado que
  // ela já recebe
  const { avisos, historico: historicoAvisos, podeEnviar: podeAvisar, enviar: enviarAviso, confirmar: confirmarAviso, excluir: excluirAviso, enviando: enviandoAviso } = useAvisoPlantonista({
    escalaId: escala?.id,
    turno: turno || turnoBase,
    userId: meuUid,
    userName: meuNome || null,
    // vai no título do push ("Recado do plantonista · HRO"): quem recebe com o
    // celular bloqueado precisa saber de qual hospital é antes de abrir
    hospitalLabel: hospitalLabel || null,
  })

  // Cronômetro em tempo real: o texto é derivado puro de `agoraMin`. O hook
  // recalcula ao voltar do segundo plano (iOS/PWA mata o setInterval na
  // suspensão — pills congeladas o dia todo em produção, bug 2026-07-22).
  const agoraMin = useAgoraMinuto()

  // Anestesistas com caso reagendado p/ a tarde (status passa_tarde no board) —
  // compara por nome normalizado: a linha usa titleCase, o caso o texto importado.
  const nomesPassaTarde = useMemo(() => {
    const s = new Set()
    for (const c of casosResolvidos({ casos: casosTurno })) {
      // SÓ o caso DESTE turno marca a linha: desde 22/08 a cirurgia da manhã que
      // passa para a tarde aparece também na tarde, e lá o rótulo seria "Passa
      // para noite" — ela passou para DENTRO deste turno, não para fora dele.
      // Sem turno informado (chamada legada) não há o que recortar.
      if (turnoBase && turnoDoCaso(c) !== turnoBase) continue
      // extra no campo novo; aceita o legado no principal (demo/dados antigos)
      if ((c.statusExtra === 'passa_tarde' || c.statusCirurgia === 'passa_tarde') && c.anestesista) {
        s.add(normNome(c.anestesista))
        if (c.anestesistaUserId) s.add(c.anestesistaUserId)
      }
    }
    return s
  }, [casosTurno])
  // casa por chave estável (uid) OU por nome normalizado (variantes de grafia).
  // `l.uid` cobre o slot ASSUMIDO: a chave segue sendo a do dono original, mas os
  // casos (e o status deles) pertencem a quem assumiu.
  const temPassaTarde = (l) => nomesPassaTarde.has(l.chave) || (l.uid && nomesPassaTarde.has(l.uid)) || nomesPassaTarde.has(normNome(l.anestesista))

  // Ajuda externa DO TURNO (nomes azuis) + opções do roster p/ o sheet de adicionar.
  const ajudaTurno = useMemo(() => rodapeDoTurno(escala?.ajudaExterna, turnoBase), [escala, turnoBase])

  // Anestesista LIVRE (pedido do dono 24/07): teve casos no turno e TODOS já
  // encerraram (terminada/suspensa) → badge "Livre". Conta por chave IGUAL à do
  // gerarColunaLiberacao (uid do vínculo/dicionário, senão nome normalizado) p/ casar
  // com linha.chave. Só badge visual — a escala não manda notificação (decisão 30/07).
  const statusPorChave = useMemo(() => {
    const m = new Map()
    for (const c of casosResolvidos({ casos: casosTurno })) {
      const nome = String(c.anestesista || '').trim()
      if (!nome || nome === '//') continue
      const partes = nome.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)
      const umSo = partes.length === 1
      for (const parte of partes) {
        const uid = (umSo ? c.anestesistaUserId : null) || resolverUid(parte) || null
        const key = uid || normNome(parte)
        const e = m.get(key) || { total: 0, concluidos: 0 }
        e.total += 1; if (casoConcluido(c)) e.concluidos += 1
        m.set(key, e)
      }
    }
    return m
  }, [casosTurno, resolverUid])
  const estaLivre = (l) => {
    const st = statusPorChave.get(l.chave) || (l.uid && statusPorChave.get(l.uid)) || null
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
    // FDS: a fila publicada existe ANTES das listas de procedimentos (são
    // importações separadas) — o rodapé sozinho já rende as linhas; sem casos,
    // todo mundo nasce "não escalado" até a importação chegar.
    if (!casosTurno.length && !(modoFds && rodapeTurno.length)) return { linhas: [], semAnestesista: [] }
    // SLOTS ASSUMIDOS (troca declarada executada, dono 30/07): a lib recebe os
    // assumidaPor por chave e troca a IDENTIDADE do slot — quem assumiu aparece
    // na posição do colega em vez de virar linha extra no fim da fila.
    const assumidas = {}
    const prefixoTurno = (turnoBase === 'matutino' || turnoBase === 'vespertino') ? `${turnoBase}:` : ''
    for (const [rawKey, ov] of Object.entries(escala?.linhaOverrides || {})) {
      if (prefixoTurno && !String(rawKey).startsWith(prefixoTurno)) continue
      const k = prefixoTurno ? String(rawKey).slice(prefixoTurno.length) : rawKey
      if (ov?.assumidaPor?.uid || ov?.assumidaPor?.nome) assumidas[k] = ov.assumidaPor
    }
    return gerarColunaLiberacao(casosTurno, rodapeTurno, {
      hospital: hospitalLabel,
      ajudaExterna: rodapeDoTurno(escala.ajudaExterna, turnoBase), // AZUL, por-turno (ajuda da tarde ≠ da manhã)
      // "plantão do turno seguinte" (último do rodapé sai 1º) é conhecimento de
      // DIA ÚTIL — na fila única do FDS a posição vem do documento e mover o
      // último corromperia a leitura da ordem publicada. `opts.turno` só
      // alimenta essa regra na lib; o namespacing das marcações é da view.
      turno: modoFds ? undefined : turno,
      resolverUid,
      nomeExibicao,
      assumidas,
      // EMPRESTADOS (dono 30/07): quem tem CASO em outro hospital neste turno foi
      // ajudar lá — mantém a posição do rodapé daqui, com badge (a lib decide).
      // Só entradas com sala: presença de rodapé sem caso não prova que foi.
      ajudandoFora: presencaOutros.filter((p) => p.sala),
      // VISITANTES (dono 31/07): rodapés das OUTRAS escalas com o índice de cada
      // nome — quem está aqui de ajuda libera primeiro, na ordem de liberação de lá.
      rodapeOutros: presencaOutros.filter((p) => p.rodapeIdx != null),
    })
  }, [casosTurno, rodapeTurno, escala, hospitalLabel, turno, turnoBase, resolverUid, nomeExibicao, presencaOutros, modoFds])

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
    // ⚠️ DEFEITO CORRIGIDO (dono 24/08): a chave saía de `hospitalLabel`, que na
    // fila única vale "Fim de semana" — uma chave que não existe em LOCAIS_BASE.
    // O complemento viria de `escala.casos`, e a linha 'fds' tem SEMPRE zero
    // casos. Resultado: no fim de semana o seletor de Local abria VAZIO, e foi
    // por isso que `local` nunca foi usado em nenhum sábado ou domingo. Na fila
    // única a lista é a UNIÃO dos três hospitais, com o hospital escolhido na
    // linha acima estreitando quando há um.
    const chaveHospital = modoFds
      ? String(rascHospital || '').toLowerCase()
      : String(hospitalLabel || '').toLowerCase()
    // TODAS as salas do hospital (base canônica), mesmo fora da escala do dia
    // (pedido do dono) ∪ salas do dia ∪ aprendidos; dedupe pelo rótulo exibido.
    const brutos = [
      // sem hospital escolhido na fila única: a base dos TRÊS, para haver o que
      // escolher (é a diferença entre um seletor útil e um seletor vazio)
      ...(LOCAIS_BASE[chaveHospital]
        || (modoFds ? HOSPITAIS_FILA.flatMap((h) => LOCAIS_BASE[h.value] || []) : [])),
      // na fila única os casos vêm de `casosTurno` (a linha 'fds' não tem casos)
      ...((modoFds ? casosTurno : escala?.casos) || []).map((c) => String(c.sala || '').trim()),
      ...locaisAprendidos,
    ]
    const vistos = new Set()
    const out = []
    for (const sala of brutos) {
      if (!sala) continue
      const label = salaLiberacao(sala)
      // Dedupe pela IDENTIDADE da sala, não pelo rótulo: no HRO "Sala 4" (escala
      // publicada antes de 20/08) e "Bloco A - Sala 4" (base de hoje) são a mesma.
      const chave = chaveSalaEscolha(chaveHospital, label)
      if (!vistos.has(chave)) { vistos.add(chave); out.push({ sala, label }) }
    }
    out.sort((a, b) => compararSalas(chaveHospital)(a.sala, b.sala))
    return out.map((x) => x.label)
  }, [escala, hospitalLabel, locaisAprendidos, modoFds, rascHospital, casosTurno])

  const liberacoes = escala?.liberacoes || {}
  // overrides estruturados { local?, cirurgioes? }; string = formato legado (demo antigo)
  const overrides = escala?.linhaOverrides || {}
  const chaveEscopo = (chave) => turno && (turno === 'matutino' || turno === 'vespertino') ? `${turno}:${chave}` : chave
  // Leitura pela CHAVE ESTÁVEL (linha.chave = uid do vínculo ou nome normalizado),
  // com fallback no nome exibido p/ dados gravados no esquema antigo — o display
  // muda com vínculos e órfã marcações (bug real 2026-07-22).
  // Card do plantão noturno NÃO tem fallback pelo nome exibido: a chave dele é
  // namespaced ('noite:') justamente p/ não herdar o status do dia — ler o
  // esquema legado traria a marcação diurna de volta (pedido do dono 24/07).
  // Fallback pelo NOME NORMALIZADO além do exibido (fix 30/07): quando o vínculo
  // local promove a chave da linha de nome→uid (caso definido pelo seletor, alias
  // fora do dicionário), a marcação gravada minutos antes sob a chave-nome não
  // pode orfanar — a liberação sumiria do card na mesma tarde.
  const marcaDe = (l) => (l.noturno
    ? liberacoes[chaveEscopo(l.chave)] ?? liberacoes[l.chave]
    : liberacoes[chaveEscopo(l.chave)] ?? liberacoes[l.chave] ?? liberacoes[chaveEscopo(normNome(l.nomeOriginal || ''))] ?? liberacoes[normNome(l.nomeOriginal || '')] ?? liberacoes[chaveEscopo(l.anestesista)] ?? liberacoes[l.anestesista])
  const overrideDe = (l) => {
    const ov = l.noturno
      ? overrides[chaveEscopo(l.chave)] ?? overrides[l.chave]
      : overrides[chaveEscopo(l.chave)] ?? overrides[l.chave] ?? overrides[chaveEscopo(normNome(l.nomeOriginal || ''))] ?? overrides[normNome(l.nomeOriginal || '')] ?? overrides[chaveEscopo(l.anestesista)] ?? overrides[l.anestesista]
    return typeof ov === 'string' ? { local: ov } : ov || null
  }
  // Nota `troca` legada vira texto de observação — regra compartilhada em utils
  // (o espelho do tempo total no detalhe do caso preserva a mesma conversão).
  const observacaoDe = (ov) => observacaoDaLinha(ov, HOSPITAL_LABEL)

  // FASE NOTURNA (decisões do dono 23/07 + redesenho 24/07): seg–sex (feriado
  // incluso), escala de HOJE — das 19h às 22h cada plantonista noturno vira um
  // CARD da lista com selo P1–P4 (HRO P1→P4 · Unimed P2→P3→P4 · Materno P4) e a
  // lista vespertina segue abaixo; às 22h a lista ZERA. Tudo derivado do relógio
  // (zero escrita na escala/rodapé — a corrupção de 22/07 veio de reescrevê-lo).
  const chaveHospital = hospital || String(hospitalLabel || '').toLowerCase()
  const noturnos = useMemo(() => plantonistasNoturnos(plantoes), [plantoes])
  // modoFds liga a transição noturna no sáb/dom (fila única publicada) — os 4
  // nomes vêm da faixa 19-07 da grade IMPORTADA, nunca do card Plantões.
  // Feriado tem só manhã+tarde na lista simples; não há grade 19-07 nem fila
  // noturna a fundir. Mantém a fila vespertina publicada até o fim do dia.
  // ⚠️ a data decide, não `fdsMeta.tipo`: o meta só existe depois de publicar
  // e uma republicação sem ele devolveria a fase noturna em silêncio.
  const feriado = modoFds && ehFeriado(escala?.data)
  const fase = feriado
    ? 'dia'
    : faseLiberacoes({ agoraMin, dataEscala: escala?.data, hojeIso: hojeISO(), fds: modoFds })
  // CAUDA VERMELHA AUTOMÁTICA: dia útil sempre; FERIADO também (dono 25/08, "os
  // usuários que não tiverem casos deixe como liberados"). Sáb/dom seguem FORA
  // pela decisão de 24/08 — e a diferença é de fluxo, não de gosto: no fim de
  // semana o mapa cirúrgico chega em importação SEPARADA, muitas vezes depois
  // da lista, então "sem caso" ali quer dizer "ainda não importei" e o vermelho
  // dizia "já foi embora" de quem tinha acabado de entrar na escala. No feriado
  // a lista e os mapas entram JUNTOS, na mesma tela, então "sem caso" é
  // informação de verdade.
  // ⚠️ continua sendo CAUDA, não "qualquer um sem caso": vermelho no MEIO da
  // fila é lido como liberação fora de ordem (incidente Eduardo, 20/08). E a
  // guarda `temAlguemComTrabalho` (22/08) segue valendo — sem nenhum nome com
  // cirurgia não há cauda, que é exatamente o caso da TARDE de 25/08, publicada
  // com as 18 cirurgias sem anestesista definido.
  const caudaAutomatica = !modoFds || feriado

  // HOSPITAL DE CADA PESSOA na fila única (modo FDS): derivado dos casos
  // mesclados (hospitalOrigem) pela MESMA chave canônica das linhas (uid do
  // vínculo ou nome normalizado — padrão statusPorChave). Vira prefixo do
  // local no card ("Unimed · CC - Sala 1"), porque sala sozinha é ambígua
  // quando a fila cruza hospitais.
  const mapaHospitais = useCallback((casos) => {
    const m = new Map()
    for (const c of casosResolvidos({ casos: casos || [] })) {
      const rotulo = HOSPITAL_LABEL[c.hospitalOrigem]
      if (!rotulo) continue
      const nome = String(c.anestesista || '').trim()
      if (!nome || nome === '//') continue
      const partes = nome.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)
      const umSo = partes.length === 1
      for (const parte of partes) {
        const uid = (umSo ? c.anestesistaUserId : null) || resolverUid(parte) || null
        const key = uid || normNome(parte)
        const set = m.get(key) || new Set()
        set.add(rotulo)
        m.set(key, set)
      }
    }
    return m
  }, [resolverUid])
  const hospitaisPorChave = useMemo(
    () => (modoFds ? mapaHospitais(casosTurno) : null),
    [modoFds, mapaHospitais, casosTurno],
  )
  // Hospital de cada pessoa no DIA INTEIRO (os dois turnos), não só no exibido:
  // é o que o selo de plantão do FERIADO consome, porque lá o plantão é 07h→07h
  // e à tarde o plantonista pode já não ter cirurgia nenhuma.
  const hospitaisDoDia = useMemo(
    () => (modoFds ? mapaHospitais((modoFds && casosFds) ? casosFds : (escala?.casos || [])) : null),
    [modoFds, mapaHospitais, casosFds, escala],
  )
  const hospitaisDe = (l) => {
    if (!hospitaisPorChave) return null
    const set = hospitaisPorChave.get(l.chave) || (l.uid && hospitaisPorChave.get(l.uid)) || null
    return set?.size ? [...set].join('/') : null
  }

  // PLANTÃO FÍSICO da faixa atual (modo FDS): quem está em Unimed/HRO segundo a
  // grade — badge específico no lugar do "Plantonista" genérico (que diria menos:
  // no FDS os dois fisicamente de plantão saem por último e a fila é uma só).
  const plantaoFisico = useMemo(() => {
    if (!modoFds) return null
    const m = new Map()
    const add = (nomeBruto, rotulo) => {
      const nome = String(nomeBruto || '').trim()
      if (!nome) return
      // mesmas chaves do marcarSelosNoTurno: uid do vínculo; sem vínculo, as
      // variantes de candidatosNome — a LINHA casa por chave inteira, então
      // token solto ("JOAO") não gera falso positivo (chave da linha é o nome
      // completo normalizado ou o uid)
      const uid = resolverUid(nome)
      const chaves = [uid, ...(uid ? [] : candidatosNome(nome).map(normNome))].filter(Boolean)
      for (const k of chaves) if (!m.has(k)) m.set(k, rotulo)
    }

    // FERIADO (dono 25/08): não há grade P1–P4. "O primeiro e segundo nomes da
    // lista sempre serão plantão de algum hospital ... ou seja os dois últimos a
    // serem liberados são os plantões" — e o que o selo diz é essa SEGUNDA
    // metade: quem FECHA a fila DESTE turno.
    //
    // ⚠️ o selo é POSICIONAL, não da pessoa (correção do dono no mesmo dia: "na
    // escala da tarde, os dois últimos a serem liberados devem receber o badge
    // de plantão e os primeiros a serem liberados (que foram os plantões da
    // manhã) devem perder"). A 1ª versão saía de `fdsMeta.listaFonte` — a folha,
    // que não vira —, então de tarde o selo aparecia sobre FERNANDA e DANIELA
    // enquanto elas eram as PRIMEIRAS a ir embora: o quadro dizia "de plantão"
    // sobre quem estava saindo, e não dizia nada sobre quem ia ficar até a noite.
    // Por isso a fonte é a ORDEM PUBLICADA do turno exibido, cujas posições 1 e 2
    // são, por convenção do rodapé, os dois últimos a serem liberados. De manhã
    // dá o mesmo resultado de antes (a ordem matutina É a folha); de tarde, que
    // é a folha invertida, dá os dois do fim dela.
    // Mesmo desenho do ramo de fim de semana logo abaixo, que já lê a faixa do
    // TURNO EXIBIDO. O hospital de cada um sai das cirurgias DO DIA.
    if (feriado) {
      for (const nome of rodapeTurno.slice(0, 2)) {
        const chave = resolverUid(String(nome || '').trim()) || normNome(nome)
        const onde = hospitaisDoDia?.get(chave)
        // sem cirurgia no dia não dá para dizer QUAL hospital — o genérico não
        // mente, e é melhor que apagar a informação de que a pessoa é plantão
        add(nome, onde?.size ? `Plantão ${[...onde].join('/')}` : 'Plantonista')
      }
      return m.size ? m : null
    }

    if (!fdsMeta?.grade) return null
    // FAIXA DO TURNO EXIBIDO, não a do relógio (defeito visto 16/08: às 11h a
    // tarde e a noite apareciam SEM os badges, porque a faixa vinha do relógio
    // — a manhã). Os dois primeiros da fila são sempre os plantões daquele
    // turno, e é isso que o badge tem de dizer em qualquer horário.
    const faixa = FDS_TURNO_FAIXA[turno]
    if (!faixa) return null
    const { unimed, hro } = plantonistasFaixaFds(fdsMeta.grade, faixa)
    add(unimed, 'Plantão Unimed')
    add(hro, 'Plantão HRO')
    return m
  }, [modoFds, feriado, fdsMeta, turno, rodapeTurno, resolverUid, hospitaisDoDia])
  // vale também no card NOTURNO (dono 16/08: "adicione os badges de plantão em
  // todos os turnos") — lá a chave é namespaced 'noite:', daí o chaveDia
  const plantaoFisicoDe = (l) => {
    if (!plantaoFisico) return null
    for (const k of [l.chave, l.chaveDia, l.uid, normNome(l.nomeOriginal || ''), normNome(l.anestesista || '')]) {
      if (k && plantaoFisico.has(k)) return plantaoFisico.get(k)
    }
    return null
  }
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
  // FDS: a NOITE é um TURNO PRÓPRIO do seletor (dono 15/08 21h: "sábado de
  // manhã não está idêntica" — a fusão dos 4 sobre a lista do dia roubava o
  // topo e renumerava tudo). No turno 'noturno' a fila é SÓ os 4 da grade
  // 19-07 (ordem da esquerda p/ a direita) MAIS quem a ordem publicada da noite
  // acrescentar — a fila noturna do dono é maior que a grade (sáb P2,P1,P4,P3,
  // P11,P8,P7 · dom P3,P4,P1,P2,P11,P6,P5).
  // Matutino/Vespertino ficam PUROS a qualquer hora: conferir a fila da manhã
  // às 21h mostra a manhã como publicada.
  const noiteFds = modoFds && turno === 'noturno'
  const linhasNoite = modoFds
    // SÓ os 4 plantões da faixa 19-07 da grade importada (cols 1–2 fixas no
    // hospital = foraDaFila; 3–4 = ordem de chamada). ORDEM_NOTURNA e o card
    // Plantões são conhecimento de dia útil e ficam fora daqui.
    ? (noiteFds ? linhasNoturnasFds(fdsMeta?.grade, fdsMeta?.posicoes, {
        // ordem DITADA da noite (dono 16/08) quando publicada; sem ela, a fila é
        // a própria linha 19-07 da grade
        ordem: Array.isArray(fdsMeta?.ordemNoite) ? fdsMeta.ordemNoite : [],
        resolverUid: (n) => resolverNomeEstrito(n, resolverUid), normalizar: normNome,
      }) : [])
    : fase === 'dia' ? [] : linhasNoturnas(chaveHospital, noturnos, p4Hospital)
  // Antes das 19h, no VESPERTINO da escala de HOJE: quem entra no plantão hoje já
  // aparece com o selo P1–P4 na lista da tarde (pedido do dono 25/07) — só o
  // aviso, sem `noturno`: posição, cor e liberação seguem a lógica do dia.
  // Só DIA ÚTIL: o plantão P1–P4 ainda não está estruturado p/ o fim de semana
  // (decisão do dono 25/07) — avisar no sábado seria informação inventada.
  // 11/08: o aviso valia SÓ na lista da tarde e o dono viu gente de plantão hoje
  // sem selo na de manhã. Quem entra no plantão à noite carrega o selo nos DOIS
  // turnos da escala de HOJE — é informação da pessoa, não do turno.
  const avisarSelos = !modoFds && fase === 'dia' && escala?.data === hojeISO() && ehDiaUtil(escala?.data)
  const fundidas = linhasNoite.length
    ? fundirLinhasNoturnas(linhas, linhasNoite, {
        // FDS: matching ESTRITO — sem ele "JOAO RICARDO" casava com o alias
        // "JOAO" do JOAO HENRIQUE e os dois viravam um card só (16/08)
        resolverUid: modoFds ? (n) => resolverNomeEstrito(n, resolverUid) : resolverNomeCompleto,
        normalizar: normNome,
        display: (nome, uid) => (uid && nomeExibicao(uid)) || titleCaseNome(nome),
      })
    : avisarSelos
      ? marcarSelosNoTurno(linhas, noturnos, { resolverUid: resolverNomeCompleto, normalizar: normNome })
      : linhas
  // BADGE Pn (P1–P12) em toda linha da fila única, conforme a posição da pessoa
  // na ordem da escala (dono 15/08). Card noturno já vem com o selo da fusão —
  // marcarSelosFds não sobrescreve.
  const comSelos = modoFds
    ? marcarSelosFds(fundidas, fdsMeta?.posicoes, { resolverUid, normalizar: normNome })
    : fundidas
  // Turno NOTURNO do FDS = só quem está na fila da noite (mesma regra do
  // 'zerada' de dia útil): quem já estava na lista da tarde é HOISTADO com o
  // conteúdo (cirurgia em curso continua visível), quem não estava vira card
  // sintético.
  const linhasFase = (fase === 'zerada' || noiteFds) ? comSelos.filter((l) => l.noturno) : comSelos

  // SOU O PLANTONISTA? (dono 17/08). A view é quem sabe: o selo sai da lib, na
  // linha da fila. Casa por chave (uid do vínculo) e, sem vínculo, pelo nome
  // normalizado — a mesma dupla identidade que a fila usa em todo lugar.
  // `meuUid`/`meuAlias` voltaram às props por causa disto: saíram em 29/07,
  // quando a substituição deixou a aba sem nenhuma leitura de "quem sou eu".
  // sem useMemo de propósito: este trecho roda DEPOIS do early return de
  // `rosterLoading`, e hook após early return quebra a ordem dos hooks. É um
  // `.some()` sobre a fila do turno — algumas dezenas de linhas.
  const souPlantonista = (() => {
    const meu = normNome(meuAlias)
    return linhasFase.some((l) => l.isPlantonista && (
      (meuUid && (l.chave === meuUid || l.uid === meuUid))
      || (meu && (normNome(l.nomeOriginal || '') === meu || normNome(l.anestesista || '') === meu))
    ))
  })()


  // urgência/encaixe precisa de uma escala REAL de destino — mas ela pode ser
  // CRIADA na hora (dono 16/08: hospital sem escala publicada ficava sem ação
  // nenhuma). A demo continua de fora: lá nada é gravado.
  const ehDemo = String(escalaCasoNovo?.id || escala?.id || '').startsWith('demo-')
  const podeAddCaso = !ehDemo && (!!escalaCasoNovo || !!onGarantirEscala)

  /** Abre o sheet de caso, criando a escala do hospital se ainda não existir. */
  const abrirAddCaso = async () => {
    if (criandoEscala) return
    if (escalaCasoNovo?.id) { setEscalaDoCasoNovo(escalaCasoNovo); setAddCaso(true); return }
    setCriandoEscala(true)
    try {
      const nova = await onGarantirEscala?.()
      if (nova?.id) { setEscalaDoCasoNovo(nova); setAddCaso(true) }
    } catch { /* toast vem do context */ } finally { setCriandoEscala(false) }
  }

  // Ações do topo (dono 16/08: "mesmo sem casos publicados adicione a opção de
  // adicionar caso e ajuda") — aparecem TAMBÉM quando não há fila nenhuma,
  // que é o caso do Materno em quase todo dia.
  const acoesTopo = canEdit && (podeAddCaso || fase !== 'zerada') ? (
    <div className="flex items-stretch gap-2">
      {podeAddCaso && (
        <Button
          size="sm" variant="outline" className="min-w-0 flex-1"
          aria-label="Adicionar caso (urgência/encaixe)"
          disabled={criandoEscala}
          onClick={abrirAddCaso}
        >
          <Plus className="w-4 h-4 shrink-0" /> Adicionar caso
        </Button>
      )}
      {fase !== 'zerada' && onAddAjuda && (
        <Button
          size="sm" variant="outline" className="min-w-0 flex-1"
          aria-label="Adicionar anestesista (ajuda)"
          onClick={() => setAjudaSheet(true)}
        >
          <UserPlus className="w-4 h-4 shrink-0" /> Adicionar ajuda
        </Button>
      )}
    </div>
  ) : null

  // Sem fila: mostra o vazio NO LUGAR da lista, mantendo as ações do topo e os
  // sheets montados uma única vez (o early return de antes deixava o hospital
  // sem escala publicada — o Materno — sem nenhuma ação disponível).
  const semFila = !escala || !linhasFase.length
  const estadoVazio = (fase === 'zerada' || noiteFds) ? (
    <EmptyState
      icon={<Moon className="w-6 h-6" />}
      title={noiteFds ? 'Sem plantão noturno na escala' : 'Liberações do dia encerradas'}
      description={noiteFds
        ? 'A linha 19-07HS do documento de fim de semana não trouxe nomes — reimporte o documento para gerar a fila da noite.'
        : 'A lista zera às 23h e ficam só os plantonistas da noite — nenhum escalado para este hospital.'}
    />
  ) : (
    <EmptyState
      icon={<ListOrdered className="w-6 h-6" />}
      title="Sem liberações"
      description="Importe a escala deste hospital para gerar a ordem de liberação — ou acrescente um caso avulso pelo botão acima."
    />
  )

  // A ORDEM É IMUTÁVEL NO APP (pedido do dono 2026-07-27): ninguém reordena a
  // fila — nem o plantonista. Ela vale como veio no rodapé vermelho da escala;
  // mudar a ordem é refazer/republicar a escala. As setas ↑↓ saíram da tela.
  // Desde 29/07 NADA nesta aba escreve em `ordem_liberacao` nem troca o dono de
  // um caso a partir da fila: a substituição de posição saiu junto com a troca.
  // Com ela saiu também a única leitura de "sou o plantonista?" — quem libera é
  // qualquer `canEdit`, e quem pode liberar AGORA é decidido pela ORDEM da fila.
  // marcar onde o coringa está é da equipe toda (mesma permissão de editar a lista).
  // No FDS não há coringa: os 4 têm posto explícito na grade 19-07 — o sheet do
  // P4 fica fora (e o selo Pn do modo FDS nunca vira botão).
  const podeMarcarP4 = !!canEdit && !!onDefinirP4 && !modoFds
  // não escalado = está no rodapé mas NUNCA teve caso no dia → liberado por
  // definição (vermelho desde a publicação). Quem TEVE casos e todos encerraram
  // fica ATIVO (o conteúdo sai da linha, mas quem libera é o plantonista).
  const naoEscalado = (l) => !l.teveCasos && !l.notaRodape && !(l.salas?.length) && !(l.cirurgioes?.length)
  // (o estado "liberada" é calculado por linha no render — ver `liberado` lá
  // embaixo. Não existe mais uma versão aqui em cima porque a exibição parou de
  // separar liberados dos demais: a fila segue a ordem do rodapé, ponto.)
  // total de ajudas persistidas (= tamanho do array `ajuda_externa[turno]`), que é
  // o que limita as setas do bloco. Usa o maior `ajudaIdx` visto +1 em vez do
  // tamanho da lista exibida: quem virou plantão do contraturno saiu do bloco mas
  // continua ocupando posição no array.
  const totalAjudas = linhas.reduce((m, l) => (l.ajudaIdx != null ? Math.max(m, l.ajudaIdx + 1) : m), 0)
  // rótulo do plantão do turno seguinte, para o badge cruzado. Vem da MESMA fonte
  // da lib quando existe linha local com o selo; senão deriva do turno.
  const rotuloPlantao = linhas.find((l) => l.plantaoLabel)?.plantaoLabel
    || (turno === 'vespertino' ? 'Plantão da manhã' : 'Plantão da tarde')
  /**
   * AJUDA DERIVADA (dono 30/07 — caso TIAGO): linha EXTRA (tem caso aqui, fora do
   * rodapé daqui) cuja pessoa pertence à escala de OUTRO hospital no mesmo turno.
   * O badge de Ajuda não pode depender de alguém lembrar de marcar ajuda_externa —
   * a estrutura já diz. Só extras: quem está no rodapé local é da casa, e quem já
   * é ajuda marcada segue com o badge normal, sem duplicar.
   */
  const ajudaDeOutro = (linha) => {
    if (linha.isAjuda || !linha.isExtra) return null
    const nomes = new Set([normNome(linha.nomeOriginal || ''), normNome(linha.anestesista || '')].filter(Boolean))
    const m = presencaOutros.find((p) => (linha.uid && p.uid && p.uid === linha.uid) || (p.nome && nomes.has(p.nome)))
    return m ? m.hospitalLabel : null
  }
  /**
   * Destino de quem foi EMPRESTADO (dono 30/07): a linha fica na posição do rodapé
   * daqui, e o card diz para onde a pessoa foi — "Ajuda Hemodinâmica/Unimed".
   * Só entradas COM sala (caso de verdade lá); rodapé de outro hospital sem caso
   * não prova deslocamento.
   */
  const ajudaForaInfo = (linha) => {
    if (!linha.ajudaFora) return null
    const nomes = new Set([normNome(linha.nomeOriginal || ''), normNome(linha.anestesista || '')].filter(Boolean))
    const matches = presencaOutros.filter((p) => p.sala &&
      ((linha.uid && p.uid && p.uid === linha.uid) || (p.nome && nomes.has(p.nome))))
    if (!matches.length) return null
    const locais = [...new Set(matches.map((m) => salaLiberacao(m.sala)))].join('/')
    return { hospital: matches[0].hospitalLabel, locais }
  }
  /**
   * TROCA DECLARADA (dono 30/07): a linha é um dos lados de um par declarado?
   * Os pares vêm da page (paresTroca — varre as 3 escalas: o par atravessa
   * hospitais, caso real Giovana@HRO ⇄ Maurício@Unimed). Casa por uid E por nome
   * normalizado dos dois lados. Linha já ASSUMIDA não tem badge: a execução
   * consome a declaração (decisão do dono 30/07 — o badge some).
   * @returns {{ par, outroNome, outroUid, outroHospitalLabel }|null}
   */
  const nomeCurtoTroca = (nome) => (nome ? nomeCirurgiaoCurto(titleCaseNome(nome)) : '')
  const trocaDe = (linha) => {
    if (!linha || linha.assumida || linha.noturno || !paresTroca.length) return null
    const chaves = new Set(
      [
        linha.chave, linha.uid,
        normNome(linha.nomeOriginal || ''),
        // uid resolvido do nome CRU do rodapé (defeito D8): o matching por
        // display era acidental — homônimo de display casaria o par errado
        resolverUid(linha.nomeOriginal || '') || null,
        normNome(linha.anestesista || ''),
      ].filter(Boolean)
    )
    for (const par of paresTroca) {
      // par HISTÓRICO é rastro de swap já executado (exibição/telemetria) —
      // nunca vira badge ativo nem oferece "Executar"/"Desfazer" de novo: era o
      // defeito D1, badge de troca desfeita ressuscitando sem saída na UI
      if (par.historica) continue
      const ladoA = [par.chave, par.a?.uid, normNome(par.a?.nome || '')].filter(Boolean)
      const ladoB = [par.b?.uid, normNome(par.b?.nome || '')].filter(Boolean)
      if (ladoA.some((k) => chaves.has(k))) {
        return { par, outroNome: nomeCurtoTroca(par.b?.nome), outroUid: par.b?.uid || null, outroHospitalLabel: par.bHospitalLabel || null }
      }
      if (ladoB.some((k) => chaves.has(k))) {
        return { par, outroNome: nomeCurtoTroca(par.a?.nome), outroUid: par.a?.uid || null, outroHospitalLabel: par.aHospitalLabel || null }
      }
    }
    return null
  }

  /** Hospital onde ESTA pessoa pega o contraturno (null se não pega em outro). */
  const contraturnoDe = (linha) => {
    const alvo = normNome(linha.anestesista)
    const chave = normNome(linha.nomeOriginal || '')
    const m = contraturnoOutros.find((c) => c.nome === alvo || (chave && c.nome === chave))
    return m ? m.hospitalLabel : null
  }
  const doTurno = linhasFase.filter((l) => !l.noturno)
  // ACRESCENTADO SEM CONSTAR NO RODAPÉ = AJUDA (dono 19/08): quem aparece com
  // caso fora da ordem publicada entra na FILA como ajuda — é o PRIMEIRO a ir
  // embora, sem ocupar posição de ninguém (a ordem publicada segue intocada; a
  // fila só muda quando o usuário faz troca). Interação com o plantão do
  // contraturno: quando o plantão está ESCALADO ele continua fechando a lista
  // (sai primeiro) e a ajuda entra logo ACIMA (é liberada depois dele); plantão
  // não escalado/já liberado é pulado pelo naFila e a ajuda vira a primeira.
  const linhasForaDoRodape = doTurno.filter((l) => l.isExtra)
  const linhasOficiais = doTurno.filter((l) => !l.isExtra)
  const fechaComPlantao = linhasOficiais.length > 0 && linhasOficiais[linhasOficiais.length - 1].isProximoPlantao
  // A FILA SEGUE SEMPRE A ORDEM DO RODAPÉ (dono 11/08, reforçando 27/07).
  // Liberado NÃO afunda mais: quem sai fica na própria posição, riscado e com o
  // selo "Liberado". O afundamento antigo dava a impressão de que a ordem tinha
  // sido publicada errada — em 11/08 o João Ricardo apareceu em 13º (nasceu
  // liberado por estar sem cirurgia) sendo 11º no rodapé, e a leitura foi
  // "inseriram o rodapé fora de ordem". Só saem da ordem quem a regra manda:
  // plantão noturno no topo, e extras/ajudas/plantão-do-turno-seguinte no fim
  // (esses a própria lib já posiciona).
  const linhasExibicao = fechaComPlantao
    ? [
        ...linhasFase.filter((l) => l.noturno),
        ...linhasOficiais.slice(0, -1),
        ...linhasForaDoRodape,
        linhasOficiais[linhasOficiais.length - 1],
      ]
    : [
        ...linhasFase.filter((l) => l.noturno),
        ...linhasOficiais,
        ...linhasForaDoRodape,
      ]

  // TEMPO ESTOURADO (dono 24/08): quem informou um término que já passou e AINDA
  // tem cirurgia aberta. A conta é a mesma que pinta a pílula de âmbar no card —
  // um lugar só decide o que é "estourou", senão a tela e a push discordariam.
  // Só entra quem tem login vinculado: sem uid não há para quem mandar.
  // ⚠️ o card NOTURNO entra (P1–P4 têm ficha completa, cronômetro inclusive):
  // quem está de plantão à noite é justamente quem fica sem ninguém por perto
  // para olhar a tela. Excluí-lo seria lacuna, não decisão.
  const alvosTempoEstourado = linhasExibicao.reduce((acc, l) => {
    if (!l.uid) return acc
    const ovL = overrideDe(l)
    const alvo = ovL?.termino
    if (!alvo) return acc
    const alvoMin = parseHoraMinutos(alvo)
    if (alvoMin == null || alvoMin >= agoraMin) return acc
    const marca = marcaDe(l)
    const jaLiberado = !!marca && marca.escalado !== true
    if (jaLiberado || estaLivre(l) || !(l.casosAtivos > 0)) return acc
    acc.push({ chave: l.chave, uid: l.uid, alvo })
    return acc
  }, [])

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
        ...(bloqueio.modo === 'convocar'
          ? {
              title: `Convoque ${bloqueio.proximo} primeiro`,
              description: `A convocação desfaz a fila na ordem inversa: ${bloqueio.proximo} volta antes de ${linha.anestesista}.`,
            }
          : {
              title: `Libere ${bloqueio.proximo} primeiro`,
              description: `${bloqueio.faltam === 1 ? 'Falta 1 anestesista' : `Faltam ${bloqueio.faltam} anestesistas`} antes de ${linha.anestesista} na ordem de liberação.`,
            }),
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

  const abrirEditor = (linha) => {
    const ov = overrideDe(linha)
    const loc = ov?.local || ''
    setRascLocal(loc)
    setRascHospital(ov?.hospital || '')
    setRespUid('')
    setPosColega('')
    setLocalOutro(!!loc && !locaisHospital.includes(loc)) // local livre já salvo → modo "Outro"
    setRascCirurgiao(ov?.cirurgioes || '')
    setRascTermino(ov?.termino || '')
    setRascObservacao(observacaoDe(ov))
    // o painel abre com a OBSERVAÇÃO já aberta (protótipo escolhido, dono 17/08):
    // é o campo do uso diário. Local/cirurgião ajustados à mão ganham a vez —
    // esconder um valor que alguém escreveu atrás de um toque é pior.
    // com a Observação no FIM da lista (dono 17/08), abrir nela por padrão
    // faria o painel nascer rolado; abre fechado e cada assunto se abre ao toque
    setAbaPainel(ov?.local ? 'local' : ov?.cirurgioes ? 'cirurgiao' : null)
    setEditor(linha)
  }
  // Salvar FECHA NO TOQUE (dono 19/08, "resposta tátil imediata"): o context é
  // OTIMISTA — o valor já está pintado na fila quando o painel fecha, e erro
  // reverte + toast. Não é o "sucesso mentiroso" da auditoria F1.6: aquele era um
  // TOAST de sucesso sem persistência; aqui nenhum sucesso é anunciado — a tela
  // mostra o estado otimista e desmente sozinha se o servidor recusar.
  // Campos vazios NÃO são "restaurar automático" — mandar `null` aqui apagava o
  // flag `renovado` da linha e ressuscitava sala/cirurgião da manhã (bug 29/07).
  const salvarEditor = () => {
    const local = rascLocal.trim()
    const hospital = rascHospital.trim()
    const cirurgioes = rascCirurgiao.trim()
    const termino = rascTermino.trim()
    const observacao = rascObservacao.trim()
    // local novo (digitado em "Outro") entra na lista NA HORA; os demais aparelhos
    // aprendem no próximo load (o override salvo é a fonte do histórico)
    if (local && !locaisHospital.includes(local)) setLocaisAprendidos((prev) => [...prev, local])
    setEditor(null)
    onSetOverride?.(editor, { local, hospital, cirurgioes, termino, observacao })?.catch?.(() => {})
  }
  /**
   * TROCAR O RESPONSÁVEL mantendo a posição (dono 24/08). É a assunção
   * UNILATERAL que já existe no dia útil (o toggle "Assumir também a posição"
   * do ⚙ da sala), agora alcançável na fila única — onde as trocas entre
   * colegas e hospitais acontecem o tempo todo e não havia como registrá-las.
   * ⚠️ o slot NÃO muda de chave: `chaveSlot`/`nomeSlot` seguem os do dono
   * original, então marcações e ordem publicada continuam válidas. Quem muda é
   * a identidade EXIBIDA e o dono das cirurgias em aberto.
   */
  const trocarResponsavel = async (linha) => {
    const r = rosterByUid.get(respUid)
    if (!r || !onTrocarResponsavel) return
    setTrocandoResp(true)
    try {
      await onTrocarResponsavel({
        chaveSlot: linha.chave,
        nomeSlot: linha.nomeOriginal,
        de: { uid: linha.uid || null, nome: linha.anestesista },
        para: { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || linha.anestesista },
        casoIds: linha.casoIds || [],
      })
      setEditor(null)
    } catch { /* o context toasta e reverte */ } finally { setTrocandoResp(false) }
  }
  /**
   * TROCAR DE POSIÇÃO com um colega da MESMA fila (dono 24/08: "pode deixar a
   * opção, mas não é a regra"). São duas assunções CRUZADAS no mesmo motor
   * transacional: cada um passa a responder pelo slot do outro, levando as
   * cirurgias em aberto. A `ordem_liberacao` publicada continua intocada — o que
   * muda é quem ocupa cada vaga, que é exatamente o que "trocar de posição"
   * significa aqui.
   */
  const trocarPosicao = async (linha) => {
    const outra = linhas.find((l) => l.chave === posColega)
    if (!outra || !onTrocarPosicao) return
    setTrocandoResp(true)
    try {
      await onTrocarPosicao([
        {
          chaveSlot: linha.chave, nomeSlot: linha.nomeOriginal,
          de: { uid: linha.uid || null, nome: linha.anestesista },
          para: { uid: outra.uid || null, nome: outra.anestesista, apelido: outra.nomeOriginal || outra.anestesista },
          casoIds: linha.casoIds || [],
        },
        {
          chaveSlot: outra.chave, nomeSlot: outra.nomeOriginal,
          de: { uid: outra.uid || null, nome: outra.anestesista },
          para: { uid: linha.uid || null, nome: linha.anestesista, apelido: linha.nomeOriginal || linha.anestesista },
          casoIds: outra.casoIds || [],
        },
      ])
      setEditor(null)
    } catch { /* o context toasta e reverte os dois lados juntos */ } finally { setTrocandoResp(false) }
  }
  const devolverResponsavel = async (linha) => {
    if (!onDevolverResponsavel) return
    setTrocandoResp(true)
    try {
      await onDevolverResponsavel(linha)
      setEditor(null)
    } catch { /* idem */ } finally { setTrocandoResp(false) }
  }

  const restaurarEditor = () => {
    setEditor(null)
    onSetOverride?.(editor, null)?.catch?.(() => {}) // null = restauração explícita (limpa flags)
  }

  // "Tempo faltante": grava override.termino (agora + duração, ou hora exata),
  // PRESERVANDO local/cirurgiões/observação já ajustados — o override é gravado
  // inteiro, então um campo omitido aqui seria APAGADO.
  const definirTempo = (linha, terminoHHMM) => {
    const ov = overrideDe(linha) || {}
    setRascTermino(terminoHHMM || '')
    // fecha no toque (dono 19/08): a pílula já pinta pelo otimista do context;
    // erro reverte + toast — segurar o sheet até o servidor era o delay
    setAlvoTempo(null)
    setHoraExata('')
    onSetOverride?.(linha, {
      local: ov.local || '',
      // ⚠️ o hospital viaja junto: este caminho grava o override INTEIRO, e o
      // campo omitido é APAGADO (a mesma pegadinha que sumiu com local/
      // observação em 07/08 ao definir o término).
      hospital: ov.hospital || '',
      cirurgioes: ov.cirurgioes || '',
      termino: terminoHHMM || '',
      observacao: observacaoDe(ov),
    })?.catch?.(() => {})
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

  // ── TROCA — executar/desfazer pelo painel ✏️; DECLARAR é do TrocaSheet
  // (fluxo único, dono 07/08). Um toque aqui, sem navegação.
  // ⚠️ o `par` VIAJA JUNTO (incidente 18/08): a declaração vive numa ÚNICA
  // linha_overrides — a de quem declarou — e o badge aparece nos DOIS lados.
  // Desfazer pela linha do COLEGA (ou por outro hospital) limpava um override
  // que nunca teve trocaCom: nada mudava e a troca "persistia" nos dois cards.
  // Quem sabe onde ela mora é o par (escalaId + chave), não a linha da tela.
  const desfazerTrocaEditor = async (par) => {
    if (!editor) return
    setExecutandoTroca(true)
    try {
      await onMarcarTroca?.(editor, null, par || null)
      setEditor(null)
    } catch { /* toast no context */ } finally { setExecutandoTroca(false) }
  }
  // POP-UP ANTES DE CONCLUIR (dono 18/08): este botão troca as posições dos dois
  // lados de uma vez e leva as cirurgias em aberto junto — mesma confirmação do
  // TrocaSheet, para não haver caminho que execute o swap sem perguntar.
  const executarTrocaEditor = async () => {
    const par = confirmarTroca?.par
    if (!par || executandoTroca) return
    setExecutandoTroca(true)
    try {
      await onExecutarTroca?.(par)
      setConfirmarTroca(null)
      setEditor(null)
    } catch { /* toast no context */ } finally { setExecutandoTroca(false) }
  }
  const desfazerSubstEditor = async () => {
    if (!editor?.assumida || executandoTroca) return
    setExecutandoTroca(true)
    try {
      await onDesfazerSubstituicao?.(editor)
      setEditor(null)
    } catch { /* toast no context */ } finally { setExecutandoTroca(false) }
  }

  /** Papel do card noturno SEM repetir o badge ("Plantão Unimed · cobre X" →
   *  "cobre X"); sem badge, o papel vai inteiro. */
  const papelSemBadge = (l) => {
    const papel = l.papelNoturno
    if (!papel) return null
    const badge = plantaoFisicoDe(l)
    if (!badge || !papel.startsWith(badge)) return papel
    return papel.slice(badge.length).replace(/^\s*·\s*/, '') || null
  }

  // De qual hospital é o procedimento "?" (só na fila única do FDS — a lib não
  // repassa hospitalOrigem, então o caso é reencontrado pelo id nos mesclados).
  const hospitalDoAlerta = (id) => {
    if (!modoFds || !id) return null
    const c = casosTurno.find((x) => x.id === id)
    return c?.hospitalOrigem ? HOSPITAL_LABEL[c.hospitalOrigem] : null
  }
  const publicarAviso = async () => {
    if (await enviarAviso(rascAviso)) { setRascAviso(''); setAvisoSheet(false) }
  }

  return (
    <div className="space-y-3">
      {/* Não desenha nada: é o disparo da push de "tempo estourado" (dono 24/08).
          Vive como componente porque a lista só existe depois do guard de
          `rosterLoading` lá em cima — ver o porquê no próprio arquivo. */}
      <AvisoTempoEstourado
        escalaId={escala?.id}
        turno={turno || turnoBase}
        alvos={alvosTempoEstourado}
      />
      {acoesTopo}

      {/* ── RECADO DO PLANTONISTA (dono 17/08; ROXO por decisão do dono 20/08) ──
          Faixa de borda a borda em ROXO (`category-purple`), pedido direto do dono
          no lugar do teal original ("que seja em tons de roxo e não esse verde" —
          o teal lia como mais um verde na tela, ao lado do verde de plantão e de
          cirurgia iniciada, que é justamente o que a faixa NÃO deve parecer.
          ⚠️ o roxo já é o badge "Passa para tarde" (`bg-category-purple` sólido)
          na fila logo abaixo — foi por isso que ele tinha sido descartado em
          17/08. A separação aqui é de MASSA, não de matiz: a faixa é a superfície
          soft (`-bg`) de borda a borda e o badge é uma pastilha sólida dentro de
          um card, então continuam distinguíveis; o único sólido da faixa é o
          botão Confirmar, que fica fora da fila.
          Fica ACIMA de "procedimentos sem anestesista". ATÉ TRÊS na tela, POR
          PESSOA: cada um vê os três mais recentes que ainda não confirmou, e
          confirmar libera a vaga do próximo. Não notifica ninguém — vive aqui e
          morre na confirmação. ── */}
      {/* ⚠️ DUAS FORMAS, e a diferença é o DIA (dono 24/08, 2ª mensagem): o
          cartão com rótulo e o "Confirmar leitura" de largura inteira foram
          desenhados no protótipo do FIM DE SEMANA e valem só lá. No dia útil a
          faixa de borda a borda de 17/08 fica como está — "não quero que sejam
          aplicadas em dias úteis". */}
      {/* CARTÃO COM RÓTULO, EM TODA ESCALA (dono 24/08: "quero que essa
          configuração de mensagem do plantonista seja assim nos dias úteis").
          O desenho nasceu no protótipo do fim de semana e ficou lá por dois dias,
          enquanto o dia útil seguia com a faixa de borda a borda de 17/08 e o
          "Confirmar" numa pastilha de 32px no canto. As duas diferenças que o
          dono quis trazer: o RÓTULO diz de quem é a mensagem antes de ela ser
          lida, e o CONFIRMAR vira botão de largura inteira — 40px de alvo contra
          32px, para a única saída do recado. Sem ramificação: um recado, um
          desenho. */}
      {avisos.map((a) => (
        <div
          key={a.id}
          className="rounded-2xl border border-category-purple/45 bg-category-purple-bg px-3 py-2.5"
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-category-purple-fg">
                Recado do plantonista
              </p>
              {/* o RECADO em negrito: é o que se lê de relance */}
              <p className="text-[14.5px] font-bold leading-tight text-foreground [overflow-wrap:anywhere]">{a.texto}</p>
              {/* quem mandou e QUANDO — sem contagem de confirmações (dono 17/08):
                  quem lê não decide nada com "2 de 4 confirmaram", e o número
                  transformava o recado num placar. */}
              <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-category-purple-fg">
                <MessageSquare className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate">{titleCaseNome(a.autorNome) || 'Plantonista'}</span>
                <span className="shrink-0 opacity-80">· plantonista ·</span>
                <span className="shrink-0 tabular-nums opacity-80">{horaCurta(a.criadoEm)}</span>
              </p>
            </div>
            {/* o plantonista tira o recado que não vale mais (dono 17/08) */}
            {canEdit && souPlantonista && (
              <button
                type="button"
                onClick={() => excluirAviso(a.id)}
                aria-label={`Excluir recado "${a.texto}"`}
                className="-my-2 flex h-9 w-7 shrink-0 items-center justify-center text-category-purple-fg active:opacity-60"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => confirmarAviso(a.id)}
            className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-[11px] bg-category-purple text-[13.5px] font-extrabold text-white active:opacity-80"
          >
            <Check className="h-4 w-4 shrink-0" /> Confirmar leitura
          </button>
        </div>
      ))}

      {/* MANDAR é só do plantonista; LER o histórico é de todo mundo (dono 17/08).
          O plantonista vê os dois botões na mesma linha. */}
      <div className="flex gap-2">
        {canEdit && souPlantonista && podeAvisar && (
          <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={() => setAvisoSheet(true)}>
            <MessageSquare className="w-4 h-4 shrink-0" /> Mensagem para equipe
          </Button>
        )}
        <Button size="sm" variant="outline" className="min-w-0 flex-1" onClick={() => setHistoricoSheet(true)}>
          <History className="w-4 h-4 shrink-0" /> Histórico de mensagens
        </Button>
      </div>

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
                  {/* TEXTO À ESQUERDA, AÇÃO À DIREITA (dono 24/08, comparando a
                      tela com o protótipo aprovado): a pastilha ocupava uma
                      TERCEIRA linha só para ela e o alerta ia a 107px medidos.
                      Inline, volta a ~74px. O badge "Sem anestesista" saiu junto:
                      o título logo acima já diz isso e ele só empurrava a sala
                      para a esquerda. */}
                  {/* A AÇÃO FICA ABAIXO DO TEXTO, NOS DOIS MODOS (dono 24/08,
                      escolhendo entre três protótipos). A pastilha inline comia
                      48% da linha — 183px de 378 — e sobravam 195px para
                      "11:00 · Unimed · CO - Sala 3 · Cesariana · Carlos Yora".
                      Abaixo, o texto recupera a linha inteira (388px medidos) ao
                      custo de 22px de altura, e o alerta volta a ser UM código
                      só: era pastilha no sábado e frase na segunda, para o mesmo
                      gesto. O card inteiro continua sendo o alvo. */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{i.hora || '—'}</span>
                    {hospitalDoAlerta(i.id) && <span className="shrink-0 text-xs font-semibold text-muted-foreground">{hospitalDoAlerta(i.id)}</span>}
                    {i.sala && <span className="min-w-0 truncate font-semibold" title={i.sala}>{salaLiberacao(i.sala)}</span>}
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
      {semFila && estadoVazio}

      {/* div simples de propósito: animação de layout + reload do realtime moviam a
          linha sob o dedo (mesma classe do bug da inbox, fix 956aedd) */}
      {!semFila && <div className="space-y-1.5">
        {(() => {
          // Está na FILA de liberação? P1/P2 são os plantonistas da noite: nunca
          // entram no "próximo a ser liberado" (pedido do dono 24/07). P3/P4 entram.
          // No FDS o selo é o Pn da PESSOA (não o posto) — quem está fora da fila
          // à noite são as cols Unimed/HRO da grade, marcadas com `foraDaFila`
          // (o substituto da noite pode nem ter Pn, caso João Ricardo 16/08).
          const naFila = (l) => {
            if (l.noturno && (modoFds ? l.foraDaFila : SELO_SEM_PROXIMO.has(l.selo))) return false
            // extra (fora do rodapé) ENTRA na fila como ajuda (dono 19/08):
            // é o primeiro a ir embora e é liberado como qualquer um
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
          // CONVOCAR TAMBÉM SEGUE A ORDEM (dono 20/08): desfazer a liberação é
          // devolver a pessoa à fila, e devolver a errada fura a ordem pelo outro
          // lado — a convocada vira o "próximo" e passa na frente de quem, na
          // ordem, saiu depois dela. A fila sai de baixo p/ cima, então volta de
          // cima p/ baixo: o próximo a CONVOCAR é o liberado mais próximo de quem
          // ainda está em sala. Quem nunca esteve na fila (sem caso) fica fora da
          // conta e nunca é bloqueado — o vermelho ali é só registro de que a
          // pessoa não está em jogo, não uma posição cedida.
          const voltaPraFila = (l) => !l.noturno && !naoEscalado(l)
          const jaLiberada = (l) => { const m = marcaDe(l); return !!m && m.escalado !== true }
          let idxConvocar = -1
          for (let i = idxProximo + 1; i < linhasExibicao.length; i++) {
            if (jaLiberada(linhasExibicao[i]) && voltaPraFila(linhasExibicao[i])) { idxConvocar = i; break }
          }
          const nomeConvocar = idxConvocar >= 0 ? linhasExibicao[idxConvocar].anestesista : null
          // CAUDA SEM PROCEDIMENTO (dono 21/08): "os últimos usuários da lista de
          // liberação que não estiverem com procedimento cirúrgico no momento de
          // importação da escala aparecem como LIBERADOS (vermelho)" — não verdes
          // com o badge Livre. É o fecho das três queixas seguidas: o vermelho
          // automático no MEIO da fila (Eduardo, 5º de 15, em 20/08) lia como
          // liberação fora de ordem e teve de sair; na CAUDA ele é a informação
          // certa — quem fecha a lista sem cirurgia nenhuma não está em jogo, e
          // era isso que o dono tentava marcar à mão (16 toques na Thayna).
          // ⚠️ a fronteira é o ÚLTIMO NOME COM TRABALHO NA IMPORTAÇÃO, não o
          // `idxProximo`: usar a fila faria a linha do meio virar vermelha sozinha
          // conforme os de baixo fossem liberados — decisão automática de novo,
          // que é justamente o que não pode acontecer.
          //
          // ⚠️ E a conta é sobre a ORDEM PUBLICADA (`noRodape`), não sobre a lista
          // que está na tela. A exibição acrescenta no FIM quem não está na ordem
          // — extras, ajudas e visitantes de outro hospital —, e um deles COM
          // cirurgia empurrava a fronteira para depois de quem fecha o rodapé:
          // em 24/08 a Unimed publicou a tarde com o Vicente fechando a ordem sem
          // cirurgia, e ele apareceu "Livre" porque uma visitante do HRO entrou
          // atrás dele com um caso. Quem não está na ordem não tem posição na
          // fila, então não pode definir onde a fila termina — nem nascer
          // liberado por estar depois do fim dela.
          let idxUltimoTrabalho = -1
          for (let i = linhasExibicao.length - 1; i >= 0; i--) {
            const l = linhasExibicao[i]
            if (l.noRodape && !naoEscalado(l)) { idxUltimoTrabalho = i; break }
          }
          // ⚠️ NINGUÉM DA ORDEM com cirurgia = NÃO EXISTE CAUDA (dono 22/08). Sem esta
          // guarda o `idx > -1` é verdade para a fila INTEIRA e todo mundo nasce
          // vermelho — foi o que a tarde de sábado 22/08 mostrou: os 7 nomes
          // liberados de uma vez, ordem nenhuma, antes de o turno começar. A
          // cauda é o que vem DEPOIS do último nome com trabalho; sem esse nome
          // não há depois, e vale a regra de 20/08: ninguém nasce liberado.
          // Acontece sempre que o mapa do turno chega sem anestesista definido —
          // as 8 cirurgias da tarde daquele sábado tinham sala, hora e cirurgião,
          // e nenhuma tinha dono.
          const temAlguemComTrabalho = idxUltimoTrabalho >= 0
          let numeroOrdem = 0
          return linhasExibicao.map((linha, idx) => {
          // PLANTÃO NOTURNO (pedido do dono 24/07): ao virar P1–P4 a pessoa SAI da
          // posição em que estava — independente de hospital e de já ter sido
          // liberada no dia — e assume o posto TRABALHANDO (card verde). Nada da
          // situação diurna atravessa a virada: `linha.chave` do card noturno é
          // namespaced ('noite:'), então as marcações do dia não são lidas e uma
          // liberação feita À NOITE (P3/P4 seguem a lógica normal) persiste sozinha.
          const noturno = !!linha.noturno
          const semEscala = !noturno && naoEscalado(linha)
          const foraDoRodape = !noturno && linha.isExtra
          // ajuda acrescentada (fora do rodapé) também é numerada: ela está NA
          // fila (dono 19/08) — o número é sequência de exibição, não posição
          // da ordem publicada, que segue imutável
          const numeroExibido = ++numeroOrdem
          const marcacao = marcaDe(linha)
          const forcadoEscalado = marcacao?.escalado === true // entrou na escala no meio do dia
          const liberadoReal = !!marcacao && !forcadoEscalado
          // NO MEIO DA FILA o vermelho NUNCA é automático (dono 20/08, depois de o
          // sintoma voltar em produção: Eduardo, 5º de 15, nasceu vermelho 47s
          // depois da publicação da tarde — ele tinha trocado com a Raquel e não
          // tinha cirurgia ali). Ali a equipe lê como liberação fora de ordem e não
          // há como distinguir "o app decidiu" de "alguém liberou na frente".
          // NA CAUDA é o contrário: quem fecha a lista sem procedimento nenhum
          // nasce liberado, porque não está em jogo (dono 21/08).
          // ⚠️ NO FIM DE SEMANA NINGUÉM NASCE VERMELHO (dono 24/08: "ao publicar
          // escala de final de semana, todos os usuários apareçam com o card
          // verde"). A cauda automática de 21/08 nasceu do dia útil, onde o
          // rodapé costuma trazer gente que fecha a lista sem cirurgia nenhuma;
          // na fila única quem está publicado ESTÁ de plantão, e o mapa
          // cirúrgico chega separado — muitas vezes depois. Card vermelho ali
          // dizia "já foi embora" de quem tinha acabado de entrar na escala.
          // O vermelho volta a ser só do toque humano, como em 20/08.
          const caudaSemTrabalho = caudaAutomatica && temAlguemComTrabalho && linha.noRodape && semEscala
            && !forcadoEscalado && idx > idxUltimoTrabalho
          const liberado = liberadoReal || caudaSemTrabalho
          // ⚠️ o card BRANCO de "Livre" também é de dia útil: na fila única ele
          // fazia metade da lista nascer descolorida na publicação, antes de a
          // primeira cirurgia ser importada. O BADGE "Livre" fica — é
          // informação verdadeira ("sem cirurgia agora") e não some com a tinta.
          const estado = liberado ? 'liberado' : idx === idxProximo ? 'proximo' : 'escalado'
          // Bloqueio nos DOIS sentidos: só o "próximo" sai e só o "próximo a
          // convocar" volta. Quem NÃO está na fila nunca bloqueia — P1/P2 da noite
          // e quem está sem caso (não ocupa posição, então nem sair nem voltar fura
          // ordem nenhuma). Do lado de liberar, o `naFila` é a fonte única: o guard
          // antigo por `semEscala` isentava também quem tinha o marcador do
          // repasse, e essa pessoa TRABALHOU — aguarda a vez como todo mundo.
          const bloqueioOrdem = liberadoReal
            ? ((idxConvocar >= 0 && idx > idxProximo && idx !== idxConvocar && voltaPraFila(linha))
                ? { modo: 'convocar', proximo: nomeConvocar }
                : null)
            : ((idxProximo >= 0 && idx !== idxProximo && naFila(linha))
                ? { modo: 'liberar', faltam: linhasExibicao.slice(idx + 1).filter(naFila).length, proximo: proximoNome }
                : null)
          // LIVRE = a pessoa não está em sala e AGUARDA o toque de quem libera, na
          // própria posição, o dia inteiro se preciso. Dois caminhos chegam aqui e
          // são o mesmo fato para quem lê a fila: terminou todos os casos do turno,
          // ou está no rodapé sem caso nenhum (nunca escalado / ficou sem caso num
          // repasse). O `naFila` continua pulando a linha sem caso, então ela não
          // trava o "próximo" de ninguém.
          const livre = !noturno && !liberado && (estaLivre(linha) || (semEscala && !forcadoEscalado))
          const ov = overrideDe(linha)
          // linha RENOVADA (voltou de liberação): infos da manhã não valem mais —
          // derivado suprimido; só o que for preenchido manualmente aparece.
          const renovado = !!ov?.renovado
          // Badge do turno seguinte: some ao liberar, na linha RENOVADA (o
          // passa-tarde era da escala de antes) e no card noturno. Fica AQUI, e não
          // junto de `liberado`, porque depende de `renovado`, que nasce do override
          // logo acima — declarar antes cai na zona morta e derruba a aba inteira.
          const mostraPassaTurno = !liberadoReal && !renovado && !noturno && temPassaTarde(linha)
          // SELOS DA 1ª LINHA em consts, e não inline no JSX, porque a COLUNA DA
          // DIREITA (cronômetro + Editar) precisa saber se existe algum: quando a
          // coluna é mais alta que as infos da esquerda ela começa colada no fim da
          // 1ª linha, e um badge que alcance a faixa dela encosta nela. Medido em
          // 24/08 no card do "Plantão da tarde": 0px entre o badge e o "+ Tempo
          // total" — é o mesmo "amontoado" reportado em 21/08, que na época foi
          // resolvido só para o badge roxo (`mostraPassaTurno`). Derivar da MESMA
          // const que o JSX usa é o que impede a lista de condições de divergir.
          const badgePlantonista = !liberadoReal && !modoFds && linha.isPlantonista
          const badgePlantaoFisico = !liberadoReal && plantaoFisicoDe(linha)
          const badgeAjuda = !liberadoReal && (linha.isAjuda || (foraDoRodape && !ajudaDeOutro(linha)))
          const badgeTroca = trocaDe(linha)
          const badgeAssumida = linha.assumida && !badgeTroca
          const badgeAjudaOutro = !liberadoReal && ajudaDeOutro(linha)
          const badgeProximoPlantao = !liberadoReal && linha.isProximoPlantao
          const badgeContraturno = !liberadoReal && !linha.isProximoPlantao && contraturnoDe(linha)
          const temSeloAoLadoDoNome = !!(badgePlantonista || badgePlantaoFisico || badgeAjuda
            || badgeTroca || badgeAssumida || badgeAjudaOutro || badgeProximoPlantao
            || badgeContraturno || livre || mostraPassaTurno)
          // >1 cirurgião = lista (1 por linha); override manual = 1 linha como digitado
          const listaCirurgioes = ov?.cirurgioes
            ? [ov.cirurgioes]
            : (renovado || semEscala) ? [] : linha.cirurgioes.length ? linha.cirurgioes : ['…']
          // nota do rodapé ("MATHEUS (CONSULT)" → Consultório) cobre quem não tem
          // sala na escala — diz onde a pessoa está sem ninguém precisar editar
          const salasAuto = renovado ? '' : ((linha.salas || []).map(salaLiberacao).join('/') || linha.notaRodape || '')
          const localExibido = ov?.local || salasAuto
          // HOSPITAL da linha (dono 24/08): o ajustado à mão vence o derivado dos
          // casos. Fora do modo FDS `hospitaisDe` devolve null e a linha nem
          // aparece — no dia útil a tela toda é de um hospital só e repetir o
          // nome em cada card não informa nada.
          const hospitalDaLinha = ov?.hospital || hospitaisDe(linha)
          const observacaoLinha = observacaoDe(ov)
          // Cronômetro 100% MANUAL (decisão do dono 23/07): TODA linha nasce em
          // branco ("Tempo faltante") e só conta depois que alguém preenche —
          // a estimativa automática (hora+tempo dos casos da manhã) enchia a
          // coluna de "+8h53" sem sentido conforme o dia avançava.
          // setas de ordem existem só no bloco de AJUDA (o rodapé é imutável) e o
          // layout da coluna da direita depende disso: com setas vira duas linhas.
          const temSetasAjuda = canEdit && linha.isAjuda && !linha.ajudaFora && !linha.isProximoPlantao && linha.ajudaIdx != null
          const terminoLinhaMin = parseHoraMinutos(ov?.termino)
          const cronometro = (() => {
            // terminou TUDO (badge Livre): o tempo que sobrou é informação vencida
            // — mostrar "~1h20" ao lado de "Livre" fazia o card se contradizer.
            if (liberado || livre) return null
            const manual = terminoLinhaMin
            if (manual == null) return null
            return {
              ...formatFaltante(manual, agoraMin),        // curto p/ a coluna
              // ESTOUROU: a PALAVRA entra no lugar do sinal (dono 18/08). "+25min"
              // sozinho não diz de que horário está falando nem se o tempo falta ou
              // já passou — e esta é a SEGUNDA vez que o tempo da pessoa é relatado
              // como pouco claro (a 1ª foi 30/07, com dois relógios no mesmo card).
              // "25min além" é a MESMA frase que a linha do cirurgião logo acima já
              // usa, então a tela inteira fala uma língua só; e não vira "atrasou",
              // que aqui é o badge de status DA CIRURGIA e trocaria uma dúvida por
              // outra. Enquanto FALTA, "~25min" se explica sozinho e fica como está.
              texto: fraseCronometro(manual, agoraMin),
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
              /* ITEMS-START, não center (dono 24/08, comparando a tela com o
                 protótipo aprovado): com `items-center` o número e o círculo
                 flutuavam para o MEIO vertical de um corpo de 4 linhas — medido,
                 o círculo caía 36px abaixo do nome e lia como se pertencesse à
                 linha da sala. Alinhados ao topo eles voltam a ficar na linha do
                 NOME, que é de quem eles são. O `min-h` saiu junto: o conteúdo
                 sempre passa de 68px e ele só somava altura nos cards curtos. */
              className={['flex items-start rounded-xl border transition-colors', CARD_ESTADO[estado]].join(' ')}
            >
              <span className="w-5 shrink-0 pt-3 pl-1 text-center text-xs font-semibold text-muted-foreground">{numeroExibido || '•'}</span>

              {/* setas de reordenar REMOVIDAS (pedido do dono 2026-07-27): a ordem
                  do rodapé é imutável no app — nem o plantonista mexe. */}

              {/* marcar liberado: alvo 44px, círculo visual 28px. O círculo é um
                  CHECKBOX de "esta pessoa está liberada" — marcado = vermelho,
                  desmarcado = na escala — e é isso em TODA linha. O que muda por
                  baixo é só como o estado é gravado: numa linha comum a marcação é
                  a liberação (`liberadoEm`); na cauda, que já nasce marcada, o
                  toque DESmarca e o que se grava é `{escalado:true}` ("não, ele
                  está trabalhando"). ⚠️ o que NÃO pode voltar é o círculo dizer uma
                  coisa e fazer outra: em 20/08 ele aparecia VAZIO e alternava um
                  flag escondido, e o dono tocou 16 vezes seguidas na Thayna sem
                  nunca liberar. Marcado/desmarcado tem de espelhar o vermelho. */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => (caudaSemTrabalho
                  ? onToggleEscalado?.(linha)   // já nasce marcado: o toque DESMARCA
                  : toggle(linha, liberadoReal, bloqueioOrdem))}
                aria-label={liberado ? `Desfazer liberação de ${linha.anestesista}` : `Marcar ${linha.anestesista} liberado`}
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
              <div className="min-w-0 flex-1 py-2 pl-1">
                {/* flex + truncate: badge SEMPRE ao lado do nome (sem quebrar p/ baixo).
                    `pr-1.5` (24/08) é o piso da margem direita: os selos são `shrink-0`
                    e só o nome cede, então com nome longo + 3 selos o último parava a
                    1px da borda ARREDONDADA do card — encostado nela.
                    ⚠️ 6px é TETO medido, não escolha estética: a 375px a linha tem 282px
                    e o pior caso REAL de hoje ("Leonardo Ferrazzo" + Plantonista +
                    Troca) gasta 275,5. `pr-2` e `pr-2.5 + gap-2` foram testados no app e
                    os dois truncam o NOME do plantonista ("Leonardo Ferraz…"), que é a
                    identidade do card. É pelo mesmo orçamento que o gap entre selos
                    segue em 6px: 8px custa 4px que não existem nessa largura. */}
                <p className={['flex items-center gap-1.5 pr-1.5 text-[15px] font-semibold leading-tight', liberadoReal && 'line-through opacity-60'].filter(Boolean).join(' ')}>
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
                  {/* liberado = card enxuto (pedido do dono): só nome + badge Liberado + lápis.
                      No FDS o genérico "Plantonista" dá lugar ao badge ESPECÍFICO
                      "Plantão Unimed/HRO" da faixa atual (grade importada) — na
                      fila única, dizer QUAL hospital é a informação. */}
                  {badgePlantonista && (
                    <Badge variant="secondary"
                      className="shrink-0 dark:bg-[hsl(var(--badge-success))] dark:text-[hsl(var(--badge-success-foreground))]">
                      Plantonista
                    </Badge>
                  )}
                  {badgePlantaoFisico && (
                    <Badge className="shrink-0 border-transparent bg-primary text-primary-foreground">
                      {plantaoFisicoDe(linha)}
                    </Badge>
                  )}
                  {/* AZUL SÓLIDO (pedido do dono 2026-07-21) — mesmo destaque do Plantonista */}
                  {/* extra fora de TODOS os rodapés = Ajuda (dono 19/08): quem foi
                      acrescentado e não consta em lista nenhuma é ajuda; com origem
                      em outro hospital o badge derivado abaixo diz de onde veio */}
                  {badgeAjuda && (
                    <Badge variant="info" className="shrink-0">Ajuda</Badge>
                  )}
                  {/* A troca pertence ao SLOT original. Depois da execução, a
                      linha passa a exibir quem assumiu, mas o badge continua
                      visível inclusive após liberar — não pode parecer que o
                      substituto virou uma posição nova. */}
                  {/* SÓLIDO quando a troca é fato (registro de escala já
                      publicada trocada); OUTLINE quando ainda falta executar. */}
                  {badgeTroca && (
                    <Badge className={badgeTroca.par?.apenasRegistro
                      ? 'shrink-0 border-transparent bg-category-indigo text-white'
                      : 'shrink-0 border-category-indigo bg-transparent text-category-indigo-fg'}>
                      Troca
                    </Badge>
                  )}
                  {badgeAssumida && (
                    <Badge className="shrink-0 border-transparent bg-category-indigo text-white">Troca</Badge>
                  )}
                  {/* linha fora do rodapé NÃO leva badge (dono 19/08, caso Staub):
                      ela já se distingue por ficar no fim e sem número — o selo
                      "Fora do rodapé" lia como acusação e saiu. */}
                  {/* ajuda DERIVADA do cruzamento (caso TIAGO 30/07): com o hospital
                      de origem, porque a marca não veio de ajuda_externa */}
                  {badgeAjudaOutro && (
                    <Badge variant="info" className="shrink-0">Ajuda ({badgeAjudaOutro})</Badge>
                  )}
                  {/* último nome escalado do rodapé = plantonista do turno SEGUINTE:
                      sai primeiro (regra do dono 29/07, nos dois turnos). Verde
                      sólido, a cor dos plantões. O rótulo vem da lib — de manhã é
                      "Plantão da tarde", à tarde "Plantão da manhã". */}
                  {badgeProximoPlantao && (
                    <Badge className="shrink-0 border-transparent bg-primary text-primary-foreground">
                      {linha.plantaoLabel}
                    </Badge>
                  )}
                  {/* CONTRATURNO DE OUTRO HOSPITAL (dono 30/07): a pessoa fecha o
                      rodapé de LÁ e aparece aqui (tipicamente como ajuda). Sem isto
                      ela vinha só com "Ajuda" e ninguém sabia que sairia para o
                      plantão — foi o caso do Fernando na Unimed em 30/07. Mesma cor
                      dos plantões, com o hospital entre parênteses para não
                      confundir com o contraturno DESTA escala. */}
                  {badgeContraturno && (
                    <Badge className="shrink-0 border-transparent bg-primary/80 text-primary-foreground">
                      {rotuloPlantao} ({badgeContraturno})
                    </Badge>
                  )}
                  {/* LIVRE (verde): terminou todos os casos do turno */}
                  {livre && (
                    <Badge variant="success" className="shrink-0">Livre</Badge>
                  )}
                  {/* caso reagendado p/ o turno seguinte (status no board) — o plantonista
                      precisa saber ao liberar. Linha RENOVADA não herda: o passa-tarde era
                      da escala de antes. Rótulo pelo turno (dono 20/08): de manhã "Passa
                      para tarde", à tarde "Passa para noite". `ml-auto` = canto superior
                      direito do card, o mesmo lugar que ele ocupa no quadro da Completa —
                      é ocorrência da cirurgia, não identidade da pessoa, então não fica
                      na fila de selos colados ao nome. `mr-1` sobre o `pr-1.5` da linha
                      fecha os 10px do `pr-2.5` da coluna de baixo: este é o único selo
                      que fica SEMPRE empilhado sobre a pílula do cronômetro, e
                      desencontro entre dois pills um sobre o outro se enxerga. */}
                  {mostraPassaTurno && (
                    <Badge className="ml-auto mr-1 shrink-0 border-transparent bg-category-purple text-white">
                      {passaTurnoLabel(turnoBase)}
                    </Badge>
                  )}
                </p>
                {/* 2ª linha: infos à esquerda; cronômetro + lápis à direita (o nome acima
                    fica com a LARGURA TODA — badge ao lado sem truncar o nome) */}
                {/* ITEMS-START também aqui (dono 24/08): a coluna da direita é
                    mais alta que o bloco de texto (87px contra ~60), e com
                    `items-center` o texto era empurrado para o meio — abrindo um
                    vão de ~14px entre o nome e a linha do hospital, que no
                    protótipo vêm coladas. Alinhados ao topo, hospital, sala e
                    cirurgiões descem direto do nome. */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* card vermelho + "Liberado" = liberação FEITA, sempre. Sem
                        caso e sem marcação a linha mostra "Livre" e espera o toque
                        de quem libera (dono 20/08 — ver o bloco `liberado` acima). */}
                    {liberado && (
                      <div className="mt-1">
                        <Badge variant="destructive" badgeStyle="subtle" className="dark:bg-destructive/25">Liberado</Badge>
                      </div>
                    )}
                    {/* papel no plantão noturno. Quem é plantonista já tem o BADGE
                        ao lado do nome — repetir a palavra na linha de baixo era
                        redundante. No P4 sem marcação, diz que está nos três. */}
                    {!liberadoReal && papelSemBadge(linha) && !linha.isPlantonista && (
                      <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        {papelSemBadge(linha)}
                        {/* "nos três hospitais" é do coringa de DIA ÚTIL — no FDS o
                            selo P4 é só a posição da pessoa, não o posto coringa */}
                        {!modoFds && linha.selo === 'P4' && !p4Hospital && ' · nos três hospitais'}
                      </p>
                    )}
                    {/* EMPRESTADO (dono 30/07): mantém a posição daqui e o card diz
                        o destino — "Ajuda Hemodinâmica/Unimed" */}
                    {!liberadoReal && ajudaForaInfo(linha) && (
                      <p className="mt-0.5 text-[13px] font-medium leading-snug text-info">
                        Ajuda {ajudaForaInfo(linha).locais}/{ajudaForaInfo(linha).hospital}
                      </p>
                    )}
                    {/* TROCA DECLARADA: com quem e onde o colega está — é o que
                        diz a quem olha a fila que este slot vai mudar de mãos.
                        O DESTAQUE é só o badge roxo (dono 30/07 à noite): esta
                        linha fica na cor padrão das infos do card, sem ícone —
                        roxo + ⇆ + badge era o mesmo aviso gritado três vezes. */}
                    {trocaDe(linha) && (
                      <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        Trocado com {trocaDe(linha).outroNome}
                        {trocaDe(linha).outroHospitalLabel ? ` (${trocaDe(linha).outroHospitalLabel})` : ''}
                        {trocaDe(linha).par?.motivo ? ` · ${trocaDe(linha).par.motivo}` : ''}
                      </p>
                    )}
                    {/* SLOT ASSUMIDO (troca executada): a linha já exibe quem
                        assumiu; esta nota permanece mesmo após a liberação para
                        deixar claro que o slot continua sendo o do titular. */}
                    {linha.assumida && (
                      <p className="mt-0.5 flex items-center gap-1 text-[13px] leading-snug text-muted-foreground">
                        <ArrowLeftRight className="h-3 w-3 shrink-0" />
                        <span className="min-w-0">
                          Assumiu a posição de {linha.assumida.deNome}
                          {/* de onde veio quem chegou (consultório/folga): sem isso a
                              fila não conta o outro lado da troca (dono 13/08) */}
                          {linha.assumida.local ? ` · ${linha.assumida.local}` : ''}
                          {linha.assumida.motivo ? ` · ${linha.assumida.motivo}` : ''}
                        </span>
                      </p>
                    )}
                    {/* ⚠️ HOSPITAL ISOLADO + SALA ANTES DOS CIRURGIÕES é o card do
                        FIM DE SEMANA (dono 24/08, 2ª mensagem: "não altere a
                        escala de dias úteis"). Numa fila que cobre os três
                        hospitais "onde a pessoa está" é a primeira pergunta; num
                        dia útil a tela inteira é de um hospital só e a ordem de
                        20/07 — cirurgião, depois sala — fica como está. */}
                    {modoFds && !liberadoReal && hospitalDaLinha && (
                      <p className="mt-0.5 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-primary">
                        {hospitalDaLinha}
                      </p>
                    )}
                    {modoFds && !liberadoReal && localExibido && (
                      <p
                        className={['truncate text-[12.5px] font-semibold', ov?.local ? 'text-primary' : 'text-foreground/90'].join(' ')}
                        title={ov?.local ? 'Local ajustado' : localExibido}
                      >
                        {localExibido}
                        {ov?.local && <span className="ml-1 text-xs font-normal text-primary">· ajustado</span>}
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
                          // MESMO HORÁRIO, UMA VEZ SÓ (dono 18/08). Quem tem uma
                          // cirurgia ativa tem o total da linha ESPELHADO do término
                          // dela (31/07) — e o card mostrava o mesmo tempo duas
                          // vezes, âmbar aqui e verde na pílula. Dois números
                          // idênticos lado a lado fazem procurar uma diferença que
                          // não existe: é a própria pergunta "a que se refere?".
                          // Fica a PÍLULA, que é o número que dirige a fila; o chip
                          // volta assim que os horários divergem (2+ cirurgias).
                          const espelhaOTotal = alvo != null && alvo === terminoLinhaMin && !!cronometro
                          // SEM O ▶ (dono 24/08): o triângulo antes do nome do cirurgião
                          // saiu. "Cirurgia em andamento" já está dito na própria linha —
                          // a agendada mostra "até 15:45" e só a que está correndo mostra
                          // a contagem ("faltam 45min" / "12min além"). O glifo repetia
                          // isso num símbolo que precisava de tooltip para ser entendido,
                          // e tooltip não existe no celular. `andando` continua sendo o
                          // que decide contagem × hora — só o desenho saiu.
                          return (
                            <p key={i} className="flex items-center gap-1.5">
                              <span className="min-w-0 truncate">{c}</span>
                              {i === 0 && ov?.cirurgioes && <span className="shrink-0 text-xs text-primary">· ajustado</span>}
                              {/* TEMPO DA CIRURGIA EM PALAVRA (dono 30/07). Era um
                                  chip com ícone de relógio, e o card ficava com DOIS
                                  ⏱ lado a lado — um da cirurgia, um da pessoa — sem
                                  dizer qual era qual; o tooltip que explicava não
                                  existe no celular. Agora a POSIÇÃO diz de quem é
                                  (colado ao cirurgião) e o VERBO diz o que é. Some o
                                  segundo ícone do card e o nome deixa de disputar a
                                  linha com um elemento de borda. */}
                              {(falta || hora) && !espelhaOTotal && (
                                <span
                                  title={andando
                                    ? `Esta cirurgia (em andamento) termina às ${hora}`
                                    : `Esta cirurgia está prevista para terminar às ${hora}`}
                                  className={[
                                    'shrink-0 text-xs',
                                    falta?.atrasada ? 'font-medium text-warning' : 'text-muted-foreground',
                                  ].join(' ')}
                                >
                                  · {falta ? fraseFaltante(falta) : `até ${hora}`}
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
                    {/* DIA ÚTIL: sala/local ABAIXO do cirurgião (pedido do dono
                        2026-07-20), no tamanho e na cor de sempre. */}
                    {!modoFds && !liberadoReal && localExibido && (
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
                    {/* TEMPO ESTOUROU: o pedido em PALAVRA (dono 24/08). A pílula
                        âmbar diz que passou; esta linha diz o que fazer, que é a
                        parte que o dono pediu ("uma mensagem para atualizar o
                        tempo"). Fica na coluna da esquerda, onde já moram as infos
                        da linha, e SEM ícone: o card já teve dois ⏱ disputando
                        significado em 30/07 e um terceiro relógio devolveria o
                        problema. Some sozinha quando o tempo é atualizado — é a
                        mesma condição que pinta a pílula. */}
                    {!liberadoReal && cronometro?.atrasada && (
                      <p className="mt-0.5 text-[13px] font-medium leading-snug text-warning">
                        Atualize o tempo se a cirurgia não terminou.
                      </p>
                    )}
                    {/* card amarelo: deixa explícito o PORQUÊ da cor */}
                    {estado === 'proximo' && (
                      <div className="mt-1">
                        <Badge variant="warning" badgeStyle="subtle" className="dark:bg-warning/25">Próximo a ser liberado</Badge>
                      </div>
                    )}
                  </div>

                  {/* DIREITA EM COLUNA (dono 21/08): cronômetro em cima, "Editar"
                      no canto INFERIOR direito, os dois com a mesma margem da borda
                      do card — e na mesma vertical dos badges de estado da 1ª linha.
                      Antes ficavam lado a lado e a direita tinha DOIS layouts (linha
                      normal, coluna quando havia setas de ajuda), com um `mr-10` de
                      correção para os dois alinharem entre si. Uma coluna só torna o
                      alinhamento o padrão e o hack saiu junto. */}
                  {/* ⚠️ `mt-2` SÓ quando há SELO na 1ª linha: sem ele o badge e a
                      pílula verde do cronômetro ficam ENCOSTADOS (medido em 21/08 no
                      badge roxo: badge termina em 32px, cronômetro começa em 32px) e
                      os dois liam como um bloco de duas cores — o "amontoado"
                      reportado pelo dono. Condicional em vez de margem fixa porque a
                      folga só é necessária nesses cards; fixa, ela esticaria os 17
                      (em metade da fila esta coluna é o elemento mais alto do card e
                      é ela que define a altura). ⚠️ a condição era só o badge roxo e
                      isso deixou o defeito de pé para os OUTROS selos: em 24/08 o
                      "Plantão da tarde" encostava a 0px no "+ Tempo total". */}
                  <div className={[
                    'flex shrink-0 flex-col items-end gap-1 pr-2.5',
                    temSeloAoLadoDoNome ? 'mt-2' : '',
                  ].join(' ')}>
                    {!liberadoReal && (cronometro ? (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => canEdit && setAlvoTempo(linha)}
                        title={cronometro.atrasada
                          ? `${cronometro.titulo} — toque para atualizar o tempo`
                          : `${cronometro.titulo} — toque para ajustar`}
                        className={[
                          'flex min-h-[26px] items-center gap-1 whitespace-nowrap rounded-full',
                          'px-2.5 text-sm font-semibold',
                          // ESTOUROU = ÂMBAR (dono 24/08). O tempo já virava palavra
                          // ("25min além"), mas seguia pintado de verde, a cor de
                          // "está tudo correndo" — o número dizia uma coisa e a tinta
                          // outra. Âmbar nesta tela já significa "passou do previsto":
                          // é a mesma tinta do tempo da CIRURGIA estourada, na linha
                          // do cirurgião logo acima, e do badge "Atrasada".
                          cronometro.atrasada
                            ? 'bg-warning text-warning-foreground'
                            : 'bg-primary text-primary-foreground',
                        ].join(' ')}
                      >
                        <Timer className="h-3.5 w-3.5 shrink-0" /> {cronometro.texto}
                      </button>
                    ) : (canEdit && (
                      <button
                        type="button"
                        onClick={() => setAlvoTempo(linha)}
                        aria-label={`Definir tempo faltante de ${linha.anestesista}`}
                        /* VAZIO TEM CARA DE AÇÃO (dono 30/07): com contorno cheio ele
                           parecia um valor JÁ preenchido, e era metade da confusão com
                           o tempo da cirurgia. Tracejado + "+" diz "falta preencher"
                           pela FORMA, sem precisar ler. Preenchido continua sendo a
                           pílula verde sólida, logo acima — a única coisa no card com
                           peso de badge, porque é ela que dirige a ordem da fila. */
                        className="rounded-md border border-dashed border-border-strong bg-transparent px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground active:bg-muted"
                      >
                        + Tempo total
                      </button>
                    )))}
                    <div className="flex items-center">
                    {/* SETAS DE ORDEM DA AJUDA — de volta INLINE ao lado do lápis
                        (dono 30/07: o bloco abaixo desconfigurou o card, porque esta
                        linha é flex e ele virou mais um item horizontal). O que muda
                        em relação à 1ª versão é só o REFORÇO VISUAL: contorno e tinta
                        primária, porque chevron cinza solto não parecia clicável.
                        SÓ no bloco de ajuda: o rodapé é imutável (reescrevê-lo
                        corrompeu a escala em 22/07) e a ordem persiste em
                        `ajuda_externa[turno]`. O contraturno fica de fora — é posição
                        fixa (último), não escolha. */}
                    {temSetasAjuda && (
                      <>
                        <button
                          type="button"
                          onClick={() => onReordenarAjuda?.(linha.ajudaIdx, linha.ajudaIdx - 1)}
                          disabled={linha.ajudaIdx === 0}
                          aria-label={`Subir ${linha.anestesista} na ordem das ajudas`}
                          className="flex h-9 w-7 shrink-0 items-center justify-center text-primary active:opacity-60 disabled:opacity-25"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onReordenarAjuda?.(linha.ajudaIdx, linha.ajudaIdx + 1)}
                          disabled={linha.ajudaIdx >= totalAjudas - 1}
                          aria-label={`Descer ${linha.anestesista} na ordem das ajudas`}
                          className="flex h-9 w-7 shrink-0 items-center justify-center text-primary active:opacity-60 disabled:opacity-25"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {/* EDITAR: badge com a palavra, não o lápis (dono 21/08). O ícone
                        sozinho não dizia o que abria — e o painel que ele abre não é
                        "editar a linha" no sentido óbvio: é onde ficam observação,
                        local, cirurgião, ajuda e troca. Outline verde = ação, o mesmo
                        vocabulário dos botões "Adicionar ajuda"/"Histórico" no topo
                        da aba; os badges de ESTADO do card são todos sólidos, então
                        nada aqui se confunde com estado. Toque segue com 44px de
                        altura e o `pr-2.5` dá o mesmo respiro que o lápis tinha. */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => abrirEditor(linha)}
                        aria-label={`Editar local/cirurgião de ${linha.anestesista}`}
                        /* -my-2: alvo de toque de 44px sem esticar o card — mesmo
                           truque do selo P4 acima. */
                        className="-my-2 flex h-11 shrink-0 items-center justify-center pl-1"
                      >
                        <Badge badgeStyle="outline">Editar</Badge>
                      </button>
                    )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
          })
        })()}
      </div>}

      {addCaso && escalaDoCasoNovo && (
        <AddCasoSheet
          escala={escalaDoCasoNovo}
          turno={turnoBase}
          onClose={() => setAddCaso(false)}
          onPreencherCobranca={(novo) => onNavigate?.('novaCirurgiaParticular', { escalaCasoId: novo.id })}
        />
      )}

      {/* Painel da linha (✏️): o que é da LINHA da fila — recado, ajuda, troca e
          os ajustes de exibição (local/cirurgião). Os casos saíram em 31/07.
          DESENHO "RECADO EM CIMA" (dono 17/08, escolhido em protótipo): o que se
          escreve aqui todo dia é o RECADO, então ele abre o painel; ajuda e troca
          viram dois blocos de um toque; local e cirurgião — conserto de exibição,
          raro — descem para "Ajustes da fila", recolhido mas com o valor à vista.
          Antes os sete controles tinham o mesmo tamanho, na mesma coluna. */}
      <Sheet open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex flex-wrap items-center gap-2 text-[17px]">
              {editor?.anestesista}
              {editor?.isPlantonista && <Badge variant="secondary">Plantonista</Badge>}
              {editor?.isAjuda && <Badge variant="info">Ajuda</Badge>}
              {editor?.isProximoPlantao && (
                <Badge className="border-transparent bg-primary text-primary-foreground">{editor.plantaoLabel}</Badge>
              )}
              {editor && trocaDe(editor) && (
                <Badge className={trocaDe(editor).par?.apenasRegistro
                  ? 'border-transparent bg-category-indigo text-white'
                  : 'border-category-indigo bg-transparent text-category-indigo-fg'}>
                  Troca
                </Badge>
              )}
              {editor?.assumida && (
                <Badge className="border-transparent bg-category-indigo text-white">Troca</Badge>
              )}
            </SheetTitle>
            {/* O CONTEXTO QUE O CARD JÁ MOSTRAVA (auditoria 17/08): quem abria o
                painel perdia de vista quantas cirurgias a pessoa tem e quantas já
                têm término informado — e é justamente o que decide o ajuste. */}
            {editor && (
              <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                {[
                  editor.casosAtivos
                    ? `${editor.casosAtivos} ${editor.casosAtivos === 1 ? 'cirurgia' : 'cirurgias'}`
                    : 'sem cirurgia neste turno',
                  editor.casosAtivos > 1 ? `${editor.casosComTermino} com término informado` : null,
                  (editor.salas || []).map(salaLiberacao).join('/') || editor.notaRodape || null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </SheetHeader>
          {editor && (
            <div className="px-1 pb-4">
              {/* Os CASOS da pessoa saíram do painel (dono 30/07): ver e abrir
                  cirurgias é papel das abas Completa/Minhas — aqui ficou só o
                  que é da LINHA da fila (recado, ajuda, troca, local, cirurgião).

                  LISTA FULL-BLEED (dono 17/08, 2ª rodada): cinco assuntos, cinco
                  linhas com o valor atual à direita, e o editor abrindo ABAIXO da
                  linha tocada — a mesma gramática das telas grandes já escolhidas
                  ("a lista mostra, o editor abre fora dela"). */}
              {/* ── HOSPITAL (dono 24/08): campo PRÓPRIO, e não mais só o prefixo
                  do local derivado dos casos. No fim de semana a fila cobre os três
                  hospitais e as trocas acontecem entre eles o tempo todo — quem
                  mudou de hospital no meio do sábado não tinha como dizer isso na
                  própria linha, porque o hospital só existia quando vinha de uma
                  cirurgia importada. Só aparece na fila única: no dia útil a tela
                  inteira é de um hospital só. ── */}
              {modoFds && (
                <>
                  <LinhaPainel
                    rotulo="Hospital"
                    valor={rascHospital || (hospitaisDe(editor) ? `${hospitaisDe(editor)} · automático` : '—')}
                    aberto={abaPainel === 'hospital'}
                    onClick={() => setAbaPainel((a) => (a === 'hospital' ? null : 'hospital'))}
                  />
                  {abaPainel === 'hospital' && (
                    <div className="mb-2 space-y-2 rounded-xl border border-border bg-muted/30 p-2.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        {HOSPITAIS_FILA.map((h) => (
                          <button
                            key={h.value}
                            type="button"
                            onClick={() => setRascHospital(rascHospital === h.label ? '' : h.label)}
                            className={[
                              'min-h-[44px] rounded-xl border px-2 text-sm font-semibold transition-colors',
                              rascHospital === h.label
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground',
                            ].join(' ')}
                          >
                            {h.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Em branco = o hospital vem das cirurgias desta pessoa.
                      </p>
                    </div>
                  )}
                </>
              )}
              {/* ── LOCAL: conserto de EXIBIÇÃO da linha; a sala da cirurgia é no
                  detalhe do caso, na Completa (os dois rótulos pareciam a mesma
                  coisa com efeitos diferentes — auditoria 17/08). ── */}
              <LinhaPainel
                rotulo="Local"
                valor={rascLocal || `${(editor.salas || []).map(salaLiberacao).join('/') || '—'} · automático`}
                aberto={abaPainel === 'local'}
                onClick={() => setAbaPainel((a) => (a === 'local' ? null : 'local'))}
              />
              {abaPainel === 'local' && (
                <EditorPainel
                  titulo="Local na fila"
                  descricao="Muda só o que a FILA mostra. A sala da cirurgia se corrige no detalhe do caso."
                  onFechar={() => setAbaPainel(null)} onSalvar={salvarEditor}
                >
                  {editor.salas?.length > 0 && (
                    <p className="mb-1 text-[11.5px] text-muted-foreground">
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
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    Local novo digitado em "Outro" entra na lista para as próximas vezes.
                  </p>
                </EditorPainel>
              )}

              <LinhaPainel
                rotulo="Cirurgião(ões)"
                valor={rascCirurgiao || `${editor.cirurgioes.join(' · ') || '—'} · automático`}
                aberto={abaPainel === 'cirurgiao'}
                onClick={() => setAbaPainel((a) => (a === 'cirurgiao' ? null : 'cirurgiao'))}
              />
              {abaPainel === 'cirurgiao' && (
                <EditorPainel
                  titulo="Cirurgião(ões)"
                  descricao="Campo vazio segue o automático (o cirurgião de cada caso)."
                  onFechar={() => setAbaPainel(null)} onSalvar={salvarEditor}
                >
                  {editor.cirurgioes?.length > 0 && (
                    <p className="mb-1 text-[11.5px] text-muted-foreground">
                      Automático (dos casos): <b className="text-foreground/80">{editor.cirurgioes.join(' · ')}</b>
                    </p>
                  )}
                  <Input
                    id="editor-cirurgiao"
                    autoFocus
                    aria-label="Cirurgião(ões)"
                    value={rascCirurgiao}
                    onChange={(e) => setRascCirurgiao(e.target.value)}
                    placeholder={editor.cirurgioes.length ? editor.cirurgioes.join(' · ') : 'ex.: Liana W'}
                    onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                  />
                  {/* escrever aqui SUBSTITUI a lista derivada — e com ela somem os
                      tempos por cirurgia dos chips (não há caso a que casar) */}
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    Escrevendo à mão, a linha deixa de mostrar o tempo de cada cirurgia.
                  </p>
                </EditorPainel>
              )}

              {/* ── AJUDA à mão (dono 29/07) — card noturno fica de fora: ele é
                  sintetizado do plantão, não existe no rodapé do turno. ── */}
              {canEdit && !editor.noturno && (
                <button
                  type="button"
                  /* fecha no toque (dono 19/08): o badge pinta pelo otimista do
                     context; erro reverte + toast */
                  onClick={() => { toggleAjuda(editor).catch(() => {}); setEditor(null) }}
                  aria-pressed={!!editor.isAjuda}
                  /* nome acessível igual ao do detalhe do caso: os dois escrevem
                     no MESMO ajudaExterna e tinham dois rótulos (auditoria 17/08) */
                  aria-label={editor.isAjuda
                    ? `${editor.anestesista} não é ajuda de outro hospital`
                    : `Marcar ${editor.anestesista} como ajuda de outro hospital`}
                  className="flex min-h-[48px] w-full items-center gap-2 border-b border-border py-2 text-left"
                >
                  <span className="text-[14.5px] font-semibold">Ajuda de outro hospital</span>
                  <span className={[
                    'relative ml-auto h-[26px] w-11 shrink-0 rounded-full border transition-colors',
                    editor.isAjuda ? 'border-primary bg-primary' : 'border-muted-foreground/25 bg-muted-foreground/30',
                  ].join(' ')}>
                    <span className={[
                      'absolute top-[2px] h-5 w-5 rounded-full bg-white shadow transition-all',
                      editor.isAjuda ? 'left-[22px]' : 'left-[2px]',
                    ].join(' ')} />
                  </span>
                </button>
              )}

              {/* ── TROCA DECLARADA (dono 30/07) — declarar / executar / desfazer.
                  NÃO é a troca antiga (removida 2×): par declarado + badge nos dois
                  lados + execução de um toque (swap SIMULTÂNEO dos dois hospitais).
                  Nada aqui escreve ordem_liberacao — a identidade do SLOT muda.
                  Linha `chave#casos` (dono de slot assumido reaparecendo com casos)
                  fica DE FORA: a chave é espelho de verdade-dos-dados — troca
                  gravada nela ficaria órfã, nada a lê (defeito D7, 07/08).
                  TROCAS FICAM FORA DO MODO FDS (decisão de escopo 15/08): a fila
                  única já modela "pega caso em qualquer hospital" — movimentação
                  registra-se pela Observação da linha. ── */}
              {/* ── RESPONSÁVEL (dono 24/08): troca o NOME de quem responde pela
                  posição, mantendo a posição. Nasceu de um caso que o app não
                  cobria — "eventualmente os usuários fazem trocas de alguém de
                  FORA da escala fazer um turno específico". Não é a troca entre
                  dois colegas da fila (essa é a linha abaixo): é substituição de
                  um lado só. O selo Pn, a chave da linha e a ordem publicada não
                  se movem; muda quem aparece e para quem vão as cirurgias em
                  aberto. Só na fila única — no dia útil o caminho é o ⚙ da sala,
                  na aba Completa. ── */}
              {canEdit && modoFds && !editor.noturno && !String(editor.chave || '').includes('#casos') && (
                <>
                  <LinhaPainel
                    rotulo="Responsável"
                    valor={editor.assumida
                      ? `${editor.anestesista} · no lugar de ${editor.assumida.deNome}`
                      : editor.anestesista}
                    aberto={abaPainel === 'responsavel'}
                    onClick={() => setAbaPainel((a) => (a === 'responsavel' ? null : 'responsavel'))}
                  />
                  {abaPainel === 'responsavel' && (
                    <div className="mb-2 space-y-2 rounded-xl border border-border bg-muted/30 p-2.5">
                      {editor.assumida ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            A posição é de <b className="text-foreground">{editor.assumida.deNome}</b> e hoje
                            está com <b className="text-foreground">{editor.anestesista}</b>.
                          </p>
                          <Button
                            variant="outline"
                            className="w-full"
                            disabled={trocandoResp}
                            onClick={() => devolverResponsavel(editor)}
                          >
                            Devolver a posição para {editor.assumida.deNome}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Select
                            className="w-full"
                            searchable
                            options={opcoesRoster}
                            value={respUid}
                            onChange={setRespUid}
                            placeholder="Quem responde por esta posição hoje"
                          />
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            A posição continua sendo a de <b className="text-foreground">{editor.anestesista}</b> e a
                            ordem de liberação não se move.
                            {editor.casoIds?.length
                              ? ` As ${editor.casoIds.length} cirurgia(s) em aberto vão junto.`
                              : ' Não há cirurgia em aberto para transferir.'}
                          </p>
                          <Button
                            className="w-full"
                            disabled={!respUid || trocandoResp}
                            onClick={() => trocarResponsavel(editor)}
                          >
                            {trocandoResp ? 'Trocando…' : 'Trocar responsável'}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              {/* ── POSIÇÃO NA FILA (dono 24/08): "pode deixar a opção, mas não é
                  a regra". Trocar de posição com um colega da mesma fila — duas
                  assunções cruzadas. A ordem publicada NÃO se move: o que muda é
                  quem ocupa cada vaga. Fica por último no painel, depois de tudo
                  que é do dia a dia, porque é a ação mais rara. ── */}
              {canEdit && modoFds && !editor.noturno && !editor.assumida && !String(editor.chave || '').includes('#casos') && (
                <>
                  <LinhaPainel
                    rotulo="Posição na fila"
                    valor={`${(linhas.findIndex((l) => l.chave === editor.chave) + 1) || '—'}ª · trocar`}
                    aberto={abaPainel === 'posicao'}
                    onClick={() => setAbaPainel((a) => (a === 'posicao' ? null : 'posicao'))}
                  />
                  {abaPainel === 'posicao' && (
                    <div className="mb-2 space-y-2 rounded-xl border border-border bg-muted/30 p-2.5">
                      <Select
                        className="w-full"
                        searchable
                        options={linhas
                          .filter((l) => l.chave !== editor.chave && !l.noturno && !l.assumida)
                          .map((l, i) => ({ value: l.chave, label: `${i + 1}ª · ${l.anestesista}` }))}
                        value={posColega}
                        onChange={setPosColega}
                        placeholder="Trocar de posição com"
                      />
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        Os dois trocam de vaga e levam as cirurgias em aberto. A ordem publicada
                        não muda — só quem ocupa cada posição.
                      </p>
                      <Button
                        className="w-full"
                        disabled={!posColega || trocandoResp}
                        onClick={() => trocarPosicao(editor)}
                      >
                        {trocandoResp ? 'Trocando…' : 'Trocar de posição'}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {canEdit && !editor.noturno && !modoFds && !String(editor.chave || '').includes('#casos') && (() => {
                if (editor.assumida) {
                  return (
                    <>
                      <LinhaPainel
                        rotulo="Troca"
                        valor={`assumiu a posição de ${editor.assumida.deNome}`}
                        aberto={abaPainel === 'troca'}
                        onClick={() => setAbaPainel((a) => (a === 'troca' ? null : 'troca'))}
                      />
                      {abaPainel === 'troca' && (
                        <EditorPainel titulo="Troca" onFechar={() => setAbaPainel(null)} onSalvar={salvarEditor}>
                          <Button variant="outline" className="w-full" disabled={executandoTroca} onClick={desfazerSubstEditor}>
                            {executandoTroca ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                            Desfazer troca
                          </Button>
                          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                            Devolve a posição e os casos em aberto para {editor.assumida.deNome}, nos dois lados da troca.
                          </p>
                        </EditorPainel>
                      )}
                    </>
                  )
                }
                const info = trocaDe(editor)
                if (info) {
                  // REGISTRO (dono 10/08): a escala já saiu trocada, ninguém
                  // muda de lugar — oferecer "executar" aqui MOVERIA os dois e
                  // desfaria a troca real. Só o rastro e o botão de tirá-lo.
                  const registro = !!info.par?.apenasRegistro
                  return (
                    <>
                      <LinhaPainel
                        rotulo="Troca"
                        valor={`com ${info.outroNome}${info.outroHospitalLabel ? ` (${info.outroHospitalLabel})` : ''}`}
                        aberto={abaPainel === 'troca'}
                        onClick={() => setAbaPainel((a) => (a === 'troca' ? null : 'troca'))}
                      />
                      {abaPainel === 'troca' && (
                        <EditorPainel titulo="Troca" onFechar={() => setAbaPainel(null)} onSalvar={salvarEditor}>
                          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-category-indigo-fg" />
                            Trocado com <b>{info.outroNome}</b>{info.outroHospitalLabel ? ` (${info.outroHospitalLabel})` : ''}
                            {info.par?.motivo ? <span className="font-normal text-muted-foreground"> · {info.par.motivo}</span> : null}
                          </p>
                          {registro ? (
                            <>
                              <p className="mb-2 text-[11.5px] text-muted-foreground">
                                A escala já saiu com os dois no lugar certo — este é o registro da troca, ninguém muda de posição.
                              </p>
                              {/* ⚠️ registro era BECO SEM SAÍDA (dono 18/08: "a
                                  posição na lista de liberações não está
                                  mudando"): com a troca registrada, o painel
                                  perdia a entrada do TrocaSheet e o único botão
                                  era remover — não havia caminho nenhum para
                                  fazer as posições trocarem de fato. Aqui a
                                  decisão volta a ser POR POSIÇÃO no sheet (o
                                  app nunca supõe quem se move, regra 10/08), já
                                  com o colega escolhido. */}
                              <Button variant="outline" className="mb-1.5 w-full" disabled={executandoTroca}
                                onClick={() => { const l = editor; setEditor(null); onAbrirTroca?.(l, info.outroUid || null, 'posicao') }}>
                                <ArrowLeftRight className="w-4 h-4" />
                                Trocar de posição na escala
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button className="w-full" disabled={executandoTroca}
                                onClick={() => setConfirmarTroca({ par: info.par, outroNome: info.outroNome, euNome: editor.anestesista })}>
                                {executandoTroca ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                                Executar agora — {info.outroNome} assume aqui
                              </Button>
                              <p className="my-1.5 text-[11.5px] text-muted-foreground">
                                Um toque, os dois lados juntos: cada um herda a posição na fila e os casos em aberto do colega.
                              </p>
                            </>
                          )}
                          <Button variant="outline" className="w-full" disabled={executandoTroca} onClick={() => desfazerTrocaEditor(info.par)}>
                            {registro ? 'Remover registro da troca' : 'Desfazer troca'}
                          </Button>
                        </EditorPainel>
                      )}
                    </>
                  )
                }
                // FLUXO ÚNICO (dono 07/08, "as trocas num só local"): trocar sai
                // daqui e vai para o TrocaSheet — origem confirmada + tipo
                // inferido + motivo + "Trocar agora", a MESMA UI de qualquer
                // entrada. Executar/desfazer o que já existe fica no painel.
                return (
                  <>
                    <LinhaPainel
                      rotulo="Troca com um colega"
                      valor="nenhuma"
                      onClick={() => { const l = editor; setEditor(null); onAbrirTroca?.(l) }}
                    />
                    {/* ⚠️ OPÇÃO PRÓPRIA (dono 18/08, caso Fernanda⇄Daniela): "a
                        Daniela assumiu o plantão mas ficou apenas o badge de
                        troca — nesses casos quero que haja troca de posição".
                        A troca de cima segue como sempre (registro por padrão,
                        que é como a troca entre hospitais é feita); esta aqui
                        diz de saída que a POSIÇÃO muda de dono na fila, e ainda
                        pede confirmação antes de gravar. */}
                    <LinhaPainel
                      rotulo="Trocar de posição na escala"
                      valor="quem assumir entra nesta posição"
                      onClick={() => { const l = editor; setEditor(null); onAbrirTroca?.(l, null, 'posicao') }}
                    />
                  </>
                )
              })()}

              {/* "Observação", não "recado" (dono 17/08): com o RECADO DO
                  PLANTONISTA na mesma aba, dois "recados" com significados
                  diferentes na mesma tela era exatamente o tipo de nome dividido
                  que esta rodada veio fechar. Volta ao nome de 29/07. */}
              <LinhaPainel
                rotulo="Observação"
                valor={rascObservacao || 'nenhuma'}
                aberto={abaPainel === 'recado'}
                onClick={() => setAbaPainel((a) => (a === 'recado' ? null : 'recado'))}
              />
              {abaPainel === 'recado' && (
                <EditorPainel
                  titulo="Observação"
                  descricao="Aparece no card da fila. Sem nome de paciente — a escala só guarda iniciais."
                  onFechar={() => setAbaPainel(null)} onSalvar={salvarEditor}
                >
                  {/* sem rótulo aqui: a LINHA logo acima já diz "Observação" —
                      repetir dava a mesma palavra duas vezes coladas na tela */}
                  <Input
                    id="editor-observacao"
                    aria-label="Observação"
                    autoFocus
                    value={rascObservacao}
                    maxLength={OBSERVACAO_MAX}
                    onChange={(e) => setRascObservacao(e.target.value)}
                    placeholder="ex.: saiu para a Hemodinâmica às 15h"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                  />
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">
                    {rascObservacao.length}/{OBSERVACAO_MAX}
                  </p>
                </EditorPainel>
              )}

              {/* AÇÕES GRUDADAS NO PÉ: com o painel rolando, Salvar saía da tela e
                  o campo ficava preenchido sem gravar. Some enquanto uma folha de
                  editor está aberta — ela tem o próprio Salvar, e dois botões com
                  o mesmo nome na mesma tela é escolha que ninguém deveria ter. */}
              {!abaPainel && (
              <div className="sticky bottom-0 -mx-1 mt-3 flex gap-2 border-t border-border bg-card px-1 pb-1 pt-3">
                <Button variant="outline" className="flex-1" onClick={restaurarEditor}>
                  Restaurar automático
                </Button>
                <Button className="flex-1" onClick={salvarEditor}>
                  Salvar
                </Button>
              </div>
              )}
              {!abaPainel && (
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  "Restaurar automático" limpa também o cronômetro e as marcas desta linha.
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* HISTÓRICO DO TURNO (dono 17/08): quem não é plantonista não manda, mas
          precisa poder reler o que passou — inclusive o que já confirmou e saiu
          da tela. Ninguém confirma por aqui (isso é do card, na fila), mas o
          PLANTONISTA apaga: sem isto ele perdia o recado de vista assim que
          confirmava o próprio — e ele segue na tela de quem não confirmou, sem
          ninguém poder tirá-lo ("adiciona e/ou exclui quando quiser"). */}
      <Sheet open={historicoSheet} onOpenChange={(o) => !o && setHistoricoSheet(false)}>
        <SheetContent side="bottom" className="!h-auto max-h-[85vh]">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-[17px] leading-tight">Histórico de mensagens</SheetTitle>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              Recados deste turno, do mais recente para o mais antigo.
            </p>
          </SheetHeader>
          <div className="space-y-2 overflow-y-auto pb-4">
            {historicoAvisos.length === 0 && (
              <p className="rounded-xl border border-border bg-muted/30 p-3 text-[13px] text-muted-foreground">
                Nenhuma mensagem neste turno.
              </p>
            )}
            {historicoAvisos.map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-tight [overflow-wrap:anywhere]">{a.texto}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                    <MessageSquare className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">{titleCaseNome(a.autorNome) || 'Plantonista'}</span>
                    <span className="shrink-0">· plantonista ·</span>
                    <span className="shrink-0 tabular-nums">{horaCurta(a.criadoEm)}</span>
                  </p>
                </div>
                {canEdit && souPlantonista && (
                  <button
                    type="button"
                    onClick={() => excluirAviso(a.id)}
                    aria-label={`Excluir mensagem "${a.texto}"`}
                    className="-my-1 flex h-9 w-8 shrink-0 items-center justify-center text-muted-foreground active:opacity-60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Compor o recado do plantonista (dono 17/08). Campo único e curto: é um
          aviso de corredor ("Guilherme libera Alexandre S."), não um comunicado —
          para comunicado o app já tem o módulo Comunicados. */}
      <Sheet open={avisoSheet} onOpenChange={(o) => { if (!o) { setAvisoSheet(false); setRascAviso('') } }}>
        <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-[17px]">
              <MessageSquare className="w-4 h-4 shrink-0" /> Mensagem para equipe
            </SheetTitle>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              Aparece no topo desta aba para todo mundo e some da tela de cada um que confirmar.
              Chega também como notificação no celular de quem ativou.
            </p>
          </SheetHeader>
          <div className="px-1 pb-4">
            <Input
              autoFocus
              value={rascAviso}
              maxLength={AVISO_MAX}
              onChange={(e) => setRascAviso(e.target.value)}
              placeholder="ex.: Guilherme libera Alexandre S."
              onKeyDown={(e) => { if (e.key === 'Enter') publicarAviso() }}
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{rascAviso.length}/{AVISO_MAX}</p>
            {/* LGPD: texto livre que o grupo TODO enxerga — mesma regra da
                Observação da linha (a escala só guarda iniciais de paciente).
                Desde 24/08 o recado também vai como push, e o corpo da push
                aparece na tela BLOQUEADA de quem recebe, à vista de quem estiver
                com o aparelho na mão: aqui nem iniciais servem. */}
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              Recado operacional. Sem paciente — nem nome, nem iniciais: o texto
              aparece na tela bloqueada de quem recebe.
            </p>
            <Button
              className="mt-3 w-full"
              disabled={enviandoAviso || !rascAviso.trim()}
              onClick={publicarAviso}
            >
              {/* rótulo diferente do botão que abriu o sheet: "Avisar a equipe"
                  nos dois lugares dava dois controles com o mesmo nome na tela */}
              {enviandoAviso ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Publicar recado'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Tempo faltante — 1 toque define o término e liga o cronômetro do card */}
      <Sheet open={!!alvoTempo} onOpenChange={(o) => { if (!o) { setAlvoTempo(null); setHoraExata('') } }}>
        <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
          <SheetHeader className="pb-2">
            {/* MESMO NOME do botão que abriu (dono 17/08): a pílula/atalho da fila
                diz "Tempo total" e o painel dizia outra coisa — eram quatro nomes
                para dois conceitos. Aqui e no card é "tempo faltante"; "término"
                é o da CIRURGIA, no detalhe do caso. */}
            <SheetTitle className="flex items-center gap-2 text-[17px]">
              <Timer className="w-4 h-4 shrink-0" /> Tempo faltante de {alvoTempo?.anestesista || '—'}
            </SheetTitle>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              Quando {alvoTempo?.anestesista ? 'essa pessoa' : 'ela'} fica livre — vale para
              {alvoTempo?.casosAtivos
                ? ` as ${alvoTempo.casosAtivos} ${alvoTempo.casosAtivos === 1 ? 'cirurgia' : 'cirurgias'} dela, e nunca é a soma delas.`
                : ' o turno todo.'}
            </p>
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

      {/* CONFIRMAÇÃO DO SWAP (dono 18/08) — mesma pergunta do TrocaSheet: nenhum
          caminho executa a troca sem mostrar antes o que muda na fila. */}
      <ConfirmDialog
        open={!!confirmarTroca}
        onClose={() => { if (!executandoTroca) setConfirmarTroca(null) }}
        onConfirm={executarTrocaEditor}
        loading={executandoTroca}
        title="Trocar as posições?"
        description={confirmarTroca
          ? `${confirmarTroca.outroNome} assume a posição de ${confirmarTroca.euNome} — e a posição de ${confirmarTroca.outroNome} passa para ${confirmarTroca.euNome}.`
          : undefined}
        confirmText="Confirmar troca"
        cancelText="Revisar"
        icon={<ArrowLeftRight className="h-11 w-11" />}
      >
        <p className="text-xs text-muted-foreground">
          Os dois lados vão juntos: cada um herda a posição na fila e as cirurgias em aberto do colega. A ordem
          publicada no rodapé não muda — o que muda é quem ocupa cada posição. Dá para desfazer pelo ✏️ da linha.
        </p>
      </ConfirmDialog>

    </div>
  )
}

/**
 * Linha do painel da linha: rótulo à esquerda, valor atual à direita e o chevron
 * que abre o editor ABAIXO dela (desenho C, dono 17/08). Sem `aberto` a linha é
 * um atalho que navega para fora (é o caso da troca, que abre o TrocaSheet).
 */
function LinhaPainel({ rotulo, valor, aberto, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={aberto === undefined ? undefined : aberto}
      className="flex min-h-[48px] w-full items-center gap-3 border-b border-border py-2 text-left"
    >
      <span className="shrink-0 text-[14.5px] font-semibold">{rotulo}</span>
      <span className="ml-auto min-w-0 truncate text-right text-[11.5px] text-muted-foreground">{valor}</span>
      {aberto === undefined
        ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        : <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? 'rotate-180' : ''}`} />}
    </button>
  )
}

/**
 * Editor de uma linha do painel, em FOLHA de baixo para cima (dono 17/08): abrir
 * sob a linha empurrava o resto e mudava a altura do painel no meio da leitura —
 * o mesmo defeito que os editores do caso tiveram, e que ali já foi resolvido
 * assim. O conteúdo da linha fica parado atrás.
 *
 * Salvar aqui grava o override INTEIRO (local + cirurgião + observação) e fecha o
 * painel: é o mesmo `salvarEditor` do rodapé, e ter dois botões de gravar com
 * significados diferentes era o que fazia o campo ficar preenchido sem salvar.
 */
function EditorPainel({ titulo, descricao, onFechar, onSalvar, children }) {
  return (
    <Sheet open onOpenChange={(o) => !o && onFechar?.()}>
      <SheetContent side="bottom" className="!h-auto max-h-[85vh]">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-[17px] leading-tight">{titulo}</SheetTitle>
          {descricao && (
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{descricao}</p>
          )}
        </SheetHeader>
        <div className="px-1 pb-3">{children}</div>
        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card px-1 pb-4 pt-3">
          <Button variant="outline" className="flex-1" onClick={onFechar}>Cancelar</Button>
          <Button className="flex-1" onClick={onSalvar}>
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** "14:20" a partir do timestamp do recado (vazio se não parseia). */
function horaCurta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
