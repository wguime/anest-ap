/**
 * Doses Data - ANEST Design System
 *
 * Doses de medicamentos para adultos e pediatricos
 * Migrado do app legado + novas drogas
 */

// =============================================================================
// CATEGORIAS DE MEDICAMENTOS
// =============================================================================

export const DRUG_CATEGORIES = {
  inducao: { label: 'Inducao', icon: 'Play', color: '#8B5CF6' },
  manutencao: { label: 'Manutencao', icon: 'Activity', color: '#3B82F6' },
  opioides: { label: 'Opioides', icon: 'Pill', color: '#EF4444' },
  bnm: { label: 'BNM', icon: 'Zap', color: '#F59E0B' },
  reversores: { label: 'Reversores', icon: 'RotateCcw', color: '#10B981' },
  vasopressores: { label: 'Vasopressores', icon: 'TrendingUp', color: '#EC4899' },
  antiemeticos: { label: 'Antiemeticos', icon: 'Ban', color: '#14B8A6' },
  analgesicos: { label: 'Analgesicos', icon: 'Thermometer', color: '#6366F1' },
  outros: { label: 'Outros', icon: 'MoreHorizontal', color: '#6B7280' },
};

export const PEDIATRIC_CATEGORIES = {
  pcr: { label: 'PCR Pediatrica', icon: 'HeartPulse', color: '#EF4444' },
  sedacao: { label: 'Sedacao/Analgesia', icon: 'Moon', color: '#8B5CF6' },
  anticonvulsivantes: { label: 'Anticonvulsivantes', icon: 'Brain', color: '#F59E0B' },
  antidotos: { label: 'Antidotos', icon: 'Shield', color: '#10B981' },
};

// =============================================================================
// DOSES ADULTOS
// =============================================================================

