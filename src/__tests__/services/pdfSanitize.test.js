/**
 * sanitizeForPdf — acentuação nos PDFs.
 *
 * Até 04/08 a função removia TODOS os acentos e cada PDF do app saía com
 * "Ferias", "Servico", "Situacao". As fontes padrão do jsPDF escrevem em
 * CP1252, que cobre o português inteiro; o que quebrava o espaçamento era
 * texto em NFD (acento como caractere solto). Estes testes travam a regra:
 * acento entra, NFD é normalizado, e só o que o CP1252 não representa vira
 * ASCII.
 */
import { describe, it, expect } from 'vitest'
import { sanitizeForPdf } from '@/services/pdf/pdfBranding'

describe('sanitizeForPdf', () => {
  it('preserva a acentuação do português', () => {
    expect(sanitizeForPdf('Regras de Férias')).toBe('Regras de Férias')
    expect(sanitizeForPdf('Serviço de Anestesiologia')).toBe('Serviço de Anestesiologia')
    expect(sanitizeForPdf('Situação · Período · Dias úteis')).toBe('Situação · Período · Dias úteis')
    expect(sanitizeForPdf('licença-saúde, órgão, você, à cota')).toBe('licença-saúde, órgão, você, à cota')
  })

  it('normaliza NFD para NFC (a causa real do espaçamento quebrado)', () => {
    const decomposto = 'Férias'.normalize('NFD')
    expect(decomposto).not.toBe('Férias') // garante que o caso testado é real
    expect(sanitizeForPdf(decomposto)).toBe('Férias')
    expect(sanitizeForPdf(decomposto)).toHaveLength(6)
  })

  it('mantém a pontuação tipográfica que o CP1252 tem', () => {
    expect(sanitizeForPdf('travessão — aspas “x” · reticências…')).toBe(
      'travessão — aspas “x” · reticências…'
    )
    expect(sanitizeForPdf('1º ano, 2ª vaga, 30 °C')).toBe('1º ano, 2ª vaga, 30 °C')
  })

  it('converte para ASCII o que o CP1252 não representa', () => {
    expect(sanitizeForPdf('a → b')).toBe('a -> b')
    expect(sanitizeForPdf('saldo ≥ 0')).toBe('saldo >= 0')
    expect(sanitizeForPdf('✓ conferido')).toBe('OK conferido')
  })

  it('descarta o que não tem equivalente em vez de emitir caractere inválido', () => {
    expect(sanitizeForPdf('férias 🏖 marcadas')).toBe('férias  marcadas')
  })

  it('tolera null, undefined e número', () => {
    expect(sanitizeForPdf(null)).toBe('')
    expect(sanitizeForPdf(undefined)).toBe('')
    expect(sanitizeForPdf(30)).toBe('30')
  })
})
