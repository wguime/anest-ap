/**
 * EscalaCirurgicaPage — escala cirúrgica do dia (mobile-first).
 * Data no topo · turno (matutino/vespertino) · hospital · abas internas —
 * todos com seletor segmentado (mesmo estilo do Cateter Peridural).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link2, Upload } from 'lucide-react'
import { PageHeader } from '@/components'
import { Button } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaDia } from '@/hooks/usePegaPlantao'
import { useEscalaCirurgica, HOSPITAIS, HOSPITAL_LABEL, hojeISO } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import svc from '@/services/supabaseEscalaCirurgicaService'
import SegmentedSelector from './SegmentedSelector'
import useAgoraMinuto from './useAgoraMinuto'
import MinhasEscalasView from './MinhasEscalasView'
import BoardView from './BoardView'
import LiberacoesView from './LiberacoesView'
import ImportarEscalaPage from './ImportarEscalaPage'
import ImportarEscalaFdsPage from './ImportarEscalaFdsPage'
import VinculosSheet from './VinculosSheet'
import TrocaSheet from './TrocaSheet'
import { meuAliasDe, turnoAtual, casosResolvidos, estadoTrocasDoHistorico, filtrarPorTurno, normNome, formatData, rodapeDoTurno, localizarSlotEscala, planoExecucaoTroca, planoDesfazerTroca } from './utils'
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
  const { escalas, data, loading, p4Hospital, hoje, setData, toggleLiberacao, toggleEscalado, setLinhaOverride, adicionarAjuda, removerAjuda, reordenarAjuda, definirP4Hospital, setAnestesistaCasos, marcarTroca, executarSubstituicao, desfazerSubstituicao } = useEscalaCirurgica()
  // Roster p/ resolver os lados do par da troca declarada (uid/nome/apelido)
  const { resolver: resolverRoster, rosterByUid } = useRosterAnestesistas()
  // P1–P4 do dia (card Plantões/PegaPlantao) — alimentam a fase noturna das Liberações
  const { plantoes: plantoesDia } = useEscalaDia()
  const [hospital, setHospital] = useState('unimed')
  const [aba, setAba] = useState('minhas')
  const [turno, setTurno] = useState(() => turnoAtual())
  // ── MODO FIM DE SEMANA (dono 15/08): fila de liberação ÚNICA ───────────────
  // Liga quando a data é sáb/dom E a linha 'fds' do dia está publicada. Sem ela,
  // a aba Liberações segue no comportamento por hospital (rollout seguro).
  // Fica ANTES dos efeitos de turno: no FDS o relógio decide entre 3 turnos.
  const fimDeSemana = ehFimDeSemana(data)
  const modoFds = fimDeSemana && escalas.fds?.status === 'publicada'
  // turno do relógio: 2 faixas no dia útil, 3 no FDS (7h/13h/19h)
  const turnoDoRelogio = useCallback(
    () => (modoFds ? turnoFdsAtual(new Date().getHours() * 60 + new Date().getMinutes()) : turnoAtual()),
    [modoFds]
  )
  const [importando, setImportando] = useState(false)
  const [importandoFds, setImportandoFds] = useState(false) // documento de FDS (fila única)
  const [vinculos, setVinculos] = useState(false)
  const [trocaSheet, setTrocaSheet] = useState(null) // linha de origem do fluxo único de troca

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
      .then((rs) => { if (vivo) setAmanhaPublicada(rs.some((e) => e?.status === 'publicada')) })
      .catch(() => {})
    return () => { vivo = false }
  }, [amanha])
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
    if (!modoFds && turno === 'noturno') { turnoManualRef.current = null; setTurno(turnoAtual()); return }
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
    const temCaso = (e, t) => filtrarPorTurno(casosResolvidos(e), t).some(
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
          a, b, aHospitalLabel: slotLabelDe(a), bHospitalLabel: slotLabelDe(b) || t.local || null,
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

  if (!user) return null

  const canEdit = podeEditarEscalaCirurgica(user)
  const escala = escalas[hospital]
  // Turno de CASOS: 'noturno' é turno da FILA (o CHECK do banco só aceita
  // matutino/vespertino) — Completa/Minhas mostram as cirurgias da tarde, que
  // são as que seguem em curso à noite.
  const turnoCasos = FDS_TURNO_CASOS[turno] || turno

  const meuAlias = meuAliasDe(user)
  const meuUid = user?.uid || user?.id
  const userInfo = { userId: meuUid, userName: user?.displayName }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Escala Cirúrgica"
        subtitle={`${aba === 'liberacoes' && modoFds ? 'Fim de semana' : HOSPITAL_LABEL[hospital]} · ${(TURNO_OPCOES_FDS.find((t) => t.value === turno) || {}).label || 'Manhã'}`}
        onBack={goBack}
        actions={
          canEdit ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setVinculos(true)} aria-label="Vínculos de nomes da escala">
                <Link2 className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setImportando(true)} aria-label="Importar escala">
                <Upload className="w-4 h-4" /> Importar
              </Button>
            </div>
          ) : null
        }
      />

      <div className="max-w-3xl mx-auto px-4 pt-3 space-y-3">
        {/* Data (Hoje/Amanhã) + Turno na MESMA linha, compactos (dono 16/08).
            O CALENDÁRIO LIVRE ("Outra data") SAIU em 16/08, a pedido do dono —
            também no dia útil: a escala é operada no dia, e o atalho abria a
            porta para consultar datas vazias. Publicar noutra data continua
            possível pela importação, que tem calendário próprio. */}
        {/* Data COMPACTA numa linha (dono 16/08: "reduza o tamanho do card
            Hoje") e os turnos em linha PRÓPRIA, lado a lado ("mantenha todos
            em linha conforme estavam"). */}
        <div className="flex items-stretch gap-2">
          <SegmentedSelector
            className="shrink-0"
            size="sm"
            options={opcoesData}
            value={modoData === 'outra' ? '' : modoData}
            onChange={(v) => {
              if (v === 'amanha') { setData(amanha); setTurno('matutino') } // manhã seguinte
              else setData(hoje)
            }}
          />
        </div>
        <SegmentedSelector
          size="sm"
          options={modoFds ? TURNO_OPCOES_FDS : TURNO_OPCOES}
          value={turno}
          onChange={escolherTurno}
        />

        {/* Aterrissou noutra data (ex.: publicou pela importação): rótulo + volta */}
        {modoData === 'outra' && (
          <p className="rounded-lg bg-warning/10 px-3 py-1.5 text-xs text-warning">
            Vendo {formatData(data)} — <button type="button" className="font-semibold underline" onClick={() => setData(hoje)}>voltar para hoje</button>
          </p>
        )}

        {/* Hospital SEMPRE visível (dono 16/08: "ocultou o nome dos hospitais,
            corrija"). No fim de semana a fila de liberação é única — o seletor
            segue valendo para as abas Minhas/Completa, e a nota abaixo explica
            por que a lista de liberações não muda ao trocar de hospital. */}
        <SegmentedSelector size="sm" options={HOSPITAL_OPCOES} value={hospital} onChange={setHospital} />
        {aba === 'liberacoes' && modoFds && (
          <p className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            Fim de semana — fila de liberação única (todos os hospitais)
          </p>
        )}

        {/* Abas internas — variante "filled" (trilho + selecionada em verde sólido, pedido do dono 24/07) */}
        <SegmentedSelector options={ABA_OPCOES} value={aba} onChange={setAba} variant="filled" />

        {/* Botão de demonstração EXCLUÍDO (pedido do dono 23/07) — a fixture demo
            segue existindo SÓ em DEV (base determinística dos e2e). */}
        {escala?.id?.startsWith('demo-') && (
          <p className="rounded-lg bg-warning/10 text-warning text-xs px-3 py-2">
            Demonstração — alterações (liberar/reordenar) não são salvas.
          </p>
        )}

        <div className="pt-1">
          {aba === 'minhas' && (
            <MinhasEscalasView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turnoCasos} onVerBoard={() => setAba('board')} />
          )}
          {aba === 'board' && <BoardView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turnoCasos} onNavigate={onNavigate} />}
          {aba === 'liberacoes' && (() => {
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
                  p4Hospital={p4Hospital}
                  modoFds={modoFds}
                  casosFds={casosFds}
                  fdsMeta={modoFds ? escalas.fds?.fdsMeta || null : null}
                  onDefinirP4={modoFds ? undefined : (h) => definirP4Hospital(h, userInfo)}
                  onDefinirCasos={(casoIds, { uid, apelido, rotulo }) => {
                    // na fila única o caso pertence à escala do hospital de origem
                    const dona = modoFds ? escalaDoCaso(casoIds[0]) || escala : escala
                    return setAnestesistaCasos(dona, casoIds, { uid, apelido }, { rotulo })
                  }}
                  onToggle={(anest) => toggleLiberacao(escalaLib, anest, userInfo, turno)}
                  onToggleEscalado={(anest) => toggleEscalado(escalaLib, anest, userInfo, turno)}
                  onSetOverride={(anest, override) => setLinhaOverride(escalaLib, anest, override, userInfo, turno)}
                  onAddAjuda={(nome) => adicionarAjuda(escalaLib, turno, nome)}
                  onReordenarAjuda={(de, para) => reordenarAjuda(escalaLib, turno, de, para)}
                  contraturnoOutros={modoFds ? [] : contraturnoOutros}
                  presencaOutros={presencaOutros}
                  paresTroca={modoFds ? [] : paresTroca}
                  onMarcarTroca={modoFds ? undefined : (linha, colega) => marcarTroca(escala, linha, colega, userInfo, turno)}
                  onAbrirTroca={modoFds ? undefined : (linha) => setTrocaSheet(linha)}
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

      {vinculos && (
        <VinculosSheet
          meuUid={meuUid}
          podeGerenciar={!!(user.isAdmin || (user.role || '').toLowerCase() === 'secretaria')}
          onClose={() => setVinculos(false)}
        />
      )}

      {/* FLUXO ÚNICO de troca (dono 07/08): troca nova passa sempre por aqui —
          uma decisão por posição (fica/assume) + tipo + motivo. As posições vêm
          das 3 escalas do context; a `escala` da tela é onde o registro sem
          movimento é gravado (trocaCom na linha de origem). */}
      {trocaSheet && (
        <TrocaSheet
          linha={trocaSheet}
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
