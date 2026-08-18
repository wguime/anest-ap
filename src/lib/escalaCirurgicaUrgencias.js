/**
 * Urgências/emergências do HRO — ocupação das salas contratadas e fila de entrada.
 *
 * PORQUÊ (dono 2026-08-18): o contrato com o HRO paga um número FIXO de anestesistas
 * por turno. Para urgência/emergência são SEMPRE dois — o plantonista e o sobreaviso.
 * A terceira urgência simultânea só entra chamando alguém que o hospital não paga, e
 * hoje ninguém enxerga essa saturação enquanto ela acontece. Esta lib responde, a
 * partir dos casos do dia + o relógio: quantas salas de urgência estão ocupadas, quem
 * está na fila, e se já se está operando acima do contrato.
 *
 * REGRAS TRAVADAS COM O DONO (18/08):
 * 1. Capacidade = 2 (plantonista + sobreaviso). Urgência em Sala 4 (ortopedia) e
 *    Sala 7 - CO é absorvida pelo anestesista DEDICADO e fica FORA da conta — mas
 *    como à tarde e à noite não há CO no contrato, urgência de CO nesses turnos
 *    VOLTA a pesar no plantonista. Por isso o contrato é config POR TURNO.
 * 2. Fila por gravidade (adaptação da NCEPOD Classification of Intervention:
 *    Immediate/Urgent/Expedited) e, no empate, por ordem de chegada.
 * 3. Endoscopia/colonoscopia FORA do centro cirúrgico e hemodinâmica não entram na
 *    conta — e a exclusão é pela SALA, nunca pelo texto do procedimento: a mesma
 *    colonoscopia conta ou não conta dependendo de ONDE é feita, e o procedimento
 *    não carrega essa informação. Os hospitais que aparecem dentro da escala do HRO
 *    (IOSC, Hospital de Olhos, Digimax, Centro de Coluna) também não são o contrato.
 * 4. O aviso em tempo real conta TODA urgência (ocupação é ocupação, independente do
 *    pagador). O recorte SUS existe só no relatório contratual.
 *
 * Pura: sem React, sem I/O. Tudo que é política externa entra por `opts`.
 */
import { casoConcluido, normNome, salaLiberacao } from '@/pages/escala-cirurgica/utils'
import { faseLiberacoes } from '@/lib/plantaoNoturno'

/** Níveis de gravidade da fila (adaptação NCEPOD). */
export const GRAVIDADES = Object.freeze(['imediata', 'urgente', 'aguarda'])

export const GRAVIDADE_LABEL = Object.freeze({
  imediata: 'Imediata',
  urgente: 'Urgente',
  aguarda: 'Pode aguardar',
})

/**
 * Peso de ordenação. Sem classificação → 9: vai para o FIM com uma chamada de ação,
 * em vez de ser rankeada por um palpite do software (o app não inventa uma
 * afirmação clínica que ninguém fez).
 */
export const GRAVIDADE_ORDEM = Object.freeze({ imediata: 1, urgente: 2, aguarda: 3 })
export const ORDEM_SEM_GRAVIDADE = 9

/**
 * Iniciada há mais que isto sem término: o app PARA de contar como ocupação e
 * pergunta. Medido em produção (18/08): 13 urgências ficaram marcadas "iniciada"
 * em dias passados e nunca receberam "terminada" — dentro do mesmo dia isso
 * inflaria o contador pelo resto do turno.
 */
export const LIMITE_ESQUECIDA_MIN = 240

/**
 * Urgência com anestesista definido cuja hora já passou disto e que segue
 * "agendada": provavelmente começou e ninguém marcou.
 */
export const LIMITE_SUSPEITA_MIN = 15

/**
 * Contrato vigente do HRO (dono 2026-08-18). Mudou o contrato → muda AQUI, e só aqui.
 *
 * `urgencia` é a lista de PAPÉIS, não o número 2: a capacidade é o tamanho dela, e a
 * tela consegue nomear quem cobre ("plantonista + sobreaviso") e chamar o terceiro
 * pelo nome certo. `dedicadas` é o mapa papel→sala de quem absorve a própria urgência
 * — e o `co` DESAPARECE à tarde e à noite, que é onde a decisão do dono vira código.
 */
