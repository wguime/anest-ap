/**
 * Anticoagulantes, antiagregantes e reversores — base de consulta perioperatória.
 *
 * Fonte primária: ASRA Pain Medicine Evidence-Based Guidelines, 5ª edição
 * (Kopp SL et al. Reg Anesth Pain Med 2025; doi:10.1136/rapm-2024-105766).
 * Complementos: Joint ESAIC/ESRA 2022 (Kietaibl S et al. Eur J Anaesthesiol
 * 2022;39:100-132) e SBA 2020 (Fonseca NM et al. Braz J Anesthesiol
 * 2020;70:364-387) — esta última é a referência nacional e a origem dos nomes
 * comerciais registrados na ANVISA.
 *
 * ⚠️ A 5ª edição da ASRA trocou "profilático/terapêutico" por "dose BAIXA/ALTA"
 * e passou a aplicar as MESMAS regras do neuroeixo aos bloqueios de plexo
 * profundo / periféricos profundos (não compressíveis). Bloqueio superficial e
 * compressível não entra nestas regras.
 *
 * Funções puras — sem estado, sem I/O. A UI vive em
 * src/design-system/showcase/displays/AnticoagulantesDisplay.jsx
 */

// =============================================================================
// CLASSES
// =============================================================================

export const CLASSES = {
  heparina: { id: 'heparina', label: 'Heparinas', ordem: 1 },
  xa: { id: 'xa', label: 'Inibidores do fator Xa', ordem: 2 },
  iia: { id: 'iia', label: 'Inibidores diretos da trombina', ordem: 3 },
  avk: { id: 'avk', label: 'Antagonistas da vitamina K', ordem: 4 },
  antiplaq: { id: 'antiplaq', label: 'Antiagregantes plaquetários', ordem: 5 },
  trombolitico: { id: 'trombolitico', label: 'Trombolíticos / fibrinolíticos', ordem: 6 },
  outros: { id: 'outros', label: 'Outros', ordem: 7 },
};

/** Cateter peridural/neuroaxial de demora com a droga em uso. */
export const CATETER = {
  sim: { id: 'sim', label: 'Cateter permitido', tom: 'success' },
  condicional: { id: 'condicional', label: 'Cateter com ressalva', tom: 'warning' },
  nao: { id: 'nao', label: 'Não manter cateter', tom: 'destructive' },
  evitar: { id: 'evitar', label: 'Evitar o bloqueio', tom: 'destructive' },
};

// =============================================================================
// BASE DE FÁRMACOS
// -----------------------------------------------------------------------------
// Campos por entrada:
//   antes          → última dose até a punção/instalação do cateter
//   retirada       → última dose até a RETIRADA do cateter
//   aposPuncao     → punção (ou instalação do cateter) até a próxima dose
//   aposRetirada   → retirada do cateter até a próxima dose
// Cada janela: { horas, regras[], texto?, bloqueado?, nota? }
//   regras[] → ajuste por função renal/idade; a PRIMEIRA que casar vence.
// =============================================================================

