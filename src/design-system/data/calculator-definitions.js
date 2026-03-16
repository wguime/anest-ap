/**
 * Calculator Definitions - ANEST Design System v2.0
 * 84 Calculadoras: 19 Pediátricas + 65 Adulto
 * 34 Ativas (portadas do legado) + 50 Em breve
 */

// =============================================================================
// CONSTANTES E HELPERS
// =============================================================================

export const RISK_LEVELS = {
  baixo: { label: 'Baixo Risco', level: 'baixo' },
  medio: { label: 'Risco Moderado', level: 'medio' },
  alto: { label: 'Alto Risco', level: 'alto' },
  critico: { label: 'Risco Crítico', level: 'critico' },
};

// =============================================================================
// SEÇÃO 1: PEDIATRIA - DOSES (1 calculadora)
// =============================================================================

// Dados completos das drogas pediátricas (baseado em pedicalc-complete-data.js)
// ORDEM: Urgência/Emergência primeiro, Rotina ao final
const PEDI_CALC_DATA = {
  // ===================== URGÊNCIA/EMERGÊNCIA =====================
  pcr: {
    categoria: 'PCR (Parada Cardiorrespiratória)',
    drogas: [
      { droga: 'ADRENALINA', apresentacao: '1 mg/ml', dosePadrao: 0.01, unidadeDose: 'mg/kg', diluicao: '1ml + 9ml AD', concentracaoFinal: 0.1, obs: 'A cada 3-5 min na PCR. Primeira droga em AESP/Assistolia. Após 2o choque em FV/TV.' },
      { droga: 'ATROPINA', apresentacao: '0,25 mg/ml', dosePadrao: 0.02, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 0.25, doseMinima: 0.1, doseMaxima: 0.5, warning: 'NÃO usar rotineiramente na PCR pediátrica! Indicada apenas para bradicardia vagal.', obs: 'Dose mínima 0.1mg para evitar bradicardia paradoxal.' },
      { droga: 'PUSH SF 0,9%', apresentacao: '0,15 mEq/ml', dosePadrao: 20, unidadeDose: 'ml/kg', diluicao: 'PURO', concentracaoFinal: 1, obs: 'Bolus rápido após cada droga IV/IO. Facilita chegada ao coração.' },
      { droga: 'BICA Na 8,4%', apresentacao: '1 mEq/ml', dosePadrao: 1, unidadeDose: 'mEq/kg', diluicao: '20ml + 20ml AD', concentracaoFinal: 0.5, warning: 'NÃO usar rotineiramente! Apenas em acidose grave documentada ou hipercalemia.', obs: 'Infundir lentamente. Incompatível com cálcio na mesma via.' },
      { droga: 'LIDOCAINA 2%', apresentacao: '20 mg/ml', dosePadrao: 1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 20, obs: 'Alternativa a Amiodarona em FV/TV refrataria. Pode repetir 0.5-0.75 mg/kg.' },
      { droga: 'GLUCO Ca 10%', apresentacao: '100 mg/ml', dosePadrao: 20, unidadeDose: 'mg/kg', diluicao: '10ml + 10ml AD', concentracaoFinal: 50, warning: 'Infusão lenta! Risco de bradicardia e assistolia se rápido.', obs: 'Indicado em hipocalcemia, hipercalemia, intox por bloq Ca.' },
      { droga: 'ADENOSINA', apresentacao: '3 mg/ml', dosePadrao: 0.1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 3, doseMaxima: 0.3, obs: 'Push MUITO rápido + flush imediato. Se falhar: dobrar dose (max 0.3 mg/kg ou 12mg).' },
      { droga: 'GLICOSE 10%', apresentacao: '100 mg/ml', dosePadrao: 500, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 100, obs: 'Verificar glicemia capilar. Neonatos tem alto risco de hipoglicemia na PCR.' },
    ],
  },
  anticonvulsivante: {
    categoria: 'Anticonvulsivantes',
    drogas: [
      { droga: 'FENOBARBITAL', apresentacao: '100 mg/ml', dosePadrao: 15, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 100, warning: 'Infusão lenta (max 1mg/kg/min)! Risco de apneia e hipotensão.', obs: 'Primeira linha em convulsão neonatal. Pode repetir 5-10 mg/kg.' },
      { droga: 'FENITOINA', apresentacao: '50 mg/ml', dosePadrao: 15, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 50, warning: 'Infundir em no mínimo 20 min! Risco de arritmia e hipotensão.', obs: 'Diluir em SF (precipita em SG). Monitorar ECG durante infusão.' },
    ],
  },
  antidotos: {
    categoria: 'Antídotos',
    drogas: [
      { droga: 'NALOXONE', apresentacao: '0,4 mg/ml', dosePadrao: 0.1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 0.4, doseMaxima: 2, obs: 'Titular para reverter depressão respiratória. Meia-vida curta - pode necessitar doses repetidas.' },
      { droga: 'FLUMAZENIL', apresentacao: '0,1 mg/ml', dosePadrao: 0.01, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 0.1, doseMaxima: 0.2, warning: 'CONTRAINDICADO em uso crônico de BZD ou suspeita de intox por TCA!', obs: 'Pode repetir a cada 1 min. Observar ressedação (meia-vida curta).' },
    ],
  },
  // ===================== SEDAÇÃO/ANESTESIA =====================
  sedação: {
    categoria: 'Sedação / Analgesia / Bloqueio',
    drogas: [
      { droga: 'FENTANIL', apresentacao: '50 mcg/ml', dosePadrao: 2, unidadeDose: 'mcg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 50, warning: 'Rigidez torácica em bolus rápido! Ter BNM disponível.', obs: 'Pico 3-5 min. Duração 30-60 min. Doses altas podem causar bradicardia.' },
      { droga: 'MIDAZOLAM', apresentacao: '5 mg/ml', dosePadrao: 0.2, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 5, doseMaxima: 5, obs: 'Início 2-3 min IV. Pode causar depressão respiratória em neonatos.' },
      { droga: 'DIAZEPAM', apresentacao: '10 mg/2ml', dosePadrao: 0.5, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 5, doseMaxima: 10, warning: 'NÃO diluir! Precipita em soluções.', obs: 'Meia-vida longa. Preferir Midazolam em crianças.' },
      { droga: 'MORFINA', apresentacao: '10 mg/ml', dosePadrao: 0.1, unidadeDose: 'mg/kg', diluicao: '1ml + 9ml AD', concentracaoFinal: 1, obs: 'Libera histamina - evitar em asmáticos. Início 15-20 min.' },
      { droga: 'CETAMINA', apresentacao: '50 mg/ml', dosePadrao: 1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 50, obs: 'Dissociativo. Mantém reflexos de VA e PA. Pode causar sialorreia e alucinações.' },
      { droga: 'PANCURONIO', apresentacao: '2 mg/ml', dosePadrao: 0.1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 2, warning: 'Não usar sem sedação adequada! BNM não causa inconsciência.', obs: 'Duração longa (40-60 min). Vagolítico - pode causar taquicardia.' },
      { droga: 'SUCCINILCOLINA', apresentacao: '100 mg/frasco', dosePadrao: 1, unidadeDose: 'mg/kg', diluicao: '1 frasco + 5ml AD', concentracaoFinal: 20, warning: 'CONTRAINDICADA em miopatias, queimados >24h, hipercalemia e HM!', obs: 'ISR pediátrica: 2 mg/kg. Fasciculações podem ser ausentes em lactentes.' },
      { droga: 'ROCURONIO', apresentacao: '10 mg/ml', dosePadrao: 0.6, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 10, obs: 'ISR: 1.2 mg/kg. Reversível com Sugammadex. Sem contraindicações de SCh.' },
      { droga: 'PROPOFOL', apresentacao: '10 mg/ml', dosePadrao: 2, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 10, warning: 'Dor a injeção! Pode causar hipotensão e bradicardia.', obs: 'Reduzir dose em hipovolêmicos. CONTRAINDICADO em <3 anos para sedação prolongada.' },
      { droga: 'THIOPENTAL', apresentacao: '500 mg/frasco', dosePadrao: 4, unidadeDose: 'mg/kg', diluicao: '1 frasco + 20ml AD', concentracaoFinal: 25, warning: 'Necrose se extravasamento! Verificar acesso antes.', obs: 'Anticonvulsivante. Reduzir dose em hipovolêmicos e cardiopatas.' },
    ],
  },
  // ===================== ANALGÉSICOS =====================
  analgésicos: {
    categoria: 'Analgésicos',
    drogas: [
      { droga: 'DIPIRONA', apresentacao: '500 mg/ml', dosePadrao: 15, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 500, doseMaxima: 1000, obs: 'Infundir em 15 min. Pode causar hipotensão se rápido. Intervalo mínimo 6h.' },
      { droga: 'PARACETAMOL IV', apresentacao: '10 mg/ml', dosePadrao: 15, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 10, doseMaxima: 1000, obs: 'Infundir em 15 min. Dose max diária: 75 mg/kg ou 4g.' },
      { droga: 'TRAMADOL', apresentacao: '50 mg/ml', dosePadrao: 1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 50, doseMaxima: 100, warning: 'Risco de convulsões! Evitar em epilépticos.', obs: 'Diluir em 50-100ml e infundir lentamente. Pode causar náuseas.' },
      { droga: 'NALBUFINA', apresentacao: '10 mg/ml', dosePadrao: 0.1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 10, doseMaxima: 20, obs: 'Agonista-antagonista. Teto analgésico. Pode reverter parcialmente opioides.' },
      { droga: 'CLONIDINA', apresentacao: '150 mcg/ml', dosePadrao: 1, unidadeDose: 'mcg/kg', diluicao: '1ml + 9ml AD', concentracaoFinal: 15, doseMaxima: 150, obs: 'Adjuvante. Pode causar bradicardia e hipotensão. Efeito sedativo.' },
    ],
  },
  // ===================== ANTI-INFLAMATÓRIOS =====================
  aines: {
    categoria: 'Anti-inflamatórios (AINEs)',
    drogas: [
      { droga: 'CETOPROFENO', apresentacao: '50 mg/ml', dosePadrao: 1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 50, doseMaxima: 100, warning: 'Evitar em asmáticos, nefropatas e coagulopatia!', obs: 'Diluir em 100ml SF. Infundir em 20 min. Não usar <6 meses.' },
      { droga: 'CETOROLACO', apresentacao: '30 mg/ml', dosePadrao: 0.5, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 30, doseMaxima: 30, warning: 'Uso max 5 dias! Risco de sangramento GI e renal.', obs: 'Potente analgésico. Evitar em prematuros e neonatos.' },
      { droga: 'TENOXICAM', apresentacao: '20 mg/frasco', dosePadrao: 0.4, unidadeDose: 'mg/kg', diluicao: '1 frasco + 2ml AD', concentracaoFinal: 10, doseMaxima: 20, obs: 'Meia-vida longa. Uma dose diária.' },
    ],
  },
  // ===================== CORTICÓIDES =====================
  corticoides: {
    categoria: 'Corticoides',
    drogas: [
      { droga: 'DEXAMETASONA', apresentacao: '4 mg/ml', dosePadrao: 0.15, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 4, doseMaxima: 10, obs: 'Antiemet ico: 0.15mg/kg. NVPO: dar no início da cirurgia. Laringite: 0.6mg/kg.' },
      { droga: 'HIDROCORTISONA', apresentacao: '100 mg/frasco', dosePadrao: 2, unidadeDose: 'mg/kg', diluicao: '1 frasco + 2ml AD', concentracaoFinal: 50, doseMaxima: 100, obs: 'Estresse cirúrgico: 25-50 mg/m2. Insuf adrenal: 100 mg/m2/dia.' },
      { droga: 'METILPREDNISOLONA', apresentacao: '125 mg/frasco', dosePadrao: 1, unidadeDose: 'mg/kg', diluicao: '1 frasco + 2ml AD', concentracaoFinal: 62.5, doseMaxima: 125, obs: 'Anafilaxia: 1-2 mg/kg. Asma grave: 2 mg/kg.' },
    ],
  },
  // ===================== ANTIBIÓTICOS =====================
  antibióticos: {
    categoria: 'Antibióticos (Profilaxia)',
    drogas: [
      { droga: 'CEFAZOLINA', apresentacao: '1g/frasco', dosePadrao: 30, unidadeDose: 'mg/kg', diluicao: '1 frasco + 10ml AD', concentracaoFinal: 100, doseMaxima: 2000, obs: 'Profilaxia padrão. Repetir a cada 4h ou se sangramento >1500ml.' },
      { droga: 'GENTAMICINA', apresentacao: '40 mg/ml', dosePadrao: 2.5, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 40, doseMaxima: 120, warning: 'Nefro e ototóxica! Monitorar função renal.', obs: 'Infundir em 30-60 min. Dose única diária em crianças.' },
      { droga: 'AMPICILINA', apresentacao: '1g/frasco', dosePadrao: 50, unidadeDose: 'mg/kg', diluicao: '1 frasco + 10ml AD', concentracaoFinal: 100, doseMaxima: 2000, obs: 'Profilaxia endocardite. Cobrir enterococo e GBS.' },
      { droga: 'METRONIDAZOL', apresentacao: '5 mg/ml', dosePadrao: 7.5, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 5, doseMaxima: 500, obs: 'Cobertura para anaerobios. Infundir em 30-60 min.' },
      { droga: 'CLINDAMICINA', apresentacao: '150 mg/ml', dosePadrao: 10, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 150, doseMaxima: 600, obs: 'Alternativa em alergia a penicilina. Diluir e infundir lento.' },
      { droga: 'VANCOMICINA', apresentacao: '500 mg/frasco', dosePadrao: 15, unidadeDose: 'mg/kg', diluicao: '1 frasco + 10ml AD', concentracaoFinal: 50, doseMaxima: 1000, warning: 'Infundir em >60 min! Síndrome do homem vermelho se rápido.', obs: 'Iniciar 60-120 min antes da incisao. Cobrir MRSA.' },
    ],
  },
  // ===================== ROTINA CIRÚRGICA =====================
  rotina: {
    categoria: 'Drogas de Rotina Cirúrgica',
    drogas: [
      { droga: 'ONDANSETRONA', apresentacao: '2 mg/ml', dosePadrao: 0.1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 2, doseMaxima: 4, obs: 'Antiem etico de escolha. Dar ao final da cirurgia. Pode prolongar QT.' },
      { droga: 'METOCLOPRAMIDA', apresentacao: '5 mg/ml', dosePadrao: 0.15, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 5, doseMaxima: 10, warning: 'Risco de reacoes extrapiramidais em crianças!', obs: 'Procinetico. Administrar lentamente.' },
      { droga: 'RANITIDINA', apresentacao: '25 mg/ml', dosePadrao: 1, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 25, doseMaxima: 50, obs: 'Redutor de acidez gastrica. Profilaxia de aspiração.' },
      { droga: 'OMEPRAZOL', apresentacao: '40 mg/frasco', dosePadrao: 1, unidadeDose: 'mg/kg', diluicao: '1 frasco + 10ml AD', concentracaoFinal: 4, doseMaxima: 40, obs: 'IBP. Usar em DRGE ou alto risco de aspiração.' },
      { droga: 'NEOSTIGMINA', apresentacao: '0.5 mg/ml', dosePadrao: 0.04, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 0.5, doseMaxima: 2.5, warning: 'Sempre associar com Atropina!', obs: 'Reversão de BNM aminoesteroides. Aguardar TOF >=2.' },
      { droga: 'ATROPINA (reversão)', apresentacao: '0.25 mg/ml', dosePadrao: 0.02, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 0.25, doseMinima: 0.1, doseMaxima: 0.5, obs: 'Previne bradicardia da Neostigmina. Dar junto ou antes.' },
      { droga: 'SUGAMADEX', apresentacao: '100 mg/ml', dosePadrao: 2, unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 100, obs: 'Reversão específica de Rocuronio/Vecuronio. 2mg/kg se TOF>=2. 4mg/kg se PTC>=1-2.' },
      { droga: 'EFEDRINA', apresentacao: '50 mg/ml', dosePadrao: 0.1, unidadeDose: 'mg/kg', diluicao: '1ml + 9ml AD', concentracaoFinal: 5, doseMaxima: 25, obs: 'Vasopressor de ação mista. Pode repetir. Taquifilaxia após doses repetidas.' },
      { droga: 'FENILEFRINA', apresentacao: '10 mg/ml', dosePadrao: 2, unidadeDose: 'mcg/kg', diluicao: '1ml + 99ml AD', concentracaoFinal: 0.1, doseMaxima: 100, obs: 'Alfa-agonista puro. Bradicardia reflexa. Usar em taquicardia + hipotensão.' },
      { droga: 'OXITOCINA', apresentacao: '5 UI/ml', dosePadrao: 0.02, unidadeDose: 'UI/kg', diluicao: 'SEM DILUIR', concentracaoFinal: 5, doseMaxima: 10, warning: 'Bolus pode causar hipotensão grave!', obs: 'Infundir lentamente. Usar em atonia uterina.' },
    ],
  },
};

// Exportar dados para uso no componente de renderização
export { PEDI_CALC_DATA };

const pedDosesCalculators = [
  {
    id: 'ped_doses',
    title: 'Doses Pediátricas (PediCalc)',
    subtitle: 'Cálculo de doses por peso',
    icon: 'Pill',
    status: 'active',
    customRender: 'pedicalc', // Indica renderização especial
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 0.5, max: 150, step: 0.1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      if (peso === 0) return null;

      // Calcular todas as categorias
      const categorias = [];
      Object.keys(PEDI_CALC_DATA).forEach((catKey) => {
        const catData = PEDI_CALC_DATA[catKey];
        const medicamentos = [];

        catData.drogas.forEach((med) => {
          let doseCalculada = peso * med.dosePadrao;

          // Aplicar limites
          if (med.doseMinima && doseCalculada < med.doseMinima) {
            doseCalculada = med.doseMinima;
          }
          if (med.doseMaxima && doseCalculada > med.doseMaxima) {
            doseCalculada = med.doseMaxima;
          }

          // Calcular volume
          const volumeFinal = doseCalculada / med.concentracaoFinal;

          // Formatar unidade
          const unidade = med.unidadeDose.includes('mcg') ? 'mcg' :
                          med.unidadeDose.includes('mEq') ? 'mEq' :
                          med.unidadeDose.includes('ml') ? 'ml' : 'mg';

          medicamentos.push({
            droga: med.droga,
            apresentacao: med.apresentação,
            diluicao: med.diluicao,
            dose: `${doseCalculada.toFixed(2)} ${unidade}`,
            volume: `${volumeFinal.toFixed(2)} ml`,
            dosePadrao: `${med.dosePadrao} ${med.unidadeDose}`,
            warning: med.warning || null,
            obs: med.obs || null,
          });
        });

        categorias.push({
          key: catKey,
          titulo: catData.categoria,
          medicamentos,
        });
      });

      return {
        score: peso,
        categorias,
        totalMedicamentos: categorias.reduce((acc, cat) => acc + cat.medicamentos.length, 0),
      };
    },
    resultMessage: (result) => {
      if (!result || !result.categorias) return 'Informe o peso da criança';
      return `${result.totalMedicamentos} medicamentos calculados para ${result.score} kg`;
    },
    // InfoBox removido - informacoes individualizadas em cada card de médicação
  },
];

// =============================================================================
// SEÇÃO 2: PEDIATRIA - VIA AÉREA E REANIMAÇÃO (3 calculadoras)
// =============================================================================