export const CONTRATO_HRO = Object.freeze({
  manha: Object.freeze({
    label: 'Manhã',
    urgencia: Object.freeze(['plantonista', 'sobreaviso']),
    dedicadas: Object.freeze({ orto: 'Sala 4', co: 'Sala 7 - CO' }),
  }),
  tarde: Object.freeze({
    label: 'Tarde',
    urgencia: Object.freeze(['plantonista', 'sobreaviso']),
    dedicadas: Object.freeze({ orto: 'Sala 4' }),
  }),
  noite: Object.freeze({
    label: 'Noite',
    urgencia: Object.freeze(['plantonista', 'sobreaviso']),
    dedicadas: Object.freeze({}),
  }),
})

/**
 * Salas do HRO que NÃO fazem parte do contrato de urgência.
 * ⚠️ Esta lista é a fonte; a cópia em SQL (skill `/escala-cirurgica`, modo
 * `contrato-hro`) tem de bater com ela — há teste travando o drift.
 */
export const SALAS_FORA_DO_CONTRATO_HRO = Object.freeze({
  EXAMES: 'exames', // endoscopia/colonoscopia fora do centro cirúrgico caem aqui
  HEMODINAMICA: 'hemodinamica',
  IMAGEM: 'imagem',
  BRAQUITERAPIA: 'braquiterapia',
  CONSULTORIO: 'consultorio',
  AMBULATORIAL: 'ambulatorial',
  IOSC: 'outro_hospital',
  'HOSPITAL DE OLHOS': 'outro_hospital',
  HO: 'outro_hospital',
  'CENTRO DE COLUNA': 'outro_hospital',
  DIGIMAX: 'outro_hospital',
})

const TIPOS_URGENTES = new Set(['urgencia', 'emergencia'])

/** O caso é urgência ou emergência? (tipo, nunca status — regra da matriz canônica) */
export const ehUrgencia = (caso) => TIPOS_URGENTES.has(caso?.tipo)

/**
 * Turno CONTRATUAL vigente: 'manha' | 'tarde' | 'noite'.
 *
 * Delega a `faseLiberacoes` em vez de criar um segundo corte de 19h no app — assim
 * herda de graça a regra "outra data nunca vira noite". Existe porque
 * `escala_cirurgica_caso.turno` só aceita matutino|vespertino: a urgência das 21h de
 * uma quarta vive no turno *vespertino*, mas o contrato dela é o da NOITE (sem
 * ortopedia, sem CO). A capacidade vem do RELÓGIO, não do campo `turno`.
 */
export function turnoContratual({ turno, agoraMin, dataEscala, hojeIso, fds = false }) {
  const fase = faseLiberacoes({ agoraMin, dataEscala, hojeIso, fds })
  if (fase !== 'dia') return 'noite'
  return turno === 'vespertino' ? 'tarde' : 'manha'
}

/**
 * Papel da sala no contrato do HRO: 'orto' | 'co' | 'fora' | 'geral'.
 *
 * ⚠️ Normalizar é obrigatório, não elegância: produção tem "Sala 5 - Emergência" (23
 * casos) E "Sala 5" (3); "Sala 7 - CO" (15) E "Sala 7" (1). Comparar string crua
 * classificaria 4 casos reais errado.
 */
export function papelDaSalaHro(sala) {
  const s = normNome(sala).replace(/\s+/g, ' ')
  if (!s) return 'geral'
  if (SALAS_FORA_DO_CONTRATO_HRO[s]) return 'fora'
  if (/^SALA ?4\b/.test(s)) return 'orto'
  if (/^SALA ?7\b/.test(s)) return 'co'
  if (/^C ?\.? ?O ?\.?$/.test(s) || /\bCO$/.test(s)) return 'co'
  return 'geral'
}

/** Motivo pelo qual a sala ficou fora da conta (para o painel e o relatório). */
export const motivoForaDoContrato = (sala) =>
  SALAS_FORA_DO_CONTRATO_HRO[normNome(sala).replace(/\s+/g, ' ')] || null

/**
 * A sala é conhecida? Sala digitada à mão ("+ Nova sala…") CONTA — quem digita é
 * justamente quem está encaixando a urgência, e ela está ocupando alguém de verdade
 * —, mas fica marcada para o relatório listar rótulos novos e a lista ser mantida.
 */
