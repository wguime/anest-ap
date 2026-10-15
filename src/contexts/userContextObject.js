/**
 * O objeto do contexto do usuário, fora do `UserContext.jsx`, para quem só precisa LER o
 * usuário sem trazer o Firebase junto. Primeiro leitor: o provider da Escala Cirúrgica
 * (15/10/2026), montado para todo o app, que precisa saber se a conta é de hospital — importar
 * o `UserContext.jsx` levaria o Firebase e o login inteiro para os testes do provider.
 * `useUser()` continua sendo o hook do app (lança fora do provider).
 */
import { createContext, useContext } from 'react'

export const UserContext = createContext(null)

/** O valor de `useUser()`, mas `null` fora do provider em vez de lançar. */
export const useUserOpcional = () => useContext(UserContext)
