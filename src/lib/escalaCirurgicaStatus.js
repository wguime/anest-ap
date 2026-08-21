/**
 * Status de uma cirurgia — a FONTE ÚNICA das perguntas que o app faz sobre ela.
 *
 * PORQUÊ (dono 2026-08-21, "as informações não podem ser desencontradas"): a
 * pergunta "essa cirurgia acabou?" estava escrita em QUATRO lugares — a definição
 * canônica em `escala-cirurgica/utils.js`, duas cópias verbatim (a coluna de
 * liberação e a view das Liberações) e uma variante DIFERENTE nos caminhos de
 * troca. Quatro cópias da mesma frase é drift esperando acontecer, e drift aqui
 * significa duas telas afirmando coisas opostas sobre o mesmo paciente.
 *
 * ⚠️ São DUAS perguntas, e continuam sendo duas de propósito:
 *   · `casoConcluido` — "ainda ocupa alguém?" (terminada OU suspensa). É o que
 *     decide sala fechada, cronômetro parado e vaga do contrato livre.
 *   · `casoTerminado` — "quem responde pelo registro?" (SÓ terminada). É o que a
 *     troca de responsável usa: cirurgia SUSPENSA continua sendo transferida ao
 *     novo anestesista, porque ela pode voltar a acontecer.
 * Unificar as duas num booleano só mudaria o comportamento da troca sem ninguém
 * ter pedido — por isso o que se unifica aqui é o VOCABULÁRIO, não a semântica.
 *
 * Sem imports de propósito: `utils.js` importa de `colunaLiberacao.js`, que
 * importaria de volta — um módulo folha corta o ciclo.
 */

/** Status que encerram o caso p/ fins de estimativa/fechamento de sala. */
export const STATUS_CONCLUIDO = ['terminada', 'suspensa']

/**
 * Caso concluído p/ fins de SALA: terminada (eixo principal) OU suspensa — que
 * hoje vive em `statusExtra` e, em dado legado/demo, no campo principal.
 */
export const casoConcluido = (c) =>
  STATUS_CONCLUIDO.includes(c?.statusCirurgia || 'agendada') || c?.statusExtra === 'suspensa'

/**
 * Caso TERMINADO — o registro do que já aconteceu. Suspensa NÃO entra: quem
 * assume a sala assume também a cirurgia suspensa, que pode ser retomada.
 */
export const casoTerminado = (c) => (c?.statusCirurgia || 'agendada') === 'terminada'

/**
 * Quando o EIXO PRINCIPAL mudou pela última vez, e por quem — o "Iniciada às
 * 14:33 por Fulano" do detalhe do caso (dono 2026-08-21).
 *
 * PORQUÊ: a pesquisa sobre quadros cirúrgicos eletrônicos é consistente num
 * ponto — o quadro que a equipe não confia AUMENTA a carga de comunicação, porque
 * as pessoas ligam para confirmar. O antídoto barato é o quadro dizer há quanto
 * tempo aquilo foi marcado e por quem, em vez de afirmar um estado sem procedência.
 *
 * ⚠️ Só faz sentido depois da migration de 21/08 que parou de carimbar o par no
 * toggle de aviso: antes, esta frase diria o nome de quem tocou num badge.
 *
 * Devolve `null` quando não há o que dizer: caso agendado (nada aconteceu ainda),
 * sem carimbo, ou carimbo de OUTRO dia — a mesma regra de `inicioDaUrgencia`,
 * porque um horário sem data engana mais do que informa.
 *
 * @param {object} caso
 * @param {{dataEscala?: string}} [opts]  ISO 'YYYY-MM-DD' da escala
 * @returns {{status: string, hora: string, porUid: string|null}|null}
 */
export function carimboDeStatus(caso, { dataEscala } = {}) {
  const status = caso?.statusCirurgia || 'agendada'
  if (status === 'agendada') return null
  const bruto = caso?.statusAtualizadoEm || caso?.status_atualizado_em
  if (!bruto) return null
  const d = new Date(bruto)
  if (Number.isNaN(d.getTime())) return null
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (dataEscala && iso !== dataEscala) return null
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return { status, hora, porUid: caso?.statusAtualizadoPor || caso?.status_atualizado_por || null }
}
