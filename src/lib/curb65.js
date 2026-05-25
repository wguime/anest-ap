/**
 * CURB-65 — Community-Acquired Pneumonia Severity Score
 * Lim WS et al. Thorax 2003;58(5):377-82.
 *
 * 5 criteria: Confusion, Urea, Respiratory rate, Blood pressure, Age ≥65.
 * Guides disposition: outpatient vs ward vs ICU.
 */

export function curb65({ confusion, urea, rr, sbp, dbp, age }) {
  let score = 0;
  const breakdown = {};

  breakdown.confusion = !!confusion;
  if (confusion) score++;

  const u = parseFloat(urea);
  breakdown.ureaElevada = Number.isFinite(u) && u > 7;
  if (breakdown.ureaElevada) score++;

  const r = parseFloat(rr);
  breakdown.frElevada = Number.isFinite(r) && r >= 30;
  if (breakdown.frElevada) score++;

  const sys = parseFloat(sbp);
  const dia = parseFloat(dbp);
  breakdown.hipotensao =
    (Number.isFinite(sys) && sys < 90) ||
    (Number.isFinite(dia) && dia <= 60);
  if (breakdown.hipotensao) score++;

  const a = parseFloat(age);
  breakdown.idade65 = Number.isFinite(a) && a >= 65;
  if (breakdown.idade65) score++;

  let risk, disposition, mortality;
  if (score <= 1) {
    risk = 'baixo';
    disposition = 'ambulatorial';
    mortality = score === 0 ? '0.6%' : '2.7%';
  } else if (score === 2) {
    risk = 'medio';
    disposition = 'internacao_curta';
    mortality = '6.8%';
  } else if (score === 3) {
    risk = 'alto';
    disposition = 'internacao_uti';
    mortality = '14%';
  } else {
    risk = 'critico';
    disposition = 'internacao_uti';
    mortality = score === 4 ? '27.8%' : '57.6%';
  }

  return { score, risk, disposition, mortality, breakdown };
}

export function crb65({ confusion, rr, sbp, dbp, age }) {
  return curb65({ confusion, urea: 0, rr, sbp, dbp, age });
}
