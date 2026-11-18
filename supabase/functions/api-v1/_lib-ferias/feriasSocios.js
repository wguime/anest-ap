// AUTO-GERADO por scripts/gerar-libs-ferias-api-v1.mjs a partir de src/lib/feriasSocios.js
// NÃO EDITAR — edite src/lib/feriasSocios.js e rode o script.
// deno-lint-ignore-file
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
 * `filhosIdadeEscolar` (V-13): lista do comitê enviada pelo dono em
 * 18/11/2026 (13 sócios). Com ela cadastrada, as semanas escolares só abrem
 * a quem tem filho até 2 meses antes; depois, a qualquer sócio com vaga.
 *
 * Manutenção anual: entrada/saída de sócios em março → duplicar o ano novo
 * com os ajustes. getSocios() cai no ano mais recente disponível.
 */

const SOCIOS_2026 = [
  { nome: 'MARCOS TADEU CURY', nomeCompleto: 'Marcos Tadeu Cury', anoEntrada: 1988, filhosIdadeEscolar: false },
  { nome: 'RAUL PERIZZOLO', nomeCompleto: 'Raul Perizzolo', anoEntrada: 1990, filhosIdadeEscolar: true },
  { nome: 'ADRIANO DALL´MAGRO', nomeCompleto: 'Adriano Dall Magro', anoEntrada: 1995, filhosIdadeEscolar: false },
  { nome: 'VICENTE PONS', nomeCompleto: 'Vicente Antonio Alves Pons', anoEntrada: 1997, filhosIdadeEscolar: false },
  { nome: 'MAURICIO MAHALEM BASTOS', nomeCompleto: 'Maurício Mahalem Bastos', anoEntrada: 2003, filhosIdadeEscolar: false },
  { nome: 'ROSEMARY CURY', nomeCompleto: 'Rosemary Cury', anoEntrada: 2004, filhosIdadeEscolar: false },
  { nome: 'HUMBERTO HEPP', nomeCompleto: 'Humberto Hepp', anoEntrada: 2006, filhosIdadeEscolar: true },
  { nome: 'RODNEI CABRAL LIMA', nomeCompleto: 'Rodnei Cabral Lima', anoEntrada: 2010, filhosIdadeEscolar: false },
  { nome: 'MARCOS CARDOSO COSTA', nomeCompleto: 'Marcos Cardoso Costa', anoEntrada: 2010, filhosIdadeEscolar: false },
  { nome: 'RAQUEL SCHNEIDER', nomeCompleto: 'Raquel Schneider Feliciani', anoEntrada: 2012, filhosIdadeEscolar: true },
  { nome: 'ALINE BOFF BONFANTE', nomeCompleto: 'Aline Boff Bonfante', anoEntrada: 2012, filhosIdadeEscolar: true },
  { nome: 'GUSTAVO ALMANSA GARIM', nomeCompleto: 'Gustavo Almansa Garim', anoEntrada: 2013, filhosIdadeEscolar: true },
  { nome: 'OSCAR AUGUSTO DE OLIVEIRA MORAIS', nomeCompleto: 'Oscar Augusto de Oliveira Morais', anoEntrada: 2013, filhosIdadeEscolar: true },
  { nome: 'JANAINA SANCHES FAVORITO MORAIS', nomeCompleto: 'Janaina Sanches Favorito Morais', anoEntrada: 2014, filhosIdadeEscolar: true },
  { nome: 'DIEGO B. RIGOTTI', nomeCompleto: 'Diego Boniatti Rigotti', anoEntrada: 2015, filhosIdadeEscolar: true },
  { nome: 'FERNANDA GUOLLO', nomeCompleto: 'Fernanda Guollo', anoEntrada: 2017, filhosIdadeEscolar: false },
  { nome: 'GABRIELA CITRON VEDANA', nomeCompleto: 'Gabriela Citron Vedana', anoEntrada: 2018, filhosIdadeEscolar: false },
  { nome: 'ROBERTA MARINA GRANDO', nomeCompleto: 'Roberta Marina Grando', anoEntrada: 2018, filhosIdadeEscolar: false },
  { nome: 'GUSTAVO BIESDORF', nomeCompleto: 'Gustavo Biesdorf', anoEntrada: 2018, filhosIdadeEscolar: false },
  { nome: 'LEONARDO FERRAZZO', nomeCompleto: 'Leonardo Ferrazzo', anoEntrada: 2019, filhosIdadeEscolar: false },
  { nome: 'MARILIO JOSÉ FLACH', nomeCompleto: 'Marilio Jose Flach', anoEntrada: 2019, filhosIdadeEscolar: true },
  { nome: 'FERNANDO HENRIQUE MACHADO', nomeCompleto: 'Fernando Henrique Machado', anoEntrada: 2019, filhosIdadeEscolar: false },
  { nome: 'LEANDRO BERNARDES', nomeCompleto: 'Leandro Bernardes', anoEntrada: 2020, filhosIdadeEscolar: false },
  { nome: 'CRISTINA BERTOL BARBOSA MARCON', nomeCompleto: 'Cristina Bertol Barbosa Marcon', anoEntrada: 2020, filhosIdadeEscolar: false },
  { nome: 'TIAGO IOP VIANA', nomeCompleto: 'Tiago Iop Viana', anoEntrada: 2021, filhosIdadeEscolar: false },
  { nome: 'G. MELO', nomeCompleto: 'Guilherme Souza Melo', anoEntrada: 2021, filhosIdadeEscolar: false },
  { nome: 'PAULO TONINI', nomeCompleto: 'Paulo Tonini', anoEntrada: 2021, filhosIdadeEscolar: true },
  { nome: 'G. STAUB', nomeCompleto: 'Guilherme Jonck Staub', anoEntrada: 2021, filhosIdadeEscolar: true },
  { nome: 'A. DANIELI', nomeCompleto: 'Alexandre Silva Danieli', anoEntrada: 2022, filhosIdadeEscolar: true },
  { nome: 'JOÃO RICARDO MOREIRA', nomeCompleto: 'João Ricardo Moreira', anoEntrada: 2022, filhosIdadeEscolar: false },
  { nome: 'A. SCHMIDT', nomeCompleto: 'Alexandre Schmidt', anoEntrada: 2022, filhosIdadeEscolar: false },
  { nome: 'KLISMAN DRESCHER HILLESHEIN', nomeCompleto: 'Klisman Drescher Hilleshein', anoEntrada: 2023, filhosIdadeEscolar: false },
  { nome: 'GIOVANA GOMES NOLL', nomeCompleto: 'Giovana Gomes Noll', anoEntrada: 2023, filhosIdadeEscolar: false },
  { nome: 'EDUARDO SAVOLDI', nomeCompleto: 'Eduardo Schmidt Savoldi', anoEntrada: 2023, filhosIdadeEscolar: false },
  { nome: 'LOUISE MACAGNAN WARNAVA', nomeCompleto: 'Louise Macagnan Warnava', anoEntrada: 2024, filhosIdadeEscolar: false },
  { nome: 'MATHEUS VIEIRA DA CUNHA', nomeCompleto: 'Matheus Vieira da Cunha', anoEntrada: 2024, filhosIdadeEscolar: false },
  { nome: 'THAYNÁ REGINA SANTOS', nomeCompleto: 'Thayná Regina Santos', anoEntrada: 2025, filhosIdadeEscolar: false },
  { nome: 'ERLEI PERINI', nomeCompleto: 'Erlei Perini', anoEntrada: 2025, filhosIdadeEscolar: true },
  { nome: 'GABRIEL JUAN KETTENHUBER COSTA', nomeCompleto: 'Gabriel Juan Kettenhuber Costa', anoEntrada: 2025, filhosIdadeEscolar: false },
  { nome: 'KARINE BEDIN', nomeCompleto: 'Karine Bedin', anoEntrada: 2025, filhosIdadeEscolar: false },
  { nome: 'RAFAEL PELISSARO', nomeCompleto: 'Rafael Pelissaro', anoEntrada: 2025, filhosIdadeEscolar: false },
  { nome: 'ROMULO SANTOS ROXO', nomeCompleto: 'Rômulo Santos Roxo', anoEntrada: 2026, filhosIdadeEscolar: false },
  { nome: 'JOAO HENRIQUE SALVAO VANNI', nomeCompleto: 'João Henrique Salvão Vanni', anoEntrada: 2026, filhosIdadeEscolar: false },
  { nome: 'GUILHERME XAVIER DI DOMENICO', nomeCompleto: 'Guilherme Xavier Di Domenico', anoEntrada: 2026, filhosIdadeEscolar: false },
  { nome: 'DANIELA KLEIN REIS', nomeCompleto: 'Daniela Klein Reis', anoEntrada: 2026, filhosIdadeEscolar: false },
  { nome: 'NATHALIA FORNARI FERNANDES', nomeCompleto: 'Nathalia Fornari Fernandes', anoEntrada: 2026, filhosIdadeEscolar: false },
]

