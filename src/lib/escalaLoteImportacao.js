/**
 * Lote de importação do DIA ÚTIL (dono 2026-08-27).
 *
 * "Ao adicionar os arquivos das escalas em dias úteis, quero que verifique a
 * possibilidade de adicionar como é feito no final de semana": os mapas dos
 * hospitais passam a entrar TODOS DE UMA VEZ e a conferência ganha uma ABA por
 * hospital. O que NÃO muda (dono, na mesma conversa): data e período seguem
 * globais — "continuarei anexando as escalas um turno por vez" —, e a
 * conferência de cada aba é a de sempre, inteira.
 *
 * A diferença para o fim de semana (`escalaFdsMapas.js`) é a identidade do
 * item: lá a chave é hospital+dia porque um documento cobre o fim de semana
 * inteiro; aqui o dia e o turno são do LOTE, então a chave é só o HOSPITAL —
 * reanexar o mesmo hospital substitui a aba dele.
 *
 * Este módulo é puro: só classifica, conta e monta plano. Quem publica é a
 * página, uma escala de cada vez, pela mesma via de sempre.
 */

import { hospitalPelaEstrutura, decidirHospital } from './escalaHospitalEstrutura'

const HOSPITAIS = ['unimed', 'hro', 'materno']

const texto = (v) => String(v ?? '').trim()
const ehISO = (v) => /^\d{4}-\d{2}-\d{2}$/.test(texto(v))

/** Chave do item do lote: o HOSPITAL. Reanexar o mesmo hospital substitui. */
export function chaveEscala(hospital) {
  return texto(hospital) || '?'
}

/**
 * A que escala do lote um anexo pertence.
 *
 * O documento se declara, como no fim de semana: o layout diz o hospital
 * (`hospitalDetectado`, que a edge já devolve hoje) e o cabeçalho diz a data
 * (`dataDetectada`). Desde 30/08 o CONTEÚDO tem voto junto com o layout — IOSC,
 * Hemodinâmica e Bloco M só existem no HRO; SRPA, Accurata e Umanitá, só na
 * Unimed —, e é ele que segura o arquivo quando a cor do print não convence a
 * leitura. Excel/CSV sem marca nenhuma continua sendo o export da Unimed; a
 * data fica com o lote de todo jeito.
 *
 * Tudo é SUGESTÃO: `confirmar` marca o que a leitura não resolveu, para o item
 * pedir em vez de a tela escolher sozinha (regra da casa: sugere, nunca troca
 * sozinho). Data de outro dia não é ruído — é o aviso de que o arquivo anexado
 * é de outra escala.
 */
export function classificarAnexoDiaUtil(resposta, { planilha = false, dataDoLote = '' } = {}) {
  const lido = texto(resposta?.hospitalDetectado)
  // 2ª fonte, de dentro do documento (dono 30/08: "não está reconhecendo a
  // escala do HRO"). O layout sozinho falha de dois jeitos, e o segundo é o
  // caro: quando ele sai VAZIO o arquivo só pergunta de quem é; quando sai
  // TROCADO, entra na aba do outro hospital por cima dela e a escala do HRO
  // some sem aviso. Ver `escalaHospitalEstrutura.js`.
  const { hospital: decidido, origem, conflito } = decidirHospital(lido, hospitalPelaEstrutura(resposta))
  // Planilha sem marca nenhuma segue sendo o export da Unimed. Mas a marca vem
  // ANTES da extensão: o mapa do HRO também chega em .xlsx, e "planilha =
  // Unimed" mandava a escala dele para a aba da Unimed.
  const hospital = decidido || (planilha ? 'unimed' : '')
  const detectada = texto(resposta?.dataDetectada)
  const bate = ehISO(detectada) && ehISO(dataDoLote) && detectada === dataDoLote
  return {
    hospital,
    origemHospital: decidido ? origem : (hospital ? 'planilha' : ''),
    hospitalLido: HOSPITAIS.includes(lido) ? lido : '',
    // leitura e conteúdo discordando não escolhe sozinho: `confirmar` leva o
    // arquivo para a fila do "de qual hospital é isto?", com o que o conteúdo viu
    conflitoHospital: conflito,
    // a data do LOTE manda: o anexo não redefine o dia da importação inteira,
    // só avisa quando mostra outro
    dataDivergente: ehISO(detectada) && ehISO(dataDoLote) && !bate ? detectada : '',
    confirmar: hospital ? [] : ['hospital'],
  }
}

/**
 * Estado de uma aba, na taxonomia que a conferência já usa hoje
 * (`ImportarEscalaPage`: BLOQUEIO é o que o publicar recusa — nome ambíguo e
 * duplicidade não classificada; o resto é AVISO, que só pede conferência).
 *
 * `tipo` é o que o selo da aba mostra: trava (vermelho) · avisa (âmbar) ·
 * pronto (✓). Escala sem nenhum caso ainda não é aba publicável.
 */
