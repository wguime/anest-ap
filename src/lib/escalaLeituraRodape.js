/**
 * Leitura de dia útil que voltou SEM a ordem de liberação.
 *
 * 08/09/2026: a foto do HRO (897×635, comprimida pelo WhatsApp) lida sem a dica
 * de hospital devolveu 15 casos e rodapé VAZIO — sumiram IOSC, Hospital de
 * Olhos, Exames, Ambulatório e a fila inteira — e a escala foi publicada assim,
 * com a aba Liberações sem ninguém. A MESMA foto, lida com as regras do HRO,
 * devolveu os 26 casos e os 17 nomes. Rodapé vazio em HRO/Unimed não é "dia sem
 * rodapé": é leitura que parou no meio, e a saída barata é reler UMA vez com a
 * dica do hospital que a própria leitura detectou — o mesmo caminho que a
 * secretária já tinha ao corrigir o hospital à mão.
 *
 * A edge devolve `rodapeVazio` pelo mesmo critério; aqui ele é derivado de novo
 * para valer com qualquer versão da edge no ar.
 */
const COM_RODAPE = new Set(['hro', 'unimed'])

/** HRO/Unimed sem nenhum nome na ordem de liberação. Materno nunca tem rodapé. */
export function rodapeAusente(hospital, ordemLiberacao) {
  if (!COM_RODAPE.has(String(hospital ?? '').trim().toLowerCase())) return false
  return !(Array.isArray(ordemLiberacao) && ordemLiberacao.length > 0)
}

/**
 * Vale reler com a dica do hospital? Só quando a 1ª leitura foi SEM dica, não
 * foi cortada (o corte tem tratamento próprio) e o hospital detectado é um dos
 * que sempre trazem rodapé.
 */
export function precisaRelerComHint({ hospitalDetectado, ordemLiberacao, truncado, hint } = {}) {
  if (hint) return false
  if (truncado) return false
  return rodapeAusente(hospitalDetectado, ordemLiberacao)
}
