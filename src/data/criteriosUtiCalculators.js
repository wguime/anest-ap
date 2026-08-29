// Definicoes das 5 calculadoras de triagem UTI pos-operatoria
// Baseado em revisao sistematica da literatura medica (2023-2025)

// ============================================================
// CALCULADORA 1: SORT (Surgical Outcome Risk Tool)
// ============================================================
export const SORT_CALCULATOR = {
  id: 'sort',
  name: 'SORT',
  fullName: 'Ferramenta de Risco de Desfecho Cirúrgico',
  categoria: 'pre',
  descricao: '6 variáveis — Risco mortalidade 30 dias',
  melhorPara: 'Cirurgias eletivas e urgentes',
  auroc: '0.91 (mortalidade 30d)',
  references: [
    'Protopapa KL et al. Development and validation of the Surgical Outcome Risk Tool (SORT). Br J Surg 2014;101(13):1774-83.',
    'NCEPOD "Knowing the Risk" — 19.097 pacientes, 326 hospitais.',
  ],
  intercept: -7.366,
  inputs: [
    {
      id: 'asa',
      label: 'Classificação ASA',
      type: 'select',
      options: [
        { label: 'ASA I-II', value: 0 },
        { label: 'ASA III', value: 1.411 },
        { label: 'ASA IV', value: 2.388 },
        { label: 'ASA V', value: 4.081 },
      ],
    },
    {
      id: 'urgencia',
      label: 'Urgência da cirurgia',
      type: 'select',
      options: [
        { label: 'Eletiva', value: 0 },
        { label: 'Expedita (semanas)', value: 1.236 },
        { label: 'Urgente (horas)', value: 1.657 },
        { label: 'Imediata (minutos)', value: 2.452 },
      ],
    },
    {
      id: 'especialidade',
      label: 'Especialidade de alto risco',
      sublabel: 'Gastrointestinal, torácica ou vascular',
      type: 'bool',
      coef: 0.712,
    },
    {
      id: 'severidade',
      label: 'Severidade cirúrgica',
      type: 'select',
      options: [
        { label: 'Menor / Intermediário', value: 0 },
        { label: 'Maior / Complexo', value: 0.381 },
      ],
    },
    {
      id: 'cancer',
      label: 'Diagnóstico de câncer',
      type: 'bool',
      coef: 0.667,
    },
    {
      id: 'idade',
      label: 'Faixa etária',
      type: 'select',
      options: [
        { label: '< 65 anos', value: 0 },
        { label: '65-79 anos', value: 0.777 },
        { label: '≥ 80 anos', value: 1.591 },
      ],
    },
  ],
  compute(values) {
    let logit = this.intercept;
    const motivos = [];

    for (const input of this.inputs) {
      const val = values[input.id];
      if (val === undefined || val === null) continue;

      if (input.type === 'bool') {
        if (val) {
          logit += input.coef;
          motivos.push({ label: input.label, coef: `+${input.coef.toFixed(3)}` });
        }
      } else {
        const numVal = parseFloat(val);
        if (numVal > 0) {
          logit += numVal;
          const opt = input.options.find((o) => o.value === numVal);
          motivos.push({
            label: `${input.label}: ${opt?.label || val}`,
            coef: `+${numVal.toFixed(3)}`,
          });
        }
      }
    }

    const risco = (Math.exp(logit) / (1 + Math.exp(logit))) * 100;

    let nivel, conduta, cor;
    if (risco < 2) {
      nivel = 'Baixo';
      conduta = 'Enfermaria';
      cor = 'green';
    } else if (risco < 5) {
      nivel = 'Moderado';
      conduta = 'SRPA prolongada';
      cor = 'yellow';
    } else if (risco < 10) {
      nivel = 'Alto';
      conduta = 'Considerar UTI';
      cor = 'orange';
    } else {
      nivel = 'Muito Alto';
      conduta = 'UTI recomendada';
      cor = 'red';
    }

    return {
      score: risco.toFixed(1),
      scoreLabel: `${risco.toFixed(1)}%`,
      scoreMax: '100%',
      nivel,
      conduta,
      cor,
      motivos,
    };
  },
  interpretacao: [
    { faixa: '< 2%', nivel: 'Baixo', conduta: 'Enfermaria' },
    { faixa: '2-5%', nivel: 'Moderado', conduta: 'SRPA prolongada' },
    { faixa: '5-10%', nivel: 'Alto', conduta: 'Considerar UTI' },
    { faixa: '> 10%', nivel: 'Muito Alto', conduta: 'UTI recomendada' },
  ],
  disclaimer: 'Faixas de risco adaptadas para decisão clínica. O SORT original fornece probabilidade contínua sem categorias. Limiar RCS: ≥5% = alto risco cirúrgico.',
};

