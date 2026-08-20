/**
 * AddCasoSheet — acrescenta um procedimento à escala publicada (urgência,
 * encaixe, cirurgia que não saiu no mapa). O caso entra EXATAMENTE como os
 * demais: board re-agrupa e a coluna de liberação re-deriva sozinha.
 * LGPD: o nome do paciente é convertido em INICIAIS no blur (CHECK do banco
 * rejeita nome completo).
 */
import { useMemo, useRef, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Input, Button, ConfirmDialog } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { useUser } from '@/contexts/UserContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import useRosterResidentes from '@/hooks/useRosterResidentes'
import { iniciais } from '@/lib/excelEscala'
import cirurgiasSvc from '@/services/supabaseCirurgiasParticularesService'
import { casosResolvidos, familiaConvenio, normalizarSalaHro, normNome, turnoDeHora, salasDoHospital } from './utils'
import { GRAVIDADES, GRAVIDADE_LABEL, estadoUrgencias, salasContrato } from '@/lib/escalaCirurgicaUrgencias'
import useAgoraMinuto from './useAgoraMinuto'

const NOVA_SALA = '__nova__'

/** Auto-formata a hora enquanto digita: só dígitos → "HH:MM" (pedido do dono 24/07). */
const formatHora = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}
const GRAVIDADE_OPCOES = GRAVIDADES.map((g) => ({ value: g, label: GRAVIDADE_LABEL[g] }))

// Postos do contrato de urgência do HRO (dono 19/08): quem adiciona a urgência
// já diz QUEM a faz. A escolha vira CONFIGURAÇÃO de sala (urgencias_meta) — o
// mesmo dado do ⚙ da faixa — nunca um campo do caso: o posto é derivado da
// sala, e posto já ocupado deixa o excedente virar "Extra" sozinho
// (distribuirPostos). Desde 20/08 marcar plantão/sobreaviso numa sala É o que a
// faz ENTRAR na contagem das 2 vagas — antes só trocava o rótulo, e a sala
// marcada seguia contando 0.
const POSTO_AUTO = '__auto__'
const POSTOS = [
  { value: 'plantao', label: 'Plantão' },
  { value: 'sobreaviso', label: 'Sobreaviso' },
  { value: 'orto', label: 'Ortopedia' },
  { value: 'co', label: 'CO' },
]
// defaults do contrato — iguais aos de CONTRATO_HRO.manha.dedicadas
const POSTO_SALA_PADRAO = { orto: 'Sala 4', co: 'Sala 7 - CO' }

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

