/**
 * Sedation & Delirium — RASS + CAM-ICU sequential workflow
 * SCCM 2025 PADIS: Assess RASS first; if RASS >= -3, perform CAM-ICU.
 *
 * Sessler CN et al. Am J Respir Crit Care Med 2002;166(10):1338-44.
 * Ely EW et al. JAMA 2001;286(21):2703-2710.
 */

const RASS_DESCRIPTIONS = {
  4: { label: '+4 Combativo', detail: 'Violento, perigo imediato para equipe' },
  3: { label: '+3 Muito agitado', detail: 'Puxa/remove tubos e cateteres, agressivo' },
  2: { label: '+2 Agitado', detail: 'Movimentos frequentes sem propósito, dessincroniza com ventilador' },
  1: { label: '+1 Inquieto', detail: 'Ansioso, sem movimentos agressivos' },
  0: { label: '0 Alerta e calmo', detail: 'Alvo para maioria dos pacientes de UTI' },
  '-1': { label: '-1 Sonolento', detail: 'Desperta com voz, mantém contato >10s' },
  '-2': { label: '-2 Sedação leve', detail: 'Desperta brevemente com voz, contato <10s' },
  '-3': { label: '-3 Sedação moderada', detail: 'Movimento ou abertura ocular à voz, sem contato visual' },
  '-4': { label: '-4 Sedação profunda', detail: 'Sem resposta à voz, movimento a estímulo físico' },
  '-5': { label: '-5 Não desperta', detail: 'Sem resposta à voz ou estímulo físico' },
};

export function rass(nivel) {
  const n = typeof nivel === 'number' ? nivel : parseInt(nivel, 10);
  if (!Number.isFinite(n) || n < -5 || n > 4) return null;

  const desc = RASS_DESCRIPTIONS[n] || RASS_DESCRIPTIONS[String(n)];
  const canAssessCAM = n >= -3;

  let category;
  if (n >= 1) category = 'agitacao';
  else if (n === 0) category = 'ideal';
  else if (n >= -2) category = 'sedacao_leve';
  else if (n === -3) category = 'sedacao_moderada';
  else category = 'coma';

  let target;
  if (n >= 1) target = 'acima';
  else if (n === 0 || n === -1) target = 'alvo';
  else target = 'abaixo';

  return {
    score: n,
    label: desc.label,
    detail: desc.detail,
    category,
    target,
    canAssessCAM,
  };
}

export function camIcu({ feature1, feature2, feature3, feature4 }) {
  const f1 = !!feature1;
  const f2 = !!feature2;
  const f3 = !!feature3;
  const f4 = !!feature4;

  const positive = f1 && f2 && (f3 || f4);

  return {
    positive,
    features: {
      alteracaoAguda: f1,
      inatencao: f2,
      conscienciaAlterada: f3,
      pensamentoDesorganizado: f4,
    },
  };
}

export function sedationDeliriumPanel(rassScore, camFeatures) {
  const rassResult = rass(rassScore);
  if (!rassResult) return null;

  let camResult = null;
  let overallStatus;

  if (!rassResult.canAssessCAM) {
    overallStatus = rassResult.score === -4 ? 'sedacao_profunda' : 'coma';
  } else if (camFeatures) {
    camResult = camIcu(camFeatures);
    overallStatus = camResult.positive ? 'delirium' : 'sem_delirium';
  } else {
    overallStatus = 'cam_pendente';
  }

  return {
    rass: rassResult,
    cam: camResult,
    overallStatus,
  };
}