export const adultDoses = [
  // INDUCAO
  {
    id: 'propofol',
    drug: 'Propofol',
    category: 'inducao',
    dose: '1.5-2.5 mg/kg',
    infusion: '50-200 mcg/kg/min',
    notes: 'Reduzir em idosos (1-1.5 mg/kg)',
    alerts: 'Hipotensao dose-dependente. Reduzir em choque.',
  },
  {
    id: 'etomidato',
    drug: 'Etomidato',
    category: 'inducao',
    dose: '0.2-0.3 mg/kg',
    notes: 'Estabilidade hemodinamica. Evitar infusao continua.',
    alerts: 'Supressao adrenal. Mioclonias.',
  },
  {
    id: 'cetamina',
    drug: 'Cetamina',
    category: 'inducao',
    dose: '1-2 mg/kg IV',
    analgesia: '0.2-0.5 mg/kg',
    notes: 'Mantem drive respiratorio. Analgesia: 10-20mg bolus.',
    alerts: 'Evitar em HIC, IAM recente.',
  },
  {
    id: 'midazolam_ind',
    drug: 'Midazolam',
    category: 'inducao',
    dose: '0.05-0.1 mg/kg (inducao)',
    sedation: '1-2 mg (sedacao)',
    notes: 'Reversivel com flumazenil.',
    alerts: 'Depressao respiratoria.',
  },

  // OPIOIDES
  {
    id: 'fentanil',
    drug: 'Fentanil',
    category: 'opioides',
    dose: '1-5 mcg/kg (bolus)',
    infusion: '0.5-5 mcg/kg/h',
    notes: 'Onset: 1-2 min. Duracao: 30-60 min.',
    alerts: 'Rigidez toracica em altas doses.',
  },
  {
    id: 'remifentanil',
    drug: 'Remifentanil',
    category: 'opioides',
    dose: '0.5-1 mcg/kg (bolus)',
    infusion: '0.1-0.5 mcg/kg/min',
    notes: 'Onset: 1 min. Metabolismo por esterases.',
    alerts: 'Hiperalgesia pos-op.',
  },
  {
    id: 'morfina',
    drug: 'Morfina',
    category: 'opioides',
    dose: '0.05-0.2 mg/kg IV',
    bolus: '5-10 mg',
    notes: 'Onset: 5-10 min. Duracao: 3-4h.',
    alerts: 'Metabolito ativo. Ajustar em IRC.',
  },

  // BNM
  {
    id: 'rocuronio',
    drug: 'Rocuronio',
    category: 'bnm',
    dose: '0.6-1.2 mg/kg (intubacao)',
    maintenance: '0.1-0.15 mg/kg',
    infusion: '5-12 mcg/kg/min',
    notes: 'Onset: 60-90s. Duracao: 30-45min.',
    alerts: 'Reversivel com Sugammadex.',
  },
  {
    id: 'succinilcolina',
    drug: 'Succinilcolina',
    category: 'bnm',
    dose: '1-1.5 mg/kg',
    notes: 'Despolarizante. Onset: 45-60s.',
    alerts: 'CI: hiperK+, distrofias, queimaduras >48h, HM.',
  },
  {
    id: 'cisatracurio',
    drug: 'Cisatracurio',
    category: 'bnm',
    dose: '0.15-0.2 mg/kg (intubacao)',
    maintenance: '0.03 mg/kg',
    notes: 'Hofmann. Seguro em IRC/IH.',
    alerts: 'Gold standard disfuncao organica.',
  },

  // REVERSORES
  {
    id: 'sugammadex',
    drug: 'Sugammadex',
    category: 'reversores',
    dose: '2-4 mg/kg (moderado)',
    emergency: '16 mg/kg (imediato)',
    notes: 'Reverte rocuronio/vecuronio.',
    alerts: 'Nao reverte outros BNM.',
  },
  {
    id: 'neostigmina',
    drug: 'Neostigmina',
    category: 'reversores',
    dose: '0.04-0.07 mg/kg + Atropina 0.01-0.02 mg/kg',
    notes: 'Max 5mg. Aguardar TOF > 0.2.',
    alerts: 'Efeitos muscarinicos. Bradicardia.',
  },
  {
    id: 'flumazenil',
    drug: 'Flumazenil',
    category: 'reversores',
    dose: '0.1-0.2 mg IV',
    max: '1 mg',
    notes: 'Reverte benzodiazepinicos. t1/2 curto.',
    alerts: 'Convulsoes em uso cronico BZD.',
  },
  {
    id: 'naloxona',
    drug: 'Naloxona',
    category: 'reversores',
    dose: '0.04-0.4 mg IV',
    max: '2 mg',
    notes: 'Reverte opioides. Titular.',
    alerts: 'Sindrome abstinencia. Dor subita.',
  },

  // VASOPRESSORES
  {
    id: 'efedrina',
    drug: 'Efedrina',
    category: 'vasopressores',
    dose: '5-10 mg IV bolus',
    max: '50 mg',
    notes: 'Agonista misto. Util em raquianestesia.',
    alerts: 'Taquifilaxia.',
  },
  {
    id: 'fenilefrina',
    drug: 'Fenilefrina',
    category: 'vasopressores',
    dose: '50-100 mcg IV bolus',
    infusion: '0.5-3 mcg/kg/min',
    notes: 'Agonista alfa1 puro. Aumenta RVS.',
    alerts: 'Bradicardia reflexa.',
  },
  {
    id: 'noradrenalina',
    drug: 'Noradrenalina',
    category: 'vasopressores',
    infusion: '0.05-0.5 mcg/kg/min',
    notes: 'Primeira linha em choque septico.',
    alerts: 'Acesso central preferivel.',
  },
  {
    id: 'adrenalina',
    drug: 'Adrenalina',
    category: 'vasopressores',
    infusion: '0.01-0.05 mcg/kg/min (beta) | >0.1 mcg/kg/min (alfa)',
    pcr: '1 mg IV q3-5min',
    anafilaxia: '0.3-0.5 mg IM',
    notes: 'PCR: 1mg IV q3-5min. Anafilaxia: IM.',
    alerts: 'Arritmias, isquemia.',
  },

  // ANTIEMETICOS
  {
    id: 'ondansetrona',
    drug: 'Ondansetrona',
    category: 'antiemeticos',
    dose: '4-8 mg IV',
    notes: 'Antagonista 5-HT3. Profilaxia: 4mg.',
    alerts: 'Prolongamento QT.',
  },
  {
    id: 'dexametasona',
    drug: 'Dexametasona',
    category: 'antiemeticos',
    dose: '4-8 mg IV',
    notes: 'Dar na inducao. Efeito 2-3h.',
    alerts: 'Tambem analgesico.',
  },

  // ANALGESICOS
  {
    id: 'dipirona',
    drug: 'Dipirona',
    category: 'analgesicos',
    dose: '15-30 mg/kg IV (max 2g)',
    interval: '6/6h',
    notes: 'Excelente analgesico.',
    alerts: 'Hipotensao se rapido.',
  },
  {
    id: 'paracetamol',
    drug: 'Paracetamol',
    category: 'analgesicos',
    dose: '15 mg/kg IV (max 1g)',
    interval: '6/6h',
    max: '4g/dia',
    notes: 'Seguro. Sinergico com AINEs.',
    alerts: 'Hepatotoxico em overdose.',
  },

  // OUTROS
  {
    id: 'lidocaina_iv',
    drug: 'Lidocaina IV',
    category: 'outros',
    dose: '1.5 mg/kg bolus',
    infusion: '1-2 mg/kg/h',
    notes: 'Analgesia, anti-inflamatorio.',
    alerts: 'Toxicidade SNC > 5 mcg/mL.',
  },
  {
    id: 'dexmedetomidina',
    drug: 'Dexmedetomidina',
    category: 'outros',
    infusion: '0.2-0.7 mcg/kg/h',
    bolus: '0.5-1 mcg/kg em 10min',
    notes: 'Sedacao consciente. Reduz opioides.',
    alerts: 'Bradicardia, hipotensao.',
  },
];

