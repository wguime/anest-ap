/**
 * useSobreavisoMaterno Hook
 * Gerencia escala de sobreaviso materno: tabela estática + overrides por dia.
 *
 * Rollover do card (recomputado a cada minuto):
 *   00:00-06:59 → ontem
 *   07:00-23:59 → hoje
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  subscribeSobreavisoDiario,
  updateSobreavisoDiario,
} from '../services/sobreavisoMaternoService';
import { toDateKey } from '../data/residencia2026';
import {
  FUNCIONARIAS_SOBREAVISO,
  getSobreavisoParaData,
  getSobreavisoEfetivo,
  getFuncionariaById,
  getHorarioSobreaviso,
} from '../data/sobreavisoMaterno2026';

const TICK_INTERVAL_MS = 60 * 1000;

export function useSobreavisoMaterno() {
  const { user, firebaseUser } = useUser();

  const [effectiveDate, setEffectiveDate] = useState(() => getSobreavisoEfetivo());
  const [override, setOverride] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tick = () => {
      const next = getSobreavisoEfetivo();
      setEffectiveDate((prev) => {
        if (toDateKey(prev) === toDateKey(next)) return prev;
        return next;
      });
    };
    const id = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const currentDateKey = useMemo(() => toDateKey(effectiveDate), [effectiveDate]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = subscribeSobreavisoDiario(
      currentDateKey,
      ({ data, error: err }) => {
        if (err) setError(err);
        else setOverride(data);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [currentDateKey]);

  const sobreaviso = useMemo(() => {
    const base = getSobreavisoParaData(effectiveDate);
    const horario = getHorarioSobreaviso();
    const iso = toDateKey(effectiveDate);
    const [y, mm, dd] = iso.split('-');
    const dataFormatada = `${dd}/${mm}/${y}`;

    if (!base) {
      return {
        funcionaria: null,
        funcionariaId: '',
        data: iso,
        dataFormatada,
        horario: `${horario.inicio} - ${horario.fim}`,
        duracao: horario.duracao,
        hasEscala: false,
      };
    }

    const funcionariaId = override?.funcionariaOverride ?? base.id;
    const f = getFuncionariaById(funcionariaId) || base;
    return {
      funcionaria: { id: f.id, nome: f.nome, cargo: f.cargo },
      funcionariaId: f.id,
      data: iso,
      dataFormatada,
      horario: `${horario.inicio} - ${horario.fim}`,
      duracao: horario.duracao,
      hasEscala: true,
    };
  }, [effectiveDate, override]);

  const cardData = currentDateKey;
  const cardTurno = null;

  const saveSobreaviso = useCallback(
    async (payload) => {
      if (!firebaseUser) return { success: false, error: 'Usuario nao autenticado' };
      setSaving(true);
      try {
        const base = getSobreavisoParaData(effectiveDate);
        const baseId = base?.id;
        const funcionariaId = payload?.funcionariaId;
        const newOverride = funcionariaId && funcionariaId !== baseId ? funcionariaId : null;

        const { success, error: err } = await updateSobreavisoDiario(
          currentDateKey,
          { funcionariaOverride: newOverride, origem: 'manual' },
          firebaseUser.uid
        );
        if (success) {
          setOverride(newOverride ? { funcionariaOverride: newOverride, origem: 'manual' } : null);
          return { success: true, error: null };
        }
        return { success: false, error: err };
      } catch (e) {
        return { success: false, error: e.message };
      } finally {
        setSaving(false);
      }
    },
    [firebaseUser, currentDateKey, effectiveDate]
  );

  const canEdit = useCallback(() => {
    if (!user) return false;
    const roleKey = (user.role || '').toLowerCase();
    if (user.isAdmin || user.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador') {
      return true;
    }
    if (user.permissions && (user.permissions['escalas-edit'] || user.permissions['residencia-edit'])) {
      return true;
    }
    return false;
  }, [user]);

  return {
    sobreaviso,
    funcionarias: FUNCIONARIAS_SOBREAVISO,
    cardData,
    cardTurno,
    loading,
    error,
    saving,
    saveSobreaviso,
    canEdit: canEdit(),
  };
}

export default useSobreavisoMaterno;
