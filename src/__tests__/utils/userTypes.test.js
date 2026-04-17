import { describe, it, expect } from 'vitest';
import { normalizeRole, ROLE_ALIASES, TIPOS_USUARIO, ROLES } from '@/utils/userTypes';

describe('normalizeRole', () => {
  it('retorna null para valores falsy', () => {
    expect(normalizeRole(null)).toBe(null);
    expect(normalizeRole(undefined)).toBe(null);
    expect(normalizeRole('')).toBe(null);
  });

  it('retorna a chave canônica se já for válida', () => {
    expect(normalizeRole('anestesiologista')).toBe('anestesiologista');
    expect(normalizeRole('medico-residente')).toBe('medico-residente');
    expect(normalizeRole('enfermeiro')).toBe('enfermeiro');
    expect(normalizeRole('tec-enfermagem')).toBe('tec-enfermagem');
    expect(normalizeRole('farmaceutico')).toBe('farmaceutico');
    expect(normalizeRole('colaborador')).toBe('colaborador');
    expect(normalizeRole('secretaria')).toBe('secretaria');
  });

  it('mapeia aliases legados de anestesiologista', () => {
    expect(normalizeRole('medico')).toBe('anestesiologista');
    expect(normalizeRole('médico')).toBe('anestesiologista');
    expect(normalizeRole('anestesista')).toBe('anestesiologista');
    expect(normalizeRole('medico anestesista')).toBe('anestesiologista');
    expect(normalizeRole('médico anestesista')).toBe('anestesiologista');
    expect(normalizeRole('medico-staff')).toBe('anestesiologista');
  });

  it('mapeia aliases de residente', () => {
    expect(normalizeRole('residente')).toBe('medico-residente');
    expect(normalizeRole('médico residente')).toBe('medico-residente');
    expect(normalizeRole('medico residente')).toBe('medico-residente');
  });

  it('mapeia aliases de técnico em enfermagem', () => {
    expect(normalizeRole('tecnico')).toBe('tec-enfermagem');
    expect(normalizeRole('técnico')).toBe('tec-enfermagem');
    expect(normalizeRole('tecnico_enfermagem')).toBe('tec-enfermagem');
    expect(normalizeRole('tecnico enfermagem')).toBe('tec-enfermagem');
    expect(normalizeRole('técnico enfermagem')).toBe('tec-enfermagem');
    expect(normalizeRole('téc. enfermagem')).toBe('tec-enfermagem');
    expect(normalizeRole('tec. enfermagem')).toBe('tec-enfermagem');
    expect(normalizeRole('tecnico-auxiliar')).toBe('tec-enfermagem');
  });

  it('mapeia aliases de secretária e farmacêutico', () => {
    expect(normalizeRole('secretária')).toBe('secretaria');
    expect(normalizeRole('farmacêutico')).toBe('farmaceutico');
  });

  it('mapeia administrativo → colaborador', () => {
    expect(normalizeRole('administrativo')).toBe('colaborador');
  });

  it('é case-insensitive e ignora espaços nas bordas', () => {
    expect(normalizeRole('ANESTESIOLOGISTA')).toBe('anestesiologista');
    expect(normalizeRole('  Medico  ')).toBe('anestesiologista');
    expect(normalizeRole('MÉDICO RESIDENTE')).toBe('medico-residente');
  });

  it('reconhece labels em vez de chaves', () => {
    expect(normalizeRole('Anestesiologista')).toBe('anestesiologista');
    expect(normalizeRole('Médico Residente')).toBe('medico-residente');
    expect(normalizeRole('Enfermeiro')).toBe('enfermeiro');
    expect(normalizeRole('Téc. Enfermagem')).toBe('tec-enfermagem');
  });

  it('retorna null para roles desconhecidos', () => {
    expect(normalizeRole('xpto')).toBe(null);
    expect(normalizeRole('diretor-geral')).toBe(null);
  });

  it('ROLE_ALIASES mapeia apenas para chaves válidas de TIPOS_USUARIO', () => {
    Object.values(ROLE_ALIASES).forEach((canonical) => {
      expect(TIPOS_USUARIO).toHaveProperty(canonical);
    });
  });

  it('todas as chaves de ROLES são reconhecidas por normalizeRole', () => {
    ROLES.forEach(({ id }) => {
      expect(normalizeRole(id)).toBe(id);
    });
  });
});

