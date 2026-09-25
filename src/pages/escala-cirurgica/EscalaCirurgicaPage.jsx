/**
 * EscalaCirurgicaPage — escala cirúrgica do dia (mobile-first).
 * Data no topo · turno (matutino/vespertino) · hospital · abas internas —
 * todos com seletor segmentado (mesmo estilo do Cateter Peridural).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components'
import { WifiOff } from 'lucide-react'
import { ActionPill, EmptyState } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaDia } from '@/hooks/usePegaPlantao'
import { useEscalaCirurgica, HOSPITAIS, HOSPITAL_LABEL, hojeISO } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import svc from '@/services/supabaseEscalaCirurgicaService'
import SegmentedSelector from './SegmentedSelector'
import BarraControles from './BarraControles'
import useAgoraMinutoEscala from './useAgoraMinutoEscala'
import { minutosDoDia } from './useAgoraMinuto'
import MinhasEscalasView from './MinhasEscalasView'
import BoardView from './BoardView'
import FaixaUrgencias from './FaixaUrgencias'
import LiberacoesView from './LiberacoesView'
import ImportarEscalasPage from './ImportarEscalasPage'
import ImportarEscalaFdsPage from './ImportarEscalaFdsPage'
import TrocaSheet from './TrocaSheet'
import { meuAliasDe, turnoAtualOperacional, dataPorExtenso, estadoTrocasDoHistorico, normNome, formatData, rodapeDoTurno, localizarSlotEscala, localizarMeuPosto, planoExecucaoTroca, planoDesfazerTroca, alvoRemocaoTroca, espelhoTempoTotal, inicioDaDuracao, terminoEncadeado, turnoDoCaso } from './utils'
import { ehDataFilaUnica, ehFeriado, ehFimDeSemana, FDS_HOSPITAL, FDS_TURNO_CASOS, FDS_TURNOS, turnoFdsAtual } from '@/lib/escalaFds'
import { faseLiberacoes } from '@/lib/plantaoNoturno'
import { hospitalDaConta, podeEditarEscalaCirurgica, podePublicarEscalaCirurgica } from './gate'
import { ehContaDeHospital } from '@/utils/userTypes'

const HOSPITAL_OPCOES = HOSPITAIS.map((h) => ({ value: h, label: HOSPITAL_LABEL[h] }))
// Rótulos CURTOS (dono 16/08): "Manhã/Tarde/Noite" cabem no card a 375px —
// "Matutino/Vespertino/Noturno" cortavam com o 3º turno do fim de semana.
const TURNO_OPCOES = [
  { value: 'matutino', label: 'Manhã' },
  { value: 'vespertino', label: 'Tarde' },
]
// FIM DE SEMANA (dono 15/08 21h): a NOITE é um turno próprio, com fila de
// liberação própria (a linha 19-07HS da grade) — no dia útil ela continua
// sendo só a fase automática das 19h dentro da aba.
const TURNO_OPCOES_FDS = [
  { value: 'matutino', label: 'Manhã' },
  { value: 'vespertino', label: 'Tarde' },
  { value: 'noturno', label: 'Noite' },
]
const ABA_OPCOES = [
  { value: 'minhas', label: 'Minhas' },
  { value: 'board', label: 'Completa' },
  { value: 'liberacoes', label: 'Liberações' },
]

export default function EscalaCirurgicaPage({ onNavigate, goBack }) {
  const { user } = useUser()
  const { escalas, data, loading, erroCarga, p4Hospital, hoje, setData, recarregar, garantirEscala: garantirEscalaNoServidor, prefetch, toggleLiberacao, toggleEscalado, setLinhaOverride, adicionarAjuda, removerAjuda, reordenarAjuda, definirOrigemLinha, definirSemAjudaLinha, definirP4Hospital, setAnestesistaCasos, atualizarCaso, marcarTroca, executarSubstituicao, desfazerSubstituicao } = useEscalaCirurgica()
  // Roster p/ resolver os lados do par da troca declarada (uid/nome/apelido)
  const { resolver: resolverRoster, rosterByUid } = useRosterAnestesistas()
  // P1–P4 do dia (card Plantões/PegaPlantao) — alimentam a fase noturna das Liberações
  const { plantoes: plantoesDia } = useEscalaDia()
  const [hospital, setHospital] = useState('unimed')
  const [aba, setAba] = useState('minhas')
  const [turno, setTurno] = useState(() => (ehFimDeSemana(data) ? turnoFdsAtual(minutosDoDia()) : turnoAtualOperacional()))
  // sáb/dom é dado do CALENDÁRIO — não espera rede (ver turnoDoRelogio)
  const fimDeSemana = ehFimDeSemana(data)
  const feriado = ehFeriado(data)
  const dataFilaUnica = ehDataFilaUnica(data)
  // ── MODO FIM DE SEMANA (dono 15/08): fila de liberação ÚNICA ───────────────
  // Liga quando a data é sáb/dom E a linha 'fds' do dia está publicada. Sem ela,
  // a aba Liberações segue no comportamento por hospital (rollout seguro).
  // Fica ANTES dos efeitos de turno: no FDS o relógio decide entre 3 turnos.
  const modoFds = dataFilaUnica && escalas.fds?.status === 'publicada'
  // CABEÇALHO SEM OSCILAR (dono 29/08: "o cabeçalho de final de semana alterna
  // com o de dias úteis, mostrando abas: minhas, completa e liberações").
  // `modoFds` depende do FETCH da linha 'fds', e ao trocar de data sem cache o
  // contexto ZERA `escalas` antes de buscar — nessa janela a tela abre com as
  // abas e o seletor de hospital do dia útil e troca sozinha ~1s depois.
  //
  // Mesmo remédio do defeito irmão de 16/08 (o seletor de turno piscando de 2
  // para 3 opções): sáb/dom/feriado é dado do CALENDÁRIO e não espera rede, e é
  // ele quem decide os EIXOS enquanto a linha não chegou. Se o fetch revelar que
  // não há fila publicada, a tela cai no comportamento por hospital — uma
  // transição só, no caso raro, em vez de uma a cada abertura.
  // ⚠️ 18/09: o único eixo que ainda dependia de `chromeFilaUnica` era o seletor de
  // HOSPITAL, e ele passou a ficar nas três abas ("sem movimentar os seletores") —
  // a constante saiu; abas e turnos já vêm só do calendário (`dataFilaUnica`).
  // turno do relógio: 2 faixas no dia útil, 3 no FDS (7h/13h/19h)
  // ⚠️ Depende da DATA, não da linha 'fds' (defeito 16/08: "pisca com
  // informações antigas"). Ligar os 3 turnos ao fetch fazia a tela abrir com
  // "Manhã | Tarde" no vespertino e, ~3s depois, virar "Manhã | Tarde | Noite"
  // no noturno — dois estados visíveis para quem só queria conferir a fila.
  // Sábado e domingo são conhecidos pelo calendário: decidir por eles é
  // instantâneo e o primeiro render já sai certo.
  const turnoDoRelogio = useCallback(
    () => (fimDeSemana ? turnoFdsAtual(minutosDoDia()) : turnoAtualOperacional()),
    [fimDeSemana]
  )
  const [importando, setImportando] = useState(false)
  const [importandoFds, setImportandoFds] = useState(false) // documento de FDS (fila única)
  const [trocaSheet, setTrocaSheet] = useState(null) // { linha, colegaUid, modo } — origem do fluxo único de troca

  // Navegação de data (pedido do dono 24/07 + pesquisa NN/G: default HOJE, atalho
  // "Amanhã" só quando a de amanhã já foi PUBLICADA — nunca leva a uma tela vazia;
  // O calendário livre saiu em 16/08 (pedido do dono): a escala é operada no
  // dia e navegar para datas vazias só confundia.
  // `hoje` vem do context e AVANÇA na virada da meia-noite (antes era um useMemo
  // fixo no mount: o rótulo "Hoje" ficava colado na data de ONTEM no app aberto).
  const amanha = useMemo(() => {
    const d = new Date(`${hoje}T12:00:00`)
    d.setDate(d.getDate() + 1)
    return hojeISO(d)
  }, [hoje])
  const [amanhaPublicada, setAmanhaPublicada] = useState(false)
  useEffect(() => {
    let vivo = true
    // amanhã de sexta = sábado: a fila única (linha 'fds') também conta como publicada
    const alvos = [...HOSPITAIS, ...(ehDataFilaUnica(amanha) ? [FDS_HOSPITAL] : [])]
    Promise.all(alvos.map((h) => svc.fetchEscala(amanha, h).catch(() => null)))
      .then((rs) => {
        if (!vivo) return
        const publicada = rs.some((e) => e?.status === 'publicada')
        setAmanhaPublicada(publicada)
        // já adianta a busca: quando o usuário tocar em "Amanhã", a escala
        // aparece na hora em vez de esperar ~2,5s de rede (dono 16/08)
        if (publicada) prefetch?.(amanha)
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [amanha, prefetch])
  const modoData = data === amanha ? 'amanha' : data === hoje ? 'hoje' : 'outra'
  const opcoesData = [
    { value: 'hoje', label: 'Hoje' },
    ...((amanhaPublicada || modoData === 'amanha') ? [{ value: 'amanha', label: 'Amanhã' }] : []),
  ]

  useEffect(() => { document.title = 'Escala Cirúrgica' }, [])

  // Escolha MANUAL de turno divergente do relógio: guarda o turno do RELÓGIO
  // no momento da escolha — o automático fica pausado enquanto a faixa durar.
  const turnoManualRef = useRef(null)

  // Virou o dia: o turno volta para o do relógio. Sem isto, às 00h05 a tela do
  // dia NOVO abria no vespertino de ontem — vazio ("Nenhum caso neste turno").
  const viradaRef = useRef(hoje)
  useEffect(() => {
    if (viradaRef.current === hoje) return
    viradaRef.current = hoje
    turnoManualRef.current = null
    setTurno(turnoDoRelogio())
  }, [hoje, turnoDoRelogio])

  // TURNO ACOMPANHA O RELÓGIO (dono 15/08: "a ordem de liberações deve mudar
  // automaticamente às 7h, 13h e às 19h conforme escala"): vendo a escala de
  // HOJE, a virada das 13h troca matutino→vespertino sozinha — sem isto a fila
  // da manhã ficava na tela até alguém tocar o seletor. As 19h/23h já são
  // automáticas dentro da view (fase noturna deriva do relógio), e as 7h é a
  // virada do dia acima. Escolha manual de turno divergente pausa o automático
  // até a PRÓXIMA virada do relógio (consultar o outro turno de propósito não
  // pode ser desfeito sob o dedo); outra data nunca é mexida.
  const agoraMin = useAgoraMinutoEscala()
  useEffect(() => {
    // 'noturno' só existe no FDS: saindo dele (outra data/dia útil), a tela
    // volta para o turno do relógio em vez de ficar num turno inexistente.
    if (!fimDeSemana && turno === 'noturno') { turnoManualRef.current = null; setTurno(turnoAtualOperacional()); return }
    if (data !== hoje) return
    const atual = turnoDoRelogio()
    if (turnoManualRef.current === atual) return // escolha manual vale nesta faixa
    turnoManualRef.current = null
    if (turno !== atual) setTurno(atual)
  }, [agoraMin, data, hoje, turno, modoFds, turnoDoRelogio])
  // Toda escolha EXPLÍCITA de turno passa por aqui: divergente do relógio →
  // pausa o automático nesta faixa; igual ao relógio → automático segue.
  const escolherTurno = useCallback((t) => {
    const atual = turnoDoRelogio()
    turnoManualRef.current = t !== atual ? atual : null
    setTurno(t)
  }, [turnoDoRelogio])

  // ── TURNOS QUE A TELA OFERECE (dono 16/09) ─────────────────────────────────
  // "não quero mais que apareçam as opções de turno para clicar, quero apenas
  // que apareça o turno em curso. Ao adicionar uma nova escala ela deve aparecer
  // como opção para clicar no turno… na virada de turno a escala anterior sai,
  // exceto na transição do turno vespertino para noturno."
  //
  // PUBLICADO = a escala do turno existe em algum hospital: carimbo da RPC em
  // `publicacaoTurnos`, ou caso carimbado no turno (escala montada à mão, sem
  // RPC). No fim de semana o documento cobre o dia inteiro e a noite herda a
  // tarde — sáb/dom valem os três desde o CALENDÁRIO, sem esperar a linha 'fds'
  // (mesma razão do cabeçalho que não oscila, 29/08).
  const turnosPublicados = useMemo(() => {
    const out = new Set()
    for (const esc of Object.values(escalas)) {
      if (!esc) continue
      for (const t of ['matutino', 'vespertino']) if (esc.publicacaoTurnos?.[t]) out.add(t)
      for (const c of esc.casos || []) out.add(turnoDoCaso(c))
    }
    if (fimDeSemana && (loading || escalas.fds?.status === 'publicada')) for (const t of FDS_TURNOS) out.add(t)
    if (fimDeSemana && out.has('vespertino')) out.add('noturno')
    return out
  }, [escalas, fimDeSemana, loading])
  // Hoje: o turno EM CURSO + os turnos SEGUINTES já publicados (a escala nova
  // aparece como opção; a anterior sai na virada). Exceção vespertino→noturno:
  // a tarde FICA quando a noite entra — as cirurgias da noite são as da tarde.
  // No dia útil a noite não é turno do seletor (é a fase das 19h dentro da aba),
  // então lá a tarde já fica sozinha até virar o dia. Outra data (amanhã): o que
  // está publicado; nada publicado → a manhã, para a tela não ficar sem turno.
  // `agoraMin` entra nas deps para a lista virar junto com o relógio.
  const turnoOpcoes = useMemo(() => {
    const todas = fimDeSemana ? TURNO_OPCOES_FDS : TURNO_OPCOES
    if (data !== hoje) {
      const pub = todas.filter((o) => turnosPublicados.has(o.value))
      return pub.length ? pub : [todas[0]]
    }
    const emCurso = turnoDoRelogio()
    const i = todas.findIndex((o) => o.value === emCurso)
    const out = todas.filter((o, j) => j === i || (j > i && turnosPublicados.has(o.value)))
    if (emCurso === 'noturno' && turnosPublicados.has('vespertino')) {
      out.unshift(todas.find((o) => o.value === 'vespertino'))
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps -- agoraMin: o relógio muda a lista (turnoDoRelogio lê new Date())
  }, [fimDeSemana, data, hoje, turnoDoRelogio, turnosPublicados, agoraMin])
  // Turno fora do que a tela oferece (virou o turno com escolha manual parada,
  // mudou a data, a escala de amanhã só tem a tarde): cai no primeiro oferecido,
  // que é o em curso.
  useEffect(() => {
    if (turnoOpcoes.some((o) => o.value === turno)) return
    turnoManualRef.current = null
    setTurno(turnoOpcoes[0].value)
  }, [turnoOpcoes, turno])
  // TURNO NO SUBTÍTULO (dono 16/09: "quero que o turno válido comece a aparecer
  // aqui"). É o turno EXIBIDO — sem trilho, é o em curso. No dia útil, das 19h
  // em diante a escala da tarde segue na tela e o rótulo diz "Noite": é o turno
  // que está em curso (P1–P4 no topo da fila), e a tarde ficou de propósito.
  const rotuloTurno = useMemo(() => {
    const todas = fimDeSemana ? TURNO_OPCOES_FDS : TURNO_OPCOES
    const noiteDiaUtil = !fimDeSemana && data === hoje && turno === 'vespertino' && !(modoFds && feriado)
      && faseLiberacoes({ agoraMin, dataEscala: data, hojeIso: hoje, fds: modoFds }) !== 'dia'
    if (noiteDiaUtil) return 'Noite'
    return todas.find((o) => o.value === turno)?.label || ''
  }, [fimDeSemana, data, hoje, turno, modoFds, feriado, agoraMin])

  // Quem sou eu na escala — o apelido casa a coluna do anestesista, o uid casa o
  // vínculo (e o residente, que acompanha por `residenteUserId`).
  const meuAlias = meuAliasDe(user)
  const meuUid = user?.uid || user?.id || null

  // ── "MINHAS" LEVA ONDE EU ESTOU (dono 2026-09-09) ──────────────────────────
  // "se o usuário está escalado na unimed e clica em minhas estando o HRO
  // marcado, nada aparece. quero que ao clicar em minhas apareçam as cirurgias e
  // as marcações no cabeçalho fiquem marcadas de forma automática onde o usuário
  // está". Nada muda de layout: quem passa a dizer ONDE e QUANDO são os trilhos
  // de hospital e de turno que já existem — a aba só os move para o meu posto.
  //
  // Roda a CADA toque na aba, não uma vez por sessão: entre uma abertura e
  // outra o dia muda (assumi uma sala, virou o turno, alguém me passou um caso),
  // e uma varredura só no mount devolveria a tela vazia de novo.
  const irOndeEuEstou = useCallback(() => {
    // só os turnos que a tela oferece (dono 16/09): a escala do turno que já
    // virou saiu da tela — levar para lá seria levar a um turno que não existe
    // mais no seletor; o turno seguinte já publicado continua valendo
    const permitidos = turnoOpcoes.map((o) => o.value)
    const relogio = turnoDoRelogio()
    const posto = localizarMeuPosto({
      escalas,
      hospitais: HOSPITAIS,
      eu: { uid: meuUid, alias: meuAlias },
      turnoPreferido: permitidos.includes(relogio) ? relogio : permitidos[0],
      turnos: permitidos,
    })
    if (!posto) return false
    setHospital(posto.hospital)
    // Passa pelo `escolherTurno` de propósito: se o meu posto é no OUTRO turno,
    // o relógio fica pausado nesta faixa — senão o efeito do minuto seguinte
    // devolveria o turno em curso e as cirurgias sumiriam sob o dedo.
    // À noite do FDS as cirurgias são as da tarde: achar o posto na tarde não
    // tira a tela da noite.
    escolherTurno(turno === 'noturno' && posto.turno === 'vespertino' ? 'noturno' : posto.turno)
    return true
  }, [escalas, meuUid, meuAlias, turnoDoRelogio, escolherTurno, turnoOpcoes, turno])

  // Abertura da tela: mesma varredura, porque a aba que abre É a Minhas (pedido
  // do dono 23/07 — abria fixo em Unimed e vinha em branco p/ quem estava no
  // HRO/Materno). Uma vez, quando as escalas chegam; depois é o toque na aba.
  const autoSelRef = useRef(false)
  useEffect(() => {
    if (autoSelRef.current || loading || !user) return
    if (!HOSPITAIS.some((h) => escalas[h]?.casos?.length)) return
    irOndeEuEstou()
    autoSelRef.current = true // escalas carregaram; achando ou não, não insiste
  }, [escalas, loading, user, irOndeEuEstou])

  // CONTA DE HOSPITAL abre no hospital dela (dono 09/09) em vez do padrão fixo
  // 'unimed'. Depende da string, não do objeto `user`: um snapshot novo do
  // contexto não pode arrastar o seletor de volta debaixo de quem o tocou.
  const hospitalConta = hospitalDaConta(user)
  const contaHospitalRef = useRef(null)
  useEffect(() => {
    if (!hospitalConta || contaHospitalRef.current === hospitalConta) return
    contaHospitalRef.current = hospitalConta
    setHospital(hospitalConta)
  }, [hospitalConta])

  // A aba "Minhas" não existe para as contas de hospital (dono 09/09): elas
  // operam a escala do centro cirúrgico e não assumem sala nenhuma, então a aba
  // seria uma promessa vazia todo dia. A tela delas abre na Completa.
  // Derivado, não efeito: a conta chega do contexto DEPOIS do primeiro render, e
  // corrigir a aba por setState deixaria um quadro com a aba que não existe.
  const contaSoEscala = ehContaDeHospital(user)
  const abaOpcoes = useMemo(
    () => (contaSoEscala ? ABA_OPCOES.filter((o) => o.value !== 'minhas') : ABA_OPCOES),
    [contaSoEscala]
  )
  const abaVisivel = contaSoEscala && aba === 'minhas' ? 'board' : aba

  const escolherAba = useCallback((v) => {
    setAba(v)
    if (v === 'minhas') irOndeEuEstou()
  }, [irOndeEuEstou])


  // TROCA REMOVIDA (dono 29/07): `substituirPosicao`/`localizarPosicao` saíram
  // daqui junto com o bloco "Quem está nesta posição". Nada nesta aba altera mais
  // `ordem_liberacao` nem o dono de um caso — quem trocou escreve a OBSERVAÇÃO
  // da linha e o plantonista resolve.

  // CONTRATURNO DOS OUTROS HOSPITAIS (dono 30/07). Cada hospital tem o SEU
  // plantonista do próximo turno — o último nome do rodapé dele. Quando essa pessoa
  // também aparece AQUI (tipicamente como ajuda), quem lê a fila precisa saber que
  // ela pega o contraturno lá: no HRO de 30/07 o Fernando fechava o rodapé e na
  // Unimed aparecia só como "Ajuda", sem pista de que sairia para o plantão.
  //
  // Derivado do context (as três escalas já estão carregadas) — sem schema novo e
  // sem persistência: é a mesma ideia do cruzamento ao publicar, aplicada à fila.
  const contraturnoOutros = useMemo(() => {
    const out = []
    for (const [h, esc] of Object.entries(escalas)) {
      // 'fds' é a fila única do fim de semana, não um "outro hospital" — o
      // último nome dela não é contraturno de ninguém
      if (h === hospital || h === FDS_HOSPITAL || !esc) continue
      const rodape = rodapeDoTurno(esc.ordemLiberacao, turno)
      const ultimo = rodape[rodape.length - 1]
      if (ultimo) out.push({ nome: normNome(ultimo), hospitalLabel: HOSPITAL_LABEL[h] || h })
    }
    return out
  }, [escalas, hospital, turno])

  // casos dos 3 hospitais mesclados, cada um anotado com a origem (campo só de
  // exibição — nunca entra em CASO_FIELDS/persistência)
  const casosFds = useMemo(() => {
    if (!modoFds) return null
    const out = []
    for (const h of HOSPITAIS) {
      for (const c of escalas[h]?.casos || []) out.push({ ...c, hospitalOrigem: h })
    }
    return out
  }, [modoFds, escalas])
  // "?" resolvido pela fila única grava no CASO — que mora na escala do hospital
  // de origem, não na linha 'fds'
  const escalaDoCaso = useCallback((casoId) => {
    for (const h of HOSPITAIS) {
      if ((escalas[h]?.casos || []).some((c) => c.id === casoId)) return escalas[h]
    }
    return null
  }, [escalas])

  // DE ONDE A AJUDA SAIU (dono 31/07, recolocado em 27/08): quem está aqui de
  // ajuda libera na ORDEM DE LIBERAÇÃO DO HOSPITAL DE ORIGEM — "sempre verifique
  // de onde as ajudas saíram; se estiverem na escala de outro hospital, respeite
  // a ordem de liberação". `rodapeIdx` é a posição no rodapé de lá e é o que a
  // lib usa para ordenar a cauda da fila.
  //
  // ⚠️ A METADE DOS CASOS VOLTOU EM 30/08, COM O RECORTE QUE FALTAVA.
  // Em 04/08 (`ebfa726`) ela foi trocada por `[]` porque inferia ajuda de quem
  // simplesmente tinha cirurgia em dois hospitais no mesmo turno — falso badge.
  // O recorte que corrige isso: só entra quem NÃO tem cirurgia AQUI. Quem opera
  // nos dois trabalha nos dois e não está emprestado a lugar nenhum; quem tem
  // caso só lá está deslocado, e é disso que o dono falou ("Oscar deve permanecer
  // na lista de liberações da Unimed, ser marcado como ajuda e conter no card
  // local/cirurgia/cirurgião onde ele está").
  //
  // Com `sala` preenchido, `ajudandoFora` e `ajudaForaInfo` — desenhados em
  // 30/07 e parados desde então esperando este dado — ligam sozinhos: a pessoa
  // MANTÉM a posição de liberação daqui, ganha o badge de Ajuda, o card diz o
  // destino e ela deixa de nascer liberada (a lib carimba `teveCasos`).
  const presencaOutros = useMemo(() => {
    const out = []
    // quem tem cirurgia AQUI não está emprestado — trabalha aqui também
    const daquiComCaso = new Set()
    for (const c of escalas[hospital]?.casos || []) {
      if ((c.turno || turno) !== turno) continue
      const n = normNome(c.anestesista || '')
      if (n) daquiComCaso.add(n)
    }
    for (const [h, esc] of Object.entries(escalas)) {
      // 'fds' é a fila única do fim de semana, não um "outro hospital"
      if (h === hospital || h === FDS_HOSPITAL || !esc) continue
      const label = HOSPITAL_LABEL[h] || h
      rodapeDoTurno(esc.ordemLiberacao, turno).forEach((n, i) => {
        const nm = normNome(n)
        if (nm) out.push({ nome: nm, uid: null, hospital: h, hospitalLabel: label, rodapeIdx: i })
      })
      // AJUDA DECLARADA lá (dono 31/08 — caso Eduardo): quem está na
      // ajuda_externa de OUTRO hospital foi ajudar lá, com ou sem caso lá — no
      // Materno, que publica sem rodapé e às vezes sem casos, a declaração é o
      // ÚNICO sinal. A fila daqui mostra o badge para informação do plantão;
      // a posição daqui não muda.
      for (const n of rodapeDoTurno(esc.ajudaExterna, turno)) {
        const nm = normNome(n)
        if (nm) out.push({ nome: nm, uid: null, hospital: h, hospitalLabel: label, ajudaDeclarada: true })
      }
      for (const c of esc.casos || []) {
        if ((c.turno || turno) !== turno) continue
        const bruto = String(c.anestesista || '').trim()
        if (!bruto || bruto === '//' || /^\?+$/.test(bruto)) continue
        const nm = normNome(bruto)
        if (!nm || daquiComCaso.has(nm)) continue
        out.push({
          nome: nm, uid: c.anestesistaUserId || null, hospital: h, hospitalLabel: label,
          // procedimento junto: sem cirurgião (C.O, exames) é ele que diz o que a
          // pessoa faz lá (dono 16/09, caso Rômulo)
          sala: c.sala || '', cirurgiao: c.cirurgiao || '', procedimento: c.procedimento || '',
        })
      }
    }
    return out
  }, [escalas, hospital, turno])

  // ── TROCA DECLARADA (dono 30/07) — pares das 3 escalas + planos de execução ──
  // Mesmo padrão de contraturnoOutros/presencaOutros: o context já carrega as três
  // escalas; o par atravessa hospitais por DERIVAÇÃO (registro único, sem dual-write).
  const pessoaDe = useCallback((uid, nomeFallback) => {
    const r = uid ? rosterByUid.get(uid) : null
    if (r) return { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || String(r.nome || '').trim().split(/\s+/)[0]?.toUpperCase() || '' }
    return { uid: uid || null, nome: nomeFallback || '', apelido: String(nomeFallback || '').trim().split(/\s+/)[0]?.toUpperCase() || '' }
  }, [rosterByUid])

  const paresTroca = useMemo(() => {
    const out = []
    // onde a pessoa do par está — rodapé OU cirurgias (o Materno sai sem rodapé
    // e o colega de lá aparecia como se não estivesse em lugar nenhum)
    const slotLabelDe = (p) => {
      for (const [h2, e2] of Object.entries(escalas)) {
        if (h2 === FDS_HOSPITAL || !e2) continue // fila única não é "onde a pessoa está"
        if (localizarSlotEscala(e2, p, resolverRoster, turno)) return HOSPITAL_LABEL[h2] || h2
      }
      return null
    }
    for (const [h, esc] of Object.entries(escalas)) {
      // linha 'fds' fora: troca declarada não existe no modo FDS (escopo 15/08)
      if (!esc || h === FDS_HOSPITAL) continue
      for (const [rawChave, ov] of Object.entries(esc.linhaOverrides || {})) {
        const prefixo = `${turno}:`
        if (!String(rawChave).startsWith(prefixo)) continue
        const chave = String(rawChave).slice(prefixo.length)
        const t = ov?.trocaCom
        if (!t?.uid && !t?.nome) continue
        // lado A = dono da linha onde a troca foi declarada (chave = uid ou nome norm.)
        const aUid = rosterByUid.has(chave) ? chave : (resolverRoster(chave) || null)
        const a = pessoaDe(aUid, chave)
        const b = pessoaDe(t.uid, t.nome)
        out.push({
          hospital: h, hospitalLabel: HOSPITAL_LABEL[h] || h, escalaId: esc.id, chave,
          // colega fora de qualquer escala (consultório/folga): o local declarado
          // no sheet ocupa o lugar do hospital que não existe
          // o local INFORMADO na troca vem primeiro (dono 16/08: "quero que
          // informe entre parênteses quando informado") — quem digitou
          // "Consultório" sabe algo que a escala não mostra
          a, b, aHospitalLabel: slotLabelDe(a), bHospitalLabel: t.local || slotLabelDe(b) || null,
          tipo: t.tipo || null, motivo: t.motivo || null, local: t.local || null,
          // registro de troca JÁ refletida na escala publicada (dono 10/08):
          // vira badge, nunca oferta de "executar" — não há o que mover
          apenasRegistro: !!t.apenasRegistro,
        })
      }
      // Rastro de swaps EXECUTADOS (6e99f68): mesmo após desfazer/republicar, o
      // caso encerrado não perde quem o executou. O helper reduz o histórico e
      // NUNCA deriva par do eixo de declaração — `troca_desfeita` ressuscitava
      // badge e oferecia "Executar" de novo (defeito D1, 07/08). Par `historica`
      // é exibição/telemetria: trocaDe() na view o ignora para ação.
      for (const { chave, detalhe } of estadoTrocasDoHistorico(esc.trocasHistorico, turno)) {
        const aUid = rosterByUid.has(chave) ? chave : (resolverRoster(chave) || null)
        const a = pessoaDe(aUid, chave)
        const b = pessoaDe(detalhe.uid, detalhe.nome)
        // dedup contra o par vivo: por uid quando há, por nome quando não — dois
        // pares distintos com uid null não podem colapsar num só (defeito D9)
        const mesmoB = (p) => (p.b.uid || b.uid) ? p.b.uid === b.uid : normNome(p.b.nome) === normNome(b.nome)
        if (out.some((p) => p.hospital === h && p.chave === chave && mesmoB(p))) continue
        out.push({
          hospital: h, hospitalLabel: HOSPITAL_LABEL[h] || h, escalaId: esc.id, chave,
          a, b, aHospitalLabel: slotLabelDe(a), bHospitalLabel: slotLabelDe(b), historica: true,
        })
      }
    }
    return out
  }, [escalas, rosterByUid, resolverRoster, pessoaDe, turno])

  // Escala do hospital + turno de CASOS ('noturno' é turno da FILA; o CHECK do
  // banco só aceita matutino/vespertino, e à noite valem as cirurgias da tarde)
  const escalaDoHospital = escalas[hospital]
  const turnoDeCasos = FDS_TURNO_CASOS[turno] || turno
  // ⚠️ NAMESPACE DA MARCAÇÃO ≠ TURNO DOS CASOS. `turnoDeCasos` responde "de qual
  // turno são as cirurgias" (a noite lê as da tarde) e é isso que alimenta
  // publicação e casos. Já a CHAVE de `linha_overrides` tem de ser a do turno
  // EXIBIDO: `chaveTurno` não prefixa 'noturno', e o card noturno já vem com a
  // chave 'noite:' — gravar com o prefixo da tarde punha a assunção da noite
  // numa chave que a tela da noite nunca lê (e que a tarde leria). Nos turnos de
  // dia os dois são o mesmo valor, então isto não muda nada lá.
  const turnoDaMarcacao = turno

  /**
   * Devolve a escala do hospital selecionado, CRIANDO uma vazia se ainda não
   * existir (dono 16/08: "mesmo sem casos publicados adicione a opção de
   * adicionar caso e ajuda" — o Materno costuma não ter escala importada e
   * ficava sem nenhuma ação disponível).
   * ⚠️ Só cria quando o SERVIDOR confirma que não há escala (revisão 23/09):
   * publicar por cima de uma existente apagaria o turno, e `null` na tela pode
   * ser só uma leitura que falhou.
   */
  const garantirEscala = useCallback(async () => {
    if (escalaDoHospital?.id && !String(escalaDoHospital.id).startsWith('demo-')) return escalaDoHospital
    // publicação vai no turno de CASOS: o CHECK do banco só aceita
    // matutino/vespertino, e 'noturno' não é turno de publicação
    return garantirEscalaNoServidor({ data, hospital, turno: turnoDeCasos },
      { userId: user?.uid || user?.id || null, userName: user?.displayName })
  }, [escalaDoHospital, data, hospital, turnoDeCasos, garantirEscalaNoServidor, user])

  if (!user) return null

  const canEdit = podeEditarEscalaCirurgica(user)
  // Importar = PUBLICAR (dono 08/09). `func-unimed` opera o dia inteiro mas não
  // troca a escala publicada: o pill some para ela, e a RPC recusaria de todo jeito.
  const canPublicar = podePublicarEscalaCirurgica(user)
  const escala = escalaDoHospital
  // a escala que a aba visível lê: na fila única do FDS, a linha 'fds'
  const chaveCarga = abaVisivel === 'liberacoes' && modoFds ? 'fds' : hospital
  const semDadoAinda = !escalas[chaveCarga] && (loading || !!erroCarga?.[chaveCarga])
  const erroAqui = !!erroCarga?.[chaveCarga]
  const turnoCasos = turnoDeCasos

  const userInfo = { userId: meuUid, userName: user?.displayName }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Escala Cirúrgica"
        // Subtítulo = DATA da escala (dono 16/08). Hospital e turno saíram
        // daqui: os botões logo abaixo já dizem, e a data não estava em lugar
        // nenhum depois que o botão "Hoje" deixou de aparecer sozinho.
        // …e o TURNO exibido voltou ao subtítulo em 16/09 (dono: "quero que o
        // turno válido comece a aparecer aqui"), porque o trilho de turno só
        // existe quando há mais de um para escolher.
        subtitle={[dataPorExtenso(data, hoje), rotuloTurno].filter(Boolean).join(' · ')}
        onBack={goBack}
        actions={
          canPublicar ? (
            // O atalho de VÍNCULOS saiu do header (dono 16/08): é manutenção de
            // dicionário, não operação do plantão. A tela de vínculos segue
            // existindo (VinculosSheet) para ser religada onde fizer sentido.
            // Pill modelo "Extrato" nos DOIS modos (dono 31/08) — substitui o
            // par ghost-com-ícone (dia útil) / outline (FDS) de 24/08.
            <ActionPill
              // toque de 44px sem mudar o pill (revisão 23/09): ele mede ~21px de altura
              className="relative after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']" onClick={() => feriado ? setImportandoFds(true) : setImportando(true)} aria-label="Importar escala">
              Importar
            </ActionPill>
          ) : null
        }
      />

      {/* deitado: sem o teto de largura (dono 26/08). Ele centraliza a coluna em
          720px e sobra 24px de cada lado; na horizontal esses 48px são a diferença
          entre duas colunas de 338px (mais estreitas que os 343px do retrato, onde
          o nome do plantonista já trunca no pior caso) e duas de 362px. Espaçamento
          vertical mais curto pela mesma razão: altura é o que falta. */}
      <div className="max-w-3xl deitado:max-w-none mx-auto px-4 faixa:px-3 pt-3 faixa:pt-1.5 space-y-3 deitado:space-y-2">
        {/* Barra de controles (data · turno · hospital · abas · ações).
            O CALENDÁRIO LIVRE ("Outra data") SAIU em 16/08, a pedido do dono —
            também no dia útil: a escala é operada no dia, e o atalho abria a
            porta para consultar datas vazias. Publicar noutra data continua
            possível pela importação, que tem calendário próprio. */}
        <BarraControles
          opcoesData={opcoesData}
          modoData={modoData}
          onEscolherData={(v) => {
            if (v === 'amanha') { setData(amanha); setTurno('matutino') } // manhã seguinte
            else setData(hoje)
          }}
          turnoOpcoes={turnoOpcoes}
          turno={turno}
          onEscolherTurno={escolherTurno}
          // AS ABAS VOLTARAM AO FIM DE SEMANA (dono 13/09: "quero que mostre a
          // escala completa, dividida por hospitais, como é mostrado em dias
          // úteis, mas mantenha a liberação única"). A tela única de 24/08 tirava
          // abas e hospital; o que sobrevive dela é a FILA: nas Liberações do
          // sáb/dom/feriado a fila é única e cobre os três, então o seletor de
          // hospital não filtraria nada e some SÓ nessa aba (B1, escolhido em
          // protótipo contra B2 = hospital sempre). Minhas e Completa filtram por
          // hospital como num dia útil. Decidido pelo CALENDÁRIO + aba, não pelo
          // fetch — o cabeçalho continua sem oscilar (29/08).
          // ⚠️ 18/09 (dono, com a foto da barra): "mantenha essa estrutura nos finais
          // de semana, quando clicar em liberações mostre a fila única (sem movimentar
          // os seletores)". O B1 de 13/09 tirava o seletor de hospital só nessa aba, e
          // a barra encolhia e voltava a cada troca de aba. Agora a barra é a mesma
          // nas três abas; nas Liberações do fim de semana o hospital escolhido segue
          // valendo para Minhas/Completa e a fila continua única, ignorando-o.
          hospitalOpcoes={HOSPITAL_OPCOES}
          hospital={hospital}
          onEscolherHospital={setHospital}
          abaOpcoes={abaOpcoes}
          aba={abaVisivel}
          onEscolherAba={escolherAba}
        />

        {/* Aterrissou noutra data (ex.: publicou pela importação): rótulo + volta */}
        {modoData === 'outra' && (
          <p className="rounded-lg bg-warning/10 px-3 py-1.5 text-xs text-warning">
            Vendo {formatData(data)} — <button type="button" className="font-semibold underline" onClick={() => setData(hoje)}>voltar para hoje</button>
          </p>
        )}

        {/* Botão de demonstração EXCLUÍDO (pedido do dono 23/07) — a fixture demo
            segue existindo SÓ em DEV (base determinística dos e2e). */}
        {escala?.id?.startsWith('demo-') && (
          <p className="rounded-lg bg-warning/10 text-warning text-xs px-3 py-2">
            Demonstração — alterações (liberar/reordenar) não são salvas.
          </p>
        )}

        <div className="pt-1">
          {/* SEM DADO AINDA ≠ SEM ESCALA (revisão 23/09): enquanto a primeira leitura
              não chega, a tela mostra só o "Carregando…" — o EmptyState "Sem escala
              publicada" aparecia junto e quem estava no 4G fechava o app. Leitura que
              FALHOU diz que falhou, com saída. */}
          {semDadoAinda ? (
            erroAqui && !loading ? (
              <EmptyState
                icon={<WifiOff className="w-6 h-6" />}
                title="Não foi possível carregar a escala"
                description="Verifique a conexão. Nada foi alterado."
                action={{ label: 'Tentar de novo', onClick: recarregar }}
              />
            ) : null
          ) : (<>
          {/* Minhas e Completa também no fim de semana (dono 13/09) — por hospital,
              como num dia útil; só a Faixa de Urgências fica de fora do FDS. */}
          {abaVisivel === 'minhas' && (
            <MinhasEscalasView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turnoCasos} onVerBoard={() => setAba('board')} />
          )}
          {abaVisivel === 'board' && (
            <>
              {/* Urgências do HRO (dono 18/08): ocupação das 2 salas do contrato +
                  fila. FORA da BoardView de propósito — os EmptyStates dela matariam
                  a faixa no dia sem escala publicada com urgência à mão. */}
              {!modoFds && (
                <FaixaUrgencias escala={escala} hospital={hospital} turno={turnoCasos} />
              )}
              <BoardView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turnoCasos} onNavigate={onNavigate} />
            </>
          )}
          {abaVisivel === 'liberacoes' && (() => {
            // MODO FDS: a view opera sobre a linha 'fds' (fila única + marcações)
            // e os casos mesclados dos 3 hospitais; troca/P4-coringa ficam fora.
            const escalaLib = modoFds ? escalas.fds : escala
            return (
              <>
                {dataFilaUnica && !modoFds && canEdit && (
                  <p className="mb-3 rounded-lg bg-info/10 px-3 py-2 text-xs text-info">
                    {feriado
                      ? 'Feriado: importe a lista e os mapas cirúrgicos para criar a fila única de todos os hospitais.'
                      : 'Fim de semana: importe o documento de FDS (grade P1–P4 + ordem de liberação) para a fila única de todos os hospitais. Sem ele, a fila segue por hospital.'}
                  </p>
                )}
                <LiberacoesView
                  escala={escalaLib}
                  hospital={modoFds ? FDS_HOSPITAL : hospital}
                  hospitalLabel={modoFds ? (feriado ? 'Feriado' : 'Fim de semana') : HOSPITAL_LABEL[hospital]}
                  canEdit={canEdit}
                  turno={turno}
                  plantoes={plantoesDia}
                  // quem sou eu: a aba precisa saber se ESTE usuário é o
                  // plantonista do turno — só ele avisa a equipe (dono 17/08)
                  meuUid={meuUid}
                  meuAlias={meuAlias}
                  meuNome={user?.displayName || ''}
                  p4Hospital={p4Hospital}
                  modoFds={modoFds}
                  casosFds={casosFds}
                  fdsMeta={modoFds ? escalas.fds?.fdsMeta || null : null}
                  // urgência/encaixe entra na escala do HOSPITAL selecionado
                  // (a fila do FDS é única, mas o caso pertence a um hospital)
                  escalaCasoNovo={escala}
                  onGarantirEscala={garantirEscala}
                  onNavigate={onNavigate}
                  onDefinirP4={modoFds ? undefined : (h) => definirP4Hospital(h, userInfo)}
                  onDefinirCasos={(casoIds, { uid, apelido, rotulo }) => {
                    // na fila única o caso pertence à escala do hospital de origem
                    const dona = modoFds ? escalaDoCaso(casoIds[0]) || escala : escala
                    return setAnestesistaCasos(dona, casoIds, { uid, apelido }, { rotulo, resolverUid: resolverRoster, userId: user?.uid || user?.id || null })
                  }}
                  // RESPONSÁVEL DA POSIÇÃO (dono 24/08) — assunção unilateral na
                  // fila única: o slot fica com quem assumiu, a posição e a ordem
                  // não se movem, e as cirurgias em aberto vão junto. Mesmo motor
                  // do "Assumir também a posição" do dia útil.
                  onTrocarResponsavel={modoFds ? (({ chaveSlot, nomeSlot, de, para, casoIds }) =>
                    executarSubstituicao({
                      lados: [{
                        hospital: FDS_HOSPITAL, escalaId: escalaLib.id, turno: turnoDaMarcacao,
                        chaveSlot, nomeSlot, tipo: 'assuncao', de, para, casoIds,
                      }],
                      limparTroca: [],
                    }, userInfo)) : undefined}
                  // DEVOLVER a posição: o mesmo desfazer do dia útil, montado à
                  // mão porque na fila única não há PAR — é assunção de um lado só.
                  // Os casos a devolver saem do recibo `assumidaPor.casoIds`
                  // (incidente 10/08: sem ele o desfazer devolvia todos os casos
                  // abertos do assumente, inclusive os que nunca saíram do lugar).
                  onDevolverResponsavel={modoFds ? ((linha) => desfazerSubstituicao({
                    lados: [{
                      hospital: FDS_HOSPITAL, escalaId: escalaLib.id, turno: turnoDaMarcacao,
                      chaveSlot: linha.chave,
                      casoIds: linha.assumida?.casoIds || [],
                      // `para` no desfazer é para QUEM os casos voltam: o dono
                      // original do slot. Sem uid não há a quem devolver e o
                      // context deixa os casos onde estão (avisa no toast).
                      para: linha.assumida?.deUid ? {
                        uid: linha.assumida.deUid,
                        nome: linha.assumida.deNome || '',
                        apelido: linha.assumida.deNomeOriginal || linha.assumida.deNome || '',
                      } : null,
                    }],
                  }, userInfo)) : undefined}
                  // TROCAR DE POSIÇÃO: dois lados cruzados numa transação só —
                  // ou os dois assumem, ou nenhum (rollback LIFO do context).
                  onTrocarPosicao={modoFds ? ((lados) => executarSubstituicao({
                    lados: lados.map((l) => ({
                      ...l, hospital: FDS_HOSPITAL, escalaId: escalaLib.id,
                      turno: turnoDaMarcacao, tipo: 'posicoes',
                    })),
                    limparTroca: [],
                  }, userInfo)) : undefined}
                  onToggle={(anest, opts) => toggleLiberacao(escalaLib, anest, userInfo, turno, opts)}
                  onToggleEscalado={(anest) => toggleEscalado(escalaLib, anest, userInfo, turno)}
                  onSetOverride={(anest, override) => setLinhaOverride(escalaLib, anest, override, userInfo, turno)}
                  // ESPELHO INVERSO DO TEMPO (dono 14/09): a pílula do total, com
                  // UMA só cirurgia aberta, grava também o término dela. O caso
                  // mora na escala do hospital (na fila única, não na linha 'fds').
                  // Silencioso: a pílula já pintou; "Caso atualizado" seria ruído.
                  onDefinirTerminoCaso={async (casoId, hhmmEscolhido, meta) => {
                    const dona = modoFds ? escalaDoCaso(casoId) || escala : escala
                    const alvo = (dona?.casos || []).find((c) => c.id === casoId)
                    // DURAÇÃO numa cirurgia que ainda não começou vale DEPOIS da anterior
                    // (dono 14/09) — mesma regra do detalhe do caso; hora exata passa como veio
                    const agoraD = new Date()
                    const hhmm = meta?.minutos && alvo
                      ? (terminoEncadeado(dona, alvo, meta.minutos, agoraD.getHours() * 60 + agoraD.getMinutes()) || hhmmEscolhido)
                      : hhmmEscolhido
                    await atualizarCaso(dona, casoId, { terminoPrevisto: hhmm || null }, { silencioso: true })
                    // ESPELHO no total da pessoa (30/07 para uma cirurgia; 14/09 a soma quando
                    // todas têm término) — o MESMO helper do detalhe do caso, para as três
                    // abas gravarem a mesma coisa. Vindo da pílula (uma cirurgia) o valor já
                    // é igual e o helper devolve null — sem ida e volta.
                    const esp = alvo && !String(dona?.id || '').startsWith('demo-')
                      ? espelhoTempoTotal(dona, alvo, hhmm || '', { hospitalLabels: HOSPITAL_LABEL }) : null
                    if (esp) await setLinhaOverride(dona, { chave: esp.chave, anestesista: esp.nome }, esp.override, userInfo, turno)
                  }}
                  // DE ONDE CONTA A DURAÇÃO de uma cirurgia (dono 25/09): a folha do tempo
                  // total diz, antes do toque, que "1h" numa cirurgia que ainda não começou
                  // vale depois da anterior — pela MESMA escala dona e a MESMA função que o
                  // handler acima usa para gravar, senão a frase e o valor discordariam.
                  inicioDuracaoCaso={(casoId, agoraMin) => {
                    const dona = modoFds ? escalaDoCaso(casoId) || escala : escala
                    const alvo = (dona?.casos || []).find((c) => c.id === casoId)
                    return alvo && agoraMin != null ? inicioDaDuracao(dona, alvo, agoraMin) : null
                  }}
                  onAddAjuda={(nome) => adicionarAjuda(escalaLib, turno, nome)}
                  onReordenarAjuda={(de, para) => reordenarAjuda(escalaLib, turno, de, para)}
                  /* DE ONDE A AJUDA VEIO (dono 27/08) — informado à mão quando o
                     hospital de origem não tem escala publicada (o Materno). */
                  onDefinirOrigem={(linha, origem) => definirOrigemLinha(escalaLib, linha, origem, userInfo, turno)}
                  /* "NÃO É AJUDA" (dono 14/09): desfaz o badge DERIVADO com uma
                     declaração persistida na linha; null volta ao automático. */
                  onDefinirSemAjuda={(linha, valor) => definirSemAjudaLinha(escalaLib, linha, valor, userInfo, turno)}
                  contraturnoOutros={modoFds ? [] : contraturnoOutros}
                  // fila única: os três hospitais estão nela — não há "outro" (dono 05/09)
                  presencaOutros={modoFds ? [] : presencaOutros}
                  paresTroca={modoFds ? [] : paresTroca}
                  onMarcarTroca={modoFds ? undefined : (linha, colega, par) => {
                    // REMOVER mira onde a declaração MORA, não a linha da tela
                    // (incidente 18/08 — ver alvoRemocaoTroca). Chave CRUA como
                    // string: linhaDe() a usa como chave E nome, sem inventar
                    // chave legada que apontaria para outra entrada.
                    const alvo = colega ? null : alvoRemocaoTroca(escalas, par)
                    if (alvo) return marcarTroca(alvo.escala, alvo.chave, null, userInfo, turno)
                    return marcarTroca(escala, linha, colega, userInfo, turno)
                  }}
                  onAbrirTroca={modoFds ? undefined : (linha, colegaUid = null, modo = 'registro') => setTrocaSheet({ linha, colegaUid, modo })}
                  onExecutarTroca={modoFds ? undefined : (par) => {
                    // âncora = a escala onde a declaração vive (mesma regra do sheet)
                    const plan = planoExecucaoTroca({ escalas, resolverUid: resolverRoster, a: par.a, b: par.b, turno, escalaAncora: par.escalaId || null })
                    // tipo/motivo declarados viajam para o assumidaPor na execução
                    const meta = { ...(par.tipo && { tipo: par.tipo }), ...(par.motivo && { motivo: par.motivo }) }
                    return executarSubstituicao({ ...plan, lados: plan.lados.map((l) => ({ ...l, ...meta })) }, userInfo)
                  }}
                  onDesfazerSubstituicao={modoFds ? undefined : (linha) =>
                    desfazerSubstituicao(planoDesfazerTroca({
                      escalas, resolverUid: resolverRoster, turno,
                      a: pessoaDe(linha.uid, linha.anestesista),
                      // nome CRU do rodapé, nunca o display (defeito D8): o plano
                      // casa o dono por normNome e o display curto não bate com o
                      // cadastro — o desfazer degradava p/ "só posição"
                      b: pessoaDe(linha.assumida?.deUid, linha.assumida?.deNomeOriginal || linha.assumida?.deNome),
                    }), userInfo)}
                  onRemoveAjuda={(nome) => removerAjuda(escalaLib, turno, nome)}
                />
              </>
            )
          })()}
          </>)}
        </div>

        {loading && <p className="text-center text-sm text-muted-foreground py-4">Carregando…</p>}
      </div>

      {/* FLUXO ÚNICO de troca (dono 07/08): troca nova passa sempre por aqui —
          uma decisão por posição (fica/assume) + tipo + motivo. As posições vêm
          das 3 escalas do context; a `escala` da tela é onde o registro sem
          movimento é gravado (trocaCom na linha de origem). */}
      {trocaSheet && (
        <TrocaSheet
          linha={trocaSheet.linha}
          colegaInicial={trocaSheet.colegaUid}
          modo={trocaSheet.modo}
          escala={escala}
          turno={turno}
          onClose={() => setTrocaSheet(null)}
        />
      )}

      {importando && (
        <ImportarEscalasPage
          hospital={hospital}
          data={data}
          turno={turno}
          onAbrirFds={(dataAlvo) => {
            if (dataAlvo) setData(dataAlvo)
            setImportando(false)
            setImportandoFds(true)
          }}
          onClose={(publicado) => {
            setImportando(false)
            // Publicou noutra data/hospital/período? Aterrissa exatamente na escala publicada.
            if (publicado?.data) setData(publicado.data)
            if (publicado?.hospital) setHospital(publicado.hospital)
            if (publicado?.turno) escolherTurno(publicado.turno)
          }}
        />
      )}

      {importandoFds && (
        <ImportarEscalaFdsPage
          data={data}
          onClose={(publicado) => {
            setImportandoFds(false)
            // aterrissa no sábado publicado, já na fila única
            if (publicado?.data) { setData(publicado.data); setAba('liberacoes') }
          }}
        />
      )}
    </div>
  )
}
