/**
 * Tabela CBHPM 2020 - Portes Anestésicos
 * Valores de referência para cálculo de honorários de anestesiologia
 */

// Portes Anestésicos CBHPM 2020 com valores em reais
export const PORTES_ANESTESICOS = {
  '0': { codigo: '0', descricao: 'Sem Porte', valor: 0 },
  '1A': { codigo: '1A', descricao: 'Porte 1A', valor: 77.64 },
  '1B': { codigo: '1B', descricao: 'Porte 1B', valor: 93.16 },
  '1C': { codigo: '1C', descricao: 'Porte 1C', valor: 116.46 },
  '2A': { codigo: '2A', descricao: 'Porte 2A', valor: 139.75 },
  '2B': { codigo: '2B', descricao: 'Porte 2B', valor: 174.69 },
  '2C': { codigo: '2C', descricao: 'Porte 2C', valor: 209.63 },
  '3A': { codigo: '3A', descricao: 'Porte 3A', valor: 232.91 },
  '3B': { codigo: '3B', descricao: 'Porte 3B', valor: 291.14 },
  '3C': { codigo: '3C', descricao: 'Porte 3C', valor: 357.21 },
  '4A': { codigo: '4A', descricao: 'Porte 4A', valor: 406.59 },
  '4B': { codigo: '4B', descricao: 'Porte 4B', valor: 465.82 },
  '4C': { codigo: '4C', descricao: 'Porte 4C', valor: 542.98 },
  '5A': { codigo: '5A', descricao: 'Porte 5A', valor: 582.28 },
  '5B': { codigo: '5B', descricao: 'Porte 5B', valor: 660.59 },
  '5C': { codigo: '5C', descricao: 'Porte 5C', valor: 755.61 },
  '6A': { codigo: '6A', descricao: 'Porte 6A', valor: 777.22 },
  '6B': { codigo: '6B', descricao: 'Porte 6B', valor: 835.24 },
  '6C': { codigo: '6C', descricao: 'Porte 6C', valor: 950.04 },
  '7A': { codigo: '7A', descricao: 'Porte 7A', valor: 1019.26 },
  '7B': { codigo: '7B', descricao: 'Porte 7B', valor: 1097.57 },
  '7C': { codigo: '7C', descricao: 'Porte 7C', valor: 1201.31 },
  '8A': { codigo: '8A', descricao: 'Porte 8A', valor: 1311.00 },
  '8B': { codigo: '8B', descricao: 'Porte 8B', valor: 1408.31 },
  '8C': { codigo: '8C', descricao: 'Porte 8C', valor: 1545.62 },
  '9A': { codigo: '9A', descricao: 'Porte 9A', valor: 1525.23 },
  '9B': { codigo: '9B', descricao: 'Porte 9B', valor: 1625.86 },
  '9C': { codigo: '9C', descricao: 'Porte 9C', valor: 1800.00 },
  '10A': { codigo: '10A', descricao: 'Porte 10A', valor: 1875.00 },
  '10B': { codigo: '10B', descricao: 'Porte 10B', valor: 2000.00 },
  '10C': { codigo: '10C', descricao: 'Porte 10C', valor: 2159.86 },
  '11A': { codigo: '11A', descricao: 'Porte 11A', valor: 2300.00 },
  '11B': { codigo: '11B', descricao: 'Porte 11B', valor: 2475.00 },
  '11C': { codigo: '11C', descricao: 'Porte 11C', valor: 2650.00 },
  '12A': { codigo: '12A', descricao: 'Porte 12A', valor: 2725.00 },
  '12B': { codigo: '12B', descricao: 'Porte 12B', valor: 2900.00 },
  '12C': { codigo: '12C', descricao: 'Porte 12C', valor: 3100.00 },
};

// Lista ordenada de portes para select/dropdown
export const PORTES_LIST = Object.values(PORTES_ANESTESICOS).sort((a, b) => {
  const numA = parseInt(a.codigo.replace(/[^\d]/g, '')) || 0;
  const numB = parseInt(b.codigo.replace(/[^\d]/g, '')) || 0;
  if (numA !== numB) return numA - numB;
  return a.codigo.localeCompare(b.codigo);
});

// Tipos de evento de faturamento
export const TIPOS_EVENTO = {
  HONORARIO: { codigo: 'honorario', descricao: 'Honorário Médico', icon: 'Stethoscope' },
  CONSULTA: { codigo: 'consulta', descricao: 'Consulta', icon: 'UserCheck' },
  SPSADT: { codigo: 'spsadt', descricao: 'SP-SADT', icon: 'FileText' },
};

// Status dos eventos no workflow
export const STATUS_EVENTO = {
  RASCUNHO: { codigo: 'rascunho', descricao: 'Rascunho', cor: '#6B7280', ordem: 1 },
  PENDENTE: { codigo: 'pendente', descricao: 'Pendente', cor: '#F59E0B', ordem: 2 },
  APROVADO: { codigo: 'aprovado', descricao: 'Aprovado', cor: '#004225', ordem: 3 },
  FATURADO: { codigo: 'faturado', descricao: 'Faturado', cor: '#2E8B57', ordem: 4 },
  PAGO: { codigo: 'pago', descricao: 'Pago', cor: '#34C759', ordem: 5 },
  GLOSADO: { codigo: 'glosado', descricao: 'Glosado', cor: '#DC2626', ordem: 6 },
};

