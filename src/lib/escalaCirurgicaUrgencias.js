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
 * REVISÃO 20/08 (dono, caso do CO vespertino): a vaga é gasta pela CIRURGIA — mas
 * duas cirurgias do MESMO anestesista são UMA ocupação, porque ninguém opera dois
 * pacientes ao mesmo tempo (o CO com cesáreas o dia todo é um card, uma vaga). E a
 * urgência ENTRA numa vaga livre antes mesmo de começar; sem vaga livre vai para a
 * fila, e se já começou vira EXTRA. Uma cirurgia conta também sem `tipo=urgencia`
 * quando está numa sala ESTAÇÃO do turno (marcada como plantão/sobreaviso, ou o CO
 * à tarde/noite). Antes, CO cheio à tarde aparecia como "0 de 2 salas" com o card
 * do plantão em branco, porque só urgência JÁ INICIADA contava.
 *
 * Pura: sem React, sem I/O. Tudo que é política externa entra por `opts`.
 */
import { casoConcluido, chaveSalaHro, normNome, SALA_HRO_CO, salaLiberacao, turnoDoCaso } from '@/pages/escala-cirurgica/utils'
import { INICIO_NOTURNO_MIN, faseLiberacoes } from '@/lib/plantaoNoturno'

/**
 * Chave estável de uma sala. Normalizar é obrigatório, não elegância: produção
 * tem "Sala 5 - Emergência" (26) E "Sala 5" (27), "Sala 7 - CO" (27) E "Sala 7"
 * (4) para as MESMAS salas — comparar string crua classifica errado.
 *
 * Desde 20/08 a numérica do HRO grava o bloco ("Bloco A - Sala 4") e as escalas
 * publicadas antes seguem sem ele; `chaveSalaHro` é o que faz as duas grafias
 * contarem como UMA vaga do contrato, aqui e na sala marcada no `urgencias_meta`.
 */
export const chaveSala = (v) => chaveSalaHro(v)

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
 * Rótulos das salas dedicadas — usados como LEGENDA do card quando o dia não tem
 * nenhuma cirurgia lá (com cirurgia, a grafia do dia vence). `papelDaSalaHro`
 * reconhece as duas grafias, então trocar aqui não invalida escala antiga.
 */
const SALA_HRO_ORTO = 'Bloco A - Sala 4'

/**
 * Contrato vigente do HRO (dono 2026-08-18). Mudou o contrato → muda AQUI, e só aqui.
 *
 * `urgencia` é a lista de PAPÉIS, não o número 2: a capacidade é o tamanho dela, e a
 * tela consegue nomear quem cobre ("plantonista + sobreaviso") e chamar o terceiro
 * pelo nome certo. `dedicadas` é o mapa papel→sala de quem absorve a própria urgência
 * — e o `co` DESAPARECE à tarde e à noite, que é onde a decisão do dono vira código.
 *
 * `estacoes` (dono 20/08) é a outra metade dessa decisão: o papel que perdeu o
 * dedicado mas MANTÉM alguém na sala, e portanto gasta uma das 2 vagas só por ter
 * cirurgia aberta — sem depender de "iniciada". É o CO à TARDE e à NOITE: "à tarde
 * e à noite não há sala exclusiva para CO, então se entrar será considerada como
 * urgência/emergência". Quem está lá faz as cesáreas do dia e não está livre para a
 * próxima urgência.
 * ⚠️ À noite o que conta é o "SE ENTRAR" da frase do dono: só cirurgia que CHEGOU
 * depois das 19h (ou que está em andamento). O que sobrou da tarde sem "terminada"
 * não segura a vaga — em 20/08 a Sala 4 fechou a tarde com 3 casos assim, e sem
 * esse corte o painel marcaria "acima do contrato" todas as noites sem ninguém
 * operando.
 */