// ============================================================
// CALCULADORA 2: Emergency Surgery Score (ESS)
// ============================================================
export const ESS_CALCULATOR = {
  id: 'ess',
  name: 'ESS',
  fullName: 'Escore de Cirurgia de Emergência',
  categoria: 'pre',
  descricao: '22 variáveis — Predição UTI em emergências',
  melhorPara: 'Emergências cirúrgicas (c-stat 0.91)',
  auroc: '0.91 (UTI), 0.94 (mortalidade)',
  references: [
    'Sangji NF et al. Derivation of a novel Emergency Surgery Score (ESS). J Trauma Acute Care Surg 2016;81(5):S2.',
    'Peponis T et al. Validation of ESS for ICU triage. Am J Surg 2019;217(1):150-155.',
    'Nikolopoulos I et al. Multicentric validation. BMC Surg 2021;21:55.',
  ],
  disclaimer: 'A variável "raça branca" (+1 pt) da derivação original (ACS-NSQIP, EUA) foi REMOVIDA do cálculo em 29/08/2026: validações internacionais a omitem por refletir confundidor socioeconômico, não risco biológico. O escore máximo desta seção passa de 5 para 4 pontos.',
  sections: [
    {
      title: 'Demografia',
      sublabel: '0-4 pontos',
      inputs: [
        { id: 'idade60', label: 'Idade > 60 anos', type: 'bool', pts: 2 },
        { id: 'transferPs', label: 'Transferência de PS externo', type: 'bool', pts: 1 },
        { id: 'transferInternacao', label: 'Transferência de internação', type: 'bool', pts: 1 },
      ],
    },
    {
      title: 'Comorbidades',
      sublabel: '0-14 pontos',
      inputs: [
        { id: 'ascite', label: 'Ascite', type: 'bool', pts: 1 },
        { id: 'imcBaixo', label: 'IMC < 20', type: 'bool', pts: 1 },
        { id: 'cancerDisseminado', label: 'Câncer disseminado', type: 'bool', pts: 3 },
        { id: 'dispneia', label: 'Dispneia', type: 'bool', pts: 1 },
        { id: 'dependenciaFuncional', label: 'Dependência funcional', type: 'bool', pts: 1 },
        { id: 'dpoc', label: 'DPOC', type: 'bool', pts: 1 },
        { id: 'has', label: 'Hipertensão arterial', type: 'bool', pts: 1 },
        { id: 'corticoides', label: 'Uso de corticoides', type: 'bool', pts: 1 },
        { id: 'vmPreop', label: 'Ventilação mecânica pré-op (48h)', type: 'bool', pts: 3 },
        { id: 'perdaPeso', label: 'Perda de peso > 10%', type: 'bool', pts: 1 },
      ],
    },
    {
      title: 'Laboratório',
      sublabel: '0-13 pontos',
      inputs: [
        { id: 'albumina', label: 'Albumina < 3.0 g/dL', type: 'bool', pts: 1 },
        { id: 'fa', label: 'Fosfatase alcalina > 125 U/L', type: 'bool', pts: 1 },
        { id: 'bun', label: 'BUN > 40 mg/dL', type: 'bool', pts: 1 },
        { id: 'creatinina', label: 'Creatinina > 1.2 mg/dL', type: 'bool', pts: 2 },
        { id: 'inr', label: 'INR > 1.5', type: 'bool', pts: 1 },
        { id: 'plaquetas', label: 'Plaquetas < 150.000', type: 'bool', pts: 1 },
        { id: 'tgo', label: 'TGO > 40 U/L', type: 'bool', pts: 1 },
        { id: 'sodio', label: 'Sódio > 145 mEq/L', type: 'bool', pts: 1 },
        {
          id: 'leucocitos',
          label: 'Leucócitos',
          type: 'select',
          options: [
            { label: 'Normal (4.5-15k)', value: 0 },
            { label: '< 4.500', value: 1 },
            { label: '15.000-25.000', value: 1 },
            { label: '> 25.000', value: 2 },
          ],
        },
      ],
    },
  ],
  compute(values) {
    let total = 0;
    const motivos = [];

    for (const section of this.sections) {
      for (const input of section.inputs) {
        const val = values[input.id];
        if (input.type === 'bool' && val) {
          total += input.pts;
          motivos.push({ label: input.label, coef: `+${input.pts}` });
        } else if (input.type === 'select' && val !== undefined && val !== null) {
          const numVal = parseInt(val, 10);
          if (numVal > 0) {
            total += numVal;
            const opt = input.options.find((o) => o.value === numVal);
            motivos.push({ label: `${input.label}: ${opt?.label || val}`, coef: `+${numVal}` });
          }
        }
      }
    }

    let nivel, conduta, cor, mortalidade;
    if (total <= 3) {
      nivel = 'Baixo';
      conduta = 'Enfermaria';
      cor = 'green';
      mortalidade = '< 5%';
    } else if (total <= 6) {
      nivel = 'Moderado';
      conduta = 'UCI (Unidade de Cuidados Intermediários)';
      cor = 'yellow';
      mortalidade = '5-15%';
    } else if (total <= 9) {
      nivel = 'Alto';
      conduta = 'UTI recomendada (cutoff ≥ 7)';
      cor = 'orange';
      mortalidade = '15-40%';
    } else {
      nivel = 'Muito Alto';
      conduta = 'UTI obrigatória';
      cor = 'red';
      mortalidade = '> 40%';
    }

    return {
      score: total,
      scoreLabel: `${total}/29`,
      scoreMax: '29',
      nivel,
      conduta,
      cor,
      mortalidade,
      motivos,
    };
  },
  interpretacao: [
    { faixa: '0-3', nivel: 'Baixo', conduta: 'Enfermaria', mortalidade: '< 5%' },
    { faixa: '4-6', nivel: 'Moderado', conduta: 'UCI', mortalidade: '5-15%' },
    { faixa: '≥ 7', nivel: 'Alto', conduta: 'UTI (cutoff)', mortalidade: '15-40%' },
    { faixa: '≥ 10', nivel: 'Muito Alto', conduta: 'UTI obrigatória', mortalidade: '> 40%' },
  ],
};

