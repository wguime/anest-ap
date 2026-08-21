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
import { conveniosDaEscala, familiaConvenio, normalizarSalaHro, turnoDeHora, salasDoHospital } from './utils'
import { chaveSala, CONTRATO_HRO, salasContrato } from '@/lib/escalaCirurgicaUrgencias'
import ChipsEscolha, { GRAVIDADE_CHIPS, TIPOS_CIRURGIA } from './ChipsEscolha'
import useEstadoUrgencias from './useEstadoUrgencias'

const NOVA_SALA = '__nova__'
const OUTRO_CONVENIO = '__outro__'

/** Auto-formata a hora enquanto digita: só dígitos → "HH:MM" (pedido do dono 24/07). */
const formatHora = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

// Postos do contrato de urgência do HRO (dono 19/08): quem adiciona a urgência
// já diz QUEM a faz. A escolha vira CONFIGURAÇÃO de sala (urgencias_meta) — o
// mesmo dado do ⚙ da faixa — nunca um campo do caso: o posto é derivado da
// sala, e posto já ocupado deixa o excedente virar "Extra" sozinho
// (distribuirPostos). Desde 20/08 marcar plantão/sobreaviso numa sala É o que a
// faz ENTRAR na contagem das 2 vagas — antes só trocava o rótulo, e a sala
// marcada seguia contando 0.
const POSTO_AUTO = '__auto__'
const POSTOS = [
  { value: 'plantao', label: 'Plantonista do HRO' },
  { value: 'sobreaviso', label: 'Sobreaviso' },
  { value: 'orto', label: 'Anestesista da ortopedia' },
  { value: 'co', label: 'Anestesista do CO' },
]
// Defaults do contrato lidos da FONTE (antes eram copiados à mão aqui e ficaram
// para trás quando as numéricas do HRO ganharam o bloco em 20/08).
const POSTO_SALA_PADRAO = CONTRATO_HRO.manha.dedicadas

