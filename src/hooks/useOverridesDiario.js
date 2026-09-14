/**
 * useOverridesDiario
 * Overrides diários (troca aceita ou ajuste manual) de uma coleção INTEIRA do
 * Firestore, em tempo real.
 *
 * Uma bolinha no calendário ou uma lista "meus plantões" só é verdadeira se somar
 * a base estática a ESTES docs — ler a base sozinha é ler a escala de antes das
 * trocas. Foi assim que, em julho/2026, um residente que trocou o dia 20 pelo 19
 * continuou marcado no 20 na tela "Consultar Plantões": o detalhe do dia lia o
 * override, mas as bolinhas do mês liam só PLANTOES_2026.
 *
 * Devolve `overrides` ({ 'YYYY-MM-DD': id } — o que a conta usa) e `docs` (o doc
 * inteiro, com origem/trocaId — o que a tela usa para explicar de onde veio).
 * Mesmo desenho de `useHospitaisOverrides` (hospitaisDiario), que já funcionava.
 */
import { useEffect, useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { createFirestoreSubscription } from '../services/firestoreSubscriptionHelper';

const VAZIO = { overrides: {}, docs: {}, loading: true };

export function useOverridesDiario(colecao, campo) {
  const [estado, setEstado] = useState(VAZIO);

  useEffect(() => {
    const { cleanup } = createFirestoreSubscription(collection(db, colecao), {
      onData: (snapshot) => {
        const overrides = {};
        const docs = {};
        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (!data?.[campo]) return;
          overrides[d.id] = data[campo];
          docs[d.id] = data;
        });
        setEstado({ overrides, docs, loading: false });
      },
      onError: (err) => {
        console.error(`Erro no listener de overrides (${colecao}):`, err);
        setEstado((atual) => ({ ...atual, loading: false }));
      },
    });
    return () => cleanup();
  }, [colecao, campo]);

  return estado;
}

/** Plantão da residência: `residenciaPlantaoDiario/{data}` → residenteId. */
export function useResidenciaPlantaoOverrides() {
  return useOverridesDiario('residenciaPlantaoDiario', 'residenteOverride');
}

/** Sobreaviso materno: `sobreavisoMaternoDiario/{data}` → funcionariaId. */
export function useSobreavisoOverrides() {
  return useOverridesDiario('sobreavisoMaternoDiario', 'funcionariaOverride');
}

export default useOverridesDiario;
