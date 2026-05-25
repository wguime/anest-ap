const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * SAPS 3 — Simplified Acute Physiology Score III
 * Moreno RP et al. Intensive Care Med 2005;31(10):1345-55.
 *
 * 20 variables across 3 boxes. Validated with Brazilian data (PROGRESS study).
 * Free, publicly available scoring system.
 * Score range: 16-217 points.
 */

// ─── BOX I: Patient characteristics before ICU admission ───

function scoreAge(age) {
  if (age < 40) return 0;
  if (age < 60) return 5;
  if (age < 70) return 9;
  if (age < 75) return 13;
  if (age < 80) return 15;
  return 18;
}

function scoreComorbidities(comorbs) {
  let pts = 0;
  if (comorbs.cancerMetastatico) pts += 11;
  else if (comorbs.cancerHematologico) pts += 8;
  if (comorbs.insufCardiacaNYHA4) pts += 6;
  if (comorbs.cirrose) pts += 4;
  if (comorbs.aids) pts += 4;
  if (comorbs.irc) pts += 3;
  return pts;
}

function scoreDaysBeforeICU(days) {
  if (days < 14) return 0;
  if (days < 28) return 6;
  return 7;
}

function scoreICUAdmissionSource(source) {
  const map = {
    centro_cirurgico: 0,
    outro_hospital: 5,
    emergencia: 5,
    outro_uti: 7,
    enfermaria: 8,
  };
  return map[source] ?? 5;
}

// ─── BOX II: Circumstances of ICU admission ───

function scorePlannedAdmission(isPlanned) {
  return isPlanned ? 0 : 3;
}

function scoreAdmissionReason(reason) {
  const map = {
    cardiovascular: 0,
    neurologico: 4,
    hepatico: 5,
    digestivo: 3,
    respiratorio: 0,
    sepse: 8,
    outro: 3,
  };
  return map[reason] ?? 3;
}

function scoreSurgeryType(type) {
  const map = {
    sem_cirurgia: 5,
    eletiva: 0,
    urgencia: 6,
    emergencia: 8,
  };
  return map[type] ?? 0;
}

function scoreInfection(status) {
  const map = {
    sem_infeccao: 0,
    nosocomial: 4,
    respiratoria: 3,
    outra: 3,
  };
  return map[status] ?? 0;
}

// ─── BOX III: Physiologic variables at ICU admission ───

function scoreGCS(gcs) {
  if (gcs >= 13) return 0;
  if (gcs >= 8) return 4;
  if (gcs >= 6) return 7;
  if (gcs >= 4) return 10;
  return 15;
}

function scoreBilirubin(bil) {
  if (bil < 2) return 0;
  if (bil < 6) return 4;
  return 5;
}

function scoreBodyTemp(temp) {
  if (temp < 35) return 7;
  return 0;
}

function scoreCreatinine(cr) {
  if (cr < 1.2) return 0;
  if (cr < 2) return 3;
  if (cr < 3.5) return 6;
  return 8;
}

function scoreHR(fc) {
  if (fc < 120) return 0;
  if (fc < 160) return 5;
  return 7;
}

function scoreSBP(pas) {
  if (pas < 40) return 11;
  if (pas < 70) return 8;
  if (pas < 120) return 3;
  return 0;
}

function scoreOxygenation(pao2fio2, isVM) {
  if (!isVM) {
    if (pao2fio2 < 100) return 11;
    if (pao2fio2 < 200) return 7;
    return 0;
  }
  if (pao2fio2 < 100) return 11;
  if (pao2fio2 < 200) return 9;
  return 3;
}

function scorePH(ph) {
  if (ph < 7.25) return 3;
  return 0;
}

function scorePlatelets(plt) {
  if (plt < 20) return 13;
  if (plt < 50) return 8;
  if (plt < 100) return 5;
  return 0;
}

function scoreVasopressors(useVaso) {
  return useVaso ? 3 : 0;
}