// Fora do componente: definido inline, a identidade mudaria a cada render e o
// React remontaria o subtree — input perdendo foco a cada tecla.
const Campo = ({ id, label, children }) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
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
  const [outroConvenio, setOutroConvenio] = useState('')
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

  // Sala DIGITADA à mão passa pela MESMA normalização da importação quando é HRO
  // (dono 20/08): "Sala 7" tem de virar "Bloco A - Sala 7 - CO", senão a mesma
  // sala nasce com dois rótulos e o quadro a parte em dois blocos.
  // ⚠️ só a digitada: a opção escolhida na lista já vem canônica OU na grafia do
  // DIA, que vence de propósito — normalizar a escolha reescreveria a "Sala 4"
  // de uma escala publicada antes de 20/08 e criaria o segundo bloco justamente
  // no caminho que existe para evitá-lo.
  const digitouSala = sala === NOVA_SALA
  const salaBruta = digitouSala ? novaSala.trim() : sala
  const salaFinal = digitouSala && escala?.hospital === 'hro' ? normalizarSalaHro(salaBruta) : salaBruta

  // CONVÊNIO em lista (dono 20/08): campo livre virou "Unirmd"/"Particulae" no
  // banco, e convênio com erro de digitação some do agrupamento por família — e,
  // no particular, da COBRANÇA, que casa o texto. Digitar continua possível.
  const conveniosOpcoes = useMemo(() => [
    ...conveniosDaEscala(escala?.casos).map((c) => ({ value: c, label: c })),
    { value: OUTRO_CONVENIO, label: '+ Outro convênio…' },
  ], [escala])
  const convenioFinal = convenio === OUTRO_CONVENIO ? outroConvenio.trim() : convenio
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
  // MESMO estado da faixa (dono 21/08): montar os `opts` aqui passava
  // `hojeIso = escala.data`, e a faixa passava o hoje de verdade — numa escala de
  // outro dia os dois aplicavam linhas de contrato DIFERENTES, e este campo dizia
  // "CO · ocupado" ao lado de um card de CO livre.
  const { estado } = useEstadoUrgencias(escala, { hospital: 'hro', turno })
  const mostraPosto = escala?.hospital === 'hro' && exigeGravidade
  const postoOpcoes = useMemo(() => {
    if (!mostraPosto) return []
    const tomado = {
      plantao: !!estado.postos.find((pp) => pp.papel === 'plantonista')?.item,
      sobreaviso: !!estado.postos.find((pp) => pp.papel === 'sobreaviso')?.item,
      orto: !!estado.dedicados.find((d) => d.papel === 'orto')?.item,
      co: !!estado.dedicados.find((d) => d.papel === 'co')?.item,
    }
    return [
      { value: POSTO_AUTO, label: 'Automático — decide pela sala' },
      ...POSTOS.map((o) => ({ ...o, label: tomado[o.value] ? `${o.label} · ocupado` : o.label })),
    ]
  }, [mostraPosto, estado])
  const valido = !!(salaFinal && procedimento.trim() && cirurgiao.trim() && convenioFinal && tipo
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
        convenio: convenioFinal,
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
        // chaveSala, não normNome: numa escala publicada antes de 20/08 a sala do
        // caso é "Sala 4" e o default é "Bloco A - Sala 4" — mesma sala, e gravar
        // config por causa da grafia sobrescreveria o automático sem motivo.
        if (!cfg[posto] && (!jaResponde || chaveSala(jaResponde) !== chaveSala(salaFinal))) {
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
      {/* MESMO painel do detalhe do caso (dono 17/08): `!h-auto` porque o
          POSITION_CLASSES.bottom do DS fixa h-[85vh] e o formulário curto
          nasceria com 85% da tela vazia. */}
      <SheetContent side="bottom" className="!h-auto max-h-[90vh]">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Adicionar caso
          </SheetTitle>
        </SheetHeader>

        {/* UM CARTÃO POR PERGUNTA (dono 20/08: "no padrão das outras páginas da
            escala cirúrgica") — a mesma divisão do detalhe do caso: que cirurgia
            é · como ela entra · quem está e onde. Antes eram 12 campos numa
            coluna só, todos no mesmo peso, e o TIPO era um Select enquanto o
            detalhe já perguntava a mesma coisa em pastilhas. */}
        <div className="space-y-2.5 px-1 pb-2">
          <article className="rounded-2xl border border-border-strong bg-card-elevated p-3">
            <h3 className="mb-2 text-[15px] font-extrabold">A cirurgia</h3>
            <div className="space-y-2.5">
              <Campo id="ac-proc" label="Procedimento *">
                <Input id="ac-proc" value={procedimento} onChange={(e) => setProcedimento(e.target.value)}
                  placeholder="ex.: Apendicectomia" />
              </Campo>
              <div className="grid grid-cols-[1fr_92px] gap-2">
                <Campo id="ac-paciente" label="Paciente">
                  <Input id="ac-paciente" value={paciente}
                    onChange={(e) => {
                      setPaciente(e.target.value)
                      // nome de verdade (palavra 3+ letras) → memoriza p/ a cobrança de particular
                      if (/\p{L}{3,}/u.test(e.target.value)) nomeCompletoRef.current = e.target.value.trim()
                    }}
                    onBlur={() => setPaciente(iniciais(paciente))}
                    placeholder="Nome ou iniciais" />
                </Campo>
                <Campo id="ac-idade" label="Idade">
                  <Input id="ac-idade" value={idade} onChange={(e) => setIdade(e.target.value)} placeholder="47a" />
                </Campo>
              </div>
              <p className="-mt-1 text-[11.5px] text-muted-foreground">
                O nome vira INICIAIS ao sair do campo — a escala não guarda nome de paciente (LGPD).
              </p>
              <Campo id="ac-conv" label="Convênio *">
                <Select options={conveniosOpcoes} value={convenio} onChange={setConvenio}
                  placeholder="Selecionar convênio…" searchable />
              </Campo>
              {convenio === OUTRO_CONVENIO && (
                <Input value={outroConvenio} onChange={(e) => setOutroConvenio(e.target.value)}
                  placeholder="Nome do convênio" />
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-border-strong p-3">
            <h3 className="mb-2 text-[15px] font-extrabold">Tipo e prioridade</h3>
            {/* MESMAS pastilhas do cartão Andamento do detalhe (ChipsEscolha). */}
            <ChipsEscolha
              opcoes={TIPOS_CIRURGIA}
              valor={tipo}
              onChange={escolherTipo}
              rotulo="Tipo"
              nota="urgência entra na conta do contrato"
            />
            {exigeGravidade && (
              <ChipsEscolha
                className="mt-3"
                opcoes={GRAVIDADE_CHIPS}
                valor={gravidade}
                onChange={setGravidade}
                rotulo="Gravidade *"
                nota="ordena a fila de urgências"
                aviso={!gravidade ? 'Sem classificação a urgência não tem lugar na fila.' : null}
              />
            )}
            {mostraPosto && (
              <div className="mt-3">
                <Campo id="ac-posto" label="Quem vai fazer esta urgência">
                  <Select options={postoOpcoes} value={posto} onChange={setPosto} />
                </Campo>
                <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                  O contrato do HRO paga <b className="font-semibold text-foreground">2 vagas de
                  urgência por turno</b> — plantonista e sobreaviso. A ortopedia e o CO têm
                  anestesista próprio e ficam fora dessa conta. Se a vaga escolhida já estiver
                  ocupada, esta urgência entra como <b className="font-semibold text-foreground">Extra</b>,
                  acima do contrato.
                </p>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-border-strong p-3">
            <h3 className="mb-2 text-[15px] font-extrabold">Quem está e onde</h3>
            <div className="space-y-2.5">
              <div className="grid grid-cols-[1fr_108px] gap-2">
                <Campo id="ac-sala" label="Sala *">
                  <Select options={salasOpcoes} value={sala} onChange={setSala} placeholder="Selecionar sala…" searchable />
                </Campo>
                <Campo id="ac-hora" label="Hora">
                  <Input id="ac-hora" value={hora} onChange={(e) => setHora(formatHora(e.target.value))}
                    inputMode="numeric" placeholder="15:30" />
                </Campo>
              </div>
              {sala === NOVA_SALA && (
                <Input value={novaSala} onChange={(e) => setNovaSala(e.target.value)} placeholder="Nome da sala (ex.: SALA 5)" />
              )}
              <Campo id="ac-cir" label="Cirurgião *">
                <Input id="ac-cir" value={cirurgiao} onChange={(e) => setCirurgiao(e.target.value)}
                  placeholder="ex.: Mateus Baptistella" />
              </Campo>
              <Campo id="ac-anest" label="Anestesista">
                <Select options={rosterOpcoes} value={anestesistaUid} onChange={setAnestesistaUid}
                  placeholder="Definir depois" searchable />
              </Campo>
              <Campo id="ac-residente" label="Residente">
                <Select options={opcoesResidente} value={residenteUid} onChange={setResidenteUid}
                  placeholder="Sem residente" searchable />
              </Campo>
            </div>
          </article>
        </div>

        {/* RODAPÉ do padrão dos sheets da escala: borda + par de botões. O que
            falta é dito por extenso — botão cinza sem explicação vira tentativa e
            erro no meio do plantão. */}
        <div className="border-t border-border px-1 pb-4 pt-3">
          {!valido && (
            <p className="mb-2 text-xs text-warning">
              Falta preencher: {[
                !salaFinal && 'sala',
                !procedimento.trim() && 'procedimento',
                !cirurgiao.trim() && 'cirurgião',
                !convenioFinal && 'convênio',
                !tipo && 'tipo',
                exigeGravidade && !gravidade && 'gravidade',
              ].filter(Boolean).join(', ')}.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
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