// =============================================================================
// DOSES PEDIATRICAS
// =============================================================================

export const pediatricDoses = [
  // PCR PEDIATRICA
  {
    id: 'adrenalina_ped',
    drug: 'Adrenalina',
    category: 'pcr',
    presentation: '1 mg/mL',
    dose: 0.01,
    unit: 'mg/kg',
    dilution: '1mL + 9mL AD (0.1 mg/mL)',
    notes: 'Dose de emergencia IV/IO',
  },
  {
    id: 'atropina_ped',
    drug: 'Atropina',
    category: 'pcr',
    presentation: '0.25 mg/mL',
    dose: 0.02,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    minDose: 0.1,
    maxDose: 0.5,
    notes: 'Dose min: 0.1mg | max: 0.5mg',
  },
  {
    id: 'bicarbonato_ped',
    drug: 'Bicarbonato Na 8.4%',
    category: 'pcr',
    presentation: '1 mEq/mL',
    dose: 1,
    unit: 'mEq/kg',
    dilution: '20mL + 20mL AD (0.5 mEq/mL)',
    notes: 'Diluir 50%',
  },
  {
    id: 'adenosina_ped',
    drug: 'Adenosina',
    category: 'pcr',
    presentation: '3 mg/mL',
    dose: 0.1,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    maxDose: 0.3,
    notes: '0.1 mg/kg inicial, max 0.3 mg/kg',
  },
  {
    id: 'glicose_ped',
    drug: 'Glicose 10%',
    category: 'pcr',
    presentation: '100 mg/mL',
    dose: 500,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    notes: 'Hipoglicemia',
  },

  // SEDACAO/ANALGESIA
  {
    id: 'fentanil_ped',
    drug: 'Fentanil',
    category: 'sedacao',
    presentation: '50 mcg/mL',
    dose: 2,
    unit: 'mcg/kg',
    dilution: 'Sem diluir',
    notes: 'Analgesia: 1-3 mcg/kg',
  },
  {
    id: 'midazolam_ped',
    drug: 'Midazolam',
    category: 'sedacao',
    presentation: '5 mg/mL',
    dose: 0.2,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    maxDose: 5,
    notes: 'Sedacao: 0.05-0.3 mg/kg',
  },
  {
    id: 'cetamina_ped',
    drug: 'Cetamina',
    category: 'sedacao',
    presentation: '50 mg/mL',
    dose: 1,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    notes: 'IV: 1-2 mg/kg | IM: 4-5 mg/kg',
  },
  {
    id: 'morfina_ped',
    drug: 'Morfina',
    category: 'sedacao',
    presentation: '10 mg/mL',
    dose: 0.1,
    unit: 'mg/kg',
    dilution: '1mL + 9mL AD (1 mg/mL)',
    notes: 'Analgesia: 0.05-0.1 mg/kg',
  },
  {
    id: 'propofol_ped',
    drug: 'Propofol',
    category: 'sedacao',
    presentation: '10 mg/mL',
    dose: 2,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    notes: 'Inducao: 2-3 mg/kg | Sedacao: 1-2 mg/kg',
  },
  {
    id: 'rocuronio_ped',
    drug: 'Rocuronio',
    category: 'sedacao',
    presentation: '10 mg/mL',
    dose: 0.6,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    notes: 'Intubacao: 0.6-1.2 mg/kg',
  },
  {
    id: 'succinilcolina_ped',
    drug: 'Succinilcolina',
    category: 'sedacao',
    presentation: '100 mg/frasco',
    dose: 1,
    unit: 'mg/kg',
    dilution: '1 frasco + 5mL AD (20 mg/mL)',
    notes: 'Bloqueio neuromuscular rapido',
  },

  // ANTICONVULSIVANTES
  {
    id: 'fenobarbital_ped',
    drug: 'Fenobarbital',
    category: 'anticonvulsivantes',
    presentation: '100 mg/mL',
    dose: 5,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    notes: 'Dose de ataque: 15-20 mg/kg',
  },
  {
    id: 'fenitoina_ped',
    drug: 'Fenitoina',
    category: 'anticonvulsivantes',
    presentation: '50 mg/mL',
    dose: 15,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    notes: 'Infundir lentamente (max 50mg/min)',
  },

  // ANTIDOTOS
  {
    id: 'naloxone_ped',
    drug: 'Naloxone',
    category: 'antidotos',
    presentation: '0.4 mg/mL',
    dose: 0.1,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    maxDose: 2,
    notes: 'Antagonista opioide - dose inicial: 0.01-0.1 mg/kg',
  },
  {
    id: 'flumazenil_ped',
    drug: 'Flumazenil',
    category: 'antidotos',
    presentation: '0.1 mg/mL',
    dose: 0.01,
    unit: 'mg/kg',
    dilution: 'Sem diluir',
    maxDose: 0.2,
    notes: 'Antagonista benzodiazepnico',
  },
];

