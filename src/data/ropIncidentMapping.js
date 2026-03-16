/**
 * Mapeamento Tipo-de-Incidente → ROPs — Sistema ANEST
 *
 * Associa cada tipo de incidente às ROPs (Práticas Organizacionais
 * Obrigatórias) mais relevantes para análise e vinculação.
 */

import ropsData from '@/data/rops-data';

function getRopsData() {
  return ropsData || {};
}

// Mapeamento: tipo de incidente → áreas e ROPs relevantes
const INCIDENT_TO_ROP_MAPPING = {
  medicacao: {
    areas: [
      {
        area: 'uso-medicamentos',
        rops: ['rop-3-1', 'rop-3-2', 'rop-3-3', 'rop-3-4', 'rop-3-5'],
      },
    ],
  },
  cirurgia: {
    areas: [
      {
        area: 'avaliacao-riscos',
        rops: ['rop-6-1', 'rop-6-2'],
      },
      {
        area: 'comunicacao',
        rops: ['rop-2-7'],
      },
    ],
  },
  identificacao: {
    areas: [
      {
        area: 'comunicacao',
        rops: ['rop-2-1'],
      },
    ],
  },
  via_aerea: {
    areas: [
      {
        area: 'avaliacao-riscos',
        rops: ['rop-6-1', 'rop-6-3'],
      },
    ],
  },
  cardiovascular: {
    areas: [
      {
        area: 'avaliacao-riscos',
        rops: ['rop-6-1', 'rop-6-3'],
      },
    ],
  },
  equipamento: {
    areas: [
      {
        area: 'avaliacao-riscos',
        rops: ['rop-6-1'],
      },
    ],
  },
  queda: {
    areas: [
      {
        area: 'avaliacao-riscos',
        rops: ['rop-6-1', 'rop-6-2'],
      },
    ],
  },
  outros: {
    areas: [
      {
        area: 'cultura-seguranca',
        rops: ['rop-1-1', 'rop-1-2'],
      },
    ],
  },
};

// Mapeamento: tipo de denúncia → áreas e ROPs relevantes
const DENUNCIA_TO_ROP_MAPPING = {
  seguranca_paciente: {
    areas: [
      { area: 'cultura-seguranca', rops: ['rop-1-1', 'rop-1-2', 'rop-1-3'] },
      { area: 'prevencao-infeccoes', rops: ['rop-5-1', 'rop-5-3'] },
    ],
  },
  negligencia: {
    areas: [
      { area: 'cultura-seguranca', rops: ['rop-1-1', 'rop-1-2'] },
      { area: 'vida-profissional', rops: ['rop-4-1', 'rop-4-4'] },
    ],
  },
  assedio_moral: {
    areas: [
      { area: 'vida-profissional', rops: ['rop-4-3', 'rop-4-5'] },
    ],
  },
  assedio_sexual: {
    areas: [
      { area: 'vida-profissional', rops: ['rop-4-3', 'rop-4-5'] },
    ],
  },
  discriminacao: {
    areas: [
      { area: 'vida-profissional', rops: ['rop-4-3', 'rop-4-5'] },
    ],
  },
  violacao_politica: {
    areas: [
      { area: 'cultura-seguranca', rops: ['rop-1-1'] },
    ],
  },
  etica: {
    areas: [
      { area: 'cultura-seguranca', rops: ['rop-1-1', 'rop-1-4'] },
    ],
  },
  fraude: {
    areas: [
      { area: 'cultura-seguranca', rops: ['rop-1-1'] },
    ],
  },
  conflito_interesse: {
    areas: [
      { area: 'cultura-seguranca', rops: ['rop-1-1'] },
      { area: 'vida-profissional', rops: ['rop-4-4'] },
    ],
  },
  outro: {
    areas: [
      { area: 'cultura-seguranca', rops: ['rop-1-1', 'rop-1-2'] },
    ],
  },
};

// Cores por área macro (para chips visuais)
const AREA_COLORS = {
  'cultura-seguranca': '#9C27B0',
  'comunicacao': '#10B981',
  'uso-medicamentos': '#2196F3',
  'vida-profissional': '#4CAF50',
  'prevencao-infeccoes': '#FF9800',
  'avaliacao-riscos': '#00BCD4',
};

/**
 * Retorna ROPs sugeridas para o tipo de incidente ou denúncia fornecido
 */
export function getSuggestedRops(incidentType, isDenuncia = false) {
  const data = getRopsData();
  const mappingSource = isDenuncia ? DENUNCIA_TO_ROP_MAPPING : INCIDENT_TO_ROP_MAPPING;
  const mapping = mappingSource[incidentType];
  if (!mapping) return [];

  const result = [];

  for (const { area, rops } of mapping.areas) {
    const areaData = data[area];
    if (!areaData) continue;

    for (const ropId of rops) {
      const ropData = areaData.subdivisoes?.[ropId];
      if (!ropData) continue;

      result.push({
        ropId,
        ropArea: area,
        areaTitle: areaData.title,
        ropTitle: ropData.title,
        areaColor: AREA_COLORS[area] || '#6B7280',
        autoSugerido: true,
      });
    }
  }

  return result;
}

/**
 * Retorna lista flat de todos os 32 ROPs para seleção manual
 */
export function getAllRops() {
  const data = getRopsData();
  const result = [];

  for (const [areaKey, areaData] of Object.entries(data)) {
    if (!areaData.subdivisoes) continue;

    for (const [ropId, ropData] of Object.entries(areaData.subdivisoes)) {
      result.push({
        ropId,
        ropArea: areaKey,
        areaTitle: areaData.title,
        ropTitle: ropData.title,
        areaColor: AREA_COLORS[areaKey] || '#6B7280',
        autoSugerido: false,
      });
    }
  }

  return result;
}

export { INCIDENT_TO_ROP_MAPPING, DENUNCIA_TO_ROP_MAPPING, AREA_COLORS };
