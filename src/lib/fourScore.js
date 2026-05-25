/**
 * FOUR Score — Full Outline of UnResponsiveness
 * Wijdicks EFM et al. Ann Neurol 2005;58(4):585-93.
 *
 * Superior to GCS for intubated patients (no verbal component).
 * 4 components × 0-4 = total 0-16. Better inter-rater reliability than GCS.
 */

const DESCRIPTIONS = {
  eye: [
    'E0: Pálpebras permanecem fechadas com dor',
    'E1: Pálpebras fechadas, abrem com dor',
    'E2: Pálpebras fechadas, abrem com voz alta',
    'E3: Pálpebras abertas mas sem rastreamento',
    'E4: Pálpebras abertas, rastreia ou pisca ao comando',
  ],
  motor: [
    'M0: Sem resposta à dor ou mioclonias generalizadas',
    'M1: Resposta extensora (descerebração)',
    'M2: Resposta flexora (decorticação)',
    'M3: Localiza dor',
    'M4: Sinal de polegar para cima, punho ou sinal de paz',
  ],
  brainstem: [
    'B0: Reflexo pupilar e corneano ausentes',
    'B1: Reflexo pupilar E corneano ausentes',
    'B2: Reflexo pupilar OU corneano ausente',
    'B3: Uma pupila fixa e dilatada',
    'B4: Reflexos pupilar e corneano presentes',
  ],
  respiration: [
    'R0: Apneia ou respiração em ventilador',
    'R1: Frequência acima do ventilador',
    'R2: Não intubado, padrão respiratório irregular',
    'R3: Não intubado, padrão Cheyne-Stokes',
    'R4: Não intubado, padrão respiratório regular',
  ],
};

function clamp04(v) {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(4, n));
}

export function fourScore({ eye, motor, brainstem, respiration }) {
  const e = clamp04(eye);
  const m = clamp04(motor);
  const b = clamp04(brainstem);
  const r = clamp04(respiration);

  const total = e + m + b + r;

  let prognosis;
  if (total === 0) prognosis = 'morte_encefalica_possivel';
  else if (total <= 4) prognosis = 'prognostico_reservado';
  else if (total <= 8) prognosis = 'disfuncao_grave';
  else if (total <= 12) prognosis = 'disfuncao_moderada';
  else prognosis = 'bom_prognostico';

  let risk;
  if (total <= 4) risk = 'critico';
  else if (total <= 8) risk = 'alto';
  else if (total <= 12) risk = 'medio';
  else risk = 'baixo';

  return {
    total,
    risk,
    prognosis,
    components: {
      eye: { score: e, description: DESCRIPTIONS.eye[e] },
      motor: { score: m, description: DESCRIPTIONS.motor[m] },
      brainstem: { score: b, description: DESCRIPTIONS.brainstem[b] },
      respiration: { score: r, description: DESCRIPTIONS.respiration[r] },
    },
  };
}
