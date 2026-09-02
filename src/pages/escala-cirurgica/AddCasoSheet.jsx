/**
 * AddCasoSheet — o formulário do CASO, nos dois sentidos:
 *   - sem `caso`: acrescenta um procedimento à escala publicada (urgência,
 *     encaixe, cirurgia que não saiu no mapa). Entra EXATAMENTE como os demais:
 *     board re-agrupa e a coluna de liberação re-deriva sozinha.
 *   - com `caso`: EDITA o que já está publicado (dono 01/09: "eventualmente
 *     algumas informações precisam ser atualizadas (hora, local, cirurgião…) ou
 *     eventualmente procedimento foi adicionado de forma errada").
 *
 * UM FORMULÁRIO SÓ para os dois (modelo escolhido pelo dono em protótipo a
 * 430px, 01/09): a alternativa era espalhar mini-editores pelo detalhe do caso,
 * e o painel passava de 721px (cabe inteiro) para 1163px, com o excluir 425px
 * abaixo da dobra. Aqui a validação é uma, a tela a aprender é uma, e o detalhe
 * do caso volta a ser o painel de ESTADO que ele diz ser desde 17/08.
 *
 * O que NÃO se edita por aqui, de propósito: o ANESTESISTA (o
 * `DefinirAnestesistaSheet` decide dupla, substituição e mostra onde cada colega
 * está — um Select simples perderia tudo isso; e um Select vazio salvo sem
 * querer apagaria a dupla "A + B") e o POSTO do contrato do HRO, que é
 * configuração de SALA e não campo do caso.
 *
 * EXCLUIR só no caso `origem === 'manual'` (decisão do dono 01/09): o que veio
 * do mapa se conserta republicando o turno — apagá-lo por engano custaria
 * reimportar o dia. Ver migration 20260901130000.
 *
 * LGPD: o nome do paciente é convertido em INICIAIS no blur (CHECK do banco
 * rejeita nome completo).
 */
