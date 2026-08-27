const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * APACHE II — Acute Physiology and Chronic Health Evaluation II
 * Knaus WA et al. Crit Care Med 1985;13(10):818-29.
 *
 * 12 physiologic variables + age + chronic health = 0-71 points.
 * Calibration from 1979-1982 — overestimates mortality 20-40% in modern ICUs.
 */

function scoreAge(age) {
  if (age >= 75) return 6;
  if (age >= 65) return 5;
  if (age >= 55) return 3;
  if (age >= 45) return 2;
  return 0;
}

function scoreTemperature(temp) {
  if (temp >= 41 || temp <= 29.9) return 4;
  if (temp >= 39 || temp <= 31.9) return 3;
  if (temp <= 33.9) return 2;
  if (temp >= 38.5 || temp <= 35.9) return 1;
  return 0;
}

function scoreMAP(pam) {
  if (pam >= 160 || pam <= 49) return 4;
  if (pam >= 130) return 3;
  if (pam <= 69) return 2;
  if (pam >= 110) return 2;
  return 0;
}

function scoreHR(fc) {
  if (fc >= 180 || fc <= 39) return 4;
  if (fc >= 140 || fc <= 54) return 3;
  if (fc >= 110 || fc <= 69) return 2;
  return 0;
}

function scoreRR(fr) {
  if (fr >= 50 || fr <= 5) return 4;
  if (fr >= 35) return 3;
  if (fr <= 9) return 2;
  if (fr >= 25 || fr <= 11) return 1;
  return 0;
}

function scoreOxygenation(oxi) {
  if (oxi === 'aado2_500p') return 4;
  if (oxi === 'aado2_500') return 3;
  if (oxi === 'aado2_350') return 2;
  if (oxi === 'pao2_55') return 4;
  if (oxi === 'pao2_55_60') return 3;
  if (oxi === 'pao2_61_70') return 1;
  return 0;
}

function scorePH(ph) {
  if (ph >= 7.7 || ph < 7.15) return 4;
  if (ph >= 7.6 || ph < 7.25) return 3;
  if (ph < 7.33) return 2;
  if (ph >= 7.5) return 1;
  return 0;
}

function scoreSodium(na) {
  if (na >= 180 || na <= 110) return 4;
  if (na >= 160 || na <= 119) return 3;
  if (na >= 155 || na <= 129) return 2;
  if (na >= 150) return 1;
  return 0;
}

function scorePotassium(k) {
  if (k >= 7 || k < 2.5) return 4;
  if (k >= 6) return 3;
  if (k < 3) return 2;
  if (k >= 5.5) return 1;
  if (k < 3.5) return 1;
  return 0;
}

function scoreCreatinine(cr, isAcuteRenalFailure) {
  const multiplier = isAcuteRenalFailure ? 2 : 1;
  if (cr >= 3.5) return 4 * multiplier;
  if (cr >= 2) return 3 * multiplier;
  if (cr >= 1.5) return 2 * multiplier;
  if (cr < 0.6) return 2 * multiplier;
  return 0;
}

function scoreHematocrit(ht) {
  if (ht >= 60 || ht < 20) return 4;
  if (ht >= 50 || ht < 30) return 2;
  if (ht >= 46) return 1;
  return 0;
}

function scoreWBC(leuco) {
  if (leuco >= 40 || leuco < 1) return 4;
  if (leuco >= 20 || leuco < 3) return 2;
  if (leuco >= 15) return 1;
  return 0;
}

// A Glasgow vale 3 a 15 POR CONSTRUÇÃO (a soma de três eixos que valem no mínimo
// 1 cada), então valor fora disso não é paciente, é digitação. Sem esta trava um
// `0` digitado somava 15 pontos — quase um terço da escala — em silêncio.
// ⚠️ O input genérico do `CalculatorShowcase` passa `min`/`max` ao DOM mas NÃO
// limita o que é digitado, e isso vale para as 71 calculadoras.
function scoreGCS(gcs) {
  const dentroDaEscala = Math.max(3, Math.min(15, gcs));
  return 15 - dentroDaEscala;
}

function scoreChronicHealth(dc) {
  if (dc === 'emergencia') return 5;
  if (dc === 'eletivo') return 2;
  return 0;
}

function mortalityBand(score) {
  if (score <= 4) return { mortality: '~4%', risk: 'baixo' };
  if (score <= 9) return { mortality: '~8%', risk: 'baixo' };
  if (score <= 14) return { mortality: '~15%', risk: 'medio' };
  if (score <= 19) return { mortality: '~25%', risk: 'medio' };
  if (score <= 24) return { mortality: '~40%', risk: 'alto' };
  if (score <= 29) return { mortality: '~55%', risk: 'alto' };
  if (score <= 34) return { mortality: '~75%', risk: 'critico' };
  return { mortality: '>85%', risk: 'critico' };
}

export function apacheII(values) {
  const idade = num(values.idade);
  const temp = num(values.temp, 37);
  const pam = num(values.pam, 70);
  const fc = num(values.fc, 80);
  const fr = num(values.fr, 16);
  const oxi = values.oxigenacao || 'pao2_70';
  const ph = num(values.ph, 7.4);
  const na = num(values.sodio, 140);
  const k = num(values.potassio, 4);
  const cr = num(values.creatinina, 1);
  const ira = !!values.ira;
  const ht = num(values.hematocrito, 40);
  const leuco = num(values.leucocitos, 10);
  const gcs = num(values.glasgow, 15);
  const dc = values.doenca_cronica || 'nenhuma';

  const breakdown = {
    idade: scoreAge(idade),
    temperatura: scoreTemperature(temp),
    pam: scoreMAP(pam),
    fc: scoreHR(fc),
    fr: scoreRR(fr),
    oxigenacao: scoreOxygenation(oxi),
    ph: scorePH(ph),
    sodio: scoreSodium(na),
    potassio: scorePotassium(k),
    creatinina: scoreCreatinine(cr, ira),
    hematocrito: scoreHematocrit(ht),
    leucocitos: scoreWBC(leuco),
    glasgow: scoreGCS(gcs),
    doencaCronica: scoreChronicHealth(dc),
  };

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const { mortality, risk } = mortalityBand(score);

  return { score, risk, mortality, breakdown };
}

export {
  scoreAge,
  scoreTemperature,
  scoreMAP,
  scoreHR,
  scoreRR,
  scoreOxygenation,
  scorePH,
  scoreSodium,
  scorePotassium,
  scoreCreatinine,
  scoreHematocrit,
  scoreWBC,
  scoreGCS,
  scoreChronicHealth,
  mortalityBand,
};