export const CONTRATO_HRO = Object.freeze({
  manha: Object.freeze({
    label: 'Manhã',
    urgencia: Object.freeze(['plantonista', 'sobreaviso']),
    dedicadas: Object.freeze({ orto: SALA_HRO_ORTO, co: SALA_HRO_CO }),
    estacoes: Object.freeze([]),
  }),
  tarde: Object.freeze({
    label: 'Tarde',
    urgencia: Object.freeze(['plantonista', 'sobreaviso']),
    dedicadas: Object.freeze({ orto: SALA_HRO_ORTO }),
    estacoes: Object.freeze(['co']),
  }),
  noite: Object.freeze({
    label: 'Noite',
    urgencia: Object.freeze(['plantonista', 'sobreaviso']),
    dedicadas: Object.freeze({}),
    estacoes: Object.freeze(['co']),
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
  MATERNO: 'outro_hospital',
})

/**
 * O rótulo da sala é DIGITADO — casar só a grafia canônica deixa passar o que
 * existe no banco. Varredura de 20/08 nas escalas do HRO: "AMBULAT.",
 * "Ambulatorial BERA", "Odonto ambulatorial" e "MATERNO" caíam em 'geral' e
 * entrariam na conta de urgência do contrato. O mapa acima segue sendo a lista
 * canônica (é ele que o SQL do relatório repete); estes padrões são a rede.
 */
export const PADROES_FORA_DO_CONTRATO_HRO = Object.freeze([
  [/^EXAMES?\b/, 'exames'],
  [/^HEMO/, 'hemodinamica'],
  [/^IMAGEM\b/, 'imagem'],
  [/^BRAQUI/, 'braquiterapia'],
  [/^CONSULT/, 'consultorio'],
  [/\bAMBULAT/, 'ambulatorial'],
  [/^IOSC\b/, 'outro_hospital'],
  [/HOSPITAL DE OLHOS/, 'outro_hospital'],
  [/^(C\.? ?COLUNA|CENTRO DE COLUNA)/, 'outro_hospital'],
  [/^DIGIMAX/, 'outro_hospital'],
  [/^MATERNO/, 'outro_hospital'],
])

/**
 * Salas dos papéis do contrato NO DIA (dono 18/08, 2ª decisão): a ortopedia opera
 * "normalmente na sala 4" — mas normalmente não é sempre. `urgencias_meta` no
 * cabeçalho da escala guarda, POR TURNO de publicação, onde cada papel está:
 *   { matutino: { orto, co, plantao, sobreaviso }, vespertino: {...} }
 * Campo ausente/null = automático (default do contrato + heurística por ordem de
 * início). Merge raso: marcar só o CO não mexe na ortopedia.
 */
export function salasContrato(urgenciasMeta, turno) {
  const cfg = (urgenciasMeta && urgenciasMeta[turno === 'vespertino' ? 'vespertino' : 'matutino']) || {}
  const limpo = (v) => {
    const t = String(v || '').trim()
    return t || null
  }
  return {
    orto: limpo(cfg.orto),
    co: limpo(cfg.co),
    plantao: limpo(cfg.plantao),
    sobreaviso: limpo(cfg.sobreaviso),
  }
}

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
export function papelDaSalaHro(sala, salas = null) {
  const s = chaveSala(sala)
  if (!s) return 'geral'
  if (motivoForaDoContrato(s)) return 'fora'
  // Sala MARCADA vence o default por inteiro naquele papel: se o dia diz que a
  // ortopedia está na Sala 3, a Sala 4 volta a ser sala comum — quem marcou
  // sabe onde a equipe está, o regex só conhece o "normalmente".
  const marcada = (v) => v != null && chaveSala(v) === s
  if (salas?.orto || salas?.co) {
    if (marcada(salas.orto)) return 'orto'
    if (marcada(salas.co)) return 'co'
    if (salas.orto && salas.co) return 'geral' // os dois marcados: defaults desligados
    // só um papel marcado: o OUTRO continua no default
    if (!salas.orto && (/^SALA ?4\b/.test(s))) return 'orto'
    if (!salas.co && (/^SALA ?7\b/.test(s) || /^C ?\.? ?O ?\.?$/.test(s) || /\bCO$/.test(s))) return 'co'
    return 'geral'
  }
  if (/^SALA ?4\b/.test(s)) return 'orto'
  if (/^SALA ?7\b/.test(s)) return 'co'
  if (/^C ?\.? ?O ?\.?$/.test(s) || /\bCO$/.test(s)) return 'co'
  return 'geral'
}

/** Motivo pelo qual a sala ficou fora da conta (para o painel e o relatório). */
export const motivoForaDoContrato = (sala) => {
  const s = chaveSala(sala)
  if (!s) return null
  if (SALAS_FORA_DO_CONTRATO_HRO[s]) return SALAS_FORA_DO_CONTRATO_HRO[s]
  return PADROES_FORA_DO_CONTRATO_HRO.find(([re]) => re.test(s))?.[1] || null
}

/**
 * A sala é conhecida? Sala digitada à mão ("+ Nova sala…") CONTA — quem digita é
 * justamente quem está encaixando a urgência, e ela está ocupando alguém de verdade
 * —, mas fica marcada para o relatório listar rótulos novos e a lista ser mantida.
 */
const SALAS_CONHECIDAS_HRO = new Set(
  [
    // Sem o prefixo do bloco: `chaveSala` já colapsa "Bloco A - Sala 4" em
    // "Sala 4", então uma entrada por sala cobre as duas grafias.
    'Sala 1', 'Sala 2', 'Sala 3', 'Sala 4', 'Sala 5', 'Sala 5 - Emergência', 'Sala 6',
    'Sala 7', 'Sala 7 - CO', 'Sala 8', 'Sala 9',
    'Bloco M - Sala 1', 'Bloco M - Sala 2', 'Bloco M - Sala 3', 'Bloco M - Sala 4', 'Bloco M', 'Bloco A',
  ].map(chaveSala),
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

/**
 * Turno de PUBLICAÇÃO (`escala_cirurgica_caso.turno`) de cada turno contratual.
 * A noite herda o vespertino porque o CHECK do banco só aceita
 * matutino|vespertino — a urgência das 21h vive no vespertino.
 */
export const TURNO_PUBLICACAO = Object.freeze({ manha: 'matutino', tarde: 'vespertino', noite: 'vespertino' })

/**
 * Posto do contrato a que a SALA foi marcada neste turno ('plantao'|'sobreaviso'),
 * ou null.
 *
 * PORQUÊ (dono 20/08): "se salas de urgência não tiverem sido identificadas, que
 * haja como marcar sala para que entre na contagem". Marcar plantão/sobreaviso
 * numa sala é dizer que aquele anestesista do contrato está ALI — ou seja, uma
 * das 2 vagas gasta. Até 19/08 a marcação só trocava o rótulo de quem cobria o
 * que já estava em andamento, e a sala marcada continuava fora da conta.
 */
export function postoMarcadoDaSala(sala, salas) {
  const k = chaveSala(sala)
  if (!k) return null
  if (salas?.plantao && chaveSala(salas.plantao) === k) return 'plantao'
  if (salas?.sobreaviso && chaveSala(salas.sobreaviso) === k) return 'sobreaviso'
  return null
}

const itemDe = (caso, { agoraMin, dataEscala, papel }) => {
  const chegadaMin = chegadaDaUrgencia(caso, { dataEscala })
  const gravidade = GRAVIDADES.includes(caso?.gravidade) ? caso.gravidade : null
  const salaNorm = chaveSala(caso?.sala)
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
 * Quem responde pela sala, para o card: o 1º caso com vínculo de login, com o
 * texto importado como reserva. Prefere os casos do turno contratual vigente —
 * a sala pode ter trocado de anestesista entre manhã e tarde.
 */
const anestesistaDaSala = (casos = [], turnoPub) => {
  const ordenados = [
    ...casos.filter((c) => turnoDoCaso(c) === turnoPub),
    ...casos.filter((c) => turnoDoCaso(c) !== turnoPub),
  ]
  const comUid = ordenados.find((c) => c?.anestesistaUserId)
  const comNome = ordenados.find((c) => c?.anestesista && c.anestesista !== '?')
  return { uid: comUid?.anestesistaUserId || null, alias: comUid?.anestesista || comNome?.anestesista || '' }
}

/**
 * Uma OCUPAÇÃO é uma cirurgia de urgência consumindo um dos anestesistas do
 * contrato — com as demais cirurgias do MESMO titular junto, porque ninguém opera
 * dois pacientes ao mesmo tempo (dono 20/08: "um único card com várias cirurgias
 * obstétricas (dia todo)"). O card mostra a cirurgia representativa: a que está em
 * andamento; senão a próxima pela regra da fila.
 */
const ocupacaoDe = (itens, { motivo, rodando = [], turnoPub, postoMarcado = null }) => {
  const urgentes = itens.filter((i) => ehUrgencia(i.caso))
  const desdeMin = rodando.reduce((m, x) => (x.desdeMin != null && (m == null || x.desdeMin > m) ? x.desdeMin : m), null)
  const repr = rodando[0] || ordenarFilaUrgencias(urgentes)[0] || itens[0]
  return {
    ...repr,
    motivo,
    postoMarcado,
    casos: itens,
    qtd: itens.length,
    urgencias: urgentes.length,
    emAndamento: rodando.length,
    desdeMin,
    anestesista: anestesistaDaSala(itens.map((i) => i.caso), turnoPub),
  }
}

/**
 * Panorama das urgências do HRO num instante.
 *
 * ⚠️ Recebe os casos do DIA INTEIRO (`casosResolvidos(escala)`), NÃO
 * `filtrarPorTurno(...)`: ocupação é do relógio. Uma urgência iniciada 12:50 e ainda
 * correndo às 14h ocupa o plantonista da tarde, e filtrar por turno a esconderia
 * justamente quando ela pesa. O turno só escolhe QUAL LINHA do contrato se aplica.
 *
 * Quem disputa as vagas (dono 20/08):
 *  a) toda urgência/emergência ABERTA — iniciada ou não: quem a assumiu já é um
 *     dos dois do contrato;
 *  b) qualquer cirurgia aberta numa sala ESTAÇÃO do turno (marcada como
 *     plantão/sobreaviso, ou o CO à tarde/noite) — é o "DIA TODO" do CO, que é
 *     eletiva no banco. À noite, só o que ENTROU depois das 19h ou está em
 *     andamento.
 * As candidatas agrupam por TITULAR (uma pessoa, uma vaga) e entram nos postos
 * livres; o que sobra vai para a FILA se ainda não começou, ou vira EXTRA se já
 * está em andamento.
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
    salas = null, // salasContrato(urgenciasMeta, turno) — null = tudo automático
  } = opts

  const turnoContrato = turnoContratual({ turno, agoraMin, dataEscala, hojeIso, fds })
  const linha = contrato[turnoContrato] || contrato.manha
  const papeis = linha.urgencia
  const capacidade = papeis.length
  const dedicadasDoTurno = Object.keys(linha.dedicadas)
  const estacoesDoTurno = linha.estacoes || []
  const turnoPub = TURNO_PUBLICACAO[turnoContrato] || 'matutino'

  const vazio = {
    ativo: false,
    turnoContrato,
    turnoLabel: linha.label,
    papeis,
    capacidade,
    ocupadas: 0,
    livres: capacidade,
    nivel: 'livre',
    ocupacoes: [],
    emAndamento: [],
    aConfirmar: [],
    fila: [],
    proxima: null,
    dedicados: [],
    foraDaConta: [],
    suspeitas: [],
    esperaMaxMin: null,
    postos: papeis.map((papel) => ({ papel, item: null })),
    extras: [],
  }

  // O contrato é do HRO. Deixar isso explícito impede a feature de vazar para
  // Unimed/Materno, que têm outro contrato.
  if (hospital !== 'hro') return vazio

  // ── 1) casos ABERTOS agrupados por SALA ────────────────────────────────────
  // ⚠️ papel do contrato (orto/CO) agrupa pelo PAPEL, não pela string: um papel é
  // UMA sala física, e produção escreve a mesma sala de dois jeitos ("Sala 7" ×
  // "Sala 7 - CO", "Sala 5" × "Sala 5 - Emergência"). Por chave de texto, a mesma
  // sala viraria duas ocupações e estouraria o contrato no papel. Sala 'geral'
  // continua agrupada pelo texto — ali cada rótulo é uma sala de verdade.
  const porSala = new Map()
  for (const caso of casos) {
    if (casoConcluido(caso)) continue
    const papel = papelDaSalaHro(caso?.sala, salas)
    const chave = papel === 'orto' || papel === 'co' ? `papel:${papel}` : chaveSala(caso?.sala)
    let g = porSala.get(chave)
    if (!g) {
      g = {
        chave,
        sala: caso?.sala,
        papel,
        postoMarcado: null,
        rotulos: new Map(), // rótulo → nº de casos, p/ exibir a grafia dominante
        casos: [],
        iniciadas: [],
        esquecidas: [],
        doTurno: false,
      }
      porSala.set(chave, g)
    }
    // marcação vale para o GRUPO: marcar "Sala 7" marca a sala, não a grafia
    if (papel !== 'fora' && !g.postoMarcado) g.postoMarcado = postoMarcadoDaSala(caso?.sala, salas)
    const rotulo = String(caso?.sala || '').trim()
    g.rotulos.set(rotulo, (g.rotulos.get(rotulo) || 0) + 1)
    g.casos.push(caso)
    if (turnoDoCaso(caso) === turnoPub) g.doTurno = true
    // "se entrar" (dono 20/08): à noite a estação só vale para quem CHEGOU depois
    // das 19h — `turno` no banco não distingue tarde de noite.
    const chegada = chegadaDaUrgencia(caso, { dataEscala })
    if (chegada != null && chegada >= INICIO_NOTURNO_MIN) g.chegouNaNoite = true
    if ((caso?.statusCirurgia || 'agendada') === 'iniciada') {
      const inicioMin = inicioDaUrgencia(caso, { dataEscala })
      const desdeMin = inicioMin == null ? null : agoraMin - inicioMin
      const registro = { caso, desdeMin, urgencia: ehUrgencia(caso) }
      // Iniciada e esquecida: sai da OCUPAÇÃO e vira pergunta. O app não afirma o
      // que não sabe — mas também nunca esconde a urgência sozinha.
      if (desdeMin != null && desdeMin > LIMITE_ESQUECIDA_MIN) g.esquecidas.push(registro)
      else g.iniciadas.push(registro)
    }
  }

  // grafia dominante do grupo (o card mostra o rótulo que a equipe mais usa)
  for (const g of porSala.values()) {
    g.sala = [...g.rotulos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || g.sala
  }

  // ── 2) as CIRURGIAS que disputam as vagas do contrato ─────────────────────
  const candidatos = []
  const foraDaConta = []
  const aConfirmar = []
  const suspeitas = []
  const salasDedicadas = new Map() // papel → sala dedicada do turno (o "normalmente")
  const ctx = { agoraMin, dataEscala }

  for (const g of porSala.values()) {
    const itens = g.casos.map((c) => itemDe(c, { ...ctx, papel: g.papel }))
    const urgentes = itens.filter((i) => ehUrgencia(i.caso))

    if (g.papel === 'fora') {
      for (const i of urgentes) foraDaConta.push({ ...i, motivo: motivoForaDoContrato(g.sala) })
      continue
    }

    // Sala com dedicado NESTE turno é absorvida — a menos que a marcação do dia
    // diga que quem está ali é o plantão/sobreaviso. A marcação é explícita; o
    // dedicado é só o "normalmente".
    if (g.papel !== 'geral' && dedicadasDoTurno.includes(g.papel) && !g.postoMarcado) {
      salasDedicadas.set(g.papel, { g, itens, urgentes })
      continue
    }

    // ESTAÇÃO: a sala inteira é atendimento de urgência neste turno — marcada à
    // mão como plantão/sobreaviso, ou listada em `estacoes` (o CO à tarde/noite,
    // "se entrar será considerada urgência/emergência"). Numa estação a cirurgia
    // conta mesmo sem o tipo `urgencia` no banco: é o "DIA TODO" do CO.
    // À noite, cirurgia aberta não basta — tem de ter ENTRADO depois das 19h.
    const estacao = !!g.postoMarcado
      || (estacoesDoTurno.includes(g.papel) && !dedicadasDoTurno.includes(g.papel))
    const estacaoAtiva = estacao && g.doTurno && (turnoContrato !== 'noite' || g.chegouNaNoite)

    for (const it of itens) {
      const rodando = g.iniciadas.find((x) => x.caso === it.caso)
      const esquecida = g.esquecidas.find((x) => x.caso === it.caso)
      // Eletiva comum não disputa vaga de urgência (a equipe eletiva é outra).
      // Numa ESTAÇÃO ela conta — é o "DIA TODO" do CO —, e conta também quando
      // está EM ANDAMENTO fora da janela da estação: alguém operando ali agora é
      // fato, não sobra de turno (é o CO às 20h com a cesárea que começou).
      if (!ehUrgencia(it.caso) && !estacaoAtiva && !(estacao && (rodando || esquecida))) continue

      if (esquecida) {
        // Iniciada e esquecida: sai da OCUPAÇÃO e vira PERGUNTA — o app não afirma
        // o que ninguém confirmou. A pergunta cobre tudo que CONTARIA, não só o
        // tipo urgência: o "DIA TODO" do CO sai da conta pelo mesmo motivo e
        // precisa do mesmo "ainda em andamento?".
        aConfirmar.push({ ...it, desdeMin: esquecida.desdeMin })
        continue
      }

      candidatos.push({
        ...it,
        rodando: !!rodando,
        desdeMin: rodando?.desdeMin ?? null,
        postoMarcado: g.postoMarcado,
        estacao: estacaoAtiva,
      })

      // Hora marcada já passou e ninguém iniciou: provavelmente começou sem marcar.
      const horaMin = horaEmMinutos(it.caso?.hora)
      if (!rodando && ehUrgencia(it.caso) && horaMin != null
        && agoraMin - horaMin > LIMITE_SUSPEITA_MIN && !it.caso?.semAnestesista) {
        suspeitas.push({ ...it, atrasoMin: agoraMin - horaMin })
      }
    }
  }

  // ── 3) uma pessoa, uma vaga: as cirurgias agrupam por TITULAR ──────────────
  // A vaga é gasta pela CIRURGIA (dono 20/08), mas ninguém opera dois pacientes
  // ao mesmo tempo: as cirurgias do MESMO anestesista são uma ocupação só, com a
  // contagem no card — é o CO com cesáreas o dia todo. Sem vínculo de login o
  // agrupador é a sala (é o que existe para dizer "é a mesma pessoa").
  const titulares = new Map()
  for (const cand of candidatos) {
    const c = cand.caso
    const chave = c?.anestesistaUserId
      || (c?.anestesista && c.anestesista !== '?' ? `nome:${normNome(c.anestesista)}` : `sala:${chaveSala(c?.sala)}`)
    let t = titulares.get(chave)
    if (!t) { t = { chave, itens: [], rodando: [], postoMarcado: null }; titulares.set(chave, t) }
    t.itens.push(cand)
    if (cand.rodando) t.rodando.push(cand)
    if (!t.postoMarcado && cand.postoMarcado) t.postoMarcado = cand.postoMarcado
  }

  // Ordem de entrada nas vagas: quem já está operando primeiro (mais antigo),
  // depois quem espera, pela mesma regra da fila (gravidade → chegada).
  const grupos = [...titulares.values()].map((t) => {
    const rodando = [...t.rodando].sort((a, b) => (b.desdeMin ?? 0) - (a.desdeMin ?? 0))
    return ocupacaoDe(t.itens, {
      motivo: rodando.length ? 'iniciada' : t.postoMarcado ? 'marcada' : t.itens.some((i) => i.estacao) ? 'sem_dedicado' : 'agendada',
      rodando,
      turnoPub,
      postoMarcado: t.postoMarcado,
    })
  })
  const emOrdem = [
    ...grupos.filter((o) => o.emAndamento).sort((a, b) => (b.desdeMin ?? 0) - (a.desdeMin ?? 0)),
    ...ordenarFilaUrgencias(grupos.filter((o) => !o.emAndamento)),
  ]

  // ENCAIXE (dono 20/08): a urgência entra numa vaga LIVRE do contrato mesmo
  // antes de começar — quem a assumiu já é o plantonista/sobreaviso. Sem vaga
  // livre: se já começou, é EXTRA (alguém que o hospital não paga); se ainda não,
  // vai para a FILA.
  const { postos, extras: sobras } = distribuirPostos(emOrdem, papeis, salas)
  const extras = sobras.filter((o) => o.emAndamento)
  const pendentes = sobras.filter((o) => !o.emAndamento).flatMap((o) => o.casos.filter((i) => ehUrgencia(i.caso)))
  const ocupacoes = [...postos.map((p) => p.item).filter(Boolean), ...extras]

  // ── 4) cards dos dedicados do turno (informam quem cobre, fora da conta) ────
  const dedicados = dedicadasDoTurno
    // papel que virou ESTAÇÃO (a sala dele foi marcada como plantão/sobreaviso)
    // não tem card de dedicado: no dia, quem cobre aquela sala é o contrato — e
    // ela já aparece no posto. Perguntar às ocupações, e não de novo à marcação,
    // é o que impede os dois caminhos de discordarem e a sala sumir da faixa.
    .filter((papel) => !ocupacoes.some((o) => o.papel === papel))
    .map((papel) => {
      const achado = salasDedicadas.get(papel)
      // urgência na sala dedicada continua sendo o que o card abre ao toque;
      // sala só com eletiva informa quem cobre e abre o "Adicionar caso".
      const rodandoDed = (achado?.g.iniciadas || [])
        .map((x) => achado.itens.find((i) => i.caso === x.caso))
        .filter(Boolean)
      const item = achado?.urgentes.length
        ? ocupacaoDe(achado.itens, { motivo: 'dedicada', rodando: rodandoDed, turnoPub })
        : null
      return {
        papel,
        sala: achado?.g.sala || salas?.[papel] || linha.dedicadas[papel],
        item,
        id: item?.id || null,
        qtd: achado?.itens.length || 0,
        anestesista: achado ? anestesistaDaSala(achado.g.casos, turnoPub) : { uid: null, alias: '' },
      }
    })

  const fila = ordenarFilaUrgencias(pendentes).map((it, i) => ({ ...it, posicao: i + 1 }))
  const nasVagas = postos.filter((p) => p.item).length
  const ocupadas = nasVagas + extras.length
  const nivel =
    extras.length ? 'acima' : nasVagas === 0 ? 'livre' : nasVagas < capacidade ? 'parcial' : 'cheio'

  const esperas = fila.map((f) => f.esperaMin).filter((v) => v != null)

  return {
    ...vazio,
    postos,
    extras,
    // ESCALA PUBLICADA ⇒ FAIXA VISÍVEL (dono 19/08, "no HRO não apareceu"):
    // a regra original — só com urgência — escondia a faixa exatamente na hora
    // de USÁ-LA: quem publica a escala de manhã confere/configura as salas do
    // contrato ANTES da primeira urgência chegar, e os cards de Ortopedia/CO
    // informam quem cobre mesmo sem urgência. Sem caso nenhum no dia, nada.
    ativo: casos.length > 0,
    ocupadas,
    livres: Math.max(0, capacidade - nasVagas),
    nivel,
    ocupacoes,
    emAndamento: ocupacoes.filter((o) => o.emAndamento > 0),
    aConfirmar,
    fila,
    proxima: fila[0] || null,
    dedicados,
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

/**
 * Distribui as SALAS ocupadas pelos POSTOS do contrato.
 *
 * Sala MARCADA casa primeiro (se o plantão está marcado "Sala 6", a Sala 6 é
 * dele, não importa a ordem de início); as não casadas preenchem os postos
 * vagos por ordem de início (mais antiga primeiro — quem começou antes "é" o
 * plantonista para fins de leitura); o que sobra é EXTRA, fora do contrato.
 *
 * A distribuição é o RÓTULO. Quantas salas estão ocupadas (2 de 2, acima) é
 * decidido antes, em `estadoUrgencias` — desde 20/08 marcar uma sala PODE mudar
 * esse número, porque a marcação passou a ser a declaração de que aquele
 * anestesista do contrato está ali; o que continua não mudando é a capacidade.
 */
export function distribuirPostos(ocupacoes = [], papeis = [], salas = null) {
  const mapa = { plantonista: salas?.plantao || null, sobreaviso: salas?.sobreaviso || null }
  const campo = { plantonista: 'plantao', sobreaviso: 'sobreaviso' }
  const restantes = [...ocupacoes].sort((a, b) => (b.desdeMin ?? 0) - (a.desdeMin ?? 0))
  const postos = papeis.map((papel) => ({ papel, item: null }))

  for (const posto of postos) {
    const marcada = mapa[posto.papel]
    if (!marcada) continue
    // `postoMarcado` vem do grupo e sobrevive à grafia: marcar "Sala 7" casa com
    // a ocupação que a tela chama de "Sala 7 - CO".
    const i = restantes.findIndex(
      (it) => it.postoMarcado === campo[posto.papel] || chaveSala(it.sala) === chaveSala(marcada),
    )
    if (i >= 0) posto.item = restantes.splice(i, 1)[0]
  }
  for (const posto of postos) {
    if (!posto.item && restantes.length) posto.item = restantes.shift()
  }
  return { postos, extras: restantes }
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