export default function AddCasoSheet({ escala, turno, onClose, onPreencherCobranca, postoInicial = '', salaInicial = '' }) {
  const { adicionarCaso, definirSalasUrgencia } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { options: rosterOpcoes, rosterByUid } = useRosterAnestesistas()
  const { options: opcoesResidente, residenteByUid } = useRosterResidentes()
  const [sala, setSala] = useState(() => salaInicial || '')
  const [novaSala, setNovaSala] = useState('')
  const [hora, setHora] = useState('')
  const [paciente, setPaciente] = useState('')
  const [idade, setIdade] = useState('')
  const [procedimento, setProcedimento] = useState('')
  const [cirurgiao, setCirurgiao] = useState('')
  const [convenio, setConvenio] = useState('')
  const [anestesistaUid, setAnestesistaUid] = useState('')
  const [residenteUid, setResidenteUid] = useState('')
  const [tipo, setTipo] = useState('urgencia')
  const [gravidade, setGravidade] = useState('')
  const [posto, setPosto] = useState(() => postoInicial || POSTO_AUTO)
  const [salvando, setSalvando] = useState(false)
  // Caso particular recém-adicionado: oferece preencher a cobrança agora
  // (o rascunho em Cirurgias Particulares já nasceu via trigger no banco).
  const [casoParticular, setCasoParticular] = useState(null)
  // LGPD: a escala só grava INICIAIS (blur converte), mas p/ caso PARTICULAR o
  // nome completo digitado é aproveitado p/ completar a COBRANÇA — guarda o
  // último valor digitado que ainda era um nome de verdade.
  const nomeCompletoRef = useRef('')

  // TODAS as salas do hospital (não só as que já têm caso hoje): sala que abriu
  // na escala precisa estar aqui — pedido do dono 26/07.
  const salasOpcoes = useMemo(() => [
    ...salasDoHospital(escala?.hospital, escala?.casos).map((s) => ({ value: s, label: s })),
    { value: NOVA_SALA, label: '+ Nova sala…' },
  ], [escala])

  // Sala digitada à mão passa pela MESMA normalização da importação quando é HRO
  // (dono 20/08): "Sala 7" tem de virar "Sala 7 - CO", senão a mesma sala nasce
  // com dois rótulos e o quadro a parte em dois blocos.
  const salaBruta = sala === NOVA_SALA ? novaSala.trim() : sala
  const salaFinal = escala?.hospital === 'hro' ? normalizarSalaHro(salaBruta) : salaBruta
  // OBRIGATÓRIOS (dono 29/07): cirurgião, convênio e tipo entram na exigência.
  // Não é burocracia — cada um alimenta uma decisão a jusante: o CIRURGIÃO agrupa
  // a linha na coluna de liberação, o CONVÊNIO decide se o caso vira cobrança
  // particular (o trigger `fn_convenio_particular` lê exatamente este campo) e o
  // TIPO pinta urgência/emergência no board. Caso adicionado sem eles nascia
  // incompleto e alguém tinha de caçar a informação depois.
  // GRAVIDADE só é exigida em urgência/emergência, pelo mesmo critério dos
  // demais: ela alimenta a ORDEM DA FILA de urgências do HRO, e sem ela a
  // urgência nasce sem lugar na fila.
  const exigeGravidade = tipo === 'urgencia' || tipo === 'emergencia'

  // POSTO (só HRO + urgência/emergência): as opções avisam quem já está tomado —
  // escolher um tomado é permitido, e o excedente aparece como Extra sozinho.
  const agoraMin = useAgoraMinuto()
  const mostraPosto = escala?.hospital === 'hro' && exigeGravidade
  const postoOpcoes = useMemo(() => {
    if (!mostraPosto) return []
    const hojeIso = escala?.data || null
    const estado = estadoUrgencias(casosResolvidos(escala), {
      hospital: 'hro', turno, agoraMin, dataEscala: hojeIso, hojeIso,
      salas: salasContrato(escala?.urgenciasMeta, turno),
    })
    const tomado = {
      plantao: !!estado.postos.find((pp) => pp.papel === 'plantonista')?.item,
      sobreaviso: !!estado.postos.find((pp) => pp.papel === 'sobreaviso')?.item,
      orto: !!estado.dedicados.find((d) => d.papel === 'orto')?.item,
      co: !!estado.dedicados.find((d) => d.papel === 'co')?.item,
    }
    return [
      { value: POSTO_AUTO, label: 'Automático (pela sala)' },
      ...POSTOS.map((o) => ({ ...o, label: tomado[o.value] ? `${o.label} · ocupado` : o.label })),
    ]
  }, [mostraPosto, escala, turno, agoraMin])
  const valido = !!(salaFinal && procedimento.trim() && cirurgiao.trim() && convenio.trim() && tipo
    && (!exigeGravidade || gravidade))

  // Emergência é IMEDIATA por definição na adaptação da NCEPOD, então o campo
  // já nasce preenchido — pré-preenchimento coerente, não default silencioso:
  // só age quando a gravidade ainda está vazia, e continua editável.
  const escolherTipo = (novo) => {
    setTipo(novo)
    if (novo === 'emergencia' && !gravidade) setGravidade('imediata')
    if (novo === 'eletiva') setGravidade('')
  }

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
        // Sem anestesista escolhido → "?" COM a flag (bug 30/07): '' sem flag
        // herdava o dono da sala na exibição (resolverAnestesistas) e o caso
        // sumia do alerta das Liberações — encaixe descoberto nunca some em
        // silêncio, aparece como "?" até alguém definir.
        anestesista: anestesistaUid ? alias : '?',
        anestesistaUserId: anestesistaUid || null,
        semAnestesista: !anestesistaUid,
        // residente ACOMPANHA (não responde pelo caso) — lista própria, dono 29/07
        residente: residenteUid ? (residenteByUid.get(residenteUid)?.nome || null) : null,
        residenteUserId: residenteUid || null,
        tipo,
        gravidade: exigeGravidade ? gravidade : null,
        // turno EXPLÍCITO: encaixe sem hora ficaria nos dois turnos (bug 26/07)
        turno: turnoDeHora(hora.trim()) || turno || undefined,
      })
      // POSTO escolhido → vira CONFIG de sala do papel, no turno DO CASO. Só
      // grava quando aquele papel ainda está em automático E a sala do caso não
      // é a que já responde por ele — config existente NUNCA é sobrescrita por
      // aqui (o caso entra como comum e, extrapolando as 2 vagas, o quadro o
      // mostra como Extra sozinho — exatamente o combinado com o dono 19/08).
      if (novo && mostraPosto && posto !== POSTO_AUTO) {
        const turnoCaso = turnoDeHora(hora.trim()) || turno || 'matutino'
        const cfg = salasContrato(escala?.urgenciasMeta, turnoCaso)
        const jaResponde = cfg[posto] || POSTO_SALA_PADRAO[posto] || null
        if (!cfg[posto] && (!jaResponde || normNome(jaResponde) !== normNome(salaFinal))) {
          const limpo = Object.fromEntries(Object.entries(cfg).filter(([, v]) => v))
          await definirSalasUrgencia(escala, turnoCaso, { ...limpo, [posto]: salaFinal })
            .catch(() => {}) // caso já entrou; o toast de erro da config avisa
        }
      }
      // Particular → cobrança auto-criada no banco; completa o NOME com o que
      // foi digitado (a escala só guarda iniciais) e oferece preencher já.
      if (novo && familiaConvenio(novo.convenio) === 'particular') {
        if (nomeCompletoRef.current) {
          await cirurgiasSvc
            .completarPacienteDoCaso(novo.id, nomeCompletoRef.current, {
              userId: user?.uid || user?.id, userName: user?.displayName,
            })
            .catch(() => {}) // rascunho fica com iniciais + badge "Completar dados"
        }
        if (onPreencherCobranca) {
          setCasoParticular(novo)
          return
        }
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
        description="A cobrança já foi criada em Cirurgias Particulares — confira o nome do paciente e informe o valor. Preencher agora?"
        confirmText="Preencher cobrança"
        cancelText="Depois"
      />
    )
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom" className="max-h-[90vh]">
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
              <Input id="ac-hora" value={hora} onChange={(e) => setHora(formatHora(e.target.value))}
                inputMode="numeric" placeholder="ex.: 15:30" />
            </Campo>
            <Campo id="ac-idade" label="Idade">
              <Input id="ac-idade" value={idade} onChange={(e) => setIdade(e.target.value)} placeholder="ex.: 47a" />
            </Campo>
          </div>
          <Campo id="ac-paciente" label="Paciente (vira iniciais)">
            <Input id="ac-paciente" value={paciente}
              onChange={(e) => {
                setPaciente(e.target.value)
                // nome de verdade (palavra 3+ letras) → memoriza p/ a cobrança de particular
                if (/\p{L}{3,}/u.test(e.target.value)) nomeCompletoRef.current = e.target.value.trim()
              }}
              onBlur={() => setPaciente(iniciais(paciente))}
              placeholder="Nome ou iniciais — salvo só como iniciais (LGPD)" />
          </Campo>
          <Campo id="ac-proc" label="Procedimento *">
            <Input id="ac-proc" value={procedimento} onChange={(e) => setProcedimento(e.target.value)} placeholder="ex.: Apendicectomia" />
          </Campo>
          <Campo id="ac-cir" label="Cirurgião *">
            <Input id="ac-cir" value={cirurgiao} onChange={(e) => setCirurgiao(e.target.value)} placeholder="ex.: Mateus Baptistella" />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo id="ac-conv" label="Convênio *">
              <Input id="ac-conv" value={convenio} onChange={(e) => setConvenio(e.target.value)} placeholder="SUS, Unimed, BRF…" />
            </Campo>
            <Campo id="ac-tipo" label="Tipo *">
              <Select options={TIPOS} value={tipo} onChange={escolherTipo} />
            </Campo>
          </div>
          {exigeGravidade && (
            <Campo id="ac-grav" label="Gravidade *">
              <Select options={GRAVIDADE_OPCOES} value={gravidade} onChange={setGravidade} placeholder="Quem entra primeiro" />
            </Campo>
          )}
          {mostraPosto && (
            <Campo id="ac-posto" label="Quem faz (posto do contrato)">
              <Select options={postoOpcoes} value={posto} onChange={setPosto} />
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Posto ocupado? Pode escolher mesmo assim — o excedente entra como Extra.
              </p>
            </Campo>
          )}
          {/* diz O QUE falta: com 4 obrigatórios, botão cinza sem explicação vira
              tentativa e erro no meio do plantão */}
          {!valido && (
            <p className="text-xs text-warning">
              Falta preencher: {[
                !salaFinal && 'sala',
                !procedimento.trim() && 'procedimento',
                !cirurgiao.trim() && 'cirurgião',
                !convenio.trim() && 'convênio',
                !tipo && 'tipo',
                exigeGravidade && !gravidade && 'gravidade',
              ].filter(Boolean).join(', ')}.
            </p>
          )}
          <Campo id="ac-anest" label="Anestesista (opcional)">
            <Select options={rosterOpcoes} value={anestesistaUid} onChange={setAnestesistaUid}
              placeholder="Selecionar anestesista…" searchable />
          </Campo>
          <Campo id="ac-residente" label="Residente (opcional)">
            <Select options={opcoesResidente} value={residenteUid} onChange={setResidenteUid}
              placeholder="Selecionar residente…" searchable />
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