export const ANTICOAGULANTES = [
  // ---------------------------------------------------------------- HEPARINAS
  {
    id: 'hnf_iv',
    grupo: 'hnf',
    grupoNome: 'Heparina não fracionada (HNF)',
    variante: 'Endovenosa',
    farmaco: 'Heparina não fracionada (HNF)',
    comerciais: ['Liquemine', 'Hepamax'],
    classe: 'heparina',
    via: 'EV',
    regime: 'Infusão endovenosa',
    dosesTipicas: 'Bolus + infusão contínua, ajustada por TTPa/ACT',
    antes: { horas: 6, texto: '4–6 h', nota: 'E confirmar coagulação normal (TTPa/ACT) antes da punção.' },
    retirada: { horas: 6, texto: '4–6 h', nota: 'Confirmar coagulação normal antes de retirar.' },
    aposPuncao: { horas: 1 },
    aposRetirada: { horas: 1 },
    cateter: 'condicional',
    laboratorio: 'TTPa e/ou ACT dentro da faixa normal',
    reversor: 'protamina',
    alertas: [
      'Heparinização intraoperatória (5.000–10.000 UI): fazer o bloqueio ≥1 h ANTES da heparina.',
      'AAS + HNF EV eleva o risco de hematoma mesmo respeitando 1 h (1:8.500 peridural).',
      'Cirurgia cardíaca com heparinização plena: risco de hematoma 1:1.528 (peridural). Se indicado, puncionar na véspera.',
    ],
    notas: { esra: '6 h EV / até TTPa, anti-Xa ou ACT normais', sba: '4–6 h, com coagulação normal' },
  },
  {
    id: 'hnf_sc_baixa',
    grupo: 'hnf',
    grupoNome: 'Heparina não fracionada (HNF)',
    variante: 'SC dose baixa',
    farmaco: 'HNF subcutânea — dose baixa',
    comerciais: ['Liquemine'],
    classe: 'heparina',
    via: 'SC',
    regime: '≤ 5.000 UI 2–3×/dia (≤ 15.000 UI/dia)',
    dosesTipicas: '5.000 UI 8/8h ou 12/12h',
    antes: { horas: 6, texto: '4–6 h' },
    retirada: { horas: 6, texto: '4–6 h após a última dose' },
    aposPuncao: { horas: 1 },
    aposRetirada: { horas: 1 },
    cateter: 'sim',
    laboratorio: 'Coagulação normal (avaliar se > 4 dias de uso: risco de plaquetopenia por heparina)',
    reversor: 'protamina',
    alertas: ['Uso > 4 dias: dosar plaquetas antes de puncionar ou retirar (HIT).'],
    notas: { esra: '4 h', sba: '4–6 h' },
  },
  {
    id: 'hnf_sc_alta',
    grupo: 'hnf',
    grupoNome: 'Heparina não fracionada (HNF)',
    variante: 'SC dose alta',
    farmaco: 'HNF subcutânea — dose alta',
    comerciais: ['Liquemine'],
    classe: 'heparina',
    via: 'SC',
    regime: '7.500–10.000 UI 2×/dia ou ≤ 20.000 UI/dia',
    dosesTipicas: '7.500 UI 12/12h',
    antes: { horas: 12, nota: 'Confirmar coagulação normal.' },
    retirada: { horas: 12 },
    aposPuncao: { horas: 1 },
    aposRetirada: { horas: 1 },
    cateter: 'condicional',
    laboratorio: 'TTPa normal',
    reversor: 'protamina',
    alertas: ['Segurança do cateter de demora não estabelecida — decidir caso a caso, com vigilância neurológica.'],
    notas: { esra: '12 h SC / até valor-alvo', sba: '12 h' },
  },
  {
    id: 'hnf_sc_terap',
    grupo: 'hnf',
    grupoNome: 'Heparina não fracionada (HNF)',
    variante: 'SC terapêutica',
    farmaco: 'HNF subcutânea — terapêutica',
    comerciais: ['Liquemine'],
    classe: 'heparina',
    via: 'SC',
    regime: '> 10.000 UI por dose ou > 20.000 UI/dia',
    dosesTipicas: '15.000–20.000 UI 12/12h',
    antes: { horas: 24, nota: 'Confirmar coagulação normal.' },
    retirada: { horas: 24 },
    aposPuncao: { horas: 1 },
    aposRetirada: { horas: 1 },
    cateter: 'nao',
    laboratorio: 'TTPa normal',
    reversor: 'protamina',
    alertas: ['Cateter de demora não recomendado nesta dose.'],
    notas: { sba: '24 h' },
  },
  {
    id: 'enox_baixa',
    grupo: 'enoxaparina',
    grupoNome: 'Enoxaparina',
    variante: 'Dose baixa',
    farmaco: 'Enoxaparina — dose baixa',
    comerciais: ['Clexane', 'Versa', 'Endocris'],
    classe: 'heparina',
    via: 'SC',
    regime: 'Profilaxia (≤ 40 mg/dia ou 30 mg 12/12h)',
    dosesTipicas: '40 mg 1×/dia · 20 mg/dia se ClCr < 30',
    antes: {
      horas: 12,
      regras: [{ clcrMax: 29, horas: 24, motivo: 'ClCr < 30 mL/min (ESAIC/ESRA)' }],
    },
    retirada: { horas: 12, texto: '12 h após a última dose' },
    aposPuncao: { horas: 12, nota: 'Primeira dose no pós-operatório: ≥ 12 h após a punção/instalação do cateter.' },
    aposRetirada: { horas: 4 },
    cateter: 'sim',
    laboratorio: 'Anti-Xa ≤ 0,1 UI/mL se for puncionar antes de 12 h',
    reversor: 'protamina',
    alertas: [
      'Regime 12/12h: retirar o cateter ANTES de iniciar a HBPM; próxima dose ≥ 4 h após a retirada.',
      'Regime 1×/dia: 2ª dose não antes de 24 h da punção.',
      'Não associar outro fármaco que altere a hemostasia enquanto o cateter estiver instalado.',
    ],
    notas: { esra: '12 h (24 h se ClCr < 30)', sba: '> 12 h · próxima dose > 4 h após a retirada' },
  },
  {
    id: 'enox_alta',
    grupo: 'enoxaparina',
    grupoNome: 'Enoxaparina',
    variante: 'Dose alta',
    farmaco: 'Enoxaparina — dose alta',
    comerciais: ['Clexane', 'Versa', 'Endocris'],
    classe: 'heparina',
    via: 'SC',
    regime: 'Terapêutica (1 mg/kg 12/12h ou 1,5 mg/kg/dia)',
    dosesTipicas: '1 mg/kg 12/12h · 1 mg/kg/dia se ClCr < 30',
    antes: {
      horas: 24,
      regras: [{ clcrMax: 29, horas: 48, motivo: 'ClCr < 30 mL/min (ESAIC/ESRA)' }],
    },
    retirada: { horas: 24 },
    aposPuncao: { horas: 24, nota: '≥ 24 h se a cirurgia tem baixo risco de sangramento; 48–72 h se alto risco.' },
    aposRetirada: { horas: 4, nota: 'Retirar o cateter ≥ 4 h ANTES da primeira dose pós-operatória.' },
    cateter: 'nao',
    laboratorio: 'Anti-Xa ≤ 0,1 UI/mL — considerar se puncionar antes de 24 h, > 75 anos ou ClCr ≤ 30',
    reversor: 'protamina',
    alertas: [
      'Cateter de demora NÃO recomendado com HBPM em dose alta.',
      'Idoso (> 75 anos) e ClCr ≤ 30 acumulam a droga: dosar anti-Xa antes de encurtar o intervalo.',
    ],
    notas: { esra: '24 h (48 h se ClCr < 30) · alvo anti-Xa ≤ 0,1 UI/mL', sba: '> 24 h' },
  },
  {
    id: 'dalteparina',
    farmaco: 'Dalteparina',
    comerciais: ['Fragmin'],
    classe: 'heparina',
    via: 'SC',
    regime: 'Profilaxia 5.000 UI/dia · Terapêutica 200 UI/kg/dia',
    dosesTipicas: '5.000 UI/dia (baixa) · 100 UI/kg 12/12h (alta)',
    antes: { horas: 12, nota: 'Dose alta (≥ 200 UI/kg/dia): 24 h.' },
    retirada: { horas: 12, nota: 'Dose alta: 24 h.' },
    aposPuncao: { horas: 12 },
    aposRetirada: { horas: 4 },
    cateter: 'condicional',
    laboratorio: 'Anti-Xa ≤ 0,1 UI/mL',
    reversor: 'protamina',
    alertas: [
      'Punção e retirada do cateter: 12 h na dose baixa, 24 h na dose alta. '
        + 'Próxima dose: 12 h depois da punção, 4 h depois de retirar o cateter. '
        + 'São as mesmas regras da enoxaparina.',
    ],
    notas: { sba: '> 12 h (profilática) · > 24 h (terapêutica)' },
  },
  {
    id: 'nadroparina',
    farmaco: 'Nadroparina',
    comerciais: ['Fraxiparina'],
    classe: 'heparina',
    via: 'SC',
    regime: 'Profilaxia · Terapêutica (86 UI/kg 12/12h)',
    dosesTipicas: '0,3–0,6 mL/dia (baixa) · 86 UI/kg 12/12h (alta)',
    antes: { horas: 12, nota: 'Dose alta: 24 h.' },
    retirada: { horas: 12, nota: 'Dose alta: 24 h.' },
    aposPuncao: { horas: 12 },
    aposRetirada: { horas: 4 },
    cateter: 'condicional',
    laboratorio: 'Anti-Xa ≤ 0,1 UI/mL',
    reversor: 'protamina',
    alertas: [
      'Punção e retirada do cateter: 12 h na dose baixa, 24 h na dose alta. '
        + 'Próxima dose: 12 h depois da punção, 4 h depois de retirar o cateter. '
        + 'São as mesmas regras da enoxaparina.',
    ],
    notas: { sba: '> 12 h (profilática) · > 24 h (terapêutica)' },
  },
  {
    id: 'fonda_baixa',
    grupo: 'fondaparinux',
    grupoNome: 'Fondaparinux',
    variante: 'Dose baixa',
    farmaco: 'Fondaparinux — dose baixa',
    comerciais: ['Arixtra'],
    classe: 'xa',
    via: 'SC',
    regime: '2,5 mg 1×/dia',
    dosesTipicas: '2,5 mg/dia',
    antes: {
      horas: 36,
      texto: '36 h (jovem) a 42 h (idoso)',
      resumo: '36–42 h',
      regras: [
        { clcrMax: 29, bloqueado: true, motivo: 'ClCr < 30 mL/min — ASRA recomenda NÃO realizar bloqueio de neuroeixo ou de plexo profundo.' },
        { clcrMax: 50, horas: 58, motivo: 'ClCr 30–50 mL/min' },
        { idadeMin: 75, horas: 42, motivo: 'Idoso' },
      ],
    },
    retirada: { horas: 36, nota: 'Cateter de demora não recomendado — a ASRA aceita apenas punção única e atraumática.' },
    aposPuncao: { horas: 6 },
    aposRetirada: { horas: 6 },
    cateter: 'nao',
    laboratorio: 'Anti-Xa (calibrado para fondaparinux) ≤ 0,1 UI/mL',
    reversor: 'nenhum',
    alertas: [
      'Sem antídoto: protamina NÃO reverte fondaparinux.',
      'Meia-vida longa (17–21 h) e eliminação renal — o intervalo cresce muito com a queda do ClCr.',
    ],
    notas: { esra: '36 h (72 h se ClCr < 50)', sba: '36–42 h · próxima dose 12 h após' },
  },
  {
    id: 'fonda_alta',
    grupo: 'fondaparinux',
    grupoNome: 'Fondaparinux',
    variante: 'Dose alta',
    farmaco: 'Fondaparinux — dose alta',
    comerciais: ['Arixtra'],
    classe: 'xa',
    via: 'SC',
    regime: '5–10 mg 1×/dia',
    dosesTipicas: '7,5 mg/dia (50–100 kg)',
    antes: {
      horas: 70,
      texto: '70 h (jovem) a 105 h (idoso)',
      resumo: '70–105 h',
      regras: [
        { clcrMax: 29, bloqueado: true, motivo: 'ClCr < 30 mL/min — não realizar bloqueio.' },
        { idadeMin: 75, horas: 105, motivo: 'Idoso' },
      ],
    },
    retirada: { horas: 70, nota: 'Não manter cateter.' },
    aposPuncao: { horas: 6 },
    aposRetirada: { horas: 6 },
    cateter: 'nao',
    laboratorio: 'Anti-Xa ≤ 0,1 UI/mL antes de encurtar o intervalo',
    reversor: 'nenhum',
    alertas: ['Sem antídoto. Considerar técnica alternativa ao neuroeixo.'],
    notas: { esra: 'Até o valor laboratorial-alvo (anti-Xa ≤ 0,1 UI/mL)' },
  },

  // ------------------------------------------------------------- DOACs — anti-Xa
  {
    id: 'rivaroxabana_baixa',
    grupo: 'rivaroxabana',
    grupoNome: 'Rivaroxabana',
    variante: 'Dose baixa',
    farmaco: 'Rivaroxabana — dose baixa',
    comerciais: ['Xarelto'],
    classe: 'xa',
    via: 'VO',
    regime: '10 mg/dia (profilaxia) ou 2,5 mg 12/12h',
    dosesTipicas: '10 mg/dia após artroplastia · 2,5 mg 12/12h na DAC/DAP',
    antes: {
      horas: 24,
      regras: [{ clcrMax: 29, horas: 30, motivo: 'ClCr < 30 mL/min' }],
    },
    retirada: { horas: 24, nota: 'Suspender 24 h (30 h se ClCr < 30) ou confirmar nível aceitável antes de retirar.' },
    aposPuncao: { horas: 6 },
    aposRetirada: { horas: 6 },
    cateter: 'condicional',
    laboratorio: 'Rivaroxabana < 30 ng/mL ou anti-Xa (calibrado) ≤ 0,1 UI/mL',
    reversor: 'andexanet',
    alertas: ['Cateter instalado sem que se soubesse do uso: suspender a droga e só retirar cumprindo o intervalo ou com nível aceitável.'],
    notas: { esra: '24 h (30 h se ClCr < 30)', sba: '72 h para qualquer dose' },
  },
  {
    id: 'rivaroxabana_alta',
    grupo: 'rivaroxabana',
    grupoNome: 'Rivaroxabana',
    variante: 'Dose alta',
    farmaco: 'Rivaroxabana — dose alta',
    comerciais: ['Xarelto'],
    classe: 'xa',
    via: 'VO',
    regime: '15–20 mg/dia',
    dosesTipicas: 'FA: 20 mg/dia (15 mg se ClCr 15–50) · TEV: 15 mg 12/12h por 21 dias → 20 mg/dia',
    antes: { horas: 72 },
    retirada: { horas: 72, nota: 'Não instalar/manter cateter de demora.' },
    aposPuncao: { horas: 24 },
    aposRetirada: { horas: 24 },
    cateter: 'nao',
    laboratorio: 'Rivaroxabana < 30 ng/mL ou anti-Xa ≤ 0,1 UI/mL — permite encurtar as 72 h',
    reversor: 'andexanet',
    alertas: ['TP/TTPa NÃO excluem efeito residual: TP normal não libera a punção.'],
    notas: { esra: '72 h (ou até nível-alvo se ClCr < 30)', sba: '72 h' },
  },
  {
    id: 'apixabana_baixa',
    grupo: 'apixabana',
    grupoNome: 'Apixabana',
    variante: 'Dose baixa',
    farmaco: 'Apixabana — dose baixa',
    comerciais: ['Eliquis'],
    classe: 'xa',
    via: 'VO',
    regime: '2,5 mg 12/12h',
    dosesTipicas: 'Profilaxia de TEV · manutenção estendida',
    antes: { horas: 36 },
    retirada: { horas: 36, nota: 'Suspender 36 h ou confirmar nível aceitável antes de retirar.' },
    aposPuncao: { horas: 6 },
    aposRetirada: { horas: 6 },
    cateter: 'condicional',
    laboratorio: 'Apixabana < 30 ng/mL ou anti-Xa ≤ 0,1 UI/mL',
    reversor: 'andexanet',
    alertas: [],
    notas: { esra: '36 h', sba: '72 h para qualquer dose' },
  },
  {
    id: 'apixabana_alta',
    grupo: 'apixabana',
    grupoNome: 'Apixabana',
    variante: 'Dose alta',
    farmaco: 'Apixabana — dose alta',
    comerciais: ['Eliquis'],
    classe: 'xa',
    via: 'VO',
    regime: '5 mg 12/12h (ou 10 mg 12/12h de ataque)',
    dosesTipicas: 'FA: 5 mg 12/12h (2,5 mg se 2 de 3: ≥ 80 anos, ≤ 60 kg, creatinina ≥ 1,5)',
    antes: { horas: 72 },
    retirada: { horas: 72, nota: 'Não instalar/manter cateter de demora.' },
    aposPuncao: { horas: 24 },
    aposRetirada: { horas: 24 },
    cateter: 'nao',
    laboratorio: 'Apixabana < 30 ng/mL ou anti-Xa ≤ 0,1 UI/mL',
    reversor: 'andexanet',
    alertas: ['Coagulograma convencional não afasta efeito residual.'],
    notas: { esra: '72 h (ou até nível-alvo se ClCr < 30)', sba: '72 h' },
  },
  {
    id: 'edoxabana',
    farmaco: 'Edoxabana',
    comerciais: ['Lixiana', 'Savaysa'],
    classe: 'xa',
    via: 'VO',
    regime: '30–60 mg/dia (dose alta)',
    dosesTipicas: '60 mg/dia (30 mg se ClCr 15–50, ≤ 60 kg ou inibidor de gp-P)',
    antes: { horas: 72 },
    retirada: { horas: 72, nota: 'Não instalar/manter cateter de demora.' },
    aposPuncao: { horas: 24 },
    aposRetirada: { horas: 24 },
    cateter: 'nao',
    laboratorio: 'Edoxabana < 30 ng/mL ou anti-Xa ≤ 0,1 UI/mL',
    reversor: 'andexanet',
    alertas: [],
    notas: { esra: '24 h em dose baixa · 72 h em dose alta', sba: '72 h' },
  },

  // -------------------------------------------------------- DOAC — anti-IIa
  {
    id: 'dabigatrana_baixa',
    grupo: 'dabigatrana',
    grupoNome: 'Dabigatrana',
    variante: 'Dose baixa',
    farmaco: 'Dabigatrana — dose baixa',
    comerciais: ['Pradaxa'],
    classe: 'iia',
    via: 'VO',
    regime: '110 mg 1×/dia ou 150–220 mg/dia (profilaxia)',
    dosesTipicas: '220 mg/dia · 150 mg/dia se > 75 anos, ClCr 30–50 ou verapamil',
    antes: {
      horas: 48,
      regras: [{ clcrMax: 29, bloqueado: true, motivo: 'ClCr < 30 mL/min — não puncionar sem dosagem de dabigatrana < 30 ng/mL.' }],
    },
    retirada: { horas: 48 },
    aposPuncao: { horas: 6 },
    aposRetirada: { horas: 6 },
    cateter: 'condicional',
    laboratorio: 'Dabigatrana < 30 ng/mL (tempo de trombina diluído/ecarina). TT normal exclui efeito.',
    reversor: 'idarucizumabe',
    alertas: ['80% de eliminação renal — o intervalo depende do ClCr, não só da dose.'],
    notas: { esra: '48 h', sba: 'Ver escalonamento por ClCr' },
  },
  {
    id: 'dabigatrana_alta',
    grupo: 'dabigatrana',
    grupoNome: 'Dabigatrana',
    variante: 'Dose alta',
    farmaco: 'Dabigatrana — dose alta',
    comerciais: ['Pradaxa'],
    classe: 'iia',
    via: 'VO',
    regime: '110–150 mg 12/12h',
    dosesTipicas: 'FA: 150 mg 12/12h (110 mg se > 80 anos ou verapamil)',
    antes: {
      horas: 72,
      regras: [
        { clcrMax: 29, bloqueado: true, motivo: 'ClCr < 30 mL/min — não puncionar sem dosagem de dabigatrana < 30 ng/mL.' },
        { clcrMax: 49, horas: 120, motivo: 'ClCr 30–49 mL/min' },
      ],
    },
    retirada: { horas: 72, nota: 'Não instalar/manter cateter de demora.' },
    aposPuncao: { horas: 24 },
    aposRetirada: { horas: 24 },
    cateter: 'nao',
    laboratorio: 'Dabigatrana < 30 ng/mL. TT (tempo de trombina) normal exclui efeito residual.',
    reversor: 'idarucizumabe',
    alertas: [
      'A SBA 2020 escalona: ClCr > 80 → 3 dias · 50–79 → 4 dias · 30–49 → 5 dias · ClCr desconhecido → 5 dias.',
      'Único DOAC com antídoto amplamente disponível no Brasil (idarucizumabe).',
    ],
    notas: { esra: '72 h (até valor-alvo se ClCr < 50)', sba: '3 a 5 dias conforme ClCr' },
  },
  {
    id: 'dti_parenteral',
    farmaco: 'Argatrobana · Bivalirudina · Desirudina',
    comerciais: ['Acova', 'Angiomax', 'Revasc'],
    classe: 'iia',
    via: 'EV',
    regime: 'Infusão contínua',
    dosesTipicas: 'Anticoagulação em HIT / hemodinâmica',
    antes: { bloqueado: true, texto: 'Evitar bloqueio', nota: 'Sem intervalo seguro estabelecido e sem antídoto.' },
    retirada: { bloqueado: true, texto: 'Evitar cateter' },
    aposPuncao: { texto: 'Não estabelecido' },
    aposRetirada: { texto: 'Não estabelecido' },
    cateter: 'evitar',
    laboratorio: 'TTPa / ACT — sem alvo validado para punção',
    reversor: 'nenhum',
    alertas: ['ASRA e SBA recomendam EVITAR bloqueio de neuroeixo e de plexo profundo com estes fármacos.'],
    notas: { sba: 'Evitar bloqueio' },
  },

  // -------------------------------------------------------------------- AVK
  {
    id: 'varfarina',
    farmaco: 'Varfarina',
    comerciais: ['Marevan', 'Coumadin'],
    classe: 'avk',
    via: 'VO',
    regime: 'Dose ajustada por RNI',
    dosesTipicas: '2,5–7,5 mg/dia',
    antes: { horas: 120, texto: '5 dias', nota: 'E RNI normalizado (≤ 1,5) documentado no dia da punção.' },
    retirada: { texto: 'RNI < 1,5', nota: 'RNI 1,5–2,9: retirar com cautela e RNI diário. RNI ≥ 3,0: suspender/reduzir a dose antes de retirar.' },
    aposPuncao: { horas: 0, texto: 'Logo após a punção' },
    aposRetirada: { horas: 0, texto: 'Logo após a retirada' },
    cateter: 'condicional',
    laboratorio: 'RNI diário enquanto o cateter estiver instalado',
    reversor: 'vitaminaK',
    alertas: [
      'Vigilância neurológica por ≥ 24 h (ASRA sugere até 48 h) após a retirada do cateter.',
      'Se a varfarina foi reintroduzida no pós-operatório, o RNI sobe antes do 3º dia — checar antes de retirar.',
    ],
    notas: { esra: 'Até RNI normal', sba: '5 dias com RNI ≤ 1,5' },
  },

  // --------------------------------------------------------- ANTIAGREGANTES
  {
    id: 'aas',
    farmaco: 'AAS e AINEs',
    comerciais: ['AAS', 'Aspirina Prevent', 'ibuprofeno', 'diclofenaco', 'cetoprofeno'],
    classe: 'antiplaq',
    via: 'VO',
    regime: 'Uso isolado',
    dosesTipicas: 'AAS 100 mg/dia',
    antes: { horas: 0, texto: 'Sem intervalo', nota: 'AINEs, incluindo o AAS, não criam risco que impeça o bloqueio.' },
    retirada: { horas: 0, texto: 'Sem intervalo' },
    aposPuncao: { horas: 0, texto: 'Sem intervalo' },
    aposRetirada: { horas: 0, texto: 'Sem intervalo' },
    cateter: 'sim',
    laboratorio: 'Não indicado',
    reversor: 'plaquetas',
    alertas: [
      'A liberação vale para o uso ISOLADO. Associado a heparina, HBPM ou a um segundo antiagregante, o risco muda e valem as regras do outro fármaco.',
      'ESAIC/ESRA: AAS > 200 mg/dia pede função plaquetária normal antes da punção e 6 h após.',
    ],
    notas: { esra: '≤ 200 mg/dia: sem intervalo', sba: 'Sem restrição isoladamente' },
  },
  {
    id: 'clopidogrel',
    farmaco: 'Clopidogrel',
    comerciais: ['Plavix', 'Iscover'],
    classe: 'antiplaq',
    via: 'VO',
    regime: '75 mg/dia',
    dosesTipicas: '75 mg/dia · ataque 300–600 mg',
    antes: { horas: 120, texto: '5–7 dias' },
    retirada: { texto: 'Até 1–2 dias com o cateter', nota: 'Cateter pode ficar 1–2 dias desde que NÃO se faça dose de ataque nesse período.' },
    aposPuncao: { horas: 0, texto: 'Imediato (sem ataque)', nota: 'Com dose de ataque: 6 h.' },
    aposRetirada: { horas: 6, texto: '6 h se dose de ataque · imediato se manutenção' },
    cateter: 'condicional',
    laboratorio: 'Teste de função plaquetária pode encurtar o intervalo em situações selecionadas',
    reversor: 'plaquetas',
    alertas: ['A SBA 2020 usa 24 h entre punção/retirada e a próxima dose — regra mais conservadora que a da ASRA.'],
    notas: { esra: '5 dias · 48 h após a punção se dose de ataque de 300 mg', sba: '5–7 dias · 24 h após' },
  },
  {
    id: 'prasugrel',
    farmaco: 'Prasugrel',
    comerciais: ['Effient'],
    classe: 'antiplaq',
    via: 'VO',
    regime: '10 mg/dia',
    dosesTipicas: '10 mg/dia (5 mg se < 60 kg ou > 75 anos)',
    antes: { horas: 168, texto: '7–10 dias' },
    retirada: { texto: 'Não manter cateter' },
    aposPuncao: { horas: 6, texto: '6 h se dose de ataque · imediato se manutenção' },
    aposRetirada: { horas: 6, texto: '6 h se dose de ataque · imediato se manutenção' },
    cateter: 'nao',
    laboratorio: 'Função plaquetária',
    reversor: 'plaquetas',
    alertas: ['Inibição plaquetária irreversível e mais intensa que a do clopidogrel.'],
    notas: { esra: '7 dias · 24 h após a punção', sba: '7–10 dias · 24 h após' },
  },
  {
    id: 'ticagrelor',
    farmaco: 'Ticagrelor',
    comerciais: ['Brilinta'],
    classe: 'antiplaq',
    via: 'VO',
    regime: '60–90 mg 12/12h',
    dosesTipicas: '90 mg 12/12h · ataque 180 mg',
    antes: { horas: 120, texto: '5–7 dias' },
    retirada: { texto: 'Não manter cateter' },
    aposPuncao: { horas: 6, texto: '6 h se dose de ataque · imediato se manutenção' },
    aposRetirada: { horas: 6, texto: '6 h se dose de ataque · imediato se manutenção' },
    cateter: 'nao',
    laboratorio: 'Função plaquetária',
    reversor: 'plaquetas',
    alertas: ['Inibição reversível, mas a recuperação plaquetária leva ~5 dias.'],
    notas: { esra: '5 dias · 24 h após a punção', sba: '5–7 dias · 24 h após' },
  },
  {
    id: 'ticlopidina',
    farmaco: 'Ticlopidina',
    comerciais: ['Ticlid'],
    classe: 'antiplaq',
    via: 'VO',
    regime: '250 mg 12/12h',
    dosesTipicas: '250 mg 12/12h',
    antes: { horas: 240, texto: '10 dias' },
    retirada: { texto: 'Até 48 h com o cateter, sem dose de ataque' },
    aposPuncao: { horas: 24 },
    aposRetirada: { horas: 24 },
    cateter: 'condicional',
    laboratorio: 'Função plaquetária · hemograma (risco de neutropenia)',
    reversor: 'plaquetas',
    alertas: ['Pouco usada hoje; substituída pelo clopidogrel.'],
    notas: { sba: '10 dias · 24 h após' },
  },
  {
    id: 'cilostazol',
    farmaco: 'Cilostazol',
    comerciais: ['Pletal', 'Vasogard'],
    classe: 'antiplaq',
    via: 'VO',
    regime: '100 mg 12/12h',
    dosesTipicas: '100 mg 12/12h',
    antes: { horas: 48, texto: '2 dias' },
    retirada: { texto: 'Retirar o cateter ANTES de reintroduzir' },
    aposPuncao: { horas: 6 },
    aposRetirada: { horas: 6 },
    cateter: 'nao',
    laboratorio: 'Não estabelecido',
    reversor: 'plaquetas',
    alertas: [],
    notas: { sba: '2 dias · 6 h após' },
  },
  {
    id: 'dipiridamol',
    farmaco: 'Dipiridamol',
    comerciais: ['Persantin'],
    classe: 'antiplaq',
    via: 'VO',
    regime: 'Liberação prolongada',
    dosesTipicas: '200 mg 12/12h',
    antes: { horas: 24 },
    retirada: { texto: 'Retirar o cateter ANTES de reintroduzir' },
    aposPuncao: { horas: 6 },
    aposRetirada: { horas: 6 },
    cateter: 'nao',
    laboratorio: 'Não estabelecido',
    reversor: 'plaquetas',
    alertas: ['Risco maior de sangramento quando associado ao AAS.'],
    notas: { sba: '24 h · 6 h após' },
  },
  {
    id: 'cangrelor',
    farmaco: 'Cangrelor',
    comerciais: ['Kengreal'],
    classe: 'antiplaq',
    via: 'EV',
    regime: 'Infusão (terapia-ponte)',
    dosesTipicas: '0,75–4 mcg/kg/min',
    antes: { horas: 3 },
    retirada: { texto: 'Retirar o cateter ANTES de reintroduzir' },
    aposPuncao: { horas: 8 },
    aposRetirada: { horas: 8 },
    cateter: 'nao',
    laboratorio: 'Função plaquetária normaliza em ~1 h',
    reversor: 'plaquetas',
    alertas: ['Meia-vida muito curta (3–6 min) — usado como ponte antes de cirurgia em portador de stent recente.'],
    notas: { esra: '3 h · 24 h após a punção', sba: '3 h · 8 h após' },
  },
  {
    id: 'gpiibiiia',
    farmaco: 'Inibidores da GP IIb/IIIa',
    comerciais: ['ReoPro (abciximabe)', 'Integrilin (eptifibatide)', 'Aggrastat (tirofibana)'],
    classe: 'antiplaq',
    via: 'EV',
    regime: 'Infusão',
    dosesTipicas: 'Uso em SCA / intervenção coronária',
    antes: {
      horas: 8,
      texto: 'Eptifibatide e tirofibana: 4–8 h · Abciximabe: 24–48 h',
      resumo: '4–48 h',
      nota: 'Só puncionar com função plaquetária recuperada.',
    },
    retirada: { texto: 'Mesmos intervalos da punção' },
    aposPuncao: { texto: 'Contraindicados por 4 semanas após cirurgia' },
    aposRetirada: { texto: 'Contraindicados por 4 semanas após cirurgia' },
    cateter: 'nao',
    laboratorio: 'Contagem e função plaquetária',
    reversor: 'plaquetas',
    alertas: ['Se administrados com o cateter instalado: manter infusão peridural mínima (sem bloqueio motor) e vigilância neurológica estreita.'],
    notas: { sba: 'Abciximabe 24–48 h · eptifibatide/tirofibana 4–8 h' },
  },

  // ------------------------------------------------------------ TROMBOLÍTICOS
  {
    id: 'tromboliticos',
    farmaco: 'Trombolíticos / fibrinolíticos',
    comerciais: ['Actilyse (alteplase)', 'Metalyse (tenecteplase)', 'estreptoquinase', 'uroquinase'],
    classe: 'trombolitico',
    via: 'EV',
    regime: 'Dose única / infusão',
    dosesTipicas: 'IAM, AVCi, TEP maciço',
    antes: { horas: 48, nota: 'E documentar coagulograma normalizado, INCLUSIVE o fibrinogênio.' },
    retirada: { texto: 'Sem intervalo definido', nota: 'Dosar fibrinogênio para estimar o efeito residual antes de retirar.' },
    aposPuncao: { texto: 'Evitar; se inevitável, vigilância neurológica a cada 2 h' },
    aposRetirada: { texto: 'Vigilância neurológica a cada 2 h por ≥ 48 h' },
    cateter: 'evitar',
    laboratorio: 'Fibrinogênio + coagulograma normalizados',
    reversor: 'antifibrinolitico',
    alertas: [
      'Perguntar ativamente por punção lombar, raqui/peridural ou infiltração peridural recente ANTES de trombolisar.',
      'Vigilância neurológica a cada 2 h por ≥ 48 h quando houver bloqueio e trombólise no mesmo paciente.',
    ],
    notas: { sba: 'Evitar bloqueio' },
  },

  // ------------------------------------------------------------------ OUTROS
  {
    id: 'fitoterapicos',
    farmaco: 'Fitoterápicos',
    comerciais: ['Ginkgo biloba', 'ginseng', 'alho', 'óleo de peixe'],
    classe: 'outros',
    via: 'VO',
    regime: 'Uso isolado',
    dosesTipicas: '—',
    antes: { horas: 0, texto: 'Sem intervalo' },
    retirada: { horas: 0, texto: 'Sem intervalo' },
    aposPuncao: { horas: 0, texto: 'Sem intervalo' },
    aposRetirada: { horas: 0, texto: 'Sem intervalo' },
    cateter: 'sim',
    laboratorio: 'Não indicado',
    reversor: 'nenhum',
    alertas: ['Sem risco adicional isoladamente; reavaliar se associados a anticoagulante ou antiagregante.'],
    notas: { sba: 'Sem risco adicional em uso isolado' },
  },
];