/**
 * Cota de 2027 de cada sócio, em dias úteis — INFORMADA pelo comitê de
 * escalas (COTAS_FERIAS_2027.pdf, 16/11/2026: 49 linhas, total 1.300 dias com
 * os 4 novos de 5 dias). Regras novas: "cota de cada sócio informada sócio a
 * sócio" — o app usa este número e não o calculado. Bate com a progressão da
 * observação do PDF (1º ano 5 · 2º–3º 20 · depois 30 · +1/ano após 25 anos,
 * teto 35).
 */
const COTAS_2027 = {
  'MARCOS TADEU CURY': 35, 'RAUL PERIZZOLO': 35, 'ADRIANO DALL´MAGRO': 35, 'VICENTE PONS': 35,
  'JOAO HENRIQUE SALVAO VANNI': 20, 'GUILHERME XAVIER DI DOMENICO': 20, 'DANIELA KLEIN REIS': 20,
  'NATHALIA FORNARI FERNANDES': 20, 'THAYNÁ REGINA SANTOS': 20, 'ERLEI PERINI': 20,
  'GABRIEL JUAN KETTENHUBER COSTA': 20, 'KARINE BEDIN': 20, 'RAFAEL PELISSARO': 20,
}
const cota2027 = (nome) => COTAS_2027[nome] ?? 30

/**
 * 2027: Rômulo Santos Roxo sai do grupo (dono 18/11/2026). Os 4 novos
 * ("NOVO 1 a 4", 5 dias cada) entram quando o dono mandar os nomes do Pega
 * Plantão.
 */
const SOCIOS_2027 = SOCIOS_2026
  .filter((s) => s.nome !== 'ROMULO SANTOS ROXO')
  .map((s) => ({ ...s, cota: cota2027(s.nome) }))

/**
 * 2026 congelado na cota que valia no ano: a fórmula antiga somava +1 a
 * partir do 25º ano, e com a correção de 18/11 (soma só depois do 25º) o
 * Vicente (29 anos de grupo em 2026) cairia de 35 para 34 retroativamente.
 * Os dados de 2026 não mudam (dono 18/11/2026).
 */
const COTAS_2026_CONGELADAS = { 'VICENTE PONS': 35 }

export const SOCIOS_FERIAS = {
  2026: SOCIOS_2026.map((s) => (COTAS_2026_CONGELADAS[s.nome] ? { ...s, cota: COTAS_2026_CONGELADAS[s.nome] } : s)),
  2027: SOCIOS_2027,
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
