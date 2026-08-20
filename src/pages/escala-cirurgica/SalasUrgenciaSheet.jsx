/**
 * SalasUrgenciaSheet — marca ONDE cada papel do contrato de urgência do HRO está
 * NESTE dia/turno: Plantão · Sobreaviso · Ortopedia · CO.
 *
 * PORQUÊ (dono 18/08): a ortopedia opera "normalmente na sala 4" e o CO na 7 —
 * mas essas salas MUDAM, e com elas muda quem absorve a urgência e quem pesa nas
 * 2 vagas do contrato. O default continua no código (o normal não exige toque
 * nenhum); este sheet é o ajuste do dia que foge do normal.
 *
 * "Automático" = comportamento de sempre: orto/CO nos defaults do contrato,
 * plantão/sobreaviso atribuídos por ordem de início. Config é POR TURNO (turnos
 * independentes, regra de 13/08) e sobrevive à republicação (coluna própria,
 * fora do reset).
 *
 * ⚠️ MUDANÇA 20/08 (dono): marcar plantão/sobreaviso numa sala FAZ a sala entrar
 * na contagem das 2 vagas enquanto ela tiver cirurgia aberta no turno — é a
 * resposta a "se as salas de urgência não tiverem sido identificadas, que haja
 * como marcar sala para que entre na contagem". Até 19/08 a marcação só trocava
 * o rótulo de quem cobria o que já estava em andamento, então marcar a sala não
 * mudava nada na tela e o card do posto continuava "livre".
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { salasContrato } from '@/lib/escalaCirurgicaUrgencias'
import { casosResolvidos, salasDoHospital } from './utils'

const AUTO = '__auto__'

const LINHAS = [
  { campo: 'plantao', label: 'Plantão', hint: 'marcar a sala faz ela entrar na conta · automático: a urgência mais antiga em andamento' },
  { campo: 'sobreaviso', label: 'Sobreaviso', hint: 'marcar a sala faz ela entrar na conta · automático: a segunda em andamento' },
  { campo: 'orto', label: 'Ortopedia', hint: 'automático: Sala 4 · fora da conta de manhã e à tarde (tem dedicado)' },
  { campo: 'co', label: 'CO', hint: 'automático: Sala 7 - CO · dedicado só de manhã; à tarde e à noite entra na conta sozinho' },
]

export default function SalasUrgenciaSheet({ escala, turno, onClose }) {
  const { definirSalasUrgencia } = useEscalaCirurgicaActions()
  const atual = salasContrato(escala?.urgenciasMeta, turno)
  const [valores, setValores] = useState(() => ({
    plantao: atual.plantao || AUTO,
    sobreaviso: atual.sobreaviso || AUTO,
    orto: atual.orto || AUTO,
    co: atual.co || AUTO,
  }))
  const [salvando, setSalvando] = useState(false)

  // Mesmas opções de sala do "Adicionar caso": as do dia + as canônicas do HRO.
  const opcoes = [
    { value: AUTO, label: 'Automático' },
    ...salasDoHospital('hro', casosResolvidos(escala)).map((s) => ({ value: s, label: s })),
  ]

  const salvar = async () => {
    setSalvando(true)
    try {
      const cfg = Object.fromEntries(
        Object.entries(valores).filter(([, v]) => v && v !== AUTO),
      )
      // tudo em automático = limpar o turno (o jsonb não guarda ruído)
      await definirSalasUrgencia(escala, turno, Object.keys(cfg).length ? cfg : null)
      onClose?.()
    } catch { /* toast no context */ } finally { setSalvando(false) }
  }

  return (
    /* API do DS: `open`/`onOpenChange` no Sheet raiz e `side` no SheetContent —
       `position`/`onClose` no raiz são IGNORADOS em silêncio e o sheet abre como
       painel lateral default com o título fora do lugar (bug reportado pelo dono
       18/08 15h). `!h-auto max-h-[88vh]` é o padrão dos sheets da escala (17/08):
       o painel acompanha o conteúdo; o corpo do DS já rola sozinho. */
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
        <SheetHeader className="pb-2">
          <SheetTitle>Salas do contrato — {turno === 'vespertino' ? 'tarde' : 'manhã'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-1 pb-2">
          <p className="text-xs text-muted-foreground">
            Marque onde cada papel está <b className="font-semibold text-foreground">hoje</b>.
            Em Automático vale o de sempre. Marcar a sala do plantão ou do sobreaviso
            coloca essa sala na conta das{' '}
            <b className="font-semibold text-foreground">2 vagas de urgência</b> enquanto
            ela tiver cirurgia aberta no turno.
          </p>
          {LINHAS.map((l) => (
            <div key={l.campo}>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor={`su-${l.campo}`}>
                {l.label}
              </label>
              <Select
                id={`su-${l.campo}`}
                options={opcoes}
                value={valores[l.campo]}
                onChange={(v) => setValores((prev) => ({ ...prev, [l.campo]: v }))}
              />
              <p className="mt-0.5 text-[11px] text-muted-foreground">{l.hint}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-border px-1 pb-4 pt-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