// =============================================================================
// REVERSORES
// =============================================================================

export const REVERSORES = [
  {
    id: 'protamina',
    nome: 'Protamina',
    alvo: 'Heparina não fracionada (e parcialmente HBPM)',
    dose: '1 mg de protamina para cada 100 UI de HNF administradas nas últimas 2–3 h',
    detalhes: [
      'Máximo 50 mg por dose; infundir em ≥ 10 min (bolus rápido causa hipotensão e vasoconstrição pulmonar).',
      'Enoxaparina < 8 h: 1 mg de protamina por 1 mg de enoxaparina. Entre 8–12 h: 0,5 mg por 1 mg.',
      'Reversão da HBPM é PARCIAL (~60% do anti-Xa). Fondaparinux não é revertido.',
      'Sem indicação se a HNF foi feita há mais de 3 h (ou HBPM há mais de 12 h).',
    ],
    inicio: 'Imediato',
    riscos: 'Reação anafilactoide, hipotensão, hipertensão pulmonar. Dose > 50 mg tem efeito anticoagulante paradoxal.',
    brasil: 'Disponível.',
  },
  {
    id: 'vitaminaK',
    nome: 'Vitamina K (fitomenadiona)',
    alvo: 'Varfarina e demais antagonistas da vitamina K',
    dose: 'Sangramento grave: 10 mg EV lento (em 30 min), SEMPRE junto do CCP',
    detalhes: [
      'RNI 5–10 sem sangramento: 1–2,5 mg VO. RNI > 10 sem sangramento: 5–10 mg VO.',
      'Início em 1–2 h, efeito máximo em 4–6 h — não serve sozinha para urgência.',
      'Via EV lenta pelo risco de reação anafilactoide; evitar via IM em anticoagulado.',
      'Efeito máximo em 4–6 h.',
    ],
    inicio: '1–2 h',
    riscos: 'Reação anafilactoide (EV rápida); hipercorreção do RNI dificulta a reanticoagulação.',
    brasil: 'Disponível (Kanakion®).',
  },
  {
    id: 'ccp',
    nome: 'Complexo protrombínico (CCP 4 fatores)',
    alvo: 'Varfarina — e alternativa off-label para inibidores do fator Xa',
    dose: 'RNI 2–4: 25 UI/kg · RNI 4–6: 35 UI/kg · RNI > 6: 50 UI/kg (máx. 5.000 UI)',
    detalhes: [
      'Sempre associado à vitamina K — o CCP corrige em minutos, a vitamina K sustenta a correção.',
      'DOAC anti-Xa sem andexanet disponível: 25–50 UI/kg (off-label, é a conduta praticável no Brasil).',
      'Preferível ao plasma fresco (menor volume, correção mais rápida e previsível).',
    ],
    inicio: '10–30 min',
    riscos: 'Eventos tromboembólicos em 3–8%.',
    brasil: 'Disponível (Octaplex®, Beriplex®, Prothromplex®).',
  },
  {
    id: 'plasma',
    nome: 'Plasma fresco congelado',
    alvo: 'Antagonistas da vitamina K, quando não há CCP',
    dose: '10–15 mL/kg',
    detalhes: [
      'Segunda escolha: exige descongelamento, grande volume e raramente normaliza o RNI.',
      'Considerar em coagulopatia dilucional associada.',
    ],
    inicio: '≥ 30 min',
    riscos: 'Sobrecarga volêmica (TACO), TRALI, reações transfusionais.',
    brasil: 'Disponível.',
  },
  {
    id: 'idarucizumabe',
    nome: 'Idarucizumabe',
    alvo: 'Dabigatrana',
    dose: '5 g EV — 2 frascos de 2,5 g em bolus consecutivos, em até 15 min',
    detalhes: [
      'Reversão completa em minutos; efeito mantido por > 12 h.',
      'Pode-se repetir 5 g se houver rebote (sangramento recorrente com TT alargado).',
      'Sem ajuste para função renal.',
      'Reanticoagular assim que clinicamente seguro — a indicação da dabigatrana continua.',
    ],
    inicio: '< 5 min',
    riscos: 'Eventos trombóticos em 4–5% (a maioria por não reanticoagular).',
    brasil: 'Disponível (Praxbind®).',
  },
  {
    id: 'andexanet',
    nome: 'Andexanet alfa',
    alvo: 'Rivaroxabana e apixabana (inibidores do fator Xa)',
    dose: 'Dose baixa: 400 mg em bolus (30 mg/min) + 4 mg/min até 120 min · Dose alta: 800 mg em bolus + 8 mg/min até 120 min',
    detalhes: [
      'Dose ALTA: última tomada há < 8 h de rivaroxabana > 10 mg ou apixabana > 5 mg, ou horário desconhecido.',
      'Dose BAIXA: dose menor ou última tomada há ≥ 8 h.',
      'Efeito transitório (meia-vida ~1 h): o anti-Xa volta a subir depois da infusão.',
      'Queda > 90% do anti-Xa em minutos — mas só enquanto a infusão corre.',
    ],
    inicio: '< 5 min',
    riscos: 'Eventos trombóticos em 10–14% — o maior entre os reversores. Custo muito alto.',
    brasil: 'Disponibilidade restrita/irregular. Na prática, o CCP 25–50 UI/kg é a alternativa usada.',
  },
  {
    id: 'plaquetas',
    nome: 'Transfusão de plaquetas',
    alvo: 'Antiagregantes plaquetários (clopidogrel, prasugrel, ticagrelor, AAS)',
    dose: '1 aférese (ou 5–6 U de concentrado randômico) em sangramento crítico',
    detalhes: [
      'Benefício incerto: o PATCH trial mostrou PIOR desfecho na hemorragia intracerebral espontânea.',
      'O ticagrelor circula livre e inativa as plaquetas transfundidas — esperar pelo menos 12–24 h da última dose.',
      'Reservar para sangramento com risco de vida ou hematoma espinhal com indicação cirúrgica.',
    ],
    inicio: 'Imediato',
    riscos: 'Reações transfusionais, TRALI, trombose.',
    brasil: 'Disponível.',
  },
  {
    id: 'antifibrinolitico',
    nome: 'Ácido tranexâmico',
    alvo: 'Adjuvante em qualquer sangramento — e no efeito trombolítico residual',
    dose: '1 g EV (ou 15 mg/kg) em 10 min; pode repetir em 8 h',
    detalhes: [
      'Não é antídoto: é medida adjuvante que estabiliza o coágulo já formado.',
      'Considerar crioprecipitado se fibrinogênio < 150 mg/dL após trombólise.',
    ],
    inicio: '10–20 min',
    riscos: 'Convulsão em dose alta; cautela na insuficiência renal.',
    brasil: 'Disponível (Transamin®).',
  },
  {
    id: 'nenhum',
    nome: 'Sem antídoto específico',
    alvo: 'Fondaparinux, argatrobana, bivalirudina',
    dose: '—',
    detalhes: [
      'Suporte: suspender a droga, compressão, hemoderivados guiados por exames.',
      'CCP 25–50 UI/kg pode ser tentado no fondaparinux (evidência fraca).',
      'Argatrobana e bivalirudina têm meia-vida curta: aguardar a depuração costuma ser a conduta.',
    ],
    inicio: '—',
    riscos: '—',
    brasil: '—',
  },
];