const pedViaAereaCalculators = [
  {
    id: 'ped_via_aerea',
    title: 'Via Aérea Pediátrica',
    subtitle: 'Tubo ET, profundidade, mascara laringea',
    icon: 'Wind',
    status: 'active',
    customRender: 'viaAerea',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 0.5, max: 50, step: 0.5 },
      {
        id: 'idade_unidade',
        label: 'Unidade de Idade',
        type: 'select',
        options: [
          { value: 'meses', label: 'Meses' },
          { value: 'anos', label: 'Anos' },
        ],
      },
      { id: 'idade_valor', label: 'Idade', type: 'number', min: 0, max: 18, step: 1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      const unidade = values.idade_unidade || 'meses';
      const idadeValor = parseFloat(values.idade_valor) || 0;
      if (peso === 0) return null;

      // Converter para meses se necessário
      const idadeMeses = unidade === 'anos' ? idadeValor * 12 : idadeValor;
      const idadeAnos = idadeMeses / 12;
      let tuboSemCuff, tuboComCuff, profundidade, lma, categoria;

      // Prematuros e RN (baseado em peso quando idade <= 1 mes)
      if (idadeMeses <= 1) {
        if (peso < 1) {
          tuboSemCuff = 2.5;
          tuboComCuff = null;
          profundidade = 7;
          categoria = 'Prematuro < 1kg';
        } else if (peso <= 2) {
          tuboSemCuff = 3.0;
          tuboComCuff = null;
          profundidade = 8;
          categoria = 'Prematuro 1-2kg';
        } else {
          tuboSemCuff = 3.5;
          tuboComCuff = 3.0;
          profundidade = 10;
          categoria = 'RN termo';
        }
      } else if (idadeAnos >= 1) {
        // Formula de Cole (sem cuff) e Duracher (com cuff) para >= 1 ano
        tuboSemCuff = (idadeAnos / 4) + 4;
        tuboComCuff = (idadeAnos / 4) + 3.5;
        profundidade = tuboSemCuff * 3;
        categoria = `${Math.floor(idadeAnos)} ano${idadeAnos >= 2 ? 's' : ''}`;
      } else {
        // 1-12 meses
        tuboSemCuff = 3.5;
        tuboComCuff = 3.0;
        profundidade = 10;
        categoria = `${idadeMeses} meses`;
      }

      // Mascara Laringea por peso (LMA)
      if (peso < 5) lma = '1';
      else if (peso < 10) lma = '1.5';
      else if (peso < 20) lma = '2';
      else if (peso < 30) lma = '2.5';
      else lma = '3';

      return {
        score: tuboSemCuff,
        peso,
        idadeMeses,
        categoria,
        details: {
          tuboSemCuff: tuboSemCuff?.toFixed(1),
          tuboComCuff: tuboComCuff?.toFixed(1),
          profundidade: profundidade?.toFixed(1),
          lma,
        },
      };
    },
    resultMessage: (result) => {
      if (!result || !result.details) return 'Informe peso e idade';
      return `Tubo sem cuff: ${result.details.tuboSemCuff} mm | ML: ${result.details.lma}`;
    },
    infoBox: {
      warnings: [
        'Sempre preparar tubos 0.5mm acima e abaixo do calculado',
      ],
      keyPoints: [
        'Tubo SEM cuff: Formula de Cole (idade/4 + 4)',
        'Tubo COM cuff: Formula de Duracher (idade/4 + 3.5) - preferida atualmente',
        'Profundidade oral = diametro do tubo x 3 cm',
      ],
      doses: [
        'LMA #1: < 5 kg',
        'LMA #1.5: 5-10 kg',
        'LMA #2: 10-20 kg',
        'LMA #2.5: 20-30 kg',
        'LMA #3: 30-50 kg',
      ],
      reference: 'Cole F. AMA J Dis Child. 1957 | Duracher C. Br J Anaesth. 2008 | AHA/PALS Guidelines 2020.',
    },
  },
  {
    id: 'ped_desfib',
    title: 'Desfibrilação Pediátrica',
    subtitle: 'J/kg - PALS',
    icon: 'Zap',
    status: 'active',
    customRender: 'pedDesfib',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 1, max: 50, step: 0.5 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      if (peso === 0) return null;

      const choque1 = Math.round(peso * 2);
      const choque2 = Math.round(peso * 4);
      const choqueMax = Math.min(Math.round(peso * 10), 200);
      const cardioversao1 = Math.round(peso * 0.5);
      const cardioversao2 = Math.round(peso * 2);

      return {
        score: choque1,
        details: {
          '1o Choque (FV/TV)': `${choque1} J`,
          '2o Choque': `${choque2} J`,
          'Choques subsequentes': `${choque2}-${choqueMax} J`,
          'Cardioversão inicial': `${cardioversao1}-${Math.round(peso)} J`,
          'Cardioversão repetir': `${cardioversao2} J`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result || !result.details) return 'Informe o peso';
      return `Desfibrilação: 1o choque ${result.details['1o Choque (FV/TV)']} | 2o choque ${result.details['2o Choque']}`;
    },
    infoBox: {
      warnings: [
        'Não exceder dose máxima adulta (200J bifasico)',
      ],
      keyPoints: [
        '1º Choque FV/TV sem pulso: 2 J/kg',
        '2º Choque: 4 J/kg',
        'Choques subsequentes: 4-10 J/kg',
        'Cardioversão sincronizada (TSV/flutter): 0.5-1 J/kg inicial',
        'Repetir cardioversão: 2 J/kg se necessário',
      ],
      interpretation: 'Protocolo PALS (Pediatric Advanced Life Support) para desfibrilação pediátrica.',
      reference: 'PALS Provider Manual. AHA, 2020. | de Caen AR, et al. ILCOR Scientific Statement. Circulation, 2020.',
    },
  },
  {
    id: 'ped_broselow',
    title: 'Fita de Broselow',
    subtitle: 'Estimativa peso por comprimento',
    icon: 'Ruler',
    status: 'active',
    customRender: 'broselow',
    inputs: [
      { id: 'comprimento', label: 'Comprimento (cm)', type: 'number', min: 46, max: 150, step: 1 },
    ],
    compute: (values) => {
      const comprimento = parseFloat(values.comprimento) || 0;
      if (comprimento === 0) return null;

      // Tabela atualizada com faixas de peso (LA Peds Ready / Broselow 2025)
      const BROSELOW_TABLE = [
        { cor: 'Cinza', corEN: 'Grey', min: 46, max: 56, pesoMin: 3, pesoMax: 5, tubo: '3.0-3.5', lma: '1', hex: '#9E9E9E', textColor: '#FFFFFF' },
        { cor: 'Rosa', corEN: 'Pink', min: 57, max: 66, pesoMin: 6, pesoMax: 7, tubo: '3.5', lma: '1', hex: '#F48FB1', textColor: '#000000' },
        { cor: 'Vermelho', corEN: 'Red', min: 67, max: 74, pesoMin: 8, pesoMax: 9, tubo: '4.0', lma: '1.5', hex: '#EF5350', textColor: '#FFFFFF' },
        { cor: 'Roxo', corEN: 'Purple', min: 75, max: 83, pesoMin: 10, pesoMax: 11, tubo: '4.5', lma: '2', hex: '#AB47BC', textColor: '#FFFFFF' },
        { cor: 'Amarelo', corEN: 'Yellow', min: 84, max: 95, pesoMin: 12, pesoMax: 14, tubo: '5.0', lma: '2', hex: '#FFEE58', textColor: '#000000' },
        { cor: 'Branco', corEN: 'White', min: 96, max: 107, pesoMin: 15, pesoMax: 18, tubo: '5.5', lma: '2.5', hex: '#FAFAFA', textColor: '#000000' },
        { cor: 'Azul', corEN: 'Blue', min: 108, max: 119, pesoMin: 19, pesoMax: 23, tubo: '6.0 c/cuff', lma: '2.5-3', hex: '#42A5F5', textColor: '#FFFFFF' },
        { cor: 'Laranja', corEN: 'Orange', min: 120, max: 131, pesoMin: 24, pesoMax: 29, tubo: '6.5 c/cuff', lma: '3', hex: '#FFA726', textColor: '#000000' },
        { cor: 'Verde', corEN: 'Green', min: 132, max: 143, pesoMin: 30, pesoMax: 36, tubo: '7.0 c/cuff', lma: '3-4', hex: '#66BB6A', textColor: '#FFFFFF' },
      ];

      const faixa = BROSELOW_TABLE.find(f => comprimento >= f.min && comprimento <= f.max);

      if (!faixa) {
        return {
          score: 0,
          erro: true,
          details: { mensagem: 'Comprimento fora da faixa (46-143 cm)' },
        };
      }

      return {
        score: faixa.pesoMin,
        comprimento,
        faixa: {
          cor: faixa.cor,
          corEN: faixa.corEN,
          hex: faixa.hex,
          textColor: faixa.textColor,
          pesoMin: faixa.pesoMin,
          pesoMax: faixa.pesoMax,
          tubo: faixa.tubo,
          lma: faixa.lma,
          rangeComprimento: `${faixa.min}-${faixa.max} cm`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Informe o comprimento';
      if (result.erro) return result.details.mensagem;
      return `Fita ${result.faixa.cor} | Peso: ${result.faixa.pesoMin}-${result.faixa.pesoMax} kg`;
    },
    infoBox: {
      warnings: [
        'Em crianças obesas ou desnutridas, o peso real pode diferir significativamente',
        'Usar sempre julgamento clínico para confirmar',
      ],
      keyPoints: [
        'Estima peso pela altura da criança (46-143 cm)',
        '9 zonas de cor: Cinza, Rosa, Vermelho, Roxo, Amarelo, Branco, Azul, Laranja, Verde',
        'Inclui equipamentos de emergência pre-calculados',
        'Precisao: ~65% zona correta, 20% zona acima, 13% zona abaixo',
      ],
      reference: 'Broselow Pediatric Emergency Tape 2025 | LA Pediatric Readiness | NHANES Weight-Length Data.',
    },
  },
];

// =============================================================================
// SEÇÃO 3: PEDIATRIA - PERIOPERATÓRIO E SRPA (4 calculadoras)
// =============================================================================

const pedPeriopCalculators = [
  {
    id: 'ped_holliday_segar',
    title: 'Holliday-Segar Pediátrico',
    subtitle: 'Manutenção de fluidos (4-2-1)',
    icon: 'Droplet',
    status: 'active',
    customRender: 'hollidaySegar',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 0.5, max: 100, step: 0.1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      if (peso === 0) return null;
      let manutencao = 0;
      if (peso <= 10) {
        manutencao = peso * 4;
      } else if (peso <= 20) {
        manutencao = 40 + (peso - 10) * 2;
      } else {
        manutencao = 60 + (peso - 20) * 1;
      }
      const ml24h = manutencao * 24;
      return {
        score: manutencao,
        details: {
          mlHora: manutencao,
          ml24h: ml24h,
        },
      };
    },
    resultMessage: (result) => {
      if (!result || !result.details) return 'Informe o peso';
      return `Manutenção: ${result.details.mlHora?.toFixed(1)} mL/h (${result.details.ml24h?.toFixed(0)} mL/24h)`;
    },
    infoBox: {
      keyPoints: [
        'Primeiros 10 kg: 4 mL/kg/h',
        'Próximos 10 kg (11-20 kg): 2 mL/kg/h',
        'Acima de 20 kg: 1 mL/kg/h',
        'Regra "4-2-1" - padrão para hidratação de manutenção pediátrica',
      ],
      reference: 'Holliday MA, Segar WE. Pediatrics, 1957. | Miller RD. Millers Anesthesia, 9th ed.',
    },
  },
  {
    id: 'ped_jejum',
    title: 'Jejum Pré-operatório Pediátrico',
    subtitle: 'Tempos de jejum - Guidelines ASA/ESAIC',
    icon: 'Clock',
    status: 'active',
    inputs: [
      {
        id: 'tipo_alimento',
        label: 'Último alimento ingerido',
        type: 'select',
        options: [
          { value: 'liquido_claro', label: 'Líquidos claros (água, chá, suco sem polpa)' },
          { value: 'leite_materno', label: 'Leite materno' },
          { value: 'formula', label: 'Formula infantil' },
          { value: 'leite_vaca', label: 'Leite de vaca/não humano' },
          { value: 'leve', label: 'Refeição leve (torrada, fruta)' },
          { value: 'gordurosa', label: 'Refeição com gordura/carne' },
        ],
      },
    ],
    compute: (values) => {
      const tipo = values.tipo_alimento;
      if (!tipo) return null;

      const TEMPOS_JEJUM = {
        líquido_claro: { horas: 2, label: 'Líquidos claros', nota: 'ESAIC/SPA: 1h e seguro' },
        leite_materno: { horas: 4, label: 'Leite materno', nota: '' },
        formula: { horas: 6, label: 'Formula infantil', nota: '' },
        leite_vaca: { horas: 6, label: 'Leite não humano', nota: '' },
        leve: { horas: 6, label: 'Refeição leve', nota: 'Torrada, frutas' },
        gordurosa: { horas: 8, label: 'Refeição gordurosa', nota: 'Carnes, frituras' },
      };

      const info = TEMPOS_JEJUM[tipo];

      return {
        score: info.horas,
        details: {
          'Tipo de alimento': info.label,
          'Tempo mínimo': `${info.horas} horas`,
          'Observação': info.nota || '-',
        },
      };
    },
    resultMessage: (result) => {
      if (!result || !result.details) return 'Selecione o tipo de alimento';
      return `Jejum mínimo: ${result.details['Tempo minimo']} para ${result.details['Tipo de alimento']}`;
    },
    infoBox: {
      keyPoints: [
        'Líquidos claros: 2h (ASA) ou 1h (ESAIC/SPA - seguro)',
        'Leite materno: 4h',
        'Formula/leite não humano: 6h',
        'Refeição leve: 6h',
        'Refeição gordurosa: 8h',
        'Emergência: assumir estomago cheio - ISR',
      ],
      warnings: [
        'Jejum prolongado (>4h para líquidos) aumenta desconforto, ansiedade e alterações metabólicas',
        'Evitar jejum excessivo - pode causar hipoglicemia em lactentes',
      ],
      reference: 'ASA Practice Guidelines 2023 | ESAIC Perioperative Fasting Guidelines 2024 | SPA/ADARPEF Joint Statement.',
    },
  },
  {
    id: 'ped_glasgow',
    title: 'Glasgow Pediátrico',
    subtitle: 'Escala adaptada por faixa etaria',
    icon: 'Brain',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'faixa_etaria',
        label: 'Faixa etaria',
        type: 'select',
        options: [
          { value: 'lactente', label: '< 2 anos (Lactente)' },
          { value: 'pre_escolar', label: '2-5 anos (Pre-escolar)' },
          { value: 'escolar', label: '> 5 anos (Escolar/Adulto)' },
        ],
      },
      {
        id: 'abertura_ocular',
        label: 'Abertura Ocular',
        type: 'select',
        options: [
          { value: 4, label: '4 - Espontanea' },
          { value: 3, label: '3 - Ao comando verbal' },
          { value: 2, label: '2 - A dor' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
      {
        id: 'resposta_verbal',
        label: 'Resposta Verbal (varia por idade)',
        type: 'select',
        options: [
          { value: 5, label: '5 - Melhor resposta' },
          { value: 4, label: '4 - Boa resposta' },
          { value: 3, label: '3 - Resposta intermediária' },
          { value: 2, label: '2 - Resposta mínima' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
      {
        id: 'resposta_motora',
        label: 'Resposta Motora',
        type: 'select',
        options: [
          { value: 6, label: '6 - Obedece comandos' },
          { value: 5, label: '5 - Localiza dor' },
          { value: 4, label: '4 - Retirada a dor' },
          { value: 3, label: '3 - Flexao anormal (decorticação)' },
          { value: 2, label: '2 - Extensao anormal (descerebração)' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
    ],
    compute: (values) => {
      const ocular = parseInt(values.abertura_ocular) || 0;
      const verbal = parseInt(values.resposta_verbal) || 0;
      const motor = parseInt(values.resposta_motora) || 0;

      if (ocular === 0 || verbal === 0 || motor === 0) return null;

      const score = ocular + verbal + motor;
      let gravidade = 'TCE Leve';

      if (score <= 8) {
        gravidade = 'TCE Grave - Indicação de IOT';
      } else if (score <= 13) {
        gravidade = 'TCE Moderado';
      }

      return {
        score,
        details: {
          'Abertura Ocular': `${ocular} pontos`,
          'Resposta Verbal': `${verbal} pontos`,
          'Resposta Motora': `${motor} pontos`,
          'Classificação': gravidade,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `Glasgow Pediátrico: ${result.score}/15 - ${result.details['Classificação']}`;
    },
    infoBox: {
      keyPoints: [
        'Score 3-8: TCE Grave - indicação de IOT',
        'Score 9-13: TCE Moderado',
        'Score 14-15: TCE Leve',
        'Abertura Ocular (O): igual ao adulto (1-4 pontos)',
        'Resposta Verbal (V): adaptada por faixa etaria',
        'Resposta Motora (M): igual ao adulto (1-6 pontos)',
      ],
      warnings: [
        'Score <= 8 indica necessidade de proteção de via aérea imediata (IOT)',
      ],
      reference: 'Teasdale G, Jennett B. Lancet, 1974 | Simpson D, Reilly P. Lancet, 1982.',
    },
  },
  {
    id: 'ped_steward',
    title: 'Escore de Steward',
    subtitle: 'Alta da SRPA pediátrica',
    icon: 'ClipboardCheck',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'consciencia',
        label: 'Consciência',
        type: 'select',
        options: [
          { value: 0, label: '0 - Não responde' },
          { value: 1, label: '1 - Responde a estimulos' },
          { value: 2, label: '2 - Acordado' },
        ],
      },
      {
        id: 'via_aerea',
        label: 'Via Aérea',
        type: 'select',
        options: [
          { value: 0, label: '0 - Requer suporte' },
          { value: 1, label: '1 - Mantém via aérea' },
          { value: 2, label: '2 - Tosse sob comando' },
        ],
      },
      {
        id: 'movimento',
        label: 'Movimento',
        type: 'select',
        options: [
          { value: 0, label: '0 - Nenhum' },
          { value: 1, label: '1 - Movimentos involuntarios' },
          { value: 2, label: '2 - Movimentos voluntarios' },
        ],
      },
    ],
    compute: (values) => {
      const consciencia = parseInt(values.consciencia) || 0;
      const via_aerea = parseInt(values.via_aerea) || 0;
      const movimento = parseInt(values.movimento) || 0;
      const score = consciencia + via_aerea + movimento;

      let status = 'Não apto para alta';
      if (score >= 6) {
        status = 'Apto para alta da SRPA';
      } else if (score >= 4) {
        status = 'Continuar observação';
      }

      return {
        score,
        details: {
          'Consciência': `${consciencia} pontos`,
          'Via Aérea': `${via_aerea} pontos`,
          'Movimento': `${movimento} pontos`,
          'Status': status,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `Steward ${result.score}/6: ${result.details['Status']}`;
    },
    infoBox: {
      keyPoints: [
        'Score 6: APTO para alta da SRPA',
        'Score 4-5: Continuar observação',
        'Score < 4: NÃO apto para alta',
        'Consciência: 0 (não responde) a 2 (acordado)',
        'Via Aérea: 0 (requer suporte) a 2 (tosse sob comando)',
        'Movimento: 0 (nenhum) a 2 (voluntario)',
      ],
      warnings: [
        'Alta somente com score = 6 (máximo)',
      ],
      reference: 'Steward DJ. Can Anaesth Soc J, 1975 | Aldrete JA. J Clin Anesth, 1995.',
    },
  },
];

// =============================================================================
// SEÇÃO 4: PEDIATRIA - UTI/PROGNÓSTICO/DOR/SANGUE (11 calculadoras)
// =============================================================================

const pedUtiCalculators = [
  {
    id: 'ped_pews',
    title: 'PEWS',
    subtitle: 'Escore Pediátrico de Alerta Precoce',
    icon: 'AlertTriangle',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'comportamento',
        label: 'Comportamento',
        type: 'select',
        options: [
          { value: 0, label: '0 - Brincando/apropriado' },
          { value: 1, label: '1 - Dormindo' },
          { value: 2, label: '2 - Irritável' },
          { value: 3, label: '3 - Letargico/confuso ou resposta reduzida a dor' },
        ],
      },
      {
        id: 'cardiovascular',
        label: 'Cardiovascular',
        type: 'select',
        options: [
          { value: 0, label: '0 - Corado, enchimento capilar 1-2s' },
          { value: 1, label: '1 - Palido OU enchimento capilar 3s' },
          { value: 2, label: '2 - Cinza OU enchimento capilar 4s OU taquicardia +20bpm' },
          { value: 3, label: '3 - Cinza/moteado OU enchimento >=5s OU taquicardia +30bpm OU bradicardia' },
        ],
      },
      {
        id: 'respiratorio',
        label: 'Respiratório',
        type: 'select',
        options: [
          { value: 0, label: '0 - Parâmetros normais, sem retrações' },
          { value: 1, label: '1 - FR +10 acima normal, uso de musculatura acessória OU FiO2 30%/4L' },
          { value: 2, label: '2 - FR +20 acima normal com retrações OU FiO2 40%/6L' },
          { value: 3, label: '3 - FR 5 abaixo normal com retrações e gemência OU FiO2 50%/8L' },
        ],
      },
      {
        id: 'nebulizacao',
        label: 'Nebulização a cada 15 minutos',
        type: 'select',
        options: [
          { value: 0, label: 'Não' },
          { value: 1, label: 'Sim (+1 ponto)' },
        ],
      },
      {
        id: 'vomito',
        label: 'Vômitos persistentes pos-cirurgia',
        type: 'select',
        options: [
          { value: 0, label: 'Não' },
          { value: 1, label: 'Sim (+1 ponto)' },
        ],
      },
    ],
    compute: (values) => {
      const comportamento = parseInt(values.comportamento) || 0;
      const cardiovascular = parseInt(values.cardiovascular) || 0;
      const respiratorio = parseInt(values.respiratorio) || 0;
      const nebulizacao = parseInt(values.nebulizacao) || 0;
      const vomito = parseInt(values.vomito) || 0;

      const score = comportamento + cardiovascular + respiratorio + nebulizacao + vomito;

      let conduta = '';
      let alerta = '';
      if (score <= 2) {
        conduta = 'Monitoramento de rotina a cada 4 horas';
        alerta = 'Verde';
      } else if (score === 3) {
        conduta = 'Notificar médico, reavaliar em 2 horas';
        alerta = 'Amarelo';
      } else if (score === 4) {
        conduta = 'Avaliação imediata a beira leito pela equipe';
        alerta = 'Laranja';
      } else {
        conduta = 'Ativar Time de Resposta Rápida (TRR)';
        alerta = 'Vermelho';
      }

      return {
        score,
        details: {
          'Comportamento': `${comportamento} pontos`,
          'Cardiovascular': `${cardiovascular} pontos`,
          'Respiratório': `${respiratório} pontos`,
          'Modificadores': `+${nebulização + vômito} pontos`,
          'Alerta': alerta,
          'Conduta': conduta,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `PEWS ${result.score}/11: ${result.details['Alerta']} - ${result.details['Conduta']}`;
    },
    infoBox: {
      keyPoints: [
        'Score 0-2: Verde - Monitoramento rotina 4h',
        'Score 3: Amarelo - Notificar médico, reavaliar 2h',
        'Score 4: Laranja - Avaliação imediata a beira leito',
        'Score >= 5: Vermelho - Ativar Time de Resposta Rápida',
        'Score 3 em uma única categoria: Avaliação imediata',
      ],
      warnings: [
        'Qualquer pontuação 3 em categoria individual requer avaliação imediata',
      ],
      reference: 'Monaghan A. Nursing Crit Care. 2005 | Duncan H. Arch Dis Child. 2006.',
    },
  },
  {
    id: 'ped_psofa',
    title: 'pSOFA',
    subtitle: 'SOFA Pediátrico',
    icon: 'Activity',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'respiratorio',
        label: 'Respiratório (PaO2/FiO2 ou SpO2/FiO2)',
        type: 'select',
        options: [
          { value: 0, label: '0 - PaO2/FiO2 >= 400 ou SpO2/FiO2 >= 292' },
          { value: 1, label: '1 - PaO2/FiO2 300-399 ou SpO2/FiO2 265-291' },
          { value: 2, label: '2 - PaO2/FiO2 200-299 ou SpO2/FiO2 221-264' },
          { value: 3, label: '3 - PaO2/FiO2 100-199 ou SpO2/FiO2 148-220 (com suporte)' },
          { value: 4, label: '4 - PaO2/FiO2 < 100 ou SpO2/FiO2 < 148 (com suporte)' },
        ],
      },
      {
        id: 'coagulacao',
        label: 'Coagulação (Plaquetas x10³/mm³)',
        type: 'select',
        options: [
          { value: 0, label: '0 - >= 150' },
          { value: 1, label: '1 - 100-149' },
          { value: 2, label: '2 - 50-99' },
          { value: 3, label: '3 - 20-49' },
          { value: 4, label: '4 - < 20' },
        ],
      },
      {
        id: 'hepatico',
        label: 'Hepático (Bilirrubina mg/dL)',
        type: 'select',
        options: [
          { value: 0, label: '0 - < 1.2' },
          { value: 1, label: '1 - 1.2-1.9' },
          { value: 2, label: '2 - 2.0-5.9' },
          { value: 3, label: '3 - 6.0-11.9' },
          { value: 4, label: '4 - >= 12.0' },
        ],
      },
      {
        id: 'cardiovascular',
        label: 'Cardiovascular',
        type: 'select',
        options: [
          { value: 0, label: '0 - PAM normal para idade (sem vasopressores)' },
          { value: 1, label: '1 - PAM abaixo do normal para idade' },
          { value: 2, label: '2 - Dopamina <= 5 mcg/kg/min OU dobutamina' },
          { value: 3, label: '3 - Dopamina > 5 OU epinefrina <= 0.1 OU norepinefrina <= 0.1' },
          { value: 4, label: '4 - Dopamina > 15 OU epinefrina > 0.1 OU norepinefrina > 0.1' },
        ],
      },
      {
        id: 'neurologico',
        label: 'Neurológico (Glasgow)',
        type: 'select',
        options: [
          { value: 0, label: '0 - Glasgow 15' },
          { value: 1, label: '1 - Glasgow 13-14' },
          { value: 2, label: '2 - Glasgow 10-12' },
          { value: 3, label: '3 - Glasgow 6-9' },
          { value: 4, label: '4 - Glasgow < 6' },
        ],
      },
      {
        id: 'renal',
        label: 'Renal (Creatinina mg/dL para idade)',
        type: 'select',
        options: [
          { value: 0, label: '0 - Normal para idade' },
          { value: 1, label: '1 - Elevada leve (1.1-1.5x normal)' },
          { value: 2, label: '2 - Elevada moderada (1.5-2x normal)' },
          { value: 3, label: '3 - Elevada grave (2-3x normal)' },
          { value: 4, label: '4 - Elevada crítica (> 3x normal ou diálise)' },
        ],
      },
    ],
    compute: (values) => {
      const respiratorio = parseInt(values.respiratorio) || 0;
      const coagulacao = parseInt(values.coagulacao) || 0;
      const hepatico = parseInt(values.hepatico) || 0;
      const cardiovascular = parseInt(values.cardiovascular) || 0;
      const neurologico = parseInt(values.neurologico) || 0;
      const renal = parseInt(values.renal) || 0;

      const score = respiratorio + coagulacao + hepatico + cardiovascular + neurologico + renal;

      let gravidade = '';
      if (score <= 5) {
        gravidade = 'Disfunção leve';
      } else if (score <= 9) {
        gravidade = 'Disfunção moderada';
      } else if (score <= 14) {
        gravidade = 'Disfunção grave';
      } else {
        gravidade = 'Disfunção muito grave';
      }

      // Critério de sepse: pSOFA >= 2
      const sepse = score >= 2 ? 'Critério de sepse presente (pSOFA >= 2)' : 'Critério de sepse ausente';

      return {
        score,
        details: {
          'Respiratório': `${respiratório} pontos`,
          'Coagulação': `${coagulação} pontos`,
          'Hepático': `${hepático} pontos`,
          'Cardiovascular': `${cardiovascular} pontos`,
          'Neurológico': `${neurológico} pontos`,
          'Renal': `${renal} pontos`,
          'Gravidade': gravidade,
          'Sepse': sepse,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `pSOFA ${result.score}/24: ${result.details['Gravidade']}`;
    },
    infoBox: {
      keyPoints: [
        'Score 0-5: Disfunção organica leve',
        'Score 6-9: Disfunção organica moderada',
        'Score 10-14: Disfunção organica grave',
        'Score >= 15: Disfunção organica muito grave',
        'pSOFA >= 2: Critério de sepse (Sepsis-3)',
        'Avalia 6 sistemas: respiratório, coagulação, hepático, cardiovascular, neurológico e renal',
      ],
      warnings: [
        'pSOFA >= 2 com infecção suspeita ou confirmada define sepse pediátrica',
      ],
      reference: 'Matics TJ, Sanchez-Pinto LN. JAMA Pediatr. 2017 | Sepsis-3 Definitions.',
    },
  },
  {
    id: 'ped_pim3',
    title: 'PIM3',
    subtitle: 'Índice de Mortalidade Pediátrica',
    icon: 'TrendingDown',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'pupilas',
        label: 'Reação Pupilar',
        type: 'select',
        options: [
          { value: 0, label: 'Ambas reagentes' },
          { value: 1, label: 'Ambas fixas e > 3mm' },
        ],
      },
      {
        id: 'admissao_eletiva',
        label: 'Admissao Eletiva na UTI',
        type: 'select',
        options: [
          { value: 1, label: 'Sim (cirurgia eletiva)' },
          { value: 0, label: 'Não (emergência)' },
        ],
      },
      {
        id: 'ventilacao',
        label: 'Ventilação Mecânica na 1a hora',
        type: 'select',
        options: [
          { value: 0, label: 'Não' },
          { value: 1, label: 'Sim (invasiva, CPAP, BiPAP)' },
        ],
      },
      {
        id: 'pas',
        label: 'PA Sistólica (mmHg)',
        type: 'number',
        min: 0,
        max: 300,
        step: 1,
      },
      {
        id: 'fio2',
        label: 'FiO2 (%)',
        type: 'number',
        min: 21,
        max: 100,
        step: 1,
      },
      {
        id: 'pao2',
        label: 'PaO2 (mmHg) - deixe 0 se não disponível',
        type: 'number',
        min: 0,
        max: 500,
        step: 1,
      },
      {
        id: 'base_excess',
        label: 'Excesso de Base (mEq/L)',
        type: 'number',
        min: -30,
        max: 30,
        step: 0.1,
      },
      {
        id: 'recuperacao',
        label: 'Recuperação de Cirurgia/Procedimento',
        type: 'select',
        options: [
          { value: 'nao', label: 'Não cirúrgico' },
          { value: 'nao_cardiaco', label: 'Pós-operatório não cardíaco' },
          { value: 'cardiaco', label: 'Pós bypass cardíaco' },
        ],
      },
      {
        id: 'risco_baixo',
        label: 'Diagnóstico de Baixo Risco',
        type: 'select',
        options: [
          { value: 0, label: 'Nenhum' },
          { value: 1, label: 'Asma, bronquiolite, crupe, apneia obstrutiva, CAD ou convulsão' },
        ],
      },
      {
        id: 'risco_alto',
        label: 'Diagnóstico de Alto Risco',
        type: 'select',
        options: [
          { value: 0, label: 'Nenhum' },
          { value: 1, label: 'PCR (pre-UTI), imunodeficiência grave, leucemia/linfoma pos-inducao' },
          { value: 2, label: 'Hemorragia cerebral espontânea, cardiomiopatia/miocardite' },
          { value: 3, label: 'Hipoplasia VE, HIV, insuficiência hepática, doença neurodegenerativa' },
        ],
      },
    ],
    compute: (values) => {
      const pupilas = parseInt(values.pupilas) || 0;
      const admissaoEletiva = parseInt(values.admissao_eletiva) || 0;
      const ventilacao = parseInt(values.ventilacao) || 0;
      const pas = parseFloat(values.pas) || 120;
      const fio2 = parseFloat(values.fio2) || 21;
      const pao2 = parseFloat(values.pao2) || 0;
      const baseExcess = parseFloat(values.base_excess) || 0;
      const recuperacao = values.recuperacao || 'nao';
      const riscoBaixo = parseInt(values.risco_baixo) || 0;
      const riscoAlto = parseInt(values.risco_alto) || 0;

      // Cálculo simplificado do PIM3
      // Formula: logit = constante + coeficientes * variaveis
      let logit = -1.7928;

      // Pupilas fixas
      if (pupilas === 1) logit += 3.8233;

      // Admissao eletiva (fator protetor)
      if (admissaoEletiva === 1) logit -= 0.5378;

      // Ventilação mecânica
      if (ventilacao === 1) logit += 0.9763;

      // PA sistólica (absoluta, transformada)
      const pasAdj = pas === 0 ? 30 : pas; // Se PCR, usar 30
      logit += (pasAdj * -0.0671) / 10;

      // FiO2/PaO2
      if (pao2 > 0 && fio2 > 0) {
        const ratio = (pao2 * 100) / fio2;
        if (ratio < 400) {
          logit += (ratio * -0.415) / 100;
        }
      }

      // Base excess (absoluto)
      const beAbs = Math.abs(baseExcess);
      logit += beAbs * 0.0671;

      // Recuperação cirúrgica
      if (recuperacao === 'cardiaco') logit += 1.6829;
      else if (recuperacao === 'nao_cardiaco') logit -= 1.0244;

      // Diagnósticos de risco
      if (riscoBaixo === 1) logit -= 1.5164;
      if (riscoAlto >= 1) logit += 1.0725;
      if (riscoAlto >= 2) logit += 0.5;
      if (riscoAlto >= 3) logit += 0.5;

      // Probabilidade de morte
      const probMorte = Math.exp(logit) / (1 + Math.exp(logit));
      const percentMorte = (probMorte * 100).toFixed(1);

      return {
        score: parseFloat(percentMorte),
        details: {
          'Probabilidade de óbito': `${percentMorte}%`,
          'Pupilas': pupilas === 1 ? 'Ambas fixas' : 'Reagentes',
          'Admissão': admissaoEletiva === 1 ? 'Eletiva' : 'Emergência',
          'Ventilação mecânica': ventilacao === 1 ? 'Sim' : 'Não',
          'PAS': `${pas} mmHg`,
          'Base Excess': `${baseExcess} mEq/L`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `PIM3: Probabilidade de óbito ${result.details['Probabilidade de óbito']}`;
    },
    infoBox: {
      keyPoints: [
        'Coleta de dados na 1a hora de admissao na UTI',
        'Usa 11 variaveis fisiologicas e clínicas',
        'Prediz mortalidade hospitalar em UTI pediátrica',
        'PA = 0 se PCR ou 30 se choque sem medida',
        'FiO2 = 21% se em ar ambiente',
      ],
      warnings: [
        'Valores coletados na 1a hora de contato com a equipe da UTI',
      ],
      reference: 'Straney L, et al. Pediatr Crit Care Med. 2013 | ESPNIC PIM3 Calculator.',
    },
  },
  {
    id: 'ped_prism3',
    title: 'PRISM III',
    subtitle: 'Risco de Mortalidade Pediátrica',
    icon: 'BarChart2',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'idade',
        label: 'Faixa Etaria',
        type: 'select',
        options: [
          { value: 'neo', label: 'Neonato (0-30 dias)' },
          { value: 'lactente', label: 'Lactente (1-12 meses)' },
          { value: 'crianca', label: 'Criança (1-12 anos)' },
          { value: 'adolescente', label: 'Adolescente (> 12 anos)' },
        ],
      },
      {
        id: 'pas',
        label: 'PA Sistólica Mínima (mmHg)',
        type: 'number',
        min: 0,
        max: 300,
        step: 1,
      },
      {
        id: 'temperatura',
        label: 'Temperatura (°C)',
        type: 'number',
        min: 30,
        max: 42,
        step: 0.1,
      },
      {
        id: 'mental',
        label: 'Estado Mental (Glasgow)',
        type: 'select',
        options: [
          { value: 0, label: 'Glasgow >= 8' },
          { value: 5, label: 'Glasgow < 8 (estupor/coma)' },
        ],
      },
      {
        id: 'pupilas',
        label: 'Reação Pupilar',
        type: 'select',
        options: [
          { value: 0, label: 'Ambas reativas' },
          { value: 7, label: 'Uma fixa' },
          { value: 11, label: 'Ambas fixas' },
        ],
      },
      {
        id: 'ph',
        label: 'pH Arterial',
        type: 'select',
        options: [
          { value: 0, label: '>= 7.28' },
          { value: 2, label: '7.0 - 7.28 (acidose)' },
          { value: 6, label: '< 7.0 (acidose grave)' },
        ],
      },
      {
        id: 'pco2',
        label: 'pCO2 (mmHg)',
        type: 'select',
        options: [
          { value: 0, label: '< 50' },
          { value: 1, label: '50-75' },
          { value: 3, label: '> 75' },
        ],
      },
      {
        id: 'pao2',
        label: 'PaO2 (mmHg)',
        type: 'select',
        options: [
          { value: 0, label: '>= 50' },
          { value: 3, label: '42-49' },
          { value: 6, label: '< 42' },
        ],
      },
      {
        id: 'glicose',
        label: 'Glicose (mg/dL)',
        type: 'select',
        options: [
          { value: 0, label: '40-250' },
          { value: 2, label: '< 40 (hipoglicemia)' },
          { value: 2, label: '> 250 (hiperglicemia)' },
        ],
      },
      {
        id: 'potassio',
        label: 'Potássio (mEq/L)',
        type: 'select',
        options: [
          { value: 0, label: '3.0-6.5' },
          { value: 3, label: '< 3.0 (hipocalemia)' },
          { value: 3, label: '> 6.5 (hipercalemia)' },
        ],
      },
      {
        id: 'creatinina',
        label: 'Creatinina elevada para idade',
        type: 'select',
        options: [
          { value: 0, label: 'Normal' },
          { value: 2, label: 'Elevada' },
        ],
      },
      {
        id: 'leucocitos',
        label: 'Leucócitos (x10³/mm³)',
        type: 'select',
        options: [
          { value: 0, label: '3.0-17.0' },
          { value: 4, label: '< 3.0 (leucopenia)' },
        ],
      },
      {
        id: 'plaquetas',
        label: 'Plaquetas (x10³/mm³)',
        type: 'select',
        options: [
          { value: 0, label: '>= 100' },
          { value: 2, label: '50-99' },
          { value: 4, label: '< 50' },
        ],
      },
      {
        id: 'coagulacao',
        label: 'TP/TTPA',
        type: 'select',
        options: [
          { value: 0, label: 'Normal' },
          { value: 3, label: 'TP > 22s ou TTPA > 57s' },
        ],
      },
    ],
    compute: (values) => {
      const idade = values.idade || 'crianca';
      const pas = parseFloat(values.pas) || 120;
      const temp = parseFloat(values.temperatura) || 37;
      const mental = parseInt(values.mental) || 0;
      const pupilas = parseInt(values.pupilas) || 0;
      const ph = parseInt(values.ph) || 0;
      const pco2 = parseInt(values.pco2) || 0;
      const pao2 = parseInt(values.pao2) || 0;
      const glicose = parseInt(values.glicose) || 0;
      const potassio = parseInt(values.potassio) || 0;
      const creatinina = parseInt(values.creatinina) || 0;
      const leucocitos = parseInt(values.leucocitos) || 0;
      const plaquetas = parseInt(values.plaquetas) || 0;
      const coagulacao = parseInt(values.coagulacao) || 0;

      // PA sistólica por idade
      let pasPontos = 0;
      if (idade === 'neo') {
        if (pas < 40) pasPontos = 7;
        else if (pas <= 55) pasPontos = 3;
      } else if (idade === 'lactente') {
        if (pas < 45) pasPontos = 7;
        else if (pas <= 65) pasPontos = 3;
      } else if (idade === 'crianca') {
        if (pas < 55) pasPontos = 7;
        else if (pas <= 75) pasPontos = 3;
      } else {
        if (pas < 65) pasPontos = 7;
        else if (pas <= 85) pasPontos = 3;
      }

      // Temperatura
      let tempPontos = 0;
      if (temp < 33 || temp > 40) tempPontos = 3;

      const scoreNeuro = mental + pupilas;
      const scoreNaoNeuro = pasPontos + tempPontos + ph + pco2 + pao2 + glicose + potassio + creatinina + leucocitos + plaquetas + coagulacao;
      const score = scoreNeuro + scoreNaoNeuro;

      let risco = '';
      if (score <= 10) risco = 'Baixo';
      else if (score <= 20) risco = 'Moderado';
      else if (score <= 30) risco = 'Alto';
      else risco = 'Muito alto';

      return {
        score,
        details: {
          'Score Neurológico': `${scoreNeuro} pontos`,
          'Score Não-Neurológico': `${scoreNaoNeuro} pontos`,
          'Score Total': `${score} pontos`,
          'Risco': risco,
          'PA Sistólica': `${pas} mmHg (${pasPontos} pontos)`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `PRISM III: ${result.details['Score Total']} - Risco ${result.details['Risco']}`;
    },
    infoBox: {
      keyPoints: [
        'Dados coletados nas primeiras 12-24h de UTI',
        '17 variaveis fisiologicas em 26 faixas',
        'Variaveis ajustadas por faixa etaria',
        'Score neurológico: Glasgow + pupilas',
        'Score nao-neurológico: demais variaveis',
        'Preditores principais: PAS, pupilas, estado mental',
      ],
      warnings: [
        'Usar pior valor de cada variável no período avaliado',
      ],
      reference: 'Pollack MM, et al. Crit Care Med. 1996 | CPCCRN PRISM III Calculator.',
    },
  },
  {
    id: 'ped_flacc',
    title: 'FLACC',
    subtitle: 'Escala de dor pediátrica',
    icon: 'Frown',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'face',
        label: 'Face',
        type: 'select',
        options: [
          { value: 0, label: 'Sem expressão ou sorriso' },
          { value: 1, label: 'Careta ocasional, retraido' },
          { value: 2, label: 'Tremor frequente do queixo, mandibula cerrada' },
        ],
      },
      {
        id: 'legs',
        label: 'Pernas',
        type: 'select',
        options: [
          { value: 0, label: 'Posição normal ou relaxadas' },
          { value: 1, label: 'Inquietas, agitadas, tensas' },
          { value: 2, label: 'Chutando ou pernas esticadas' },
        ],
      },
      {
        id: 'activity',
        label: 'Atividade',
        type: 'select',
        options: [
          { value: 0, label: 'Quieto, posição normal, move-se fácilmente' },
          { value: 1, label: 'Contorcendo-se, mudando de posição' },
          { value: 2, label: 'Arqueado, rigido ou espasmos' },
        ],
      },
      {
        id: 'cry',
        label: 'Choro',
        type: 'select',
        options: [
          { value: 0, label: 'Sem choro (acordado ou dormindo)' },
          { value: 1, label: 'Gemidos ou choramingos, queixa ocasional' },
          { value: 2, label: 'Choro constante, gritos, solucando' },
        ],
      },
      {
        id: 'consolability',
        label: 'Consolabilidade',
        type: 'select',
        options: [
          { value: 0, label: 'Contente, relaxado' },
          { value: 1, label: 'Tranquiliza com toque, abraco ou conversa' },
          { value: 2, label: 'Difícil de consolar' },
        ],
      },
    ],
    compute: (values) => {
      const face = parseInt(values.face) || 0;
      const legs = parseInt(values.legs) || 0;
      const activity = parseInt(values.activity) || 0;
      const cry = parseInt(values.cry) || 0;
      const consolability = parseInt(values.consolability) || 0;

      const score = face + legs + activity + cry + consolability;

      let intensidade = 'Sem dor';
      if (score >= 7) {
        intensidade = 'Dor intensa';
      } else if (score >= 4) {
        intensidade = 'Dor moderada';
      } else if (score >= 1) {
        intensidade = 'Dor leve';
      }

      return {
        score,
        details: {
          'Face': `${face} pontos`,
          'Pernas': `${legs} pontos`,
          'Atividade': `${activity} pontos`,
          'Choro': `${cry} pontos`,
          'Consolabilidade': `${consolability} pontos`,
          'Intensidade': intensidade,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `FLACC ${result.score}/10: ${result.details['Intensidade']}`;
    },
    infoBox: {
      keyPoints: [
        'Score 0: Sem dor - Relaxado e confortável',
        'Score 1-3: Dor leve - Desconforto leve',
        'Score 4-6: Dor moderada - Considerar analgesia',
        'Score 7-10: Dor intensa - Analgesia imediata',
        'Aplicável: 2 meses a 7 anos ou pacientes não verbais',
        'Avalia: Face, Pernas, Atividade, Choro, Consolabilidade',
      ],
      warnings: [
        'Score >= 4 indica necessidade de intervenção para alivio da dor',
      ],
      reference: 'Merkel S, et al. Pediatr Nurs. 1997 | Voepel-Lewis T, et al. Anesth Analg. 2002.',
    },
  },
  {
    id: 'ped_cheops',
    title: 'CHEOPS',
    subtitle: 'Escala de Dor Pós-Operatória Pediátrica',
    icon: 'Thermometer',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'choro',
        label: 'Choro',
        type: 'select',
        options: [
          { value: 'choro_1', label: 'Sem choro', points: 1 },
          { value: 'choro_2a', label: 'Gemido / Choramingo', points: 2 },
          { value: 'choro_2b', label: 'Choro', points: 2 },
          { value: 'choro_3', label: 'Grito', points: 3 },
        ],
      },
      {
        id: 'face',
        label: 'Expressão Facial',
        type: 'select',
        options: [
          { value: 'face_0', label: 'Sorrindo / Composta', points: 0 },
          { value: 'face_1', label: 'Expressão neutra', points: 1 },
          { value: 'face_2', label: 'Careta', points: 2 },
        ],
      },
      {
        id: 'verbal',
        label: 'Verbalização',
        type: 'select',
        options: [
          { value: 'verbal_0', label: 'Positivo (fala normal)', points: 0 },
          { value: 'verbal_1a', label: 'Nenhum / Silencio', points: 1 },
          { value: 'verbal_1b', label: 'Queixa outra (não dor)', points: 1 },
          { value: 'verbal_2a', label: 'Queixa de dor', points: 2 },
          { value: 'verbal_2b', label: 'Ambos (dor + outra)', points: 2 },
        ],
      },
      {
        id: 'tronco',
        label: 'Posição do Tronco',
        type: 'select',
        options: [
          { value: 'tronco_1', label: 'Neutro / Relaxado', points: 1 },
          { value: 'tronco_2a', label: 'Variável / Inquieto', points: 2 },
          { value: 'tronco_2b', label: 'Tenso / Rigido', points: 2 },
          { value: 'tronco_2c', label: 'Tremendo', points: 2 },
          { value: 'tronco_2d', label: 'Ereto', points: 2 },
          { value: 'tronco_2e', label: 'Contido (restringido)', points: 2 },
        ],
      },
      {
        id: 'toque',
        label: 'Toque na Ferida',
        type: 'select',
        options: [
          { value: 'toque_1', label: 'Não toca', points: 1 },
          { value: 'toque_2a', label: 'Alcanca / Estende', points: 2 },
          { value: 'toque_2b', label: 'Toca', points: 2 },
          { value: 'toque_2c', label: 'Agarra', points: 2 },
          { value: 'toque_2d', label: 'Contido (restringido)', points: 2 },
        ],
      },
      {
        id: 'pernas',
        label: 'Posição das Pernas',
        type: 'select',
        options: [
          { value: 'pernas_1', label: 'Neutras / Relaxadas', points: 1 },
          { value: 'pernas_2a', label: 'Agitando / Chutando', points: 2 },
          { value: 'pernas_2b', label: 'Dobradas / Tensas', points: 2 },
          { value: 'pernas_2c', label: 'Em pe / Ajoelhado', points: 2 },
          { value: 'pernas_2d', label: 'Contido (restringido)', points: 2 },
        ],
      },
    ],
    compute: (values) => {
      // Mapeamento de valores para pontos
      const pointsMap = {
        choro_1: 1, choro_2a: 2, choro_2b: 2, choro_3: 3,
        face_0: 0, face_1: 1, face_2: 2,
        verbal_0: 0, verbal_1a: 1, verbal_1b: 1, verbal_2a: 2, verbal_2b: 2,
        tronco_1: 1, tronco_2a: 2, tronco_2b: 2, tronco_2c: 2, tronco_2d: 2, tronco_2e: 2,
        toque_1: 1, toque_2a: 2, toque_2b: 2, toque_2c: 2, toque_2d: 2,
        pernas_1: 1, pernas_2a: 2, pernas_2b: 2, pernas_2c: 2, pernas_2d: 2,
      };

      const getPoints = (val) => (val && pointsMap[val] !== undefined ? pointsMap[val] : null);

      const choroPoints = getPoints(values.choro);
      const facePoints = getPoints(values.face);
      const verbalPoints = getPoints(values.verbal);
      const troncoPoints = getPoints(values.tronco);
      const toquePoints = getPoints(values.toque);
      const pernasPoints = getPoints(values.pernas);

      // Se nenhum campo preenchido, retorna null
      if (choroPoints === null && facePoints === null && verbalPoints === null &&
          troncoPoints === null && toquePoints === null && pernasPoints === null) {
        return null;
      }

      // Usar valores default para campos não preenchidos (score minimo por categoria)
      const score =
        (choroPoints !== null ? choroPoints : 1) +
        (facePoints !== null ? facePoints : 0) +
        (verbalPoints !== null ? verbalPoints : 0) +
        (troncoPoints !== null ? troncoPoints : 1) +
        (toquePoints !== null ? toquePoints : 1) +
        (pernasPoints !== null ? pernasPoints : 1);

      let interpretation;
      if (score < 5) {
        interpretation = 'Dor ausente ou mínima. Manter observação.';
      } else if (score < 8) {
        interpretation = 'Dor leve a moderada. Considerar analgesia.';
      } else {
        interpretation = 'Dor moderada a intensa. ANALGESIA MANDATORIA.';
      }

      return {
        score,
        maxScore: 13,
        interpretation,
        details: {
          'Choro': choroPoints !== null ? `${choroPoints} pts` : '-',
          'Face': facePoints !== null ? `${facePoints} pts` : '-',
          'Verbal': verbalPoints !== null ? `${verbalPoints} pts` : '-',
          'Tronco': troncoPoints !== null ? `${troncoPoints} pts` : '-',
          'Toque': toquePoints !== null ? `${toquePoints} pts` : '-',
          'Pernas': pernasPoints !== null ? `${pernasPoints} pts` : '-',
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      return result.interpretation;
    },
    infoBox: {
      keyPoints: [
        'Aplicável em crianças de 1-7 anos',
        'Observar por 5 segundos, pontuar em 25 segundos',
        'Score mínimo: 4 pontos (sem dor)',
        'Score máximo: 13 pontos (dor intensa)',
        '>= 5 pontos: Considerar analgesia',
        '>= 8 pontos: Analgesia OBRIGATORIA',
      ],
      reference: 'McGrath PJ et al. Anesth Analg. 1985;64(9):932-937.',
    },
  },
  {
    id: 'ped_parkland',
    title: 'Parkland Pediátrico',
    subtitle: 'Reposição Volemica em Queimados',
    icon: 'Flame',
    status: 'active',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 1, max: 100, step: 0.1 },
      { id: 'scq', label: 'Superficie Corporal Queimada (%)', type: 'number', min: 1, max: 100, step: 1 },
      { id: 'horasDesdeQueimadura', label: 'Horas desde a queimadura', type: 'number', min: 0, max: 24, step: 0.5 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      const scq = parseFloat(values.scq) || 0;
      const horasDecorridas = parseFloat(values.horasDesdeQueimadura) || 0;

      if (peso <= 0 || scq <= 0) return null;

      // Parkland: 4 mL/kg/% SCQ
      const parkland24h = 4 * peso * scq;

      // Manutenção Holliday-Segar (para < 30kg)
      let manutencao24h = 0;
      if (peso <= 10) {
        manutencao24h = peso * 100;
      } else if (peso <= 20) {
        manutencao24h = 1000 + (peso - 10) * 50;
      } else {
        manutencao24h = 1500 + (peso - 20) * 20;
      }

      // Total = Parkland + Manutenção (se < 30kg)
      const volumeTotal24h = peso < 30 ? parkland24h + manutencao24h : parkland24h;

      // Distribuicao
      const volume8h = volumeTotal24h / 2;
      const volume16h = volumeTotal24h / 2;

      // Ajuste para horas decorridas
      let horasRestantes8h = 8 - horasDecorridas;
      if (horasDecorridas >= 8) {
        horasRestantes8h = 0;
      } else if (horasDecorridas > 0) {
        horasRestantes8h = Math.max(1, 8 - horasDecorridas);
      }

      const taxaInfusao8h = horasRestantes8h > 0 ? volume8h / horasRestantes8h : 0;
      const taxaInfusao16h = volume16h / 16;

      // Diurese alvo
      const diureseAlvo = peso < 30 ? 1 * peso : 0.5 * peso;

      return {
        score: volumeTotal24h,
        details: {
          'Parkland (reposição)': `${parkland24h.toFixed(0)} mL/24h`,
          'Manutenção (Holliday-Segar)': peso < 30 ? `${manutencao24h.toFixed(0)} mL/24h` : 'Não necessário (>=30kg)',
          'Volume Total 24h': `${volumeTotal24h.toFixed(0)} mL`,
          '1a fase (8h)': `${volume8h.toFixed(0)} mL`,
          '2a fase (16h)': `${volume16h.toFixed(0)} mL`,
          'Taxa 1a fase': horasRestantes8h > 0 ? `${taxaInfusao8h.toFixed(0)} mL/h (em ${horasRestantes8h.toFixed(1)}h restantes)` : 'Fase concluída',
          'Taxa 2a fase': `${taxaInfusao16h.toFixed(0)} mL/h`,
          'Diurese alvo': `${diureseAlvo.toFixed(0)} mL/h`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Informe peso e SCQ';
      return `Volume Total 24h: ${result.score.toFixed(0)} mL`;
    },
    infoBox: {
      keyPoints: [
        'Formula: 4 mL x Peso (kg) x % SCQ',
        'Crianças < 30kg: Adicionar manutenção Holliday-Segar',
        '50% do volume nas primeiras 8h (desde a queimadura)',
        '50% restante nas proximas 16h',
        'Usar Ringer Lactato preferêncialmente',
        'Monitorar glicemia em lactentes (risco de hipoglicemia)',
        'Diurese alvo: 1 mL/kg/h (<30kg) ou 0,5 mL/kg/h (>=30kg)',
      ],
      warnings: [
        'O cálculo considera o tempo DESDE A QUEIMADURA, não desde a admissao',
      ],
      reference: 'Baxter CR, Shires T. Ann Surg. 1968. | ATLS 10th ed.',
    },
  },
  {
    id: 'ped_fluidos',
    title: 'Manutenção de Fluidos Pediátrica',
    subtitle: 'Regra 4-2-1 + Deficit + Perdas',
    icon: 'Droplets',
    status: 'active',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 0.5, max: 100, step: 0.1 },
      { id: 'jejum', label: 'Horas de jejum', type: 'number', min: 0, max: 24, step: 1 },
      {
        id: 'porteCirurgico',
        label: 'Porte cirúrgico',
        type: 'select',
        options: [
          { value: 'porte_0', label: 'Sem cirurgia (apenas manutenção)', taxa: 0 },
          { value: 'porte_2', label: 'Mínimo (2 mL/kg/h) - Ex: hernia, orquidopexia', taxa: 2 },
          { value: 'porte_4', label: 'Moderado (4 mL/kg/h) - Ex: apendicectomia', taxa: 4 },
          { value: 'porte_6', label: 'Grande (6 mL/kg/h) - Ex: laparotomia, toracotomia', taxa: 6 },
        ],
      },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      const jejum = parseFloat(values.jejum) || 0;

      // Mapeamento de porte para taxa de perdas
      const porteMap = { porte_0: 0, porte_2: 2, porte_4: 4, porte_6: 6 };
      const porteCirurgico = porteMap[values.porteCirurgico] || 0;

      if (peso <= 0) return null;

      // Manutenção 4-2-1
      let manutencaoHora;
      if (peso <= 10) {
        manutencaoHora = peso * 4;
      } else if (peso <= 20) {
        manutencaoHora = 40 + (peso - 10) * 2;
      } else {
        manutencaoHora = 60 + (peso - 20) * 1;
      }

      const manutencao24h = manutencaoHora * 24;

      // Deficit de jejum
      const deficit = manutencaoHora * jejum;

      // Reposição do deficit (esquema de Furman)
      const reposicao1h = deficit * 0.5 + manutencaoHora;
      const reposicao2h = deficit * 0.25 + manutencaoHora;
      const reposicao3h = deficit * 0.25 + manutencaoHora;

      // Perdas cirúrgicas
      const perdasHora = porteCirurgico * peso;

      // Total intraoperatório por hora (após reposicao do deficit)
      const totalIntraopHora = manutencaoHora + perdasHora;

      return {
        score: manutencaoHora,
        details: {
          'Manutenção por hora': `${manutencaoHora.toFixed(1)} mL/h`,
          'Manutenção 24h': `${manutencao24h.toFixed(0)} mL`,
          'Deficit de jejum': `${deficit.toFixed(0)} mL`,
          '1a hora (50% deficit + manut)': `${reposição1h.toFixed(0)} mL`,
          '2a hora (25% deficit + manut)': `${reposição2h.toFixed(0)} mL`,
          '3a hora (25% deficit + manut)': `${reposição3h.toFixed(0)} mL`,
          'Perdas cirúrgicas/hora': perdasHora > 0 ? `${perdasHora.toFixed(0)} mL/h` : 'N/A',
          'Total intraop/hora (após 3a h)': `${totalIntraopHora.toFixed(0)} mL/h`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Informe o peso';
      return `Manutenção: ${result.score.toFixed(1)} mL/h`;
    },
    infoBox: {
      keyPoints: [
        'Regra 4-2-1: 4 mL/kg/h (0-10kg), 2 mL/kg/h (11-20kg), 1 mL/kg/h (>20kg)',
        'Deficit = Manutenção/h x Horas de jejum',
        'Repor deficit: 50% na 1a hora, 25% na 2a e 3a horas',
        'Perdas cirúrgicas: Mínimo 2, Moderado 4, Grande 6 mL/kg/h',
        'Usar soluções balanceadas (Ringer Lactato ou Plasmalyte)',
        'Evitar soro glicosado isolado em crianças > 1 ano',
        'Monitorar glicemia, diurese (1-2 mL/kg/h) e sinais de sobrecarga',
      ],
      reference: 'Holliday MA, Segar WE. Pediatrics, 1957. | Furman EB. Anesthesiology, 1975.',
    },
  },
  {
    id: 'ped_mabl',
    title: 'MABL Pediátrico',
    subtitle: 'Perda Máxima Permitida',
    icon: 'TrendingDown',
    status: 'active',
    inputs: [
      {
        id: 'faixaEtaria',
        label: 'Faixa etaria',
        type: 'select',
        options: [
          { value: 'prematuro', label: 'Prematuro (95 mL/kg)' },
          { value: 'rn_termo', label: 'RN Termo 0-30 dias (85 mL/kg)' },
          { value: 'lactente', label: 'Lactente 1-12 meses (80 mL/kg)' },
          { value: 'crianca', label: 'Criança 1-12 anos (75 mL/kg)' },
          { value: 'adolescente', label: 'Adolescente/Adulto (70 mL/kg)' },
        ],
      },
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 0.5, max: 150, step: 0.1 },
      { id: 'hematocritoInicial', label: 'Hematocrito inicial (%)', type: 'number', min: 15, max: 65, step: 1 },
      { id: 'hematocritoMinimo', label: 'Hematocrito mínimo aceitável (%)', type: 'number', min: 15, max: 40, step: 1 },
    ],
    compute: (values) => {
      const volemiaMap = { prematuro: 95, rn_termo: 85, lactente: 80, criança: 75, adolescente: 70 };
      const volemiaPorKg = volemiaMap[values.faixaEtaria] || 75;
      const peso = parseFloat(values.peso) || 0;
      const hti = parseFloat(values.hematocritoInicial) || 0;
      const htf = parseFloat(values.hematocritoMinimo) || 25;

      if (peso <= 0 || hti <= 0 || htf <= 0 || hti <= htf) return null;

      const volemiaTotal = peso * volemiaPorKg;
      const mabl = volemiaTotal * (hti - htf) / hti;
      const percentual = (mabl / volemiaTotal) * 100;

      return {
        score: mabl,
        details: {
          'Volemia estimada': `${volemiaTotal.toFixed(0)} mL (${volemiaPorKg} mL/kg)`,
          'Perda máxima permitida': `${mabl.toFixed(0)} mL`,
          'Percentual da volemia': `${percentual.toFixed(1)}%`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `MABL: ${result.score.toFixed(0)} mL`;
    },
    infoBox: {
      keyPoints: [
        'MABL = Perda Máxima de Sangue Permitida antes de transfundir',
        'Formula: MABL = Volemia x (Hti - Htf) / Hti',
        'Volemia por idade: Prematuro 95 | RN 85 | Lactente 80 | Criança 75 | Adolescente 70 mL/kg',
        'Htf sugerido: 21-25% (equivale a Hb 7-8 g/dL)',
        'Perda < MABL: repor com cristaloide 3:1',
        'Perda > MABL: iniciar transfusão de concentrado de hemácias',
        'Calcular SEMPRE antes de cirurgias com risco de sangramento significativo',
      ],
      reference: 'OpenAnesthesia | Davies P et al. Transfusion 2007',
    },
  },
  {
    id: 'ped_transfusao',
    title: 'Transfusão Pediátrica',
    subtitle: 'Volume de CH por peso',
    icon: 'Heart',
    status: 'active',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 0.5, max: 100, step: 0.1 },
      { id: 'hbAtual', label: 'Hemoglobina atual (g/dL)', type: 'number', min: 3, max: 18, step: 0.1 },
      { id: 'hbAlvo', label: 'Hemoglobina alvo (g/dL)', type: 'number', min: 7, max: 14, step: 0.1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      const hbAtual = parseFloat(values.hbAtual) || 0;
      const hbAlvo = parseFloat(values.hbAlvo) || 10;

      if (peso <= 0 || hbAtual <= 0 || hbAlvo <= hbAtual) return null;

      // Formula Davies: Volume = (Hb alvo - Hb atual) x Peso x 3
      const volumeCalculado = (hbAlvo - hbAtual) * peso * 3;

      // Dose simplificada
      const doseSimples10 = peso * 10;
      const doseSimples15 = peso * 15;

      return {
        score: volumeCalculado,
        details: {
          'Volume calculado (formula)': `${volumeCalculado.toFixed(0)} mL`,
          'Dose 10 mL/kg': `${doseSimples10.toFixed(0)} mL (+~2 g/dL)`,
          'Dose 15 mL/kg': `${doseSimples15.toFixed(0)} mL (+~3 g/dL)`,
          'Incremento Hb esperado': `${(hbAlvo - hbAtual).toFixed(1)} g/dL`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `Volume CH: ${result.score.toFixed(0)} mL`;
    },
    infoBox: {
      keyPoints: [
        'Formula de Davies: Volume (mL) = (Hb alvo - Hb atual) x Peso x 3',
        'Dose empirica: 10 mL/kg aumenta Hb em ~2 g/dL',
        'Dose empirica: 15 mL/kg aumenta Hb em ~3 g/dL',
        'Máximo por infusão: 15 mL/kg (evitar sobrecarga)',
        'Velocidade: 2-5 mL/kg/h (paciente estável)',
        'Gatilho transfusional: Hb < 7 g/dL (estável) | Hb < 8-9 g/dL (cardiopata/instável)',
        'Controlar Hb 15 min após transfusão para verificar resposta',
      ],
      reference: 'Davies P et al. Transfusion 2007 | Texas Childrens Hospital Guidelines',
    },
  },
  {
    id: 'ped_perdas_sang',
    title: 'Perdas Sanguineas Pediátricas',
    subtitle: 'Estimativa por volemia',
    icon: 'Droplet',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'faixaEtaria',
        label: 'Faixa etaria',
        type: 'select',
        options: [
          { value: 'prematuro', label: 'Prematuro (95 mL/kg)' },
          { value: 'rn_termo', label: 'RN Termo 0-30 dias (85 mL/kg)' },
          { value: 'lactente', label: 'Lactente 1-12 meses (80 mL/kg)' },
          { value: 'crianca', label: 'Criança 1-12 anos (75 mL/kg)' },
          { value: 'adolescente', label: 'Adolescente/Adulto (70 mL/kg)' },
        ],
      },
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 0.5, max: 150, step: 0.1 },
      { id: 'perdaEstimada', label: 'Perda estimada (mL)', type: 'number', min: 0, max: 5000, step: 10 },
    ],
    compute: (values) => {
      const volemiaMap = { prematuro: 95, rn_termo: 85, lactente: 80, criança: 75, adolescente: 70 };
      const volemiaPorKg = volemiaMap[values.faixaEtaria] || 75;
      const peso = parseFloat(values.peso) || 0;
      const perdaML = parseFloat(values.perdaEstimada) || 0;

      if (peso <= 0) return null;

      const volemiaTotal = peso * volemiaPorKg;
      const percentualPerda = (perdaML / volemiaTotal) * 100;

      // Classificação da perda
      let classificacao;
      if (percentualPerda < 15) {
        classificacao = 'Classe I - Leve (<15%)';
      } else if (percentualPerda < 30) {
        classificacao = 'Classe II - Moderada (15-30%)';
      } else if (percentualPerda < 40) {
        classificacao = 'Classe III - Grave (30-40%)';
      } else {
        classificacao = 'Classe IV - Massiva (>40%)';
      }

      // Reposição sugerida
      let reposicao;
      if (percentualPerda < 15) {
        reposicao = 'Cristaloide 3:1';
      } else if (percentualPerda < 30) {
        reposicao = 'Cristaloide + considerar CH';
      } else if (percentualPerda < 40) {
        reposicao = 'CH + Cristaloide + PFC se coagulopatia';
      } else {
        reposicao = 'Protocolo Transfusão Maciça 1:1:1';
      }

      return {
        score: percentualPerda,
        details: {
          'Volemia estimada': `${volemiaTotal.toFixed(0)} mL (${volemiaPorKg} mL/kg)`,
          'Perda informada': `${perdaML.toFixed(0)} mL`,
          'Percentual da volemia': `${percentualPerda.toFixed(1)}%`,
          'Classificação': classificacao,
          'Reposição sugerida': reposicao,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `Perda: ${result.score.toFixed(1)}% da volemia`;
    },
    infoBox: {
      keyPoints: [
        'Classificação de Hemorragia Pediátrica (% volemia perdida):',
        'Classe I (<15%): Taquicardia leve, sem hipotensão - Cristaloide 3:1',
        'Classe II (15-30%): Taquicardia, pulso filiforme, palidez - Cristaloide + considerar CH',
        'Classe III (30-40%): Hipotensão, oligúria, confusão - CH obrigatório + PFC se coagulopatia',
        'Classe IV (>40%): Choque descompensado - Protocolo Transfusão Maciça 1:1:1 (CH:PFC:Plaq)',
        'Volemia por idade: Prematuro 95 | RN 85 | Lactente 80 | Criança 75 | Adolescente 70 mL/kg',
        'Monitorar: diurese 1-2 mL/kg/h, lactato, BE, Hb seriada',
      ],
      reference: 'ATLS 10th ed. | Pediatric Advanced Life Support (PALS)',
    },
  },
];

// =============================================================================
// SEÇÃO 5: EMERGÊNCIA E RESSUSCITAÇÃO - ACLS (8 calculadoras)
// =============================================================================

const aclsCalculators = [
  // Calculadora ACLS Unificada - Layout igual ao PediCalc com accordion
  {
    id: 'acls_unificado',
    title: 'ACLS / SAVA Completo',
    subtitle: 'Todas as drogas de emergência calculadas',
    icon: 'HeartPulse',
    status: 'active',
    customRender: 'acls',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 5, max: 200, step: 1, placeholder: '70' },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 70;

      if (peso <= 0) return null;

      // Cálculos baseados no peso
      let joules = 200;
      let jSubseq = 200;
      let notaDesfib = 'Adulto: Bifasico 200J / Monofasico 360J';
      if (peso < 25) {
        joules = Math.round(peso * 2);
        jSubseq = Math.round(peso * 4);
        notaDesfib = 'Pediátrico: 2 J/kg inicial, 4 J/kg subsequentes';
      }

      const bicarbMeq = Math.round(peso * 1);
      const bicarbAmp = Math.ceil(bicarbMeq / 10);
      const lidocaina = (peso * 1.5).toFixed(1);
      const gluconatoCa = Math.round(peso * 0.5);
      const emulsaoLipidica = (peso * 1.5).toFixed(0);

      // Estrutura de categorias igual ao PediCalc
      const categorias = [
        {
          key: 'desfib',
          titulo: 'Desfibrilação',
          itens: [
            {
              nome: 'CHOQUES (PCR)',
              subItens: [
                { nome: '1º Choque (Bifasico)', valor: `${joules} J`, detalhe: notaDesfib },
                { nome: 'Subsequentes (Bifasico)', valor: `${jSubseq} J`, detalhe: 'Choque → RCP 2min → Checar ritmo' },
                { nome: 'Monofasico', valor: '360 J', detalhe: 'Energia única fixa | Equipamento antigo' },
              ],
              interpretacao: 'FV/TVSP: Desfibrilar → RCP 2min → Checar ritmo. Energia máxima desde o 1º choque.',
            },
          ],
        },
        {
          key: 'pcr_drogas',
          titulo: 'Drogas PCR',
          itens: [
            { nome: 'ADRENALINA', valor: '1 mg IV/IO', detalhe: 'A cada 3-5 min | Após 2º choque (FV/TV) | Imediato (AESP/Assistolia)' },
            { nome: 'AMIODARONA 1ª dose', valor: '300 mg IV push', detalhe: 'Após 3º choque se FV/TV refrataria' },
            { nome: 'AMIODARONA 2ª dose', valor: '150 mg IV', detalhe: '3-5 min após primeira dose' },
            { nome: 'LIDOCAINA', valor: `${lidocaina} mg`, detalhe: '1.5 mg/kg - alternativa a Amiodarona' },
            { nome: 'ADENOSINA (TSV)', valor: '6mg → 12mg → 12mg', detalhe: 'Push rápido + flush' },
            { nome: 'SULFATO Mg (Torsades)', valor: '1-2g IV', detalhe: 'Em 2-5 min | Torsades de Pointes' },
            { nome: 'GLUCONATO Ca 10%', valor: `${gluconatoCa}-${peso} mL`, detalhe: '0.5-1 mL/kg | Hipercalemia, hipocalcemia' },
          ],
        },
        {
          key: 'sbv',
          titulo: 'SBV e Via Aérea',
          itens: [
            {
              nome: 'VENTILAÇÃO E VIA AÉREA',
              subItens: [
                { nome: '30:2 (sem VA)', valor: '30 compressoes : 2 vent', detalhe: '1s por insuflação | ~500mL | Sem VA avancada' },
                { nome: 'Com VA avancada', valor: '1 vent q6s (10/min)', detalhe: 'IOT/ML | Compressoes continuas' },
                { nome: 'Via Intratraqueal', valor: 'Dose = 2-2.5x IV', detalhe: 'Diluir 5-10mL SF | VALINA' },
              ],
              interpretacao: 'VALINA = Vasopressina, Adrenalina, Lidocaína, Naloxona, Atropina. Usar apenas se IV/IO indisponíveis.',
            },
          ],
        },
        {
          key: 'bicarbonato',
          titulo: 'Bicarbonato de Sódio',
          itens: [
            {
              nome: 'BICARBONATO DE SODIO 8.4%',
              warning: 'NÃO usar rotineiramente na PCR! Apenas em indicações específicas.',
              subItens: [
                { nome: 'Dose', valor: `${bicarbMeq} mEq`, detalhe: '1 mEq/kg' },
                { nome: 'Volume', valor: `${bicarbMeq} mL`, detalhe: 'NaHCO3 8.4% = 1 mEq/mL' },
                { nome: 'Ampolas', valor: `${bicarbAmp} amp`, detalhe: 'Amp 10mL' },
              ],
              interpretacao: 'Indicações específicas: Hipercalemia grave, Acidose metabólica pré-existente, Intoxicação por TCA ou Salicilatos.',
            },
          ],
        },
        {
          key: 'atropina',
          titulo: 'Atropina (Bradicardia)',
          itens: [
            {
              nome: 'ATROPINA (Bradicardia)',
              warning: 'NÃO usar na PCR! Atropina e indicada APENAS para bradicardia sintomatica.',
              subItens: [
                { nome: 'Dose', valor: '0.5-1 mg IV', detalhe: 'A cada 3-5 minutos' },
                { nome: 'Dose máxima', valor: '3 mg total', detalhe: 'Bloqueio vagal completo' },
              ],
              interpretacao: 'Se bradicardia refrataria a Atropina: iniciar Marcapasso transcutâneo.',
            },
          ],
        },
        {
          key: 'manutencao',
          titulo: 'Manutenção pós-RCE',
          itens: [
            {
              nome: 'AMIODARONA pós-RCE',
              subItens: [
                { nome: 'Fase 1', valor: '1 mg/min x 6h', detalhe: 'Início após RCE' },
                { nome: 'Fase 2', valor: '0.5 mg/min x 18h', detalhe: 'Manutenção' },
                { nome: 'Preparo', valor: '900mg em 500mL SG5%', detalhe: '1.8 mg/mL' },
              ],
              interpretacao: 'Iniciar se usou Amiodarona durante PCR. Dose total 24h: ~1.2g. Monitorar QT.',
            },
          ],
        },
        {
          key: 'anafilaxia',
          titulo: 'Anafilaxia',
          itens: [
            {
              nome: 'ADRENALINA (por gravidade)',
              subItens: [
                { nome: 'Grau 2 (leve)', valor: '10-20 mcg IV', detalhe: 'Bolus a cada 1-2 min | Urticaria + hipotensão leve' },
                { nome: 'Grau 3 (grave)', valor: '100-200 mcg IV', detalhe: 'Bolus a cada 1-2 min | Choque, broncoespasmo grave' },
                { nome: 'Infusão continua', valor: '0.05-0.1 mcg/kg/min', detalhe: 'Se refratario a bolus | Titular conforme resposta' },
              ],
              interpretacao: 'Grau 2: leve. Grau 3: choque. Sem resposta em 2-3 doses: iniciar infusão.',
            },
            {
              nome: 'ADJUVANTES',
              subItens: [
                { nome: 'Difenidramina', valor: `${Math.round(peso*0.5)}-${peso} mg IV`, detalhe: '0.5-1 mg/kg | Anti-H1' },
                { nome: 'Ranitidina', valor: '50 mg IV', detalhe: 'Anti-H2 | Dose fixa adulto' },
                { nome: 'Hidrocortisona', valor: '250 mg IV', detalhe: 'ou Metilprednisolona 80 mg | Previne fase tardia' },
              ],
              interpretacao: 'Anti-H1 + Anti-H2 + Corticoide. Corticoide previne fase tardia (4-8h).',
            },
            { nome: 'NEBULIZACAO Adrenalina', valor: '5 mL (1:1000)', detalhe: 'Broncoespasmo | Adrenalina 1mg/mL pura' },
            { nome: 'GLUCAGON (refratario)', valor: '5-15 mcg/min', detalhe: 'Choque refratario em uso de beta-bloqueador' },
          ],
        },
        {
          key: 'vasoativas',
          titulo: 'Drogas Vasoativas',
          itens: [
            {
              nome: 'NORADRENALINA',
              subItens: [
                { nome: 'Dose', valor: '0.05-0.5 mcg/kg/min', detalhe: '1ª linha sepse' },
                { nome: 'Diluicao', valor: '4mg/250mL', detalhe: '16 mcg/mL' },
                { nome: 'Resultado', valor: `${((0.1*peso*60)/16).toFixed(1)} - ${((0.3*peso*60)/16).toFixed(1)} mL/h`, detalhe: 'Faixa tipica (0.1-0.3 mcg/kg/min)' },
              ],
            },
            {
              nome: 'ADRENALINA infusão',
              subItens: [
                { nome: 'Dose', valor: '0.01-0.5 mcg/kg/min', detalhe: 'Anafilaxia, choque' },
                { nome: 'Diluicao', valor: '4mg/250mL', detalhe: '16 mcg/mL' },
                { nome: 'Resultado', valor: `${((0.05*peso*60)/16).toFixed(1)} - ${((0.2*peso*60)/16).toFixed(1)} mL/h`, detalhe: 'Faixa tipica (0.05-0.2 mcg/kg/min)' },
              ],
            },
            {
              nome: 'DOPAMINA',
              subItens: [
                { nome: 'Dose', valor: '2-20 mcg/kg/min', detalhe: '2-5 renal, 5-10 beta, >10 alfa' },
                { nome: 'Diluicao', valor: '400mg/250mL', detalhe: '1600 mcg/mL' },
                { nome: 'Resultado', valor: `${((5*peso*60)/1600).toFixed(1)} - ${((10*peso*60)/1600).toFixed(1)} mL/h`, detalhe: 'Faixa tipica (5-10 mcg/kg/min)' },
              ],
            },
            {
              nome: 'DOBUTAMINA',
              subItens: [
                { nome: 'Dose', valor: '2-20 mcg/kg/min', detalhe: 'IC, choque cardiogenico' },
                { nome: 'Diluicao', valor: '250mg/250mL', detalhe: '1000 mcg/mL' },
                { nome: 'Resultado', valor: `${((5*peso*60)/1000).toFixed(1)} - ${((10*peso*60)/1000).toFixed(1)} mL/h`, detalhe: 'Faixa tipica (5-10 mcg/kg/min)' },
              ],
            },
            { nome: 'VASOPRESSINA', valor: '0.03-0.04 U/min', detalhe: '40U/100mL | Dose fixa, adjuvante a Nora' },
            {
              nome: 'FENILEFRINA',
              subItens: [
                { nome: 'Dose', valor: '0.5-5 mcg/kg/min', detalhe: 'Alfa puro, vasoconstritor' },
                { nome: 'Diluicao', valor: '10mg/250mL', detalhe: '40 mcg/mL' },
                { nome: 'Resultado', valor: `${((1*peso*60)/40).toFixed(1)} - ${((2*peso*60)/40).toFixed(1)} mL/h`, detalhe: 'Faixa tipica (1-2 mcg/kg/min)' },
              ],
            },
            {
              nome: 'MILRINONA',
              subItens: [
                { nome: 'Dose', valor: '0.375-0.75 mcg/kg/min', detalhe: 'Inodilatador, IC refrataria' },
                { nome: 'Diluicao', valor: '20mg/100mL', detalhe: '200 mcg/mL' },
                { nome: 'Resultado', valor: `${((0.5*peso*60)/200).toFixed(2)} mL/h`, detalhe: 'Dose media (0.5 mcg/kg/min)' },
              ],
            },
          ],
        },
        {
          key: 'antidotos',
          titulo: 'Antídotos e LAST',
          itens: [
            {
              nome: 'EMULSAO LIPIDICA 20% (LAST)',
              warning: 'Dose máxima total: 12 mL/kg. Não exceder mesmo em PCR refrataria.',
              subItens: [
                { nome: 'Bolus', valor: peso >= 70 ? '100 mL' : `${emulsaoLipidica} mL`, detalhe: peso >= 70 ? '1.5 mL/kg em 2-3 min | >70kg: 100mL fixo' : '1.5 mL/kg em 2-3 min | Intox anest local' },
                { nome: 'Infusão', valor: `${(peso*0.25).toFixed(1)} mL/min`, detalhe: '0.25 mL/kg/min x 15-20 min' },
                { nome: 'Se instável', valor: 'Repetir bolus 1-2x', detalhe: 'Dobrar infusão se necessário' },
              ],
              interpretacao: 'Iniciar imediatamente ao suspeitar de intoxicação por anestésico local. Se PCR: manter bolus/infusão durante RCP.',
            },
            {
              nome: 'NALOXONA (Opioides)',
              subItens: [
                { nome: 'IV titulada', valor: '0.04-0.4 mg', detalhe: 'Iniciar 0.04 mg | Escalonar q2-3 min | Max 2-10 mg' },
                { nome: 'Intranasal', valor: '2 mg', detalhe: 'Repetir em 3-5 min se necessário | Narcan spray' },
              ],
              interpretacao: 'Titular para reverter depressão respiratória sem precipitar síndrome de abstinência aguda.',
            },
            { nome: 'GLUCAGON', valor: '3-10 mg IV', detalhe: 'Intox beta-bloq/bloq Ca | Infusão 3-5 mg/h', interpretacao: 'Primeira linha em intoxicação por beta-bloqueadores. Pode causar náuseas.' },
            { nome: 'INSULINA (HIET)', valor: `${peso} U bolus`, detalhe: '1 U/kg + Glicose 50% 25g | Intox bloq Ca grave', interpretacao: 'Terapia com alta dose de insulina para intox grave por bloq Ca. Monitorar glicemia rigorosamente.' },
            { nome: 'FLUMAZENIL', valor: '0.2-1 mg IV', detalhe: 'Intox BZD | Max 3-5 mg', warning: 'CONTRAINDICADO em uso crônico de BZD! Risco de convulsões.', interpretacao: 'Meia-vida curta - pode haver ressedação. Observar por 2h após.' },
            { nome: 'SUGAMMADEX', valor: `${Math.round(peso*16)} mg`, detalhe: '16 mg/kg | Reversão imediata rocuronio | Emergência VA' },
            { nome: 'NEOSTIGMINA', valor: `${(peso*0.05).toFixed(2)} mg`, detalhe: '0.04-0.07 mg/kg + Atropina 0.02 mg/kg' },
          ],
        },
        {
          key: 'tci_sedacao',
          titulo: 'TCI e Sedação',
          itens: [
            { nome: 'PROPOFOL TCI', valor: 'Ce 2-4 mcg/mL', detalhe: 'Marsh/Schnider | Indução 4-6, Manut 2-4' },
            { nome: 'REMIFENTANIL TCI', valor: 'Ce 2-6 ng/mL', detalhe: 'Minto | Analgesia 2-4, Intubação 4-8' },
            {
              nome: 'PROPOFOL bolus',
              subItens: [
                { nome: 'Dose', valor: '1-2.5 mg/kg', detalhe: 'Indução anestésica' },
                { nome: 'Min', valor: `${peso} mg`, detalhe: '1 mg/kg' },
                { nome: 'Max', valor: `${Math.round(peso*2.5)} mg`, detalhe: '2.5 mg/kg' },
              ],
            },
            {
              nome: 'FENTANIL bolus',
              subItens: [
                { nome: 'Dose', valor: '1-2 mcg/kg', detalhe: 'Analgesia' },
                { nome: 'Min', valor: `${peso} mcg`, detalhe: '1 mcg/kg' },
                { nome: 'Max', valor: `${peso*2} mcg`, detalhe: '2 mcg/kg' },
              ],
            },
            {
              nome: 'MIDAZOLAM bolus',
              subItens: [
                { nome: 'Dose', valor: '0.01-0.05 mg/kg', detalhe: 'Sedação' },
                { nome: 'Min', valor: `${(peso*0.01).toFixed(1)} mg`, detalhe: '0.01 mg/kg' },
                { nome: 'Max', valor: `${(peso*0.05).toFixed(1)} mg`, detalhe: '0.05 mg/kg' },
              ],
            },
            {
              nome: 'CETAMINA bolus',
              subItens: [
                { nome: 'Dose', valor: '0.5-2 mg/kg', detalhe: 'Indução dissociativa' },
                { nome: 'Min', valor: `${Math.round(peso*0.5)} mg`, detalhe: '0.5 mg/kg' },
                { nome: 'Max', valor: `${peso*2} mg`, detalhe: '2 mg/kg' },
              ],
            },
            { nome: 'DEXMEDETOMIDINA', valor: '0.2-1.4 mcg/kg/h', detalhe: '200mcg/50mL | Sedação sem depressão resp' },
          ],
        },
        {
          key: 'hipertermia_maligna',
          titulo: 'Hipertermia Maligna',
          itens: [
            {
              nome: 'DANTROLENE',
              warning: 'NUNCA usar bloqueadores de canal de cálcio junto com Dantrolene! Risco de colapso cardiovascular.',
              subItens: [
                { nome: 'Dose inicial', valor: `${Math.round(peso*2.5)} mg`, detalhe: '2.5 mg/kg | Repetir q10min até controle' },
                { nome: 'Frascos necessários', valor: `${Math.ceil((peso*2.5)/20)} frascos`, detalhe: 'Frasco = 20 mg + 3g manitol | Reconstituir 60 mL AD' },
                { nome: 'Manutenção', valor: `${peso} mg q4-6h`, detalhe: '1 mg/kg a cada 4-6h por ≥36h | Prevenir recorrência' },
              ],
              interpretacao: 'Único tratamento específico para HM. NÃO esperar confirmação diagnóstica para iniciar - o tempo e crucial.',
            },
            {
              nome: 'HIPERCALEMIA (tratamento)',
              warning: 'EVITAR Verapamil e Diltiazem na HM! Usar apenas Cálcio para estabilização.',
              subItens: [
                { nome: 'Cloreto Ca 10%', valor: `${Math.round(peso*10)} mg`, detalhe: '10 mg/kg | ou Gluconato 30 mg/kg' },
                { nome: 'Insulina + Glicose', valor: '10 U + 50 mL G50%', detalhe: 'Repetir se K+ persistir' },
              ],
              interpretacao: 'Cálcio estabiliza membrana cardíaca. Insulina promove shift intracelular de K+.',
            },
            { nome: 'BICARBONATO', valor: `${Math.round(peso*1)}-${Math.round(peso*2)} mEq`, detalhe: '1-2 mEq/kg | Acidose metabólica', interpretacao: 'Tratar acidose metabólica intensa. Guiar por gasometria.' },
            { nome: 'O2 alto fluxo', valor: '10-15 L/min', detalhe: 'FiO2 100% | Hiperventilação | Remover agentes halo', interpretacao: 'Suspender imediatamente todos os agentes halogenados. Trocar circuito se possível.' },
          ],
        },
        {
          key: 'arritmias_controle',
          titulo: 'Arritmias - Controle FC',
          itens: [
            { nome: 'DILTIAZEM', valor: `${(peso*0.25).toFixed(1)} mg`, detalhe: '0.25 mg/kg em 2 min | FA, Flutter, TSV | Manut 5-15 mg/h' },
            { nome: 'VERAPAMIL', valor: `${(peso*0.1).toFixed(1)} mg`, detalhe: '0.075-0.15 mg/kg em 2 min | TSV, FA | CI: IC, WPW' },
            { nome: 'ESMOLOL', valor: `${(peso*0.5).toFixed(0)} mg bolus`, detalhe: '0.5 mg/kg | Infusão 0.05-0.3 mg/kg/min | Ultra-curta ação' },
            { nome: 'METOPROLOL', valor: '1-5 mg IV', detalhe: 'Bolus 1 mg, repetir q5min | Max 10-15 mg' },
            { nome: 'AMIODARONA controle', valor: '150 mg em 10 min', detalhe: 'FA refrataria | Manut 1 mg/min x 6h' },
            { nome: 'DIGOXINA', valor: '0.25-0.5 mg IV', detalhe: 'Controle FA | Início lento (2-6h) | Dose total 1 mg/24h' },
          ],
        },
        {
          key: 'cardioversao',
          titulo: 'Cardioversão',
          itens: [
            { nome: 'TV MONOMORFICA estável', valor: '100 J sincronizado', detalhe: 'QRS largo regular | Escalonar 150→200 J se falhar', interpretacao: 'SEMPRE usar modo SINCRONIZADO em paciente estável.' },
            { nome: 'TV POLIMORFICA/FV', valor: '200 J NÃO sincronizado', detalhe: 'QRS largo irregular', warning: 'NÃO sincronizar! Tratar como FV - desfibrilação imediata.' },
            { nome: 'FA/FLUTTER', valor: '120-200 J sincronizado', detalhe: 'Bifasico | Iniciar 150 J', interpretacao: 'Sedar paciente antes da cardioversão. Considerar anticoagulação se FA >48h.' },
            { nome: 'TSV estável', valor: '50-100 J sincronizado', detalhe: 'Se Adenosina/Manobra vagal falhar', interpretacao: 'Tentar Adenosina e manobras vagais antes da cardioversão.' },
            { nome: 'SEDAÇÃO pré-CV', valor: `${(peso*1.5).toFixed(0)} mg Propofol`, detalhe: '1-2 mg/kg | ou Etomidato 0.2-0.3 mg/kg', interpretacao: 'Obrigatório em paciente consciente. Manter via aérea pronta.' },
            { nome: 'ALERTA Instável', valor: 'CV IMEDIATA', detalhe: 'Hipotensão, dor torácica, alteração consciência, ICC', warning: 'Paciente instável: NÃO esperar - cardioversão imediata!' },
          ],
        },
      ];

      const totalItens = categorias.reduce((acc, cat) => acc + cat.itens.length, 0);

      return {
        score: peso,
        categorias,
        totalItens,
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Informe o peso do paciente';
      return `Paciente ${result.score} kg - ${result.totalItens} itens calculados`;
    },
    // InfoBox removido - informacoes individualizadas em cada card de médicação
  },
  // Reversores (Naloxona / Flumazenil / Sugammadex)
  {
    id: 'acls_reversores',
    title: 'Reversores',
    subtitle: 'Naloxona/Flumazenil/Sugammadex',
    icon: 'RotateCcw',
    status: 'active',
    useDropdown: true,
    customRender: 'reversores',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 30, max: 200, step: 1 },
      {
        id: 'reversor',
        label: 'Reversor',
        type: 'select',
        options: [
          { value: 'naloxona', label: 'Naloxona (opioides)' },
          { value: 'flumazenil', label: 'Flumazenil (benzodiazepinicos)' },
          { value: 'sugammadex_mod', label: 'Sugammadex - Moderado (TOF 2+)' },
          { value: 'sugammadex_prof', label: 'Sugammadex - Profundo (PTC 1-2)' },
          { value: 'sugammadex_imed', label: 'Sugammadex - Imediato (emergência)' },
        ],
      },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 70;
      const reversor = values.reversor || 'naloxona';

      if (peso <= 0) return null;

      let dose = '';
      let doseCalculada = '';
      let intervalo = '';
      let maximo = '';
      let observacao = '';

      if (reversor === 'naloxona') {
        dose = '0.04-0.4 mg IV';
        doseCalculada = 'Titular (iniciar 0.04 mg)';
        intervalo = 'A cada 2-3 min';
        maximo = '2 mg total';
        observacao = 'Titular para evitar abstinência/dor súbita';
      } else if (reversor === 'flumazenil') {
        dose = '0.1-0.2 mg IV';
        doseCalculada = '0.2 mg inicial';
        intervalo = 'A cada 1 min';
        maximo = '1 mg total';
        observacao = 'CI em uso crônico BZD (risco convulsões)';
      } else if (reversor === 'sugammadex_mod') {
        const doseMg = Math.round(peso * 2);
        dose = '2 mg/kg';
        doseCalculada = `${doseMg} mg`;
        intervalo = 'Dose única';
        maximo = '-';
        observacao = 'TOF ≥ 2 respostas';
      } else if (reversor === 'sugammadex_prof') {
        const doseMg = Math.round(peso * 4);
        dose = '4 mg/kg';
        doseCalculada = `${doseMg} mg`;
        intervalo = 'Dose única';
        maximo = '-';
        observacao = 'PTC 1-2 ou bloqueio profundo';
      } else {
        const doseMg = Math.round(peso * 16);
        dose = '16 mg/kg';
        doseCalculada = `${doseMg} mg`;
        intervalo = 'Dose única IMEDIATA';
        maximo = '-';
        observacao = '"Cant intubate, cant ventilate" - EMERGENCIA';
      }

      return {
        score: null,
        details: {
          'Dose padrão': dose,
          'Dose calculada': doseCalculada,
          'Intervalo': intervalo,
          'Dose máxima': maximo,
          'Observação': observacao,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      return `Dose: ${result.details['Dose calculada']}`;
    },
    infoBox: {
      keyPoints: [
        'Naloxona: titular para evitar abstinência/dor súbita',
        'Flumazenil: CI em uso crônico BZD (convulsões)',
        'Sugammadex: específico para rocuronio/vecuronio',
        'Sugammadex 16 mg/kg: emergência "cant intubate, cant ventilate"',
        'Neostigmina: alternativa classica BNM (nao-seletiva)',
        'Flumazenil t1/2 curto: pode haver ressedação',
      ],
      reference: 'Miller Anesthesia | UpToDate 2024 | FDA Bridion',
    },
  },
];

// =============================================================================
// SEÇÃO 6: HEMODINÂMICA, FLUIDOS E SANGUE (9 calculadoras)
// =============================================================================

const hemoCalculators = [
  {
    id: 'hemo_deficit',
    title: 'Deficit Hidrico',
    subtitle: 'Regra 4-2-1 + jejum',
    icon: 'Droplet',
    status: 'active',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 1, max: 200, step: 0.1 },
      { id: 'jejum', label: 'Tempo de jejum (horas)', type: 'number', min: 0, max: 24, step: 1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      const jejum = parseFloat(values.jejum) || 0;

      if (peso <= 0 || jejum < 0) return null;

      // Regra 4-2-1 (Holliday-Segar): mL/hora
      let manutencao = 0;
      if (peso <= 10) {
        manutencao = peso * 4;
      } else if (peso <= 20) {
        manutencao = 40 + (peso - 10) * 2;
      } else {
        manutencao = 60 + (peso - 20) * 1;
      }

      // Deficit = manutencao × horas de jejum
      const deficit = manutencao * jejum;

      // Reposição classica: 50% na 1a hora, 25% na 2a, 25% na 3a
      const repo1h = deficit * 0.5;
      const repo2h = deficit * 0.25;
      const repo3h = deficit * 0.25;

      return {
        score: deficit,
        details: {
          'Manutenção (4-2-1)': `${manutencao.toFixed(1)} mL/h`,
          'Deficit total': `${deficit.toFixed(0)} mL`,
          '1a hora (50%)': `${repo1h.toFixed(0)} mL`,
          '2a hora (25%)': `${repo2h.toFixed(0)} mL`,
          '3a hora (25%)': `${repo3h.toFixed(0)} mL`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha peso e tempo de jejum';
      return `Deficit: ${result.score.toFixed(0)} mL`;
    },
    infoBox: {
      keyPoints: [
        'Regra 4-2-1: 4mL/kg/h (0-10kg) + 2mL/kg/h (10-20kg) + 1mL/kg/h (>20kg)',
        'Deficit = Manutenção × Horas de jejum',
        'Reposição classica: 50% 1a hora, 25% 2a hora, 25% 3a hora',
        'ASA permite líquidos claros até 2h antes - considerar no cálculo',
      ],
      reference: 'Holliday MA, Segar WE. Pediatrics 1957 | ASA Fasting Guidelines',
    },
  },
  {
    id: 'hemo_holliday',
    title: 'Holliday-Segar',
    subtitle: 'Manutenção',
    icon: 'Droplet',
    status: 'active',
    customRender: 'hollidaySegar',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 1, max: 200, step: 0.1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      if (peso === 0) return null;
      let manutencao = 0;
      if (peso <= 10) manutencao = peso * 4;
      else if (peso <= 20) manutencao = 40 + (peso - 10) * 2;
      else manutencao = 60 + (peso - 20) * 1;
      return {
        score: manutencao,
        details: { mlHora: manutencao, ml24h: manutencao * 24 },
      };
    },
    resultMessage: (result) => {
      if (!result.details) return 'Informe o peso';
      return `Manutenção: ${result.details.mlHora.toFixed(1)} mL/h (${result.details.ml24h.toFixed(0)} mL/24h)`;
    },
    infoBox: {
      keyPoints: [
        'Regra 4-2-1: 4mL/kg/h (0-10kg) + 2mL/kg/h (10-20kg) + 1mL/kg/h (>20kg)',
        'Calcula necessidade de manutenção hidrica em 24h',
        'Não inclui perdas insensiveis extras (febre, taquipneia)',
        'Para crianças <30kg, usar peso real; >30kg, considerar peso ideal',
      ],
      reference: 'Holliday MA, Segar WE. Pediatrics 1957',
    },
  },
  {
    id: 'hemo_perdas_atls',
    title: 'Perdas Sanguineas (ATLS)',
    subtitle: 'Classes I-IV',
    icon: 'Droplet',
    status: 'active',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 1, max: 200, step: 0.1 },
      { id: 'fc', label: 'FC (bpm)', type: 'number', min: 30, max: 220, step: 1 },
      { id: 'pas', label: 'PAS (mmHg)', type: 'number', min: 40, max: 250, step: 1 },
      { id: 'fr', label: 'FR (irpm)', type: 'number', min: 8, max: 50, step: 1 },
      { id: 'diurese', label: 'Diurese (mL/h)', type: 'number', min: 0, max: 200, step: 1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 70;
      const fc = parseFloat(values.fc) || 0;
      const pas = parseFloat(values.pas) || 120;
      const fr = parseFloat(values.fr) || 16;
      const diurese = parseFloat(values.diurese) || 30;

      if (peso <= 0) return null;

      // Volemia estimada: 70 mL/kg para adultos
      const volemia = peso * 70;

      // Classificação ATLS baseada em critérios clínicos
      // Classe IV: FC > 140, PAS muito baixa, FR > 35, diurese desprezível
      // Classe III: FC 120-140, PAS diminuida, FR 30-40, diurese 5-15
      // Classe II: FC 100-120, PAS normal, FR 20-30, diurese 20-30
      // Classe I: FC < 100, PAS normal, FR 14-20, diurese > 30

      let classe = 1;
      let pontos = 0;

      // Sistema de pontuação para classificacao mais precisa
      // FC
      if (fc > 140) pontos += 4;
      else if (fc > 120) pontos += 3;
      else if (fc > 100) pontos += 2;
      else if (fc > 80) pontos += 0;

      // PAS
      if (pas < 70) pontos += 4;
      else if (pas < 90) pontos += 3;
      else if (pas < 100) pontos += 2;
      else pontos += 0;

      // FR
      if (fr > 35) pontos += 4;
      else if (fr > 30) pontos += 3;
      else if (fr > 20) pontos += 2;
      else if (fr > 14) pontos += 0;

      // Diurese
      if (diurese < 5) pontos += 4;
      else if (diurese < 15) pontos += 3;
      else if (diurese < 30) pontos += 2;
      else pontos += 0;

      // Determinar classe baseado na pontuação
      if (pontos >= 12) classe = 4;
      else if (pontos >= 8) classe = 3;
      else if (pontos >= 4) classe = 2;
      else classe = 1;

      // Perda estimada por classe (valores medios)
      const perdasPercent = { 1: 15, 2: 25, 3: 35, 4: 45 };
      const perdasML = { 1: 750, 2: 1500, 3: 2000, 4: 2500 };
      const perdaPercent = perdasPercent[classe];
      const perdaEstimada = volemia * (perdaPercent / 100);

      // Conduta por classe
      const conduta = {
        1: 'Cristaloide',
        2: 'Cristaloide',
        3: 'Cristaloide + Sangue',
        4: 'Cristaloide + Sangue + Protocolo Transfusão Maciça',
      };

      return {
        score: classe,
        details: {
          'Classe ATLS': `Classe ${classe}`,
          'Perda estimada': `${perdaPercent}% (~${perdaEstimada.toFixed(0)} mL)`,
          'Volume máximo': `ate ${perdasML[classe]} mL`,
          'Volemia calculada': `${volemia.toFixed(0)} mL (70mL/kg)`,
          'Conduta': conduta[classe],
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os dados clínicos';
      return `Classe ${result.score} ATLS - ${result.details['Perda estimada']}`;
    },
    infoBox: {
      keyPoints: [
        'Classe I: <15% (ate 750mL) - FC<100, PA normal, FR 14-20',
        'Classe II: 15-30% (750-1500mL) - FC 100-120, PA normal, FR 20-30',
        'Classe III: 30-40% (1500-2000mL) - FC 120-140, PA baixa, FR 30-40',
        'Classe IV: >40% (>2000mL) - FC>140, PA muito baixa, FR>35',
        'Classes III-IV: Iniciar hemotransfusão',
      ],
      reference: 'ATLS 10th Edition - American College of Surgeons',
    },
  },
  {
    id: 'hemo_shock_index',
    title: 'Índice de Choque',
    subtitle: 'FC/PAS (Allgower)',
    icon: 'Activity',
    status: 'active',
    inputs: [
      { id: 'fc', label: 'FC (bpm)', type: 'number', min: 30, max: 220, step: 1 },
      { id: 'pas', label: 'PAS (mmHg)', type: 'number', min: 40, max: 250, step: 1 },
    ],
    compute: (values) => {
      const fc = parseFloat(values.fc) || 0;
      const pas = parseFloat(values.pas) || 0;

      if (fc <= 0 || pas <= 0) return null;

      // Índice de Choque = FC / PAS
      const indice = fc / pas;

      // Interpretação baseada em evidências
      // Normal: 0.5-0.7
      // Elevado: 0.7-0.9
      // Choque leve: 0.9-1.0
      // Choque moderado: 1.0-1.4
      // Choque grave: >= 1.4

      let interpretacao = '';
      let risk = 'baixo';
      let conduta = '';

      if (indice < 0.5) {
        interpretacao = 'Abaixo do normal';
        risk = 'baixo';
        conduta = 'Verificar bradicardia ou hipertensao';
      } else if (indice <= 0.7) {
        interpretacao = 'Normal';
        risk = 'baixo';
        conduta = 'Sem intervenção necessária';
      } else if (indice <= 0.9) {
        interpretacao = 'Elevado';
        risk = 'medio';
        conduta = 'Monitorar - risco aumentado';
      } else if (indice < 1.0) {
        interpretacao = 'Choque compensado';
        risk = 'alto';
        conduta = 'Ressuscitação volemica';
      } else if (indice < 1.4) {
        interpretacao = 'Choque descompensado';
        risk = 'alto';
        conduta = 'Ressuscitação agressiva + considerar sangue';
      } else {
        interpretacao = 'Choque grave';
        risk = 'critico';
        conduta = 'Ressuscitação imediata + Protocolo Transfusão Maciça';
      }

      return {
        score: indice,
        details: {
          'Índice de Choque': indice.toFixed(2),
          'Interpretação': interpretacao,
          'FC': `${fc} bpm`,
          'PAS': `${pas} mmHg`,
          'Conduta': conduta,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha FC e PAS';
      return `IC ${result.score.toFixed(2)} - ${result.details['Interpretação']}`;
    },
    infoBox: {
      keyPoints: [
        'IC = FC / PAS (Índice de Allgower, 1967)',
        'Normal: 0.5-0.7',
        'IC > 0.9: Risco 3x maior de mortalidade',
        'IC >= 1.0: Indica necessidade de transfusão',
        'Util mesmo com sinais vitais "normais" isoladamente',
      ],
      reference: 'Allgower M, Burri C. 1967 | Trauma Registry Studies',
    },
  },
  {
    id: 'hemo_cristaloide',
    title: 'Reposição com Cristaloide',
    subtitle: 'Regra 3:1',
    icon: 'Beaker',
    status: 'active',
    inputs: [
      { id: 'perda', label: 'Perda sanguinea estimada (mL)', type: 'number', min: 0, max: 5000, step: 50 },
    ],
    compute: (values) => {
      const perda = parseFloat(values.perda) || 0;
      if (perda <= 0) return null;

      const cristaloide = perda * 3;

      return {
        score: cristaloide,
        details: {
          'Perda estimada': `${perda.toFixed(0)} mL`,
          'Cristaloide (3:1)': `${cristaloide.toFixed(0)} mL`,
          'Orientação': 'Ringer Lactato ou SF 0,9%',
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Informe a perda estimada';
      return `Repor ${result.score.toFixed(0)} mL de cristaloide`;
    },
    infoBox: {
      keyPoints: [
        'Regra 3:1: Para cada 1mL de sangue perdido, repor 3mL de cristaloide',
        'Cristaloides: Ringer Lactato (preferido) ou SF 0,9%',
        'Reavaliar após cada 1-2L de cristaloide',
        'Se instabilidade persistir: considerar hemotransfusão',
      ],
      warnings: [
        'Regra 3:1 e aproximação inicial - guiar por resposta clínica',
      ],
      reference: 'ATLS 10th Edition - American College of Surgeons',
    },
  },
  {
    id: 'hemo_parkland',
    title: 'Formula de Parkland',
    subtitle: 'Ressuscitação em Queimados',
    icon: 'Flame',
    status: 'active',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 1, max: 200, step: 0.1 },
      { id: 'scq', label: 'SCQ - Superficie Corporal Queimada (%)', type: 'number', min: 1, max: 100, step: 1 },
      { id: 'horas', label: 'Horas desde a queimadura', type: 'number', min: 0, max: 24, step: 0.5 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      const scq = parseFloat(values.scq) || 0;
      const horas = parseFloat(values.horas) || 0;

      if (peso <= 0 || scq <= 0) return null;

      // Formula de Parkland: 4mL x peso x %SCQ
      const volume24h = 4 * peso * scq;
      const volume8h = volume24h * 0.5;  // 50% primeiras 8h
      const volume16h = volume24h * 0.5; // 50% proximas 16h

      // Taxa horaria para primeiras 8h
      const taxaHora8h = volume8h / 8;
      // Taxa horaria para proximas 16h
      const taxaHora16h = volume16h / 16;

      // Ajustar se informou horas desde queimadura
      let info8h = `${volume8h.toFixed(0)} mL (${taxaHora8h.toFixed(0)} mL/h)`;
      if (horas > 0 && horas < 8) {
        const horasRestantes = 8 - horas;
        const volumeRestante = taxaHora8h * horasRestantes;
        info8h = `${volumeRestante.toFixed(0)} mL em ${horasRestantes.toFixed(1)}h restantes (${taxaHora8h.toFixed(0)} mL/h)`;
      } else if (horas >= 8) {
        info8h = 'Período de 8h concluido';
      }

      return {
        score: volume24h,
        details: {
          'Volume total 24h': `${volume24h.toFixed(0)} mL`,
          'Primeiras 8h (50%)': info8h,
          'Proximas 16h (50%)': `${volume16h.toFixed(0)} mL (${taxaHora16h.toFixed(0)} mL/h)`,
          'Fluido': 'Ringer Lactato',
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha peso e SCQ';
      return `Parkland: ${result.score.toFixed(0)} mL em 24h`;
    },
    infoBox: {
      keyPoints: [
        'Formula: 4mL x Peso (kg) x %SCQ',
        '50% nas primeiras 8h DESDE A QUEIMADURA (não da admissao)',
        '50% nas proximas 16h',
        'Usar Ringer Lactato preferêncialmente',
        'Meta: Diurese 0,5-1 mL/kg/h (adulto) ou 1 mL/kg/h (criança)',
      ],
      warnings: [
        'Formula e estimativa inicial - ajustar por diurese e resposta clínica',
      ],
      reference: 'Baxter CR, Shires T. Ann Surg 1968 | ABA Guidelines 2019',
    },
  },
  {
    id: 'hemo_mabl',
    title: 'MABL Adulto',
    subtitle: 'Perda Máxima Permitida',
    icon: 'TrendingDown',
    status: 'active',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 1, max: 200, step: 0.1 },
      { id: 'hto_inicial', label: 'Hto inicial (%)', type: 'number', min: 10, max: 60, step: 1 },
      { id: 'hto_minimo', label: 'Hto mínimo aceitável (%)', type: 'number', min: 15, max: 40, step: 1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      const htoInicial = parseFloat(values.hto_inicial) || 0;
      const htoMinimo = parseFloat(values.hto_minimo) || 0;

      if (peso === 0 || htoInicial === 0 || htoMinimo === 0) return null;

      // Volemia estimada: 70 mL/kg para adultos
      const volemia = peso * 70;

      // Formula MABL classica: EBV x (Hi - Hf) / Hi
      // Onde Hi = Hto inicial e Hf = Hto minimo aceitável
      const mabl = volemia * (htoInicial - htoMinimo) / htoInicial;

      return {
        score: mabl,
        details: {
          'Volemia estimada': `${volemia.toFixed(0)} mL`,
          'Hto inicial': `${htoInicial}%`,
          'Hto mínimo': `${htoMínimo}%`,
          'MABL': `${mabl.toFixed(0)} mL`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result || !result.details) return 'Informe os dados';
      return `MABL: ${result.score.toFixed(0)} mL (Volemia: ${result.details['Volemia estimada']})`;
    },
    infoBox: {
      keyPoints: [
        'MABL = Maximum Allowable Blood Loss (Perda Sanguinea Máxima Permitida)',
        'Formula: EBV x (Hi - Hf) / Hi',
        'EBV = Volemia estimada (70 mL/kg para adultos)',
        'Hi = Hematocrito inicial',
        'Hf = Hematocrito mínimo aceitável',
        'Hto mínimo tipico: 21-25% (paciente saudável), 30% (cardiopata/idoso)',
      ],
      reference: 'Gross JB. Anesthesiology, 1983 | Miller RD. Millers Anesthesia, 9th ed.',
    },
  },
];

// =============================================================================
// SEÇÃO 7: TERAPIA INTENSIVA (9 calculadoras)
// =============================================================================

const utiCalculators = [
  {
    id: 'uti_rass',
    title: 'RASS',
    subtitle: 'Sedação',
    icon: 'Moon',
    status: 'active',
    inputs: [
      {
        id: 'nivel',
        label: 'Nível de Sedação',
        type: 'select',
        options: [
          { value: 4, label: '+4 Combativo' },
          { value: 3, label: '+3 Muito agitado' },
          { value: 2, label: '+2 Agitado' },
          { value: 1, label: '+1 Inquieto' },
          { value: 0, label: '0 Alerta e calmo' },
          { value: -1, label: '-1 Sonolento' },
          { value: -2, label: '-2 Sedação leve' },
          { value: -3, label: '-3 Sedação moderada' },
          { value: -4, label: '-4 Sedação profunda' },
          { value: -5, label: '-5 Não desperta' },
        ],
      },
    ],
    compute: (values) => {
      const nivel = values.nivel ?? 0;
      return { score: nivel };
    },
    resultMessage: (result) => {
      const s = result.score;
      if (s === 0) return 'RASS 0: Alerta e calmo (ideal)';
      if (s > 0) return `RASS +${s}: Agitação`;
      return `RASS ${s}: Sedação`;
    },
    infoBox: {
      keyPoints: [
        '+4 Combativo: violento, perigo imediato para equipe',
        '+3 Muito agitado: puxa ou remove tubos/cateteres, agressivo',
        '+2 Agitado: movimentos frequentes sem proposito, briga com ventilador',
        '+1 Inquieto: ansioso, mas sem movimentos agressivos',
        '0 Alerta e calmo: ideal para maioria dos pacientes',
        '-1 Sonolento: desperta com voz, mantém contato > 10s',
        '-2 Sedação leve: desperta brevemente com voz, contato < 10s',
        '-3 Sedação moderada: movimento ou abertura ocular a voz, sem contato',
        '-4 Sedação profunda: sem resposta a voz, movimento a estimulo fisico',
        '-5 Não desperta: sem resposta a voz ou estimulo fisico',
      ],
      reference: 'Sessler CN et al. Am J Respir Crit Care Med 2002;166(10):1338-44.',
    },
  },
  {
    id: 'uti_sofa',
    title: 'SOFA',
    subtitle: 'Disfunção Organica',
    icon: 'Activity',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'respiratorio',
        label: 'Respiratório (PaO2/FiO2)',
        type: 'select',
        options: [
          { value: 0, label: '0 - PaO2/FiO2 >= 400' },
          { value: 1, label: '1 - PaO2/FiO2 300-399' },
          { value: 2, label: '2 - PaO2/FiO2 200-299' },
          { value: 3, label: '3 - PaO2/FiO2 100-199 com VM' },
          { value: 4, label: '4 - PaO2/FiO2 < 100 com VM' },
        ],
      },
      {
        id: 'coagulacao',
        label: 'Coagulação (Plaquetas x10³/mm³)',
        type: 'select',
        options: [
          { value: 0, label: '0 - Plaquetas >= 150' },
          { value: 1, label: '1 - Plaquetas 100-149' },
          { value: 2, label: '2 - Plaquetas 50-99' },
          { value: 3, label: '3 - Plaquetas 20-49' },
          { value: 4, label: '4 - Plaquetas < 20' },
        ],
      },
      {
        id: 'hepatico',
        label: 'Hepático (Bilirrubina mg/dL)',
        type: 'select',
        options: [
          { value: 0, label: '0 - Bilirrubina < 1.2' },
          { value: 1, label: '1 - Bilirrubina 1.2-1.9' },
          { value: 2, label: '2 - Bilirrubina 2.0-5.9' },
          { value: 3, label: '3 - Bilirrubina 6.0-11.9' },
          { value: 4, label: '4 - Bilirrubina >= 12' },
        ],
      },
      {
        id: 'cardiovascular',
        label: 'Cardiovascular',
        type: 'select',
        options: [
          { value: 0, label: '0 - PAM >= 70 mmHg' },
          { value: 1, label: '1 - PAM < 70 mmHg' },
          { value: 2, label: '2 - Dopamina <= 5 ou Dobutamina' },
          { value: 3, label: '3 - Dopa > 5 ou Nora/Adre <= 0.1' },
          { value: 4, label: '4 - Dopa > 15 ou Nora/Adre > 0.1' },
        ],
      },
      {
        id: 'neurologico',
        label: 'Neurológico (Glasgow)',
        type: 'select',
        options: [
          { value: 0, label: '0 - Glasgow 15' },
          { value: 1, label: '1 - Glasgow 13-14' },
          { value: 2, label: '2 - Glasgow 10-12' },
          { value: 3, label: '3 - Glasgow 6-9' },
          { value: 4, label: '4 - Glasgow < 6' },
        ],
      },
      {
        id: 'renal',
        label: 'Renal (Creatinina mg/dL)',
        type: 'select',
        options: [
          { value: 0, label: '0 - Creatinina < 1.2' },
          { value: 1, label: '1 - Creatinina 1.2-1.9' },
          { value: 2, label: '2 - Creatinina 2.0-3.4' },
          { value: 3, label: '3 - Creatinina 3.5-4.9 ou DU < 500mL/d' },
          { value: 4, label: '4 - Creatinina >= 5.0 ou DU < 200mL/d' },
        ],
      },
    ],
    compute: (values) => {
      const resp = parseInt(values.respiratorio) || 0;
      const coag = parseInt(values.coagulacao) || 0;
      const hep = parseInt(values.hepatico) || 0;
      const cardio = parseInt(values.cardiovascular) || 0;
      const neuro = parseInt(values.neurologico) || 0;
      const renal = parseInt(values.renal) || 0;

      const score = resp + coag + hep + cardio + neuro + renal;

      // Mortalidade aproximada baseada em estudos
      let mortalidade = '';
      let risk = 'baixo';
      if (score <= 1) {
        mortalidade = '< 5%';
        risk = 'baixo';
      } else if (score <= 3) {
        mortalidade = '5-10%';
        risk = 'baixo';
      } else if (score <= 6) {
        mortalidade = '15-20%';
        risk = 'medio';
      } else if (score <= 9) {
        mortalidade = '25-35%';
        risk = 'medio';
      } else if (score <= 12) {
        mortalidade = '40-50%';
        risk = 'alto';
      } else if (score <= 15) {
        mortalidade = '55-70%';
        risk = 'alto';
      } else {
        mortalidade = '> 80%';
        risk = 'critico';
      }

      return {
        score,
        risk,
        details: {
          'Respiratório': `${resp} pts`,
          'Coagulação': `${coag} pts`,
          'Hepático': `${hep} pts`,
          'Cardiovascular': `${cardio} pts`,
          'Neurológico': `${neuro} pts`,
          'Renal': `${renal} pts`,
          'Mortalidade estimada': mortalidade,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os sistemas';
      return `SOFA ${result.score} - Mortalidade: ${result.details['Mortalidade estimada']}`;
    },
    infoBox: {
      keyPoints: [
        'SOFA avalia 6 sistemas: Respiratório, Coagulação, Hepático, Cardiovascular, Neurológico, Renal',
        'Cada sistema: 0-4 pontos. Total: 0-24 pontos',
        'Sepse (Sepsis-3): Infecção + aumento >= 2 pontos no SOFA basal',
        'SOFA >= 2: Mortalidade >= 10% em pacientes com infecção',
        'Usar SOFA sequencial para avaliar evolução',
      ],
      warnings: [
        'Calcular SOFA diáriamente - aumento progressivo indica piora',
      ],
      reference: 'Vincent JL et al. Intensive Care Med 1996 | Singer M et al. JAMA 2016 (Sepsis-3).',
    },
  },
  {
    id: 'uti_qsofa',
    title: 'qSOFA',
    subtitle: 'Quick SOFA',
    icon: 'Zap',
    status: 'active',
    inputs: [
      { id: 'alteracao_mental', label: 'Alteração do nível de consciência (GCS < 15)', type: 'bool' },
      { id: 'fr', label: 'Frequência respiratória >= 22/min', type: 'bool' },
      { id: 'pas', label: 'Pressão arterial sistólica <= 100 mmHg', type: 'bool' },
    ],
    compute: (values) => {
      const mental = values.alteracao_mental ? 1 : 0;
      const fr = values.fr ? 1 : 0;
      const pas = values.pas ? 1 : 0;
      const score = mental + fr + pas;

      let risk = 'baixo';
      let interpretacao = '';
      if (score >= 2) {
        risk = 'alto';
        interpretacao = 'Alto risco de desfecho desfavorável';
      } else if (score === 1) {
        risk = 'medio';
        interpretacao = 'Risco intermediário - monitorar';
      } else {
        interpretacao = 'Baixo risco';
      }

      return {
        score,
        risk,
        details: {
          'Alteração mental': mental ? 'Sim (+1)' : 'Não (0)',
          'FR >= 22': fr ? 'Sim (+1)' : 'Não (0)',
          'PAS <= 100': pas ? 'Sim (+1)' : 'Não (0)',
          'Interpretação': interpretacao,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os critérios';
      if (result.score >= 2) return `qSOFA ${result.score}: ALTO RISCO - Investigar sepse`;
      return `qSOFA ${result.score}: Baixo risco`;
    },
    infoBox: {
      keyPoints: [
        'qSOFA >= 2: Risco aumentado de mortalidade e internação prolongada em UTI',
        'Critérios: Alteração mental (GCS<15), FR>=22, PAS<=100',
        'Ferramenta de triagem rápida - NÃO substitui critérios de sepse',
        'Se qSOFA >= 2: Investigar disfunção organica com SOFA completo',
      ],
      warnings: [
        'qSOFA e ferramenta de triagem - Sepse requer critérios SOFA',
      ],
      reference: 'Seymour CW et al. JAMA 2016;315(8):762-774. Sepsis-3 Definitions.',
    },
  },
  {
    id: 'uti_cam_icu',
    title: 'CAM-ICU',
    subtitle: 'Delirium',
    icon: 'AlertCircle',
    status: 'active',
    inputs: [
      {
        id: 'feature1',
        label: 'Feature 1: Alteração aguda ou flutuante do estado mental',
        type: 'bool',
      },
      {
        id: 'feature2',
        label: 'Feature 2: Inatenção (erro em >= 2 letras no teste SAVEAHAART)',
        type: 'bool',
      },
      {
        id: 'feature3',
        label: 'Feature 3: Nível de consciência alterado (RASS diferente de 0)',
        type: 'bool',
      },
      {
        id: 'feature4',
        label: 'Feature 4: Pensamento desorganizado (comandos/perguntas incorretos)',
        type: 'bool',
      },
    ],
    compute: (values) => {
      const f1 = values.feature1 ? 1 : 0;
      const f2 = values.feature2 ? 1 : 0;
      const f3 = values.feature3 ? 1 : 0;
      const f4 = values.feature4 ? 1 : 0;

      // CAM-ICU Positivo: Feature 1 + Feature 2 + (Feature 3 OU Feature 4)
      const delirium = f1 === 1 && f2 === 1 && (f3 === 1 || f4 === 1);

      return {
        score: delirium ? 1 : 0,
        details: {
          'Feature 1 (Alteração aguda)': f1 ? 'Presente' : 'Ausente',
          'Feature 2 (Inatenção)': f2 ? 'Presente' : 'Ausente',
          'Feature 3 (Consciência alterada)': f3 ? 'Presente' : 'Ausente',
          'Feature 4 (Desorganizado)': f4 ? 'Presente' : 'Ausente',
          'Resultado': delirium ? 'DELIRIUM PRESENTE' : 'Sem delirium',
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Avalie as 4 features';
      if (result.score === 1) return 'CAM-ICU POSITIVO: Delirium presente';
      return 'CAM-ICU Negativo: Sem delirium';
    },
    infoBox: {
      keyPoints: [
        'Delirium = Feature 1 + Feature 2 + (Feature 3 OU Feature 4)',
        'Feature 1: Alteração aguda OU flutuação nas últimas 24h',
        'Feature 2: Teste SAVEAHAART - apertar mao na letra A (erro >= 2)',
        'Feature 3: RASS diferente de 0 (sedado ou agitado)',
        'Feature 4: Comandos incorretos OU perguntas com respostas erradas',
        'Aplicar apenas se RASS >= -3 (paciente não comatoso)',
      ],
      warnings: [
        'Não aplicar em pacientes com RASS -4 ou -5 (coma/sedação profunda)',
      ],
      reference: 'Ely EW et al. JAMA 2001;286(21):2703-2710.',
    },
  },
  {
    id: 'uti_apache2',
    title: 'APACHE II',
    subtitle: 'Prognóstico UTI',
    icon: 'BarChart2',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'idade', label: 'Idade (anos)', type: 'number', min: 0, max: 120, step: 1 },
      { id: 'temp', label: 'Temperatura retal (°C)', type: 'number', min: 25, max: 45, step: 0.1 },
      { id: 'pam', label: 'PAM (mmHg)', type: 'number', min: 20, max: 200, step: 1 },
      { id: 'fc', label: 'FC (bpm)', type: 'number', min: 20, max: 250, step: 1 },
      { id: 'fr', label: 'FR (irpm)', type: 'number', min: 0, max: 60, step: 1 },
      {
        id: 'oxigenacao',
        label: 'Oxigenação',
        type: 'select',
        options: [
          { value: 'pao2_70', label: 'FiO2 < 50%: PaO2 > 70' },
          { value: 'pao2_61_70', label: 'FiO2 < 50%: PaO2 61-70' },
          { value: 'pao2_55_60', label: 'FiO2 < 50%: PaO2 55-60' },
          { value: 'pao2_55', label: 'FiO2 < 50%: PaO2 < 55' },
          { value: 'aado2_200', label: 'FiO2 >= 50%: A-aDO2 < 200' },
          { value: 'aado2_350', label: 'FiO2 >= 50%: A-aDO2 200-349' },
          { value: 'aado2_500', label: 'FiO2 >= 50%: A-aDO2 350-499' },
          { value: 'aado2_500p', label: 'FiO2 >= 50%: A-aDO2 >= 500' },
        ],
      },
      { id: 'ph', label: 'pH arterial', type: 'number', min: 6.5, max: 8.0, step: 0.01 },
      { id: 'sodio', label: 'Sódio (mEq/L)', type: 'number', min: 100, max: 200, step: 1 },
      { id: 'potassio', label: 'Potássio (mEq/L)', type: 'number', min: 1, max: 10, step: 0.1 },
      { id: 'creatinina', label: 'Creatinina (mg/dL)', type: 'number', min: 0.1, max: 20, step: 0.1 },
      { id: 'ira', label: 'Insuficiência renal aguda', type: 'bool' },
      { id: 'hematocrito', label: 'Hematocrito (%)', type: 'number', min: 10, max: 70, step: 1 },
      { id: 'leucocitos', label: 'Leucócitos (x1000/mm³)', type: 'number', min: 0, max: 100, step: 0.1 },
      { id: 'glasgow', label: 'Glasgow (3-15)', type: 'number', min: 3, max: 15, step: 1 },
      {
        id: 'doenca_cronica',
        label: 'Doença crônica grave',
        type: 'select',
        options: [
          { value: 'nenhuma', label: 'Nenhuma' },
          { value: 'eletivo', label: 'Pós-op eletivo com doença crônica' },
          { value: 'emergencia', label: 'Emergência ou clínico com doença crônica' },
        ],
      },
    ],
    compute: (values) => {
      let score = 0;

      // Idade
      const idade = parseFloat(values.idade) || 0;
      if (idade >= 75) score += 6;
      else if (idade >= 65) score += 5;
      else if (idade >= 55) score += 3;
      else if (idade >= 45) score += 2;

      // Temperatura
      const temp = parseFloat(values.temp) || 37;
      if (temp >= 41 || temp <= 29.9) score += 4;
      else if (temp >= 39 || temp <= 31.9) score += 3;
      else if (temp <= 33.9) score += 2;
      else if (temp >= 38.5 || temp <= 35.9) score += 1;

      // PAM
      const pam = parseFloat(values.pam) || 70;
      if (pam >= 160 || pam <= 49) score += 4;
      else if (pam >= 130 || pam <= 69) score += 2;
      else if (pam >= 110) score += 2;

      // FC
      const fc = parseFloat(values.fc) || 80;
      if (fc >= 180 || fc <= 39) score += 4;
      else if (fc >= 140 || fc <= 54) score += 3;
      else if (fc >= 110 || fc <= 69) score += 2;

      // FR
      const fr = parseFloat(values.fr) || 16;
      if (fr >= 50 || fr <= 5) score += 4;
      else if (fr >= 35) score += 3;
      else if (fr <= 9) score += 2;
      else if (fr >= 25 || fr <= 11) score += 1;

      // Oxigenação
      const oxi = values.oxigenacao || 'pao2_70';
      if (oxi === 'aado2_500p') score += 4;
      else if (oxi === 'aado2_500') score += 3;
      else if (oxi === 'aado2_350') score += 2;
      else if (oxi === 'pao2_55' || oxi === 'pao2_55_60') score += 1;
      else if (oxi === 'pao2_61_70') score += 1;

      // pH
      const ph = parseFloat(values.ph) || 7.4;
      if (ph >= 7.7 || ph < 7.15) score += 4;
      else if (ph >= 7.6 || ph < 7.25) score += 3;
      else if (ph < 7.33) score += 2;
      else if (ph >= 7.5) score += 1;

      // Sódio
      const sodio = parseFloat(values.sodio) || 140;
      if (sodio >= 180 || sodio <= 110) score += 4;
      else if (sodio >= 160 || sodio <= 119) score += 3;
      else if (sodio >= 155 || sodio <= 129) score += 2;
      else if (sodio >= 150) score += 1;

      // Potássio
      const k = parseFloat(values.potassio) || 4;
      if (k >= 7 || k < 2.5) score += 4;
      else if (k >= 6) score += 3;
      else if (k < 3 || k >= 5.5) score += 1;

      // Creatinina (dobrar se IRA)
      const cr = parseFloat(values.creatinina) || 1;
      const ira = values.ira ? 2 : 1;
      if (cr >= 3.5) score += 4 * ira;
      else if (cr >= 2) score += 3 * ira;
      else if (cr >= 1.5 || cr < 0.6) score += 2 * ira;

      // Hematocrito
      const ht = parseFloat(values.hematocrito) || 40;
      if (ht >= 60 || ht < 20) score += 4;
      else if (ht >= 50 || ht < 30) score += 2;
      else if (ht >= 46) score += 1;

      // Leucócitos
      const leuco = parseFloat(values.leucocitos) || 10;
      if (leuco >= 40 || leuco < 1) score += 4;
      else if (leuco >= 20 || leuco < 3) score += 2;
      else if (leuco >= 15) score += 1;

      // Glasgow (15 - Glasgow)
      const gcs = parseFloat(values.glasgow) || 15;
      score += 15 - gcs;

      // Doença crônica
      const dc = values.doenca_cronica || 'nenhuma';
      if (dc === 'emergencia') score += 5;
      else if (dc === 'eletivo') score += 2;

      // Mortalidade estimada
      let mortalidade = '';
      let risk = 'baixo';
      if (score <= 4) { mortalidade = '~4%'; risk = 'baixo'; }
      else if (score <= 9) { mortalidade = '~8%'; risk = 'baixo'; }
      else if (score <= 14) { mortalidade = '~15%'; risk = 'medio'; }
      else if (score <= 19) { mortalidade = '~25%'; risk = 'medio'; }
      else if (score <= 24) { mortalidade = '~40%'; risk = 'alto'; }
      else if (score <= 29) { mortalidade = '~55%'; risk = 'alto'; }
      else if (score <= 34) { mortalidade = '~75%'; risk = 'critico'; }
      else { mortalidade = '>85%'; risk = 'critico'; }

      return {
        score,
        risk,
        details: {
          'Score total': `${score} pontos`,
          'Mortalidade estimada': mortalidade,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os dados';
      return `APACHE II: ${result.score} - Mortalidade: ${result.details['Mortalidade estimada']}`;
    },
    infoBox: {
      keyPoints: [
        'APACHE II: Score prognóstico para UTI (0-71 pontos)',
        'Componentes: 12 variaveis fisiologicas + idade + doença crônica',
        'Usar piores valores das primeiras 24h de UTI',
        'Score >= 25: Mortalidade > 50%',
        'Não usar para decisao individual - apenas prognóstico populacional',
      ],
      warnings: [
        'APACHE II e para prognóstico populacional, não decisao individual',
      ],
      reference: 'Knaus WA et al. Crit Care Med 1985;13(10):818-829.',
    },
  },
  {
    id: 'uti_cpis',
    title: 'CPIS',
    subtitle: 'Pneumonia/VAP',
    icon: 'Wind',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'temperatura',
        label: 'Temperatura (°C)',
        type: 'select',
        options: [
          { value: 0, label: '0 - 36.5 a 38.4' },
          { value: 1, label: '1 - 38.5 a 38.9' },
          { value: 2, label: '2 - >= 39 ou <= 36' },
        ],
      },
      {
        id: 'leucocitos',
        label: 'Leucócitos (x1000/mm³)',
        type: 'select',
        options: [
          { value: 0, label: '0 - 4 a 11' },
          { value: 1, label: '1 - < 4 ou > 11' },
          { value: 2, label: '2 - < 4 ou > 11 + bastoes >= 50%' },
        ],
      },
      {
        id: 'secrecao',
        label: 'Secreção traqueal',
        type: 'select',
        options: [
          { value: 0, label: '0 - Ausente ou escassa' },
          { value: 1, label: '1 - Não purulenta' },
          { value: 2, label: '2 - Purulenta' },
        ],
      },
      {
        id: 'pao2fio2',
        label: 'PaO2/FiO2',
        type: 'select',
        options: [
          { value: 0, label: '0 - > 240 ou SDRA' },
          { value: 2, label: '2 - <= 240 sem SDRA' },
        ],
      },
      {
        id: 'rx',
        label: 'Raio-X de torax',
        type: 'select',
        options: [
          { value: 0, label: '0 - Sem infiltrado' },
          { value: 1, label: '1 - Infiltrado difuso ou em placas' },
          { value: 2, label: '2 - Infiltrado localizado' },
        ],
      },
      {
        id: 'cultura',
        label: 'Cultura de aspirado traqueal',
        type: 'select',
        options: [
          { value: 0, label: '0 - Negativa ou < 10⁴ UFC/mL' },
          { value: 1, label: '1 - Positiva (>= 10⁴ UFC/mL)' },
          { value: 2, label: '2 - Positiva + mesmo patogeno no Gram' },
        ],
      },
    ],
    compute: (values) => {
      const temp = parseInt(values.temperatura) || 0;
      const leuco = parseInt(values.leucocitos) || 0;
      const secrecao = parseInt(values.secrecao) || 0;
      const pao2 = parseInt(values.pao2fio2) || 0;
      const rx = parseInt(values.rx) || 0;
      const cultura = parseInt(values.cultura) || 0;

      const score = temp + leuco + secrecao + pao2 + rx + cultura;

      let interpretacao = '';
      let risk = 'baixo';
      if (score >= 6) {
        interpretacao = 'Alta probabilidade de pneumonia/VAP';
        risk = 'alto';
      } else {
        interpretacao = 'Baixa probabilidade de pneumonia';
        risk = 'baixo';
      }

      return {
        score,
        risk,
        details: {
          'Temperatura': `${temp} pts`,
          'Leucócitos': `${leuco} pts`,
          'Secreção': `${secreção} pts`,
          'PaO2/FiO2': `${pao2} pts`,
          'Raio-X': `${rx} pts`,
          'Cultura': `${cultura} pts`,
          'Interpretação': interpretacao,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os critérios';
      if (result.score >= 6) return `CPIS ${result.score}: PROVAVEL VAP - Iniciar ATB`;
      return `CPIS ${result.score}: VAP improvável`;
    },
    infoBox: {
      keyPoints: [
        'CPIS >= 6: Alta probabilidade de pneumonia associada a VM (VAP)',
        'CPIS < 6: Baixa probabilidade - considerar suspender ATB',
        'Reavaliar CPIS em 72h para guiar duração do tratamento',
        'Critérios: Temperatura, Leucócitos, Secreção, PaO2/FiO2, RX, Cultura',
      ],
      warnings: [
        'CPIS auxilia no diagnóstico mas não substitui avaliação clínica',
      ],
      reference: 'Pugin J et al. Am Rev Respir Dis 1991;143(5 Pt 1):1121-9.',
    },
  },
  {
    id: 'uti_nutric',
    title: 'NUTRIC Score',
    subtitle: 'Risco nutricional',
    icon: 'Apple',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'idade',
        label: 'Idade',
        type: 'select',
        options: [
          { value: 0, label: '0 - < 50 anos' },
          { value: 1, label: '1 - 50-74 anos' },
          { value: 2, label: '2 - >= 75 anos' },
        ],
      },
      {
        id: 'apache2',
        label: 'APACHE II',
        type: 'select',
        options: [
          { value: 0, label: '0 - < 15' },
          { value: 1, label: '1 - 15-19' },
          { value: 2, label: '2 - 20-27' },
          { value: 3, label: '3 - >= 28' },
        ],
      },
      {
        id: 'sofa',
        label: 'SOFA',
        type: 'select',
        options: [
          { value: 0, label: '0 - < 6' },
          { value: 1, label: '1 - 6-9' },
          { value: 2, label: '2 - >= 10' },
        ],
      },
      {
        id: 'comorbidades',
        label: 'Número de comorbidades',
        type: 'select',
        options: [
          { value: 0, label: '0 - <= 1' },
          { value: 1, label: '1 - >= 2' },
        ],
      },
      {
        id: 'dias_hospital',
        label: 'Dias de hospital até UTI',
        type: 'select',
        options: [
          { value: 0, label: '0 - 0 a 1 dia' },
          { value: 1, label: '1 - >= 1 dia' },
        ],
      },
    ],
    compute: (values) => {
      const idade = parseInt(values.idade) || 0;
      const apache = parseInt(values.apache2) || 0;
      const sofa = parseInt(values.sofa) || 0;
      const comorb = parseInt(values.comorbidades) || 0;
      const dias = parseInt(values.dias_hospital) || 0;

      // NUTRIC modificado (sem IL-6)
      const score = idade + apache + sofa + comorb + dias;

      let interpretacao = '';
      let risk = 'baixo';
      if (score >= 5) {
        interpretacao = 'Alto risco nutricional - beneficio da nutrição agressiva';
        risk = 'alto';
      } else {
        interpretacao = 'Baixo risco nutricional';
        risk = 'baixo';
      }

      return {
        score,
        risk,
        details: {
          'Idade': `${idade} pts`,
          'APACHE II': `${apache} pts`,
          'SOFA': `${sofa} pts`,
          'Comorbidades': `${comorb} pts`,
          'Dias hospital': `${dias} pts`,
          'Interpretação': interpretacao,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os critérios';
      if (result.score >= 5) return `NUTRIC ${result.score}: ALTO RISCO - Nutrição agressiva`;
      return `NUTRIC ${result.score}: Baixo risco nutricional`;
    },
    infoBox: {
      keyPoints: [
        'NUTRIC >= 5: Alto risco nutricional - maior beneficio com nutrição adequada',
        'NUTRIC < 5: Baixo risco - menor beneficio relativo da nutrição agressiva',
        'Score modificado sem IL-6 (versao prática)',
        'Alto risco: Iniciar nutrição enteral em 24-48h',
        'Meta proteica: 1.2-2.0 g/kg/dia em alto risco',
      ],
      reference: 'Heyland DK et al. Crit Care 2011;15(6):R268.',
    },
  },
];

// =============================================================================
// SEÇÃO 8: PERIOPERATÓRIO E VIA AÉREA (6 calculadoras)
// =============================================================================

const periopCalculators = [
  {
    id: 'periop_apfel',
    title: 'Apfel (NVPO)',
    subtitle: 'PONV',
    icon: 'Frown',
    status: 'active',
    inputs: [
      { id: 'sexo_fem', label: 'Sexo feminino', type: 'bool' },
      { id: 'nao_fumante', label: 'Não fumante', type: 'bool' },
      { id: 'hist_nvpo', label: 'História de NVPO ou cinetose', type: 'bool' },
      { id: 'opioides', label: 'Uso de opioides pós-op', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;
      if (values.sexo_fem) score++;
      if (values.nao_fumante) score++;
      if (values.hist_nvpo) score++;
      if (values.opioides) score++;
      const riscos = [10, 21, 39, 61, 79];
      let risk = 'baixo';
      if (score >= 3) risk = 'alto';
      else if (score >= 2) risk = 'medio';
      return { score, details: { risco: riscos[score] }, risk };
    },
    resultMessage: (result) => {
      return `Apfel ${result.score}: Risco de NVPO ${result.details.risco}%`;
    },
    infoBox: {
      keyPoints: [
        'Score simplificado com 4 fatores de risco para NVPO',
        '0 pts: 10% | 1 pt: 21% | 2 pts: 39% | 3 pts: 61% | 4 pts: 79%',
        'Fatores: Sexo feminino, Não fumante, Historia NVPO/cinetose, Opioides pós-op',
        'Score >= 2: Considerar profilaxia múltimodal (ondansetrona + dexametasona)',
      ],
      reference: 'Apfel CC et al. Anesthesiology 1999;91(3):693-700',
    },
  },
  {
    id: 'periop_aldrete_mod',
    title: 'Aldrete Modificado',
    subtitle: 'Alta da SRPA',
    icon: 'ClipboardCheck',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'atividade',
        label: 'Atividade',
        type: 'select',
        options: [
          { value: 2, label: 'Move 4 extremidades' },
          { value: 1, label: 'Move 2 extremidades' },
          { value: 0, label: 'Nenhum movimento' },
        ],
      },
      {
        id: 'respiracao',
        label: 'Respiração',
        type: 'select',
        options: [
          { value: 2, label: 'Respira profundamente, tosse' },
          { value: 1, label: 'Dispneia ou respiração limitada' },
          { value: 0, label: 'Apneia' },
        ],
      },
      {
        id: 'circulacao',
        label: 'Circulação (PA)',
        type: 'select',
        options: [
          { value: 2, label: 'PA +/- 20% do pre-op' },
          { value: 1, label: 'PA +/- 20-50% do pre-op' },
          { value: 0, label: 'PA +/- 50% do pre-op' },
        ],
      },
      {
        id: 'consciencia',
        label: 'Consciência',
        type: 'select',
        options: [
          { value: 2, label: 'Totalmente acordado' },
          { value: 1, label: 'Desperta quando chamado' },
          { value: 0, label: 'Não responde' },
        ],
      },
      {
        id: 'spo2',
        label: 'SpO2',
        type: 'select',
        options: [
          { value: 2, label: 'SpO2 > 92% em ar ambiente' },
          { value: 1, label: 'Necessita O2 para SpO2 > 90%' },
          { value: 0, label: 'SpO2 < 90% com O2' },
        ],
      },
    ],
    compute: (values) => {
      const score = (values.atividade || 0) + (values.respiracao || 0) + (values.circulacao || 0) + (values.consciencia || 0) + (values.spo2 || 0);
      return { score };
    },
    resultMessage: (result) => {
      if (result.score >= 9) return `Aldrete ${result.score}: Apto para alta`;
      if (result.score >= 7) return `Aldrete ${result.score}: Quase apto`;
      return `Aldrete ${result.score}: Continuar observação`;
    },
    infoBox: {
      keyPoints: [
        'Score >= 9: Apto para alta da SRPA',
        'Score 7-8: Quase apto - reavaliar em 15-30 min',
        'Score < 7: Continuar observação',
        'Avalia: Atividade, Respiração, Circulação, Consciência, SpO2',
        'Score máximo: 10 pontos',
      ],
      reference: 'Aldrete JA. J Clin Anesth 1995;7(1):89-91.',
    },
  },
  {
    id: 'periop_aldrete_orig',
    title: 'Aldrete-Kroulik',
    subtitle: 'Original 1970',
    icon: 'FileText',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'atividade',
        label: 'Atividade',
        type: 'select',
        options: [
          { value: 'mov4', label: 'Move 4 extremidades voluntariamente ou sob comando' },
          { value: 'mov2', label: 'Move 2 extremidades voluntariamente ou sob comando' },
          { value: 'mov0', label: 'Incapaz de mover extremidades' },
        ],
      },
      {
        id: 'respiracao',
        label: 'Respiração',
        type: 'select',
        options: [
          { value: 'resp_prof', label: 'Capaz de respirar profundamente e tossir livremente' },
          { value: 'resp_lim', label: 'Dispneia ou respiração limitada' },
          { value: 'resp_apn', label: 'Apneico' },
        ],
      },
      {
        id: 'circulacao',
        label: 'Circulação (PA)',
        type: 'select',
        options: [
          { value: 'pa_20', label: 'PA +/- 20% do nível pré-anestésico' },
          { value: 'pa_50', label: 'PA +/- 20-50% do nível pré-anestésico' },
          { value: 'pa_maior', label: 'PA +/- 50% do nível pré-anestésico' },
        ],
      },
      {
        id: 'consciencia',
        label: 'Consciência',
        type: 'select',
        options: [
          { value: 'cons_acordado', label: 'Completamente acordado' },
          { value: 'cons_chamado', label: 'Desperta quando chamado' },
          { value: 'cons_nao', label: 'Não responde' },
        ],
      },
      {
        id: 'cor',
        label: 'Cor (Coloração)',
        type: 'select',
        options: [
          { value: 'cor_rosado', label: 'Rosado' },
          { value: 'cor_palido', label: 'Palido, icterico, manchado' },
          { value: 'cor_cian', label: 'Cianotico' },
        ],
      },
    ],
    compute: (values) => {
      const mapAtividade = { mov4: 2, mov2: 1, mov0: 0 };
      const mapRespiracao = { resp_prof: 2, resp_lim: 1, resp_apn: 0 };
      const mapCirculacao = { pa_20: 2, pa_50: 1, pa_maior: 0 };
      const mapConsciencia = { cons_acordado: 2, cons_chamado: 1, cons_nao: 0 };
      const mapCor = { cor_rosado: 2, cor_palido: 1, cor_cian: 0 };

      const atividade = mapAtividade[values.atividade] ?? 0;
      const respiracao = mapRespiracao[values.respiracao] ?? 0;
      const circulacao = mapCirculacao[values.circulacao] ?? 0;
      const consciencia = mapConsciencia[values.consciencia] ?? 0;
      const cor = mapCor[values.cor] ?? 0;

      const score = atividade + respiracao + circulacao + consciencia + cor;

      return {
        score,
        details: {
          'Atividade': atividade,
          'Respiração': respiracao,
          'Circulação': circulacao,
          'Consciência': consciencia,
          'Cor': cor,
        },
      };
    },
    resultMessage: (result) => {
      if (result.score >= 9) return `Aldrete Original ${result.score}: Apto para alta`;
      if (result.score >= 7) return `Aldrete Original ${result.score}: Quase apto`;
      return `Aldrete Original ${result.score}: Continuar observação`;
    },
    infoBox: {
      keyPoints: [
        'Score original de 1970 - usa critério de COR (coloração)',
        'Score >= 9: Apto para alta da SRPA',
        'Score 7-8: Quase apto - reavaliar em 15-30 min',
        'Score < 7: Continuar observação',
        'Substituido pelo Aldrete Modificado (1995) que usa SpO2 ao inves de cor',
      ],
      reference: 'Aldrete JA, Kroulik D. Anesth Analg 1970;49(6):924-34',
    },
  },
  {
    id: 'periop_asa',
    title: 'ASA',
    subtitle: 'Classificação Estado Fisico',
    icon: 'User',
    status: 'active',
    inputs: [
      {
        id: 'asa',
        label: 'Classificação ASA',
        type: 'select',
        options: [
          { value: 1, label: 'ASA I - Paciente saudável' },
          { value: 2, label: 'ASA II - Doença sistêmica leve' },
          { value: 3, label: 'ASA III - Doença sistêmica grave' },
          { value: 4, label: 'ASA IV - Doença sistêmica grave com risco de vida' },
          { value: 5, label: 'ASA V - Moribundo' },
          { value: 6, label: 'ASA VI - Morte cerebral / doador' },
        ],
      },
      { id: 'emergencia', label: 'Cirurgia de emergência (E)', type: 'bool' },
    ],
    compute: (values) => {
      const asa = values.asa || 1;
      const e = values.emergencia ? 'E' : '';

      const exemplos = {
        1: 'Saudável, não fumante, sem etilismo ou etilismo mínimo',
        2: 'Fumante, etilista social, gestante, obesidade (IMC 30-40), HAS/DM controlados',
        3: 'HAS/DM mal controlados, DPOC, obesidade morbida (IMC 40+), hepatite ativa, alcoolismo, marcapasso, FEVE moderadamente reduzida, DRC em diálise, IAM >3 meses, AVC/AIT >3 meses',
        4: 'IAM recente (<3 meses), AVC recente (<3 meses), ICC descompensada, sepse, CIVD, SDRA, FEVE gravemente reduzida',
        5: 'Aneurisma roto, politrauma grave, sangramento intracraniano com efeito de massa, isquemia mesenterica',
        6: 'Morte encefalica declarada para captação de órgãos',
      };

      const descricoes = {
        1: 'Paciente saudável',
        2: 'Doença sistêmica leve',
        3: 'Doença sistêmica grave',
        4: 'Doença sistêmica grave com risco de vida constante',
        5: 'Moribundo - não se espera sobreviver sem cirurgia',
        6: 'Morte encefalica - doador de órgãos',
      };

      return {
        score: asa,
        details: {
          'Classificação': descricoes[asa],
          'Exemplos comuns': exemplos[asa],
          'Emergência': e ? 'Sim (E)' : 'Não',
        },
      };
    },
    resultMessage: (result) => {
      const e = result.details['Emergência'] === 'Sim (E)' ? 'E' : '';
      return `ASA ${result.score}${e}: ${result.details['Classificação']}`;
    },
    infoBox: {
      keyPoints: [
        'ASA I: Paciente saudável',
        'ASA II: Doença sistêmica leve (ex: HAS controlada, DM controlado)',
        'ASA III: Doença sistêmica grave (ex: HAS não controlada, DPOC moderada)',
        'ASA IV: Doença sistêmica grave com risco de vida (ex: ICC descompensada)',
        'ASA V: Moribundo - não se espera sobreviver sem cirurgia',
        'ASA VI: Morte cerebral declarada - doador de órgãos',
        'E: Adicionar "E" se cirurgia de emergência',
      ],
      reference: 'ASA Physical Status Classification System. Last updated 2020.',
    },
  },
  {
    id: 'periop_mallampati',
    title: 'Mallampati',
    subtitle: 'Via aérea',
    icon: 'Eye',
    status: 'active',
    inputs: [
      {
        id: 'classe',
        label: 'Classificação Mallampati',
        type: 'select',
        options: [
          { value: 1, label: 'Classe I - Pilares, palato mole e uvula visíveis' },
          { value: 2, label: 'Classe II - Pilares e palato mole visíveis' },
          { value: 3, label: 'Classe III - Apenas palato mole visível' },
          { value: 4, label: 'Classe IV - Apenas palato duro visível' },
        ],
      },
    ],
    compute: (values) => {
      const classe = values.classe || 1;
      return { score: classe };
    },
    resultMessage: (result) => {
      const msgs = {
        1: 'Mallampati I: Via aérea fácil',
        2: 'Mallampati II: Via aérea provavelmente fácil',
        3: 'Mallampati III: Via aérea possívelmente difícil',
        4: 'Mallampati IV: Via aérea provavelmente difícil',
      };
      return msgs[result.score] || `Mallampati ${result.score}`;
    },
    infoBox: {
      keyPoints: [
        'Classe I: Pilares amigdalianos, palato mole e uvula visíveis',
        'Classe II: Pilares amigdalianos e palato mole visíveis, uvula parcial',
        'Classe III: Apenas palato mole visível',
        'Classe IV: Apenas palato duro visível',
        'Classes III e IV sugerem maior dificuldade de intubação',
        'Avaliação: paciente sentado, boca aberta, lingua protrusa',
      ],
      reference: 'Mallampati SR et al. Can Anaesth Soc J 1985;32(4):429-34.',
    },
  },
  {
    id: 'periop_cormack',
    title: 'Cormack-Lehane',
    subtitle: 'Laringoscopia Direta',
    icon: 'Eye',
    status: 'active',
    inputs: [
      {
        id: 'grau',
        label: 'Classificação de Cormack-Lehane',
        type: 'select',
        options: [
          { value: 'grau1', label: 'Grau I - Glote completamente visível' },
          { value: 'grau2a', label: 'Grau IIa - Glote parcialmente visível' },
          { value: 'grau2b', label: 'Grau IIb - Apenas aritenoides ou parte posterior da glote' },
          { value: 'grau3a', label: 'Grau IIIa - Apenas epiglote visível (pode ser elevada)' },
          { value: 'grau3b', label: 'Grau IIIb - Apenas epiglote visível (aderida a faringe)' },
          { value: 'grau4', label: 'Grau IV - Nem epiglote nem glote visíveis' },
        ],
      },
    ],
    compute: (values) => {
      const grauMap = {
        grau1: { score: 1, dificuldade: 'Facil', conduta: 'Intubação traqueal direta' },
        grau2a: { score: 2, dificuldade: 'Facil', conduta: 'Intubação traqueal direta' },
        grau2b: { score: 2, dificuldade: 'Moderada', conduta: 'Pode necessitar bougie ou guia' },
        grau3a: { score: 3, dificuldade: 'Difícil', conduta: 'Técnicas alternativas (bougie, videolaringoscopio)' },
        grau3b: { score: 3, dificuldade: 'Muito difícil', conduta: 'Videolaringoscopio ou fibroscopia' },
        grau4: { score: 4, dificuldade: 'Impossível via direta', conduta: 'Via aérea difícil - considerar alternativas' },
      };

      const grau = values.grau || 'grau1';
      const info = grauMap[grau] || grauMap.grau1;

      return {
        score: info.score,
        details: {
          'Dificuldade': info.dificuldade,
          'Conduta sugerida': info.conduta,
        },
      };
    },
    resultMessage: (result) => {
      const msgs = {
        1: 'Cormack-Lehane I: Via aérea fácil',
        2: 'Cormack-Lehane II: Via aérea provavelmente fácil',
        3: 'Cormack-Lehane III: Via aérea difícil',
        4: 'Cormack-Lehane IV: Via aérea muito difícil',
      };
      return msgs[result.score] || `Cormack-Lehane ${result.score}`;
    },
    infoBox: {
      keyPoints: [
        'Grau I: Glote completamente visível - intubação fácil',
        'Grau II: Glote parcialmente visível (IIa) ou aritenoides (IIb)',
        'Grau III: Apenas epiglote visível - dificuldade significativa',
        'Grau IV: Nem glote nem epiglote visíveis - via aérea difícil',
        'Avaliação durante laringoscopia direta',
        'Graus III e IV requerem técnicas alternativas (bougie, video, fibro)',
      ],
      reference: 'Cormack RS, Lehane J. Anaesthesia 1984;39(11):1105-11',
    },
  },
  // === CALCULADORAS RESPIRATÓRIAS PARA PERIOPERATÓRIO ===
  {
    id: 'periop_ariscat',
    title: 'ARISCAT',
    subtitle: 'Risco Complicação Pulmonar',
    icon: 'Wind',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'idade',
        label: 'Idade',
        type: 'select',
        options: [
          { value: 'idade_50', label: '≤ 50 anos' },
          { value: 'idade_51_80', label: '51-80 anos (+3)' },
          { value: 'idade_80', label: '> 80 anos (+16)' },
        ],
      },
      {
        id: 'spo2',
        label: 'SpO2 pré-operatória',
        type: 'select',
        options: [
          { value: 'spo2_96', label: '≥ 96%' },
          { value: 'spo2_91_95', label: '91-95% (+8)' },
          { value: 'spo2_90', label: '≤ 90% (+24)' },
        ],
      },
      { id: 'ivr_30dias', label: 'Infecção respiratória no último mês (+17)', type: 'bool' },
      { id: 'anemia', label: 'Anemia pre-op (Hb ≤ 10 g/dL) (+11)', type: 'bool' },
      {
        id: 'cirurgia',
        label: 'Incisao cirúrgica',
        type: 'select',
        options: [
          { value: 'cir_periferica', label: 'Periferica' },
          { value: 'cir_abd_alta', label: 'Abdominal alta (+15)' },
          { value: 'cir_toracica', label: 'Intratorácica (+24)' },
        ],
      },
      {
        id: 'duracao',
        label: 'Duração prevista da cirurgia',
        type: 'select',
        options: [
          { value: 'dur_2h', label: '≤ 2 horas' },
          { value: 'dur_2_3h', label: '2-3 horas (+16)' },
          { value: 'dur_3h', label: '> 3 horas (+23)' },
        ],
      },
      { id: 'emergencia', label: 'Cirurgia de emergência (+8)', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;
      const idadeMap = { idade_50: 0, idade_51_80: 3, idade_80: 16 };
      score += idadeMap[values.idade] || 0;
      const spo2Map = { spo2_96: 0, spo2_91_95: 8, spo2_90: 24 };
      score += spo2Map[values.spo2] || 0;
      if (values.ivr_30dias) score += 17;
      if (values.anemia) score += 11;
      if (values.emergencia) score += 8;
      const cirMap = { cir_periferica: 0, cir_abd_alta: 15, cir_toracica: 24 };
      score += cirMap[values.cirurgia] || 0;
      const durMap = { dur_2h: 0, dur_2_3h: 16, dur_3h: 23 };
      score += durMap[values.duracao] || 0;

      if (score < 26) {
        return { score, risk: 'baixo', riskLabel: 'Baixo risco (1.6%)', details: { 'Pontuação': `${score}/123`, 'Categoria': 'Baixo risco', 'Risco de CPP': '< 1.6%', 'Conduta': 'Manejo padrão' } };
      } else if (score < 45) {
        return { score, risk: 'medio', riskLabel: 'Intermediário (13%)', details: { 'Pontuação': `${score}/123`, 'Categoria': 'Risco intermediário', 'Risco de CPP': '~13%', 'Conduta': 'Fisioterapia respiratória' } };
      } else {
        return { score, risk: 'alto', riskLabel: 'Alto (42%)', details: { 'Pontuação': `${score}/123`, 'Categoria': 'Alto risco', 'Risco de CPP': '~42%', 'Conduta': 'Otimização pre-op, UTI pós-op' } };
      }
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      if (result.score < 26) return `ARISCAT ${result.score}: Baixo risco (< 1.6%)`;
      if (result.score < 45) return `ARISCAT ${result.score}: Risco intermediário (~13%)`;
      return `ARISCAT ${result.score}: Alto risco (~42%)`;
    },
    infoBox: {
      keyPoints: [
        'ARISCAT: Assess Respiratory Risk in Surgical Patients in Catalonia',
        'Baixo risco (<26): 1.6% | Intermediário (26-44): 13% | Alto (≥45): 42%',
        'CPP: infecção respiratória, insuficiência, atelectasia, broncoespasmo',
      ],
      reference: 'Canet J et al. Anesthesiology 2010;113(6):1338-50',
    },
  },
  {
    id: 'periop_stopbang',
    title: 'STOP-Bang',
    subtitle: 'Risco de SAOS',
    icon: 'Moon',
    status: 'active',
    inputs: [
      { id: 'snore', label: 'S - Snoring: Ronca alto?', type: 'bool' },
      { id: 'tired', label: 'T - Tired: Cansaco diurno frequente?', type: 'bool' },
      { id: 'observed', label: 'O - Observed: Apneia observada?', type: 'bool' },
      { id: 'pressure', label: 'P - Pressure: Hipertensao arterial?', type: 'bool' },
      { id: 'bmi', label: 'B - BMI: IMC > 35?', type: 'bool' },
      { id: 'age', label: 'A - Age: Idade > 50 anos?', type: 'bool' },
      { id: 'neck', label: 'N - Neck: Circ. cervical > 40cm (H) / 38cm (M)?', type: 'bool' },
      { id: 'gender', label: 'G - Gender: Sexo masculino?', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;
      if (values.snore) score++;
      if (values.tired) score++;
      if (values.observed) score++;
      if (values.pressure) score++;
      if (values.bmi) score++;
      if (values.age) score++;
      if (values.neck) score++;
      if (values.gender) score++;

      if (score <= 2) {
        return { score, risk: 'baixo', riskLabel: 'Baixo risco', details: { 'Pontuação': `${score}/8`, 'Categoria': 'Baixo risco', 'Probabilidade SAOS': '~15%' } };
      } else if (score <= 4) {
        return { score, risk: 'medio', riskLabel: 'Intermediário', details: { 'Pontuação': `${score}/8`, 'Categoria': 'Risco intermediário', 'Probabilidade SAOS': '~35%' } };
      } else {
        return { score, risk: 'alto', riskLabel: 'Alto risco', details: { 'Pontuação': `${score}/8`, 'Categoria': 'Alto risco', 'Probabilidade SAOS': '~60-80%', 'Precauções': 'CPAP, monitorar pós-op' } };
      }
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      if (result.score <= 2) return `STOP-Bang ${result.score}: Baixo risco de SAOS`;
      if (result.score <= 4) return `STOP-Bang ${result.score}: Risco intermediário`;
      return `STOP-Bang ${result.score}: Alto risco de SAOS`;
    },
    infoBox: {
      keyPoints: [
        'STOP-Bang: Triagem para SAOS (Apneia Obstrutiva do Sono)',
        '0-2: Baixo risco | 3-4: Intermediário | 5-8: Alto risco',
        'SAOS aumenta risco perioperatório: hipoxemia, arritmias, IOT difícil',
      ],
      reference: 'Chung F et al. Anesthesiology 2008;108(5):812-21',
    },
  },
  {
    id: 'periop_pf',
    title: 'Relação PaO2/FiO2',
    subtitle: 'Berlin (SDRA)',
    icon: 'Activity',
    status: 'active',
    inputs: [
      { id: 'pao2', label: 'PaO2 (mmHg)', type: 'number', min: 20, max: 600, step: 1 },
      { id: 'fio2', label: 'FiO2 (%)', type: 'number', min: 21, max: 100, step: 1 },
    ],
    compute: (values) => {
      const pao2 = parseFloat(values.pao2) || 0;
      const fio2Percent = parseFloat(values.fio2) || 0;
      if (pao2 <= 0 || fio2Percent <= 0) return null;
      const fio2 = fio2Percent / 100;
      const pf = pao2 / fio2;

      if (pf >= 300) {
        return { score: Math.round(pf), risk: 'baixo', riskLabel: 'Normal', details: { 'P/F': `${pf.toFixed(0)} mmHg`, 'Classificação': 'Normal' } };
      } else if (pf >= 200) {
        return { score: Math.round(pf), risk: 'baixo', riskLabel: 'Leve', details: { 'P/F': `${pf.toFixed(0)} mmHg`, 'Classificação': 'SDRA Leve', 'Mortalidade': '~27%' } };
      } else if (pf >= 100) {
        return { score: Math.round(pf), risk: 'medio', riskLabel: 'Moderada', details: { 'P/F': `${pf.toFixed(0)} mmHg`, 'Classificação': 'SDRA Moderada', 'Mortalidade': '~32%' } };
      } else {
        return { score: Math.round(pf), risk: 'alto', riskLabel: 'Grave', details: { 'P/F': `${pf.toFixed(0)} mmHg`, 'Classificação': 'SDRA Grave', 'Mortalidade': '~45%' } };
      }
    },
    resultMessage: (result) => {
      if (!result) return 'Informe PaO2 e FiO2';
      const pf = result.score;
      if (pf >= 300) return `P/F ${pf}: Normal`;
      if (pf >= 200) return `P/F ${pf}: SDRA Leve`;
      if (pf >= 100) return `P/F ${pf}: SDRA Moderada`;
      return `P/F ${pf}: SDRA Grave`;
    },
    infoBox: {
      keyPoints: [
        'P/F = PaO2 / FiO2. Ex: 80/0.60 = 133',
        'Berlin: ≥300 (normal) | 200-299 (leve) | 100-199 (moderada) | <100 (grave)',
      ],
      reference: 'ARDS Definition Task Force. JAMA 2012;307(23):2526-33',
    },
  },
  {
    id: 'periop_murray',
    title: 'Murray Score',
    subtitle: 'Lesão Pulmonar (LIS)',
    icon: 'Wind',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'rx', label: 'RX Torax (quadrantes)', type: 'select', options: [
        { value: 'rx_0', label: '0 quadrantes (0)' },
        { value: 'rx_1', label: '1 quadrante (1)' },
        { value: 'rx_2', label: '2 quadrantes (2)' },
        { value: 'rx_3', label: '3 quadrantes (3)' },
        { value: 'rx_4', label: '4 quadrantes (4)' },
      ]},
      { id: 'pf', label: 'PaO2/FiO2', type: 'select', options: [
        { value: 'pf_0', label: '≥300 (0)' },
        { value: 'pf_1', label: '225-299 (1)' },
        { value: 'pf_2', label: '175-224 (2)' },
        { value: 'pf_3', label: '100-174 (3)' },
        { value: 'pf_4', label: '<100 (4)' },
      ]},
      { id: 'peep', label: 'PEEP', type: 'select', options: [
        { value: 'peep_0', label: '≤5 (0)' },
        { value: 'peep_1', label: '6-8 (1)' },
        { value: 'peep_2', label: '9-11 (2)' },
        { value: 'peep_3', label: '12-14 (3)' },
        { value: 'peep_4', label: '≥15 (4)' },
      ]},
      { id: 'comp', label: 'Complacência', type: 'select', options: [
        { value: 'comp_0', label: '≥80 (0)' },
        { value: 'comp_1', label: '60-79 (1)' },
        { value: 'comp_2', label: '40-59 (2)' },
        { value: 'comp_3', label: '20-39 (3)' },
        { value: 'comp_4', label: '≤19 (4)' },
        { value: 'comp_na', label: 'N/A' },
      ]},
    ],
    compute: (values) => {
      const rxMap = { rx_0: 0, rx_1: 1, rx_2: 2, rx_3: 3, rx_4: 4 };
      const pfMap = { pf_0: 0, pf_1: 1, pf_2: 2, pf_3: 3, pf_4: 4 };
      const peepMap = { peep_0: 0, peep_1: 1, peep_2: 2, peep_3: 3, peep_4: 4 };
      const compMap = { comp_0: 0, comp_1: 1, comp_2: 2, comp_3: 3, comp_4: 4, comp_na: null };

      const rxPts = rxMap[values.rx];
      const pfPts = pfMap[values.pf];
      const peepPts = peepMap[values.peep];
      const compPts = compMap[values.comp];

      if (rxPts === undefined || pfPts === undefined || peepPts === undefined) return null;

      let soma = rxPts + pfPts + peepPts;
      let n = 3;
      if (compPts !== null && compPts !== undefined) { soma += compPts; n = 4; }
      const score = soma / n;

      if (score === 0) {
        return { score: score.toFixed(1), risk: 'baixo', riskLabel: 'Sem lesão', details: { 'Score': `${score.toFixed(1)}/4`, 'Classificação': 'Sem lesão pulmonar' } };
      } else if (score <= 2.5) {
        return { score: score.toFixed(1), risk: 'medio', riskLabel: 'Leve a moderada', details: { 'Score': `${score.toFixed(1)}/4`, 'Classificação': 'Lesão leve-moderada' } };
      } else {
        return { score: score.toFixed(1), risk: 'alto', riskLabel: 'SDRA grave', details: { 'Score': `${score.toFixed(1)}/4`, 'Classificação': 'SDRA grave', 'ECMO': 'Considerar se >3.0' } };
      }
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      const score = parseFloat(result.score);
      if (score === 0) return `Murray ${result.score}: Sem lesão`;
      if (score <= 2.5) return `Murray ${result.score}: Leve-moderada`;
      return `Murray ${result.score}: SDRA grave`;
    },
    infoBox: {
      keyPoints: [
        'Murray LIS: media de 4 componentes (0-4 cada)',
        '0: Sem lesão | 0.1-2.5: Leve-moderada | >2.5: SDRA grave',
      ],
      reference: 'Murray JF et al. Am Rev Respir Dis 1988;138(3):720-3',
    },
  },
];

// =============================================================================
// SEÇÃO 9: RISCO E TROMBOEMBOLISMO (8 calculadoras)
// =============================================================================

const riscoCalculators = [
  {
    id: 'risco_goldman',
    title: 'Goldman',
    subtitle: 'Risco Cardíaco Perioperatório',
    icon: 'Heart',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'idade_70', label: 'Idade > 70 anos', type: 'bool', points: 5 },
      { id: 'iam_6m', label: 'IAM nos últimos 6 meses', type: 'bool', points: 10 },
      { id: 'b3_estase', label: 'B3 ou estase jugular', type: 'bool', points: 11 },
      { id: 'estenose_ao', label: 'Estenose aórtica importante', type: 'bool', points: 3 },
      { id: 'ritmo_nao_sinusal', label: 'Ritmo não sinusal ou ESV no ECG', type: 'bool', points: 7 },
      { id: 'esv_freq', label: '> 5 ESV/min documentadas', type: 'bool', points: 7 },
      { id: 'po2_pco2', label: 'PO2 < 60 ou PCO2 > 50', type: 'bool', points: 3 },
      { id: 'k_bic', label: 'K < 3 ou BIC < 20', type: 'bool', points: 3 },
      { id: 'ureia_cr', label: 'Ureia > 50 ou Cr > 3', type: 'bool', points: 3 },
      { id: 'tgo', label: 'TGO elevada ou hepatopatia', type: 'bool', points: 3 },
      { id: 'acamado', label: 'Acamado por causa não cardíaca', type: 'bool', points: 3 },
      { id: 'cirurgia_emergencia', label: 'Cirurgia de emergência', type: 'bool', points: 4 },
      { id: 'cirurgia_grande', label: 'Cirurgia intraperitoneal/torácica/aórtica', type: 'bool', points: 3 },
    ],
    compute: (values) => {
      let score = 0;
      const pontos = [5, 10, 11, 3, 7, 7, 3, 3, 3, 3, 3, 4, 3];
      const campos = ['idade_70', 'iam_6m', 'b3_estase', 'estenose_ao', 'ritmo_nao_sinusal', 'esv_freq', 'po2_pco2', 'k_bic', 'ureia_cr', 'tgo', 'acamado', 'cirurgia_emergência', 'cirurgia_grande'];
      campos.forEach((c, i) => { if (values[c]) score += pontos[i]; });

      let classe = 'I';
      let riscoComplicacao = '<1%';
      let riscoMorte = '0.2%';
      let risk = 'baixo';

      if (score > 25) {
        classe = 'IV';
        riscoComplicacao = '78%';
        riscoMorte = '56%';
        risk = 'critico';
      } else if (score > 12) {
        classe = 'III';
        riscoComplicacao = '14%';
        riscoMorte = '2%';
        risk = 'alto';
      } else if (score > 5) {
        classe = 'II';
        riscoComplicacao = '7%';
        riscoMorte = '2%';
        risk = 'medio';
      }

      return {
        score,
        risk,
        details: {
          'Classe Goldman': classe,
          'Risco de complicação cardíaca': riscoComplicacao,
          'Risco de morte cardíaca': riscoMorte,
          'Interpretação': classe === 'I' ? 'Baixo risco - Prosseguir' :
                          classe === 'II' ? 'Risco moderado - Otimizar' :
                          classe === 'III' ? 'Alto risco - Considerar alternativas' :
                          'Risco muito alto - Adiar se possível',
        },
      };
    },
    resultMessage: (result) => {
      if (result.score <= 5) return `Goldman ${result.score}: Classe I - Risco <1%`;
      if (result.score <= 12) return `Goldman ${result.score}: Classe II - Risco 7%`;
      if (result.score <= 25) return `Goldman ${result.score}: Classe III - Risco 14%`;
      return `Goldman ${result.score}: Classe IV - Risco 78%`;
    },
    infoBox: {
      keyPoints: [
        'Classe I (0-5 pts): Risco complicação <1%, morte 0.2%',
        'Classe II (6-12 pts): Risco complicação 7%, morte 2%',
        'Classe III (13-25 pts): Risco complicação 14%, morte 2%',
        'Classe IV (>25 pts): Risco complicação 78%, morte 56%',
        'Fatores principais: B3/estase jugular (+11), IAM <6m (+10)',
        'Score original de 1977 - menos usado atualmente que RCRI',
      ],
      reference: 'Goldman L et al. N Engl J Med 1977;297(16):845-850.',
    },
  },
  {
    id: 'risco_rcri',
    title: 'RCRI (Lee)',
    subtitle: 'Revised Cardiac Risk Index',
    icon: 'HeartPulse',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'alto_risco', label: 'Cirurgia de alto risco (intraperitoneal, intratorácica, vascular suprainguinal)', type: 'bool' },
      { id: 'cardiopatia', label: 'Cardiopatia isquêmica (IAM prévio, angina, teste de esforço positivo, uso de nitrato)', type: 'bool' },
      { id: 'icc', label: 'ICC (história de ICC, EAP, dispneia paroxística noturna, B3, estertores bilaterais, RX com congestão)', type: 'bool' },
      { id: 'avc', label: 'Doença cerebrovascular (AVC ou AIT prévio)', type: 'bool' },
      { id: 'dm_insulina', label: 'DM em uso de insulina', type: 'bool' },
      { id: 'creatinina', label: 'Creatinina > 2 mg/dL (ou > 177 umol/L)', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;
      if (values.alto_risco) score++;
      if (values.cardiopatia) score++;
      if (values.icc) score++;
      if (values.avc) score++;
      if (values.dm_insulina) score++;
      if (values.creatinina) score++;

      const riscos = [0.4, 0.9, 6.6, 11, 11, 11, 11];
      const riscoEvento = riscos[score];

      let risk = 'baixo';
      let estratificacao = 'Baixo risco';
      let conduta = 'Prosseguir com cirurgia';

      if (score >= 3) {
        risk = 'alto';
        estratificacao = 'Alto risco';
        conduta = 'Considerar teste funcional ou estrategia alternativa';
      } else if (score >= 2) {
        risk = 'medio';
        estratificacao = 'Risco intermediário';
        conduta = 'Avaliar capacidade funcional e tipo de cirurgia';
      } else if (score === 1) {
        estratificacao = 'Risco baixo-intermediário';
      }

      return {
        score,
        risk,
        details: {
          'Pontuação': `${score}/6`,
          'Risco de evento cardíaco maior': `${riscoEvento}%`,
          'Estratificação': estratificacao,
          'Conduta sugerida': conduta,
        },
      };
    },
    resultMessage: (result) => {
      return `RCRI ${result.score}: ${result.details['Estratificação']} - Risco ${result.details['Risco de evento cardíaco maior']}`;
    },
    infoBox: {
      keyPoints: [
        '0 fatores: Risco 0.4% | 1 fator: 0.9% | 2 fatores: 6.6% | >=3 fatores: 11%',
        'Cirurgia alto risco: Intraperitoneal, intratorácica, vascular suprainguinal',
        'Cardiopatia isquêmica: IAM prévio, angina, teste esforço positivo',
        'ICC: Historia, EAP, B3, estertores, congestão em RX',
        'Score mais utilizado na prática - substituiu Goldman',
        'Evento cardíaco maior = IAM, EAP, FV, PCR, BAVT',
      ],
      reference: 'Lee TH et al. Circulation 1999;100(10):1043-1049.',
    },
  },
  {
    id: 'risco_caprini',
    title: 'Caprini',
    subtitle: 'Risco de TEV Cirúrgico',
    icon: 'Activity',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'idade_41_60', label: 'Idade 41-60 anos (+1)', type: 'bool', points: 1 },
      { id: 'idade_61_74', label: 'Idade 61-74 anos (+2)', type: 'bool', points: 2 },
      { id: 'idade_75', label: 'Idade >= 75 anos (+3)', type: 'bool', points: 3 },
      { id: 'cirurgia_pequena', label: 'Cirurgia pequena (+1)', type: 'bool', points: 1 },
      { id: 'cirurgia_grande', label: 'Cirurgia grande > 45 min (+2)', type: 'bool', points: 2 },
      { id: 'varizes', label: 'Varizes (+1)', type: 'bool', points: 1 },
      { id: 'edema_mmii', label: 'Edema de MMII (+1)', type: 'bool', points: 1 },
      { id: 'obesidade', label: 'Obesidade IMC > 25 (+1)', type: 'bool', points: 1 },
      { id: 'repouso', label: 'Repouso no leito (+1)', type: 'bool', points: 1 },
      { id: 'hist_tev', label: 'História de TVP/TEP (+3)', type: 'bool', points: 3 },
      { id: 'hist_fam', label: 'História familiar de TEV (+3)', type: 'bool', points: 3 },
      { id: 'neoplasia', label: 'Neoplasia atual (+2)', type: 'bool', points: 2 },
      { id: 'avc', label: 'AVC < 1 mês (+5)', type: 'bool', points: 5 },
      { id: 'fratura', label: 'Fratura quadril/pelve/MMII (+5)', type: 'bool', points: 5 },
    ],
    compute: (values) => {
      let score = 0;
      if (values.idade_41_60) score += 1;
      if (values.idade_61_74) score += 2;
      if (values.idade_75) score += 3;
      if (values.cirurgia_pequena) score += 1;
      if (values.cirurgia_grande) score += 2;
      if (values.varizes) score += 1;
      if (values.edema_mmii) score += 1;
      if (values.obesidade) score += 1;
      if (values.repouso) score += 1;
      if (values.hist_tev) score += 3;
      if (values.hist_fam) score += 3;
      if (values.neoplasia) score += 2;
      if (values.avc) score += 5;
      if (values.fratura) score += 5;

      let categoria = '';
      let riscoTEV = '';
      let profilaxia = '';

      if (score === 0) {
        categoria = 'Muito baixo';
        riscoTEV = '<0.5%';
        profilaxia = 'Deambulação precoce apenas';
        return {
          score,
          risk: 'baixo',
          details: {
            'Categoria de risco': categoria,
            'Risco de TEV em 60 dias': riscoTEV,
            'Profilaxia recomendada': profilaxia,
          },
        };
      } else if (score <= 2) {
        categoria = 'Baixo';
        riscoTEV = '1.5%';
        profilaxia = 'Meias elasticas ou compressão pneumatica';
        return {
          score,
          risk: 'baixo',
          details: {
            'Categoria de risco': categoria,
            'Risco de TEV em 60 dias': riscoTEV,
            'Profilaxia recomendada': profilaxia,
          },
        };
      } else if (score <= 4) {
        categoria = 'Moderado';
        riscoTEV = '3%';
        profilaxia = 'Heparina profilatica (HBPM ou HNF)';
        return {
          score,
          risk: 'medio',
          details: {
            'Categoria de risco': categoria,
            'Risco de TEV em 60 dias': riscoTEV,
            'Profilaxia recomendada': profilaxia,
          },
        };
      } else {
        categoria = 'Alto';
        riscoTEV = '6%';
        profilaxia = 'Heparina profilatica + compressão pneumatica';
        return {
          score,
          risk: 'alto',
          details: {
            'Categoria de risco': categoria,
            'Risco de TEV em 60 dias': riscoTEV,
            'Profilaxia recomendada': profilaxia,
          },
        };
      }
    },
    resultMessage: (result) => {
      if (result.score === 0) return `Caprini 0: Risco muito baixo (${result.details['Risco de TEV em 60 dias']})`;
      if (result.score <= 2) return `Caprini ${result.score}: Risco baixo (${result.details['Risco de TEV em 60 dias']})`;
      if (result.score <= 4) return `Caprini ${result.score}: Risco moderado (${result.details['Risco de TEV em 60 dias']})`;
      return `Caprini ${result.score}: Risco alto (${result.details['Risco de TEV em 60 dias']})`;
    },
    infoBox: {
      keyPoints: [
        '0 pts: Muito baixo (<0.5%) - Deambulação precoce',
        '1-2 pts: Baixo (1.5%) - Meias ou compressão pneumatica',
        '3-4 pts: Moderado (3%) - Heparina profilatica',
        '>=5 pts: Alto (6%) - Heparina + compressão mecânica',
        'Fatores maiores: AVC recente (+5), Fratura MMII (+5), TEV prévio (+3)',
        'Score para pacientes CIRURGICOS - usar Padua para clínicos',
      ],
      reference: 'Caprini JA. Dis Mon 2005;51(2-3):70-78 | Bahl V et al. Ann Surg 2010.',
    },
  },
  {
    id: 'risco_padua',
    title: 'Padua',
    subtitle: 'Risco de TEV em Pacientes Clínicos',
    icon: 'Bed',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'neoplasia', label: 'Neoplasia ativa (metastases, QT/RT <6m, ou cuidados paliativos) (+3)', type: 'bool', points: 3 },
      { id: 'tev_prévio', label: 'TEV prévio (exceto TVS) (+3)', type: 'bool', points: 3 },
      { id: 'mobilidade_reduzida', label: 'Mobilidade reduzida (repouso no leito >= 3 dias) (+3)', type: 'bool', points: 3 },
      { id: 'trombofilia', label: 'Trombofilia conhecida (+3)', type: 'bool', points: 3 },
      { id: 'trauma_cirurgia', label: 'Trauma ou cirurgia recente <= 1 mês (+2)', type: 'bool', points: 2 },
      { id: 'idade_70', label: 'Idade >= 70 anos (+1)', type: 'bool', points: 1 },
      { id: 'icc_ir', label: 'ICC ou IR (+1)', type: 'bool', points: 1 },
      { id: 'iam_avc', label: 'IAM ou AVC isquemico (+1)', type: 'bool', points: 1 },
      { id: 'infeccao', label: 'Infecção aguda ou doença reumatológica (+1)', type: 'bool', points: 1 },
      { id: 'obesidade', label: 'Obesidade IMC >= 30 (+1)', type: 'bool', points: 1 },
      { id: 'hormonio', label: 'Terapia hormonal em curso (+1)', type: 'bool', points: 1 },
    ],
    compute: (values) => {
      let score = 0;
      if (values.neoplasia) score += 3;
      if (values.tev_prévio) score += 3;
      if (values.mobilidade_reduzida) score += 3;
      if (values.trombofilia) score += 3;
      if (values.trauma_cirurgia) score += 2;
      if (values.idade_70) score += 1;
      if (values.icc_ir) score += 1;
      if (values.iam_avc) score += 1;
      if (values.infeccao) score += 1;
      if (values.obesidade) score += 1;
      if (values.hormonio) score += 1;

      const altoRisco = score >= 4;

      if (altoRisco) {
        return {
          score,
          risk: 'alto',
          details: {
            'Pontuação': `${score}/20`,
            'Categoria': 'ALTO RISCO',
            'Risco de TEV em 90 dias': '11%',
            'Profilaxia': 'HBPM ou HNF recomendada',
          },
        };
      } else {
        return {
          score,
          risk: 'baixo',
          details: {
            'Pontuação': `${score}/20`,
            'Categoria': 'Baixo risco',
            'Risco de TEV em 90 dias': '0.3%',
            'Profilaxia': 'Não indicada rotineiramente',
          },
        };
      }
    },
    resultMessage: (result) => {
      if (result.score < 4) return `Padua ${result.score}: Baixo risco de TEV (${result.details['Risco de TEV em 90 dias']})`;
      return `Padua ${result.score}: Alto risco de TEV (${result.details['Risco de TEV em 90 dias']}) - Profilaxia indicada`;
    },
    infoBox: {
      keyPoints: [
        'Score >= 4: Alto risco (11% TEV em 90 dias) - Profilaxia indicada',
        'Score < 4: Baixo risco (0.3% TEV) - Profilaxia não indicada',
        'Fatores maiores (+3): Neoplasia ativa, TEV prévio, imobilidade, trombofilia',
        'Aplicável a pacientes CLINICOS internados',
        'Para pacientes cirúrgicos usar Caprini',
        'HBPM preferida sobre HNF quando TFG > 30 mL/min',
      ],
      reference: 'Barbar S et al. J Thromb Haemost 2010;8(11):2450-2457.',
    },
  },
  {
    id: 'risco_timi',
    title: 'TIMI Risk Score',
    subtitle: 'IAMSSST / Angina Instável',
    icon: 'Heart',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'idade_65', label: 'Idade >= 65 anos', type: 'bool' },
      { id: 'fatores_risco', label: '>= 3 fatores de risco para DAC', type: 'bool' },
      { id: 'dac_conhecida', label: 'DAC conhecida (estenose >= 50%)', type: 'bool' },
      { id: 'aas', label: 'Uso de AAS nos últimos 7 dias', type: 'bool' },
      { id: 'angina_recente', label: '>= 2 episódios de angina nas últimas 24h', type: 'bool' },
      { id: 'infra_st', label: 'Infra de ST >= 0.5mm', type: 'bool' },
      { id: 'marcadores', label: 'Marcadores cardíacos elevados', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;
      if (values.idade_65) score += 1;
      if (values.fatores_risco) score += 1;
      if (values.dac_conhecida) score += 1;
      if (values.aas) score += 1;
      if (values.angina_recente) score += 1;
      if (values.infra_st) score += 1;
      if (values.marcadores) score += 1;

      // Risco de eventos em 14 dias (morte, IAM, revascularização urgente)
      const riscosEvento = [4.7, 4.7, 8.3, 13.2, 19.9, 26.2, 40.9, 40.9];
      const riscoEvento = riscosEvento[score] || riscosEvento[7];

      return {
        score,
        details: {
          'Pontuação': `${score}/7`,
          'Risco de evento em 14 dias': `${riscoEvento}%`,
          'Estratificação': score <= 2 ? 'Baixo risco' : score <= 4 ? 'Risco intermediário' : 'Alto risco',
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os critérios';
      if (result.score <= 2) return `TIMI ${result.score}: Baixo risco (~${result.details['Risco de evento em 14 dias']})`;
      if (result.score <= 4) return `TIMI ${result.score}: Risco intermediário (~${result.details['Risco de evento em 14 dias']})`;
      return `TIMI ${result.score}: Alto risco (~${result.details['Risco de evento em 14 dias']})`;
    },
    infoBox: {
      keyPoints: [
        'Idade >= 65 anos (+1)',
        '>= 3 fatores de risco DAC (+1): HAS, DM, dislipidemia, tabagismo, história familiar',
        'DAC conhecida (estenose >= 50%) (+1)',
        'Uso de AAS nos últimos 7 dias (+1)',
        '>= 2 episódios de angina nas últimas 24h (+1)',
        'Infra de ST >= 0.5mm no ECG (+1)',
        'Marcadores cardíacos elevados (troponina/CKMB) (+1)',
        'Score 0-2: Baixo risco | 3-4: Intermediário | 5-7: Alto risco',
      ],
      reference: 'Antman EM et al. JAMA 2000;284(7):835-842.',
    },
  },
  {
    id: 'risco_heart',
    title: 'HEART Score',
    subtitle: 'Dor Torácica na Emergência',
    icon: 'HeartPulse',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'historia',
        label: 'História clínica',
        type: 'select',
        options: [
          { value: 0, label: '0 - Leve suspeita (atipica)' },
          { value: 1, label: '1 - Suspeita moderada' },
          { value: 2, label: '2 - Alta suspeita (tipica)' },
        ],
      },
      {
        id: 'ecg',
        label: 'ECG',
        type: 'select',
        options: [
          { value: 0, label: '0 - Normal' },
          { value: 1, label: '1 - Alteracoes inespecíficas (BRE, HVE)' },
          { value: 2, label: '2 - Desvio ST significativo' },
        ],
      },
      {
        id: 'idade',
        label: 'Idade',
        type: 'select',
        options: [
          { value: 0, label: '0 - < 45 anos' },
          { value: 1, label: '1 - 45-64 anos' },
          { value: 2, label: '2 - >= 65 anos' },
        ],
      },
      {
        id: 'fatores',
        label: 'Fatores de risco',
        type: 'select',
        options: [
          { value: 0, label: '0 - Nenhum fator conhecido' },
          { value: 1, label: '1 - 1-2 fatores (HAS, DM, tabagismo, obesidade, dislipidemia, HF)' },
          { value: 2, label: '2 - >= 3 fatores OU história de DAC' },
        ],
      },
      {
        id: 'troponina',
        label: 'Troponina',
        type: 'select',
        options: [
          { value: 0, label: '0 - Normal' },
          { value: 1, label: '1 - 1-3x limite superior' },
          { value: 2, label: '2 - > 3x limite superior' },
        ],
      },
    ],
    compute: (values) => {
      const historia = parseInt(values.historia) || 0;
      const ecg = parseInt(values.ecg) || 0;
      const idade = parseInt(values.idade) || 0;
      const fatores = parseInt(values.fatores) || 0;
      const troponina = parseInt(values.troponina) || 0;

      const score = historia + ecg + idade + fatores + troponina;

      // Risco de MACE (Major Adverse Cardiac Event) em 6 semanas
      let riscoMACE = '';
      let conduta = '';
      if (score <= 3) {
        riscoMACE = '0.9-1.7%';
        conduta = 'Baixo risco - Considerar alta precoce';
      } else if (score <= 6) {
        riscoMACE = '12-16.6%';
        conduta = 'Risco intermediário - Observação e investigação';
      } else {
        riscoMACE = '50-65%';
        conduta = 'Alto risco - Internação e estrategia invasiva';
      }

      return {
        score,
        details: {
          'Pontuação': `${score}/10`,
          'Risco de MACE em 6 semanas': riscoMACE,
          'Conduta sugerida': conduta,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os critérios';
      return `HEART ${result.score}: ${result.details['Conduta sugerida']}`;
    },
    infoBox: {
      keyPoints: [
        'H - Historia: 0 (atipica), 1 (moderada), 2 (tipica)',
        'E - ECG: 0 (normal), 1 (inespecífico), 2 (desvio ST)',
        'A - Age/Idade: 0 (<45), 1 (45-64), 2 (>=65)',
        'R - Risk factors: 0 (nenhum), 1 (1-2), 2 (>=3 ou DAC previa)',
        'T - Troponina: 0 (normal), 1 (1-3x), 2 (>3x)',
        'Score 0-3: Baixo risco | 4-6: Intermediário | 7-10: Alto risco',
      ],
      reference: 'Six AJ et al. Neth Heart J 2008;16(6):191-196 | Backus BE et al. Int J Cardiol 2013;168(3):2153-2158.',
    },
  },
  {
    id: 'risco_chadsvasc',
    title: 'CHA2DS2-VASc',
    subtitle: 'Risco de AVC em FA',
    icon: 'Activity',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'icc', label: 'C - Insuficiência Cardíaca Congestiva / disfunção VE', type: 'bool' },
      { id: 'has', label: 'H - Hipertensao', type: 'bool' },
      { id: 'idade_75', label: 'A2 - Idade >= 75 anos', type: 'bool' },
      { id: 'dm', label: 'D - Diabetes Mellitus', type: 'bool' },
      { id: 'avc_ait', label: 'S2 - AVC / AIT / Tromboembolismo prévio', type: 'bool' },
      { id: 'vascular', label: 'V - Doença vascular (IAM, DAP, placa aórtica)', type: 'bool' },
      { id: 'idade_65_74', label: 'A - Idade 65-74 anos', type: 'bool' },
      { id: 'sexo_fem', label: 'Sc - Sexo feminino', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;
      if (values.icc) score += 1;
      if (values.has) score += 1;
      if (values.idade_75) score += 2;
      if (values.dm) score += 1;
      if (values.avc_ait) score += 2;
      if (values.vascular) score += 1;
      if (values.idade_65_74) score += 1;
      if (values.sexo_fem) score += 1;

      // Risco anual de AVC (%) - Lip GY et al.
      const riscosAVC = [0, 1.3, 2.2, 3.2, 4.0, 6.7, 9.8, 9.6, 6.7, 15.2];
      const riscoAVC = riscosAVC[score] || riscosAVC[9];

      let conduta = '';
      if (score === 0) {
        conduta = 'Sem necessidade de anticoagulação';
      } else if (score === 1 && values.sexo_fem && !values.icc && !values.has && !values.idade_75 && !values.dm && !values.avc_ait && !values.vascular && !values.idade_65_74) {
        conduta = 'Sexo feminino isolado - Considerar não anticoagular';
      } else if (score === 1) {
        conduta = 'Considerar anticoagulação oral';
      } else {
        conduta = 'Anticoagulação oral recomendada';
      }

      return {
        score,
        details: {
          'Pontuação': `${score}/9`,
          'Risco anual de AVC': `${riscoAVC}%`,
          'Recomendação': conduta,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os critérios';
      return `CHA2DS2-VASc ${result.score}: Risco AVC ${result.details['Risco anual de AVC']}/ano - ${result.details['Recomendação']}`;
    },
    infoBox: {
      keyPoints: [
        'C - ICC/Disfunção VE (+1)',
        'H - Hipertensao (+1)',
        'A2 - Idade >= 75 anos (+2)',
        'D - Diabetes (+1)',
        'S2 - AVC/AIT/TE prévio (+2)',
        'V - Doença vascular (+1)',
        'A - Idade 65-74 anos (+1)',
        'Sc - Sexo feminino (+1)',
        'Score 0: Não anticoagular | Score 1 (não isolado fem): Considerar | Score >= 2: Anticoagular',
      ],
      warnings: [
        'Sexo feminino isolado (score 1 apenas por ser mulher) não requer anticoagulação',
      ],
      reference: 'Lip GY et al. Chest 2010;137(2):263-272 | ESC Guidelines FA 2020.',
    },
  },
  {
    id: 'risco_hasbled',
    title: 'HAS-BLED',
    subtitle: 'Risco de Sangramento em FA',
    icon: 'Droplet',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'has_descontrolada', label: 'H - Hipertensao (PAS > 160 mmHg)', type: 'bool' },
      { id: 'disfuncao_renal', label: 'A - Disfunção renal (diálise, Cr > 2.3 ou transplante)', type: 'bool' },
      { id: 'disfuncao_hepatica', label: 'A - Disfunção hepática (cirrose, bili > 2x, TGO/TGP > 3x)', type: 'bool' },
      { id: 'avc', label: 'S - AVC prévio', type: 'bool' },
      { id: 'sangramento', label: 'B - Sangramento prévio ou predisposição', type: 'bool' },
      { id: 'inr_labil', label: 'L - INR labil (TTR < 60%)', type: 'bool' },
      { id: 'idoso', label: 'E - Idade > 65 anos', type: 'bool' },
      { id: 'drogas', label: 'D - Uso de AAS, clopidogrel ou AINE', type: 'bool' },
      { id: 'alcool', label: 'D - Alcoolismo (>= 8 doses/semana)', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;
      if (values.has_descontrolada) score += 1;
      if (values.disfuncao_renal) score += 1;
      if (values.disfuncao_hepatica) score += 1;
      if (values.avc) score += 1;
      if (values.sangramento) score += 1;
      if (values.inr_labil) score += 1;
      if (values.idoso) score += 1;
      if (values.drogas) score += 1;
      if (values.alcool) score += 1;

      // Risco anual de sangramento maior
      let riscoSangramento = '';
      let interpretacao = '';
      if (score <= 2) {
        riscoSangramento = '1.0-3.7%';
        interpretacao = 'Baixo risco de sangramento';
      } else {
        riscoSangramento = '> 3.7%';
        interpretacao = 'Alto risco de sangramento - Cautela e correção de fatores modificaveis';
      }

      return {
        score,
        details: {
          'Pontuação': `${score}/9`,
          'Risco anual de sangramento maior': riscoSangramento,
          'Interpretação': interpretacao,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os critérios';
      if (result.score <= 2) return `HAS-BLED ${result.score}: Baixo risco de sangramento`;
      return `HAS-BLED ${result.score}: Alto risco - Cautela com anticoagulação`;
    },
    infoBox: {
      keyPoints: [
        'H - Hipertensao descontrolada (PAS > 160) (+1)',
        'A - Alteração renal OU hepática (+1 cada, max 2)',
        'S - Stroke/AVC prévio (+1)',
        'B - Bleeding/Sangramento prévio (+1)',
        'L - Labile INR (TTR < 60%) (+1)',
        'E - Elderly/Idoso > 65 anos (+1)',
        'D - Drugs/Drogas antiplaquetarias ou AINE (+1)',
        'D - Alcool >= 8 doses/semana (+1)',
        'Score >= 3: Alto risco - NÃO contraindica anticoagulação, mas alerta para correção de fatores',
      ],
      warnings: [
        'HAS-BLED alto NÃO contraindica anticoagulação',
        'Serve para identificar fatores modificaveis',
      ],
      reference: 'Pisters R et al. Chest 2010;138(5):1093-1100 | ESC Guidelines FA 2020.',
    },
  },
];

// =============================================================================
// SEÇÃO 10: RISCO RESPIRATORIO (4 calculadoras)
// =============================================================================

const respCalculators = [
  {
    id: 'resp_ariscat',
    title: 'ARISCAT',
    subtitle: 'Risco Complicação Pulmonar',
    icon: 'Wind',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'idade',
        label: 'Idade',
        type: 'select',
        options: [
          { value: 'idade_50', label: '≤ 50 anos' },
          { value: 'idade_51_80', label: '51-80 anos (+3)' },
          { value: 'idade_80', label: '> 80 anos (+16)' },
        ],
      },
      {
        id: 'spo2',
        label: 'SpO2 pré-operatória',
        type: 'select',
        options: [
          { value: 'spo2_96', label: '≥ 96%' },
          { value: 'spo2_91_95', label: '91-95% (+8)' },
          { value: 'spo2_90', label: '≤ 90% (+24)' },
        ],
      },
      { id: 'ivr_30dias', label: 'Infecção respiratória no último mês (+17)', type: 'bool' },
      { id: 'anemia', label: 'Anemia pre-op (Hb ≤ 10 g/dL) (+11)', type: 'bool' },
      {
        id: 'cirurgia',
        label: 'Incisao cirúrgica',
        type: 'select',
        options: [
          { value: 'cir_periferica', label: 'Periferica' },
          { value: 'cir_abd_alta', label: 'Abdominal alta (+15)' },
          { value: 'cir_toracica', label: 'Intratorácica (+24)' },
        ],
      },
      {
        id: 'duracao',
        label: 'Duração prevista da cirurgia',
        type: 'select',
        options: [
          { value: 'dur_2h', label: '≤ 2 horas' },
          { value: 'dur_2_3h', label: '2-3 horas (+16)' },
          { value: 'dur_3h', label: '> 3 horas (+23)' },
        ],
      },
      { id: 'emergencia', label: 'Cirurgia de emergência (+8)', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;

      // Idade
      const idadeMap = { idade_50: 0, idade_51_80: 3, idade_80: 16 };
      score += idadeMap[values.idade] || 0;

      // SpO2
      const spo2Map = { spo2_96: 0, spo2_91_95: 8, spo2_90: 24 };
      score += spo2Map[values.spo2] || 0;

      // Fatores booleanos
      if (values.ivr_30dias) score += 17;
      if (values.anemia) score += 11;
      if (values.emergencia) score += 8;

      // Incisao cirúrgica
      const cirMap = { cir_periferica: 0, cir_abd_alta: 15, cir_toracica: 24 };
      score += cirMap[values.cirurgia] || 0;

      // Duração
      const durMap = { dur_2h: 0, dur_2_3h: 16, dur_3h: 23 };
      score += durMap[values.duracao] || 0;

      // Classificação de risco
      let categoria, riscoPercent, conduta;
      if (score < 26) {
        categoria = 'Baixo risco';
        riscoPercent = '< 1.6%';
        conduta = 'Manejo padrão, sem medidas específicas';
        return {
          score,
          risk: 'baixo',
          riskLabel: 'Baixo risco (1.6%)',
          details: {
            'Pontuação': `${score}/123`,
            'Categoria': categoria,
            'Risco de CPP': riscoPercent,
            'Conduta': conduta,
          },
        };
      } else if (score < 45) {
        categoria = 'Risco intermediário';
        riscoPercent = '~13%';
        conduta = 'Considerar fisioterapia respiratória pre e pós-op';
        return {
          score,
          risk: 'medio',
          riskLabel: 'Intermediário (13%)',
          details: {
            'Pontuação': `${score}/123`,
            'Categoria': categoria,
            'Risco de CPP': riscoPercent,
            'Conduta': conduta,
          },
        };
      } else {
        categoria = 'Alto risco';
        riscoPercent = '~42%';
        conduta = 'Otimização pre-op, UTI pós-op, fisioterapia intensiva';
        return {
          score,
          risk: 'alto',
          riskLabel: 'Alto (42%)',
          details: {
            'Pontuação': `${score}/123`,
            'Categoria': categoria,
            'Risco de CPP': riscoPercent,
            'Conduta': conduta,
          },
        };
      }
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      if (result.score < 26) return `ARISCAT ${result.score}: Baixo risco (< 1.6%)`;
      if (result.score < 45) return `ARISCAT ${result.score}: Risco intermediário (~13%)`;
      return `ARISCAT ${result.score}: Alto risco (~42%)`;
    },
    infoBox: {
      keyPoints: [
        'ARISCAT: Assess Respiratory Risk in Surgical Patients in Catalonia',
        'Prediz risco de complicações pulmonares pós-operatórias (CPP)',
        'CPP incluem: infecção respiratória, insuficiência respiratória, atelectasia, derrame pleural, broncoespasmo',
        'Baixo risco (<26): 1.6% | Intermediário (26-44): 13% | Alto (≥45): 42%',
        'Validado em população europeia, >2000 pacientes',
      ],
      warnings: [
        'Score desenvolvido para cirurgias não cardíacas',
      ],
      reference: 'Canet J et al. Anesthesiology 2010;113(6):1338-50',
    },
  },
  {
    id: 'resp_stopbang',
    title: 'STOP-Bang',
    subtitle: 'Risco de SAOS',
    icon: 'Moon',
    status: 'active',
    inputs: [
      { id: 'snore', label: 'S - Snoring: Ronca alto (ouvido atraves de porta fechada)?', type: 'bool' },
      { id: 'tired', label: 'T - Tired: Frequentemente cansado ou sonolento durante o dia?', type: 'bool' },
      { id: 'observed', label: 'O - Observed: Alguem observou apneia durante o sono?', type: 'bool' },
      { id: 'pressure', label: 'P - Pressure: Hipertensao arterial (tratada ou nao)?', type: 'bool' },
      { id: 'bmi', label: 'B - BMI: IMC > 35 kg/m²?', type: 'bool' },
      { id: 'age', label: 'A - Age: Idade > 50 anos?', type: 'bool' },
      { id: 'neck', label: 'N - Neck: Circunferência cervical > 40cm (H) ou > 38cm (M)?', type: 'bool' },
      { id: 'gender', label: 'G - Gender: Sexo masculino?', type: 'bool' },
    ],
    compute: (values) => {
      let score = 0;
      if (values.snore) score++;
      if (values.tired) score++;
      if (values.observed) score++;
      if (values.pressure) score++;
      if (values.bmi) score++;
      if (values.age) score++;
      if (values.neck) score++;
      if (values.gender) score++;

      let categoria, probabilidade, conduta;
      if (score <= 2) {
        categoria = 'Baixo risco';
        probabilidade = '~15%';
        conduta = 'Manejo perioperatório padrão';
        return {
          score,
          risk: 'baixo',
          riskLabel: 'Baixo risco',
          details: {
            'Pontuação': `${score}/8`,
            'Categoria': categoria,
            'Probabilidade de SAOS moderado-grave': probabilidade,
            'Conduta': conduta,
          },
        };
      } else if (score <= 4) {
        categoria = 'Risco intermediário';
        probabilidade = '~35%';
        conduta = 'Considerar polissonografia ou avaliar sinais clínicos de SAOS';
        return {
          score,
          risk: 'medio',
          riskLabel: 'Intermediário',
          details: {
            'Pontuação': `${score}/8`,
            'Categoria': categoria,
            'Probabilidade de SAOS moderado-grave': probabilidade,
            'Conduta': conduta,
          },
        };
      } else {
        categoria = 'Alto risco';
        probabilidade = '~60-80%';
        conduta = 'Polissonografia recomendada. Precauções perioperatórias para SAOS';
        return {
          score,
          risk: 'alto',
          riskLabel: 'Alto risco',
          details: {
            'Pontuação': `${score}/8`,
            'Categoria': categoria,
            'Probabilidade de SAOS moderado-grave': probabilidade,
            'Conduta': conduta,
            'Precauções': 'Evitar sedação excessiva, monitorar pós-op, considerar CPAP',
          },
        };
      }
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      if (result.score <= 2) return `STOP-Bang ${result.score}: Baixo risco de SAOS`;
      if (result.score <= 4) return `STOP-Bang ${result.score}: Risco intermediário de SAOS`;
      return `STOP-Bang ${result.score}: Alto risco de SAOS`;
    },
    infoBox: {
      keyPoints: [
        'STOP-Bang: Ferramenta de triagem para SAOS (Síndrome da Apneia Obstrutiva do Sono)',
        '0-2 pontos: Baixo risco | 3-4 pontos: Intermediário | 5-8 pontos: Alto risco',
        'Alto risco: Sensibilidade ~90% para SAOS moderado-grave (IAH ≥15)',
        'SAOS não diagnosticado aumenta risco perioperatório: hipoxemia, arritmias, IOT difícil',
        'Circunferência cervical: medir na altura da cartilagem tireoide',
      ],
      warnings: [
        'Triagem apenas - confirmação requer polissonografia (IAH)',
      ],
      reference: 'Chung F et al. Anesthesiology 2008;108(5):812-21',
    },
  },
  {
    id: 'resp_pf',
    title: 'Relação PaO2/FiO2',
    subtitle: 'Classificação Berlin (SDRA)',
    icon: 'Activity',
    status: 'active',
    inputs: [
      { id: 'pao2', label: 'PaO2 (mmHg)', type: 'number', min: 20, max: 600, step: 1 },
      { id: 'fio2', label: 'FiO2 (%)', type: 'number', min: 21, max: 100, step: 1 },
      { id: 'peep', label: 'PEEP (cmH2O) - opcional', type: 'number', min: 0, max: 30, step: 1 },
      { id: 'altitude', label: 'Altitude elevada (>1000m)?', type: 'bool' },
    ],
    compute: (values) => {
      const pao2 = parseFloat(values.pao2) || 0;
      const fio2Percent = parseFloat(values.fio2) || 0;
      const peep = parseFloat(values.peep) || 0;
      const altitude = values.altitude || false;

      if (pao2 <= 0 || fio2Percent <= 0) return null;

      // Converter FiO2 de % para decimal
      const fio2 = fio2Percent / 100;
      const pf = pao2 / fio2;

      // Para altitude elevada, ajuste de PaO2 esperada pode ser necessário
      // Berlin não específica ajuste, mas mencionar

      let categoria, gravidade, mortalidade, conduta;

      if (pf >= 300) {
        categoria = 'Normal';
        gravidade = 'Sem critério para SDRA';
        mortalidade = '-';
        conduta = 'Investigar outras causas de hipoxemia se presente';
        return {
          score: Math.round(pf),
          risk: 'baixo',
          riskLabel: 'Normal',
          details: {
            'Relação P/F': `${pf.toFixed(0)} mmHg`,
            'PaO2': `${pao2} mmHg`,
            'FiO2': `${fio2Percent}%`,
            'Classificação Berlin': categoria,
            'Interpretação': gravidade,
          },
        };
      } else if (pf >= 200) {
        categoria = 'Leve';
        gravidade = 'SDRA Leve';
        mortalidade = '~27%';
        conduta = 'PEEP ≥5 cmH2O, ventilação protetora (VT 6mL/kg PBW)';
        return {
          score: Math.round(pf),
          risk: 'baixo',
          riskLabel: 'Leve',
          details: {
            'Relação P/F': `${pf.toFixed(0)} mmHg`,
            'PaO2': `${pao2} mmHg`,
            'FiO2': `${fio2Percent}%`,
            'Classificação Berlin': categoria,
            'Mortalidade hospitalar': mortalidade,
            'Conduta': conduta,
          },
        };
      } else if (pf >= 100) {
        categoria = 'Moderada';
        gravidade = 'SDRA Moderada';
        mortalidade = '~32%';
        conduta = 'Ventilação protetora, considerar prona se P/F <150';
        return {
          score: Math.round(pf),
          risk: 'medio',
          riskLabel: 'Moderada',
          details: {
            'Relação P/F': `${pf.toFixed(0)} mmHg`,
            'PaO2': `${pao2} mmHg`,
            'FiO2': `${fio2Percent}%`,
            'Classificação Berlin': categoria,
            'Mortalidade hospitalar': mortalidade,
            'Conduta': conduta,
          },
        };
      } else {
        categoria = 'Grave';
        gravidade = 'SDRA Grave';
        mortalidade = '~45%';
        conduta = 'Prona precoce, BNM, considerar ECMO se P/F <80';
        return {
          score: Math.round(pf),
          risk: 'alto',
          riskLabel: 'Grave',
          details: {
            'Relação P/F': `${pf.toFixed(0)} mmHg`,
            'PaO2': `${pao2} mmHg`,
            'FiO2': `${fio2Percent}%`,
            'Classificação Berlin': categoria,
            'Mortalidade hospitalar': mortalidade,
            'Conduta': conduta,
            'Alerta': 'Considerar ECMO se refratario',
          },
        };
      }
    },
    resultMessage: (result) => {
      if (!result) return 'Informe PaO2 e FiO2';
      const pf = result.score;
      if (pf >= 300) return `P/F ${pf}: Normal (sem critério SDRA)`;
      if (pf >= 200) return `P/F ${pf}: SDRA Leve`;
      if (pf >= 100) return `P/F ${pf}: SDRA Moderada`;
      return `P/F ${pf}: SDRA Grave`;
    },
    infoBox: {
      keyPoints: [
        'P/F = PaO2 (mmHg) / FiO2 (decimal). Ex: 80/0.60 = 133',
        'Berlin 2012: ≥300 (normal) | 200-299 (leve) | 100-199 (moderada) | <100 (grave)',
        'Critérios SDRA: início agudo, infiltrado bilateral, origem não cardiogenica, PEEP ≥5',
        'Prona indicada se P/F <150 com FiO2 ≥0.6 por ≥12-16h/dia',
        'ECMO veno-venoso: considerar se P/F <80 refratario',
      ],
      warnings: [
        'Classificação requer PEEP >=5 cmH2O e exclusao de causa cardiogenica',
      ],
      reference: 'ARDS Definition Task Force. JAMA 2012;307(23):2526-33 (Berlin Definition)',
    },
  },
  {
    id: 'resp_murray',
    title: 'Murray Score',
    subtitle: 'Lung Injury Score (LIS)',
    icon: 'Wind',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'rx',
        label: 'Radiografia de Torax',
        type: 'select',
        options: [
          { value: 'rx_0', label: 'Sem consolidação alveolar (0)' },
          { value: 'rx_1', label: '1 quadrante com consolidação (1)' },
          { value: 'rx_2', label: '2 quadrantes (2)' },
          { value: 'rx_3', label: '3 quadrantes (3)' },
          { value: 'rx_4', label: '4 quadrantes (4)' },
        ],
      },
      {
        id: 'pf',
        label: 'Relação PaO2/FiO2',
        type: 'select',
        options: [
          { value: 'pf_0', label: '≥ 300 (0)' },
          { value: 'pf_1', label: '225-299 (1)' },
          { value: 'pf_2', label: '175-224 (2)' },
          { value: 'pf_3', label: '100-174 (3)' },
          { value: 'pf_4', label: '< 100 (4)' },
        ],
      },
      {
        id: 'peep',
        label: 'PEEP (cmH2O)',
        type: 'select',
        options: [
          { value: 'peep_0', label: '≤ 5 cmH2O (0)' },
          { value: 'peep_1', label: '6-8 cmH2O (1)' },
          { value: 'peep_2', label: '9-11 cmH2O (2)' },
          { value: 'peep_3', label: '12-14 cmH2O (3)' },
          { value: 'peep_4', label: '≥ 15 cmH2O (4)' },
        ],
      },
      {
        id: 'complacencia',
        label: 'Complacência Estatica (mL/cmH2O)',
        type: 'select',
        options: [
          { value: 'comp_0', label: '≥ 80 (0)' },
          { value: 'comp_1', label: '60-79 (1)' },
          { value: 'comp_2', label: '40-59 (2)' },
          { value: 'comp_3', label: '20-39 (3)' },
          { value: 'comp_4', label: '≤ 19 (4)' },
          { value: 'comp_na', label: 'Não disponível' },
        ],
      },
    ],
    compute: (values) => {
      // Mapeamento de pontos
      const rxMap = { rx_0: 0, rx_1: 1, rx_2: 2, rx_3: 3, rx_4: 4 };
      const pfMap = { pf_0: 0, pf_1: 1, pf_2: 2, pf_3: 3, pf_4: 4 };
      const peepMap = { peep_0: 0, peep_1: 1, peep_2: 2, peep_3: 3, peep_4: 4 };
      const compMap = { comp_0: 0, comp_1: 1, comp_2: 2, comp_3: 3, comp_4: 4, comp_na: null };

      const rxPts = rxMap[values.rx];
      const pfPts = pfMap[values.pf];
      const peepPts = peepMap[values.peep];
      const compPts = compMap[values.complacencia];

      // Verificar se temos dados suficientes
      if (rxPts === undefined || pfPts === undefined || peepPts === undefined) return null;

      // Calcular media (3 ou 4 componentes)
      let soma = rxPts + pfPts + peepPts;
      let componentes = 3;
      let compInfo = 'Não disponível';

      if (compPts !== null && compPts !== undefined) {
        soma += compPts;
        componentes = 4;
        compInfo = `${compPts} pontos`;
      }

      const score = soma / componentes;

      // Classificação
      let categoria, interpretacao, conduta;
      if (score === 0) {
        categoria = 'Sem lesão pulmonar';
        interpretacao = 'Pulmao normal';
        conduta = 'Manejo padrão';
        return {
          score: score.toFixed(1),
          risk: 'baixo',
          riskLabel: 'Sem lesão',
          details: {
            'Score Murray': `${score.toFixed(1)}/4`,
            'Componentes': `${componentes} (RX: ${rxPts}, P/F: ${pfPts}, PEEP: ${peepPts}, Comp: ${compInfo})`,
            'Classificação': categoria,
            'Conduta': conduta,
          },
        };
      } else if (score <= 2.5) {
        categoria = 'Lesão pulmonar leve a moderada';
        interpretacao = 'ALI (Acute Lung Injury)';
        conduta = 'Ventilação protetora, tratar causa base';
        return {
          score: score.toFixed(1),
          risk: 'medio',
          riskLabel: 'Leve a moderada',
          details: {
            'Score Murray': `${score.toFixed(1)}/4`,
            'Componentes': `${componentes} (RX: ${rxPts}, P/F: ${pfPts}, PEEP: ${peepPts}, Comp: ${compInfo})`,
            'Classificação': categoria,
            'Conduta': conduta,
          },
        };
      } else {
        categoria = 'Lesão pulmonar grave (SDRA grave)';
        interpretacao = 'SDRA grave - considerar ECMO';
        conduta = 'Prona, BNM, recrutar. Avaliar critérios para ECMO';
        return {
          score: score.toFixed(1),
          risk: 'alto',
          riskLabel: 'SDRA grave',
          details: {
            'Score Murray': `${score.toFixed(1)}/4`,
            'Componentes': `${componentes} (RX: ${rxPts}, P/F: ${pfPts}, PEEP: ${peepPts}, Comp: ${compInfo})`,
            'Classificação': categoria,
            'Conduta': conduta,
            'ECMO': 'Murray >3.0 e um dos critérios para referênciar ECMO',
          },
        };
      }
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos obrigatórios';
      const score = parseFloat(result.score);
      if (score === 0) return `Murray ${result.score}: Sem lesão pulmonar`;
      if (score <= 2.5) return `Murray ${result.score}: Lesão pulmonar leve-moderada`;
      return `Murray ${result.score}: Lesão pulmonar GRAVE`;
    },
    infoBox: {
      keyPoints: [
        'Lung Injury Score (LIS): media de 4 componentes (0-4 cada)',
        '0: Sem lesão | 0.1-2.5: Leve a moderada | >2.5: SDRA grave',
        'Componentes: RX torax, P/F, PEEP, Complacência',
        'Score >3.0: Considerar encaminhamento para centro com ECMO',
        'Complacência = VT / (Pplateau - PEEP)',
      ],
      warnings: [
        'Score >2.5 indica lesão grave',
        'Berlin Definition e padrão atual para SDRA',
      ],
      reference: 'Murray JF et al. Am Rev Respir Dis 1988;138(3):720-3',
    },
  },
];

// =============================================================================
// SEÇÃO 11: SEGURANCA DO PACIENTE (4 calculadoras)
// =============================================================================

const segCalculators = [
  {
    id: 'seg_morse',
    title: 'Morse',
    subtitle: 'Risco de Queda',
    icon: 'AlertTriangle',
    status: 'active',
    useDropdown: true,
    inputs: [
      { id: 'queda_hist', label: 'História de queda', type: 'bool', points: 25 },
      { id: 'diagnostico_sec', label: 'Diagnóstico secundário', type: 'bool', points: 15 },
      {
        id: 'deambulacao',
        label: 'Auxilio para deambulação',
        type: 'select',
        options: [
          { value: 0, label: 'Nenhum / acamado / cadeira de rodas' },
          { value: 15, label: 'Muletas / bengala / andador' },
          { value: 30, label: 'Apoia em moveis' },
        ],
      },
      { id: 'terapia_iv', label: 'Terapia IV / dispositivo de heparina', type: 'bool', points: 20 },
      {
        id: 'marcha',
        label: 'Marcha',
        type: 'select',
        options: [
          { value: 0, label: 'Normal / acamado / imobilizado' },
          { value: 10, label: 'Fraca' },
          { value: 20, label: 'Comprometida' },
        ],
      },
      {
        id: 'estado_mental',
        label: 'Estado mental',
        type: 'select',
        options: [
          { value: 0, label: 'Orientado quanto a propria capacidade' },
          { value: 15, label: 'Superestima capacidade / esquece limitacoes' },
        ],
      },
    ],
    compute: (values) => {
      let score = 0;
      if (values.queda_hist) score += 25;
      if (values.diagnostico_sec) score += 15;
      score += parseInt(values.deambulacao) || 0;
      if (values.terapia_iv) score += 20;
      score += parseInt(values.marcha) || 0;
      score += parseInt(values.estado_mental) || 0;

      let risk, riskLabel, conduta;
      if (score >= 45) {
        risk = 'alto';
        riskLabel = 'Alto risco';
        conduta = 'Protocolo completo: supervisao continua, ambiente seguro, sinalização';
      } else if (score >= 25) {
        risk = 'medio';
        riskLabel = 'Risco moderado';
        conduta = 'Medidas preventivas padrão: grades elevadas, campainha acessível';
      } else {
        risk = 'baixo';
        riskLabel = 'Baixo risco';
        conduta = 'Orientacoes básicas e reavaliação periodica';
      }

      return {
        score,
        risk,
        riskLabel,
        details: {
          'Conduta recomendada': conduta,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      return `Morse: ${result.score} pontos`;
    },
    infoBox: {
      keyPoints: [
        'Escala validada para avaliação de risco de queda em pacientes hospitalizados',
        'Escore 0-24: Baixo risco | 25-44: Risco moderado | ≥45: Alto risco',
        'Reavaliar a cada mudanca de condição clínica ou transferência',
        '6 fatores: histórico de queda, diagnóstico secundário, deambulação, terapia IV, marcha, estado mental',
      ],
      warnings: [
        'Pacientes com alto risco requerem supervisao continua e ambiente seguro',
      ],
      reference: 'Morse JM et al. Fall Prevention Program. Appl Nurs Res 1989',
    },
  },
  {
    id: 'seg_braden',
    title: 'Braden',
    subtitle: 'Lesão por Pressão',
    icon: 'Shield',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'percepcao',
        label: 'Percepcao sensorial',
        type: 'select',
        options: [
          { value: 1, label: '1 - Totalmente limitada' },
          { value: 2, label: '2 - Muito limitada' },
          { value: 3, label: '3 - Levemente limitada' },
          { value: 4, label: '4 - Nenhuma limitação' },
        ],
      },
      {
        id: 'umidade',
        label: 'Umidade',
        type: 'select',
        options: [
          { value: 1, label: '1 - Constantemente umida' },
          { value: 2, label: '2 - Muito umida' },
          { value: 3, label: '3 - Ocasionalmente umida' },
          { value: 4, label: '4 - Raramente umida' },
        ],
      },
      {
        id: 'atividade',
        label: 'Atividade',
        type: 'select',
        options: [
          { value: 1, label: '1 - Acamado' },
          { value: 2, label: '2 - Confinado a cadeira' },
          { value: 3, label: '3 - Anda ocasionalmente' },
          { value: 4, label: '4 - Anda frequentemente' },
        ],
      },
      {
        id: 'mobilidade',
        label: 'Mobilidade',
        type: 'select',
        options: [
          { value: 1, label: '1 - Totalmente imobilizado' },
          { value: 2, label: '2 - Bastante limitado' },
          { value: 3, label: '3 - Levemente limitado' },
          { value: 4, label: '4 - Sem limitacoes' },
        ],
      },
      {
        id: 'nutricao',
        label: 'Nutrição',
        type: 'select',
        options: [
          { value: 1, label: '1 - Muito pobre' },
          { value: 2, label: '2 - Provavelmente inadequada' },
          { value: 3, label: '3 - Adequada' },
          { value: 4, label: '4 - Excelente' },
        ],
      },
      {
        id: 'friccao',
        label: 'Friccao e cisalhamento',
        type: 'select',
        options: [
          { value: 1, label: '1 - Problema' },
          { value: 2, label: '2 - Problema em potencial' },
          { value: 3, label: '3 - Sem problema aparente' },
        ],
      },
    ],
    compute: (values) => {
      const score =
        (parseInt(values.percepcao) || 4) +
        (parseInt(values.umidade) || 4) +
        (parseInt(values.atividade) || 4) +
        (parseInt(values.mobilidade) || 4) +
        (parseInt(values.nutricao) || 4) +
        (parseInt(values.friccao) || 3);

      let risk, riskLabel, conduta;
      if (score <= 12) {
        risk = 'critico';
        riskLabel = 'Risco muito alto';
        conduta = 'Decubito 2/2h, superficie especial, curativo preventivo, avaliacoes frequentes';
      } else if (score <= 14) {
        risk = 'alto';
        riskLabel = 'Risco alto';
        conduta = 'Decubito 2/2h, superficie preventiva, hidratação da pele';
      } else if (score <= 18) {
        risk = 'medio';
        riskLabel = 'Risco moderado';
        conduta = 'Mudanca de decubito periodica, cuidados com a pele';
      } else {
        risk = 'baixo';
        riskLabel = 'Sem risco';
        conduta = 'Manter cuidados básicos e reavaliação periodica';
      }

      return {
        score,
        risk,
        riskLabel,
        details: {
          'Conduta recomendada': conduta,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      return `Braden: ${result.score} pontos`;
    },
    infoBox: {
      keyPoints: [
        'Escala de 6 a 23 pontos - quanto menor o escore, maior o risco',
        '≤12: Risco muito alto | 13-14: Risco alto | 15-18: Risco moderado | ≥19: Sem risco',
        '6 subdimensoes: percepcao sensorial, umidade, atividade, mobilidade, nutrição, friccao/cisalhamento',
        'Reavaliar a cada 24-48h ou quando houver mudanca clínica significativa',
      ],
      warnings: [
        'Pacientes com risco alto ou muito alto requerem superficies de suporte e mudancas de decubito frequentes',
      ],
      reference: 'Bergstrom N et al. The Braden Scale for Predicting Pressure Sore Risk. Nurs Res 1987',
    },
  },
  {
    id: 'seg_mews',
    title: 'MEWS',
    subtitle: 'Alerta Precoce Modificado',
    icon: 'AlertCircle',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'pas',
        label: 'Pressão Arterial Sistólica (mmHg)',
        type: 'select',
        options: [
          { value: 'pas_3', label: '≤70' },
          { value: 'pas_2', label: '71-80' },
          { value: 'pas_1', label: '81-100' },
          { value: 'pas_0', label: '101-199' },
          { value: 'pas_2b', label: '≥200' },
        ],
      },
      {
        id: 'fc',
        label: 'Frequência Cardíaca (bpm)',
        type: 'select',
        options: [
          { value: 'fc_2', label: '<40' },
          { value: 'fc_1', label: '40-50' },
          { value: 'fc_0', label: '51-100' },
          { value: 'fc_1b', label: '101-110' },
          { value: 'fc_2b', label: '111-129' },
          { value: 'fc_3', label: '≥130' },
        ],
      },
      {
        id: 'fr',
        label: 'Frequência Respiratória (ipm)',
        type: 'select',
        options: [
          { value: 'fr_2', label: '<9' },
          { value: 'fr_0', label: '9-14' },
          { value: 'fr_1', label: '15-20' },
          { value: 'fr_2b', label: '21-29' },
          { value: 'fr_3', label: '≥30' },
        ],
      },
      {
        id: 'temp',
        label: 'Temperatura (C)',
        type: 'select',
        options: [
          { value: 'temp_2', label: '<35.0' },
          { value: 'temp_0', label: '35.0-38.4' },
          { value: 'temp_2b', label: '≥38.5' },
        ],
      },
      {
        id: 'consciencia',
        label: 'Nível de Consciência (AVPU)',
        type: 'select',
        options: [
          { value: 'avpu_0', label: 'Alerta' },
          { value: 'avpu_1', label: 'Responde a voz' },
          { value: 'avpu_2', label: 'Responde a dor' },
          { value: 'avpu_3', label: 'Não responsivo' },
        ],
      },
    ],
    compute: (values) => {
      // Mapeamento de pontuação MEWS
      const pasMap = { pas_3: 3, pas_2: 2, pas_2b: 2, pas_1: 1, pas_0: 0 };
      const fcMap = { fc_3: 3, fc_2: 2, fc_2b: 2, fc_1: 1, fc_1b: 1, fc_0: 0 };
      const frMap = { fr_3: 3, fr_2: 2, fr_2b: 2, fr_1: 1, fr_0: 0 };
      const tempMap = { temp_2: 2, temp_2b: 2, temp_0: 0 };
      const avpuMap = { avpu_3: 3, avpu_2: 2, avpu_1: 1, avpu_0: 0 };

      const pasPts = pasMap[values.pas] ?? 0;
      const fcPts = fcMap[values.fc] ?? 0;
      const frPts = frMap[values.fr] ?? 0;
      const tempPts = tempMap[values.temp] ?? 0;
      const avpuPts = avpuMap[values.consciencia] ?? 0;

      const score = pasPts + fcPts + frPts + tempPts + avpuPts;

      let risk, riskLabel, classificacao, conduta;
      if (score >= 5) {
        risk = 'critico';
        riskLabel = 'Crítico';
        classificacao = 'Deterioração clínica iminente';
        conduta = 'Ativar Time de Resposta Rápida. Considerar UTI. Avaliação médica imediata';
      } else if (score >= 4) {
        risk = 'alto';
        riskLabel = 'Alto risco';
        classificacao = 'Risco alto de deterioração';
        conduta = 'Avaliação médica urgente. Monitoramento continuo. Considerar transferência';
      } else if (score >= 2) {
        risk = 'medio';
        riskLabel = 'Risco moderado';
        classificacao = 'Risco moderado';
        conduta = 'Aumentar frequência de monitoramento. Reavaliar em 2h';
      } else {
        risk = 'baixo';
        riskLabel = 'Baixo risco';
        classificacao = 'Paciente estável';
        conduta = 'Monitoramento de rotina. Reavaliar em 4-6h';
      }

      return {
        score,
        risk,
        riskLabel,
        details: {
          'Classificação': classificacao,
          'Conduta': conduta,
          'PAS': `${pasPts} pts`,
          'FC': `${fcPts} pts`,
          'FR': `${frPts} pts`,
          'Temp': `${tempPts} pts`,
          'AVPU': `${avpuPts} pts`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os parâmetros';
      return `MEWS ${result.score}: ${result.details['Classificação']}`;
    },
    infoBox: {
      keyPoints: [
        'Modified Early Warning Score - detecta deterioração clínica precoce',
        '0-1: Baixo risco | 2-3: Risco moderado | 4: Alto risco | ≥5: Crítico',
        '5 parâmetros: PAS, FC, FR, Temperatura, Nível de consciência (AVPU)',
        'Qualquer parâmetro com pontuação 3 indica necessidade de avaliação médica',
      ],
      warnings: [
        'MEWS >=4 ou qualquer parâmetro >=3 requer avaliação médica imediata',
      ],
      reference: 'Subbe CP et al. Validation of MEWS. QJM 2001',
    },
  },
  {
    id: 'seg_news2',
    title: 'NEWS2',
    subtitle: 'Alerta Precoce Nacional 2',
    icon: 'Bell',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'fr',
        label: 'Frequência Respiratória (ipm)',
        type: 'select',
        options: [
          { value: 'fr_3a', label: '≤8' },
          { value: 'fr_1', label: '9-11' },
          { value: 'fr_0', label: '12-20' },
          { value: 'fr_2', label: '21-24' },
          { value: 'fr_3b', label: '≥25' },
        ],
      },
      {
        id: 'spo2_escala',
        label: 'Escala de SpO2',
        type: 'select',
        options: [
          { value: 'escala1', label: 'Escala 1 (padrão)' },
          { value: 'escala2', label: 'Escala 2 (DPOC com hipercapnia)' },
        ],
      },
      {
        id: 'spo2',
        label: 'SpO2 (%)',
        type: 'select',
        options: [
          { value: 'spo2_3', label: '≤91' },
          { value: 'spo2_2', label: '92-93' },
          { value: 'spo2_1', label: '94-95' },
          { value: 'spo2_0', label: '≥96' },
        ],
      },
      {
        id: 'o2',
        label: 'Oxigênio Suplementar',
        type: 'select',
        options: [
          { value: 'o2_0', label: 'Ar ambiente' },
          { value: 'o2_2', label: 'Com oxigênio suplementar' },
        ],
      },
      {
        id: 'pas',
        label: 'Pressão Arterial Sistólica (mmHg)',
        type: 'select',
        options: [
          { value: 'pas_3a', label: '≤90' },
          { value: 'pas_2', label: '91-100' },
          { value: 'pas_1', label: '101-110' },
          { value: 'pas_0', label: '111-219' },
          { value: 'pas_3b', label: '≥220' },
        ],
      },
      {
        id: 'fc',
        label: 'Frequência Cardíaca (bpm)',
        type: 'select',
        options: [
          { value: 'fc_3a', label: '≤40' },
          { value: 'fc_1a', label: '41-50' },
          { value: 'fc_0', label: '51-90' },
          { value: 'fc_1b', label: '91-110' },
          { value: 'fc_2', label: '111-130' },
          { value: 'fc_3b', label: '≥131' },
        ],
      },
      {
        id: 'consciencia',
        label: 'Nível de Consciência',
        type: 'select',
        options: [
          { value: 'avpu_0', label: 'Alerta' },
          { value: 'avpu_3', label: 'Confuso / Voz / Dor / Não responde' },
        ],
      },
      {
        id: 'temp',
        label: 'Temperatura (C)',
        type: 'select',
        options: [
          { value: 'temp_3', label: '≤35.0' },
          { value: 'temp_1a', label: '35.1-36.0' },
          { value: 'temp_0', label: '36.1-38.0' },
          { value: 'temp_1b', label: '38.1-39.0' },
          { value: 'temp_2', label: '≥39.1' },
        ],
      },
    ],
    compute: (values) => {
      // Mapeamento de pontuação NEWS2
      const frMap = { fr_3a: 3, fr_3b: 3, fr_2: 2, fr_1: 1, fr_0: 0 };
      const spo2Map = { spo2_3: 3, spo2_2: 2, spo2_1: 1, spo2_0: 0 };
      const o2Map = { o2_2: 2, o2_0: 0 };
      const pasMap = { pas_3a: 3, pas_3b: 3, pas_2: 2, pas_1: 1, pas_0: 0 };
      const fcMap = { fc_3a: 3, fc_3b: 3, fc_2: 2, fc_1a: 1, fc_1b: 1, fc_0: 0 };
      const avpuMap = { avpu_3: 3, avpu_0: 0 };
      const tempMap = { temp_3: 3, temp_2: 2, temp_1a: 1, temp_1b: 1, temp_0: 0 };

      const frPts = frMap[values.fr] ?? 0;
      const spo2Pts = spo2Map[values.spo2] ?? 0;
      const o2Pts = o2Map[values.o2] ?? 0;
      const pasPts = pasMap[values.pas] ?? 0;
      const fcPts = fcMap[values.fc] ?? 0;
      const avpuPts = avpuMap[values.consciencia] ?? 0;
      const tempPts = tempMap[values.temp] ?? 0;

      const score = frPts + spo2Pts + o2Pts + pasPts + fcPts + avpuPts + tempPts;

      // Verificar se algum parâmetro tem pontuação 3 (gatilho de urgência)
      const hasScore3 = [frPts, spo2Pts, pasPts, fcPts, avpuPts, tempPts].some(p => p === 3);

      let risk, riskLabel, classificacao, conduta, resposta;
      if (score >= 7) {
        risk = 'critico';
        riskLabel = 'Alto risco';
        classificacao = 'Risco alto - Resposta de Emergência';
        resposta = 'Emergência';
        conduta = 'Time de emergência imediato. Revisao médica continua. Considerar UTI';
      } else if (score >= 5 || hasScore3) {
        risk = 'alto';
        riskLabel = hasScore3 ? 'Risco médio (param 3)' : 'Risco médio';
        classificacao = hasScore3 ? 'Gatilho de urgência (parâmetro = 3)' : 'Risco médio - Resposta Urgente';
        resposta = 'Urgente';
        conduta = 'Avaliação médica urgente. Monitoramento mínimo horario. Considerar escalação';
      } else if (score >= 1) {
        risk = 'medio';
        riskLabel = 'Risco baixo-medio';
        classificacao = 'Risco baixo a medio';
        resposta = 'Enfermaria';
        conduta = 'Monitoramento a cada 4-6h. Informar enfermeiro responsável';
      } else {
        risk = 'baixo';
        riskLabel = 'Baixo risco';
        classificacao = 'Risco baixo';
        resposta = 'Rotina';
        conduta = 'Monitoramento a cada 12h. Continuar cuidados de rotina';
      }

      return {
        score,
        risk,
        riskLabel,
        details: {
          'Classificação': classificacao,
          'Resposta clínica': resposta,
          'Conduta': conduta,
          'FR': `${frPts} pts`,
          'SpO2': `${spo2Pts} pts`,
          'O2 supl': `${o2Pts} pts`,
          'PAS': `${pasPts} pts`,
          'FC': `${fcPts} pts`,
          'Consciência': `${avpuPts} pts`,
          'Temp': `${tempPts} pts`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os parâmetros';
      return `NEWS2 ${result.score}: ${result.details['Classificação']}`;
    },
    infoBox: {
      keyPoints: [
        'National Early Warning Score 2 - padrão NHS para detecção de deterioração',
        '0: Baixo | 1-4: Baixo-médio | 5-6: Médio | ≥7: Alto risco',
        'Qualquer parâmetro com pontuação 3 = gatilho de resposta urgente',
        '7 parâmetros: FR, SpO2, O2, PAS, FC, Consciência, Temperatura',
        'Escala 2 de SpO2 para pacientes DPOC com hipercapnia crônica',
      ],
      warnings: [
        'NEWS2 >=5 ou parâmetro = 3 requer resposta urgente/emergência',
      ],
      reference: 'Royal College of Physicians. NEWS2: Standardising Assessment of Acute-Illness Severity in the NHS. 2017',
    },
  },
];

// =============================================================================
// SEÇÃO 12: FUNCAO RENAL E ELETROLITOS (7 calculadoras)
// =============================================================================

const renalCalculators = [
  {
    id: 'renal_cockroft',
    title: 'Depuração de Creatinina',
    subtitle: 'Cockcroft-Gault',
    icon: 'Beaker',
    status: 'active',
    inputs: [
      { id: 'idade', label: 'Idade (anos)', type: 'number', min: 18, max: 120, step: 1 },
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 30, max: 200, step: 0.1 },
      { id: 'creatinina', label: 'Creatinina (mg/dL)', type: 'number', min: 0.1, max: 20, step: 0.1 },
      { id: 'sexo_fem', label: 'Sexo feminino', type: 'bool' },
    ],
    compute: (values) => {
      const idade = parseFloat(values.idade) || 0;
      const peso = parseFloat(values.peso) || 0;
      const cr = parseFloat(values.creatinina) || 0;

      if (idade === 0 || peso === 0 || cr === 0) return null;

      // Formula Cockcroft-Gault: ClCr = (140 - idade) x peso / (72 x Cr)
      // Multiplicar por 0.85 se mulher
      let clearance = ((140 - idade) * peso) / (72 * cr);
      if (values.sexo_fem) clearance *= 0.85;

      let risk, riskLabel, estagio;
      if (clearance >= 90) {
        risk = 'baixo';
        riskLabel = 'Normal/G1';
        estagio = 'Estagio 1 (normal ou alto)';
      } else if (clearance >= 60) {
        risk = 'baixo';
        riskLabel = 'G2 (leve)';
        estagio = 'Estagio 2 (leve redução)';
      } else if (clearance >= 45) {
        risk = 'medio';
        riskLabel = 'G3a (leve-mod)';
        estagio = 'Estagio 3a (leve a moderada)';
      } else if (clearance >= 30) {
        risk = 'medio';
        riskLabel = 'G3b (mod-grave)';
        estagio = 'Estagio 3b (moderada a grave)';
      } else if (clearance >= 15) {
        risk = 'alto';
        riskLabel = 'G4 (grave)';
        estagio = 'Estagio 4 (grave)';
      } else {
        risk = 'critico';
        riskLabel = 'G5 (falência)';
        estagio = 'Estagio 5 (falência renal)';
      }

      return {
        score: clearance,
        risk,
        riskLabel,
        details: {
          'Classificação KDIGO': estagio,
          'Ajuste de dose': clearance < 30 ? 'Necessário para maioria das drogas' : clearance < 60 ? 'Verificar bula' : 'Geralmente não necessário',
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os dados';
      return `ClCr: ${result.score.toFixed(1)} mL/min`;
    },
    infoBox: {
      keyPoints: [
        'Formula: (140 - idade) x peso / (72 x Cr)',
        'Multiplicar por 0.85 se sexo feminino',
        '>= 90 mL/min: Normal (estagio 1 se lesão renal)',
        '60-89 mL/min: IRC leve (estagio 2)',
        '30-59 mL/min: IRC moderada (estagio 3)',
        '15-29 mL/min: IRC grave (estagio 4)',
        '< 15 mL/min: Falência renal (estagio 5)',
      ],
      warnings: [
        'Cockcroft-Gault superestima TFG em obesos',
        'Considerar CKD-EPI para maior precisao',
      ],
      reference: 'Cockcroft DW, Gault MH. Nephron, 1976 | KDIGO Guidelines 2012.',
    },
  },
  {
    id: 'renal_ckdepi',
    title: 'TFGe (CKD-EPI)',
    subtitle: 'Taxa Filtração Glomerular',
    icon: 'Activity',
    status: 'active',
    inputs: [
      { id: 'idade', label: 'Idade (anos)', type: 'number', min: 18, max: 120, step: 1 },
      { id: 'creatinina', label: 'Creatinina serica (mg/dL)', type: 'number', min: 0.1, max: 20, step: 0.01 },
      { id: 'sexo_fem', label: 'Sexo feminino', type: 'bool' },
    ],
    compute: (values) => {
      const idade = parseFloat(values.idade) || 0;
      const cr = parseFloat(values.creatinina) || 0;
      const isFemale = values.sexo_fem;

      if (idade === 0 || cr === 0) return null;

      // CKD-EPI 2021 (race-free)
      // eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × 0.9938^age × (1.012 if female)
      const kappa = isFemale ? 0.7 : 0.9;
      const alpha = isFemale ? -0.241 : -0.302;
      const sexFactor = isFemale ? 1.012 : 1;

      const crKappa = cr / kappa;
      const minFactor = Math.pow(Math.min(crKappa, 1), alpha);
      const maxFactor = Math.pow(Math.max(crKappa, 1), -1.200);
      const ageFactor = Math.pow(0.9938, idade);

      const tfge = 142 * minFactor * maxFactor * ageFactor * sexFactor;

      let risk, riskLabel, estagio;
      if (tfge >= 90) {
        risk = 'baixo';
        riskLabel = 'Normal/G1';
        estagio = 'G1 - Normal ou alto';
      } else if (tfge >= 60) {
        risk = 'baixo';
        riskLabel = 'G2 (leve)';
        estagio = 'G2 - Levemente diminuida';
      } else if (tfge >= 45) {
        risk = 'medio';
        riskLabel = 'G3a (leve-mod)';
        estagio = 'G3a - Leve a moderada';
      } else if (tfge >= 30) {
        risk = 'medio';
        riskLabel = 'G3b (mod-grave)';
        estagio = 'G3b - Moderada a grave';
      } else if (tfge >= 15) {
        risk = 'alto';
        riskLabel = 'G4 (grave)';
        estagio = 'G4 - Gravemente diminuida';
      } else {
        risk = 'critico';
        riskLabel = 'G5 (falência)';
        estagio = 'G5 - Falência renal';
      }

      return {
        score: tfge,
        risk,
        riskLabel,
        details: {
          'Classificação KDIGO': estagio,
          'Ajuste de dose': tfge < 30 ? 'Necessário para maioria das drogas' : tfge < 60 ? 'Verificar bula' : 'Geralmente não necessário',
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os dados';
      return `TFGe: ${result.score.toFixed(1)} mL/min/1.73m²`;
    },
    infoBox: {
      keyPoints: [
        'Formula CKD-EPI 2021 sem ajuste de raca',
        'Mais precisa que Cockcroft-Gault para TFG >60',
        'G1 ≥90 | G2 60-89 | G3a 45-59 | G3b 30-44 | G4 15-29 | G5 <15',
        'Considerar albuminuria para estadiamento completo (A1-A3)',
      ],
      warnings: [
        'Em extremos de peso corporal, considerar Cockcroft-Gault para ajuste de dose',
      ],
      reference: 'Inker LA et al. N Engl J Med 2021;385:1737-49 | KDIGO 2012 Guidelines',
    },
  },
  {
    id: 'renal_sódio',
    title: 'Sódio Corrigido',
    subtitle: 'Hiperglicemia',
    icon: 'Droplet',
    status: 'active',
    inputs: [
      { id: 'sodio', label: 'Sódio medido (mEq/L)', type: 'number', min: 100, max: 180, step: 1 },
      { id: 'glicose', label: 'Glicose (mg/dL)', type: 'number', min: 50, max: 1500, step: 1 },
    ],
    compute: (values) => {
      const na = parseFloat(values.sodio) || 0;
      const gli = parseFloat(values.glicose) || 0;

      if (na === 0 || gli === 0) return null;

      // Formula de Katz (1973): Na_corr = Na + 1.6 x ((Glicose - 100) / 100)
      // Formula de Hillier (1999): Na_corr = Na + 2.4 x ((Glicose - 100) / 100) para glicose >400
      const correcaoKatz = 1.6 * ((gli - 100) / 100);
      const correcaoHillier = 2.4 * ((gli - 100) / 100);
      const naCorrigidoKatz = na + correcaoKatz;
      const naCorrigidoHillier = na + correcaoHillier;

      // Usar Hillier se glicose > 400
      const naCorrigido = gli > 400 ? naCorrigidoHillier : naCorrigidoKatz;
      const formulaUsada = gli > 400 ? 'Hillier (2.4)' : 'Katz (1.6)';

      let risk, riskLabel, interpretacao;
      if (naCorrigido < 120) {
        risk = 'critico';
        riskLabel = 'Hiponatremia grave';
        interpretacao = 'Hiponatremia grave - risco de edema cerebral';
      } else if (naCorrigido < 130) {
        risk = 'alto';
        riskLabel = 'Hiponatremia mod';
        interpretacao = 'Hiponatremia moderada';
      } else if (naCorrigido < 135) {
        risk = 'medio';
        riskLabel = 'Hiponatremia leve';
        interpretacao = 'Hiponatremia leve';
      } else if (naCorrigido <= 145) {
        risk = 'baixo';
        riskLabel = 'Normal';
        interpretacao = 'Sódio corrigido normal';
      } else if (naCorrigido <= 150) {
        risk = 'medio';
        riskLabel = 'Hipernatremia leve';
        interpretacao = 'Hipernatremia leve';
      } else {
        risk = 'alto';
        riskLabel = 'Hipernatremia';
        interpretacao = 'Hipernatremia significativa';
      }

      return {
        score: naCorrigido,
        risk,
        riskLabel,
        details: {
          'Interpretação': interpretacao,
          'Formula utilizada': formulaUsada,
          'Correção aplicada': `+${(naCorrigido - na).toFixed(1)} mEq/L`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha sódio e glicose';
      return `Na corrigido: ${result.score.toFixed(1)} mEq/L`;
    },
    infoBox: {
      keyPoints: [
        'Corrige pseudohiponatremia dilucional da hiperglicemia',
        'Katz: Na + 1.6 x ((Gli - 100) / 100) - padrão',
        'Hillier: Na + 2.4 x ((Gli - 100) / 100) - glicose >400',
        'Normal: 135-145 mEq/L',
      ],
      warnings: [
        'Correção rápida de hiponatremia pode causar mielinolise pontina',
      ],
      reference: 'Katz MA. N Engl J Med 1973 | Hillier TA et al. Am J Med 1999',
    },
  },
  {
    id: 'renal_cálcio',
    title: 'Cálcio Corrigido',
    subtitle: 'Albumina',
    icon: 'Bone',
    status: 'active',
    inputs: [
      { id: 'calcio', label: 'Cálcio total (mg/dL)', type: 'number', min: 4, max: 18, step: 0.1 },
      { id: 'albumina', label: 'Albumina (g/dL)', type: 'number', min: 1, max: 6, step: 0.1 },
    ],
    compute: (values) => {
      const ca = parseFloat(values.calcio) || 0;
      const alb = parseFloat(values.albumina) || 0;

      if (ca === 0 || alb === 0) return null;

      // Formula: Ca_corr = Ca_medido + 0.8 x (4 - Albumina)
      const correcao = 0.8 * (4 - alb);
      const caCorrigido = ca + correcao;

      let risk, riskLabel, interpretacao;
      if (caCorrigido < 7.0) {
        risk = 'critico';
        riskLabel = 'Hipocalcemia grave';
        interpretacao = 'Hipocalcemia grave - risco de tetania, convulsões';
      } else if (caCorrigido < 8.5) {
        risk = 'alto';
        riskLabel = 'Hipocalcemia';
        interpretacao = 'Hipocalcemia';
      } else if (caCorrigido <= 10.5) {
        risk = 'baixo';
        riskLabel = 'Normal';
        interpretacao = 'Cálcio corrigido normal';
      } else if (caCorrigido <= 12.0) {
        risk = 'medio';
        riskLabel = 'Hipercalcemia leve';
        interpretacao = 'Hipercalcemia leve';
      } else if (caCorrigido <= 14.0) {
        risk = 'alto';
        riskLabel = 'Hipercalcemia mod';
        interpretacao = 'Hipercalcemia moderada';
      } else {
        risk = 'critico';
        riskLabel = 'Crise hipercalcemica';
        interpretacao = 'Crise hipercalcemica - emergência';
      }

      return {
        score: caCorrigido,
        risk,
        riskLabel,
        details: {
          'Interpretação': interpretacao,
          'Correção aplicada': correcao >= 0 ? `+${correção.toFixed(1)} mg/dL` : `${correção.toFixed(1)} mg/dL`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha cálcio e albumina';
      return `Ca corrigido: ${result.score.toFixed(1)} mg/dL`;
    },
    infoBox: {
      keyPoints: [
        'Corrige cálcio total para hipoalbuminemia',
        'Formula: Ca + 0.8 x (4 - Albumina)',
        'Normal: 8.5-10.5 mg/dL',
        'Cada 1 g/dL de albumina abaixo de 4 reduz cálcio em 0.8 mg/dL',
      ],
      warnings: [
        'Em caso de duvida, dosar cálcio ionico (normal: 1.1-1.3 mmol/L)',
      ],
      reference: 'Payne RB et al. Br Med J 1973',
    },
  },
  {
    id: 'renal_aniongap',
    title: 'Anion Gap',
    subtitle: 'Lacuna Anionica',
    icon: 'Plus',
    status: 'active',
    inputs: [
      { id: 'sodio', label: 'Sódio (mEq/L)', type: 'number', min: 100, max: 180, step: 1 },
      { id: 'cloro', label: 'Cloro (mEq/L)', type: 'number', min: 70, max: 130, step: 1 },
      { id: 'bicarbonato', label: 'Bicarbonato (mEq/L)', type: 'number', min: 5, max: 40, step: 1 },
      { id: 'albumina', label: 'Albumina (g/dL) - opcional', type: 'number', min: 1, max: 6, step: 0.1 },
    ],
    compute: (values) => {
      const na = parseFloat(values.sodio) || 0;
      const cl = parseFloat(values.cloro) || 0;
      const hco3 = parseFloat(values.bicarbonato) || 0;
      const alb = parseFloat(values.albumina) || 0;

      if (na === 0 || cl === 0 || hco3 === 0) return null;

      // Anion Gap = Na - (Cl + HCO3)
      const ag = na - (cl + hco3);

      // Correção para albumina: AG_corr = AG + 2.5 x (4 - Albumina)
      let agCorrigido = ag;
      let correcaoAlb = 0;
      if (alb > 0) {
        correcaoAlb = 2.5 * (4 - alb);
        agCorrigido = ag + correcaoAlb;
      }

      const agFinal = alb > 0 ? agCorrigido : ag;

      let risk, riskLabel, interpretacao, causas;
      if (agFinal < 3) {
        risk = 'medio';
        riskLabel = 'AG diminuido';
        interpretacao = 'Anion gap diminuido';
        causas = 'Hipoalbuminemia, hipercalcemia, hipermagnesiemia, mieloma';
      } else if (agFinal <= 12) {
        risk = 'baixo';
        riskLabel = 'Normal';
        interpretacao = 'Anion gap normal';
        causas = 'Sem acidose metabólica com AG elevado';
      } else if (agFinal <= 20) {
        risk = 'medio';
        riskLabel = 'AG elevado';
        interpretacao = 'Anion gap elevado';
        causas = 'MUDPILES: Metanol, Uremia, DKA, Propilenoglicol, INH, Lactato, Etilenoglicol, Salicilatos';
      } else {
        risk = 'alto';
        riskLabel = 'AG muito elevado';
        interpretacao = 'Anion gap muito elevado';
        causas = 'Acidose metabólica grave - investigar MUDPILES';
      }

      const details = {
        'Interpretação': interpretacao,
        'Causas comuns': causas,
      };
      if (alb > 0) {
        details['AG sem correção'] = `${ag.toFixed(1)} mEq/L`;
        details['Correção albumina'] = `+${correçãoAlb.toFixed(1)} mEq/L`;
      }

      return {
        score: agFinal,
        risk,
        riskLabel,
        details,
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha Na, Cl e HCO3';
      return `Anion Gap: ${result.score.toFixed(1)} mEq/L`;
    },
    infoBox: {
      keyPoints: [
        'Formula: Na - (Cl + HCO3)',
        'Normal: 3-12 mEq/L (ou 8-12 sem K)',
        'Correção albumina: AG + 2.5 x (4 - Alb)',
        'AG elevado: MUDPILES - Metanol, Uremia, DKA, Propilenoglicol, INH, Lactato, Etilenoglicol, Salicilatos',
      ],
      warnings: [
        'AG normal não exclui acidose metabólica (acidose hipercloremica)',
      ],
      reference: 'Kraut JA, Madias NE. N Engl J Med 2014',
    },
  },
  {
    id: 'renal_osmolaridade',
    title: 'Osmolaridade Calculada',
    subtitle: 'Serica',
    icon: 'Beaker',
    status: 'active',
    inputs: [
      { id: 'sodio', label: 'Sódio (mEq/L)', type: 'number', min: 100, max: 180, step: 1 },
      { id: 'glicose', label: 'Glicose (mg/dL)', type: 'number', min: 50, max: 1500, step: 1 },
      { id: 'ureia', label: 'Ureia (mg/dL)', type: 'number', min: 5, max: 300, step: 1 },
    ],
    compute: (values) => {
      const na = parseFloat(values.sodio) || 0;
      const gli = parseFloat(values.glicose) || 0;
      const ureia = parseFloat(values.ureia) || 0;

      if (na === 0 || gli === 0 || ureia === 0) return null;

      // Osmolaridade = 2 x Na + (Glicose / 18) + (Ureia / 6)
      // Nota: Se usar BUN ao inves de ureia: BUN / 2.8
      const osmCalculada = 2 * na + gli / 18 + ureia / 6;

      let risk, riskLabel, interpretacao;
      if (osmCalculada < 275) {
        risk = 'medio';
        riskLabel = 'Hipo-osmolar';
        interpretacao = 'Hipo-osmolaridade - risco de edema celular';
      } else if (osmCalculada <= 295) {
        risk = 'baixo';
        riskLabel = 'Normal';
        interpretacao = 'Osmolaridade normal';
      } else if (osmCalculada <= 320) {
        risk = 'medio';
        riskLabel = 'Hiperosmolar';
        interpretacao = 'Hiperosmolaridade moderada';
      } else {
        risk = 'alto';
        riskLabel = 'Hiperosmolar grave';
        interpretacao = 'Hiperosmolaridade grave - risco de coma';
      }

      return {
        score: osmCalculada,
        risk,
        riskLabel,
        details: {
          'Interpretação': interpretacao,
          'Contribuição Na': `${(2 * na).toFixed(0)} mOsm/L`,
          'Contribuição glicose': `${(gli / 18).toFixed(1)} mOsm/L`,
          'Contribuição ureia': `${(ureia / 6).toFixed(1)} mOsm/L`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha Na, glicose e ureia';
      return `Osm calculada: ${result.score.toFixed(0)} mOsm/L`;
    },
    infoBox: {
      keyPoints: [
        'Formula: 2 x Na + (Glicose/18) + (Ureia/6)',
        'Se usar BUN: 2 x Na + (Glicose/18) + (BUN/2.8)',
        'Normal: 275-295 mOsm/L',
        'Util para calcular gap osmolar quando ha osmolaridade medida',
      ],
      warnings: [
        'Gap osmolar = Osm medida - Osm calculada',
        'Normal <10 mOsm/kg',
      ],
      reference: 'Purssell RA et al. Ann Emerg Med 2001',
    },
  },
  {
    id: 'renal_gap_osmolar',
    title: 'Gap Osmolar',
    subtitle: 'Lacuna Osmolar',
    icon: 'Minus',
    status: 'active',
    inputs: [
      { id: 'osm_medida', label: 'Osmolaridade medida (mOsm/kg)', type: 'number', min: 200, max: 450, step: 1 },
      { id: 'sodio', label: 'Sódio (mEq/L)', type: 'number', min: 100, max: 180, step: 1 },
      { id: 'glicose', label: 'Glicose (mg/dL)', type: 'number', min: 50, max: 1500, step: 1 },
      { id: 'ureia', label: 'Ureia (mg/dL)', type: 'number', min: 5, max: 300, step: 1 },
    ],
    compute: (values) => {
      const osmMedida = parseFloat(values.osm_medida) || 0;
      const na = parseFloat(values.sodio) || 0;
      const gli = parseFloat(values.glicose) || 0;
      const ureia = parseFloat(values.ureia) || 0;

      if (osmMedida === 0 || na === 0 || gli === 0 || ureia === 0) return null;

      // Osmolaridade calculada = 2 x Na + (Glicose / 18) + (Ureia / 6)
      const osmCalculada = 2 * na + gli / 18 + ureia / 6;

      // Gap osmolar = Osm medida - Osm calculada
      const gap = osmMedida - osmCalculada;

      let risk, riskLabel, interpretacao, causas;
      if (gap < 10) {
        risk = 'baixo';
        riskLabel = 'Normal';
        interpretacao = 'Gap osmolar normal';
        causas = 'Sem evidência de substancias osmóticamente ativas não medidas';
      } else if (gap < 20) {
        risk = 'medio';
        riskLabel = 'Elevado';
        interpretacao = 'Gap osmolar elevado';
        causas = 'Considerar: etanol, metanol, etilenoglicol, isopropanol, manitol, contraste';
      } else {
        risk = 'alto';
        riskLabel = 'Muito elevado';
        interpretacao = 'Gap osmolar muito elevado';
        causas = 'Investigar intoxicação por alcoois toxicos (metanol, etilenoglicol)';
      }

      return {
        score: gap,
        risk,
        riskLabel,
        details: {
          'Interpretação': interpretacao,
          'Causas a investigar': causas,
          'Osm medida': `${osmMedida.toFixed(0)} mOsm/kg`,
          'Osm calculada': `${osmCalculada.toFixed(0)} mOsm/L`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha todos os campos';
      return `Gap Osmolar: ${result.score.toFixed(0)} mOsm/kg`;
    },
    infoBox: {
      keyPoints: [
        'Formula: Osm medida - Osm calculada',
        'Normal: <10 mOsm/kg',
        'Gap elevado: substancias osmóticamente ativas não incluidas no cálculo',
        'Principais causas: metanol, etilenoglicol, isopropanol, etanol, manitol',
      ],
      warnings: [
        'Gap osmolar elevado com acidose metabólica AG elevado sugere intoxicação por metanol ou etilenoglicol',
      ],
      reference: 'Kraut JA. Clin J Am Soc Nephrol 2015 | Hoffman RS et al. N Engl J Med 2009',
    },
  },
];

// =============================================================================
// SEÇÃO 13: NEUROLOGIA (3 calculadoras)
// =============================================================================

const neuroCalculators = [
  {
    id: 'neuro_glasgow',
    title: 'Glasgow',
    subtitle: 'Escala de Coma',
    icon: 'Brain',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'ocular',
        label: 'Abertura Ocular (O)',
        type: 'select',
        options: [
          { value: 4, label: '4 - Espontanea' },
          { value: 3, label: '3 - Ao comando verbal' },
          { value: 2, label: '2 - A dor' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
      {
        id: 'verbal',
        label: 'Resposta Verbal (V)',
        type: 'select',
        options: [
          { value: 5, label: '5 - Orientada' },
          { value: 4, label: '4 - Confusa' },
          { value: 3, label: '3 - Palavras inapropriadas' },
          { value: 2, label: '2 - Sons incompreensiveis' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
      {
        id: 'motora',
        label: 'Resposta Motora (M)',
        type: 'select',
        options: [
          { value: 6, label: '6 - Obedece comandos' },
          { value: 5, label: '5 - Localiza dor' },
          { value: 4, label: '4 - Retirada inespecífica' },
          { value: 3, label: '3 - Flexao anormal (decorticação)' },
          { value: 2, label: '2 - Extensao (descerebração)' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
    ],
    compute: (values) => {
      const o = parseInt(values.ocular) || 1;
      const v = parseInt(values.verbal) || 1;
      const m = parseInt(values.motora) || 1;
      const score = o + v + m;

      let riskLabel, classificacao, conduta;
      if (score === 15) {
        riskLabel = 'Normal';
        classificacao = 'Normal';
        conduta = 'Observação clínica';
      } else if (score >= 13) {
        riskLabel = 'TCE Leve';
        classificacao = 'TCE Leve (13-14)';
        conduta = 'TC cranio se indicado, observação';
      } else if (score >= 9) {
        riskLabel = 'TCE Moderado';
        classificacao = 'TCE Moderado (9-12)';
        conduta = 'TC cranio, internação, monitoramento';
      } else {
        riskLabel = 'TCE Grave';
        classificacao = 'TCE Grave (3-8)';
        conduta = 'IOT, TC cranio, UTI, avaliação neurocirúrgica';
      }

      return {
        score,
        riskLabel,
        details: {
          'Classificação': classificacao,
          'Componentes': `O${o}V${v}M${m}`,
          'Conduta': conduta,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      return `Glasgow: ${result.score} pontos (${result.details['Componentes']})`;
    },
    infoBox: {
      keyPoints: [
        '15: Normal | 13-14: TCE Leve | 9-12: TCE Moderado | 3-8: TCE Grave',
        'Glasgow ≤8: indicação de intubação orotraqueal',
        'Componente motor e o mais importante prognosticamente',
        'Documentar como OxVxMx (ex: O4V5M6 = 15)',
      ],
      warnings: [
        'Fatores confundidores: sedação, intoxicação, hipoxia, hipoglicemia',
      ],
      reference: 'Teasdale G, Jennett B. Lancet 1974 | Teasdale G et al. Lancet Neurol 2014',
    },
  },
  {
    id: 'neuro_gcsp',
    title: 'Glasgow Pupilar (GCS-P)',
    subtitle: 'Com reatividade pupilar',
    icon: 'Eye',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'ocular',
        label: 'Abertura Ocular (O)',
        type: 'select',
        options: [
          { value: 4, label: '4 - Espontanea' },
          { value: 3, label: '3 - Ao comando verbal' },
          { value: 2, label: '2 - A dor' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
      {
        id: 'verbal',
        label: 'Resposta Verbal (V)',
        type: 'select',
        options: [
          { value: 5, label: '5 - Orientada' },
          { value: 4, label: '4 - Confusa' },
          { value: 3, label: '3 - Palavras inapropriadas' },
          { value: 2, label: '2 - Sons incompreensiveis' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
      {
        id: 'motora',
        label: 'Resposta Motora (M)',
        type: 'select',
        options: [
          { value: 6, label: '6 - Obedece comandos' },
          { value: 5, label: '5 - Localiza dor' },
          { value: 4, label: '4 - Retirada inespecífica' },
          { value: 3, label: '3 - Flexao anormal' },
          { value: 2, label: '2 - Extensao' },
          { value: 1, label: '1 - Nenhuma' },
        ],
      },
      {
        id: 'pupilas',
        label: 'Reatividade Pupilar',
        type: 'select',
        options: [
          { value: 'ambas', label: 'Ambas reativas' },
          { value: 'uma', label: 'Uma reativa' },
          { value: 'nenhuma', label: 'Nenhuma reativa' },
        ],
      },
    ],
    compute: (values) => {
      const o = parseInt(values.ocular) || 1;
      const v = parseInt(values.verbal) || 1;
      const m = parseInt(values.motora) || 1;
      const gcs = o + v + m;

      // Pupil Reactivity Score (PRS): ambas=0, uma=1, nenhuma=2
      const prsMap = { ambas: 0, uma: 1, nenhuma: 2 };
      const prs = prsMap[values.pupilas] ?? 0;

      // GCS-P = GCS - PRS (range: 1-15)
      const gcsp = gcs - prs;

      let riskLabel, interpretacao;
      if (gcsp >= 13) {
        riskLabel = 'Leve';
        interpretacao = 'Prognóstico favorável';
      } else if (gcsp >= 9) {
        riskLabel = 'Moderado';
        interpretacao = 'Prognóstico intermediário';
      } else if (gcsp >= 5) {
        riskLabel = 'Grave';
        interpretacao = 'Prognóstico reservado';
      } else {
        riskLabel = 'Muito grave';
        interpretacao = 'Prognóstico muito reservado';
      }

      return {
        score: gcsp,
        riskLabel,
        details: {
          'GCS': `${gcs} (O${o}V${v}M${m})`,
          'Reatividade pupilar': values.pupilas === 'ambas' ? 'Ambas reativas (-0)' : values.pupilas === 'uma' ? 'Uma reativa (-1)' : 'Nenhuma reativa (-2)',
          'Interpretação': interpretacao,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      return `GCS-P: ${result.score} pontos`;
    },
    infoBox: {
      keyPoints: [
        'GCS-P = GCS - Pupil Reactivity Score (PRS)',
        'PRS: Ambas reativas = 0 | Uma reativa = 1 | Nenhuma = 2',
        'Range: 1-15 (GCS 3-15 menos PRS 0-2)',
        'Melhor preditor de mortalidade que GCS isolado em TCE',
      ],
      warnings: [
        'Verificar pupilas antes de sedação/bloqueadores neuromusculares',
      ],
      reference: 'Brennan PM et al. J Neurosurg 2018 | Teasdale G et al. Lancet Neurol 2014',
    },
  },
  {
    id: 'neuro_nihss',
    title: 'NIHSS',
    subtitle: 'AVC Isquemico',
    icon: 'Activity',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'consciencia',
        label: '1a. Nível de consciência',
        type: 'select',
        options: [
          { value: 0, label: '0 - Alerta' },
          { value: 1, label: '1 - Sonolento, desperta com estimulo mínimo' },
          { value: 2, label: '2 - Estuporoso, requer estimulo repetido' },
          { value: 3, label: '3 - Coma, sem resposta' },
        ],
      },
      {
        id: 'orientacao',
        label: '1b. Orientação (mes e idade)',
        type: 'select',
        options: [
          { value: 0, label: '0 - Ambas corretas' },
          { value: 1, label: '1 - Uma correta' },
          { value: 2, label: '2 - Nenhuma correta' },
        ],
      },
      {
        id: 'comandos',
        label: '1c. Comandos (fechar olhos, apertar mao)',
        type: 'select',
        options: [
          { value: 0, label: '0 - Ambos corretos' },
          { value: 1, label: '1 - Um correto' },
          { value: 2, label: '2 - Nenhum correto' },
        ],
      },
      {
        id: 'olhar',
        label: '2. Olhar conjugado',
        type: 'select',
        options: [
          { value: 0, label: '0 - Normal' },
          { value: 1, label: '1 - Paresia parcial do olhar' },
          { value: 2, label: '2 - Desvio forçado ou paresia total' },
        ],
      },
      {
        id: 'visual',
        label: '3. Campo visual',
        type: 'select',
        options: [
          { value: 0, label: '0 - Sem perda visual' },
          { value: 1, label: '1 - Hemianopsia parcial' },
          { value: 2, label: '2 - Hemianopsia completa' },
          { value: 3, label: '3 - Cegueira bilateral' },
        ],
      },
      {
        id: 'facial',
        label: '4. Paralisia facial',
        type: 'select',
        options: [
          { value: 0, label: '0 - Normal' },
          { value: 1, label: '1 - Paresia mínima (sulco apagado)' },
          { value: 2, label: '2 - Paresia parcial (face inferior)' },
          { value: 3, label: '3 - Paralisia completa uni ou bilateral' },
        ],
      },
      {
        id: 'braco_esq',
        label: '5a. Motor braco esquerdo',
        type: 'select',
        options: [
          { value: 0, label: '0 - Sem queda (mantém 10s)' },
          { value: 1, label: '1 - Queda antes de 10s' },
          { value: 2, label: '2 - Algum esforço contra gravidade' },
          { value: 3, label: '3 - Sem esforço contra gravidade' },
          { value: 4, label: '4 - Sem movimento' },
        ],
      },
      {
        id: 'braco_dir',
        label: '5b. Motor braco direito',
        type: 'select',
        options: [
          { value: 0, label: '0 - Sem queda (mantém 10s)' },
          { value: 1, label: '1 - Queda antes de 10s' },
          { value: 2, label: '2 - Algum esforço contra gravidade' },
          { value: 3, label: '3 - Sem esforço contra gravidade' },
          { value: 4, label: '4 - Sem movimento' },
        ],
      },
      {
        id: 'perna_esq',
        label: '6a. Motor perna esquerda',
        type: 'select',
        options: [
          { value: 0, label: '0 - Sem queda (mantém 5s)' },
          { value: 1, label: '1 - Queda antes de 5s' },
          { value: 2, label: '2 - Algum esforço contra gravidade' },
          { value: 3, label: '3 - Sem esforço contra gravidade' },
          { value: 4, label: '4 - Sem movimento' },
        ],
      },
      {
        id: 'perna_dir',
        label: '6b. Motor perna direita',
        type: 'select',
        options: [
          { value: 0, label: '0 - Sem queda (mantém 5s)' },
          { value: 1, label: '1 - Queda antes de 5s' },
          { value: 2, label: '2 - Algum esforço contra gravidade' },
          { value: 3, label: '3 - Sem esforço contra gravidade' },
          { value: 4, label: '4 - Sem movimento' },
        ],
      },
      {
        id: 'ataxia',
        label: '7. Ataxia de membros',
        type: 'select',
        options: [
          { value: 0, label: '0 - Ausente' },
          { value: 1, label: '1 - Presente em 1 membro' },
          { value: 2, label: '2 - Presente em 2 membros' },
        ],
      },
      {
        id: 'sensibilidade',
        label: '8. Sensibilidade',
        type: 'select',
        options: [
          { value: 0, label: '0 - Normal' },
          { value: 1, label: '1 - Perda leve a moderada' },
          { value: 2, label: '2 - Perda grave ou total' },
        ],
      },
      {
        id: 'linguagem',
        label: '9. Linguagem',
        type: 'select',
        options: [
          { value: 0, label: '0 - Normal' },
          { value: 1, label: '1 - Afasia leve a moderada' },
          { value: 2, label: '2 - Afasia grave' },
          { value: 3, label: '3 - Mutismo ou afasia global' },
        ],
      },
      {
        id: 'disartria',
        label: '10. Disartria',
        type: 'select',
        options: [
          { value: 0, label: '0 - Normal' },
          { value: 1, label: '1 - Leve a moderada' },
          { value: 2, label: '2 - Grave (ininteligível)' },
        ],
      },
      {
        id: 'negligencia',
        label: '11. Extincao/Negligência',
        type: 'select',
        options: [
          { value: 0, label: '0 - Ausente' },
          { value: 1, label: '1 - Parcial (1 modalidade)' },
          { value: 2, label: '2 - Completa (>1 modalidade)' },
        ],
      },
    ],
    compute: (values) => {
      const items = [
        'consciência', 'orientação', 'comandos', 'olhar', 'visual', 'facial',
        'braco_esq', 'braco_dir', 'perna_esq', 'perna_dir', 'ataxia',
        'sensibilidade', 'linguagem', 'disartria', 'negligência'
      ];

      let score = 0;
      items.forEach(item => {
        score += parseInt(values[item]) || 0;
      });

      let riskLabel, gravidade, prognóstico;
      if (score === 0) {
        riskLabel = 'Sem deficit';
        gravidade = 'Sem deficit neurológico';
        prognóstico = 'Excelente';
      } else if (score <= 4) {
        riskLabel = 'Leve';
        gravidade = 'AVC leve';
        prognóstico = 'Bom - considerar alta precoce';
      } else if (score <= 15) {
        riskLabel = 'Moderado';
        gravidade = 'AVC moderado';
        prognóstico = 'Intermediário - candidato a trombolise';
      } else if (score <= 20) {
        riskLabel = 'Moderado-grave';
        gravidade = 'AVC moderado a grave';
        prognóstico = 'Reservado - considerar trombectomia';
      } else {
        riskLabel = 'Grave';
        gravidade = 'AVC grave';
        prognóstico = 'Reservado - avaliar trombectomia mecânica';
      }

      return {
        score,
        riskLabel,
        details: {
          'Gravidade': gravidade,
          'Prognóstico': prognóstico,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha os campos';
      return `NIHSS: ${result.score} pontos`;
    },
    infoBox: {
      keyPoints: [
        '0: Sem deficit | 1-4: Leve | 5-15: Moderado | 16-20: Moderado-grave | >20: Grave',
        'Score 0-42 (15 itens)',
        'Usar para decisao de trombolise (rtPA) e trombectomia',
        'Reavaliar após intervenção para monitorar evolução',
      ],
      warnings: [
        'Tempo e cerebro: trombolise até 4.5h, trombectomia até 24h em casos selecionados',
      ],
      reference: 'Brott T et al. Stroke 1989 | Powers WJ et al. Stroke 2019 (AHA/ASA Guidelines)',
    },
  },
];

// =============================================================================
// SEÇÃO 14: MEDICACOES (1 calculadora)
// =============================================================================

const dorCalculators = [
  {
    id: 'dor_conversão',
    title: 'Conversão de Opioides',
    subtitle: 'Equianalgesia',
    icon: 'RefreshCw',
    status: 'active',
    useDropdown: true,
    inputs: [
      {
        id: 'opioide_origem',
        label: 'Opioide de origem',
        type: 'select',
        options: [
          { value: 'morfina_vo', label: 'Morfina VO' },
          { value: 'morfina_iv', label: 'Morfina IV/SC' },
          { value: 'tramadol_vo', label: 'Tramadol VO' },
          { value: 'tramadol_iv', label: 'Tramadol IV' },
          { value: 'codeina_vo', label: 'Codeina VO' },
          { value: 'oxicodona_vo', label: 'Oxicodona VO' },
          { value: 'metadona_vo', label: 'Metadona VO' },
          { value: 'fentanil_iv', label: 'Fentanil IV (mcg)' },
          { value: 'fentanil_td', label: 'Fentanil TD (mcg/h)' },
        ],
      },
      { id: 'dose_origem', label: 'Dose (mg ou mcg para fentanil)', type: 'number', min: 0.1, max: 1000, step: 0.1 },
      {
        id: 'opioide_destino',
        label: 'Converter para',
        type: 'select',
        options: [
          { value: 'morfina_vo', label: 'Morfina VO' },
          { value: 'morfina_iv', label: 'Morfina IV/SC' },
          { value: 'tramadol_vo', label: 'Tramadol VO' },
          { value: 'tramadol_iv', label: 'Tramadol IV' },
          { value: 'codeina_vo', label: 'Codeina VO' },
          { value: 'oxicodona_vo', label: 'Oxicodona VO' },
          { value: 'metadona_vo', label: 'Metadona VO' },
          { value: 'fentanil_iv', label: 'Fentanil IV (mcg)' },
          { value: 'fentanil_td', label: 'Fentanil TD (mcg/h)' },
        ],
      },
    ],
    compute: (values) => {
      const dose = parseFloat(values.dose_origem) || 0;
      if (dose === 0) return null;

      // Fatores de conversão para morfina VO equivalente (referência)
      // Morfina VO = 1, outros relativos a ela
      const paraMorfinaVO = {
        morfina_vo: 1,
        morfina_iv: 3,        // 1 mg IV = 3 mg VO
        tramadol_vo: 0.1,     // 100 mg tramadol = 10 mg morfina VO
        tramadol_iv: 0.1,
        codeina_vo: 0.15,     // 100 mg codeina = 15 mg morfina VO
        oxicodona_vo: 1.5,    // 10 mg oxicodona = 15 mg morfina VO
        metadona_vo: 4,       // Variável, usar com cautela (conversão não linear)
        fentanil_iv: 0.1,     // 100 mcg fentanil IV = 10 mg morfina VO
        fentanil_td: 2.4,     // 25 mcg/h TD = ~60 mg morfina VO/dia, por dose: ~2.4
      };

      const origem = values.opioide_origem;
      const destino = values.opioide_destino;

      if (!paraMorfinaVO[origem] || !paraMorfinaVO[destino]) return null;

      // Converter para morfina VO equivalente, depois para destino
      const morfinaVOeq = dose * paraMorfinaVO[origem];
      const doseDestino = morfinaVOeq / paraMorfinaVO[destino];

      // Aplicar redução de 25-50% para tolerância cruzada incompleta
      const doseReduzida = doseDestino * 0.75;

      const unidadeOrigem = origem.includes('fentanil') ? 'mcg' : 'mg';
      const unidadeDestino = destino.includes('fentanil') ? 'mcg' : 'mg';

      const nomeOpioides = {
        morfina_vo: 'Morfina VO',
        morfina_iv: 'Morfina IV',
        tramadol_vo: 'Tramadol VO',
        tramadol_iv: 'Tramadol IV',
        codeina_vo: 'Codeina VO',
        oxicodona_vo: 'Oxicodona VO',
        metadona_vo: 'Metadona VO',
        fentanil_iv: 'Fentanil IV',
        fentanil_td: 'Fentanil TD',
      };

      return {
        score: doseDestino,
        riskLabel: `${doseReduzida.toFixed(1)} ${unidadeDestino}`,
        details: {
          'Dose calculada': `${doseDestino.toFixed(1)} ${unidadeDestino}`,
          'Dose sugerida (-25%)': `${doseReduzida.toFixed(1)} ${unidadeDestino}`,
          'Morfina VO equivalente': `${morfinaVOeq.toFixed(1)} mg`,
        },
      };
    },
    resultMessage: (result) => {
      if (!result) return 'Preencha origem, dose e destino';
      return `Dose equivalente: ${result.score.toFixed(1)}`;
    },
    infoBox: {
      keyPoints: [
        'Conversão baseada em morfina VO como referência',
        'Reduzir 25-50% da dose calculada (tolerância cruzada incompleta)',
        'Metadona tem conversão nao-linear - usar tabelas específicas',
        'Fentanil TD: estado de equilíbrio em 12-24h',
      ],
      warnings: [
        'Conversoes são aproximadas - titular dose conforme resposta clínica',
      ],
      reference: 'McPherson ML. Demystifying Opioid Conversion Calculations. ASHP 2019',
    },
  },
  {
    id: 'doses_adultos',
    title: 'Doses em Adultos',
    subtitle: 'Cálculo de doses por peso',
    icon: 'Syringe',
    status: 'active',
    customRender: 'adultcalc',
    inputs: [
      { id: 'peso', label: 'Peso (kg)', type: 'number', min: 30, max: 200, step: 1 },
    ],
    compute: (values) => {
      const peso = parseFloat(values.peso) || 0;
      if (peso === 0) return null;

      // Dados de medicamentos adultos organizados por categoria
      const ADULT_CALC_DATA = {
        indutores: {
          categoria: 'Indutores',
          drogas: [
            { droga: 'PROPOFOL', apresentacao: '10 mg/ml', dosePadrao: '1.5-2.5', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Redução em idosos (1-1.5 mg/kg)' },
            { droga: 'ETOMIDATO', apresentacao: '2 mg/ml', dosePadrao: '0.2-0.3', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Estabilidade hemodinâmica' },
            { droga: 'KETAMINA', apresentacao: '50 mg/ml', dosePadrao: '1-2', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'IV. IM: 4-6 mg/kg' },
            { droga: 'MIDAZOLAM', apresentacao: '5 mg/ml', dosePadrao: '0.1-0.3', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Co-inducao: 0.03-0.05 mg/kg' },
          ],
        },
        opioides: {
          categoria: 'Opioides',
          drogas: [
            { droga: 'FENTANIL', apresentacao: '50 mcg/ml', dosePadrao: '1-3', unidadeDose: 'mcg/kg', diluicao: 'SEM DILUIR', obs: 'Analgesia: 1-2. IOT: 2-3 mcg/kg' },
            { droga: 'ALFENTANIL', apresentacao: '500 mcg/ml', dosePadrao: '10-30', unidadeDose: 'mcg/kg', diluicao: 'SEM DILUIR', obs: 'Duração curta (10-15 min)' },
            { droga: 'SUFENTANIL', apresentacao: '5 mcg/ml', dosePadrao: '0.1-0.5', unidadeDose: 'mcg/kg', diluicao: 'SEM DILUIR', obs: '10x mais potente que fentanil' },
            { droga: 'REMIFENTANIL', apresentacao: '1 mg/frasco', dosePadrao: '0.5-1', unidadeDose: 'mcg/kg', diluicao: '1 frasco + 20ml SF', obs: 'Bolus. Infusão: 0.05-0.2 mcg/kg/min' },
            { droga: 'MORFINA', apresentacao: '10 mg/ml', dosePadrao: '0.05-0.1', unidadeDose: 'mg/kg', diluicao: '1ml + 9ml AD', obs: 'Max 10-15 mg. Início 15-20 min' },
          ],
        },
        bnm: {
          categoria: 'Bloqueadores Neuromusculares',
          drogas: [
            { droga: 'SUCCINILCOLINA', apresentacao: '100 mg/frasco', dosePadrao: '1-1.5', unidadeDose: 'mg/kg', diluicao: '1 frasco + 10ml AD', obs: 'ISR. CI: hipercalemia, queimados >24h' },
            { droga: 'ROCURONIO', apresentacao: '10 mg/ml', dosePadrao: '0.6-1.2', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: '0.6: rotina. 1.2: ISR' },
            { droga: 'CISATRACURIO', apresentacao: '2 mg/ml', dosePadrao: '0.1-0.2', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Hofmann. Sem histamina' },
            { droga: 'ATRACURIO', apresentacao: '10 mg/ml', dosePadrao: '0.4-0.5', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Pode liberar histamina' },
          ],
        },
        reversores: {
          categoria: 'Reversores',
          drogas: [
            { droga: 'NEOSTIGMINA', apresentacao: '0.5 mg/ml', dosePadrao: '0.04-0.07', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Max 5 mg. + Atropina 0.02 mg/kg' },
            { droga: 'SUGAMMADEX (mod)', apresentacao: '100 mg/ml', dosePadrao: '2', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Bloqueio moderado (TOF 2+)' },
            { droga: 'SUGAMMADEX (prof)', apresentacao: '100 mg/ml', dosePadrao: '4', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Bloqueio profundo (PTC 1-2)' },
            { droga: 'FLUMAZENIL', apresentacao: '0.1 mg/ml', dosePadrao: '0.2-0.5', unidadeDose: 'mg', diluicao: 'SEM DILUIR', obs: 'Repetir 0.2 mg/min. Max 3 mg', fixo: true },
            { droga: 'NALOXONA', apresentacao: '0.4 mg/ml', dosePadrao: '0.04-0.4', unidadeDose: 'mg', diluicao: 'SEM DILUIR', obs: 'Titular. Cuidado em dependentes', fixo: true },
          ],
        },
        vasopressores: {
          categoria: 'Vasopressores',
          drogas: [
            { droga: 'EFEDRINA', apresentacao: '50 mg/ml', dosePadrao: '5-10', unidadeDose: 'mg', diluicao: '1ml + 9ml AD', obs: 'Bolus IV. Repetir PRN', fixo: true },
            { droga: 'FENILEFRINA', apresentacao: '10 mg/ml', dosePadrao: '50-200', unidadeDose: 'mcg', diluicao: '1ml + 99ml SF', obs: 'Bolus IV. Alfa-1 puro', fixo: true },
            { droga: 'NORADRENALINA', apresentacao: '2 mg/ml', dosePadrao: '0.05-0.5', unidadeDose: 'mcg/kg/min', diluicao: '4ml + 96ml SG5%', obs: 'Infusão. Acesso central' },
            { droga: 'ADRENALINA', apresentacao: '1 mg/ml', dosePadrao: '0.01-0.1', unidadeDose: 'mcg/kg/min', diluicao: '1ml + 99ml SF', obs: 'Infusão. PCR: 1 mg bolus' },
            { droga: 'VASOPRESSINA', apresentacao: '20 U/ml', dosePadrao: '0.01-0.04', unidadeDose: 'U/min', diluicao: 'SEM DILUIR', obs: 'Choque refratario', fixo: true },
          ],
        },
        adjuvantes: {
          categoria: 'Adjuvantes',
          drogas: [
            { droga: 'ATROPINA', apresentacao: '0.25 mg/ml', dosePadrao: '0.01-0.02', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Min 0.1 mg. Max 3 mg total' },
            { droga: 'LIDOCAINA IV', apresentacao: '20 mg/ml', dosePadrao: '1-1.5', unidadeDose: 'mg/kg', diluicao: 'SEM DILUIR', obs: 'Laringoscopia. Max 3 mg/kg' },
            { droga: 'DEXAMETASONA', apresentacao: '4 mg/ml', dosePadrao: '4-8', unidadeDose: 'mg', diluicao: 'SEM DILUIR', obs: 'NVPO, edema. Cuidado DM', fixo: true },
            { droga: 'ONDANSETRONA', apresentacao: '2 mg/ml', dosePadrao: '4-8', unidadeDose: 'mg', diluicao: 'SEM DILUIR', obs: 'NVPO. QT longo: cautela', fixo: true },
            { droga: 'DIPIRONA', apresentacao: '500 mg/ml', dosePadrao: '1-2', unidadeDose: 'g', diluicao: 'SEM DILUIR', obs: 'Analgesia, antipiretico', fixo: true },
            { droga: 'CETOPROFENO', apresentacao: '50 mg/ml', dosePadrao: '100', unidadeDose: 'mg', diluicao: 'SEM DILUIR', obs: 'AINE. Evitar em renal', fixo: true },
          ],
        },
      };

      // Calcular todas as categorias
      const categorias = [];
      Object.keys(ADULT_CALC_DATA).forEach((catKey) => {
        const catData = ADULT_CALC_DATA[catKey];
        const medicamentos = [];

        catData.drogas.forEach((med) => {
          const doses = med.dosePadrao.split('-').map(d => parseFloat(d));
          let doseMin, doseMax, doseCalculada;

          if (med.fixo) {
            // Dose fixa (não depende do peso)
            doseMin = doses[0];
            doseMax = doses.length > 1 ? doses[1] : doses[0];
            doseCalculada = doseMin === doseMax ? `${doseMin}` : `${doseMin}-${doseMax}`;
          } else {
            // Dose por kg
            doseMin = doses[0] * peso;
            doseMax = doses.length > 1 ? doses[1] * peso : doseMin;
            doseCalculada = doseMin === doseMax ? `${doseMin.toFixed(1)}` : `${doseMin.toFixed(1)}-${doseMax.toFixed(1)}`;
          }

          // Determinar unidade para exibicao
          let unidadeExibicao = med.unidadeDose;
          if (!med.fixo) {
            unidadeExibicao = med.unidadeDose.replace('/kg', '').replace('/min', '/min');
          }

          medicamentos.push({
            droga: med.droga,
            apresentacao: med.apresentação,
            diluicao: med.diluicao,
            dose: `${doseCalculada} ${unidadeExibicao}`,
            dosePadrao: `${med.dosePadrao} ${med.unidadeDose}`,
            obs: med.obs,
          });
        });

        categorias.push({
          key: catKey,
          titulo: catData.categoria,
          medicamentos,
        });
      });

      return {
        score: peso,
        categorias,
        totalMedicamentos: categorias.reduce((acc, cat) => acc + cat.medicamentos.length, 0),
      };
    },
    resultMessage: (result) => {
      if (!result || !result.categorias) return 'Informe o peso do paciente';
      return `${result.totalMedicamentos} medicamentos calculados para ${result.score} kg`;
    },
    infoBox: {
      interpretation: 'Doses calculadas para adultos baseadas no peso corporal. Indutores: reduzir 30-50% em idosos e debilitados. Opioides: titular conforme resposta. BNM: considerar peso ideal em obesos. Vasopressores em infusão requerem acesso central. Sempre considerar função renal/hepática e interações medicamentosas.',
      reference: 'Miller RD. Miller Anesthesia 9th ed. 2020 | Barash PG. Clínical Anesthesia 8th ed. 2017',
    },
  },
];

// =============================================================================
// ESTRUTURA DE SECOES (13 secoes)
// =============================================================================

export const calculatorSections = [
  // PEDIATRIA (4 secoes)
  { id: 'ped_doses', title: 'Pediatria - Doses', icon: 'Pill', calculators: pedDosesCalculators },
  { id: 'ped_via_aerea', title: 'Pediatria - Via Aérea e Reanimação', icon: 'Wind', calculators: pedViaAereaCalculators },
  { id: 'ped_periop', title: 'Pediatria - Perioperatório e SRPA', icon: 'Bed', calculators: pedPeriopCalculators },
  { id: 'ped_uti', title: 'Pediatria - UTI e Prognóstico', icon: 'Activity', calculators: pedUtiCalculators },
  // ADULTO (10 secoes)
  { id: 'acls', title: 'Emergência e Ressuscitação (ACLS)', icon: 'Siren', calculators: aclsCalculators },
  { id: 'hemo', title: 'Hemodinâmica, Fluidos e Sangue', icon: 'Droplet', calculators: hemoCalculators },
  { id: 'uti', title: 'Terapia Intensiva', icon: 'Activity', calculators: utiCalculators },
  { id: 'periop', title: 'Perioperatório e Via Aérea', icon: 'Stethoscope', calculators: periopCalculators },
  { id: 'risco', title: 'Risco Cardiovascular', icon: 'HeartPulse', calculators: riscoCalculators },
  { id: 'seg', title: 'Seguranca do Paciente', icon: 'Shield', calculators: segCalculators },
  { id: 'renal', title: 'Função Renal e Eletrólitos', icon: 'Beaker', calculators: renalCalculators },
  { id: 'neuro', title: 'Neurologia', icon: 'Brain', calculators: neuroCalculators },
  { id: 'dor', title: 'Medicacoes', icon: 'Pill', calculators: dorCalculators },
];

// =============================================================================
// HELPERS
// =============================================================================

export function getCalculatorById(id) {
  for (const section of calculatorSections) {
    const calc = section.calculators.find((c) => c.id === id);
    if (calc) return calc;
  }
  return null;
}

export function getAllCalculators() {
  return calculatorSections.flatMap((s) => s.calculators);
}

export function getActiveCalculators() {
  return getAllCalculators().filter((c) => c.status === 'active');
}

export function getComingSoonCalculators() {
  return getAllCalculators().filter((c) => c.status === 'coming_soon');
}

export function getSectionsWithCalculators() {
  return calculatorSections.map((section) => ({
    ...section,
    activeCount: section.calculators.filter((c) => c.status === 'active').length,
    totalCount: section.calculators.length,
  }));
}

// Export default para compatibilidade
export default {
  RISK_LEVELS,
  calculatorSections,
  getCalculatorById,
  getAllCalculators,
  getActiveCalculators,
  getComingSoonCalculators,
  getSectionsWithCalculators,
};
