/**
 * EscalasFuncionariasBaseContext — alimenta a "base ativa" dos data files
 * estáticos (sobreavisoMaterno2026 / hospitaisTecnicas2026) com os meses
 * publicados no Firestore (escalasFuncionarias/{YYYY-MM}, import in-app).
 *
 * Os helpers dos data files leem um registro de módulo (assinaturas intactas);
 * este provider assina a coleção, atualiza o registro e publica `version`
 * para que consumidores memorizados re-derivem quando a base muda.
 *
 * Montado ESTÁVEL em DeferredProviders desde o 1º render (lição do remount da
 * Home 31/07). Busca no mount, sem o gate de 2s: o card de Sobreaviso da Home
 * depende desta base (mesma razão do EscalaCirurgicaProvider).
 */
import { createContext, useContext, useEffect, useState } from 'react';
import { setSobreavisoBaseDinamica } from '@/data/sobreavisoMaterno2026';
import { setHospitaisBaseDinamica } from '@/data/hospitaisTecnicas2026';
import { subscribeEscalasFuncionarias } from '@/services/escalasFuncionariasService';

// Default sem provider (testes, ambientes isolados): base = só o estático.
const EscalasFuncionariasBaseContext = createContext({ version: 0, mesesPublicados: [], loading: false });

export function EscalasFuncionariasBaseProvider({ children }) {
  const [state, setState] = useState({ version: 0, mesesPublicados: [], loading: true });

  useEffect(() => {
    const cleanup = subscribeEscalasFuncionarias(({ meses }) => {
      const sobreavisoPorMes = {};
      const hospitaisPorMes = {};
      for (const [mes, docData] of Object.entries(meses)) {
        sobreavisoPorMes[mes] = docData.sobreaviso || {};
        hospitaisPorMes[mes] = docData.hospitais || {};
      }
      setSobreavisoBaseDinamica(sobreavisoPorMes);
      setHospitaisBaseDinamica(hospitaisPorMes);
      setState((s) => ({
        version: s.version + 1,
        mesesPublicados: Object.keys(meses).sort(),
        loading: false,
      }));
    });
    return cleanup;
  }, []);

  return (
    <EscalasFuncionariasBaseContext.Provider value={state}>
      {children}
    </EscalasFuncionariasBaseContext.Provider>
  );
}

export function useEscalasFuncionariasBase() {
  return useContext(EscalasFuncionariasBaseContext);
}