// =============================================================================
// AVISO ESTRUTURANTE DA ASRA 5ª EDIÇÃO
// =============================================================================

export const AVISO_REVERSORES_BLOQUEIO =
  'Reversor NÃO serve para liberar bloqueio: a ASRA 5ª ed. recomenda contra usar idarucizumabe, andexanet, CCP ou CCPa apenas para viabilizar punção de neuroeixo ou de plexo profundo. Reversor é para sangramento com risco de vida ou cirurgia de urgência inadiável.';

// =============================================================================
// CATETER PERIDURAL — PROTOCOLO
// =============================================================================

export const PASSOS_CATETER = [
  {
    id: 'antes',
    titulo: '1. Antes de puncionar',
    itens: [
      'Levantar TODOS os fármacos que alteram a hemostasia, com a HORA da última dose (não só o dia).',
      'Calcular o ClCr: o intervalo da HBPM, do fondaparinux e da dabigatrana muda com a função renal.',
      'Plaquetas > 80.000/mm³ e RNI < 1,5 na ausência de outros fatores de risco.',
      'Terapia antiplaquetária dupla ou anticoagulante + antiagregante: reavaliar a indicação do neuroeixo.',
      'HNF ou HBPM há mais de 4 dias: dosar plaquetas antes de puncionar (HIT).',
    ],
  },
  {
    id: 'puncao',
    titulo: '2. Na punção',
    itens: [
      'Menor número possível de tentativas — punção traumática é fator de risco independente.',
      'Sangue na agulha ou no cateter: comunicar o cirurgião e discutir adiar a tromboprofilaxia por 24 h.',
      'Ultrassom NÃO encurta nenhum intervalo (ASRA e ESAIC/ESRA são explícitas).',
      'Peridural com cateter > peridural simples > raquianestesia, em risco de hematoma.',
    ],
  },
  {
    id: 'manutencao',
    titulo: '3. Com o cateter instalado',
    itens: [
      'Só manter o cateter com fármaco de baixo risco (ver a coluna "cateter" de cada droga).',
      'Primeira dose de HBPM em dose baixa: ≥ 12 h após a punção/instalação.',
      'Não introduzir um segundo fármaco que altere a hemostasia enquanto o cateter estiver instalado.',
      'Analgesia com anestésico local diluído: o bloqueio motor denso ESCONDE o hematoma.',
      'Avaliar motricidade a cada plantão e registrar (Bromage) — o módulo Cateter Peridural do app guarda a evolução.',
      'Varfarina reintroduzida: RNI diário.',
    ],
  },
  {
    id: 'retirada',
    titulo: '4. Na retirada',
    itens: [
      'Cumprir o intervalo desde a última dose ANTES de retirar (é o momento de maior risco, junto com a punção).',
      'Retirar SEMPRE antes de reintroduzir o fármaco, e não o contrário.',
      'Próxima dose: ≥ 4 h (HBPM baixa dose) · ≥ 6 h (DOAC em dose baixa) · ≥ 24 h (DOAC em dose alta).',
      'Documentar hora da retirada, integridade da ponta e exame neurológico do momento.',
    ],
  },
  {
    id: 'vigilancia',
    titulo: '5. Depois da retirada',
    itens: [
      'Vigilância neurológica por ≥ 24 h após a retirada (ASRA sugere 48 h no paciente em varfarina).',
      'Monitorar até o bloqueio sensitivo regredir ao menos 2 dermátomos ou a motricidade voltar por completo.',
      'Orientar o paciente e a enfermagem sobre o que reportar imediatamente.',
      'Trombólise ou GP IIb/IIIa no período: avaliação a cada 2 h por ≥ 48 h.',
    ],
  },
];

