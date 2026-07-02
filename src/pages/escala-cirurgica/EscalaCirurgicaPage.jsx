/**
 * EscalaCirurgicaPage — escala cirúrgica do dia (mobile-first).
 * Data no topo · turno (matutino/vespertino) · hospital · abas internas —
 * todos com seletor segmentado (mesmo estilo do Cateter Peridural).
 */
import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { PageHeader } from '@/components'
import { Button } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgica, HOSPITAIS, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { DEMO_DATE } from '@/data/escalaCirurgicaDemo'
import SegmentedSelector from './SegmentedSelector'
import MinhasEscalasView from './MinhasEscalasView'
import BoardView from './BoardView'
import LiberacoesView from './LiberacoesView'
import ImportarEscalaPage from './ImportarEscalaPage'
import { meuAliasDe, turnoAtual } from './utils'

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

export default function EscalaCirurgicaPage({ goBack }) {
  const { user } = useUser()
  const { escalas, data, loading, setData, reordenarLiberacao, toggleLiberacao, setLinhaOverride } = useEscalaCirurgica()
  const [hospital, setHospital] = useState('unimed')
  const [aba, setAba] = useState('minhas')
  const [turno, setTurno] = useState(() => turnoAtual())
  const [importando, setImportando] = useState(false)

  useEffect(() => { document.title = 'Escala Cirúrgica' }, [])

  if (!user) return null

  const canEdit = !!(user.isAdmin || ['anestesiologista', 'medico-residente', 'secretaria'].includes((user.role || '').toLowerCase()))
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
            <Button size="sm" variant="ghost" onClick={() => setImportando(true)} aria-label="Importar escala">
              <Upload className="w-4 h-4" /> Importar
            </Button>
          ) : null
        }
      />

      <div className="max-w-3xl mx-auto px-4 pt-3 space-y-3">
        {/* Data (esquerda) + Turno (direita) na mesma linha */}
        <div className="flex items-stretch gap-2">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="flex-1 min-w-0 rounded-[16px] border border-[hsl(var(--input))] bg-card px-3 py-3 text-sm text-foreground min-h-[44px]"
            aria-label="Data da escala"
          />
          <SegmentedSelector className="flex-1" options={TURNO_OPCOES} value={turno} onChange={setTurno} />
        </div>

        {/* Hospital */}
        <SegmentedSelector options={HOSPITAL_OPCOES} value={hospital} onChange={setHospital} />

        {/* Abas internas */}
        <SegmentedSelector options={ABA_OPCOES} value={aba} onChange={setAba} />

        {/* Atalho p/ dados de demonstração (enquanto a migration não é aplicada) */}
        {!escala && !loading && data !== DEMO_DATE && (
          <button
            type="button"
            onClick={() => setData(DEMO_DATE)}
            className="w-full rounded-xl border border-dashed border-primary/50 bg-primary/5 py-2.5 text-sm font-medium text-primary"
          >
            Carregar escalas de demonstração (26/06/2026)
          </button>
        )}
        {escala?.id?.startsWith('demo-') && (
          <p className="rounded-lg bg-warning/10 text-warning text-xs px-3 py-2">
            Demonstração — alterações (liberar/reordenar) não são salvas.
          </p>
        )}

        <div className="pt-1">
          {aba === 'minhas' && (
            <MinhasEscalasView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turno} onVerBoard={() => setAba('board')} />
          )}
          {aba === 'board' && <BoardView escala={escala} meuAlias={meuAlias} meuUid={meuUid} turno={turno} />}
          {aba === 'liberacoes' && (
            <LiberacoesView
              escala={escala}
              hospitalLabel={HOSPITAL_LABEL[hospital]}
              canEdit={canEdit}
              onToggle={(anest) => toggleLiberacao(escala, anest, userInfo)}
              onReorder={(ordem) => reordenarLiberacao(escala, ordem)}
              onSetOverride={(anest, override) => setLinhaOverride(escala, anest, override, userInfo)}
            />
          )}
        </div>

        {loading && <p className="text-center text-sm text-muted-foreground py-4">Carregando…</p>}
      </div>

      {importando && (
        <ImportarEscalaPage hospital={hospital} data={data} onClose={() => setImportando(false)} />
      )}
    </div>
  )
}
