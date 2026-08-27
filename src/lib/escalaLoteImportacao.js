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
 * (`dataDetectada`). Excel/CSV é o export padrão da Unimed e não tem nem um nem
 * outro — vale a extensão para o hospital, e a data fica com o lote.
 *
 * Tudo é SUGESTÃO: `confirmar` marca o que a leitura não resolveu, para o item
 * pedir em vez de a tela escolher sozinha (regra da casa: sugere, nunca troca
 * sozinho). Data de outro dia não é ruído — é o aviso de que o arquivo anexado
 * é de outra escala.
 */
export function classificarAnexoDiaUtil(resposta, { planilha = false, dataDoLote = '' } = {}) {
  const lido = texto(resposta?.hospitalDetectado)
  const hospital = HOSPITAIS.includes(lido) ? lido : (planilha ? 'unimed' : '')
  const detectada = texto(resposta?.dataDetectada)
  const bate = ehISO(detectada) && ehISO(dataDoLote) && detectada === dataDoLote
  return {
    hospital,
    origemHospital: hospital ? (HOSPITAIS.includes(lido) ? 'layout' : 'planilha') : '',
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
export function planoPublicacaoLote(escalas) {
  const publicar = []
  const foraDoLote = []
  for (const e of escalas || []) {
    if (!e?.hospital) continue
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
export function rotuloPublicacaoLote(plano) {
  const n = plano?.publicar?.length || 0
  const fora = (plano?.foraDoLote || []).filter((f) => f.motivo === 'bloqueio').length
  if (!n) return 'Nada a publicar'
  if (n === 1) return fora ? 'Publicar a que está pronta' : 'Publicar a escala'
  return fora ? `Publicar as ${n} prontas` : `Publicar as ${n}`
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