const SALAS_CONHECIDAS_HRO = new Set(
  [
    'Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 5 - Emergência', 'Sala 6',
    'Sala 7', 'Sala 7 - CO', 'Sala 8', 'Sala 9',
    'Bloco A - Sala 1', 'Bloco A - Sala 2', 'Bloco A - Sala 3', 'Bloco A - Sala 4',
    'Bloco M - Sala 1', 'Bloco M - Sala 2', 'Bloco M - Sala 3', 'Bloco M - Sala 4', 'Bloco M',
  ].map((s) => normNome(s).replace(/\s+/g, ' ')),
)

/**
 * Minuto do dia em que a urgência CHEGOU.
 *
 * `created_at` é o único carimbo confiável: medido em produção (18/08), 9 de 9
 * urgências do HRO estavam SEM `hora` — a urgência nasce à mão pelo AddCasoSheet,
 * não pela importação. Por isso a fila NUNCA ordena por `hora`.
 *
 * ⚠️ o campo chega como `caso.created_at` (snake), não `createdAt`: `fetchEscala`
 * usa select('*') e `created_at` não está no CAMEL_TO_SNAKE, então o conversor faz
 * passthrough. Ler só `createdAt` daria undefined e a fila ordenaria por NaN, em
 * silêncio.
 */
export function chegadaDaUrgencia(caso, { dataEscala } = {}) {
  const bruto = caso?.created_at || caso?.createdAt
  if (!bruto) return null
  const d = new Date(bruto)
  if (Number.isNaN(d.getTime())) return null
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  // Caso criado noutro dia (escala importada na véspera): a chegada não é do turno.
  if (dataEscala && iso !== dataEscala) return null
  return d.getHours() * 60 + d.getMinutes()
}

/** Ordenação da fila: gravidade → chegada → ordem na sala → id (estável). */
export function ordenarFilaUrgencias(itens) {
  return [...itens].sort(
    (a, b) =>
      a.gravidadeOrdem - b.gravidadeOrdem ||
      (a.chegadaMin ?? Infinity) - (b.chegadaMin ?? Infinity) ||
      (a.caso?.ordem ?? 0) - (b.caso?.ordem ?? 0) ||
      String(a.caso?.id || '').localeCompare(String(b.caso?.id || '')),
  )
}

const itemDe = (caso, { agoraMin, dataEscala, papel }) => {
  const chegadaMin = chegadaDaUrgencia(caso, { dataEscala })
  const gravidade = GRAVIDADES.includes(caso?.gravidade) ? caso.gravidade : null
  const salaNorm = normNome(caso?.sala).replace(/\s+/g, ' ')
  return {
    caso,
    id: caso?.id,
    sala: caso?.sala,
    salaLabel: salaLiberacao(caso?.sala),
    papel,
    gravidade,
    gravidadeOrdem: gravidade ? GRAVIDADE_ORDEM[gravidade] : ORDEM_SEM_GRAVIDADE,
    chegadaMin,
    esperaMin: chegadaMin == null ? null : Math.max(0, agoraMin - chegadaMin),
    salaDesconhecida: !!salaNorm && !SALAS_CONHECIDAS_HRO.has(salaNorm) && papel === 'geral',
  }
}

/**
 * Panorama das urgências do HRO num instante.
 *
 * ⚠️ Recebe os casos do DIA INTEIRO (`casosResolvidos(escala)`), NÃO
 * `filtrarPorTurno(...)`: ocupação é do relógio. Uma urgência iniciada 12:50 e ainda
 * correndo às 14h ocupa o plantonista da tarde, e filtrar por turno a esconderia
 * justamente quando ela pesa. O turno só escolhe QUAL LINHA do contrato se aplica.
 */