// =============================================================================
// FUNCOES DE CALCULO
// =============================================================================

/**
 * Calcular dose pediatrica baseada no peso
 */
export function calculatePediatricDose(drugId, weightKg) {
  const drug = pediatricDoses.find(d => d.id === drugId);
  if (!drug || !weightKg || weightKg <= 0) return null;

  let calculatedDose = drug.dose * weightKg;

  // Aplicar limites
  if (drug.minDose && calculatedDose < drug.minDose) {
    calculatedDose = drug.minDose;
  }
  if (drug.maxDose && calculatedDose > drug.maxDose) {
    calculatedDose = drug.maxDose;
  }

  // Calcular volume
  const concentration = drug.dilution === 'Sem diluir'
    ? parseFloat(drug.presentation)
    : parseFloat(drug.dilution.match(/(\d+\.?\d*)\s*(mg|mcg|mEq)\/mL/)?.[1] || drug.dose);

  const volume = calculatedDose / concentration;

  return {
    drug: drug.drug,
    dose: calculatedDose.toFixed(2),
    unit: drug.unit.replace('/kg', ''),
    volume: volume.toFixed(2),
    volumeUnit: 'mL',
    presentation: drug.presentation,
    dilution: drug.dilution,
    notes: drug.notes,
  };
}

/**
 * Obter todas as doses para um peso
 */
export function getAllPediatricDoses(weightKg, categoryFilter = null) {
  const drugs = categoryFilter
    ? pediatricDoses.filter(d => d.category === categoryFilter)
    : pediatricDoses;

  return drugs.map(drug => calculatePediatricDose(drug.id, weightKg)).filter(Boolean);
}

// =============================================================================
// AGRUPAMENTO POR CATEGORIA
// =============================================================================

export const adultDosesByCategory = Object.entries(DRUG_CATEGORIES).reduce((acc, [key]) => {
  acc[key] = adultDoses.filter(d => d.category === key);
  return acc;
}, {});

export const pediatricDosesByCategory = Object.entries(PEDIATRIC_CATEGORIES).reduce((acc, [key]) => {
  acc[key] = pediatricDoses.filter(d => d.category === key);
  return acc;
}, {});

// =============================================================================
// EXPORTACAO
// =============================================================================

export default {
  DRUG_CATEGORIES,
  PEDIATRIC_CATEGORIES,
  adultDoses,
  pediatricDoses,
  adultDosesByCategory,
  pediatricDosesByCategory,
  calculatePediatricDose,
  getAllPediatricDoses,
};
