import { createContext, useContext, useMemo, useState } from 'react';

/**
 * Canal para uma calculadora declarar uma AÇÃO no header da página.
 *
 * ⚠️ Existe para não hardcodar calculadora no `App.jsx`. O header é
 * compartilhado pelas 61 telas de calculadora; sem este canal, "mostrar o
 * Transferir só no Balanço Hídrico" viraria um `if (calcId === '...')` na
 * navegação — que é onde ninguém procura quando um botão some.
 *
 * O display registra a ação quando ela faz sentido (no Balanço, só quando há
 * hora registrada) e a retira ao desmontar.
 */
const CalculadoraHeaderContext = createContext({ acao: null, registrarAcao: () => {} });

export function CalculadoraHeaderProvider({ children }) {
  const [acao, registrarAcao] = useState(null);
  const valor = useMemo(() => ({ acao, registrarAcao }), [acao]);
  return (
    <CalculadoraHeaderContext.Provider value={valor}>{children}</CalculadoraHeaderContext.Provider>
  );
}

export function useCalculadoraHeader() {
  return useContext(CalculadoraHeaderContext);
}
