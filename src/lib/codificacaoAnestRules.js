/**
 * Regras de cálculo da codificação anestésica Unimed — config auditável e editável.
 *
 * Percentuais de procedimentos múltiplos: a partir das Instruções Gerais v2026.03 (itens
 * 2.1.17/2.1.21 p/ cirurgia e 4.6 p/ anestesia) os redutores PASSARAM A CONSTAR do referencial:
 * por ordem decrescente de valor → 100% / 50% (mesma via) ou 70% (outra via) / 40% / 30% / 10%.
 * (Versões anteriores diziam que não constavam.) Ainda são premissas de conferência expostas na
 * UI; a auditoria da Unimed Executora prevalece.
 */

/**
 * Multiplicadores de UTM por tabela de honorário.
 * Os valores armazenados na tabela usam intercâmbio (1,17); a UI exibe sempre LOCAL (1,75,
 * Unimed Chapecó com subsídio) = stored × (1,75/1,17). A UTM local subiu de 1,73 → 1,75 na
 * Lista Referencial de Honorários Clínicos e Cirúrgicos v.09 (01/04/2026).
 */
export const MULTIPLICADORES = Object.freeze({
  intercambio: 1.17, // Base Sistema Unimed (sem subsídio) — base dos valores armazenados
  local: 1.75, // Unimed Chapecó (com subsídio, v.09) — sempre usado na exibição
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

/**
 * Cascata oficial de percentuais por ordem decrescente de valor (v2026.03, itens 2.1.21/4.6):
 * 1º=100%, 2º=50%, 3º=40%, 4º=30%, 5º+=10%. O 2º pode ir a 70% se for OUTRA via de acesso
 * (ajuste manual no badge — a UI não infere a via). Usado por sugerirPercentuais().
 */
export const CASCATA_PERCENTUAL = [100, 50, 40, 30, 10];

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
  // endoscopia INTERVENCIONISTA (ato terapêutico) → 31602240 (porte maior). Tem de vir ANTES
  // da diagnóstica: palavra de intervenção presente vence.
  { rx: /polipectomi|mucosectomi|\bcpre\b|colangiopancreat|dilata[çc][ãa]o|ligadura|escleros|esclerot|gastrostomi|\bpeg\b|pr[óo]tese|\bstent|cauteriza|abla[çc]|hemostasia|\bclipe|dissec[çc]|ressec[çc].*endosc|endosc.*(terap|interven|cir[úu]rg)/i, codigo: '31602240' },
  // endoscopia/colono/etc DIAGNÓSTICA (default, porte menor) → 31602231. Evita super-codificar
  // como intervencionista (over-coding / risco de glosa). Ver docs/revisao-codificacao-anestesica-relatorio.md.
  { rx: /endoscopi|colonoscopi|broncoscopi|laringoscopi|histeroscopi|cistoscopi|esofagogastro|retossigmoid|anuscopi|ecoendoscopi/i, codigo: '31602231' },
  { rx: /ultrassonografi|ultrassom|\bus\b|doppler|ecograf/i, codigo: '31602266' },
];

// Os códigos default (31602312/304/355/347) agora vivem na hierarquia oficial 4.3, aplicada
// diretamente em recomendarCodigo() com base nas listas de codificacaoAnestProtocolo.js.

export default {
  MULTIPLICADORES,
  OPCOES_PERCENTUAL,
  ACOMODACOES,
  ACOMODACAO_PADRAO,
  CASCATA_PERCENTUAL,
  REGRAS_PADRAO,
  RECOMENDACAO_EXAME,
};