export function estadoUrgencias(casos = [], opts = {}) {
  const {
    hospital,
    agoraMin = 0,
    dataEscala = null,
    hojeIso = null,
    turno = 'matutino',
    fds = false,
    contrato = CONTRATO_HRO,
  } = opts

  const turnoContrato = turnoContratual({ turno, agoraMin, dataEscala, hojeIso, fds })
  const linha = contrato[turnoContrato] || contrato.manha
  const papeis = linha.urgencia
  const capacidade = papeis.length
  const dedicadasDoTurno = new Set(Object.keys(linha.dedicadas))

  const vazio = {
    ativo: false,
    turnoContrato,
    turnoLabel: linha.label,
    papeis,
    capacidade,
    ocupadas: 0,
    livres: capacidade,
    nivel: 'livre',
    emAndamento: [],
    aConfirmar: [],
    fila: [],
    proxima: null,
    dedicadas: [],
    foraDaConta: [],
    suspeitas: [],
    esperaMaxMin: null,
  }

  // O contrato é do HRO. Deixar isso explícito impede a feature de vazar para
  // Unimed/Materno, que têm outro contrato.
  if (hospital !== 'hro') return vazio

  const emAndamento = []
  const aConfirmar = []
  const pendentes = []
  const dedicadas = []
  const foraDaConta = []
  const suspeitas = []

  for (const caso of casos) {
    if (!ehUrgencia(caso) || casoConcluido(caso)) continue
    const papel = papelDaSalaHro(caso?.sala)

    if (papel === 'fora') {
      foraDaConta.push({ ...itemDe(caso, { agoraMin, dataEscala, papel }), motivo: motivoForaDoContrato(caso?.sala) })
      continue
    }

    // Sala com anestesista dedicado NAQUELE turno: absorvida, fora da conta das 2.
    if (papel !== 'geral' && dedicadasDoTurno.has(papel)) {
      dedicadas.push(itemDe(caso, { agoraMin, dataEscala, papel }))
      continue
    }

    const item = itemDe(caso, { agoraMin, dataEscala, papel: 'geral' })

    if ((caso?.statusCirurgia || 'agendada') === 'iniciada') {
      const inicioMin = inicioDaUrgencia(caso, { dataEscala })
      const desdeMin = inicioMin == null ? null : agoraMin - inicioMin
      // Iniciada e esquecida: sai da OCUPAÇÃO e vira pergunta. O app não afirma o
      // que não sabe — mas também nunca esconde a urgência sozinha.
      if (desdeMin != null && desdeMin > LIMITE_ESQUECIDA_MIN) aConfirmar.push({ ...item, desdeMin })
      else emAndamento.push({ ...item, desdeMin })
      continue
    }

    pendentes.push(item)
    // Hora marcada já passou e ninguém iniciou: provavelmente começou sem marcar.
    const horaMin = horaEmMinutos(caso?.hora)
    if (horaMin != null && agoraMin - horaMin > LIMITE_SUSPEITA_MIN && !caso?.semAnestesista) {
      suspeitas.push({ ...item, atrasoMin: agoraMin - horaMin })
    }
  }

  const fila = ordenarFilaUrgencias(pendentes).map((it, i) => ({ ...it, posicao: i + 1 }))
  const ocupadas = emAndamento.length
  const nivel =
    ocupadas === 0 ? 'livre' : ocupadas < capacidade ? 'parcial' : ocupadas === capacidade ? 'cheio' : 'acima'

  const esperas = fila.map((f) => f.esperaMin).filter((v) => v != null)

  return {
    ...vazio,
    ativo: emAndamento.length + aConfirmar.length + fila.length + dedicadas.length > 0,
    ocupadas,
    livres: Math.max(0, capacidade - ocupadas),
    nivel,
    emAndamento,
    aConfirmar,
    fila,
    proxima: fila[0] || null,
    dedicadas,
    foraDaConta,
    suspeitas,
    esperaMaxMin: esperas.length ? Math.max(...esperas) : null,
  }
}

/**
 * Minuto do dia em que o caso foi marcado "iniciada".
 *
 * ⚠️ NÃO usar a chegada para isto: um caso registrado às 07:00 e iniciado às 10:30
 * pareceria estar em andamento há 4h às 11:00 e cairia em `aConfirmar` sem nunca ter
 * sido esquecido. `status_atualizado_em` é carimbado pela RPC a cada mudança de
 * status (254/254 casos iniciados em produção têm o carimbo) e chega em camelCase,
 * porque `statusAtualizadoEm` ESTÁ no CAMEL_TO_SNAKE — ao contrário de `created_at`.
 */
export function inicioDaUrgencia(caso, { dataEscala } = {}) {
  const bruto = caso?.statusAtualizadoEm || caso?.status_atualizado_em
  if (!bruto) return null
  const d = new Date(bruto)
  if (Number.isNaN(d.getTime())) return null
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (dataEscala && iso !== dataEscala) return null
  return d.getHours() * 60 + d.getMinutes()
}

/** "HH:MM" → minutos do dia (local, sem depender do parse de Date). */
function horaEmMinutos(hora) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora || '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}
