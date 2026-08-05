/**
 * EscalaCirurgicaPage — escala cirúrgica do dia (mobile-first).
 * Data no topo · turno (matutino/vespertino) · hospital · abas internas —
 * todos com seletor segmentado (mesmo estilo do Cateter Peridural).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link2, Upload } from 'lucide-react'
import { PageHeader } from '@/components'
import { Button, DatePicker } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaDia } from '@/hooks/usePegaPlantao'
import { useEscalaCirurgica, HOSPITAIS, HOSPITAL_LABEL, hojeISO } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import svc from '@/services/supabaseEscalaCirurgicaService'
import SegmentedSelector from './SegmentedSelector'
import MinhasEscalasView from './MinhasEscalasView'
import BoardView from './BoardView'
import LiberacoesView from './LiberacoesView'
import ImportarEscalaPage from './ImportarEscalaPage'
import VinculosSheet from './VinculosSheet'
import { meuAliasDe, turnoAtual, casosResolvidos, filtrarPorTurno, normNome, formatData, rodapeDoTurno, localizarSlotRodape, planoExecucaoTroca, planoDesfazerTroca } from './utils'
import { podeEditarEscalaCirurgica } from './gate'

const HOSPITAL_OPCOES = HOSPITAIS.map((h) => ({ value: h, label: HOSPITAL_LABEL[h] }))
const TURNO_OPCOES = [
  { value: 'matutino', label: 'Matutino' },
  { value: 'vespertino', label: 'Vespertino' },
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
  const dataComoDate = useMemo(() => {
    const [a, m, d] = String(data || '').split('-').map(Number)
    return a && m && d ? new Date(a, m - 1, d) : new Date()
  }, [data])
  const [importando, setImportando] = useState(false)
  const [vinculos, setVinculos] = useState(false)

  // Navegação de data (pedido do dono 24/07 + pesquisa NN/G: default HOJE, atalho
  // "Amanhã" só quando a de amanhã já foi PUBLICADA — nunca leva a uma tela vazia;
  // "Outra data" (calendário livre) só p/ quem edita). Elimina a confusão de
  // navegar p/ datas vazias e ver escala velha.
  // `hoje` vem do context e AVANÇA na virada da meia-noite (antes era um useMemo
  // fixo no mount: o rótulo "Hoje" ficava colado na data de ONTEM no app aberto).
  const amanha = useMemo(() => {
    const d = new Date(`${hoje}T12:00:00`)
    d.setDate(d.getDate() + 1)
    return hojeISO(d)
  }, [hoje])
  const [amanhaPublicada, setAmanhaPublicada] = useState(false)
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  useEffect(() => {
    let vivo = true
    Promise.all(HOSPITAIS.map((h) => svc.fetchEscala(amanha, h).catch(() => null)))
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

  // Virou o dia: o turno volta para o do relógio. Sem isto, às 00h05 a tela do
  // dia NOVO abria no vespertino de ontem — vazio ("Nenhum caso neste turno").
  const viradaRef = useRef(hoje)
  useEffect(() => {
    if (viradaRef.current === hoje) return
    viradaRef.current = hoje
    setTurno(turnoAtual())
  }, [hoje])

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
        if (temCaso(escalas[h], t)) { setHospital(h); setTurno(t); autoSelRef.current = true; return }
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
      if (h === hospital || !esc) continue
      const rodape = rodapeDoTurno(esc.ordemLiberacao, turno)
      const ultimo = rodape[rodape.length - 1]
      if (ultimo) out.push({ nome: normNome(ultimo), hospitalLabel: HOSPITAL_LABEL[h] || h })
    }
    return out
  }, [escalas, hospital, turno])

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
    const slotLabelDe = (p) => {
      for (const [h2, e2] of Object.entries(escalas)) {
        if (e2 && localizarSlotRodape(e2, p, resolverRoster, turno)) return HOSPITAL_LABEL[h2] || h2
      }
      return null
    }
    for (const [h, esc] of Object.entries(escalas)) {
      if (!esc) continue
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
          a, b, aHospitalLabel: slotLabelDe(a), bHospitalLabel: slotLabelDe(b),
        })
      }
      // Mesmo após desfazer a troca, o rastro continua disponível para o card:
      // o override deixa de existir, mas os casos encerrados não devem perder a
      // informação de que foram executados por substituição.
      for (const evento of esc.trocasHistorico || []) {
        const detalhe = evento?.detalhe || {}
        // Eventos antigos gravavam a chave sem namespace e, pela regra de
        // migração, pertencem ao matutino. Nunca deixar esse histórico vazar
        // para a aba vespertina. Eventos novos carregam o prefixo do turno.
        const chaveEventoRaw = String(evento.anestesista || '')
        const turnoEvento = chaveEventoRaw.startsWith('vespertino:')
          ? 'vespertino'
          : chaveEventoRaw.startsWith('matutino:') || !chaveEventoRaw.includes(':')
            ? 'matutino'
            : null
        if (turnoEvento !== turno) continue
        if (!['troca_declarada', 'posicao_assumida', 'troca_desfeita'].includes(evento?.statusPara)) continue
        if (!detalhe.uid && !detalhe.nome) continue
        const chave = chaveEventoRaw.replace(/^(matutino|vespertino):/, '')
        if (!chave) continue
        const aUid = rosterByUid.has(chave) ? chave : (resolverRoster(chave) || null)
        const a = pessoaDe(aUid, chave)
        const b = pessoaDe(detalhe.uid, detalhe.nome)
        if (out.some((p) => p.hospital === h && p.chave === chave && p.b.uid === b.uid)) continue
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

  const meuAlias = meuAliasDe(user)
  const meuUid = user?.uid || user?.id
  const userInfo = { userId: meuUid, userName: user?.displayName }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Escala Cirúrgica"
        subtitle={`${HOSPITAL_LABEL[hospital]} · ${turno === 'matutino' ? 'Matutino' : 'Vespertino'}`}
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
        {/* Data (Hoje/Amanhã ou calendário livre) + Turno na mesma linha */}
        <div className="flex items-stretch gap-2">
          {calendarioAberto ? (
            // Parse manual do ISO — new Date('YYYY-MM-DD') é UTC e desloca 1 dia no fuso BR.
            <DatePicker
              className="flex-1 min-w-0"
              value={dataComoDate}
              onChange={(d) => d && setData(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)}
              placeholder="Data da escala"
            />
          ) : (
            <SegmentedSelector
              className="flex-1"
              options={opcoesData}
              value={modoData === 'outra' ? '' : modoData}
              onChange={(v) => {
                if (v === 'amanha') { setData(amanha); setTurno('matutino') } // manhã seguinte
                else setData(hoje)
              }}
            />
          )}
          <SegmentedSelector className="flex-1" options={TURNO_OPCOES} value={turno} onChange={setTurno} />
        </div>

        {/* "Outra data" (calendário livre) só p/ quem edita a escala */}
        {canEdit && (
          <button
            type="button"
            onClick={() => { setCalendarioAberto((v) => !v); if (calendarioAberto) setData(hoje) }}
            className="text-xs font-medium text-primary active:opacity-60"
          >
            {calendarioAberto ? '‹ Voltar para Hoje/Amanhã' : 'Outra data (calendário) ›'}
          </button>
        )}
        {/* Vendo uma data que não é hoje/amanhã (via calendário): rótulo + volta rápida */}
        {modoData === 'outra' && !calendarioAberto && (
          <p className="rounded-lg bg-warning/10 px-3 py-1.5 text-xs text-warning">
            Vendo {formatData(data)} — <button type="button" className="font-semibold underline" onClick={() => setData(hoje)}>voltar para hoje</button>
          </p>
        )}

        {/* Hospital */}
        <SegmentedSelector options={HOSPITAL_OPCOES} value={hospital} onChange={setHospital} />

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
            <MinhasEscalasView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turno} onVerBoard={() => setAba('board')} />
          )}
          {aba === 'board' && <BoardView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turno} onNavigate={onNavigate} />}
          {aba === 'liberacoes' && (
            <LiberacoesView
              escala={escala}
              hospital={hospital}
              hospitalLabel={HOSPITAL_LABEL[hospital]}
              canEdit={canEdit}
              turno={turno}
              plantoes={plantoesDia}
              p4Hospital={p4Hospital}
              onDefinirP4={(h) => definirP4Hospital(h, userInfo)}
              onDefinirCasos={(casoIds, { uid, apelido, rotulo }) =>
                setAnestesistaCasos(escala, casoIds, { uid, apelido }, { rotulo })}
              onToggle={(anest) => toggleLiberacao(escala, anest, userInfo, turno)}
              onToggleEscalado={(anest) => toggleEscalado(escala, anest, userInfo, turno)}
              onSetOverride={(anest, override) => setLinhaOverride(escala, anest, override, userInfo, turno)}
              onAddAjuda={(nome) => adicionarAjuda(escala, turno, nome)}
              onReordenarAjuda={(de, para) => reordenarAjuda(escala, turno, de, para)}
              contraturnoOutros={contraturnoOutros}
              presencaOutros={presencaOutros}
              paresTroca={paresTroca}
              onMarcarTroca={(linha, colega) => marcarTroca(escala, linha, colega, userInfo, turno)}
              onExecutarTroca={(par) =>
                executarSubstituicao(planoExecucaoTroca({ escalas, resolverUid: resolverRoster, a: par.a, b: par.b, turno }), userInfo)}
              onDesfazerSubstituicao={(linha) =>
                desfazerSubstituicao(planoDesfazerTroca({
                  escalas, resolverUid: resolverRoster,
                  turno,
                  a: pessoaDe(linha.uid, linha.anestesista),
                  b: pessoaDe(linha.assumida?.deUid, linha.assumida?.deNome),
                }), userInfo)}
              onRemoveAjuda={(nome) => removerAjuda(escala, turno, nome)}
            />
          )}
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

      {importando && (
        <ImportarEscalaPage
          hospital={hospital}
          data={data}
          turno={turno}
          onClose={(publicado) => {
            setImportando(false)
            // Publicou noutra data/hospital/período? Aterrissa exatamente na escala publicada.
            if (publicado?.data) setData(publicado.data)
            if (publicado?.hospital) setHospital(publicado.hospital)
            if (publicado?.turno) setTurno(publicado.turno)
          }}
        />
      )}
    </div>
  )
}
