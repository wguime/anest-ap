/**
 * Sócios ativos do grupo para o Extrato de Férias — lista fornecida pelo
 * dono (2026-08-03) e validada 1:1 contra os 46 nomes que o Pega Plantão
 * devolve nas escalas de 2026.
 *
 * `nome` é EXATAMENTE a string que a API devolve em ProfDePlantao/ProfFixo
 * (uppercase, com acentos e o apóstrofo ´ do Adriano) — é a chave de match
 * e dos ids de violação (NÃO mudar: mudaria os ids e re-notificaria tudo).
 * `nomeCompleto` é o nome de exibição (decisão do dono 03/08: sempre nome
 * completo na UI, nunca a abreviação da escala).
 * `filhosIdadeEscolar`: true/false habilita a regra "metade das férias até
 * fim de jun/jul"; null (default atual) pula a regra para a pessoa.
 *
 * Manutenção anual: entrada/saída de sócios em março → duplicar o ano novo
 * com os ajustes. getSocios() cai no ano mais recente disponível.
 */

export const SOCIOS_FERIAS = {
  2026: [
    { nome: 'MARCOS TADEU CURY', nomeCompleto: 'Marcos Tadeu Cury', anoEntrada: 1988, filhosIdadeEscolar: null },
    { nome: 'RAUL PERIZZOLO', nomeCompleto: 'Raul Perizzolo', anoEntrada: 1990, filhosIdadeEscolar: null },
    { nome: 'ADRIANO DALL´MAGRO', nomeCompleto: 'Adriano Dall Magro', anoEntrada: 1995, filhosIdadeEscolar: null },
    { nome: 'VICENTE PONS', nomeCompleto: 'Vicente Antonio Alves Pons', anoEntrada: 1997, filhosIdadeEscolar: null },
    { nome: 'MAURICIO MAHALEM BASTOS', nomeCompleto: 'Maurício Mahalem Bastos', anoEntrada: 2003, filhosIdadeEscolar: null },
    { nome: 'ROSEMARY CURY', nomeCompleto: 'Rosemary Cury', anoEntrada: 2004, filhosIdadeEscolar: null },
    { nome: 'HUMBERTO HEPP', nomeCompleto: 'Humberto Hepp', anoEntrada: 2006, filhosIdadeEscolar: null },
    { nome: 'RODNEI CABRAL LIMA', nomeCompleto: 'Rodnei Cabral Lima', anoEntrada: 2010, filhosIdadeEscolar: null },
    { nome: 'MARCOS CARDOSO COSTA', nomeCompleto: 'Marcos Cardoso Costa', anoEntrada: 2010, filhosIdadeEscolar: null },
    { nome: 'RAQUEL SCHNEIDER', nomeCompleto: 'Raquel Schneider Feliciani', anoEntrada: 2012, filhosIdadeEscolar: null },
    { nome: 'ALINE BOFF BONFANTE', nomeCompleto: 'Aline Boff Bonfante', anoEntrada: 2012, filhosIdadeEscolar: null },
    { nome: 'GUSTAVO ALMANSA GARIM', nomeCompleto: 'Gustavo Almansa Garim', anoEntrada: 2013, filhosIdadeEscolar: null },
    { nome: 'OSCAR AUGUSTO DE OLIVEIRA MORAIS', nomeCompleto: 'Oscar Augusto de Oliveira Morais', anoEntrada: 2013, filhosIdadeEscolar: null },
    { nome: 'JANAINA SANCHES FAVORITO MORAIS', nomeCompleto: 'Janaina Sanches Favorito Morais', anoEntrada: 2014, filhosIdadeEscolar: null },
    { nome: 'DIEGO B. RIGOTTI', nomeCompleto: 'Diego Boniatti Rigotti', anoEntrada: 2015, filhosIdadeEscolar: null },
    { nome: 'FERNANDA GUOLLO', nomeCompleto: 'Fernanda Guollo', anoEntrada: 2017, filhosIdadeEscolar: null },
    { nome: 'GABRIELA CITRON VEDANA', nomeCompleto: 'Gabriela Citron Vedana', anoEntrada: 2018, filhosIdadeEscolar: null },
    { nome: 'ROBERTA MARINA GRANDO', nomeCompleto: 'Roberta Marina Grando', anoEntrada: 2018, filhosIdadeEscolar: null },
    { nome: 'GUSTAVO BIESDORF', nomeCompleto: 'Gustavo Biesdorf', anoEntrada: 2018, filhosIdadeEscolar: null },
    { nome: 'LEONARDO FERRAZZO', nomeCompleto: 'Leonardo Ferrazzo', anoEntrada: 2019, filhosIdadeEscolar: null },
    { nome: 'MARILIO JOSÉ FLACH', nomeCompleto: 'Marilio Jose Flach', anoEntrada: 2019, filhosIdadeEscolar: null },
    { nome: 'FERNANDO HENRIQUE MACHADO', nomeCompleto: 'Fernando Henrique Machado', anoEntrada: 2019, filhosIdadeEscolar: null },
    { nome: 'LEANDRO BERNARDES', nomeCompleto: 'Leandro Bernardes', anoEntrada: 2020, filhosIdadeEscolar: null },
    { nome: 'CRISTINA BERTOL BARBOSA MARCON', nomeCompleto: 'Cristina Bertol Barbosa Marcon', anoEntrada: 2020, filhosIdadeEscolar: null },
    { nome: 'TIAGO IOP VIANA', nomeCompleto: 'Tiago Iop Viana', anoEntrada: 2021, filhosIdadeEscolar: null },
    { nome: 'G. MELO', nomeCompleto: 'Guilherme Souza Melo', anoEntrada: 2021, filhosIdadeEscolar: null },
    { nome: 'PAULO TONINI', nomeCompleto: 'Paulo Tonini', anoEntrada: 2021, filhosIdadeEscolar: null },
    { nome: 'G. STAUB', nomeCompleto: 'Guilherme Jonck Staub', anoEntrada: 2021, filhosIdadeEscolar: null },
    { nome: 'A. DANIELI', nomeCompleto: 'Alexandre Silva Danieli', anoEntrada: 2022, filhosIdadeEscolar: null },
    { nome: 'JOÃO RICARDO MOREIRA', nomeCompleto: 'João Ricardo Moreira', anoEntrada: 2022, filhosIdadeEscolar: null },
    { nome: 'A. SCHMIDT', nomeCompleto: 'Alexandre Schmidt', anoEntrada: 2022, filhosIdadeEscolar: null },
    { nome: 'KLISMAN DRESCHER HILLESHEIN', nomeCompleto: 'Klisman Drescher Hilleshein', anoEntrada: 2023, filhosIdadeEscolar: null },
    { nome: 'GIOVANA GOMES NOLL', nomeCompleto: 'Giovana Gomes Noll', anoEntrada: 2023, filhosIdadeEscolar: null },
    { nome: 'EDUARDO SAVOLDI', nomeCompleto: 'Eduardo Schmidt Savoldi', anoEntrada: 2023, filhosIdadeEscolar: null },
    { nome: 'LOUISE MACAGNAN WARNAVA', nomeCompleto: 'Louise Macagnan Warnava', anoEntrada: 2024, filhosIdadeEscolar: null },
    { nome: 'MATHEUS VIEIRA DA CUNHA', nomeCompleto: 'Matheus Vieira da Cunha', anoEntrada: 2024, filhosIdadeEscolar: null },
    { nome: 'THAYNÁ REGINA SANTOS', nomeCompleto: 'Thayná Regina Santos', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'ERLEI PERINI', nomeCompleto: 'Erlei Perini', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'GABRIEL JUAN KETTENHUBER COSTA', nomeCompleto: 'Gabriel Juan Kettenhuber Costa', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'KARINE BEDIN', nomeCompleto: 'Karine Bedin', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'RAFAEL PELISSARO', nomeCompleto: 'Rafael Pelissaro', anoEntrada: 2025, filhosIdadeEscolar: null },
    { nome: 'ROMULO SANTOS ROXO', nomeCompleto: 'Rômulo Santos Roxo', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'JOAO HENRIQUE SALVAO VANNI', nomeCompleto: 'João Henrique Salvão Vanni', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'GUILHERME XAVIER DI DOMENICO', nomeCompleto: 'Guilherme Xavier Di Domenico', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'DANIELA KLEIN REIS', nomeCompleto: 'Daniela Klein Reis', anoEntrada: 2026, filhosIdadeEscolar: null },
    { nome: 'NATHALIA FORNARI FERNANDES', nomeCompleto: 'Nathalia Fornari Fernandes', anoEntrada: 2026, filhosIdadeEscolar: null },
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
