/**
 * EscalaCirurgicaPage — escala cirúrgica do dia (mobile-first).
 * Data no topo · turno (matutino/vespertino) · hospital · abas internas —
 * todos com seletor segmentado (mesmo estilo do Cateter Peridural).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link2, Upload } from 'lucide-react'
import { PageHeader } from '@/components'
import { Button, DatePicker } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaDia } from '@/hooks/usePegaPlantao'
import { useEscalaCirurgica, HOSPITAIS, HOSPITAL_LABEL, hojeISO } from '@/contexts/EscalaCirurgicaContext'
import svc from '@/services/supabaseEscalaCirurgicaService'
import SegmentedSelector from './SegmentedSelector'
import MinhasEscalasView from './MinhasEscalasView'
import BoardView from './BoardView'
import LiberacoesView from './LiberacoesView'
import ImportarEscalaPage from './ImportarEscalaPage'
import VinculosSheet from './VinculosSheet'
import { meuAliasDe, turnoAtual, casosResolvidos, filtrarPorTurno, normNome, formatData } from './utils'

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
  const { escalas, data, loading, p4Hospital, hoje, setData, reordenarLiberacao, toggleLiberacao, toggleEscalado, setLinhaOverride, adicionarAjuda, removerAjuda, definirP4Hospital, setAnestesistaCasos } = useEscalaCirurgica()
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
    const temCaso = (e, t) => filtrarPorTurno(casosResolvidos(e), t).some(
      (c) => (c.anestesistaUserId ? c.anestesistaUserId === uid : (alvo && normNome(c.anestesista) === alvo))
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

  if (!user) return null

  const canEdit = !!(user.isAdmin || ['anestesiologista', 'medico-residente', 'tec-enfermagem', 'secretaria'].includes((user.role || '').toLowerCase()))
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
              podeGerenciar={!!(user.isAdmin || (user.role || '').toLowerCase() === 'secretaria')}
              meuUid={meuUid}
              meuAlias={meuAlias}
              turno={turno}
              plantoes={plantoesDia}
              p4Hospital={p4Hospital}
              onDefinirP4={(h) => definirP4Hospital(h, userInfo)}
              onDefinirCasos={(casoIds, { uid, apelido, rotulo }) =>
                setAnestesistaCasos(escala, casoIds, { uid, apelido }, { rotulo })}
              onToggle={(anest) => toggleLiberacao(escala, anest, userInfo)}
              onToggleEscalado={(anest) => toggleEscalado(escala, anest, userInfo)}
              onReorder={(ordem) => reordenarLiberacao(escala, ordem, turno)}
              onSetOverride={(anest, override) => setLinhaOverride(escala, anest, override, userInfo)}
              onAddAjuda={(nome) => adicionarAjuda(escala, turno, nome)}
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
