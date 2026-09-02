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
 *
 * São DOIS slots, em dois lugares diferentes da tela:
 * - `acao` → pill no header do app, ao lado do "Voltar" (é o Transferir).
 * - `acaoTitulo` → botão de ícone à direita do TÍTULO da calculadora, dentro
 *   da página (`CalculatorShowcase`). Nasceu do "Limpar" do Balanço Hídrico,
 *   que o dono tirou de dentro do card (02/09). Sem ninguém registrando, o
 *   título das outras 60 calculadoras fica exatamente como está.
 */
const CalculadoraHeaderContext = createContext({
  acao: null,
  registrarAcao: () => {},
  acaoTitulo: null,
  registrarAcaoTitulo: () => {},
});

export function CalculadoraHeaderProvider({ children }) {
  const [acao, registrarAcao] = useState(null);
  const [acaoTitulo, registrarAcaoTitulo] = useState(null);
  const valor = useMemo(
    () => ({ acao, registrarAcao, acaoTitulo, registrarAcaoTitulo }),
    [acao, acaoTitulo]
  );
  return (
    <CalculadoraHeaderContext.Provider value={valor}>{children}</CalculadoraHeaderContext.Provider>
  );
}

export function useCalculadoraHeader() {
  return useContext(CalculadoraHeaderContext);
}