// Status das notas fiscais
export const STATUS_NOTA = {
  EMITIDA: { codigo: 'emitida', descricao: 'Emitida', cor: '#6B7280' },
  ENVIADA: { codigo: 'enviada', descricao: 'Enviada', cor: '#F59E0B' },
  PAGA: { codigo: 'paga', descricao: 'Paga', cor: '#34C759' },
  GLOSADA: { codigo: 'glosada', descricao: 'Com Glosa', cor: '#DC2626' },
};

// Status dos lotes
export const STATUS_LOTE = {
  ABERTO: { codigo: 'aberto', descricao: 'Aberto', cor: '#6B7280' },
  FECHADO: { codigo: 'fechado', descricao: 'Fechado', cor: '#F59E0B' },
  ENVIADO: { codigo: 'enviado', descricao: 'Enviado', cor: '#2E8B57' },
  PROCESSADO: { codigo: 'processado', descricao: 'Processado', cor: '#34C759' },
};

// Status dos recursos (glosas)
export const STATUS_RECURSO = {
  ABERTO: { codigo: 'aberto', descricao: 'Aberto', cor: '#F59E0B' },
  ENVIADO: { codigo: 'enviado', descricao: 'Enviado', cor: '#2E8B57' },
  DEFERIDO: { codigo: 'deferido', descricao: 'Deferido', cor: '#34C759' },
  INDEFERIDO: { codigo: 'indeferido', descricao: 'Indeferido', cor: '#DC2626' },
};

// Procedimentos mais comuns com seus portes
export const PROCEDIMENTOS_COMUNS = [
  { codigo: '31201015', descricao: 'Anestesia geral ou condutiva para procedimentos ambulatoriais', porte: '3A' },
  { codigo: '31201023', descricao: 'Anestesia geral ou condutiva para procedimentos de pequeno porte', porte: '3C' },
  { codigo: '31201031', descricao: 'Anestesia geral ou condutiva para procedimentos de médio porte', porte: '4C' },
  { codigo: '31201040', descricao: 'Anestesia geral ou condutiva para procedimentos de grande porte', porte: '6B' },
  { codigo: '31201058', descricao: 'Anestesia para cirurgia cardíaca com CEC', porte: '10C' },
  { codigo: '31201066', descricao: 'Anestesia para neurocirurgia intracraniana', porte: '9B' },
  { codigo: '31201074', descricao: 'Anestesia para transplantes', porte: '12A' },
  { codigo: '31201082', descricao: 'Sedação para procedimentos diagnósticos', porte: '2A' },
  { codigo: '31201090', descricao: 'Bloqueio de plexo braquial', porte: '4A' },
  { codigo: '31201104', descricao: 'Bloqueio peridural', porte: '4B' },
  { codigo: '31201112', descricao: 'Raquianestesia', porte: '4A' },
  { codigo: '31201120', descricao: 'Anestesia para cesárea', porte: '5A' },
  { codigo: '31201139', descricao: 'Anestesia para parto normal', porte: '4C' },
  { codigo: '31201147', descricao: 'Anestesia para videolaparoscopia', porte: '5B' },
  { codigo: '31201155', descricao: 'Anestesia para cirurgia ortopédica de grande porte', porte: '7C' },
];

// Funções auxiliares

/**
 * Obtém o valor do porte pelo código
 * @param {string} codigoPorte - Código do porte (ex: '3A', '6B')
 * @returns {number} - Valor em reais
 */
export function getValorPorte(codigoPorte) {
  const porte = PORTES_ANESTESICOS[codigoPorte];
  return porte ? porte.valor : 0;
}

/**
 * Calcula o valor do evento baseado no porte e negociação do convênio
 * @param {string} codigoPorte - Código do porte
 * @param {Object} convenio - Objeto do convênio com possíveis valores customizados
 * @returns {number} - Valor calculado
 */
export function calcularValorEvento(codigoPorte, convenio = null) {
  // Se o convênio tem valor customizado para este porte, usar
  if (convenio?.customPortes?.[codigoPorte]) {
    return convenio.customPortes[codigoPorte];
  }

  // Se o convênio tem multiplicador, aplicar
  if (convenio?.multiplicador) {
    return getValorPorte(codigoPorte) * convenio.multiplicador;
  }

  // Retornar valor padrão CBHPM
  return getValorPorte(codigoPorte);
}

/**
 * Formata valor em reais
 * @param {number} valor - Valor numérico
 * @returns {string} - Valor formatado (ex: "R$ 1.234,56")
 */
export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

/**
 * Obtém a cor do status
 * @param {string} status - Código do status
 * @param {string} tipo - Tipo (evento, nota, lote, recurso)
 * @returns {string} - Cor hexadecimal
 */
export function getCorStatus(status, tipo = 'evento') {
  const statusMaps = {
    evento: STATUS_EVENTO,
    nota: STATUS_NOTA,
    lote: STATUS_LOTE,
    recurso: STATUS_RECURSO,
  };

  const statusMap = statusMaps[tipo] || STATUS_EVENTO;
  const statusObj = Object.values(statusMap).find(s => s.codigo === status);
  return statusObj?.cor || '#6B7280';
}

export default {
  PORTES_ANESTESICOS,
  PORTES_LIST,
  TIPOS_EVENTO,
  STATUS_EVENTO,
  STATUS_NOTA,
  STATUS_LOTE,
  STATUS_RECURSO,
  PROCEDIMENTOS_COMUNS,
  getValorPorte,
  calcularValorEvento,
  formatarMoeda,
  getCorStatus,
};
