/**
 * A falha da leitura por imagem precisa dizer se REENVIAR resolve.
 *
 * Caso real 17–18/08: a chave da IA ficou sem crédito no meio da tarde, a edge
 * respondeu 502 sem corpo e a tela pediu "tente de novo em alguns instantes" —
 * a foto foi reenviada oito vezes por duas pessoas e o vespertino do dia 18
 * ficou sem escala publicada.
 */
import { describe, it, expect } from 'vitest'
import { FALHA_VISION, classificarFalhaVision, mensagemFalhaVision } from '../../lib/escalaVisionFalha'

const SEM_CREDITO = {
  status: 400,
  tipo: 'invalid_request_error',
  mensagem: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
}

describe('classificarFalhaVision', () => {
  it('conta sem crédito (o 400 do incidente 17/08) não é falha transitória', () => {
    expect(classificarFalhaVision(SEM_CREDITO)).toBe(FALHA_VISION.SEM_CREDITO)
  })

  it('chave recusada: 401, 403 e a chave ausente na edge', () => {
    expect(classificarFalhaVision({ status: 401, tipo: 'authentication_error', mensagem: 'invalid x-api-key' }))
      .toBe(FALHA_VISION.CHAVE_RECUSADA)
    expect(classificarFalhaVision({ status: 403, mensagem: 'permission_error' })).toBe(FALHA_VISION.CHAVE_RECUSADA)
    expect(classificarFalhaVision({ status: 401, tipo: 'authentication_error', mensagem: 'ANTHROPIC_API_KEY não configurado' }))
      .toBe(FALHA_VISION.CHAVE_RECUSADA)
  })

  it('429 e 5xx passam sozinhos — aí tentar de novo é o conselho certo', () => {
    expect(classificarFalhaVision({ status: 429, tipo: 'rate_limit_error' })).toBe(FALHA_VISION.SOBRECARGA)
    expect(classificarFalhaVision({ status: 529, mensagem: 'Overloaded' })).toBe(FALHA_VISION.SOBRECARGA)
  })

  it('sem pista nenhuma cai no desconhecido, não no crédito', () => {
    expect(classificarFalhaVision({})).toBe(FALHA_VISION.DESCONHECIDA)
    expect(classificarFalhaVision({ status: 400, mensagem: 'image too large' })).toBe(FALHA_VISION.DESCONHECIDA)
  })
})

describe('mensagemFalhaVision', () => {
  it('sem crédito: diz que reenviar não resolve e aponta a saída da tela', () => {
    const m = mensagemFalhaVision(FALHA_VISION.SEM_CREDITO, 'importe a planilha ou preencha à mão')
    expect(m.description).toMatch(/sem créditos/i)
    expect(m.description).toMatch(/não resolve/i)
    expect(m.description).toMatch(/importe a planilha ou preencha à mão/)
    expect(m.description).not.toMatch(/tente de novo/i)
  })

  it('sobrecarga: aí sim manda tentar de novo', () => {
    expect(mensagemFalhaVision(FALHA_VISION.SOBRECARGA).description).toMatch(/tente de novo/i)
  })

  it('desconhecido não culpa a foto (incidente 06/08)', () => {
    const m = mensagemFalhaVision(null, 'preencha à mão')
    expect(m.title).toBe('Falha na extração')
    expect(m.description).not.toMatch(/nitidez|print|foto/i)
  })
})
