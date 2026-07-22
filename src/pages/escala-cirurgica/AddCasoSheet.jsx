/**
 * AddCasoSheet — acrescenta um procedimento à escala publicada (urgência,
 * encaixe, cirurgia que não saiu no mapa). O caso entra EXATAMENTE como os
 * demais: board re-agrupa e a coluna de liberação re-deriva sozinha.
 * LGPD: o nome do paciente é convertido em INICIAIS no blur (CHECK do banco
 * rejeita nome completo).
 */
import { useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Input, Button, ConfirmDialog } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { iniciais } from '@/lib/excelEscala'
import { agruparPorSala, familiaConvenio } from './utils'

const NOVA_SALA = '__nova__'
const TIPOS = [
  { value: 'eletiva', label: 'Eletiva / encaixe' },
  { value: 'urgencia', label: 'Urgência' },
  { value: 'emergencia', label: 'Emergência' },
]

// Fora do componente: definido inline, a identidade mudaria a cada render e o
// React remontaria o subtree — input perdendo foco a cada tecla.
const Campo = ({ id, label, children }) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
)

export default function AddCasoSheet({ escala, onClose, onPreencherCobranca }) {
  const { adicionarCaso } = useEscalaCirurgicaActions()
  const { options: rosterOpcoes, rosterByUid } = useRosterAnestesistas()
  const [sala, setSala] = useState('')
  const [novaSala, setNovaSala] = useState('')
  const [hora, setHora] = useState('')
  const [paciente, setPaciente] = useState('')
  const [idade, setIdade] = useState('')
  const [procedimento, setProcedimento] = useState('')
  const [cirurgiao, setCirurgiao] = useState('')
  const [convenio, setConvenio] = useState('')
  const [anestesistaUid, setAnestesistaUid] = useState('')
  const [tipo, setTipo] = useState('urgencia')
  const [salvando, setSalvando] = useState(false)
  // Caso particular recém-adicionado: oferece preencher a cobrança agora
  // (o rascunho em Cirurgias Particulares já nasceu via trigger no banco).
  const [casoParticular, setCasoParticular] = useState(null)

  const salasOpcoes = useMemo(() => {
    const existentes = [...agruparPorSala(escala?.casos || []).keys()]
    return [
      ...existentes.map((s) => ({ value: s, label: s })),
      { value: NOVA_SALA, label: '+ Nova sala…' },
    ]
  }, [escala])

  const salaFinal = sala === NOVA_SALA ? novaSala.trim() : sala
  const valido = salaFinal && procedimento.trim()

  const submeter = async () => {
    if (!valido || salvando) return
    setSalvando(true)
    try {
      const r = anestesistaUid ? rosterByUid.get(anestesistaUid) : null
      const alias = r ? (r.apelidos[0] || r.nome.split(/\s+/)[0].toUpperCase()) : ''
      const daSala = (escala?.casos || []).filter((c) => c.sala === salaFinal)
      const novo = await adicionarCaso(escala, {
        sala: salaFinal,
        ordem: daSala.reduce((m, c) => Math.max(m, c.ordem ?? 0), -1) + 1,
        hora: hora.trim(),
        pacienteIniciais: iniciais(paciente),
        idade: idade.trim(),
        procedimento: procedimento.trim(),
        convenio: convenio.trim(),
        cirurgiao: cirurgiao.trim(),
        anestesista: alias,
        anestesistaUserId: anestesistaUid || null,
        tipo,
      })
      // Particular → cobrança auto-criada no banco; oferecer preencher já.
      if (novo && familiaConvenio(novo.convenio) === 'particular' && onPreencherCobranca) {
        setCasoParticular(novo)
        return
      }
      onClose?.()
    } catch { /* toast no context */ }
    finally { setSalvando(false) }
  }

  if (casoParticular) {
    return (
      <ConfirmDialog
        open
        onClose={() => { setCasoParticular(null); onClose?.() }}
        onConfirm={() => {
          const caso = casoParticular
          setCasoParticular(null)
          onClose?.()
          onPreencherCobranca?.(caso)
        }}
        title="Caso particular adicionado"
        description="A cobrança já foi criada em Cirurgias Particulares (nome do paciente e valor pendentes). Preencher agora?"
        confirmText="Preencher cobrança"
        cancelText="Depois"
      />
    )
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Adicionar caso
          </SheetTitle>
        </SheetHeader>
        <div className="px-1 pb-4 space-y-3">
          <Campo id="ac-sala" label="Sala">
            <Select options={salasOpcoes} value={sala} onChange={setSala} placeholder="Selecionar sala…" searchable />
          </Campo>
          {sala === NOVA_SALA && (
            <Input value={novaSala} onChange={(e) => setNovaSala(e.target.value)} placeholder="Nome da sala (ex.: SALA 5)" />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Campo id="ac-hora" label="Hora">
              <Input id="ac-hora" value={hora} onChange={(e) => setHora(e.target.value)} placeholder="ex.: 15:30" />
            </Campo>
            <Campo id="ac-idade" label="Idade">
              <Input id="ac-idade" value={idade} onChange={(e) => setIdade(e.target.value)} placeholder="ex.: 47a" />
            </Campo>
          </div>
          <Campo id="ac-paciente" label="Paciente (vira iniciais)">
            <Input id="ac-paciente" value={paciente}
              onChange={(e) => setPaciente(e.target.value)}
              onBlur={() => setPaciente(iniciais(paciente))}
              placeholder="Nome ou iniciais — salvo só como iniciais (LGPD)" />
          </Campo>
          <Campo id="ac-proc" label="Procedimento *">
            <Input id="ac-proc" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="ex.: Apendicectomia" />
          </Campo>
          <Campo id="ac-cir" label="Cirurgião">
            <Input id="ac-cir" value={cirurgiao} onChange={(e) => setCirurgiao(e.target.value)} placeholder="ex.: Mateus Baptistella" />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo id="ac-conv" label="Convênio">
              <Input id="ac-conv" value={convenio} onChange={(e) => setConvenio(e.target.value)} placeholder="SUS, Unimed, BRF…" />
            </Campo>
            <Campo id="ac-tipo" label="Tipo">
              <Select options={TIPOS} value={tipo} onChange={setTipo} />
            </Campo>
          </div>
          <Campo id="ac-anest" label="Anestesista (opcional)">
            <Select options={rosterOpcoes} value={anestesistaUid} onChange={setAnestesistaUid}
              placeholder="Selecionar anestesista…" searchable />
          </Campo>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={submeter} disabled={!valido || salvando} className="flex-1">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
