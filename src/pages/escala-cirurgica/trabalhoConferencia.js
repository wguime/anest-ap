/**
 * O TRABALHO da conferência de um hospital, num objeto só (Onda 2; audit A7).
 *
 * `lote` é a LEITURA preparada (todas as linhas do anexo, de todos os turnos, com a
 * identidade `_lid` e o turno carimbados) e não muda depois de carregada. `linhas` é o
 * que a secretária fez com ela — a hora corrigida, a sala escolhida, a linha removida —
 * também de todos os turnos: a lista do turno na tela (`casos`) é um FILTRO daqui, então
 * trocar o período não perde nada e não precisa dos refs de edição/remoção de antes.
 * O resto é o rodapé, a ajuda e a memória dos efeitos one-shot dos azuis.
 *
 * No lote o objeto mora no PAI (`ImportarEscalasPage`, que grava o rascunho); na tela de
 * uma escala só, no `useState` local de `ImportarEscalaPage`. A página não sabe a
 * diferença: lê `trabalho` e escreve por `atualizar(updater)`.
 *
 * Módulo próprio (e não uma constante exportada da página) porque o rascunho e o store do
 * lote precisam dele sem importar um componente — e o fast refresh do Vite só funciona em
 * arquivo que exporta só componentes.
 */
export const TRABALHO_VAZIO = Object.freeze({
  lote: null,
  linhas: [],
  atribuicoes: {},
  ordemTexto: '',
  ajudaTexto: '',
  azuisDaLeitura: [],
  azuisRealocados: [],
  entrantesProcessados: [],
})

/** Trabalho vindo de fora (rascunho, pai): completa o que faltar com o vazio. */
export function normalizarTrabalho(t) {
  if (!t || typeof t !== 'object') return TRABALHO_VAZIO
  return {
    ...TRABALHO_VAZIO,
    ...t,
    linhas: Array.isArray(t.linhas) ? t.linhas : [],
    atribuicoes: t.atribuicoes && typeof t.atribuicoes === 'object' ? t.atribuicoes : {},
    ordemTexto: typeof t.ordemTexto === 'string' ? t.ordemTexto : '',
    ajudaTexto: typeof t.ajudaTexto === 'string' ? t.ajudaTexto : '',
    azuisDaLeitura: Array.isArray(t.azuisDaLeitura) ? t.azuisDaLeitura : [],
    azuisRealocados: Array.isArray(t.azuisRealocados) ? t.azuisRealocados : [],
    entrantesProcessados: Array.isArray(t.entrantesProcessados) ? t.entrantesProcessados : [],
  }
}

/** Há conferência feita? (algo além do que a leitura entregou) */
export function trabalhoTemConteudo(t) {
  return !!(t && (t.lote || t.linhas?.length || t.ordemTexto || t.ajudaTexto || Object.keys(t.atribuicoes || {}).length))
}
