/**
 * imagemVision — preparo da foto da escala antes da Claude Vision.
 *
 * Bug de 29/07: o dono importava e nada era extraído. Os logs provam que só o
 * preflight chegou ao servidor — o POST com a imagem morreu no navegador, sem
 * erro em lugar nenhum. A imagem ia em base64 do arquivo CRU, e base64 infla
 * ~33%: foto de iPhone de 8–12 MP vira 4–7 MB de corpo.
 *
 * O que estes testes travam: a matemática da redução (pura) e o contrato de erro
 * (todo caminho de falha tem `motivo` e mensagem que diz o que fazer — era a
 * ausência disso que deixava a falha muda para quem está no centro cirúrgico).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  dimensionarParaEnvio,
  bytesDeBase64,
  prepararImagemParaVision,
  ErroImagem,
  MAX_LADO,
  LIMITE_BYTES,
} from '@/lib/imagemVision'

describe('dimensionarParaEnvio', () => {
  it('reduz o lado maior ao teto preservando a proporção', () => {
    // 4032x3024 = foto de iPhone de 12 MP
    const { largura, altura } = dimensionarParaEnvio(4032, 3024)
    expect(largura).toBe(MAX_LADO)
    expect(altura).toBe(Math.round(3024 * (MAX_LADO / 4032)))
  })

  it('funciona com foto em retrato (o lado maior é a altura)', () => {
    const { largura, altura } = dimensionarParaEnvio(3024, 4032)
    expect(altura).toBe(MAX_LADO)
    expect(largura).toBe(Math.round(3024 * (MAX_LADO / 4032)))
  })

  it('NÃO aumenta print de tela que já é pequeno', () => {
    expect(dimensionarParaEnvio(375, 812)).toEqual({ largura: 375, altura: 812 })
  })

  it('proporção extrema não zera um lado', () => {
    const { largura, altura } = dimensionarParaEnvio(20000, 10)
    expect(largura).toBe(MAX_LADO)
    expect(altura).toBeGreaterThanOrEqual(1)
  })

  it('dimensão ausente devolve zero em vez de NaN', () => {
    expect(dimensionarParaEnvio(0, 0)).toEqual({ largura: 0, altura: 0 })
    expect(dimensionarParaEnvio(undefined, undefined)).toEqual({ largura: 0, altura: 0 })
  })
})

describe('bytesDeBase64', () => {
  it('estima os bytes descontando o padding', () => {
    // "AAAA" (4 chars, sem padding) = 3 bytes
    expect(bytesDeBase64('AAAA')).toBe(3)
    expect(bytesDeBase64('AAA=')).toBe(2)
    expect(bytesDeBase64('AA==')).toBe(1)
  })

  it('vazio é zero, não NaN', () => {
    expect(bytesDeBase64('')).toBe(0)
    expect(bytesDeBase64(null)).toBe(0)
  })
})

describe('prepararImagemParaVision — contrato de erro', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('arquivo vazio: motivo "vazio" e instrução', async () => {
    await expect(prepararImagemParaVision(new Blob([], { type: 'image/png' })))
      .rejects.toMatchObject({ name: 'ErroImagem', motivo: 'vazio' })
  })

  it('arquivo que não é imagem: manda para o caminho do Excel', async () => {
    const pdf = new File(['x'], 'escala.pdf', { type: 'application/pdf' })
    await expect(prepararImagemParaVision(pdf))
      .rejects.toMatchObject({ name: 'ErroImagem', motivo: 'nao-imagem' })
    // a mensagem tem de citar a saída, não só o problema
    await prepararImagemParaVision(pdf).catch((e) => {
      expect(e.message).toMatch(/Excel|print/i)
    })
  })

  it('HEIC passa da checagem de tipo (é o formato padrão do iPhone)', async () => {
    // recusar por tipo mandaria toda foto de iPhone para o caminho errado
    const heic = new File(['x'], 'IMG_0001.HEIC', { type: 'image/heic' })
    const erro = await prepararImagemParaVision(heic, { timeoutMs: 20 }).catch((e) => e)
    expect(erro?.motivo).not.toBe('nao-imagem')
  })

  it('imagem que o navegador não decodifica: motivo "decodificar" com saída', async () => {
    // jsdom não carrega imagem nenhuma, então o <img> é controlado aqui — é o
    // único jeito de exercitar o branch de onerror de forma determinística
    vi.stubGlobal('Image', class {
      set src(_v) { setTimeout(() => this.onerror?.(new Event('error')), 0) }
    })
    // arquivo grande de propósito: o fallback de arquivo cru não pode salvar
    const png = new File(['x'.repeat(LIMITE_BYTES + 1024)], 'foto.png', { type: 'image/png' })
    const erro = await prepararImagemParaVision(png).catch((e) => e)
    expect(erro).toBeInstanceOf(ErroImagem)
    expect(erro.motivo).toBe('decodificar')
    expect(erro.message).toMatch(/print|PNG|JPG/i)
  })

  it('decodificação que nunca responde falha por timeout em vez de pendurar', async () => {
    // sem timeout a tela girava o spinner para sempre — falha muda, que é
    // justamente o modo de falha que este módulo existe para eliminar
    vi.stubGlobal('Image', class { set src(_v) { /* nunca responde */ } })
    const png = new File(['x'.repeat(LIMITE_BYTES + 1024)], 'foto.png', { type: 'image/png' })
    const erro = await prepararImagemParaVision(png, { timeoutMs: 20 }).catch((e) => e)
    expect(erro).toBeInstanceOf(ErroImagem)
    expect(erro.motivo).toBe('decodificar')
    expect(erro.message).toMatch(/demorou/i)
  })

  it('arquivo PEQUENO que não decodifica ainda é enviado cru (não bloqueia o plantão)', async () => {
    vi.stubGlobal('Image', class {
      set src(_v) { setTimeout(() => this.onerror?.(new Event('error')), 0) }
    })
    const png = new File(['x'.repeat(2048)], 'print.png', { type: 'image/png' })
    const out = await prepararImagemParaVision(png)
    expect(out.reduzida).toBe(false)
    expect(out.bytes).toBeGreaterThan(0)
    expect(out.bytes).toBeLessThanOrEqual(LIMITE_BYTES)
  })

  it('todo ErroImagem carrega motivo E mensagem não-vazia', () => {
    const e = new ErroImagem('grande', 'Recorte só a parte da escala.')
    expect(e.name).toBe('ErroImagem')
    expect(e.motivo).toBe('grande')
    expect(e.message.length).toBeGreaterThan(0)
    expect(e).toBeInstanceOf(Error)
  })
})
