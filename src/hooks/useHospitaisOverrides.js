/**
 * useHospitaisOverrides Hook
 * Subscribe real-time à coleção `hospitaisDiario` que contém overrides de
 * trocas aceitas. Retorna mapa { '{data}_{hospital}_{turno}': funcionariaId }.
 */
import { useEffect, useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from '../services/firestoreSubscriptionHelper';

export function useHospitaisOverrides() {
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = collection(db, 'hospitaisDiario');
    const { cleanup } = createFirestoreSubscription(ref, {
      onData: (snapshot) => {
        const map = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data?.funcionariaOverride) {
            map[d.id] = data.funcionariaOverride;
          }
        });
        setOverrides(map);
        setLoading(false);
      },
      onError: (err) => {
        console.error('Erro no listener de overrides hospitais:', err);
        setLoading(false);
      },
    });
    return () => cleanup();
  }, []);

  return { overrides, loading };
}

export default useHospitaisOverrides;