export function estadoEscala({ casos = 0, bloqueios = 0, avisos = 0 } = {}) {
  if (bloqueios > 0) return { tipo: 'trava', n: bloqueios }
  if (avisos > 0) return { tipo: 'avisa', n: avisos }
  return { tipo: casos > 0 ? 'pronto' : 'vazio', n: 0 }
}

/**
 * O que a folha de revisão publica e o que fica de fora.
 *
 * Hospital com BLOQUEIO não entra — é o mesmo `publicar` que já recusa hoje.
 * Mas ele não segura os outros: escala precisa publicar (princípio já gravado
 * na tela, no guardrail inverso de 30/07), e travar as três porque uma tem um
 * nome ambíguo deixaria o centro cirúrgico sem escala nenhuma. O que ficou de
 * fora é DITO, com o motivo, na própria folha.
 */
export function planoPublicacaoLote(escalas, { jaPublicadas = [], reservadas = [] } = {}) {
  const publicar = []
  const foraDoLote = []
  const subiu = new Set(jaPublicadas)
  // RESERVADA = a escala publicada mudou DEPOIS do rascunho restaurado (Onda 2): outro
  // aparelho publicou, ou a equipe marcou liberações. Sai do botão grande pelo mesmo
  // motivo de quem já subiu — publicar por cima é ação própria ("Republicar"), com aviso.
  const reservada = new Set(reservadas)
  for (const e of escalas || []) {
    if (!e?.hospital) continue
    if (reservada.has(e.hospital) && !subiu.has(e.hospital)) {
      foraDoLote.push({ hospital: e.hospital, motivo: 'republicar', n: 0 })
      continue
    }
    // JÁ PUBLICADA NESTE LOTE fica de fora do próximo toque (dono 03/09: "o segundo toque
    // deve publicar só o que faltou sem perder as informações já registradas nas outras
    // escalas publicadas"). Publicar é DELETE+reinsert e zera as liberações do turno —
    // republicar por engano apagava o que a equipe já tinha marcado na escala que subiu.
    if (subiu.has(e.hospital)) {
      foraDoLote.push({ hospital: e.hospital, motivo: 'publicada', n: 0 })
      continue
    }
    const estado = estadoEscala(e)
    if (estado.tipo === 'vazio') {
      foraDoLote.push({ hospital: e.hospital, motivo: 'vazia', n: 0 })
      continue
    }
    if (estado.tipo === 'trava') {
      foraDoLote.push({ hospital: e.hospital, motivo: 'bloqueio', n: estado.n })
      continue
    }
    publicar.push({ hospital: e.hospital, casos: e.casos, avisos: e.avisos || 0 })
  }
  return { publicar, foraDoLote }
}

/**
 * Rótulo do botão da folha. Diz QUANTAS vão — "Publicar as 2 prontas" quando
 * alguma ficou travada é o que evita a leitura de que o lote inteiro saiu.
 */
export function rotuloPublicacaoLote(plano, { rotulos = {} } = {}) {
  const n = plano?.publicar?.length || 0
  const fora = plano?.foraDoLote || []
  const bloqueadas = fora.filter((f) => f.motivo === 'bloqueio').length
  const jaPublicadas = fora.filter((f) => f.motivo === 'publicada').length
  if (!n) return jaPublicadas ? 'Tudo publicado' : 'Nada a publicar'
  // Segunda tentativa depois de uma parcial: o rótulo NOMEIA quem falta, para ninguém ler
  // "Publicar as 3" e achar que as que já estão no ar vão de novo.
  if (jaPublicadas) {
    const nomes = plano.publicar.map((p) => rotulos[p.hospital] || p.hospital).join(' e ')
    return `Tentar de novo · ${nomes}`
  }
  if (n === 1) return bloqueadas ? 'Publicar a que está pronta' : 'Publicar a escala'
  return bloqueadas ? `Publicar as ${n} prontas` : `Publicar as ${n}`
}

/**
 * Resultado da publicação em sequência, para a mensagem final.
 *
 * A publicação NÃO é transacional entre hospitais (cada uma é a sua própria
 * chamada, como sempre foi): se a segunda falhar, a primeira já está no ar. O
 * relato precisa dizer exatamente isso — esconder deixaria alguém republicando
 * o que já publicou.
 */
export function resumirPublicacaoLote(resultados) {
  const ok = (resultados || []).filter((r) => r?.ok).map((r) => r.hospital)
  const falhou = (resultados || []).filter((r) => r && !r.ok).map((r) => r.hospital)
  return { ok, falhou, tudoCerto: ok.length > 0 && falhou.length === 0 }
}

export { HOSPITAIS as HOSPITAIS_LOTE }
