/**
 * Regras de cálculo da codificação anestésica Unimed — config auditável e editável.
 *
 * ⚠️ Auditoria: os percentuais redutores NÃO constam da tabela referencial (NOTA oficial:
 * "Regras de excludência... bem como percentuais redutores ou adicionais não estão previstos
 * nesta tabela"). Os defaults abaixo seguem a praxe CBHPM/Unimed e a instrução 7 do Protocolo
 * Nacional; são premissas de conferência, expostas na UI e na justificativa, não substituem a
 * auditoria da Unimed Executora.
 */

/** Multiplicadores de UTM por tabela de honorário. */
export const MULTIPLICADORES = {
  intercambio: 1.17, // Base Sistema Unimed (sem subsídio) — valores armazenados usam este
  local: 1.73, // Unimed Chapecó (com subsídio)
};

/**
 * Ladder de percentualização para procedimentos múltiplos na MESMA via de acesso.
 * Maior valor 100%, 2º 70%, 3º em diante 50%. O último item se repete para ranks além do array.
 */
export const PERCENTUAL_CIRURGICO = [1.0, 0.7, 0.5];

/** Ladder de percentualização anestésica (Protocolo instr. 7) no modo 'percentualizado'. */
export const PERCENTUAL_ANESTESICO = [1.0, 0.7, 0.5];

/**
 * Modo de cálculo da anestesia em codificação múltipla:
 * - 'percentualizado': maior indicador 100%, demais pela ladder (instr. 7 literal).
 * - 'somente_maior': só o maior indicador é pago (100%); os demais zeram (praxe de ato único).
 */
export const MODOS_ANESTESIA = ['percentualizado', 'somente_maior'];

/** Default editável na UI. */
export const REGRAS_PADRAO = {
  tabela: 'intercambio',
  modoAnestesia: 'percentualizado',
  percentualCirurgico: PERCENTUAL_CIRURGICO,
  percentualAnestesico: PERCENTUAL_ANESTESICO,
  multiplicadores: MULTIPLICADORES,
};

/**
 * Mapa palavra-chave da descrição → código "Anestesia para exame específico" mais adequado,
 * quando o código colado não paga anestesia mas é um exame/procedimento diagnóstico.
 * Ordem importa (primeiro match vence).
 */
export const RECOMENDACAO_EXAME = [
  { rx: /resson[âa]ncia|\brm\b/i, codigo: '31602282' },
  { rx: /tomografia|\btc\b/i, codigo: '31602274' },
  { rx: /endoscopi|colonoscopi|cpre|broncoscopi/i, codigo: '31602240' },
  { rx: /angiografia|angiorradio|cateterismo|arteriografia/i, codigo: '31602258' },
  { rx: /ultrassonografi|ultrassom|doppler|ecograf/i, codigo: '31602266' },
  { rx: /radioterapi/i, codigo: '31602290' },
  { rx: /medicina nuclear|cintilograf|pet[- ]?ct/i, codigo: '31602320' },
];

/** Códigos default quando não há mapeamento específico de exame. */
export const RECOMENDACAO_DEFAULT = {
  imperativoClinico: '31602355', // indicação do paciente
  semPorte: '31602347', // ato sem porte previsto
};

export default {
  MULTIPLICADORES,
  PERCENTUAL_CIRURGICO,
  PERCENTUAL_ANESTESICO,
  MODOS_ANESTESIA,
  REGRAS_PADRAO,
  RECOMENDACAO_EXAME,
  RECOMENDACAO_DEFAULT,
};
