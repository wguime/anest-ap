/**
 * MOTIVO DA SUSPENSÃO E DO ATRASO (dono 19/11/2026, modelo em `.tmp/motivo-suspensa-atrasada.html`).
 *
 * "Não há como informar que ela foi suspensa [...] quero que seja possível informar o motivo
 * (investigue os motivos mais frequentes) e um campo para preenchimento caso não seja possível
 * clicar no motivo". As listas cruzam o grupo da escala no WhatsApp (o que a equipe de fato
 * escreve: "Hb de 4, suspensa pela avaliação anestésica", "paciente não tem jejum", "material
 * não está pronto", "estamos extubando o paciente da anterior") com a literatura — revisões
 * sistemáticas de cancelamento (Abate 2020; IJQHC 2021, 78 estudos) e estudos brasileiros
 * (SOBECC, RSD), e para o atraso os estudos de first-case delay. Ordem ≈ frequência.
 *
 * Regras do dono (19/11):
 *  · suspensa EXIGE motivo; atrasada é opcional (marca-se no meio da correria);
 *  · o atraso NÃO pede "quanto": é calculado do horário agendado até o início marcado;
 *  · "Anestesista atrasado" é motivo próprio, separado de "Anestesista em outra sala".
 *
 * O que se grava é o TEXTO (rótulo do chip ou o "Outro" digitado), não um código: a lista pode
 * mudar sem migration e o relatório lê direto. LGPD: o campo livre pede "sem o nome do paciente".
 */

export const MOTIVOS_SUSPENSAO = [
  'Condição clínica do paciente',
  'Decisão ou ausência do cirurgião',
  'Sem horário de sala (tempo excedido)',
  'Paciente não veio ou desistiu',
  'Sem vaga de UTI ou leito',
  'Exames ou avaliação pré-anestésica pendentes',
  'Paciente sem jejum',
  'Falta de material ou equipamento',
  'Sem autorização do convênio',
]

export const MOTIVOS_ATRASO = [
  'Cirurgião atrasado ou em outra sala',
  'Cirurgia anterior da sala atrasou',
  'Anestesista atrasado',
  'Anestesista em outra sala',
  'Paciente não chegou ou não preparado',
  'Sala ou RPA não liberada',
  'Material ou equipamento não pronto',
  'Paciente aguardando jejum',
  'Urgência passou na frente',
]

/** Teto do texto — o mesmo CHECK da coluna (20261119180000). */
export const MOTIVO_MAX = 200

/** Status do eixo extra que têm motivo. */
export const temMotivo = (status) => status === 'suspensa' || status === 'atrasada'

/** Coluna (camelCase) do motivo de cada status. */
export const campoMotivo = (status) => (status === 'suspensa' ? 'motivoSuspensao' : status === 'atrasada' ? 'motivoAtraso' : null)

/** Lista de chips de cada status. */
export const motivosDe = (status) => (status === 'suspensa' ? MOTIVOS_SUSPENSAO : MOTIVOS_ATRASO)

/** Motivo é obrigatório? Só na suspensa. */
export const motivoObrigatorio = (status) => status === 'suspensa'

/** O texto gravado, limpo: espaços colapsados, cortado no teto; vazio = null. */
export function normalizarMotivo(texto) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MOTIVO_MAX).trim()
  return t || null
}

/**
 * Separa um motivo gravado em { chip, outro } para reabrir o editor: se o texto é um dos
 * rótulos da lista, o chip volta marcado; senão, volta como "Outro".
 */
export function motivoParaEdicao(status, texto) {
  const t = normalizarMotivo(texto)
  if (!t) return { chip: null, outro: '' }
  return motivosDe(status).includes(t) ? { chip: t, outro: '' } : { chip: OUTRO, outro: t }
}

/** Valor do chip "Outro" — abre o campo livre. */
export const OUTRO = '__outro__'

