/**
 * Regras de cálculo da codificação anestésica Unimed — config auditável e editável.
 *
 * ⚠️ Auditoria: os percentuais redutores NÃO constam da tabela referencial (NOTA oficial:
 * "Regras de excludência... bem como percentuais redutores ou adicionais não estão previstos
 * nesta tabela"). Os defaults abaixo seguem a praxe CBHPM/Unimed e a instrução 7 do Protocolo
 * Nacional; são premissas de conferência, expostas na UI e na justificativa, não substituem a
 * auditoria da Unimed Executora.
 */

/**
 * Multiplicadores de UTM por tabela de honorário.
 * Os valores armazenados na tabela usam intercâmbio (1,17); a UI exibe sempre LOCAL (1,73,
 * Unimed Chapecó com subsídio) = stored × (1,73/1,17).
 */
export const MULTIPLICADORES = Object.freeze({
  intercambio: 1.17, // Base Sistema Unimed (sem subsídio) — base dos valores armazenados
  local: 1.73, // Unimed Chapecó (com subsídio) — sempre usado na exibição
});

/**
 * Opções de percentual do badge (fornecidas pelo dono — padrão Volan/Unimed).
 * 50% = mesma via de acesso; 70% = outra via de acesso; 100% = principal.
 */
export const OPCOES_PERCENTUAL = [
  { v: 10, label: '10%' },
  { v: 30, label: '30%' },
  { v: 40, label: '40%' },
  { v: 50, label: 'Mesma via de acesso' },
  { v: 70, label: 'Outra via de acesso' },
  { v: 100, label: 'Principal' },
];

/**
 * Acomodação → multiplicador do honorário (regra Unimed Chapecó informada pelo dono):
 * Apartamento dobra; Enfermaria/Ambulatório = tabela. One Day Clinic assumido = Ambulatório (1×).
 */
export const ACOMODACOES = [
  { value: 'enfermaria', label: 'Enfermaria', mult: 1 },
  { value: 'apartamento', label: 'Apartamento', mult: 2 },
  { value: 'ambulatorio', label: 'Ambulatório', mult: 1 },
  { value: 'one_day', label: 'One Day Clinic', mult: 1 },
];
export const ACOMODACAO_PADRAO = 'enfermaria';

/** Auto-sugestão: maior valor = 100% (Principal); demais = 50% (Mesma via de acesso). */
export const SUGESTAO_REDUTOR = [100, 50];

/** Default editável na UI. Tabela sempre local (1,73). */
export const REGRAS_PADRAO = {
  tabela: 'local',
  percentualPadrao: 100,
  multiplicadores: MULTIPLICADORES,
};

/**
 * Mapa palavra-chave da descrição → código "Anestesia para exame específico" mais adequado,
 * quando o código colado não paga anestesia mas é um exame/procedimento diagnóstico.
 * Ordem importa (primeiro match vence).
 */
export const RECOMENDACAO_EXAME = [
  { rx: /resson[âa]ncia|\brm\b|\brnm\b/i, codigo: '31602282' },
  { rx: /tomografia|\btc\b/i, codigo: '31602274' },
  { rx: /radioterapi|braquiterapi/i, codigo: '31602290' },
  { rx: /medicina nuclear|cintilograf|pet[- ]?ct|\bspect\b/i, codigo: '31602320' },
  { rx: /angiografia|angiorradio|cateterismo|arteriografia|hemodin|\bpam\b/i, codigo: '31602258' },
  { rx: /endoscopi|colonoscopi|\bcpre\b|broncoscopi|laringoscopi|histeroscopi|cistoscopi|esofagogastro/i, codigo: '31602240' },
  { rx: /ultrassonografi|ultrassom|\bus\b|doppler|ecograf/i, codigo: '31602266' },
];

/** Códigos default quando não há mapeamento específico de exame. */
export const RECOMENDACAO_DEFAULT = {
  imperativoClinico: '31602355', // indicação do paciente
  semPorte: '31602347', // ato sem porte previsto
};

export default {
  MULTIPLICADORES,
  OPCOES_PERCENTUAL,
  ACOMODACOES,
  ACOMODACAO_PADRAO,
  SUGESTAO_REDUTOR,
  REGRAS_PADRAO,
  RECOMENDACAO_EXAME,
  RECOMENDACAO_DEFAULT,
};