/**
 * SAPS 3 mortality prediction using the standard logistic equation.
 * logit = -32.6659 + 0.1603 × score
 * Global equation (Moreno 2005). Regional calibrations exist but
 * the global equation is used as default.
 */
function predictMortality(score) {
  const logit = -32.6659 + 7.3068 * Math.log(score + 20.5958);
  const probability = Math.exp(logit) / (1 + Math.exp(logit));
  return Math.round(probability * 1000) / 10;
}

export function saps3(values) {
  const age = num(values.idade);
  const comorbs = values.comorbidades || {};
  const diasPrevios = num(values.diasAntesUTI);
  const origem = values.origemAdmissao || 'emergencia';
  const admissaoPlanejada = !!values.admissaoPlanejada;
  const motivoAdmissao = values.motivoAdmissao || 'outro';
  const tipoCirurgia = values.tipoCirurgia || 'sem_cirurgia';
  const infeccao = values.infeccao || 'sem_infeccao';

  const gcs = num(values.glasgow, 15);
  const bil = num(values.bilirrubina, 0.5);
  const temp = num(values.temperatura, 37);
  const cr = num(values.creatinina, 1);
  const fc = num(values.fc, 80);
  const pas = num(values.pas, 120);
  const pf = num(values.pao2fio2, 400);
  const isVM = !!values.ventilacaoMecanica;
  const ph = num(values.ph, 7.4);
  const plt = num(values.plaquetas, 200);
  const useVaso = !!values.vasopressores;

  const boxI = {
    idade: scoreAge(age),
    comorbidades: scoreComorbidities(comorbs),
    diasPrevios: scoreDaysBeforeICU(diasPrevios),
    origemAdmissao: scoreICUAdmissionSource(origem),
  };

  const boxII = {
    admissaoPlanejada: scorePlannedAdmission(admissaoPlanejada),
    motivoAdmissao: scoreAdmissionReason(motivoAdmissao),
    tipoCirurgia: scoreSurgeryType(tipoCirurgia),
    infeccao: scoreInfection(infeccao),
  };

  const boxIII = {
    glasgow: scoreGCS(gcs),
    bilirrubina: scoreBilirubin(bil),
    temperatura: scoreBodyTemp(temp),
    creatinina: scoreCreatinine(cr),
    fc: scoreHR(fc),
    pas: scoreSBP(pas),
    oxigenacao: scoreOxygenation(pf, isVM),
    ph: scorePH(ph),
    plaquetas: scorePlatelets(plt),
    vasopressores: scoreVasopressors(useVaso),
  };

  const basePoints = 16;
  const boxITotal = Object.values(boxI).reduce((a, b) => a + b, 0);
  const boxIITotal = Object.values(boxII).reduce((a, b) => a + b, 0);
  const boxIIITotal = Object.values(boxIII).reduce((a, b) => a + b, 0);
  const score = basePoints + boxITotal + boxIITotal + boxIIITotal;
  const mortalityPct = predictMortality(score);

  let risk;
  if (mortalityPct < 10) risk = 'baixo';
  else if (mortalityPct < 30) risk = 'medio';
  else if (mortalityPct < 60) risk = 'alto';
  else risk = 'critico';

  return {
    score,
    risk,
    mortalityPct,
    boxI: { total: boxITotal, breakdown: boxI },
    boxII: { total: boxIITotal, breakdown: boxII },
    boxIII: { total: boxIIITotal, breakdown: boxIII },
  };
}

export {
  scoreAge,
  scoreComorbidities,
  scoreDaysBeforeICU,
  scoreICUAdmissionSource,
  scorePlannedAdmission,
  scoreAdmissionReason,
  scoreSurgeryType,
  scoreInfection,
  scoreGCS,
  scoreBilirubin,
  scoreBodyTemp,
  scoreCreatinine,
  scoreHR,
  scoreSBP,
  scoreOxygenation,
  scorePH,
  scorePlatelets,
  scoreVasopressors,
  predictMortality,
};
