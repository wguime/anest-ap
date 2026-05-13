/**
 * useTrocaPlantaoHospitalar Hook
 * Gerencia trocas de plantão hospitalar (FDS/feriados: HRO + UNIMED + Plantão Pago).
 *
 * Resolve o funcionariaId via email match em FUNCIONARIAS_HOSPITAIS (mesma
 * estratégia de useTrocaSobreaviso). Permission `canManageTrades` reaproveitada
 * — usuária identificada por email já tem acesso.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUser } from '../contexts/UserContext';
import { FUNCIONARIAS_HOSPITAIS } from '../data/hospitaisTecnicas2026';
import { resolveFuncionariaId as resolveFuncionariaIdShared } from '../utils/funcionariaResolver';
import { canManageTrades } from './useTrocaSobreaviso';
import {
  createTradeRequest,
  acceptTrade as acceptTradeService,
  rejectTrade as rejectTradeService,
  cancelTrade as cancelTradeService,
  getPendingTradesForUser,
  subscribeTrades,
} from '../services/trocaPlantaoHospitalarService';

const funcionariaIdToUidCache = new Map();

async function loadFuncionariaUidMap() {
  if (funcionariaIdToUidCache.size > 0) return funcionariaIdToUidCache;
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'tec-enfermagem'));
    const snap = await getDocs(q);
    for (const doc of snap.docs) {
      const data = doc.data();
      const email = (data.email || '').toLowerCase().trim();
      if (!email) continue;
      const match = FUNCIONARIAS_HOSPITAIS.find((f) => f.email && f.email.toLowerCase() === email);
      if (match) funcionariaIdToUidCache.set(match.id, doc.id);
    }
  } catch (err) {
    console.warn('Erro ao mapear funcionariaId→uid (hospitalar):', err);
  }
  return funcionariaIdToUidCache;
}

export async function getFuncionariaHospitalarFirebaseUid(funcionariaId) {
  if (!funcionariaId) return null;
  const map = await loadFuncionariaUidMap();
  return map.get(funcionariaId) || null;
}

function isCoordenadorOrAdmin(user) {
  if (!user) return false;
  const roleKey = (user.role || '').toLowerCase();
  return user.isAdmin || user.isCoordenador || roleKey === 'administrador' || roleKey === 'coordenador';
}

function resolveFuncionariaId(user) {
  return resolveFuncionariaIdShared(user, FUNCIONARIAS_HOSPITAIS);
}

export function useTrocaPlantaoHospitalar() {
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
      if (err) console.warn('Erro ao buscar trocas plantão hospitalar pendentes:', err);
      else setPendingTrades(pending);
    } catch (err) {
      console.error('Erro ao buscar trocas plantão hospitalar pendentes:', err);
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

  const createTrade = useCallback(async ({
    escopo,
    dataPlantao,
    hospital,
    turno,
    dataDesejada,
    hospitalDesejado,
    turnoDesejado,
    descricao,
    destinatarioId,
    destinatarioNome,
    solicitanteFuncionariaIdOverride,
  }) => {
    if (!firebaseUser) {
      return { success: false, trade: null, error: 'Usuário não autenticado' };
    }
    if (!canManageTrades(user)) {
      return { success: false, trade: null, error: 'Sem permissão para criar trocas' };
    }
    const solicitanteFuncionariaId = solicitanteFuncionariaIdOverride || userFuncionariaId;
    if (!solicitanteFuncionariaId) {
      return { success: false, trade: null, error: 'Selecione a funcionária solicitante' };
    }

    setError(null);
    const { trade, error: err } = await createTradeRequest({
      solicitanteId: firebaseUser.uid,
      solicitanteNome: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuário'),
      solicitanteRole: user?.role || null,
      solicitanteFuncionariaId,
      escopo,
      dataPlantao,
      hospital: hospital || null,
      turno: turno || null,
      dataDesejada: dataDesejada || null,
      hospitalDesejado: hospitalDesejado || null,
      turnoDesejado: turnoDesejado || null,
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
    if (!firebaseUser) return { success: false, error: 'Usuário não autenticado' };
    const funcionariaId = acceptAsFuncionariaId || userFuncionariaId;
    if (!funcionariaId) return { success: false, error: 'Funcionária aceitadora não identificada na escala' };

    setError(null);
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuário');
    const { _success, error: err, trade } = await acceptTradeService(codigo, firebaseUser.uid, userName, funcionariaId);
    if (err) {
      setError(err);
      return { success: false, error: err, trade };
    }
    await loadPendingTrades();
    return { success: true, error: null, trade };
  }, [firebaseUser, user, userFuncionariaId, loadPendingTrades]);

  const rejectTrade = useCallback(async (codigo) => {
    if (!firebaseUser) return { success: false, error: 'Usuário não autenticado' };
    setError(null);
    const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (firebaseUser.displayName || 'Usuário');
    const { _success, error: err, trade } = await rejectTradeService(codigo, firebaseUser.uid, userName);
    if (err) {
      setError(err);
      return { success: false, error: err, trade };
    }
    await loadPendingTrades();
    return { success: true, error: null, trade };
  }, [firebaseUser, user, loadPendingTrades]);

  const cancelTrade = useCallback(async (codigo) => {
    if (!firebaseUser) return { success: false, error: 'Usuário não autenticado' };
    setError(null);
    const { _success, error: err, trade } = await cancelTradeService(codigo, firebaseUser.uid);
    if (err) {
      setError(err);
      return { success: false, error: err, trade };
    }
    await loadPendingTrades();
    return { success: true, error: null, trade };
  }, [firebaseUser, loadPendingTrades]);

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
    canManageTrades: canManageTrades(user),
    isAdminOrCoord: isCoordenadorOrAdmin(user),
  };
}

export default useTrocaPlantaoHospitalar;
