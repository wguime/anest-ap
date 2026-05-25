/**
 * ROX Index — Ratio of Oxygen saturation to respiratory rate
 * Roca O et al. J Crit Care 2016;35:200-5.
 * Roca O et al. Chest 2019;156(4):727-33.
 *
 * ROX = (SpO2 / FiO2) / FR
 * Predicts HFNC (high-flow nasal cannula) failure → need for intubation.
 *
 * Cutoffs at 2h, 6h, 12h:
 *   ≥ 4.88 → low risk of intubation
 *   < 3.85 → high risk of HFNC failure
 *   3.85-4.88 → intermediate, reassess
 */

export function roxIndex({ spo2, fio2, fr }) {
  const s = parseFloat(spo2);
  const f = parseFloat(fio2);
  const r = parseFloat(fr);

  if (!Number.isFinite(s) || !Number.isFinite(f) || !Number.isFinite(r)) {
    return null;
  }
  if (f <= 0 || r <= 0) return null;

  const fio2Decimal = f > 1 ? f / 100 : f;
  const rox = (s / fio2Decimal) / r;
  const rounded = Math.round(rox * 100) / 100;

  let risk, interpretation;
  if (rounded >= 4.88) {
    risk = 'baixo';
    interpretation = 'Baixo risco de falha da CNAF — manter terapia';
  } else if (rounded >= 3.85) {
    risk = 'medio';
    interpretation = 'Risco intermediário — reavaliar em 1-2h';
  } else {
    risk = 'alto';
    interpretation = 'Alto risco de falha da CNAF — considerar intubação';
  }

  return { rox: rounded, risk, interpretation };
}