// ============================================================
// CALCULADORA 3: POTTER-Inspirado (Arvore de Decisao)
// ============================================================
export const POTTER_CALCULATOR = {
  id: 'potter',
  name: 'POTTER-Inspirado',
  fullName: 'Árvore de Decisão para Emergências (inspirado em POTTER)',
  categoria: 'pre',
  descricao: 'Árvore adaptativa — 8-12 perguntas',
  melhorPara: 'Emergências, decisão adaptativa por etapas',
  nota: 'Calculadora inspirada na metodologia POTTER. O algoritmo original é proprietário.',
  references: [
    'Bertsimas D et al. Surgical Risk Is Not Linear: Derivation and Validation of a Novel, User-friendly, and Machine-learning-based Predictive OpTimal Trees in Emergency Surgery Risk (POTTER) Calculator. Ann Surg 2018;268(4):574-583.',
    'Kaafarani HMA et al. Prospective Validation of POTTER. J Am Coll Surg 2021;232(4):e23-e35.',
    'Nota: Calculadora inspirada na metodologia POTTER. O algoritmo original usa Optimal Classification Trees proprietárias.',
  ],

  // Arvore de decisao: cada no tem id, pergunta, tipo, e ramos
  tree: {
    id: 'idade',
    question: 'Qual a idade do paciente?',
    type: 'select',
    options: [
      { label: '≥ 65 anos', value: 'idoso' },
      { label: '< 65 anos', value: 'jovem' },
    ],
    branches: {
      idoso: {
        id: 'statusFuncional_idoso',
        question: 'Qual o status funcional do paciente?',
        type: 'select',
        options: [
          { label: 'Totalmente dependente', value: 'dependente' },
          { label: 'Parcialmente dependente', value: 'parcial' },
          { label: 'Independente', value: 'independente' },
        ],
        branches: {
          dependente: {
            id: 'labs_criticos_dep',
            question: 'Há alterações laboratoriais críticas?',
            sublabel: 'INR > 1.5, Leucócitos fora 4.5-15k, Hematócrito < 30%',
            type: 'select',
            options: [
              { label: '≥ 2 alterados', value: 'sim' },
              { label: '< 2 alterados', value: 'nao' },
            ],
            branches: {
              sim: { result: 'critico', mortalidade: '> 40%' },
              nao: { result: 'alto', mortalidade: '20-40%' },
            },
          },
          parcial: {
            id: 'asa_parcial',
            question: 'Qual o ASA do paciente?',
            type: 'select',
            options: [
              { label: 'ASA IV-V', value: 'alto' },
              { label: 'ASA I-III', value: 'baixo' },
            ],
            branches: {
              alto: { result: 'alto', mortalidade: '20-40%' },
              baixo: {
                id: 'albumina_parcial',
                question: 'Albumina sérica?',
                type: 'select',
                options: [
                  { label: '< 3.0 g/dL', value: 'baixa' },
                  { label: '≥ 3.0 g/dL', value: 'normal' },
                ],
                branches: {
                  baixa: { result: 'moderado_alto', mortalidade: '10-20%' },
                  normal: {
                    id: 'creatinina_parcial',
                    question: 'Creatinina sérica?',
                    type: 'select',
                    options: [
                      { label: '> 1.2 mg/dL', value: 'alta' },
                      { label: '≤ 1.2 mg/dL', value: 'normal' },
                    ],
                    branches: {
                      alta: { result: 'moderado', mortalidade: '3-10%' },
                      normal: { result: 'baixo_moderado', mortalidade: '3-10%' },
                    },
                  },
                },
              },
            },
          },
          independente: {
            id: 'asa_independente',
            question: 'Qual o ASA do paciente?',
            type: 'select',
            options: [
              { label: 'ASA IV-V', value: 'alto' },
              { label: 'ASA I-III', value: 'baixo' },
            ],
            branches: {
              alto: { result: 'alto', mortalidade: '20-40%' },
              baixo: {
                id: 'comorbidades_idoso_ind',
                question: 'Quantas comorbidades graves presentes?',
                sublabel: 'DPOC, ICC, Câncer disseminado, Ascite',
                type: 'select',
                options: [
                  { label: '≥ 2 comorbidades', value: 'muitas' },
                  { label: '< 2 comorbidades', value: 'poucas' },
                ],
                branches: {
                  muitas: { result: 'moderado_alto', mortalidade: '10-20%' },
                  poucas: {
                    id: 'labs_idoso_ind',
                    question: 'Quantos exames laboratoriais alterados?',
                    sublabel: 'INR > 1.5, Leucócitos fora 4.5-15k, Hematócrito < 30%',
                    type: 'select',
                    options: [
                      { label: '≥ 2 alterados', value: 'muitos' },
                      { label: '< 2 alterados', value: 'poucos' },
                    ],
                    branches: {
                      muitos: { result: 'moderado', mortalidade: '3-10%' },
                      poucos: { result: 'baixo', mortalidade: '< 3%' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      jovem: {
        id: 'asa_jovem',
        question: 'Qual o ASA do paciente?',
        type: 'select',
        options: [
          { label: 'ASA IV-V', value: 'alto' },
          { label: 'ASA III', value: 'medio' },
          { label: 'ASA I-II', value: 'baixo' },
        ],
        branches: {
          alto: {
            id: 'vm_jovem_alto',
            question: 'Paciente em ventilação mecânica pré-operatória?',
            type: 'select',
            options: [
              { label: 'Sim', value: 'sim' },
              { label: 'Não', value: 'nao' },
            ],
            branches: {
              sim: { result: 'critico', mortalidade: '> 40%' },
              nao: { result: 'alto', mortalidade: '20-40%' },
            },
          },
          medio: {
            id: 'funcional_jovem_asa3',
            question: 'Qual o status funcional do paciente?',
            type: 'select',
            options: [
              { label: 'Dependente (total ou parcial)', value: 'dependente' },
              { label: 'Independente', value: 'independente' },
            ],
            branches: {
              dependente: { result: 'alto', mortalidade: '20-40%' },
              independente: {
                id: 'albumina_jovem_asa3',
                question: 'Albumina sérica?',
                type: 'select',
                options: [
                  { label: '< 3.0 g/dL', value: 'baixa' },
                  { label: '≥ 3.0 g/dL', value: 'normal' },
                ],
                branches: {
                  baixa: { result: 'moderado_alto', mortalidade: '10-20%' },
                  normal: { result: 'moderado', mortalidade: '3-10%' },
                },
              },
            },
          },
          baixo: {
            id: 'comorbidades_jovem',
            question: 'Quantas comorbidades graves presentes?',
            sublabel: 'DPOC, ICC, Câncer disseminado, Ascite',
            type: 'select',
            options: [
              { label: '≥ 2 comorbidades', value: 'muitas' },
              { label: '< 2 comorbidades', value: 'poucas' },
            ],
            branches: {
              muitas: { result: 'moderado', mortalidade: '3-10%' },
              poucas: { result: 'baixo', mortalidade: '< 3%' },
            },
          },
        },
      },
    },
  },

  // Mapa de resultados
  resultMap: {
    baixo: { nivel: 'Baixo', conduta: 'Enfermaria', cor: 'green' },
    baixo_moderado: { nivel: 'Baixo-Moderado', conduta: 'Enfermaria', cor: 'green' },
    moderado: { nivel: 'Moderado', conduta: 'UCI ou SRPA prolongada', cor: 'yellow' },
    moderado_alto: { nivel: 'Moderado-Alto', conduta: 'Considerar UTI', cor: 'orange' },
    alto: { nivel: 'Alto', conduta: 'UTI recomendada', cor: 'orange' },
    critico: { nivel: 'Crítico', conduta: 'UTI obrigatória', cor: 'red' },
  },

  interpretacao: [
    { faixa: 'Baixo', conduta: 'Enfermaria', mortalidade: '< 3%' },
    { faixa: 'Moderado', conduta: 'UCI ou SRPA prolongada', mortalidade: '3-10%' },
    { faixa: 'Moderado-Alto', conduta: 'Considerar UTI', mortalidade: '10-20%' },
    { faixa: 'Alto', conduta: 'UTI recomendada', mortalidade: '20-40%' },
    { faixa: 'Crítico', conduta: 'UTI obrigatória', mortalidade: '> 40%' },
  ],
};

// ============================================================
// CALCULADORA 4: Surgical Apgar Score (SAS)
// ============================================================
export const SAS_CALCULATOR = {
  id: 'sas',
  name: 'SAS',
  fullName: 'Escore de Apgar Cirúrgico',
  categoria: 'intra',
  descricao: '3 variáveis — Avaliação rápida ao final da cirurgia',
  melhorPara: 'Decisão intraoperatória rápida',
  auroc: '0.74-0.80 (UTI)',
  references: [
    'Gawande AA et al. An Apgar Score for Surgery. J Am Coll Surg 2007;204(2):201-208.',
    'Lin YC et al. Association of SAS with ICU admission. Sci Rep 2021;11:1774.',
    'Glass NE et al. Validation of SAS in trauma patients. J Trauma 2015;79(1):15-20.',
  ],
  inputs: [
    {
      id: 'ebl',
      label: 'Perda sanguínea estimada',
      type: 'select',
      options: [
        { label: '> 1.000 mL', value: 0, detail: '0 pontos' },
        { label: '601-1.000 mL', value: 1, detail: '1 ponto' },
        { label: '101-600 mL', value: 2, detail: '2 pontos' },
        { label: '≤ 100 mL', value: 3, detail: '3 pontos' },
      ],
    },
    {
      id: 'pam',
      label: 'Menor PAM intraoperatória',
      type: 'select',
      options: [
        { label: '< 40 mmHg', value: 0, detail: '0 pontos' },
        { label: '40-54 mmHg', value: 1, detail: '1 ponto' },
        { label: '55-69 mmHg', value: 2, detail: '2 pontos' },
        { label: '≥ 70 mmHg', value: 3, detail: '3 pontos' },
      ],
    },
    {
      id: 'fc',
      label: 'Menor FC intraoperatória',
      type: 'select',
      options: [
        { label: 'Bradiarritmia / Assistolia', value: 0, detail: '0 pontos' },
        { label: '> 85 bpm', value: 0, detail: '0 pontos' },
        { label: '76-85 bpm', value: 1, detail: '1 ponto' },
        { label: '66-75 bpm', value: 2, detail: '2 pontos' },
        { label: '56-65 bpm', value: 3, detail: '3 pontos' },
        { label: '≤ 55 bpm', value: 4, detail: '4 pontos' },
      ],
    },
  ],
  compute(values) {
    let total = 0;
    const motivos = [];

    for (const input of this.inputs) {
      const val = values[input.id];
      if (val !== undefined && val !== null) {
        const numVal = parseInt(val, 10);
        total += numVal;
        const opt = input.options.find((o) => o.value === numVal);
        if (opt) {
          motivos.push({ label: `${input.label}: ${opt.label}`, coef: `${numVal} pts` });
        }
      }
    }

    let nivel, conduta, cor;
    if (total <= 4) {
      nivel = 'Crítico';
      conduta = 'UTI obrigatória';
      cor = 'red';
    } else if (total <= 6) {
      nivel = 'Alto';
      conduta = 'Considerar UTI';
      cor = 'orange';
    } else if (total <= 8) {
      nivel = 'Moderado';
      conduta = 'Avaliação individualizada';
      cor = 'yellow';
    } else {
      nivel = 'Baixo';
      conduta = 'Cuidados habituais';
      cor = 'green';
    }

    return {
      score: total,
      scoreLabel: `${total}/10`,
      scoreMax: '10',
      nivel,
      conduta,
      cor,
      motivos,
      nota: 'Score invertido: maior = melhor prognóstico',
    };
  },
  interpretacao: [
    { faixa: '0-4', nivel: 'Crítico', conduta: 'UTI obrigatória' },
    { faixa: '5-6', nivel: 'Alto', conduta: 'Considerar UTI' },
    { faixa: '7-8', nivel: 'Moderado', conduta: 'Avaliação individualizada' },
    { faixa: '9-10', nivel: 'Baixo', conduta: 'Cuidados habituais' },
  ],
};

// ============================================================
// CALCULADORA 5: Criterios SIAARTI 2025
// ============================================================
export const SIAARTI_CALCULATOR = {
  id: 'siaarti',
  name: 'SIAARTI 2025',
  fullName: 'Critérios SIAARTI-SIC-ANIARTI 2025',
  categoria: 'composto',
  descricao: '22 critérios — Guideline baseado em evidência',
  melhorPara: 'Decisão abrangente pré + intraoperatória',
  auroc: 'Consenso Delphi — sem AUROC (não é score preditivo)',
  references: [
    'SIAARTI-SIC-ANIARTI. Good clinical practice for planning ICU admission after major abdominal surgery. J Anesth Analg Crit Care 2025;5:42.',
    'Scoping Review: Surgical ICU Admission Criteria — 44 estudos. Crit Care Explor 2025;7(7).',
  ],
  disclaimer: 'Checklist de consenso Delphi (não score preditivo validado). Pontuação adaptada para decisão clínica — valores de pontos NÃO são da publicação original. Sem AUROC disponível.',
  sections: [
    {
      title: 'A. Fatores do Paciente (pré-op)',
      sublabel: '0-12 pontos',
      inputs: [
        {
          id: 'asa',
          label: 'Classificação ASA',
          type: 'select',
          options: [
            { label: 'ASA I-II', value: 0 },
            { label: 'ASA III', value: 1 },
            { label: 'ASA ≥ IV', value: 2 },
          ],
        },
        {
          id: 'charlson',
          label: 'Índice de Comorbidade de Charlson ≥ 2',
          type: 'bool',
          pts: 1,
          subCalculator: {
            title: 'Calcular Índice de Charlson',
            threshold: 2,
            thresholdLabel: '≥ 2',
            items: [
              { id: 'cci_iam', label: 'Infarto do miocárdio', pts: 1 },
              { id: 'cci_icc', label: 'Insuficiência cardíaca congestiva', pts: 1 },
              { id: 'cci_dvp', label: 'Doença vascular periférica', pts: 1 },
              { id: 'cci_dcv', label: 'Doença cerebrovascular', pts: 1 },
              { id: 'cci_demencia', label: 'Demência', pts: 1 },
              { id: 'cci_dpoc', label: 'Doença pulmonar crônica', pts: 1 },
              { id: 'cci_dtc', label: 'Doença do tecido conjuntivo', pts: 1 },
              { id: 'cci_ulcera', label: 'Úlcera péptica', pts: 1 },
              { id: 'cci_hep_leve', label: 'Doença hepática leve', pts: 1 },
              { id: 'cci_dm', label: 'Diabetes sem complicação', pts: 1 },
              { id: 'cci_hemiplegia', label: 'Hemiplegia', pts: 2 },
              { id: 'cci_drc', label: 'Doença renal moderada a grave', pts: 2 },
              { id: 'cci_dm_org', label: 'Diabetes com lesão de órgão-alvo', pts: 2 },
              { id: 'cci_tumor', label: 'Tumor sólido localizado', pts: 2 },
              { id: 'cci_leucemia', label: 'Leucemia', pts: 2 },
              { id: 'cci_linfoma', label: 'Linfoma', pts: 2 },
              { id: 'cci_hep_grave', label: 'Doença hepática moderada a grave', pts: 3 },
              { id: 'cci_meta', label: 'Tumor sólido metastático', pts: 6 },
              { id: 'cci_aids', label: 'AIDS/HIV', pts: 6 },
            ],
            compute(values) {
              return this.items.reduce((sum, item) => sum + (values[item.id] ? item.pts : 0), 0);
            },
          },
        },
        {
          id: 'frailty',
          label: 'Escala Clínica de Fragilidade ≥ 5',
          type: 'bool',
          pts: 1,
          subCalculator: {
            title: 'Calcular Escala de Fragilidade',
            threshold: 5,
            thresholdLabel: '≥ 5',
            items: [
              {
                id: 'cfs_score',
                type: 'select',
                label: 'Nível de fragilidade',
                options: [
                  { value: 1, label: '1 — Muito apto: robusto, ativo, energético' },
                  { value: 2, label: '2 — Bem: sem doença ativa, menos apto' },
                  { value: 3, label: '3 — Controlando bem: problemas médicos controlados' },
                  { value: 4, label: '4 — Vulnerável: não dependente, mas limitado' },
                  { value: 5, label: '5 — Levemente frágil: dependência parcial' },
                  { value: 6, label: '6 — Moderadamente frágil: precisa de ajuda' },
                  { value: 7, label: '7 — Gravemente frágil: completamente dependente' },
                  { value: 8, label: '8 — Muito gravemente frágil: próximo ao fim da vida' },
                  { value: 9, label: '9 — Doente terminal: expectativa < 6 meses' },
                ],
              },
            ],
            compute(values) {
              return values.cfs_score || 0;
            },
          },
        },
        {
          id: 'rcri',
          label: 'Índice de Risco Cardíaco Revisado (RCRI) ≥ 2',
          type: 'bool',
          pts: 1,
          subCalculator: {
            title: 'Calcular RCRI (Lee)',
            threshold: 2,
            thresholdLabel: '≥ 2',
            items: [
              { id: 'rcri_cirurgia', label: 'Cirurgia de alto risco (intraperit., intratorác., vascular supraing.)', pts: 1 },
              { id: 'rcri_dac', label: 'Cardiopatia isquêmica', pts: 1 },
              { id: 'rcri_icc', label: 'Insuficiência cardíaca congestiva', pts: 1 },
              { id: 'rcri_dcv', label: 'Doença cerebrovascular (AVC/AIT)', pts: 1 },
              { id: 'rcri_dm', label: 'Diabetes mellitus insulino-dependente', pts: 1 },
              { id: 'rcri_cr', label: 'Creatinina pré-operatória > 2,0 mg/dL', pts: 1 },
            ],
            compute(values) {
              return this.items.reduce((sum, item) => sum + (values[item.id] ? item.pts : 0), 0);
            },
          },
        },
        { id: 'imc40', label: 'IMC > 40', type: 'bool', pts: 1 },
        { id: 'anemia', label: 'Anemia', type: 'bool', pts: 1 },
        { id: 'desnutricao', label: 'Desnutrição', type: 'bool', pts: 1 },
        { id: 'dpocSaos', label: 'DPOC / SAOS', type: 'bool', pts: 1 },
        { id: 'dcv', label: 'Doença cardiovascular ativa', type: 'bool', pts: 1 },
        { id: 'irc', label: 'Insuficiência renal crônica', type: 'bool', pts: 1 },
        { id: 'idade80', label: 'Idade > 80 anos', type: 'bool', pts: 1 },
      ],
    },
    {
      title: 'B. Fatores Cirúrgicos',
      sublabel: '0-6 pontos',
      inputs: [
        { id: 'abdMaior', label: 'Cirurgia abdominal maior', type: 'bool', pts: 1 },
        { id: 'duracao4h', label: 'Duração > 4 horas', type: 'bool', pts: 1 },
        { id: 'emergencia', label: 'Cirurgia de emergência', type: 'bool', pts: 2 },
        { id: 'resseccao', label: 'Ressecção extensa', type: 'bool', pts: 1 },
        { id: 'riscoSangramento', label: 'Alto risco de sangramento', type: 'bool', pts: 1 },
      ],
    },
    {
      title: 'C. Fatores Intraoperatórios',
      sublabel: '0-9 pontos',
      inputs: [
        { id: 'sangramento1L', label: 'Sangramento > 1 litro', type: 'bool', pts: 2 },
        { id: 'vasopressores', label: 'Necessidade de vasopressores', type: 'bool', pts: 2 },
        { id: 'instabilidade', label: 'Instabilidade hemodinâmica', type: 'bool', pts: 1 },
        { id: 'compResp', label: 'Complicação respiratória', type: 'bool', pts: 1 },
        { id: 'tempo6h', label: 'Tempo cirúrgico > 6 horas', type: 'bool', pts: 1 },
        { id: 'transfusaoMassiva', label: 'Transfusão massiva', type: 'bool', pts: 2 },
      ],
    },
  ],
  compute(values) {
    let total = 0;
    const motivos = [];

    for (const section of this.sections) {
      for (const input of section.inputs) {
        const val = values[input.id];
        if (input.type === 'bool' && val) {
          total += input.pts;
          motivos.push({ label: input.label, coef: `+${input.pts}` });
        } else if (input.type === 'select' && val !== undefined && val !== null) {
          const numVal = parseInt(val, 10);
          if (numVal > 0) {
            total += numVal;
            const opt = input.options.find((o) => o.value === numVal);
            motivos.push({ label: `${input.label}: ${opt?.label || val}`, coef: `+${numVal}` });
          }
        }
      }
    }

    let nivel, conduta, cor;
    if (total <= 2) {
      nivel = 'Baixo';
      conduta = 'SRPA → Enfermaria';
      cor = 'green';
    } else if (total <= 5) {
      nivel = 'Moderado';
      conduta = 'UCI ou SRPA prolongada';
      cor = 'yellow';
    } else if (total <= 8) {
      nivel = 'Alto';
      conduta = 'UTI recomendada';
      cor = 'orange';
    } else {
      nivel = 'Muito Alto';
      conduta = 'UTI obrigatória';
      cor = 'red';
    }

    return {
      score: total,
      scoreLabel: `${total}/27`,
      scoreMax: '27',
      nivel,
      conduta,
      cor,
      motivos,
    };
  },
  interpretacao: [
    { faixa: '0-2', nivel: 'Baixo', conduta: 'SRPA → Enfermaria' },
    { faixa: '3-5', nivel: 'Moderado', conduta: 'UCI ou SRPA prolongada' },
    { faixa: '6-8', nivel: 'Alto', conduta: 'UTI recomendada' },
    { faixa: '≥ 9', nivel: 'Muito Alto', conduta: 'UTI obrigatória' },
  ],
};

// ============================================================
// CALCULADORA 6: P-POSSUM
// ============================================================
export const PPOSSUM_CALCULATOR = {
  id: 'ppossum',
  name: 'P-POSSUM',
  fullName: 'Portsmouth-POSSUM — Mortalidade Cirúrgica',
  categoria: 'composto',
  descricao: '18 variáveis — Score cirúrgico mais validado globalmente',
  melhorPara: 'Cirurgias eletivas e emergentes (pré + intra)',
  auroc: '0.78-0.88 (mortalidade)',
  references: [
    'Copeland GP et al. POSSUM: A scoring system for surgical audit. Br J Surg 1991;78(3):355-60.',
    'Prytherch DR et al. Portsmouth-POSSUM: A more accurate scoring. Br J Surg 1998;85(6):763-8.',
    'Ramkumar T et al. Validation in Brazilian colorectal surgery. Clinics 2007;62(5):561-8.',
  ],
  disclaimer: 'P-POSSUM pode superestimar mortalidade em cirurgias de baixo risco. Mais preciso que POSSUM original para mortalidade.',
  sections: [
    {
      title: 'A. Score Fisiológico (PhS)',
      sublabel: 'Pré-operatório',
      inputs: [
        {
          id: 'idade',
          label: 'Idade',
          type: 'select',
          options: [
            { label: '≤ 60 anos', value: 1 },
            { label: '61-70 anos', value: 2 },
            { label: '≥ 71 anos', value: 4 },
          ],
        },
        {
          id: 'cardiac',
          label: 'Sinais cardíacos',
          type: 'select',
          options: [
            { label: 'Normal', value: 1 },
            { label: 'Diuréticos / Digoxina / Antianginosos / Anti-hipertensivos', value: 2 },
            { label: 'Edema periférico / Warfarina / Borderline cardiomegalia', value: 4 },
            { label: 'PVC elevada / Cardiomegalia', value: 8 },
          ],
        },
        {
          id: 'resp',
          label: 'Sinais respiratórios',
          type: 'select',
          options: [
            { label: 'Normal', value: 1 },
            { label: 'Dispneia aos esforços / RX leve', value: 2 },
            { label: 'Limitação — dispneia moderada / RX DPOC', value: 4 },
            { label: 'Dispneia repouso / Fibrose / Consolidação', value: 8 },
          ],
        },
        {
          id: 'ecg',
          label: 'ECG',
          type: 'select',
          options: [
            { label: 'Normal', value: 1 },
            { label: 'FA (60-90 bpm)', value: 4 },
            { label: 'Outro ritmo anormal / ≥ 5 ectópicos/min / Q ou ST-T', value: 8 },
          ],
        },
        {
          id: 'pas',
          label: 'Pressão arterial sistólica (mmHg)',
          type: 'select',
          options: [
            { label: '110-130', value: 1 },
            { label: '131-170 ou 100-109', value: 2 },
            { label: '≥ 171 ou 90-99', value: 4 },
            { label: '≤ 89', value: 8 },
          ],
        },
        {
          id: 'fc',
          label: 'Frequência cardíaca (bpm)',
          type: 'select',
          options: [
            { label: '50-80', value: 1 },
            { label: '81-100 ou 40-49', value: 2 },
            { label: '101-120', value: 4 },
            { label: '≥ 121 ou ≤ 39', value: 8 },
          ],
        },
        {
          id: 'gcs',
          label: 'Glasgow (GCS)',
          type: 'select',
          options: [
            { label: '15', value: 1 },
            { label: '12-14', value: 2 },
            { label: '9-11', value: 4 },
            { label: '≤ 8', value: 8 },
          ],
        },
        {
          id: 'hb',
          label: 'Hemoglobina (g/dL)',
          type: 'select',
          options: [
            { label: '13-16', value: 1 },
            { label: '11.5-12.9 ou 16.1-17', value: 2 },
            { label: '10-11.4 ou 17.1-18', value: 4 },
            { label: '≤ 9.9 ou ≥ 18.1', value: 8 },
          ],
        },
        {
          id: 'leuco',
          label: 'Leucócitos (×10³/µL)',
          type: 'select',
          options: [
            { label: '4-10', value: 1 },
            { label: '10.1-20 ou 3.1-3.9', value: 2 },
            { label: '≥ 20.1 ou ≤ 3.0', value: 4 },
          ],
        },
        {
          id: 'ureia',
          label: 'Ureia (mmol/L)',
          type: 'select',
          options: [
            { label: '≤ 7.5', value: 1 },
            { label: '7.6-10', value: 2 },
            { label: '10.1-15', value: 4 },
            { label: '≥ 15.1', value: 8 },
          ],
        },
        {
          id: 'sodio',
          label: 'Sódio (mEq/L)',
          type: 'select',
          options: [
            { label: '≥ 136', value: 1 },
            { label: '131-135', value: 2 },
            { label: '126-130', value: 4 },
            { label: '≤ 125', value: 8 },
          ],
        },
        {
          id: 'potassio',
          label: 'Potássio (mEq/L)',
          type: 'select',
          options: [
            { label: '3.5-5.0', value: 1 },
            { label: '3.2-3.4 ou 5.1-5.3', value: 2 },
            { label: '2.9-3.1 ou 5.4-5.9', value: 4 },
            { label: '≤ 2.8 ou ≥ 6.0', value: 8 },
          ],
        },
      ],
    },
    {
      title: 'B. Score Operatório (OpS)',
      sublabel: 'Intraoperatório',
      inputs: [
        {
          id: 'severidade',
          label: 'Severidade da operação',
          type: 'select',
          options: [
            { label: 'Menor (ex: hérnia)', value: 1 },
            { label: 'Intermediária (ex: apendicectomia)', value: 2 },
            { label: 'Maior (ex: colectomia)', value: 4 },
            { label: 'Maior+ (ex: esofagectomia)', value: 8 },
          ],
        },
        {
          id: 'numProcedimentos',
          label: 'Número de procedimentos',
          type: 'select',
          options: [
            { label: '1', value: 1 },
            { label: '2', value: 4 },
            { label: '> 2', value: 8 },
          ],
        },
        {
          id: 'sangramento',
          label: 'Perda sanguínea (mL)',
          type: 'select',
          options: [
            { label: '< 100', value: 1 },
            { label: '101-500', value: 2 },
            { label: '501-999', value: 4 },
            { label: '≥ 1000', value: 8 },
          ],
        },
        {
          id: 'contaminacao',
          label: 'Contaminação peritoneal',
          type: 'select',
          options: [
            { label: 'Nenhuma', value: 1 },
            { label: 'Mínima (serosa)', value: 2 },
            { label: 'Local (pus)', value: 4 },
            { label: 'Livre (conteúdo intestinal / pus difuso)', value: 8 },
          ],
        },
        {
          id: 'malignidade',
          label: 'Presença de malignidade',
          type: 'select',
          options: [
            { label: 'Ausente', value: 1 },
            { label: 'Tumor primário localizado', value: 2 },
            { label: 'Metástase linfonodal', value: 4 },
            { label: 'Metástase à distância', value: 8 },
          ],
        },
        {
          id: 'urgencia',
          label: 'Urgência da operação',
          type: 'select',
          options: [
            { label: 'Eletiva', value: 1 },
            { label: 'Urgência (dentro de 24h)', value: 4 },
            { label: 'Emergência (imediata / reanimação simultânea)', value: 8 },
          ],
        },
      ],
    },
  ],
  compute(values) {
    let physiology = 0;
    let operative = 0;
    const motivos = [];

    for (const input of this.sections[0].inputs) {
      const val = values[input.id];
      if (val !== undefined && val !== null) {
        const numVal = parseInt(val, 10);
        physiology += numVal;
        if (numVal > 1) {
          const opt = input.options.find((o) => o.value === numVal);
          motivos.push({ label: `${input.label}: ${opt?.label || ''}`, coef: `${numVal} pts` });
        }
      }
    }

    for (const input of this.sections[1].inputs) {
      const val = values[input.id];
      if (val !== undefined && val !== null) {
        const numVal = parseInt(val, 10);
        operative += numVal;
        if (numVal > 1) {
          const opt = input.options.find((o) => o.value === numVal);
          motivos.push({ label: `${input.label}: ${opt?.label || ''}`, coef: `${numVal} pts` });
        }
      }
    }

    const logit = -9.065 + (0.1692 * physiology) + (0.1550 * operative);
    const risco = (Math.exp(logit) / (1 + Math.exp(logit))) * 100;

    let nivel, conduta, cor;
    if (risco < 5) {
      nivel = 'Baixo';
      conduta = 'Enfermaria';
      cor = 'green';
    } else if (risco < 15) {
      nivel = 'Moderado';
      conduta = 'UCI ou SRPA prolongada';
      cor = 'yellow';
    } else if (risco < 30) {
      nivel = 'Alto';
      conduta = 'UTI recomendada';
      cor = 'orange';
    } else {
      nivel = 'Muito Alto';
      conduta = 'UTI obrigatória';
      cor = 'red';
    }

    return {
      score: risco.toFixed(1),
      scoreLabel: `${risco.toFixed(1)}%`,
      scoreMax: '100%',
      nivel,
      conduta,
      cor,
      motivos,
      nota: `PhS: ${physiology} | OpS: ${operative}`,
    };
  },
  interpretacao: [
    { faixa: '< 5%', nivel: 'Baixo', conduta: 'Enfermaria' },
    { faixa: '5-15%', nivel: 'Moderado', conduta: 'UCI / SRPA prolongada' },
    { faixa: '15-30%', nivel: 'Alto', conduta: 'UTI recomendada' },
    { faixa: '> 30%', nivel: 'Muito Alto', conduta: 'UTI obrigatória' },
  ],
};

// ============================================================
// CALCULADORA 7: CFM Resolução 2156/2016
// ============================================================
export const CFM_CALCULATOR = {
  id: 'cfm2156',
  name: 'CFM 2156',
  fullName: 'Critérios CFM 2156/2016 — Admissão em UTI',
  categoria: 'regulatorio',
  descricao: '5 prioridades — Critério regulatório brasileiro',
  melhorPara: 'Classificação obrigatória por lei (CFM)',
  auroc: 'Regulatório (não score preditivo)',
  references: [
    'Conselho Federal de Medicina. Resolução CFM nº 2.156/2016. Diário Oficial da União, 17 nov 2016.',
    'CFM Resolução 2271/2020. Critérios operacionais para UTI/UCI.',
    'AMIB. Endosso do documento sobre critérios de admissão em UTI, 2016.',
  ],
  disclaimer: 'Classificação regulatória obrigatória em UTIs brasileiras (CFM). Não é score preditivo — é framework para decisão institucional.',
  sections: [
    {
      title: 'Indicação Clínica',
      sublabel: 'Selecione a que melhor descreve o paciente',
      inputs: [
        {
          id: 'prioridade',
          label: 'Prioridade de admissão',
          type: 'select',
          options: [
            {
              label: 'P1 — Instável, necessita suporte de vida, alta probabilidade de recuperação',
              value: 1,
            },
            {
              label: 'P2 — Monitorização intensiva necessária, pode precisar de intervenção imediata',
              value: 2,
            },
            {
              label: 'P3 — Instável com doença de base que reduz probabilidade de recuperação',
              value: 3,
            },
            {
              label: 'P4 — Benefício mínimo da UTI (muito bem ou muito grave para UTI)',
              value: 4,
            },
            {
              label: 'P5 — Paciente terminal em cuidados paliativos exclusivos',
              value: 5,
            },
          ],
        },
      ],
    },
    {
      title: 'Critérios Objetivos de Admissão',
      sublabel: 'Marque os presentes',
      inputs: [
        { id: 'vm', label: 'Necessidade de ventilação mecânica', type: 'bool', pts: 1 },
        { id: 'drogas', label: 'Necessidade de drogas vasoativas', type: 'bool', pts: 1 },
        { id: 'monitorizacao', label: 'Monitorização hemodinâmica invasiva', type: 'bool', pts: 1 },
        { id: 'dialise', label: 'Terapia renal substitutiva contínua', type: 'bool', pts: 1 },
        { id: 'rebaixamento', label: 'Rebaixamento agudo do nível de consciência', type: 'bool', pts: 1 },
        { id: 'posParadaCR', label: 'Pós-parada cardiorrespiratória', type: 'bool', pts: 1 },
        { id: 'posOpMaior', label: 'Pós-operatório de cirurgia de grande porte', type: 'bool', pts: 1 },
        { id: 'sepse', label: 'Sepse / choque séptico', type: 'bool', pts: 1 },
        { id: 'insufResp', label: 'Insuficiência respiratória aguda', type: 'bool', pts: 1 },
        { id: 'distMetabolico', label: 'Distúrbio metabólico grave', type: 'bool', pts: 1 },
      ],
    },
  ],
  compute(values) {
    const prioridade = parseInt(values.prioridade, 10) || 0;
    let criteriosObj = 0;
    const motivos = [];

    for (const input of this.sections[1].inputs) {
      if (values[input.id]) {
        criteriosObj++;
        motivos.push({ label: input.label, coef: '+1' });
      }
    }

    const prioridadeMap = {
      1: { nivel: 'Prioridade 1', conduta: 'Admissão IMEDIATA em UTI', cor: 'red' },
      2: { nivel: 'Prioridade 2', conduta: 'Admissão em UTI indicada — monitorização intensiva', cor: 'orange' },
      3: { nivel: 'Prioridade 3', conduta: 'UTI com limitação terapêutica definida em prontuário', cor: 'yellow' },
      4: { nivel: 'Prioridade 4', conduta: 'UTI NÃO indicada — enfermaria ou UCI', cor: 'green' },
      5: { nivel: 'Prioridade 5', conduta: 'UTI NÃO indicada — cuidados paliativos exclusivos', cor: 'green' },
    };

    const info = prioridadeMap[prioridade] || { nivel: 'Não classificado', conduta: 'Selecione a prioridade', cor: 'green' };

    return {
      score: prioridade || '-',
      scoreLabel: prioridade ? `P${prioridade}` : '-',
      scoreMax: 'P1-P5',
      nivel: info.nivel,
      conduta: info.conduta,
      cor: info.cor,
      motivos,
      nota: criteriosObj > 0 ? `${criteriosObj} critério(s) objetivo(s) presente(s)` : undefined,
    };
  },
  interpretacao: [
    { faixa: 'P1', nivel: 'Prioridade 1', conduta: 'Admissão IMEDIATA — instável + recuperável' },
    { faixa: 'P2', nivel: 'Prioridade 2', conduta: 'Admissão indicada — monitorização intensiva' },
    { faixa: 'P3', nivel: 'Prioridade 3', conduta: 'Admissão com limitação terapêutica' },
    { faixa: 'P4', nivel: 'Prioridade 4', conduta: 'UTI não indicada (muito bem/muito grave)' },
    { faixa: 'P5', nivel: 'Prioridade 5', conduta: 'Cuidados paliativos exclusivos' },
  ],
};

// ============================================================
// CATEGORIAS E LISTA COMPLETA
// ============================================================
export const CATEGORIAS = [
  { id: 'pre', label: 'Pré-Operatório', icon: 'ClipboardCheck' },
  { id: 'intra', label: 'Intraoperatório', icon: 'Activity' },
  { id: 'composto', label: 'Composto (Pré + Intra)', icon: 'Layers' },
  { id: 'regulatorio', label: 'Regulatório (CFM)', icon: 'Shield' },
];

// Só as ferramentas VALIDADAS para a decisão de encaminhar o paciente
// perioperatório à UTI. Revisão de 29/08/2026 — `docs/criterios-uti-revisao.md`.
//
// ⚠️ Nada foi apagado: `POTTER_CALCULATOR` e `PPOSSUM_CALCULATOR` seguem
// exportados acima e voltam à lista com uma linha. Saíram porque:
//
// - POTTER-Inspirado NÃO é o POTTER. O `nota` do próprio objeto admite que o
//   algoritmo original é proprietário e que isto é uma árvore feita à mão — sem
//   validação — enquanto exibe as referências de validação do POTTER verdadeiro.
// - P-POSSUM é validada para morbimortalidade, não para a decisão, e parte das
//   18 variáveis é intra e pós-operatória: não existe no momento de decidir.
//   SORT (6 variáveis pré-op) e SAS (3 ao fim da cirurgia) cobrem os dois
//   momentos em que a decisão é tomada.
export const ALL_CALCULATORS = [
  SORT_CALCULATOR,
  ESS_CALCULATOR,
  SAS_CALCULATOR,
  SIAARTI_CALCULATOR,
  CFM_CALCULATOR,
];

export const getCalculatorById = (id) => ALL_CALCULATORS.find((c) => c.id === id);
export const getCalculatorsByCategoria = (cat) => ALL_CALCULATORS.filter((c) => c.categoria === cat);
