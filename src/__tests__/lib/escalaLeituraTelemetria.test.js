/**
 * Telemetria por leitura da Vision (Onda 4, item 4.1).
 *
 * Duas travas, e as duas FALHAM sem o código novo:
 *
 * 1. As dimensões da imagem saem do cabeçalho dos bytes. É a medida que decide
 *    se a hipótese da auditoria de 02/09 ("70% das fotos chegam a 1280px e a
 *    letra do rodapé fica em 8–10px") explica ou não um erro de leitura. Sem
 *    ela, largura e altura são `null` e nenhuma comparação é possível.
 *
 * 2. A linha gravada NÃO carrega dado de paciente. `montarLinhaLog` copia de
 *    uma lista fechada de campos escalares; jogar um caso inteiro nela não pode
 *    fazer iniciais, procedimento ou nome de anestesista vazarem para a tabela.
 */
import { describe, it, expect } from 'vitest'
import {
  dimensoesDaImagem, dimensoesDeBase64, bytesIniciais, bytesDeBase64,
} from '../../../supabase/functions/_shared/imagem-dimensoes.ts'
import { montarLinhaLog } from '../../../supabase/functions/_shared/escala-leitura-log.ts'

const b64 = (bytes) => Buffer.from(Uint8Array.from(bytes)).toString('base64')

/** PNG mínimo: assinatura + IHDR com largura/altura big-endian. */
function png(largura, altura) {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]
  for (const v of [largura, altura]) b.push((v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255)
  return b.concat([8, 2, 0, 0, 0])
}

/** JPEG mínimo: SOI + APP0 de tamanho real + SOF0 com altura/largura. */
function jpeg(largura, altura, { comApp0 = true } = {}) {
  const b = [0xff, 0xd8]
  if (comApp0) {
    // APP0 de 16 bytes de payload: força o parser a PULAR pelo tamanho do
    // segmento em vez de topar com o SOF0 por acaso no byte seguinte
    b.push(0xff, 0xe0, 0x00, 0x10)
    for (let i = 0; i < 14; i++) b.push(0)
  }
  b.push(0xff, 0xc0, 0x00, 0x11, 0x08)
  b.push((altura >> 8) & 255, altura & 255, (largura >> 8) & 255, largura & 255)
  for (let i = 0; i < 6; i++) b.push(0)
  return b
}

function gif(largura, altura) {
  return [0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
    largura & 255, (largura >> 8) & 255, altura & 255, (altura >> 8) & 255, 0, 0, 0]
}

