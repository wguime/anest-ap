/**
 * useTrocaSobreaviso Hook
 * Gerencia trocas de sobreaviso materno.
 *
 * Resolve o funcionariaId do usuário logado via match de nome em
 * FUNCIONARIAS_SOBREAVISO. Funcionárias ainda não têm contas; admin/coord
 * podem usar no lugar delas até liberar acesso.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../contexts/UserContext';
import { isAdministrator } from '@/design-system/components/anest/admin-only';
import { FUNCIONARIAS_SOBREAVISO } from '../data/sobreavisoMaterno2026';
import { resolveFuncionariaId as resolveFuncionariaIdShared, isFuncionariaPorEmail } from '../utils/funcionariaResolver';
import {
  createTradeRequest,
  acceptTrade as acceptTradeService,
  rejectTrade as rejectTradeService,
  cancelTrade as cancelTradeService,
  getPendingTradesForUser,
  subscribeTrades,
} from '../services/trocaSobreavisoService';

const funcionariaIdToUidCache = new Map();

async function loadFuncionariaUidMap() {
  if (funcionariaIdToUidCache.size > 0) return funcionariaIdToUidCache;
  try {
    // Funcionárias são identificadas pelo role 'tec-enfermagem' + permission 'sobreaviso-materno'.
    const q = query(collection(db, 'users'), where('role', '==', 'tec-enfermagem'));
    const snap = await getDocs(q);
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.permissions?.['sobreaviso-materno']) continue;
      const email = (data.email || '').toLowerCase().trim();
      if (!email) continue;
      const match = FUNCIONARIAS_SOBREAVISO.find((f) => f.email && f.email.toLowerCase() === email);
      if (match) funcionariaIdToUidCache.set(match.id, doc.id);
    }
  } catch (err) {
    console.warn('Erro ao mapear funcionariaId→uid:', err);
  }
  return funcionariaIdToUidCache;
}

export async function getFuncionariaFirebaseUid(funcionariaId) {
  if (!funcionariaId) return null;
  const map = await loadFuncionariaUidMap();
  return map.get(funcionariaId) || null;
}

function isColaboradorMaterno(user) {
  return (user?.role === 'tec-enfermagem' && user?.permissions?.['sobreaviso-materno'] === true)
    || user?.role === 'colaborador-materno'; // fallback legado
}

function isCoordenadorOrAdmin(user) {
  if (!user) return false;
  const roleKey = (user.role || '').toLowerCase();
  return user.isAdmin || user.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador' || isAdministrator(user);
}

export function canManageTrades(user) {
  // Funcionária identificada por email nas listas estáticas tem acesso garantido,
  // independente da permission no Firestore — mesmo mecanismo de ConsultaSobreaviso.
  return isFuncionariaPorEmail(user) || isColaboradorMaterno(user) || isCoordenadorOrAdmin(user);
}

function resolveFuncionariaId(user) {
  return resolveFuncionariaIdShared(user, FUNCIONARIAS_SOBREAVISO);
}

export function useTrocaSobreaviso() {
  const { user, firebaseUser } = useUser();

  const userFuncionariaId = useMemo(() => resolveFuncionariaId(user), [user]);
  const funcionariaIdRef = useRef(userFuncionariaId);
  useEffect(() => { funcionariaIdRef.current = userFuncionariaId; }, [userFuncionariaId]);

  const [trades, setTrades] = useState([]);
  const [pendingTrades, setPendingTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPendingTrades = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const { trades: pending, error: err } = await getPendingTradesForUser(firebaseUser.uid, userFuncionariaId);
      if (err) console.warn('Erro ao buscar trocas sobreaviso pendentes:', err);
      else setPendingTrades(pending);
    } catch (err) {
      console.error('Erro ao buscar trocas sobreaviso pendentes:', err);
    }
  }, [firebaseUser, userFuncionariaId]);

  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeTrades(
      firebaseUser.uid,
      () => funcionariaIdRef.current,
      ({ myTrades, pendingForMe }) => {
        setTrades(myTrades);
        setPendingTrades(pendingForMe);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  const createTrade = useCallback(async ({ dataSobreaviso, dataDesejada, descricao, destinatarioId, destinatarioNome, solicitanteFuncionariaIdOverride }) => {
    if (!firebaseUser) {
      return { success: false, trade: null, error: 'Usuario nao autenticado' };
    }
    if (!canManageTrades(user)) {
      return { success: false, trade: null, error: 'Sem permissão para criar trocas' };
    }

    // Admin/coord pode selecionar uma funcionária manualmente; funcionária comum usa a própria.
    const solicitanteFuncionariaId = solicitanteFuncionariaIdOverride || userFuncionariaId;
    if (!solicitanteFuncionariaId) {
      return { success: false, trade: null, error: 'Selecione a funcionária solicitante' };
    }

    setError(null);

    const { trade, error: err } = await createTradeRequest({
      solicitanteId: firebaseUser.uid,
      solicitanteNome: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario'),
      solicitanteRole: user?.role || null,
      solicitanteFuncionariaId,
      dataSobreaviso,
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
  }, [firebaseUser, user, userFuncionariaId, loadPendingTrades]);

  const acceptTrade = useCallback(async (codigo, acceptAsFuncionariaId = null) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }
    const funcionariaId = acceptAsFuncionariaId || userFuncionariaId;
    if (!funcionariaId) {
      return { success: false, error: 'Funcionária aceitadora não identificada na escala' };
    }

    setError(null);
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario');
    const { _success, error: err, trade } = await acceptTradeService(codigo, firebaseUser.uid, userName, funcionariaId);

    if (err) {
      setError(err);
      return { success: false, error: err, trade };
    }

    await loadPendingTrades();
    return { success: true, error: null, trade };
  }, [firebaseUser, user, userFuncionariaId, loadPendingTrades]);

  const rejectTrade = useCallback(async (codigo) => {
    if (!firebaseUser) {
      return { success: false, error: 'Usuario nao autenticado' };
    }

    setError(null);
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuario');
    const { _success, error: err, trade } = await rejectTradeService(codigo, firebaseUser.uid, userName);

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
    const { _success, error: err, trade } = await cancelTradeService(codigo, firebaseUser.uid);

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
    userFuncionariaId,
    createTrade,
    acceptTrade,
    rejectTrade,
    cancelTrade,
    refreshTrades,
    canManageTrades: canManageTrades(user),
    isAdminOrCoord: isCoordenadorOrAdmin(user),
  };
}

export default useTrocaSobreaviso;