// =============================================================================
// HEMATOMA ESPINHAL / PERIDURAL
// =============================================================================

export const SINAIS_ALARME = [
  'Regressão lenta ou ausente do bloqueio motor ou sensitivo.',
  'Retorno do déficit motor ou sensitivo depois de o bloqueio já ter regredido.',
  'Dor lombar ou dorsal intensa, nova, muitas vezes em faixa.',
  'Retenção urinária nova ou incontinência.',
  'Déficit neurológico progressivo em qualquer momento — inclusive dias após a retirada.',
];

export const CONDUTA_HEMATOMA = [
  'Suspender IMEDIATAMENTE a infusão peridural e reavaliar em 30 min — se o déficit não regredir, tratar como hematoma.',
  'Ressonância magnética de EMERGÊNCIA (tomografia só se a RM for indisponível).',
  'Acionar a neurocirurgia em paralelo ao exame — não esperar a imagem para avisar.',
  'Laminectomia descompressiva em até 6–12 h do início dos sintomas: é o que determina a chance de recuperação completa.',
  'Corrigir a coagulação em paralelo (ver Reversores), sem atrasar a descompressão.',
  'Notificar como evento adverso e registrar a linha do tempo completa (doses, horários, punção, retirada, sintomas).',
];

export const FATORES_RISCO = {
  paciente: [
    'Idade avançada',
    'Sexo feminino',
    'Coagulopatia congênita',
    'Coagulopatia adquirida: insuficiência renal ou hepática, neoplasia, HELLP, CIVD',
    'Plaquetopenia',
    'Anormalidade da coluna: estenose de canal, espinha bífida, espondilite anquilosante, osteoporose',
  ],
  procedimento: [
    'Inserção ou remoção do cateter (os dois momentos críticos)',
    'Punção traumática / múltiplas tentativas',
    'Sangue na agulha ou no cateter',
    'Peridural com cateter > peridural simples > raquianestesia',
  ],
  farmaco: [
    'Anticoagulante, antiagregante ou fibrinolítico em uso',
    'Dose administrada imediatamente antes ou depois da técnica',
    'Terapia dupla (antiagregante + anticoagulante, ou dois antiagregantes)',
  ],
};

