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
 * Percentual padrão de CADA procedimento da guia = 100% (modelo Volan).
 *
 * ⚠️ Auditoria: o referencial Unimed declara que "percentuais redutores ou adicionais NÃO estão
 * previstos nesta tabela"; o Protocolo só define pertinência qualitativa (principal=100%,
 * via de acesso/parte integrante=0%, S/N condicional). Não há ladder numérico oficial. Por isso,
 * como no Volan, cada procedimento entra a 100% e o faturista ajusta o percentual por linha
 * conforme a regra do auditor/protocolo. A sugestão abaixo é apenas conveniência não-oficial.
 */
export const PERCENTUAL_PADRAO = 100;

/**
 * Sugestão (NÃO-oficial) de redutor para procedimentos subsequentes na mesma via, prática comum
 * CBHPM: maior valor 100%, demais 50%. Aplicada só quando o usuário pede ("sugerir redutor").
 */
export const SUGESTAO_REDUTOR = [100, 50];

/** Default editável na UI. */
export const REGRAS_PADRAO = {
  tabela: 'intercambio',
  percentualPadrao: PERCENTUAL_PADRAO,
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
  PERCENTUAL_PADRAO,
  SUGESTAO_REDUTOR,
  REGRAS_PADRAO,
  RECOMENDACAO_EXAME,
  RECOMENDACAO_DEFAULT,
};
