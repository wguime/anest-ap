/**
 * useTrocaPlantao Hook
 * Hook para gerenciar solicitacoes de troca de plantao.
 *
 * Resolve o residenteId do usuário logado via match de nome em
 * RESIDENTES_2026, necessário para aplicar overrides na escala.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
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

// Cache em memória: residenteId → Firebase UID (evita requery)
const residenteIdToUidCache = new Map();

/**
 * Resolve Firebase UIDs dos residentes via lookup em `users` (role='medico-residente').
 * Match por firstName contra RESIDENTES_2026.nome (case-insensitive).
 * Retorna Map de residenteId → uid para os 8 residentes que tiverem conta.
 */
async function loadResidenteUidMap() {
  if (residenteIdToUidCache.size > 0) return residenteIdToUidCache;
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'medico-residente'));
    const snap = await getDocs(q);
    for (const doc of snap.docs) {
      const data = doc.data();
      const email = (data.email || '').toLowerCase().trim();
      // Match por email (primário) → firstName (fallback)
      let match = email
        ? RESIDENTES_2026.find((r) => r.email && r.email.toLowerCase() === email)
        : null;
      if (!match) {
        const firstName = (data.firstName || '').toLowerCase().trim();
        if (firstName) match = RESIDENTES_2026.find((r) => r.nome.toLowerCase() === firstName);
      }
      if (match) residenteIdToUidCache.set(match.id, doc.id);
    }
  } catch (err) {
    console.warn('Erro ao mapear residenteId→uid:', err);
  }
  return residenteIdToUidCache;
}

export async function getResidenteFirebaseUid(residenteId) {
  if (!residenteId) return null;
  const map = await loadResidenteUidMap();
  return map.get(residenteId) || null;
}

function isResidente(user) {
  return user?.role === 'medico-residente';
}

export function canManageTrades(user) {
  return isResidente(user) || isAdministrator(user);
}

function resolveResidenteId(user) {
  const email = (user?.email || '').toLowerCase().trim();
  if (email) {
    const byEmail = RESIDENTES_2026.find((r) => r.email && r.email.toLowerCase() === email);
    if (byEmail) return byEmail.id;
  }
  const first = (user?.firstName || '').toLowerCase().trim();
  if (!first) return null;
  const match = RESIDENTES_2026.find((r) => r.nome.toLowerCase() === first);
  return match?.id || null;
}

export function useTrocaPlantao() {
  const { user, firebaseUser } = useUser();

  const userResidenteId = useMemo(() => resolveResidenteId(user), [user]);
  // Ref estável para evitar re-subscrição quando userResidenteId muda
  const residenteIdRef = useRef(userResidenteId);
  useEffect(() => { residenteIdRef.current = userResidenteId; }, [userResidenteId]);

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

    const unsubscribe = subscribeTrades(
      firebaseUser.uid,
      () => residenteIdRef.current,
      ({ myTrades, pendingForMe }) => {
        setTrades(myTrades);
        setPendingTrades(pendingForMe);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [firebaseUser]);

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
    const { success, error: err, trade } = await acceptTradeService(codigo, firebaseUser.uid, userName, userResidenteId);

    if (err) {
      setError(err);
      return { success: false, error: err, trade };
    }

    await loadPendingTrades();
    return { success: true, error: null, trade };
  }, [firebaseUser, user, userResidenteId, loadPendingTrades]);

  const rejectTrade = useCallback(async (codigo) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }

    setError(null);
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario');
    const { success, error: err, trade } = await rejectTradeService(codigo, firebaseUser.uid, userName);

    if (err) {
      setError(err);
      return { success: false, error: err, trade };
    }

    await loadPendingTrades();
    return { success: true, error: null, trade };
  }, [firebaseUser, user, loadPendingTrades]);

  const cancelTrade = useCallback(async (codigo) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }

    setError(null);
    const { success, error: err, trade } = await cancelTradeService(codigo, firebaseUser.uid);

    if (err) {
      setError(err);
      return { success: false, error: err, trade };
    }

    await loadPendingTrades();
    return { success: true, error: null, trade };
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
