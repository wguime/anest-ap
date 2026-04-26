/**
 * useResidencia Hook
 * Hook para gerenciar dados de estagios e plantao da residencia.
 *
 * Estágios: tabela estática (2026) + overrides/cirurgiões por slot (data+turno)
 * no Firestore `residenciaEstagiosDiarios/{slotKey}`.
 *
 * Plantão: tabela estática (2026) + override por dia no Firestore
 * `residenciaPlantaoDiario/{YYYY-MM-DD}`. Rollover do card às 07h.
 *
 * Slot efetivo de estágios (recomputado a cada minuto):
 *   00:00-10:59 → hoje · manhã
 *   11:00-17:59 → hoje · tarde
 *   18:00-23:59 → amanhã · manhã (rollover)
 *   Em FDS/feriados → próximo dia útil · manhã (durante todo o dia)
 *
 * Slot efetivo de plantão (recomputado a cada minuto):
 *   00:00-06:59 → ontem
 *   07:00-23:59 → hoje
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  subscribeEstagiosDiarios,
  updateSlotDiario,
} from '../services/residenciaEstagiosDiariosService';
import {
  subscribePlantaoDiario,
  updatePlantaoDiario,
} from '../services/residenciaPlantaoDiarioService';
import {
  RESIDENTES_2026,
  getEstagiosParaData,
  getSlotEfetivo,
  getEscalaCardDate,
  slotKey as computeSlotKey,
  toDateKey,
} from '../data/residencia2026';
import {
  getPlantaoParaData,
  getPlantaoEfetivo,
  FERIADOS_2026,
} from '../data/plantao2026';

const SLOT_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Hook para gerenciar dados da residencia
 */
