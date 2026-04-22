/**
 * useAllTrades — hooks de visão administrativa das 3 coleções de troca.
 *
 * Cada hook usa subscribeAllTrades do service correspondente e retorna
 * { trades, loading, error }. NÃO filtra por usuário — visão completa.
 * Apenas admin/coordenador deve ter acesso.
 */
import { useEffect, useState } from 'react';
import { subscribeAllTrades as subscribeAllSobreaviso } from '../services/trocaSobreavisoService';
import { subscribeAllTrades as subscribeAllHospitalar } from '../services/trocaPlantaoHospitalarService';
import { subscribeAllTrades as subscribeAllResidencia } from '../services/trocaPlantaoService';

function useAllTradesGeneric(subscribeFn, dependencies = []) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeFn(({ trades, error: err }) => {
      setTrades(trades);
      setError(err);
      setLoading(false);
    });
    return () => unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { trades, loading, error };
}

export function useAllSobreavisoTrades() {
  return useAllTradesGeneric(subscribeAllSobreaviso);
}

export function useAllPlantaoHospitalarTrades() {
  return useAllTradesGeneric(subscribeAllHospitalar);
}

export function useAllResidenciaTrades() {
  return useAllTradesGeneric(subscribeAllResidencia);
}