export const INCIDENCIA = [
  { contexto: 'Peridural com cateter + enoxaparina 2×/dia (EUA)', valor: '1:3.100' },
  { contexto: 'Peridural simples + enoxaparina 2×/dia', valor: '1:6.600' },
  { contexto: 'Peridural (Suécia, enoxaparina 40 mg 1×/dia)', valor: '1:18.000' },
  { contexto: 'Raquianestesia + enoxaparina 2×/dia', valor: '1:40.800' },
  { contexto: 'Artroplastia de joelho', valor: '1:3.600' },
  { contexto: 'População obstétrica', valor: '1:200.000' },
  { contexto: 'Geral — NAP3 (Royal College of Anaesthetists)', valor: '1:88.000 a 1:140.000' },
];

// =============================================================================
// LIMIARES LABORATORIAIS
// =============================================================================

export const LIMIARES = [
  { exame: 'Plaquetas', alvo: '> 80.000/mm³', nota: 'Sem outros fatores de risco (SBA 2020, grau 2C). Entre 70–80.000 a decisão é individual; < 70.000 o risco é incerto.' },
  { exame: 'RNI', alvo: '< 1,5', nota: 'Corresponde a ~40% de atividade do fator VII, suficiente para hemostasia.' },
  { exame: 'Anti-Xa (HBPM, fondaparinux)', alvo: '≤ 0,1 UI/mL', nota: 'Permite encurtar o intervalo quando disponível.' },
  { exame: 'Nível do DOAC anti-Xa', alvo: '< 30 ng/mL', nota: 'Rivaroxabana, apixabana, edoxabana. TP/TTPa normais NÃO afastam efeito residual.' },
  { exame: 'Dabigatrana', alvo: '< 30 ng/mL', nota: 'Tempo de trombina (TT) normal exclui efeito. TTPa é pouco sensível.' },
  { exame: 'TTPa / ACT', alvo: 'Faixa normal', nota: 'Para HNF antes da punção e da retirada.' },
  { exame: 'Fibrinogênio', alvo: 'Normalizado', nota: 'Obrigatório após trombolítico, antes de qualquer punção.' },
];

