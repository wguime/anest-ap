/**
 * useResidencia Hook
 * Hook para gerenciar dados de estagios e plantao da residencia
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  getEstagios,
  updateEstagios,
  getPlantao,
  updatePlantao,
  subscribeEstagios,
  subscribePlantao,
} from '../services/residenciaService';

/**
 * Hook para gerenciar dados da residencia
 * @returns {Object} - Dados e funcoes para gerenciar residencia
 */
export function useResidencia() {
  const { user, firebaseUser } = useUser();

  // Estado dos estagios
  const [residentes, setResidentes] = useState([]);
  const [estagiosCardData, setEstagiosCardData] = useState(null);
  const [estagiosCardTurno, setEstagiosCardTurno] = useState(null);
  const [estagiosLoading, setEstagiosLoading] = useState(true);
  const [estagiosError, setEstagiosError] = useState(null);

  // Estado do plantao
  const [plantao, setPlantao] = useState({ residente: '', ano: 'R1', data: '', hora: '' });
  const [plantaoCardData, setPlantaoCardData] = useState(null);
  const [plantaoCardTurno, setPlantaoCardTurno] = useState(null);
  const [plantaoLoading, setPlantaoLoading] = useState(true);
  const [plantaoError, setPlantaoError] = useState(null);

  // Connection status tracking ('connected' | 'reconnecting' | 'error')
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const listenerStatuses = useRef({ estagios: 'connected', plantao: 'connected' });

  // Derive combined connection status from both listeners
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

  // Buscar estagios do Firestore
  const fetchEstagios = useCallback(async () => {
    setEstagiosLoading(true);
    setEstagiosError(null);

    try {
      const { residentes: data, error } = await getEstagios();

      if (error) {
        console.warn('Erro ao buscar estagios:', error);
        setEstagiosError(error);
      } else if (data && data.length > 0) {
        setResidentes(data);
      } else {
        // Sem dados no Firestore
        setResidentes([]);
      }
    } catch (err) {
      console.error('Erro ao buscar estagios:', err);
      setEstagiosError(err.message);
    } finally {
      setEstagiosLoading(false);
    }
  }, []);

  // Buscar plantao do Firestore
  const fetchPlantao = useCallback(async () => {
    setPlantaoLoading(true);
    setPlantaoError(null);

    try {
      const { plantao: data, error } = await getPlantao();

      if (error) {
        console.warn('Erro ao buscar plantao:', error);
        setPlantaoError(error);
      } else if (data) {
        setPlantao(data);
      } else {
        // Sem dados no Firestore
        setPlantao({ residente: '', ano: 'R1', data: '', hora: '' });
      }
    } catch (err) {
      console.error('Erro ao buscar plantao:', err);
      setPlantaoError(err.message);
    } finally {
      setPlantaoLoading(false);
    }
  }, []);

  // Carregar dados na montagem com real-time listeners
  useEffect(() => {
    // Use real-time listeners for automatic sync
    const unsubEstagios = subscribeEstagios(
      ({ residentes: data, cardData, cardTurno, error }) => {
        if (error) {
          setEstagiosError(error);
        } else {
          setResidentes(data);
          setEstagiosCardData(cardData);
          setEstagiosCardTurno(cardTurno);
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

    const unsubPlantao = subscribePlantao(
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

    return () => {
      unsubEstagios();
      unsubPlantao();
    };
  }, [updateCombinedStatus]);

  // Salvar estagios
  const saveEstagios = useCallback(async (payload) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }

    setSavingEstagios(true);

    try {
      const { success, error } = await updateEstagios(payload, firebaseUser.uid);

      if (success) {
        setResidentes(payload.residentes);
        setEstagiosCardData(payload.cardData || null);
        setEstagiosCardTurno(payload.cardTurno || null);
        return { success: true, error: null };
      } else {
        return { success: false, error };
      }
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSavingEstagios(false);
    }
  }, [firebaseUser]);

  // Salvar plantao
  const savePlantao = useCallback(async (novoPlantao) => {
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
      } else {
        return { success: false, error };
      }
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setSavingPlantao(false);
    }
  }, [firebaseUser]);

  // Verificar permissao de edicao
  const canEdit = useCallback(() => {
    if (!user) return false;

    // Admin tem permissao
    const roleKey = (user.role || '').toLowerCase();
    if (user.isAdmin || user.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador') {
      return true;
    }

    // Verificar permissao especifica
    if (user.permissions && user.permissions['residencia-edit']) {
      return true;
    }

    return false;
  }, [user]);

  // Buscar plantao por data
  const getPlantaoByDate = useCallback((dateInput) => {
    if (!plantao) return null;
    // dateInput can be Date object or string
    // Compare against plantao.data (format: "Quarta, 05 Fev")
    // Also try to match against a normalized date format
    // Since plantao is a single document with { residente, ano, data, hora },
    // just return it if it matches, null otherwise
    // For now, return plantao data as-is since we have a single plantao record
    return plantao;
  }, [plantao]);

  // Buscar estagio por nome do residente
  const getEstagioByResidente = useCallback((nome) => {
    if (!nome || !residentes.length) return null;
    const normalizado = nome.toLowerCase().trim();
    return residentes.find(r =>
      r.nome && r.nome.toLowerCase().includes(normalizado)
    ) || null;
  }, [residentes]);

  return {
    // Dados dos estagios
    residentes,
    estagiosCardData,
    estagiosCardTurno,
    estagiosLoading,
    estagiosError,
    fetchEstagios,
    saveEstagios,
    savingEstagios,

    // Dados do plantao
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

    // Helpers de consulta
    getPlantaoByDate,
    getEstagioByResidente,

    // Connection status ('connected' | 'reconnecting' | 'error')
    connectionStatus,

    // Loading geral
    loading: estagiosLoading || plantaoLoading,
  };
}

export default useResidencia;
