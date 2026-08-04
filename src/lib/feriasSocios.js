/**
 * Sócios ativos do grupo para o Extrato de Férias — lista fornecida pelo
 * dono (2026-08-03) e validada 1:1 contra os 46 nomes que o Pega Plantão
 * devolve nas escalas de 2026.
 *
 * `nome` é EXATAMENTE a string que a API devolve em ProfDePlantao/ProfFixo
 * (uppercase, com acentos e o apóstrofo ´ do Adriano) — é a chave de match.
 * `filhosIdadeEscolar`: true/false habilita a regra "metade das férias até
 * fim de jun/jul"; null (default atual) pula a regra para a pessoa.
 *
 * Manutenção anual: entrada/saída de sócios em março → duplicar o ano novo
 * com os ajustes. getSocios() cai no ano mais recente disponível.
 */

export const SOCIOS_FERIAS = {
  2026: [
    { nome: 'MARCOS TADEU CURY', anoEntrada: 1988, filhosIdadeEscolar: null },
    { nome: 'RAUL PERIZZOLO', anoEntrada: 1990, filhosIdadeEscolar: null },
    { nome: 'ADRIANO DALL´MAGRO', anoEntrada: 1995, filhosIdadeEscolar: null },
    { nome: 'VICENTE PONS', anoEntrada: 1997, filhosIdadeEscolar: null },
    { nome: 'MAURICIO MAHALEM BASTOS', anoEntrada: 2003, filhosIdadeEscolar: null },
    { nome: 'ROSEMARY CURY', anoEntrada: 2004, filhosIdadeEscolar: null },
    { nome: 'HUMBERTO HEPP', anoEntrada: 2006, filhosIdadeEscolar: null },
    { nome: 'RODNEI CABRAL LIMA', anoEntrada: 2010, filhosIdadeEscolar: null },
    { nome: 'MARCOS CARDOSO COSTA', anoEntrada: 2010, filhosIdadeEscolar: null },
    { nome: 'RAQUEL SCHNEIDER', anoEntrada: 2012, filhosIdadeEscolar: null },
    { nome: 'ALINE BOFF BONFANTE', anoEntrada: 2012, filhosIdadeEscolar: null },
    { nome: 'GUSTAVO ALMANSA GARIM', anoEntrada: 2013, filhosIdadeEscolar: null },
    { nome: 'OSCAR AUGUSTO DE OLIVEIRA MORAIS', anoEntrada: 2013, filhosIdadeEscolar: null },
    { nome: 'JANAINA SANCHES FAVORITO MORAIS', anoEntrada: 2014, filhosIdadeEscolar: null },
    { nome: 'DIEGO B. RIGOTTI', anoEntrada: 2015, filhosIdadeEscolar: null },
    { nome: 'FERNANDA GUOLLO', anoEntrada: 2017, filhosIdadeEscolar: null },
    { nome: 'GABRIELA CITRON VEDANA', anoEntrada: 2018, filhosIdadeEscolar: null },
    { nome: 'ROBERTA MARINA GRANDO', anoEntrada: 2018, filhosIdadeEscolar: null },
    { nome: 'GUSTAVO BIESDORF', anoEntrada: 2018, filhosIdadeEscolar: null },
    { nome: 'LEONARDO FERRAZZO', anoEntrada: 2019, filhosIdadeEscolar: null },
    { nome: 'MARILIO JOSÉ FLACH', anoEntrada: 2019, filhosIdadeEscolar: null },
    { nome: 'FERNANDO HENRIQUE MACHADO', anoEntrada: 2019, filhosIdadeEscolar: null },
    { nome: 'LEANDRO BERNARDES', anoEntrada: 2020, filhosIdadeEscolar: null },
    { nome: 'CRISTINA BERTOL BARBOSA MARCON', anoEntrada: 2020, filhosIdadeEscolar: null },
    { nome: 'TIAGO IOP VIANA', anoEntrada: 2021, filhosIdadeEscolar: null },
    { nome: 'G. MELO', anoEntrada: 2021, filhosIdadeEscolar: null },
    { nome: 'PAULO TONINI', anoEntrada: 2021, filhosIdadeEscolar: null },
    { nome: 'G. STAUB', anoEntrada: 2021, filhosIdadeEscolar: null },
    { nome: 'A. DANIELI', anoEntrada: 2022, filhosIdadeEscolar: null },
    { nome: 'JOÃO RICARDO MOREIRA', anoEntrada: 2022, filhosIdadeEscolar: null },
    { nome: 'A. SCHMIDT', anoEntrada: 2022, filhosIdadeEscolar: null },
    { nome: 'KLISMAN DRESCHER HILLESHEIN', anoEntrada: 2023, filhosIdadeEscolar: null },
    { nome: 'GIOVANA GOMES NOLL', anoEntrada: 2023, filhosIdadeEscolar: null },
    { nome: 'EDUARDO SAVOLDI', anoEntrada: 2023, filhosIdadeEscolar: null },
    { nome: 'LOUISE MACAGNAN WARNAVA', anoEntrada: 2024, filhosIdadeEscolar: null },
    { nome: 'MATHEUS VIEIRA DA CUNHA', anoEntrada: 2024, filhosIdadeEscolar: null },
    { nome: 'THAYNÁ REGINA SANTOS', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'ERLEI PERINI', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'GABRIEL JUAN KETTENHUBER COSTA', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'KARINE BEDIN', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'RAFAEL PELISSARO', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'ROMULO SANTOS ROXO', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'JOAO HENRIQUE SALVAO VANNI', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'GUILHERME XAVIER DI DOMENICO', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'DANIELA KLEIN REIS', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'NATHALIA FORNARI FERNANDES', anoEntrada: 2026, filhosIdadeEscolar: null },
  ],
}

/**
 * Sócios do ano; se o ano ainda não foi configurado, usa o mais recente
 * disponível (com warn) — a virada de ano não pode deixar o extrato vazio.
 */
export function getSocios(ano) {
  if (SOCIOS_FERIAS[ano]) return SOCIOS_FERIAS[ano]
  const anos = Object.keys(SOCIOS_FERIAS).map(Number).sort((a, b) => b - a)
  const fallback = anos[0]
  console.warn(`[feriasSocios] Sócios de ${ano} não configurados — usando lista de ${fallback}`)
  return SOCIOS_FERIAS[fallback]
}