describe('filterByUserRole (paridade com ReunioesPage)', () => {
  // Replica a lógica de ReunioesPage.jsx:filterByUserRole para garantir
  // regressão no caso do bug de visualização de reuniões.
  const filterByUserRole = (reunioes, user) => {
    if (!user) return reunioes;
    if (user.isAdmin || user.isCoordenador) return reunioes;
    const canonicalRole = normalizeRole(user.role);
    return reunioes.filter((r) => {
      if (!r.destinatariosTipos || r.destinatariosTipos.length === 0) return true;
      if (!canonicalRole) return true;
      const targets = r.destinatariosTipos.map(normalizeRole).filter(Boolean);
      return targets.includes(canonicalRole);
    });
  };

  const reunioes = [
    { id: 1, destinatariosTipos: ['anestesiologista'] },
    { id: 2, destinatariosTipos: ['medico-residente'] },
    { id: 3, destinatariosTipos: [] },
    { id: 4 },
    { id: 5, destinatariosTipos: ['enfermeiro', 'tec-enfermagem'] },
  ];

  it('admin vê todas', () => {
    const result = filterByUserRole(reunioes, { isAdmin: true, role: 'anestesiologista' });
    expect(result).toHaveLength(5);
  });

  it('coordenador vê todas', () => {
    const result = filterByUserRole(reunioes, { isCoordenador: true, role: 'anestesiologista' });
    expect(result).toHaveLength(5);
  });

  it('usuário com role legado "medico" vê reuniões destinadas a anestesiologista (bug reportado)', () => {
    const result = filterByUserRole(reunioes, { role: 'medico' });
    expect(result.map((r) => r.id)).toEqual([1, 3, 4]);
  });

  it('usuário com role legado "residente" vê reuniões de medico-residente', () => {
    const result = filterByUserRole(reunioes, { role: 'residente' });
    expect(result.map((r) => r.id)).toEqual([2, 3, 4]);
  });

  it('usuário com role em label "Anestesiologista" vê reuniões de anestesiologista', () => {
    const result = filterByUserRole(reunioes, { role: 'Anestesiologista' });
    expect(result.map((r) => r.id)).toEqual([1, 3, 4]);
  });

  it('usuário com role undefined faz fail-open (vê todas as reuniões filtradas)', () => {
    const result = filterByUserRole(reunioes, { role: undefined });
    expect(result).toHaveLength(5);
  });

  it('reuniões sem destinatariosTipos aparecem para todos os roles', () => {
    const apenasSemDestinatarios = [{ id: 3, destinatariosTipos: [] }, { id: 4 }];
    const result = filterByUserRole(apenasSemDestinatarios, { role: 'enfermeiro' });
    expect(result).toHaveLength(2);
  });

  it('enfermeiro vê reunião multi-destinatário [enfermeiro, tec-enfermagem]', () => {
    const result = filterByUserRole(reunioes, { role: 'enfermeiro' });
    expect(result.map((r) => r.id)).toEqual([3, 4, 5]);
  });

  it('usuário com role xpto (desconhecido) faz fail-open', () => {
    const result = filterByUserRole(reunioes, { role: 'xpto' });
    expect(result).toHaveLength(5);
  });

  it('destinatariosTipos com valor legado é normalizado (reunião antiga criada com "medico")', () => {
    const reuniaoLegada = [{ id: 1, destinatariosTipos: ['medico'] }];
    const result = filterByUserRole(reuniaoLegada, { role: 'anestesiologista' });
    expect(result).toHaveLength(1);
  });
});
