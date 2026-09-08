/**
 * Login por identificador (dono 2026-09-08) — as funcionárias da Unimed entram
 * digitando `Unimed`, sem e-mail. O Firebase Auth exige e-mail internamente, e a
 * conversão mora num lugar só: se ela se perder, o login delas para de funcionar
 * sem ninguém notar (a mensagem seria "usuário não encontrado").
 */
import { describe, it, expect } from 'vitest'
import { resolveLoginEmail, ehLoginValido, DOMINIO_LOGIN_INTERNO } from '@/utils/loginIdentifier'

describe('resolveLoginEmail', () => {
  it('identificador vira e-mail interno', () => {
    expect(resolveLoginEmail('Unimed')).toBe(`unimed@${DOMINIO_LOGIN_INTERNO}`)
  })

  it('espaço em volta e caixa alta não atrapalham quem digita no celular', () => {
    expect(resolveLoginEmail('  UNIMED  ')).toBe(`unimed@${DOMINIO_LOGIN_INTERNO}`)
  })

  it('e-mail de verdade passa direto (só normaliza a caixa)', () => {
    expect(resolveLoginEmail('Fulano@Gmail.com')).toBe('fulano@gmail.com')
  })

  it('vazio devolve vazio — o formulário é quem reclama', () => {
    expect(resolveLoginEmail('')).toBe('')
    expect(resolveLoginEmail(null)).toBe('')
  })

  it('o domínio interno não é roteável (RFC 6762) — nada sai para a internet', () => {
    expect(DOMINIO_LOGIN_INTERNO.endsWith('.local')).toBe(true)
  })
})

describe('ehLoginValido', () => {
  it('aceita identificador e e-mail', () => {
    expect(ehLoginValido('Unimed')).toBe(true)
    expect(ehLoginValido('fulano@gmail.com')).toBe(true)
  })

  it('recusa vazio, espaço no meio e e-mail pela metade', () => {
    expect(ehLoginValido('')).toBe(false)
    expect(ehLoginValido('   ')).toBe(false)
    expect(ehLoginValido('func unimed')).toBe(false)
    expect(ehLoginValido('fulano@gmail')).toBe(false)
    expect(ehLoginValido('@gmail.com')).toBe(false)
  })
})
