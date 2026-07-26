/**
 * LiberacoesView — coluna de liberação do hospital (gerada pelas 18 regras).
 * Ordem exibida = ordem do rodapé da imagem: o nº 1 é o PLANTONISTA (último a ir
 * embora) e a liberação corre de baixo para cima. O plantonista marca liberado,
 * reordena, e ajusta a LINHA de um anestesista (local e/ou cirurgião) pelo ✏️ —
 * override estruturado que sobrevive à re-derivação. Realtime: reflete para todos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, ListOrdered, Loader2, Moon, Pencil, Timer, UserPlus, X } from 'lucide-react'
import {
  Badge, Button, EmptyState, Input, Select, useToast,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/design-system'
import { gerarColunaLiberacao, nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import { faseLiberacoes, plantonistasNoturnos, candidatosNome, plantonistaNoturnoDe, linhasNoturnas, fundirLinhasNoturnas, marcarSelosNoTurno, ehDiaUtil, P4_HOSPITAIS } from '@/lib/plantaoNoturno'
import { hojeISO, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { agora } from '@/lib/devClock'
import useAgoraMinuto from './useAgoraMinuto'
import { casosResolvidos, compararSalas, filtrarPorTurno, formatRestante, LOCAIS_BASE, normNome, parseHoraMinutos, rodapeDoTurno, salaLiberacao } from './utils'

// Cores do card por estado (pedido do dono): verde = escalado (em sala),
// amarelo = PRÓXIMO a ser liberado (último não-liberado — a liberação corre de
// baixo para cima), vermelho = já liberado.
// Opções do Select de hora exata (padrão DS): dia inteiro em passos de 15min.
const HORARIOS_OPCOES = Array.from({ length: 96 }, (_, i) => {
  const v = `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`
  return { value: v, label: v }
})

// Sentinelas do dropdown de Local (valores impossíveis como nome de sala)
const LOCAL_AUTO = '__auto__'
const LOCAL_OUTRO = '__outro__'

/** Próximo quarto de hora (sugestão inicial do Select — dropdown já abre perto de agora). */
function proximoQuartoDeHora() {
  const d = new Date(agora().getTime() + 15 * 60000)
  const m = Math.floor(d.getMinutes() / 15) * 15
  return `${String(d.getHours()).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

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

export default function LiberacoesView({ escala, hospital, hospitalLabel, canEdit, meuUid, meuAlias, turno, plantoes, p4Hospital = null, onDefinirP4, onDefinirCaso, onToggle, onToggleEscalado, onReorder, onSetOverride, onAddAjuda, onRemoveAjuda }) {
  const { toast } = useToast()
  // TURNO (23/07: manhã e tarde convivem no mesmo dia): a lista mostra só os casos
  // do turno selecionado e o rodapé (ordem de liberação) DAQUELE turno.
  const casosTurno = useMemo(() => filtrarPorTurno(escala?.casos || [], turno), [escala, turno])
  const rodapeTurno = useMemo(() => rodapeDoTurno(escala?.ordemLiberacao, turno), [escala, turno])
  const [editor, setEditor] = useState(null) // linha em edição (sheet)
  const [rascLocal, setRascLocal] = useState('')
  const [localOutro, setLocalOutro] = useState(false) // "Outro" no seletor de local
  const [rascCirurgiao, setRascCirurgiao] = useState('')
  const [rascTermino, setRascTermino] = useState('') // término manual "HH:MM"
  const [alvoTempo, setAlvoTempo] = useState(null) // linha do sheet "Tempo faltante"
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
  const { roster, resolver: resolverUid, rosterByUid, loading: rosterLoading } = useRosterAnestesistas()

  // Ajuda externa DO TURNO (nomes azuis) + opções do roster p/ o sheet de adicionar.
  const ajudaTurno = useMemo(() => rodapeDoTurno(escala?.ajudaExterna, turno), [escala, turno])
  const opcoesRoster = useMemo(
    () => (roster || []).map((r) => ({ value: r.uid, label: titleCaseNome(r.nome) })),
    [roster]
  )

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
  const nomeExibicao = useCallback((uid) => {
    const r = rosterByUid.get(uid)
    return r?.nome ? nomeCirurgiaoCurto(r.nome) : null
  }, [rosterByUid])

  const { linhas, semAnestesista } = useMemo(() => {
    if (!casosTurno.length) return { linhas: [], semAnestesista: [] }
    return gerarColunaLiberacao(casosTurno, rodapeTurno, {
      hospital: hospitalLabel,
      ajudaExterna: rodapeDoTurno(escala.ajudaExterna, turno), // AZUL, por-turno (ajuda da tarde ≠ da manhã)
      resolverUid,
      nomeExibicao,
    })
  }, [casosTurno, rodapeTurno, escala, hospitalLabel, resolverUid, nomeExibicao])

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
    return null
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

  // Reordenar é EXCLUSIVO do plantonista (pedido do dono 2026-07-22): a ordem é
  // dele — qualquer outro clínico mexendo embaralhava a lista de todos. Identidade
  // pelo uid do vínculo; sem vínculo, cai p/ o apelido (demo/legado).
  const plantonistaLinha = linhas.find((l) => l.isPlantonista) || null
  const souPlantonista = !!plantonistaLinha && (
    plantonistaLinha.uid
      ? plantonistaLinha.uid === meuUid
      : [plantonistaLinha.nomeOriginal, plantonistaLinha.anestesista]
          .some((n) => n && meuAlias && normNome(n) === normNome(meuAlias))
  )
  // Após 19h o plantonista NOTURNO do hospital também comanda a lista (o diurno
  // segue podendo ajustar durante a passagem de plantão).
  const nomeNoturno = plantonistaNoturnoDe(chaveHospital, noturnos, p4Hospital)
  const souPlantonistaNoturno = !!nomeNoturno && !!meuUid && resolverNomeCompleto(nomeNoturno) === meuUid
  const podeReordenar = canEdit && (souPlantonista || (fase === 'noite' && souPlantonistaNoturno))
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
  const mover = (idx, dir) => {
    const alvo = idx + dir
    if (alvo < 0 || alvo >= linhasExibicao.length) return
    const movido = linhasExibicao[idx]
    const vizinho = linhasExibicao[alvo]
    const base = linhas.filter((l) => l.chave !== movido.chave)
    const nomes = base.map((l) => l.nomeOriginal)
    const para = base.findIndex((l) => l.chave === vizinho.chave)
    if (para < 0) return
    nomes.splice(dir < 0 ? para : para + 1, 0, movido.nomeOriginal)
    onReorder?.(nomes)
  }

  const toggle = async (linha, liberado) => {
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
    setLocalOutro(!!loc && !locaisHospital.includes(loc)) // local livre já salvo → modo "Outro"
    setRascCirurgiao(ov?.cirurgioes || '')
    setRascTermino(ov?.termino || '')
    setEditor(linha)
  }
  const salvarEditor = () => {
    const local = rascLocal.trim()
    const cirurgioes = rascCirurgiao.trim()
    const termino = rascTermino.trim()
    onSetOverride?.(editor, local || cirurgioes || termino ? { local, cirurgioes, termino } : null)
    // local novo (digitado em "Outro") entra na lista NA HORA; os demais aparelhos
    // aprendem no próximo load (o override salvo é a fonte do histórico)
    if (local && !locaisHospital.includes(local)) setLocaisAprendidos((prev) => [...prev, local])
    setEditor(null)
  }
  const restaurarEditor = () => {
    onSetOverride?.(editor, null)
    setEditor(null)
  }

  // "Tempo faltante": grava override.termino (agora + duração, ou hora exata),
  // PRESERVANDO local/cirurgiões já ajustados.
  const definirTempo = (linha, terminoHHMM) => {
    const ov = overrideDe(linha) || {}
    onSetOverride?.(linha, {
      local: ov.local || '',
      cirurgioes: ov.cirurgioes || '',
      termino: terminoHHMM || '',
    })
    setAlvoTempo(null)
    setHoraExata('')
  }
  const emMinutos = (min) => {
    const d = new Date(agora().getTime() + min * 60000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  // Alerta "?" → dono: grava no caso (o alerta sai daqui E da Completa juntos).
  const confirmarSemAnest = async () => {
    const r = rosterByUid.get(semAnestUid)
    if (!r || !alvoSemAnest?.id) return
    try {
      await onDefinirCaso?.(alvoSemAnest.id, {
        uid: r.uid,
        apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome),
        rotulo: [alvoSemAnest.hora, salaLiberacao(alvoSemAnest.sala)].filter(Boolean).join(' '),
      })
      setAlvoSemAnest(null)
      setSemAnestUid('')
    } catch { /* toast de erro já vem do context */ }
  }

  // adicionar ajuda: resolve o roster → nome (apelido p/ casar no dicionário) → onAddAjuda
  const confirmarAjuda = () => {
    const r = rosterByUid.get(ajudaUid)
    if (!r) return
    onAddAjuda?.(r.apelidos?.[0] || primeiroNomeUpper(r.nome))
    setAjudaUid('')
    setAjudaSheet(false)
  }
  const DURACOES = [
    { label: '15min', min: 15 }, { label: '30min', min: 30 }, { label: '1h', min: 60 },
    { label: '1h30', min: 90 }, { label: '2h', min: 120 }, { label: '2h30', min: 150 },
    { label: '3h', min: 180 },
  ]

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
              const definivel = canEdit && !!i.id && !!onDefinirCaso
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
          // próximo a ser liberado = ÚLTIMO não-liberado ainda EM SALA
          let idxProximo = -1
          for (let i = linhasExibicao.length - 1; i >= 0; i--) {
            // P1/P2 são os plantonistas da noite: nunca entram na fila do
            // "próximo a ser liberado" (pedido do dono 24/07). P3/P4 entram.
            if (linhasExibicao[i].noturno && SELO_SEM_PROXIMO.has(linhasExibicao[i].selo)) continue
            const m = marcaDe(linhasExibicao[i])
            const emSala = m?.escalado === true || !naoEscalado(linhasExibicao[i])
            if (!(m && !m.escalado) && emSala) { idxProximo = i; break }
          }
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
          // Cronômetro 100% MANUAL (decisão do dono 23/07): TODA linha nasce em
          // branco ("Tempo faltante") e só conta depois que alguém preenche —
          // a estimativa automática (hora+tempo dos casos da manhã) enchia a
          // coluna de "+8h53" sem sentido conforme o dia avançava.
          const cronometro = (() => {
            if (liberado) return null
            const manual = parseHoraMinutos(ov?.termino)
            if (manual == null) return null
            const diff = manual - agoraMin
            const abs = Math.abs(diff)
            const fmt = abs >= 60 ? `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}` : `${abs}min`
            return {
              texto: diff >= 0 ? `~${fmt}` : `+${fmt}`,   // curto p/ a coluna
              titulo: formatRestante(manual, agoraMin),    // frase completa no title
              atrasada: diff < 0,
            }
          })()
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

              {/* reordenar ao lado do número — SÓ o plantonista (pedido 2026-07-22).
                  Card noturno sintético não está no rodapé: sem setas (mover não
                  teria onde persistir). */}
              {podeReordenar && !linha.sintetico && (
                <div className="flex shrink-0 flex-col">
                  <button type="button" onClick={() => mover(idx, -1)} aria-label={`Subir ${linha.anestesista}`}
                    className="flex h-[22px] w-6 items-end justify-center pb-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => mover(idx, 1)} aria-label={`Descer ${linha.anestesista}`}
                    className="flex h-[22px] w-6 items-start justify-center pt-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === linhasExibicao.length - 1}>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* marcar liberado: alvo 44px, círculo visual 28px (não escalado já nasce liberado) */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => (semEscala ? onToggleEscalado?.(linha) : toggle(linha, liberadoReal))}
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
                    {/* cirurgiões em ORDEM DE HORÁRIO, 1 por linha, SEM bolinha (pedido do dono 24/07) */}
                    {!liberadoReal && listaCirurgioes.length > 0 && (
                      <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        {listaCirurgioes.map((c, i) => (
                          <p key={i} className="truncate">
                            {c}
                            {i === 0 && ov?.cirurgioes && <span className="ml-1 text-xs text-primary">· ajustado</span>}
                          </p>
                        ))}
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

      {/* editor da linha (✏️): local e/ou cirurgião — vazio volta ao automático */}
      <Sheet open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Editar linha — {editor?.anestesista}</SheetTitle>
          </SheetHeader>
          {editor && (
            <div className="space-y-3 px-1 pb-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Local</p>
                {/* dropdown com os locais do hospital (dia + aprendidos); "Outro" abre digitação */}
                <Select
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
                <Input
                  id="editor-cirurgiao"
                  value={rascCirurgiao}
                  onChange={(e) => setRascCirurgiao(e.target.value)}
                  placeholder={editor.cirurgioes.length ? editor.cirurgioes.join(' · ') : 'ex.: Liana W'}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                />
              </div>
              <div>
                <label htmlFor="editor-termino" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Término previsto (cronômetro)
                </label>
                <Input
                  id="editor-termino"
                  type="time"
                  value={rascTermino}
                  onChange={(e) => setRascTermino(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarEditor() }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Hora prevista de término da sala — vira o cronômetro do card ("termina em ~…").
                </p>
              </div>
              <p className="text-xs text-muted-foreground">Campo vazio volta ao valor automático (derivado dos casos).</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={restaurarEditor}>Restaurar automático</Button>
                <Button className="flex-1" onClick={salvarEditor}>Salvar</Button>
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
              <Timer className="w-4 h-4 shrink-0" /> Tempo faltante
            </SheetTitle>
            {alvoTempo?.anestesista && (
              <p className="text-lg font-bold leading-tight text-foreground">{alvoTempo.anestesista}</p>
            )}
          </SheetHeader>
          {alvoTempo && (
            <div className="space-y-5 px-1 pb-6 pt-2">
              <p className="text-xs text-muted-foreground">
                Quanto falta para o término da sala/procedimento? O cronômetro aparece no card e conta em tempo real.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {DURACOES.map((d) => (
                  <Button key={d.min} size="sm" variant="outline"
                    onClick={() => definirTempo(alvoTempo, emMinutos(d.min))}>
                    {d.label}
                  </Button>
                ))}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ou hora exata de término
                </p>
                {/* Selects do DS (dropdown estilizado light/dark) — input time nativo abria o picker cru do browser */}
                <div className="flex items-stretch gap-2">
                  <Select className="w-40" options={HORARIOS_OPCOES}
                    value={horaExata || proximoQuartoDeHora()} onChange={setHoraExata} placeholder="Horário" />
                  <Button className="h-auto self-stretch px-4"
                    onClick={() => definirTempo(alvoTempo, horaExata || proximoQuartoDeHora())}>
                    Definir
                  </Button>
                </div>
              </div>
              {overrideDe(alvoTempo)?.termino && (
                <Button variant="ghost" className="w-full" onClick={() => definirTempo(alvoTempo, '')}>
                  Limpar cronômetro
                </Button>
              )}
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
    </div>
  )
}
