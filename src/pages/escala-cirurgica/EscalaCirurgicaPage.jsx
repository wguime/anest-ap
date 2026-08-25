/**
 * EscalaCirurgicaPage — escala cirúrgica do dia (mobile-first).
 * Data no topo · turno (matutino/vespertino) · hospital · abas internas —
 * todos com seletor segmentado (mesmo estilo do Cateter Peridural).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { PageHeader } from '@/components'
import { Button } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaDia } from '@/hooks/usePegaPlantao'
import { useEscalaCirurgica, HOSPITAIS, HOSPITAL_LABEL, hojeISO } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import svc from '@/services/supabaseEscalaCirurgicaService'
import SegmentedSelector from './SegmentedSelector'
import BarraControles from './BarraControles'
import useAgoraMinuto from './useAgoraMinuto'
import MinhasEscalasView from './MinhasEscalasView'
import BoardView from './BoardView'
import FaixaUrgencias from './FaixaUrgencias'
import LiberacoesView from './LiberacoesView'
import ImportarEscalaPage from './ImportarEscalaPage'
import ImportarEscalaFdsPage from './ImportarEscalaFdsPage'
import TrocaSheet from './TrocaSheet'
import { meuAliasDe, turnoAtual, casosResolvidos, dataPorExtenso, estadoTrocasDoHistorico, filtrarPorTurnoExibicao, normNome, formatData, rodapeDoTurno, localizarSlotEscala, planoExecucaoTroca, planoDesfazerTroca, alvoRemocaoTroca } from './utils'
import { ehFimDeSemana, FDS_HOSPITAL, FDS_TURNO_CASOS, turnoFdsAtual } from '@/lib/escalaFds'
import { podeEditarEscalaCirurgica } from './gate'

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
  const { escalas, data, loading, p4Hospital, hoje, setData, prefetch, salvarEscalaTurno, toggleLiberacao, toggleEscalado, setLinhaOverride, adicionarAjuda, removerAjuda, reordenarAjuda, definirP4Hospital, setAnestesistaCasos, marcarTroca, executarSubstituicao, desfazerSubstituicao } = useEscalaCirurgica()
  // Roster p/ resolver os lados do par da troca declarada (uid/nome/apelido)
  const { resolver: resolverRoster, rosterByUid } = useRosterAnestesistas()
  // P1–P4 do dia (card Plantões/PegaPlantao) — alimentam a fase noturna das Liberações
  const { plantoes: plantoesDia } = useEscalaDia()
  const [hospital, setHospital] = useState('unimed')
  const [aba, setAba] = useState('minhas')
  const [turno, setTurno] = useState(() => turnoAtual())
  // sáb/dom é dado do CALENDÁRIO — não espera rede (ver turnoDoRelogio)
  const fimDeSemana = ehFimDeSemana(data)
  // ── MODO FIM DE SEMANA (dono 15/08): fila de liberação ÚNICA ───────────────
  // Liga quando a data é sáb/dom E a linha 'fds' do dia está publicada. Sem ela,
  // a aba Liberações segue no comportamento por hospital (rollout seguro).
  // Fica ANTES dos efeitos de turno: no FDS o relógio decide entre 3 turnos.
  const modoFds = fimDeSemana && escalas.fds?.status === 'publicada'
  // turno do relógio: 2 faixas no dia útil, 3 no FDS (7h/13h/19h)
  // ⚠️ Depende da DATA, não da linha 'fds' (defeito 16/08: "pisca com
  // informações antigas"). Ligar os 3 turnos ao fetch fazia a tela abrir com
  // "Manhã | Tarde" no vespertino e, ~3s depois, virar "Manhã | Tarde | Noite"
  // no noturno — dois estados visíveis para quem só queria conferir a fila.
  // Sábado e domingo são conhecidos pelo calendário: decidir por eles é
  // instantâneo e o primeiro render já sai certo.
  const turnoDoRelogio = useCallback(
    () => (fimDeSemana ? turnoFdsAtual(new Date().getHours() * 60 + new Date().getMinutes()) : turnoAtual()),
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
    const alvos = [...HOSPITAIS, ...(ehFimDeSemana(amanha) ? [FDS_HOSPITAL] : [])]
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
  const agoraMin = useAgoraMinuto()
  useEffect(() => {
    // 'noturno' só existe no FDS: saindo dele (outra data/dia útil), a tela
    // volta para o turno do relógio em vez de ficar num turno inexistente.
    if (!fimDeSemana && turno === 'noturno') { turnoManualRef.current = null; setTurno(turnoAtual()); return }
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

  // Abre já no hospital+turno onde o usuário está escalado (pedido do dono 23/07:
  // abria fixo em Unimed/Minhas e vinha em branco p/ quem estava no HRO/Materno).
  // Uma vez, quando as escalas carregam; prefere o turno atual; não sobrescreve
  // escolha manual depois.
  const autoSelRef = useRef(false)
  useEffect(() => {
    if (autoSelRef.current || loading || !user) return
    const uid = user.uid || user.id
    const alvo = normNome(meuAliasDe(user))
    // residente acompanha por uid (dono 29/07) — abre no hospital dele também
    const temCaso = (e, t) => filtrarPorTurnoExibicao(casosResolvidos(e), t).some(
      (c) => c.residenteUserId === uid
        || (c.anestesistaUserId ? c.anestesistaUserId === uid : (alvo && normNome(c.anestesista) === alvo))
    )
    const tNow = turnoAtual()
    const carregou = HOSPITAIS.some((h) => escalas[h]?.casos?.length)
    if (!carregou) return
    for (const h of HOSPITAIS) {
      if (!escalas[h]?.casos?.length) continue
      for (const t of [tNow, tNow === 'matutino' ? 'vespertino' : 'matutino']) {
        if (temCaso(escalas[h], t)) { setHospital(h); escolherTurno(t); autoSelRef.current = true; return }
      }
    }
    autoSelRef.current = true // escalas carregaram mas o user não está em nenhuma
  }, [escalas, loading, user])


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

  // Não inferimos ajuda apenas porque um nome aparece em outra escala. Uma
  // pessoa pode estar escalada simultaneamente em hospitais diferentes, e essa
  // inferência gerava falsos badges de "Ajuda". Ajuda só entra por
  // `ajuda_externa[turno]` (publicação/importação) ou marcação manual.
  const presencaOutros = useMemo(() => [], [])

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

  /**
   * Devolve a escala do hospital selecionado, CRIANDO uma vazia se ainda não
   * existir (dono 16/08: "mesmo sem casos publicados adicione a opção de
   * adicionar caso e ajuda" — o Materno costuma não ter escala importada e
   * ficava sem nenhuma ação disponível).
   * ⚠️ Só cria quando NÃO há escala: publicar por cima de uma existente
   * apagaria o rodapé do turno (a RPC substitui `ordem_liberacao`).
   */
  const garantirEscala = useCallback(async () => {
    if (escalaDoHospital?.id && !String(escalaDoHospital.id).startsWith('demo-')) return escalaDoHospital
    return salvarEscalaTurno({
      data, hospital, turno: turnoDeCasos,
      casos: [], ordemLiberacao: [], ajudaExterna: [], status: 'publicada',
    }, { userId: user?.uid || user?.id || null, userName: user?.displayName })
  }, [escalaDoHospital, data, hospital, turnoDeCasos, salvarEscalaTurno, user])

  if (!user) return null

  const canEdit = podeEditarEscalaCirurgica(user)
  const escala = escalaDoHospital
  const turnoCasos = turnoDeCasos

  const meuAlias = meuAliasDe(user)
  const meuUid = user?.uid || user?.id
  const userInfo = { userId: meuUid, userName: user?.displayName }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Escala Cirúrgica"
        // Subtítulo = DATA da escala (dono 16/08). Hospital e turno saíram
        // daqui: os botões logo abaixo já dizem, e a data não estava em lugar
        // nenhum depois que o botão "Hoje" deixou de aparecer sozinho.
        subtitle={dataPorExtenso(data, hoje)}
        onBack={goBack}
        actions={
          canEdit ? (
            // O atalho de VÍNCULOS saiu do header (dono 16/08): é manutenção de
            // dicionário, não operação do plantão. A tela de vínculos segue
            // existindo (VinculosSheet) para ser religada onde fizer sentido.
            // ⚠️ o outline sem ícone é do protótipo do FIM DE SEMANA (dono
            // 24/08, 2ª mensagem): no dia útil o botão volta ao ghost com o
            // ícone, como está desde o começo.
            <Button size="sm" variant={modoFds ? 'outline' : 'ghost'} onClick={() => setImportando(true)} aria-label="Importar escala">
              {!modoFds && <Upload className="w-4 h-4" />} Importar
            </Button>
          ) : null
        }
      />

      <div className="max-w-3xl mx-auto px-4 pt-3 space-y-3">
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
          turnoOpcoes={fimDeSemana ? TURNO_OPCOES_FDS : TURNO_OPCOES}
          turno={turno}
          onEscolherTurno={escolherTurno}
          // TELA ÚNICA NO FIM DE SEMANA (dono 24/08): sem abas e sem seletor de
          // hospital. A fila única já cobre os três hospitais, e o quadro por
          // sala resolvia um problema que o sábado não tem — 12 salas contra as
          // 42 de um dia útil, com o agravante de obrigar a trocar de hospital
          // para alcançar cada sala. O dia útil segue com os três controles.
          hospitalOpcoes={modoFds ? null : HOSPITAL_OPCOES}
          hospital={hospital}
          onEscolherHospital={setHospital}
          abaOpcoes={modoFds ? null : ABA_OPCOES}
          aba={aba}
          onEscolherAba={setAba}
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
          {!modoFds && aba === 'minhas' && (
            <MinhasEscalasView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turnoCasos} onVerBoard={() => setAba('board')} />
          )}
          {!modoFds && aba === 'board' && (
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
          {(modoFds || aba === 'liberacoes') && (() => {
            // MODO FDS: a view opera sobre a linha 'fds' (fila única + marcações)
            // e os casos mesclados dos 3 hospitais; troca/P4-coringa ficam fora.
            const escalaLib = modoFds ? escalas.fds : escala
            return (
              <>
                {fimDeSemana && !modoFds && canEdit && (
                  <p className="mb-3 rounded-lg bg-info/10 px-3 py-2 text-xs text-info">
                    Fim de semana: importe o documento de FDS (grade P1–P4 + ordem de liberação)
                    para a fila única de todos os hospitais. Sem ele, a fila segue por hospital.
                  </p>
                )}
                <LiberacoesView
                  escala={escalaLib}
                  hospital={modoFds ? FDS_HOSPITAL : hospital}
                  hospitalLabel={modoFds ? 'Fim de semana' : HOSPITAL_LABEL[hospital]}
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
                        hospital: FDS_HOSPITAL, escalaId: escalaLib.id, turno: turnoDeCasos,
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
                      hospital: FDS_HOSPITAL, escalaId: escalaLib.id, turno: turnoDeCasos,
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
                      turno: turnoDeCasos, tipo: 'posicoes',
                    })),
                    limparTroca: [],
                  }, userInfo)) : undefined}
                  onToggle={(anest) => toggleLiberacao(escalaLib, anest, userInfo, turno)}
                  onToggleEscalado={(anest) => toggleEscalado(escalaLib, anest, userInfo, turno)}
                  onSetOverride={(anest, override) => setLinhaOverride(escalaLib, anest, override, userInfo, turno)}
                  onAddAjuda={(nome) => adicionarAjuda(escalaLib, turno, nome)}
                  onReordenarAjuda={(de, para) => reordenarAjuda(escalaLib, turno, de, para)}
                  contraturnoOutros={modoFds ? [] : contraturnoOutros}
                  presencaOutros={presencaOutros}
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
        <ImportarEscalaPage
          hospital={hospital}
          data={data}
          turno={turno}
          onAbrirFds={() => { setImportando(false); setImportandoFds(true) }}
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