describe('dimensões da imagem pelo cabeçalho', () => {
  it('lê PNG', () => {
    expect(dimensoesDaImagem(Uint8Array.from(png(2400, 1530)))).toEqual({ largura: 2400, altura: 1530 })
  })

  it('lê JPEG pulando o segmento APP0 pelo tamanho declarado', () => {
    expect(dimensoesDaImagem(Uint8Array.from(jpeg(1280, 815)))).toEqual({ largura: 1280, altura: 815 })
  })

  it('lê JPEG sem APP0', () => {
    expect(dimensoesDaImagem(Uint8Array.from(jpeg(1117, 868, { comApp0: false }))))
      .toEqual({ largura: 1117, altura: 868 })
  })

  it('lê GIF (little-endian)', () => {
    expect(dimensoesDaImagem(Uint8Array.from(gif(640, 480)))).toEqual({ largura: 640, altura: 480 })
  })

  it('lê WebP no formato estendido VP8X', () => {
    const b = [...'RIFF'].map((c) => c.charCodeAt(0))
    b.push(0, 0, 0, 0)
    for (const c of 'WEBPVP8X') b.push(c.charCodeAt(0))
    b.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0) // tamanho + flags + reservado
    const w = 2575, h = 1000
    b[24] = (w - 1) & 255; b[25] = ((w - 1) >> 8) & 255; b[26] = ((w - 1) >> 16) & 255
    b[27] = (h - 1) & 255; b[28] = ((h - 1) >> 8) & 255; b[29] = ((h - 1) >> 16) & 255
    expect(dimensoesDaImagem(Uint8Array.from(b))).toEqual({ largura: 2575, altura: 1000 })
  })

  it('devolve null (nunca lança) para lixo, vazio e formato desconhecido', () => {
    expect(dimensoesDaImagem(Uint8Array.from([1, 2, 3]))).toBeNull()
    expect(dimensoesDaImagem(new Uint8Array(0))).toBeNull()
    expect(dimensoesDaImagem(Uint8Array.from(new Array(40).fill(0x42)))).toBeNull()
    expect(dimensoesDeBase64('não é base64 ###')).toBeNull()
    expect(dimensoesDeBase64('')).toBeNull()
    expect(dimensoesDeBase64(null)).toBeNull()
  })

  it('mede a foto típica do corpus a partir do base64, sem decodificar tudo', () => {
    // 1280x815 é a dimensão de 45 das 64 fotos do corpus (teto do WhatsApp)
    const cauda = new Array(200000).fill(0) // simula o resto do arquivo
    const base64 = b64([...jpeg(1280, 815), ...cauda])
    expect(dimensoesDeBase64(base64)).toEqual({ largura: 1280, altura: 815 })
    // e o prefixo lido é uma fração do arquivo
    expect(bytesIniciais(base64).length).toBeLessThan(200000)
  })

  it('estima os bytes do arquivo a partir do base64', () => {
    expect(bytesDeBase64(b64([1, 2, 3]))).toBe(3)
    expect(bytesDeBase64(b64(new Array(1000).fill(7)))).toBe(1000)
    expect(bytesDeBase64('')).toBe(0)
  })
})

describe('linha de telemetria — LGPD por construção', () => {
  it('não deixa passar campo de paciente nem qualquer chave fora da lista', () => {
    const linha = montarLinhaLog({
      uid: 'uid-1',
      casos: 30,
      // tudo abaixo é o que NÃO pode chegar à tabela
      pacienteIniciais: 'M.C.S.',
      pacienteNome: 'Maria Clara Souza',
      procedimento: 'COLECISTECTOMIA',
      anestesista: 'GUILHERME',
      cirurgiao: 'Dr. Fulano',
      texto: '{"casos":[{"pacienteNome":"Maria Clara Souza"}]}',
    })
    const serializada = JSON.stringify(linha)
    expect(serializada).not.toMatch(/Maria Clara/i)
    expect(serializada).not.toMatch(/COLECISTECTOMIA/i)
    expect(serializada).not.toMatch(/GUILHERME/i)
    expect(serializada).not.toMatch(/M\.C\.S\./)
    expect(Object.keys(linha)).not.toContain('pacienteNome')
    expect(linha.uid).toBe('uid-1')
    expect(linha.casos).toBe(30)
  })

  it('preenche os defaults que a tabela espera e nunca devolve NaN', () => {
    const linha = montarLinhaLog({})
    expect(linha.modo).toBe('dia-util')
    expect(linha.origem).toBe('modelo')
    expect(linha.imagem_largura).toBeNull()
    expect(linha.imagem_altura).toBeNull()
    for (const k of ['input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_write_tokens',
      'latencia_ms', 'casos', 'rodape', 'ajuda', 'imagem_bytes']) {
      expect(Number.isFinite(linha[k])).toBe(true)
    }
    expect(montarLinhaLog({ input_tokens: 'abc', latencia_ms: -5 }).input_tokens).toBe(0)
    expect(montarLinhaLog({ latencia_ms: -5 }).latencia_ms).toBe(0)
  })

  it('guarda só as normalizações que realmente agiram', () => {
    const linha = montarLinhaLog({ normalizacoes: { iniciais: 2, hora: 0, sala: 3, ruido: 'x' } })
    expect(linha.normalizacoes).toEqual({ iniciais: 2, sala: 3 })
  })
})