import { useMemo, useRef, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
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
const SEM_RESIDENTE = '__sem__'

// Turno por extenso nas três regências que a pergunta de mover usa. O módulo
// inteiro fala "manhã/tarde" na tela e guarda 'matutino'/'vespertino' no banco.
const TURNO_ARTIGO = { matutino: 'da manhã', vespertino: 'da tarde' }
const TURNO_PREP = { matutino: 'a manhã', vespertino: 'a tarde' }
const TURNO_EM = { matutino: 'na manhã', vespertino: 'na tarde' }

/**
 * Converte NOME em iniciais; o que já ESTÁ em iniciais fica intacto.
 *
 * O `iniciais()` cru não é idempotente — "M.C.G." é um token só, e ele devolve
 * "M.", destruindo o dado. Passava despercebido enquanto o formulário só criava
 * caso (ninguém abre o "Adicionar" com iniciais prontas); ao reabrir para EDITAR
 * um caso já publicado, o simples tocar no campo apagaria duas letras.
 *
 * O teste é o MESMO predicado do CHECK do banco (`[[:alpha:]]{3,}`): o que não
 * tem três letras seguidas já é forma aceita como iniciais lá — o guard não
 * afrouxa a regra LGPD, ele para de reprocessar o que já passou por ela.
 */
const soIniciais = (v) => {
  const bruto = String(v || '').trim()
  return /\p{L}{3,}/u.test(bruto) ? iniciais(bruto) : bruto
}

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

export default function AddCasoSheet({ escala, turno, caso = null, onClose, onPreencherCobranca, postoInicial = '', salaInicial = '' }) {
  const { adicionarCaso, atualizarCaso, excluirCaso, definirSalasUrgencia } = useEscalaCirurgicaActions()
  const { user } = useUser()
  const { options: rosterOpcoes, rosterByUid } = useRosterAnestesistas()
  const { options: opcoesResidente, residenteByUid } = useRosterResidentes()
  const edicao = !!caso
  // Em edição os campos abrem com o que está publicado. Sala e convênio guardam
  // DOIS estados (opção da lista + texto livre): quando o valor gravado não está
  // entre as opções — sala de um dia antigo, convênio digitado antes da lista de
  // 20/08 — ele abre no campo livre em vez de sumir do formulário.
  const salasBase = useMemo(() => salasDoHospital(escala?.hospital, escala?.casos), [escala])
  const conveniosBase = useMemo(() => conveniosDaEscala(escala?.casos), [escala])
  const salaAtual = String(caso?.sala || '')
  const convenioAtual = String(caso?.convenio || '')
  const salaNaLista = !!salaAtual && salasBase.includes(salaAtual)
  const convenioNaLista = !!convenioAtual && conveniosBase.includes(convenioAtual)

  const [sala, setSala] = useState(() => {
    if (!edicao) return salaInicial || ''
    return salaNaLista ? salaAtual : (salaAtual ? NOVA_SALA : '')
  })
  const [novaSala, setNovaSala] = useState(() => (edicao && !salaNaLista ? salaAtual : ''))
  const [hora, setHora] = useState(() => String(caso?.hora || ''))
  const [paciente, setPaciente] = useState(() => String(caso?.pacienteIniciais || ''))
  const [idade, setIdade] = useState(() => String(caso?.idade || ''))
  const [procedimento, setProcedimento] = useState(() => String(caso?.procedimento || ''))
  const [cirurgiao, setCirurgiao] = useState(() => String(caso?.cirurgiao || ''))
  const [convenio, setConvenio] = useState(() => {
    if (!edicao) return ''
    return convenioNaLista ? convenioAtual : (convenioAtual ? OUTRO_CONVENIO : '')
  })
  const [outroConvenio, setOutroConvenio] = useState(() => (edicao && !convenioNaLista ? convenioAtual : ''))
  const [anestesistaUid, setAnestesistaUid] = useState('')
  const [residenteUid, setResidenteUid] = useState(() => String(caso?.residenteUserId || ''))
  const [tipo, setTipo] = useState(() => (edicao ? (caso.tipo || 'eletiva') : 'urgencia'))
  const [gravidade, setGravidade] = useState(() => String(caso?.gravidade || ''))
  const [posto, setPosto] = useState(() => postoInicial || POSTO_AUTO)
  const [salvando, setSalvando] = useState(false)
  // Confirmações que interrompem o fechamento do formulário: excluir e a hora
  // que caiu no outro período.
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [turnoDivergente, setTurnoDivergente] = useState(null) // { de, para, hora }
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
    ...salasBase.map((s) => ({ value: s, label: s })),
    { value: NOVA_SALA, label: '+ Nova sala…' },
  ], [salasBase])

  // Sala DIGITADA à mão passa pela MESMA normalização da importação quando é HRO
  // (dono 20/08): "Sala 7" tem de virar "Bloco A - Sala 7 - CO", senão a mesma
  // sala nasce com dois rótulos e o quadro a parte em dois blocos.
  // ⚠️ só a digitada: a opção escolhida na lista já vem canônica OU na grafia do
  // DIA, que vence de propósito — normalizar a escolha reescreveria a "Sala 4"
  // de uma escala publicada antes de 20/08 e criaria o segundo bloco justamente
  // no caminho que existe para evitá-lo.
  // ⚠️ e, em EDIÇÃO, nem a digitada quando ela é a sala que já está gravada: o
  // caso de um dia antigo abre no campo livre (a grafia dele não está na lista),
  // e normalizar sem ninguém ter tocado em nada renomearia a sala na hora de
  // salvar — o mesmo estrago, pelo caminho de trás.
  const digitouSala = sala === NOVA_SALA
  const salaBruta = digitouSala ? novaSala.trim() : sala
  const salaIntocada = edicao && salaBruta === salaAtual
  const salaFinal = !salaIntocada && digitouSala && escala?.hospital === 'hro'
    ? normalizarSalaHro(salaBruta)
    : salaBruta

  // CONVÊNIO em lista (dono 20/08): campo livre virou "Unirmd"/"Particulae" no
  // banco, e convênio com erro de digitação some do agrupamento por família — e,
  // no particular, da COBRANÇA, que casa o texto. Digitar continua possível.
  const conveniosOpcoes = useMemo(() => [
    ...conveniosBase.map((c) => ({ value: c, label: c })),
    { value: OUTRO_CONVENIO, label: '+ Outro convênio…' },
  ], [conveniosBase])
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
  // POSTO fica FORA da edição: ele não é campo do caso, é configuração da SALA
  // (urgencias_meta) gravada no ato de acrescentar. Reabrir o formulário para
  // corrigir a hora e, de lambuja, reescrever quem responde pela vaga do
  // contrato seria efeito colateral invisível — isso se muda no ⚙ da faixa.
  const mostraPosto = escala?.hospital === 'hro' && exigeGravidade && !edicao
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

  // EXCLUIR só alcança o caso que alguém digitou (dono 01/09). O que veio do
  // mapa se conserta republicando o turno — e a marca vem do banco, não de um
  // palpite da tela (coluna `origem`, migration 20260901130000).
  const podeExcluir = edicao && caso?.origem === 'manual'
  // A confirmação NOMEIA a cirurgia — "tem certeza?" genérico não dá a quem
  // opera o meio de perceber que abriu o caso errado. Os dois avisos são as
  // situações em que excluir provavelmente NÃO é o que a pessoa quer.
  const jaAconteceu = caso?.statusCirurgia === 'iniciada' || caso?.statusCirurgia === 'terminada'
  const avisoExclusao = [
    `${caso?.procedimento || 'Este caso'} — ${[salaAtual, caso?.hora, caso?.cirurgiao].filter(Boolean).join(', ')}.`,
    'Some do quadro para toda a equipe. Não dá para desfazer.',
    jaAconteceu && 'Esta cirurgia já foi iniciada: se ela aconteceu, marque Suspensa no detalhe do caso — o excluir é para o caso lançado por engano.',
    familiaConvenio(caso?.convenio) === 'particular'
      && 'A cobrança já criada em Cirurgias Particulares NÃO some junto — cancele por lá.',
  ].filter(Boolean).join(' ')

  // Emergência é IMEDIATA por definição na adaptação da NCEPOD, então o campo
  // já nasce preenchido — pré-preenchimento coerente, não default silencioso:
  // só age quando a gravidade ainda está vazia, e continua editável.
  const escolherTipo = (novo) => {
    setTipo(novo)
    if (novo === 'emergencia' && !gravidade) setGravidade('imediata')
    if (novo === 'eletiva') setGravidade('')
  }

  /**
   * Patch da EDIÇÃO: só o que MUDOU vai para o banco.
   *
   * Mandar o formulário inteiro seria destrutivo aqui — o `anestesista` de uma
   * dupla ("A + B", uid null) e a `ordem` dentro da sala não têm campo nesta
   * tela, e reenviá-los a partir do estado local os apagaria. Diff também deixa
   * "abrir e fechar sem tocar em nada" ser literalmente uma operação nula, sem
   * bater no servidor e sem carimbar `updated_at`.
   */
  const patchEdicao = () => {
    const patch = {}
    const põe = (campo, novo, atual) => { if (novo !== atual) patch[campo] = novo }
    põe('sala', salaFinal, salaAtual)
    põe('hora', hora.trim(), String(caso?.hora || ''))
    põe('pacienteIniciais', soIniciais(paciente), String(caso?.pacienteIniciais || ''))
    põe('idade', idade.trim(), String(caso?.idade || ''))
    põe('procedimento', procedimento.trim(), String(caso?.procedimento || ''))
    põe('convenio', convenioFinal, convenioAtual)
    põe('cirurgiao', cirurgiao.trim(), String(caso?.cirurgiao || ''))
    põe('tipo', tipo, caso?.tipo || 'eletiva')
    // gravidade só existe em urgência/emergência; voltar para eletiva a LIMPA
    // (mesma regra do `mudarTipo` do detalhe e do pré-preenchimento daqui).
    const gravFinal = exigeGravidade ? (gravidade || null) : null
    if (gravFinal !== (caso?.gravidade || null)) patch.gravidade = gravFinal
    // residente vai em PAR (nome + uid): gravar só um dos dois deixaria a aba
    // "Minhas" do residente e o nome no card apontando para pessoas diferentes.
    const resNovo = residenteUid === SEM_RESIDENTE ? '' : residenteUid
    if (resNovo !== String(caso?.residenteUserId || '')) {
      patch.residente = resNovo ? (residenteByUid.get(resNovo)?.nome || null) : null
      patch.residenteUserId = resNovo || null
    }
    return patch
  }

  const salvarEdicao = async () => {
    const patch = patchEdicao()
    if (!Object.keys(patch).length) { onClose?.(); return }
    setSalvando(true)
    try {
      await atualizarCaso(escala, caso.id, patch)
      // HORA que cai no OUTRO período: pergunta antes de mover (dono 01/09).
      // O turno é campo PRÓPRIO do caso desde 26/07 (encaixe sem hora ficava nos
      // dois), então corrigir a hora não o move sozinho — e mover sem avisar
      // faria o caso sumir da tela de quem acabou de editá-lo.
      const destino = patch.hora !== undefined ? turnoDeHora(patch.hora) : null
      // O turno GRAVADO, não `turnoDoCaso`: sem turno explícito (legado) ou no
      // modo FDS, quem filtra o quadro já é a própria hora — o caso se move
      // sozinho e perguntar seria pedir permissão para o que já aconteceu.
      const atual = ['matutino', 'vespertino'].includes(caso?.turno) ? caso.turno : null
      if (destino && atual && destino !== atual) {
        setTurnoDivergente({ de: atual, para: destino, hora: patch.hora })
        return
      }
      onClose?.()
    } catch { /* toast no context */ }
    finally { setSalvando(false) }
  }

  const submeter = async () => {
    if (!valido || salvando) return
    if (edicao) return salvarEdicao()
    setSalvando(true)
    try {
      const r = anestesistaUid ? rosterByUid.get(anestesistaUid) : null
      const alias = r ? (r.apelidos[0] || r.nome.split(/\s+/)[0].toUpperCase()) : ''
      const daSala = (escala?.casos || []).filter((c) => c.sala === salaFinal)
      const novo = await adicionarCaso(escala, {
        sala: salaFinal,
        ordem: daSala.reduce((m, c) => Math.max(m, c.ordem ?? 0), -1) + 1,
        hora: hora.trim(),
        pacienteIniciais: soIniciais(paciente),
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

  const confirmarExclusao = async () => {
    setConfirmandoExclusao(false)
    setSalvando(true)
    try {
      await excluirCaso(escala, caso.id)
      onClose?.()
    } catch { /* toast no context; a folha fica aberta p/ tentar de novo */ }
    finally { setSalvando(false) }
  }

  // MOVER de turno: o caso já foi salvo com a hora nova; falta só decidir onde
  // ele mora. Ficar é uma resposta legítima (o caso das 15:00 que a equipe
  // acompanha na tela da manhã), então "Deixar" também fecha sem erro.
  const moverDeTurno = async () => {
    const destino = turnoDivergente?.para
    setTurnoDivergente(null)
    setSalvando(true)
    try {
      await atualizarCaso(escala, caso.id, { turno: destino })
    } catch { /* toast no context; a hora nova já está gravada */ }
    finally { setSalvando(false); onClose?.() }
  }

  if (turnoDivergente) {
    return (
      <ConfirmDialog
        open
        onClose={() => { setTurnoDivergente(null); onClose?.() }}
        onConfirm={moverDeTurno}
        title={`${turnoDivergente.hora} é ${TURNO_ARTIGO[turnoDivergente.para]}`}
        description={`Este caso está na escala ${TURNO_ARTIGO[turnoDivergente.de]}. Mover para ${TURNO_PREP[turnoDivergente.para]}? Ficando onde está, ele aparece com ${turnoDivergente.hora} no quadro do outro período.`}
        confirmText={`Mover para ${TURNO_PREP[turnoDivergente.para]}`}
        cancelText={`Deixar ${TURNO_EM[turnoDivergente.de]}`}
      />
    )
  }

  if (confirmandoExclusao) {
    return (
      <ConfirmDialog
        open
        variant="danger"
        onClose={() => setConfirmandoExclusao(false)}
        onConfirm={confirmarExclusao}
        title="Excluir este caso?"
        description={avisoExclusao}
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    )
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
            {edicao
              ? <><Pencil className="w-4 h-4" /> Editar caso</>
              : <><Plus className="w-4 h-4" /> Adicionar caso</>}
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
                    onBlur={() => setPaciente(soIniciais(paciente))}
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
              {/* MESMO aviso que o editor de convênio do detalhe já dava: o
                  trigger cria a cobrança sozinho ao virar Particular, mas sair de
                  Particular NÃO a apaga — sem isto, corrigir o convênio deixa uma
                  cobrança viva de uma cirurgia que não é particular. */}
              {edicao && (
                <p className="-mt-1 text-[11.5px] leading-snug text-muted-foreground">
                  Particular gera a cobrança automática. Saindo de Particular, a cobrança já criada
                  NÃO some sozinha — cancele em Cirurgias Particulares.
                </p>
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
              {edicao ? (
                /* Trocar o anestesista é o `DefinirAnestesistaSheet`, no detalhe do
                   caso: lá se vê onde cada colega está, marca-se dupla na mesma
                   cirurgia e assume-se a posição na fila. Um Select simples aqui
                   perderia tudo isso — e, salvo vazio sem querer, apagaria a
                   dupla "A + B", que não cabe num uid. */
                <p className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-[11.5px] leading-snug text-muted-foreground">
                  O <b className="font-semibold text-foreground">anestesista</b> se troca no detalhe
                  do caso, em “Trocar” — lá dá para ver onde cada colega está e marcar dupla.
                </p>
              ) : (
                <Campo id="ac-anest" label="Anestesista">
                  <Select options={rosterOpcoes} value={anestesistaUid} onChange={setAnestesistaUid}
                    placeholder="Definir depois" searchable />
                </Campo>
              )}
              <Campo id="ac-residente" label="Residente">
                {/* Em edição a lista ganha "Sem residente": no formulário novo o
                    vazio é o placeholder, mas quem já tem residente gravado
                    precisa de uma opção para TIRAR — sem ela, residente lançado
                    por engano ficaria no caso para sempre. */}
                <Select
                  options={edicao ? [{ value: SEM_RESIDENTE, label: 'Sem residente' }, ...opcoesResidente] : opcoesResidente}
                  value={residenteUid} onChange={setResidenteUid}
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
          {/* EXCLUIR acima do par e com o peso de destrutivo: contorno vermelho,
              nunca fundo — o vermelho sólido fica para o botão do diálogo, que é
              onde a ação acontece de verdade. Fora do par Cancelar/Salvar de
              propósito: os três lado a lado a 375px dariam 3 alvos de ~110px e o
              errado é o irreversível. */}
          {podeExcluir && (
            <Button
              variant="outline"
              onClick={() => setConfirmandoExclusao(true)}
              disabled={salvando}
              className="mb-2 w-full border-destructive/55 text-destructive"
            >
              <Trash2 className="w-4 h-4" /> Excluir este caso
            </Button>
          )}
          {edicao && !podeExcluir && (
            <p className="mb-2 text-[11.5px] leading-snug text-muted-foreground">
              Esta cirurgia veio do mapa importado — para tirá-la da escala, republique o turno.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={submeter} disabled={!valido || salvando} className="flex-1">
              {salvando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : (edicao ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
              {edicao ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
