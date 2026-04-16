/**
 * useResidencia Hook
 * Hook para gerenciar dados de estagios e plantao da residencia.
 *
 * Estágios: tabela estática (2026) + overrides/cirurgiões por slot (data+turno)
 * no Firestore `residencia/estagios/estagiosDiarios/{slotKey}`.
 *
 * Slot efetivo é computado do relógio:
 *   00:00-11:59 → hoje · manhã
 *   12:00-18:59 → hoje · tarde
 *   19:00-23:59 → amanhã · manhã (rollover)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  getPlantao,
  updatePlantao,
  subscribePlantao,
} from '../services/residenciaService';
import {
  subscribeEstagiosDiarios,
  updateSlotDiario,
} from '../services/residenciaEstagiosDiariosService';
import {
  RESIDENTES_2026,
  getEstagiosParaData,
  getSlotEfetivo,
  slotKey as computeSlotKey,
  toDateKey,
} from '../data/residencia2026';

const SLOT_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Hook para gerenciar dados da residencia
 */
export function useResidencia() {
  const { user, firebaseUser } = useUser();

  // Slot efetivo (data + turno), recomputado a cada minuto
  const [effectiveSlot, setEffectiveSlot] = useState(() => getSlotEfetivo());

  // Doc diário (cirurgiões + overrides de estágio) do slot atual
  const [slotDoc, setSlotDoc] = useState({ cirurgiaos: {}, estagiosOverride: {} });
  const [estagiosLoading, setEstagiosLoading] = useState(true);
  const [estagiosError, setEstagiosError] = useState(null);

  // Estado do plantao (inalterado)
  const [plantao, setPlantao] = useState({ residente: '', ano: 'R1', data: '', hora: '' });
  const [plantaoCardData, setPlantaoCardData] = useState(null);
  const [plantaoCardTurno, setPlantaoCardTurno] = useState(null);
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

  // Buscar plantao do Firestore (mantido)
  const fetchPlantao = useCallback(async () => {
    setPlantaoLoading(true);
    setPlantaoError(null);

    try {
      const { plantao: data, error } = await getPlantao();
      if (error) {
        setPlantaoError(error);
      } else if (data) {
        setPlantao(data);
      } else {
        setPlantao({ residente: '', ano: 'R1', data: '', hora: '' });
      }
    } catch (err) {
      setPlantaoError(err.message);
    } finally {
      setPlantaoLoading(false);
    }
  }, []);

  // Atualizar slot efetivo a cada minuto (rollover automático 12h/19h)
  useEffect(() => {
    const tick = () => {
      const next = getSlotEfetivo();
      setEffectiveSlot((prev) => {
        if (computeSlotKey(prev) === computeSlotKey(next)) return prev;
        return next;
      });
    };
    const id = setInterval(tick, SLOT_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Subscribe ao slot atual — re-subscrever quando slotKey muda
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

  // Subscribe ao plantao (inalterado)
  useEffect(() => {
    const unsub = subscribePlantao(
      ({ plantao: data, cardData, cardTurno, error }) => {
        if (error) {
          setPlantaoError(error);
        } else if (data) {
          setPlantao(data);
          setPlantaoCardData(cardData);
          setPlantaoCardTurno(cardTurno);
        } else {
          setPlantao({ residente: '', ano: 'R1', data: '', hora: '' });
          setPlantaoCardData(null);
          setPlantaoCardTurno(null);
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
  }, [updateCombinedStatus]);

  // Lista final de residentes: estagio vem da tabela (ou override), cirurgiao do slotDoc
  const residentes = useMemo(() => {
    const base = getEstagiosParaData(effectiveSlot.date);
    return base.map((r) => ({
      ...r,
      estagio: slotDoc.estagiosOverride?.[r.id] ?? r.estagio,
      cirurgiao: slotDoc.cirurgiaos?.[r.id] ?? '',
    }));
  }, [effectiveSlot, slotDoc]);

  // Card header: data ISO + turno do slot
  const estagiosCardData = useMemo(() => toDateKey(effectiveSlot.date), [effectiveSlot]);
  const estagiosCardTurno = effectiveSlot.turno;

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

  // Salvar plantao (inalterado)
  const savePlantao = useCallback(
    async (novoPlantao) => {
      if (!firebaseUser) {
        return { success: false, error: 'Usuario nao autenticado' };
      }
      setSavingPlantao(true);

      try {
        const { success, error } = await updatePlantao(novoPlantao, firebaseUser.uid);
        if (success) {
          const { cardData, cardTurno, ...rest } = novoPlantao;
          setPlantao(rest);
          setPlantaoCardData(cardData || null);
          setPlantaoCardTurno(cardTurno || null);
          return { success: true, error: null };
        }
        return { success: false, error };
      } catch (err) {
        return { success: false, error: err.message };
      } finally {
        setSavingPlantao(false);
      }
    },
    [firebaseUser]
  );

  // Permissao de edicao (inalterada)
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
