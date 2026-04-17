/**
 * useTrocaPlantao Hook
 * Hook para gerenciar solicitacoes de troca de plantao.
 *
 * Resolve o residenteId do usuário logado via match de nome em
 * RESIDENTES_2026, necessário para aplicar overrides na escala.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import { isAdministrator } from '@/design-system/components/anest/admin-only';
import { RESIDENTES_2026 } from '../data/residencia2026';
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

function resolveResidenteId(user) {
  const first = (user?.firstName || '').toLowerCase().trim();
  if (!first) return null;
  const match = RESIDENTES_2026.find((r) => r.nome.toLowerCase() === first);
  return match?.id || null;
}

export function useTrocaPlantao() {
  const { user, firebaseUser } = useUser();

  const userResidenteId = useMemo(() => resolveResidenteId(user), [user]);

  const [trades, setTrades] = useState([]);
  const [pendingTrades, setPendingTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPendingTrades = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const { trades: pending, error: err } = await getPendingTradesForUser(firebaseUser.uid, userResidenteId);
      if (err) {
        console.warn('Erro ao buscar trocas pendentes:', err);
      } else {
        setPendingTrades(pending);
      }
    } catch (err) {
      console.error('Erro ao buscar trocas pendentes:', err);
    }
  }, [firebaseUser, userResidenteId]);

  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeTrades(firebaseUser.uid, userResidenteId, ({ myTrades, pendingForMe }) => {
      setTrades(myTrades);
      setPendingTrades(pendingForMe);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [firebaseUser, userResidenteId]);

  const createTrade = useCallback(async ({ dataPlantao, dataDesejada, descricao, destinatarioId, destinatarioNome }) => {
    if (!firebaseUser) {
      return { success: false, trade: null, error: 'Usuario nao autenticado' };
    }
    if (!canManageTrades(user)) {
      return { success: false, trade: null, error: 'Apenas residentes podem criar trocas' };
    }
    if (!userResidenteId) {
      return { success: false, trade: null, error: 'Residente não identificado na escala' };
    }

    setError(null);

    const { trade, error: err } = await createTradeRequest({
      solicitanteId: firebaseUser.uid,
      solicitanteNome: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario'),
      solicitanteRole: user?.role || null,
      solicitanteAno: user?.ano || null,
      solicitanteResidenteId: userResidenteId,
      dataPlantao,
      dataDesejada: dataDesejada || null,
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
  }, [firebaseUser, user, userResidenteId, loadPendingTrades]);

  const acceptTrade = useCallback(async (codigo) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }
    if (!userResidenteId) {
      return { success: false, error: 'Residente aceitador não identificado na escala' };
    }

    setError(null);
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario');
    const { success, error: err } = await acceptTradeService(codigo, firebaseUser.uid, userName, userResidenteId);

    if (err) {
      setError(err);
      return { success: false, error: err };
    }

    await loadPendingTrades();
    return { success: true, error: null };
  }, [firebaseUser, user, userResidenteId, loadPendingTrades]);

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
    userResidenteId,
    createTrade,
    acceptTrade,
    rejectTrade,
    cancelTrade,
    refreshTrades,
    canManageTrades: canManageTrades(user),
  };
}

export default useTrocaPlantao;