export function useResidencia() {
  const { user, firebaseUser } = useUser();

  // Slot efetivo de estágios (data + turno), recomputado a cada minuto.
  // Em FDS/feriados aponta para o próximo dia útil · manhã (usado APENAS pelo card Estágios).
  const [effectiveSlot, setEffectiveSlot] = useState(() => getSlotEfetivo(new Date(), FERIADOS_2026));
  // Data efetiva sem salto FDS/feriado — só rollover 18h. Usada por Técnicas/Secretárias.
  const [escalaCardDate, setEscalaCardDate] = useState(() => toDateKey(getEscalaCardDate(new Date())));
  // Data efetiva do plantão (meia-noite), recomputada a cada minuto
  const [effectivePlantaoDate, setEffectivePlantaoDate] = useState(() => getPlantaoEfetivo());
  // Sábado real (não data efetiva) — usado para ocultar o card de Estágios apenas no sábado.
  const [isHojeSabado, setIsHojeSabado] = useState(() => new Date().getDay() === 6);

  // Doc diário de estágios (cirurgiões + overrides)
  const [slotDoc, setSlotDoc] = useState({ cirurgiaos: {}, estagiosOverride: {} });
  const [estagiosLoading, setEstagiosLoading] = useState(true);
  const [estagiosError, setEstagiosError] = useState(null);

  // Override do plantão do dia atual (null = sem override, usa tabela)
  const [plantaoOverride, setPlantaoOverride] = useState(null);
  const [plantaoLoading, setPlantaoLoading] = useState(true);
  const [plantaoError, setPlantaoError] = useState(null);

  // Connection status tracking
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const listenerStatuses = useRef({ estagios: 'connected', plantao: 'connected' });

  const updateCombinedStatus = useCallback(() => {
    const { estagios, plantao } = listenerStatuses.current;
    if (estagios === 'error' || plantao === 'error') {
      setConnectionStatus('error');
    } else if (estagios === 'reconnecting' || plantao === 'reconnecting') {
      setConnectionStatus('reconnecting');
    } else {
      setConnectionStatus('connected');
    }
  }, []);

  // Estado de salvamento
  const [savingEstagios, setSavingEstagios] = useState(false);
  const [savingPlantao, setSavingPlantao] = useState(false);

  // Tick único que atualiza ambos os slots
  useEffect(() => {
    const tick = () => {
      const nextSlot = getSlotEfetivo(new Date(), FERIADOS_2026);
      setEffectiveSlot((prev) => {
        if (computeSlotKey(prev) === computeSlotKey(nextSlot)) return prev;
        return nextSlot;
      });
      const nextEscalaCardDate = toDateKey(getEscalaCardDate(new Date()));
      setEscalaCardDate((prev) => (prev === nextEscalaCardDate ? prev : nextEscalaCardDate));
      const nextPlantao = getPlantaoEfetivo();
      setEffectivePlantaoDate((prev) => {
        if (toDateKey(prev) === toDateKey(nextPlantao)) return prev;
        return nextPlantao;
      });
      setIsHojeSabado((prev) => {
        const next = new Date().getDay() === 6;
        return prev === next ? prev : next;
      });
    };
    const id = setInterval(tick, SLOT_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Subscribe ao slot de estágios — re-subscrever quando slotKey muda
  const currentSlotKey = useMemo(() => computeSlotKey(effectiveSlot), [effectiveSlot]);

  useEffect(() => {
    setEstagiosLoading(true);
    setEstagiosError(null);

    const unsub = subscribeEstagiosDiarios(
      currentSlotKey,
      ({ cirurgiaos, estagiosOverride, error }) => {
        if (error) {
          setEstagiosError(error);
        } else {
          setSlotDoc({ cirurgiaos, estagiosOverride });
        }
        setEstagiosLoading(false);
      },
      {
        onStatusChange: (status) => {
          listenerStatuses.current.estagios = status;
          updateCombinedStatus();
        },
      }
    );

    return () => unsub();
  }, [currentSlotKey, updateCombinedStatus]);

  // Subscribe ao plantão diário — re-subscrever quando a data muda
  const currentPlantaoDateKey = useMemo(
    () => toDateKey(effectivePlantaoDate),
    [effectivePlantaoDate]
  );

  useEffect(() => {
    setPlantaoLoading(true);
    setPlantaoError(null);

    const unsub = subscribePlantaoDiario(
      currentPlantaoDateKey,
      ({ data, error }) => {
        if (error) {
          setPlantaoError(error);
        } else {
          setPlantaoOverride(data);
        }
        setPlantaoLoading(false);
      },
      {
        onStatusChange: (status) => {
          listenerStatuses.current.plantao = status;
          updateCombinedStatus();
        },
      }
    );
    return () => unsub();
  }, [currentPlantaoDateKey, updateCombinedStatus]);

  // Lista final de residentes (estágios): estagio vem da tabela (ou override), cirurgiao do slotDoc
  const residentes = useMemo(() => {
    const base = getEstagiosParaData(effectiveSlot.date);
    return base.map((r) => ({
      ...r,
      estagio: slotDoc.estagiosOverride?.[r.id] ?? r.estagio,
      cirurgiao: slotDoc.cirurgiaos?.[r.id] ?? '',
    }));
  }, [effectiveSlot, slotDoc]);

  // Card header de estágios: data ISO + turno do slot
  const estagiosCardData = useMemo(() => toDateKey(effectiveSlot.date), [effectiveSlot]);
  const estagiosCardTurno = effectiveSlot.turno;

  // Plantão efetivo: base da tabela + override (se existir)
  const plantao = useMemo(() => {
    const base = getPlantaoParaData(effectivePlantaoDate);
    if (!base) {
      return { residente: '', ano: 'R1', data: '', dataFormatada: '', hora: '', residenteId: '', duracao: 0 };
    }
    const residenteId = plantaoOverride?.residenteOverride ?? base.id;
    const r = RESIDENTES_2026.find((x) => x.id === residenteId) || base;
    const h = base.horario;
    const iso = toDateKey(effectivePlantaoDate);
    const [y, mm, dd] = iso.split('-');
    return {
      residente: r.nome,
      ano: r.ano,
      residenteId: r.id,
      data: iso,
      dataFormatada: `${dd}/${mm}/${y}`,
      hora: `${h.inicio} - ${h.fim}`,
      duracao: h.duracao,
    };
  }, [effectivePlantaoDate, plantaoOverride]);

  const plantaoCardData = useMemo(() => toDateKey(effectivePlantaoDate), [effectivePlantaoDate]);
  const plantaoCardTurno = null;

  // Salvar estagios (cirurgiões + overrides). Remove entradas iguais à tabela.
  const saveEstagios = useCallback(
    async (payload) => {
      if (!firebaseUser) {
        return { success: false, error: 'Usuario nao autenticado' };
      }
      setSavingEstagios(true);

      try {
        const baseEstagios = Object.fromEntries(
          getEstagiosParaData(effectiveSlot.date).map((r) => [r.id, r.estagio])
        );

        const cleanedCirurgiaos = {};
        for (const [id, v] of Object.entries(payload.cirurgiaos || {})) {
          const trimmed = (v || '').trim();
          if (trimmed) cleanedCirurgiaos[id] = trimmed;
        }

        const cleanedOverride = {};
        for (const [id, v] of Object.entries(payload.estagiosOverride || {})) {
          const trimmed = (v || '').trim();
          if (trimmed && trimmed !== baseEstagios[id]) {
            cleanedOverride[id] = trimmed;
          }
        }

        const { success, error } = await updateSlotDiario(
          currentSlotKey,
          { cirurgiaos: cleanedCirurgiaos, estagiosOverride: cleanedOverride },
          firebaseUser.uid
        );

        if (success) {
          setSlotDoc({ cirurgiaos: cleanedCirurgiaos, estagiosOverride: cleanedOverride });
          return { success: true, error: null };
        }
        return { success: false, error };
      } catch (err) {
        return { success: false, error: err.message };
      } finally {
        setSavingEstagios(false);
      }
    },
    [firebaseUser, effectiveSlot, currentSlotKey]
  );

  /**
   * Salvar plantão do dia. Payload: { residenteId }.
   * Se residenteId === base (da tabela), remove o override.
   */
  const savePlantao = useCallback(
    async (payload) => {
      if (!firebaseUser) {
        return { success: false, error: 'Usuario nao autenticado' };
      }
      setSavingPlantao(true);

      try {
        const dateKey = currentPlantaoDateKey;
        const base = getPlantaoParaData(effectivePlantaoDate);
        const baseId = base?.id;
        const residenteId = payload?.residenteId;

        const override = residenteId && residenteId !== baseId ? residenteId : null;

        const { success, error } = await updatePlantaoDiario(
          dateKey,
          { residenteOverride: override, origem: 'manual' },
          firebaseUser.uid
        );
        if (success) {
          if (!override) {
            setPlantaoOverride(null);
          } else {
            setPlantaoOverride({ residenteOverride: override, origem: 'manual' });
          }
          return { success: true, error: null };
        }
        return { success: false, error };
      } catch (err) {
        return { success: false, error: err.message };
      } finally {
        setSavingPlantao(false);
      }
    },
    [firebaseUser, currentPlantaoDateKey, effectivePlantaoDate]
  );

  // Permissao de edicao
  const canEdit = useCallback(() => {
    if (!user) return false;
    const roleKey = (user.role || '').toLowerCase();
    if (user.isAdmin || user.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador') {
      return true;
    }
    if (user.permissions && user.permissions['residencia-edit']) {
      return true;
    }
    return false;
  }, [user]);

  // Helpers mantidos para compatibilidade com páginas existentes
  const getPlantaoByDate = useCallback(() => plantao || null, [plantao]);

  const getEstagioByResidente = useCallback(
    (nome) => {
      if (!nome) return null;
      const alvo = nome.toLowerCase().trim();
      return (
        residentes.find((r) => r.nome && r.nome.toLowerCase().includes(alvo)) || null
      );
    },
    [residentes]
  );

  // Stub para compat: o plantão agora é sempre derivado do tick, não há fetch manual
  const fetchPlantao = useCallback(async () => {}, []);

  return {
    // Estágios
    residentes,
    residentesBase: RESIDENTES_2026,
    effectiveSlot,
    estagiosCardData,
    estagiosCardTurno,
    estagiosLoading,
    estagiosError,
    saveEstagios,
    savingEstagios,
    slotDoc,
    isHojeSabado,
    escalaCardData: escalaCardDate,

    // Plantao
    plantao,
    plantaoCardData,
    plantaoCardTurno,
    plantaoLoading,
    plantaoError,
    fetchPlantao,
    savePlantao,
    savingPlantao,

    // Permissoes
    canEdit: canEdit(),

    // Helpers
    getPlantaoByDate,
    getEstagioByResidente,

    // Status
    connectionStatus,
    loading: estagiosLoading || plantaoLoading,
  };
}

export default useResidencia;