/** O que gravar a partir do editor; null quando nada foi escolhido/escrito. */
export function motivoEscolhido({ chip, outro }) {
  if (chip === OUTRO) return normalizarMotivo(outro)
  return normalizarMotivo(chip)
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/
const minutos = (hhmm) => {
  const m = HHMM.exec(String(hhmm ?? '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * QUANTO ATRASOU (dono 19/11: "calcule automaticamente do início previsto até a marcação do
 * início"): início real − hora agendada, em minutos. Null quando falta um dos dois (a "AS",
 * a seguir, não tem hora) ou quando não houve atraso.
 */
export function minutosDeAtraso(caso) {
  const previsto = minutos(caso?.hora)
  const real = minutos(caso?.inicioReal)
  if (previsto == null || real == null) return null
  const d = real - previsto
  return d > 0 ? d : null
}

/** "40 min", "1h", "1h20". */
export function rotuloMinutos(min) {
  if (!(min > 0)) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

/**
 * A linha que acompanha o selo (quadro, detalhe): o motivo do status ATUAL e, no atraso, o
 * quanto. Só lê o motivo do status que a cirurgia tem agora — o atraso de uma cirurgia depois
 * suspensa fica gravado, mas a linha fala da suspensão.
 */
export function linhaDoMotivo(caso) {
  const status = caso?.statusExtra
  if (!temMotivo(status)) return ''
  const motivo = normalizarMotivo(caso[campoMotivo(status)])
  const quanto = status === 'atrasada' ? rotuloMinutos(minutosDeAtraso(caso)) : ''
  return [quanto && `Atrasou ${quanto}`, motivo].filter(Boolean).join(' · ')
}

/**
 * Grava status + motivo de uma cirurgia de HOJE pelas ações do context. O MOTIVO VAI PRIMEIRO:
 * `atualizarCaso` repinta a lista de casos a partir do `escala` recebido, e `setStatusCirurgia`
 * só aplica o patch do status — na ordem inversa o motivo apagaria o status otimista.
 *  · `ligar` true: deixa a cirurgia no status (não desliga quem já está nele);
 *  · `ligar` false: tira o status e limpa o motivo dele.
 */
export async function gravarStatusComMotivo({ escala, caso, status, motivo = null, ligar = true, userId = null, setStatusCirurgia, atualizarCaso }) {
  const campo = campoMotivo(status)
  const novo = ligar ? normalizarMotivo(motivo) : null
  if (campo && caso.id && novo !== normalizarMotivo(caso[campo])) {
    await atualizarCaso(escala, caso.id, { [campo]: novo }, { silencioso: true })
  }
  const ativo = caso.statusExtra === status
  if (ligar !== ativo) await setStatusCirurgia(escala, caso, status, { userId })
}

/**
 * O "OUTRO" PARECE IDENTIFICAR O PACIENTE? (revisão LGPD, 19/11): no grupo da escala o recado de
 * suspensão costuma trazer o nome completo. Aviso que NÃO bloqueia — achado clínico ("Hb 4")
 * não é o alvo; nome, CPF e número de prontuário/atendimento são.
 */
export function pareceIdentificarPaciente(texto) {
  const t = String(texto ?? '')
  if (/\d{6,}/.test(t.replace(/[.\-/\s]/g, ''))) return true // prontuário, atendimento, CPF
  // "Sr. Fulano", "paciente Fulano": o tratamento em qualquer caixa, o nome com maiúscula
  if (/\b(?:[Ss][Rr][Aa]?|[Ss]rta|[Pp]aciente|[Pp]cte|[Pp]ct)\.?\s+[A-ZÀ-Ý][a-zà-ÿ]+/.test(t)) return true
  // duas palavras seguidas com inicial maiúscula (nome e sobrenome), fora o começo da frase
  return /(?:^|[^.!?]\s)\S*\s?[A-ZÀ-Ý][a-zà-ÿ]{2,}\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][a-zà-ÿ]{2,}/.test(t.replace(/^\s*\S+/, ''))
}