// =============================================================================
// MANEJO PRÉ-OPERATÓRIO (cirurgia, independentemente de bloqueio)
// =============================================================================

export const PRE_OPERATORIO = [
  {
    id: 'doac',
    titulo: 'DOACs (rivaroxabana, apixabana, edoxabana, dabigatrana)',
    itens: [
      'Cirurgia de BAIXO risco de sangramento: suspender 1 dia antes, reiniciar 1 dia depois.',
      'Cirurgia de ALTO risco: suspender 2 dias antes, reiniciar 2–3 dias depois.',
      'Dabigatrana com ClCr 30–50: acrescentar 1–2 dias.',
      'NÃO fazer ponte com heparina e NÃO pedir dosagem de rotina (estudo PAUSE).',
      '⚠️ O intervalo para BLOQUEIO DE NEUROEIXO é bem maior que o intervalo cirúrgico — usar a aba Bloqueio, não esta.',
    ],
  },
  {
    id: 'varfarina',
    titulo: 'Varfarina',
    itens: [
      'Suspender 5 dias antes e checar o RNI na véspera ou no dia.',
      'Ponte com HBPM apenas em risco tromboembólico muito alto: prótese valvar mecânica mitral, AVC/AIT nos últimos 3 meses, TEV há menos de 3 meses, trombofilia grave.',
      'Fora desses casos, a ponte aumenta sangramento sem reduzir tromboembolismo (estudo BRIDGE).',
      'Reiniciar 12–24 h após a cirurgia, se a hemostasia estiver adequada.',
    ],
  },
  {
    id: 'antiplaquetario',
    titulo: 'Antiagregantes e stent coronário',
    itens: [
      'AAS em prevenção secundária: manter na maioria das cirurgias, exceto neurocirurgia, câmara posterior do olho e ressecção transuretral de próstata.',
      'AAS em prevenção primária: suspender (POISE-2 — sem benefício e mais sangramento).',
      'Dupla antiagregação após stent farmacológico: adiar a cirurgia eletiva por ≥ 6 meses (≥ 1 mês no stent convencional).',
      'Cirurgia inadiável: manter o AAS, suspender o inibidor de P2Y12 pelo intervalo próprio e reintroduzir o mais cedo possível.',
      'Decisão compartilhada com a cardiologia — suspender antiagregante em stent recente causa trombose de stent, com mortalidade alta.',
    ],
  },
  {
    id: 'tromboprofilaxia',
    titulo: 'Tromboprofilaxia no pós-operatório',
    itens: [
      'Primeira dose de HBPM em dose baixa: 6–8 h após a cirurgia E ≥ 12 h após a punção/instalação do cateter — vale o intervalo maior.',
      'Punção traumática: discutir adiar a primeira dose por 24 h.',
      'Programar a retirada do cateter ENTRE as doses, nunca logo depois de uma.',
    ],
  },
];

// =============================================================================
// REFERÊNCIAS
// =============================================================================

export const REFERENCIAS = [
  {
    id: 'asra5',
    texto: 'Kopp SL, Vandermeulen E, McBane RD, Perlas A, et al. Regional anesthesia in the patient receiving antithrombotic or thrombolytic therapy: ASRA Pain Medicine Evidence-Based Guidelines (fifth edition). Reg Anesth Pain Med. 2025.',
    doi: '10.1136/rapm-2024-105766',
  },
  {
    id: 'esaic',
    texto: 'Kietaibl S, Ferrandis R, Godier A, Llau J, et al. Regional anaesthesia in patients on antithrombotic drugs: Joint ESAIC/ESRA guidelines. Eur J Anaesthesiol. 2022;39(2):100-132.',
    doi: '10.1097/EJA.0000000000001600',
  },
  {
    id: 'sba',
    texto: 'Fonseca NM, Pontes JPJ, Perez MV, Alves RR, Fonseca GG. SBA 2020: Atualização na diretriz da anestesia regional em uso de anticoagulantes. Braz J Anesthesiol. 2020;70(4):364-387.',
    doi: '10.1016/j.bjane.2020.04.018',
  },
  {
    id: 'pause',
    texto: 'Douketis JD, Spyropoulos AC, Duncan J, et al. Perioperative management of patients with atrial fibrillation receiving a direct oral anticoagulant (PAUSE). JAMA Intern Med. 2019;179(11):1469-1478.',
    doi: '10.1001/jamainternmed.2019.2431',
  },
  {
    id: 'reversao',
    texto: 'Grottke O, Afshari A, Ahmed A, et al. Clinical guideline on reversal of direct oral anticoagulants in patients with life threatening bleeding. Eur J Anaesthesiol. 2024;41(5):327-350.',
    doi: '10.1097/EJA.0000000000001968',
  },
];

// =============================================================================
// FUNÇÕES PURAS
// =============================================================================

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Busca por nome genérico, comercial ou classe. Termo vazio devolve tudo. */
export function buscarFarmacos(termo) {
  const t = norm(termo);
  if (!t) return ANTICOAGULANTES;
  return ANTICOAGULANTES.filter((f) => {
    const alvo = [
      f.farmaco,
      f.regime,
      f.dosesTipicas,
      CLASSES[f.classe]?.label,
      ...(f.comerciais || []),
    ]
      .map(norm)
      .join(' ');
    return alvo.includes(t);
  });
}

