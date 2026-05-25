import { describe, it, expect } from 'vitest';
import { rass, camIcu, sedationDeliriumPanel } from '../../lib/sedationDelirium';

describe('rass', () => {
  it('returns null for out of range', () => {
    expect(rass(5)).toBeNull();
    expect(rass(-6)).toBeNull();
    expect(rass(NaN)).toBeNull();
  });

  it('classifies agitation levels', () => {
    expect(rass(4).category).toBe('agitacao');
    expect(rass(3).category).toBe('agitacao');
    expect(rass(2).category).toBe('agitacao');
    expect(rass(1).category).toBe('agitacao');
  });

  it('classifies ideal level', () => {
    expect(rass(0).category).toBe('ideal');
    expect(rass(0).target).toBe('alvo');
  });

  it('classifies sedation levels', () => {
    expect(rass(-1).category).toBe('sedacao_leve');
    expect(rass(-2).category).toBe('sedacao_leve');
    expect(rass(-3).category).toBe('sedacao_moderada');
    expect(rass(-4).category).toBe('coma');
    expect(rass(-5).category).toBe('coma');
  });

  it('marks CAM-ICU assessability at RASS >= -3', () => {
    expect(rass(-3).canAssessCAM).toBe(true);
    expect(rass(-2).canAssessCAM).toBe(true);
    expect(rass(0).canAssessCAM).toBe(true);
    expect(rass(4).canAssessCAM).toBe(true);
    expect(rass(-4).canAssessCAM).toBe(false);
    expect(rass(-5).canAssessCAM).toBe(false);
  });

  it('identifies target range (0 to -1)', () => {
    expect(rass(0).target).toBe('alvo');
    expect(rass(-1).target).toBe('alvo');
    expect(rass(1).target).toBe('acima');
    expect(rass(-2).target).toBe('abaixo');
  });

  it('includes label and detail', () => {
    const r = rass(0);
    expect(r.label).toBe('0 Alerta e calmo');
    expect(r.detail).toContain('Alvo');
  });

  it('accepts string input', () => {
    expect(rass('-2').score).toBe(-2);
    expect(rass('3').score).toBe(3);
  });
});

describe('camIcu', () => {
  it('detects delirium: F1 + F2 + F3', () => {
    const result = camIcu({
      feature1: true, feature2: true, feature3: true, feature4: false,
    });
    expect(result.positive).toBe(true);
  });

  it('detects delirium: F1 + F2 + F4', () => {
    const result = camIcu({
      feature1: true, feature2: true, feature3: false, feature4: true,
    });
    expect(result.positive).toBe(true);
  });

  it('detects delirium: F1 + F2 + F3 + F4', () => {
    const result = camIcu({
      feature1: true, feature2: true, feature3: true, feature4: true,
    });
    expect(result.positive).toBe(true);
  });

  it('no delirium: missing F1', () => {
    const result = camIcu({
      feature1: false, feature2: true, feature3: true, feature4: true,
    });
    expect(result.positive).toBe(false);
  });

  it('no delirium: missing F2', () => {
    const result = camIcu({
      feature1: true, feature2: false, feature3: true, feature4: true,
    });
    expect(result.positive).toBe(false);
  });

  it('no delirium: missing both F3 and F4', () => {
    const result = camIcu({
      feature1: true, feature2: true, feature3: false, feature4: false,
    });
    expect(result.positive).toBe(false);
  });

  it('no delirium: all false', () => {
    const result = camIcu({
      feature1: false, feature2: false, feature3: false, feature4: false,
    });
    expect(result.positive).toBe(false);
  });
});

describe('sedationDeliriumPanel', () => {
  it('returns null for invalid RASS', () => {
    expect(sedationDeliriumPanel(6, null)).toBeNull();
  });

  it('returns coma status for RASS -5', () => {
    const result = sedationDeliriumPanel(-5, null);
    expect(result.overallStatus).toBe('coma');
    expect(result.cam).toBeNull();
  });

  it('returns sedacao_profunda for RASS -4', () => {
    const result = sedationDeliriumPanel(-4, null);
    expect(result.overallStatus).toBe('sedacao_profunda');
    expect(result.cam).toBeNull();
  });

  it('returns cam_pendente when RASS >= -3 but no CAM features', () => {
    const result = sedationDeliriumPanel(0, null);
    expect(result.overallStatus).toBe('cam_pendente');
    expect(result.rass.score).toBe(0);
    expect(result.cam).toBeNull();
  });

  it('returns delirium when RASS >= -3 and CAM positive', () => {
    const result = sedationDeliriumPanel(-1, {
      feature1: true, feature2: true, feature3: true, feature4: false,
    });
    expect(result.overallStatus).toBe('delirium');
    expect(result.cam.positive).toBe(true);
  });

  it('returns sem_delirium when RASS >= -3 and CAM negative', () => {
    const result = sedationDeliriumPanel(0, {
      feature1: false, feature2: false, feature3: false, feature4: false,
    });
    expect(result.overallStatus).toBe('sem_delirium');
    expect(result.cam.positive).toBe(false);
  });
});
