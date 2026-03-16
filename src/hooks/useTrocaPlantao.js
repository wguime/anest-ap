/**
 * useTrocaPlantao Hook
 * Hook para gerenciar solicitacoes de troca de plantao
 */
import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { isAdministrator } from '@/design-system/components/anest/admin-only';
import {
  createTradeRequest,
  acceptTrade as acceptTradeService,
  rejectTrade as rejectTradeService,
  cancelTrade as cancelTradeService,
  getPendingTradesForUser,
  subscribeTrades,
} from '../services/trocaPlantaoService';

function isResidente(user) {
  return user?.role === 'medico-residente';
}

export function canManageTrades(user) {
  return isResidente(user) || isAdministrator(user);
}

/**
 * Hook para gerenciar trocas de plantao
 * @returns {Object} - Dados e funcoes para gerenciar trocas
 */
export function useTrocaPlantao() {
  const { user, firebaseUser } = useUser();

  const [trades, setTrades] = useState([]);
  const [pendingTrades, setPendingTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar trocas pendentes disponiveis
  const loadPendingTrades = useCallback(async () => {
    if (!firebaseUser) return;

    try {
      const { trades: pending, error: err } = await getPendingTradesForUser(firebaseUser.uid);
      if (err) {
        console.warn('Erro ao buscar trocas pendentes:', err);
      } else {
        setPendingTrades(pending);
      }
    } catch (err) {
      console.error('Erro ao buscar trocas pendentes:', err);
    }
  }, [firebaseUser]);

  // Inscrever-se para atualizacoes em tempo real + carregar pendentes
  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeTrades(firebaseUser.uid, ({ myTrades, pendingForMe }) => {
      setTrades(myTrades);
      setPendingTrades(pendingForMe);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [firebaseUser, loadPendingTrades]);

  // Criar solicitacao de troca
  const createTrade = useCallback(async ({ dataPlantao, descricao, destinatarioId, destinatarioNome }) => {
    if (!firebaseUser) {
      return { success: false, trade: null, error: 'Usuario nao autenticado' };
    }

    if (!canManageTrades(user)) {
      return { success: false, trade: null, error: 'Apenas residentes podem criar trocas' };
    }

    setError(null);

    const { trade, error: err } = await createTradeRequest({
      solicitanteId: firebaseUser.uid,
      solicitanteNome: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario'),
      solicitanteRole: user?.role || null,
      solicitanteAno: user?.ano || null,
      dataPlantao,
      descricao,
      destinatarioId: destinatarioId || null,
      destinatarioNome: destinatarioNome || null,
    });

    if (err) {
      setError(err);
      return { success: false, trade: null, error: err };
    }

    await loadPendingTrades();
    return { success: true, trade, error: null };
  }, [firebaseUser, user, loadPendingTrades]);

  // Aceitar troca
  const acceptTrade = useCallback(async (codigo) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }

    setError(null);
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario');
    const { success, error: err } = await acceptTradeService(codigo, firebaseUser.uid, userName);

    if (err) {
      setError(err);
      return { success: false, error: err };
    }

    await loadPendingTrades();
    return { success: true, error: null };
  }, [firebaseUser, user, loadPendingTrades]);

  // Rejeitar troca
  const rejectTrade = useCallback(async (codigo) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }

    setError(null);
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario');
    const { success, error: err } = await rejectTradeService(codigo, firebaseUser.uid, userName);

    if (err) {
      setError(err);
      return { success: false, error: err };
    }

    await loadPendingTrades();
    return { success: true, error: null };
  }, [firebaseUser, user, loadPendingTrades]);

  // Cancelar troca
  const cancelTrade = useCallback(async (codigo) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }

    setError(null);
    const { success, error: err } = await cancelTradeService(codigo, firebaseUser.uid);

    if (err) {
      setError(err);
      return { success: false, error: err };
    }

    await loadPendingTrades();
    return { success: true, error: null };
  }, [firebaseUser, loadPendingTrades]);

  // Refresh manual
  const refreshTrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    await loadPendingTrades();
    setLoading(false);
  }, [loadPendingTrades]);

  return {
    trades,
    pendingTrades,
    loading,
    error,
    createTrade,
    acceptTrade,
    rejectTrade,
    cancelTrade,
    refreshTrades,
    canManageTrades: canManageTrades(user),
  };
}

export default useTrocaPlantao;