export function getFarmaco(id) {
  return ANTICOAGULANTES.find((f) => f.id === id) || null;
}

export function getReversor(id) {
  return REVERSORES.find((r) => r.id === id) || null;
}

/** Agrupa os fármacos por classe, na ordem definida em CLASSES. */
export function agruparPorClasse(lista = ANTICOAGULANTES) {
  const grupos = new Map();
  lista.forEach((f) => {
    if (!grupos.has(f.classe)) grupos.set(f.classe, []);
    grupos.get(f.classe).push(f);
  });
  return [...grupos.entries()]
    .map(([classe, farmacos]) => ({
      classe,
      label: CLASSES[classe]?.label || classe,
      ordem: CLASSES[classe]?.ordem ?? 99,
      farmacos,
    }))
    .sort((a, b) => a.ordem - b.ordem);
}

/**
 * Resolve uma janela considerando função renal e idade.
 * A PRIMEIRA regra que casar vence — as regras são escritas da mais
 * restritiva para a menos restritiva dentro de cada fármaco.
 */
export function resolverJanela(janela, { clcr, idade } = {}) {
  if (!janela) return null;
  const base = {
    horas: janela.horas ?? null,
    texto: janela.texto || (janela.horas != null ? horasParaTexto(janela.horas) : null),
    // rótulo curto para badge/pastilha — quando o texto é uma frase, o badge
    // (whitespace-nowrap, não encolhe) esmaga a coluna de texto ao lado
    resumo: janela.resumo || janela.texto || (janela.horas != null ? horasParaTexto(janela.horas) : null),
    bloqueado: !!janela.bloqueado,
    motivo: janela.bloqueado ? janela.nota || null : null,
    nota: janela.nota || null,
    ajustado: false,
  };

  const regras = janela.regras || [];
  for (const regra of regras) {
    const casaClcr =
      (regra.clcrMax == null || (clcr != null && clcr <= regra.clcrMax)) &&
      (regra.clcrMin == null || (clcr != null && clcr >= regra.clcrMin));
    const casaIdade = regra.idadeMin == null || (idade != null && idade >= regra.idadeMin);
    const temCriterioClcr = regra.clcrMax != null || regra.clcrMin != null;
    const temCriterioIdade = regra.idadeMin != null;

    // A regra só é aplicada se o dado que ela exige foi informado.
    if (temCriterioClcr && clcr == null) continue;
    if (temCriterioIdade && idade == null) continue;
    if (!casaClcr || !casaIdade) continue;

    if (regra.bloqueado) {
      return { ...base, horas: null, texto: 'Não realizar', resumo: 'Não realizar', bloqueado: true, motivo: regra.motivo, ajustado: true };
    }
    return {
      ...base,
      horas: regra.horas,
      texto: horasParaTexto(regra.horas),
      resumo: horasParaTexto(regra.horas),
      motivo: regra.motivo,
      ajustado: true,
    };
  }
  return base;
}

/** 72 → "72 h (3 dias)". 6 → "6 h". 0 → "Sem intervalo". */
export function horasParaTexto(horas) {
  if (horas == null) return '—';
  if (horas === 0) return 'Sem intervalo';
  if (horas < 24) return `${horas} h`;
  // Só qualifica em dias quando o número é redondo — "58 h (2,4 dias)" atrapalha
  // mais do que ajuda em uma tela consultada de relance.
  if (horas % 24 !== 0) return `${horas} h`;
  const dias = horas / 24;
  return `${horas} h (${dias} dia${dias > 1 ? 's' : ''})`;
}

/** Formata "25/08 14:30" a partir de um Date. */
export function formatarMomento(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null;
  const dd = String(data.getDate()).padStart(2, '0');
  const mm = String(data.getMonth() + 1).padStart(2, '0');
  const hh = String(data.getHours()).padStart(2, '0');
  const mi = String(data.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

/** Diferença legível entre agora e o alvo: "faltam 8 h 30 min" / "liberado". */
export function faltamTexto(alvo, agora = new Date()) {
  if (!(alvo instanceof Date) || Number.isNaN(alvo.getTime())) return null;
  const min = Math.round((alvo.getTime() - agora.getTime()) / 60000);
  if (min <= 0) return 'liberado';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `faltam ${m} min`;
  if (h < 24) return `faltam ${h} h${m ? ` ${m} min` : ''}`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return `faltam ${d} d${hr ? ` ${hr} h` : ''}`;
}

/**
 * Momento liberado = última dose + horas.
 * ultimaDose aceita Date, ISO string ou valor de <input type="datetime-local">.
 */
export function calcularLiberacao(ultimaDose, horas, agora = new Date()) {
  if (ultimaDose == null || horas == null) return null;
  const base = ultimaDose instanceof Date ? ultimaDose : new Date(ultimaDose);
  if (Number.isNaN(base.getTime())) return null;
  const alvo = new Date(base.getTime() + horas * 3600 * 1000);
  return {
    data: alvo,
    texto: formatarMomento(alvo),
    liberado: alvo.getTime() <= agora.getTime(),
    falta: faltamTexto(alvo, agora),
  };
}

/**
 * Avaliação completa de um fármaco para punção/cateter.
 * Devolve as 4 janelas resolvidas + alertas gerados pelos dados do paciente.
 */
export function avaliarBloqueio({
  farmacoId,
  ultimaDose = null,
  clcr = null,
  idade = null,
  plaquetas = null,
  inr = null,
  agora = new Date(),
} = {}) {
  const farmaco = getFarmaco(farmacoId);
  if (!farmaco) return null;

  const ctx = { clcr, idade };
  const antes = resolverJanela(farmaco.antes, ctx);
  const retirada = resolverJanela(farmaco.retirada, ctx);
  const aposPuncao = resolverJanela(farmaco.aposPuncao, ctx);
  const aposRetirada = resolverJanela(farmaco.aposRetirada, ctx);

  const avisos = [];
  if (plaquetas != null && plaquetas < 80) {
    avisos.push(
      plaquetas < 70
        ? `Plaquetas ${plaquetas} mil/mm³: abaixo de 70.000 o risco de hematoma é incerto (até 3% entre 50–69 mil). Reavaliar a indicação do neuroeixo.`
        : `Plaquetas ${plaquetas} mil/mm³: abaixo do limiar de 80.000/mm³ da SBA 2020. Decisão individual, considerando função plaquetária e alternativas.`
    );
  }
  if (inr != null && inr >= 1.5) {
    avisos.push(`RNI ${inr}: o limiar para punção e para retirada de cateter é < 1,5.`);
  }
  if (clcr != null && clcr < 30) {
    avisos.push('ClCr < 30 mL/min: heparinas de baixo peso, fondaparinux e dabigatrana acumulam — conferir o intervalo ajustado acima.');
  }
  if (antes?.bloqueado) avisos.push(antes.motivo || 'Bloqueio não recomendado com este fármaco.');

  const liberacao = calcularLiberacao(ultimaDose, antes?.bloqueado ? null : antes?.horas, agora);
  const liberacaoRetirada = calcularLiberacao(ultimaDose, retirada?.bloqueado ? null : retirada?.horas, agora);

  return {
    farmaco,
    janelas: { antes, retirada, aposPuncao, aposRetirada },
    liberacao,
    liberacaoRetirada,
    avisos,
    cateter: CATETER[farmaco.cateter] || CATETER.condicional,
    reversor: getReversor(farmaco.reversor),
  };
}

export default {
  ANTICOAGULANTES,
  REVERSORES,
  CLASSES,
  CATETER,
  PASSOS_CATETER,
  SINAIS_ALARME,
  CONDUTA_HEMATOMA,
  FATORES_RISCO,
  INCIDENCIA,
  LIMIARES,
  PRE_OPERATORIO,
  REFERENCIAS,
  AVISO_REVERSORES_BLOQUEIO,
  buscarFarmacos,
  getFarmaco,
  getReversor,
  agruparPorClasse,
  resolverJanela,
  horasParaTexto,
  formatarMomento,
  faltamTexto,
  calcularLiberacao,
  avaliarBloqueio,
};
