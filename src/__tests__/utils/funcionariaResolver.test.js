/**
 * funcionariaResolver — garantia de visibilidade correta:
 *   - Funcionárias listadas (por email) têm acesso garantido.
 *   - Anestesistas/outros roles NÃO veem trocas (a menos que admin/coord).
 *   - Helper resolve por email com fallback robusto.
 */
import { describe, it, expect } from 'vitest';
import { resolveFuncionariaId, isFuncionariaPorEmail } from '../../utils/funcionariaResolver';
import { FUNCIONARIAS_SOBREAVISO } from '../../data/sobreavisoMaterno2026';
import { FUNCIONARIAS_HOSPITAIS } from '../../data/hospitaisTecnicas2026';

describe('funcionariaResolver', () => {
  describe('resolveFuncionariaId', () => {
    it('resolve Marta pelo email exato', () => {
      const id = resolveFuncionariaId({ email: 'martaa0804@gmail.com' }, FUNCIONARIAS_SOBREAVISO);
      expect(id).toBe('marta');
    });

    it('resolve Mari (recém-adicionada) em FUNCIONARIAS_HOSPITAIS', () => {
      const id = resolveFuncionariaId({ email: 'maritania051@gmail.com' }, FUNCIONARIAS_HOSPITAIS);
      expect(id).toBe('mari');
    });

    it('resolve Mari também em FUNCIONARIAS_SOBREAVISO', () => {
      const id = resolveFuncionariaId({ email: 'maritania051@gmail.com' }, FUNCIONARIAS_SOBREAVISO);
      expect(id).toBe('mari');
    });

    it('é case-insensitive', () => {
      const id = resolveFuncionariaId({ email: 'MARTAA0804@GMAIL.COM' }, FUNCIONARIAS_SOBREAVISO);
      expect(id).toBe('marta');
    });

    it('ignora espaços extras', () => {
      const id = resolveFuncionariaId({ email: '  martaa0804@gmail.com  ' }, FUNCIONARIAS_SOBREAVISO);
      expect(id).toBe('marta');
    });

    it('retorna null para email não cadastrado (anestesista)', () => {
      const id = resolveFuncionariaId({ email: 'anestesista@hospital.com' }, FUNCIONARIAS_SOBREAVISO);
      expect(id).toBeNull();
    });

    it('retorna null sem email', () => {
      expect(resolveFuncionariaId({}, FUNCIONARIAS_SOBREAVISO)).toBeNull();
      expect(resolveFuncionariaId(null, FUNCIONARIAS_SOBREAVISO)).toBeNull();
    });
  });

  describe('isFuncionariaPorEmail (gate de visibilidade do card)', () => {
    it('reconhece Marta como funcionária', () => {
      expect(isFuncionariaPorEmail({ email: 'martaa0804@gmail.com' })).toBe(true);
    });

    it('reconhece Mari (em ambas listas)', () => {
      expect(isFuncionariaPorEmail({ email: 'maritania051@gmail.com' })).toBe(true);
    });

    it('reconhece todas as 6 funcionárias do sobreaviso', () => {
      const emails = [
        'martaa0804@gmail.com',
        'renatagracielalucca@gmail.com',
        'lutona3112@hotmail.com',
        'elibelinha3@gmail.com',
        'saionararebelatto@gmail.com',
        'maritania051@gmail.com',
      ];
      emails.forEach((email) => {
        expect(isFuncionariaPorEmail({ email })).toBe(true);
      });
    });

    it('NÃO reconhece anestesista', () => {
      expect(isFuncionariaPorEmail({ email: 'anestesistaguilherme@gmail.com' })).toBe(false);
      expect(isFuncionariaPorEmail({ email: 'wguime@yahoo.com.br' })).toBe(false);
    });

    it('NÃO reconhece email aleatório', () => {
      expect(isFuncionariaPorEmail({ email: 'qualquer@hospital.com' })).toBe(false);
    });

    it('retorna false sem email', () => {
      expect(isFuncionariaPorEmail({})).toBe(false);
      expect(isFuncionariaPorEmail(null)).toBe(false);
    });
  });
});
