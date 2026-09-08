/**
 * Cache de 24 h e retry da leitura (Onda 4, item 4.9).
 *
 * Três promessas travadas aqui, e cada uma tem um jeito próprio de falhar em
 * silêncio:
 *
 * 1. A chave muda quando o resultado esperado muda. Se a versão do prompt não
 *    entrasse na chave, subir uma edição nova continuaria servindo a leitura
 *    velha por 24 h — a pior forma de "a mudança não fez efeito".
 * 2. Leitura com NOME COMPLETO de paciente não é guardada. `pacienteNome` só
 *    existe em convênio particular puro, para a cobrança; 24 h dele numa tabela
 *    de conveniência não se justifica pelo que economiza (decisão do dono 07/09).
 * 3. O retry é UM. Um 529 vira espera de dois segundos, não "tente de novo" na
 *    tela da secretária às 22h; mas dois retries empurram a espera para além do
 *    que alguém aguenta olhando a tela.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  chaveCache, temNomeDePaciente, ehStatusRetentavel, fetchComRetry,
} from '../../../supabase/functions/_shared/escala-leitura-cache.ts'

const HASH = 'a'.repeat(64) // sha256 da imagem, nunca a imagem

describe('chave do cache', () => {
  it('⚠️ opera sobre o HASH, nunca sobre a imagem', async () => {
    // concatenar o base64 inteiro numa string nova e digeri-lo de novo custou
    // um `WORKER_RESOURCE_LIMIT` em produção (08/09): o isolate da edge tem teto
    // de memória e a telemetria já hasheia a imagem uma vez
    expect(await chaveCache({ imagemHash: '' })).toBe('')
    expect(await chaveCache({ imagemHash: HASH })).toMatch(/^[0-9a-f]{64}$/)
  })

  it('é a mesma para a mesma foto no mesmo contexto', async () => {
    const a = await chaveCache({ imagemHash: HASH, promptVersao: 'v5', vocabulario: ['ANA'] })
    const b = await chaveCache({ imagemHash: HASH, promptVersao: 'v5', vocabulario: ['ANA'] })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('MUDA quando a versão do prompt muda — senão a edição nova não faria efeito por 24h', async () => {
    const v5 = await chaveCache({ imagemHash: HASH, promptVersao: 'v5' })
    const v6 = await chaveCache({ imagemHash: HASH, promptVersao: 'v6' })
    expect(v5).not.toBe(v6)
  })

  it('muda com a foto, o hospital declarado, o modo, o vocabulário e a flag de turno', async () => {
    const base = { imagemHash: HASH, promptVersao: 'v5', hospital: '', modo: '', vocabulario: ['ANA'] }
    const k = await chaveCache(base)
    expect(await chaveCache({ ...base, imagemHash: 'b'.repeat(64) })).not.toBe(k)
    expect(await chaveCache({ ...base, hospital: 'hro' })).not.toBe(k)
    expect(await chaveCache({ ...base, modo: 'fds' })).not.toBe(k)
    expect(await chaveCache({ ...base, vocabulario: ['ANA', 'BETO'] })).not.toBe(k)
    expect(await chaveCache({ ...base, secoesTurno: true })).not.toBe(k)
  })
})

describe('LGPD do cache', () => {
  it('reconhece a leitura que traz nome completo de paciente', () => {
    expect(temNomeDePaciente({ casos: [{ pacienteIniciais: 'M.S.' }] })).toBe(false)
    expect(temNomeDePaciente({ casos: [{ pacienteIniciais: 'M.S.', pacienteNome: '' }] })).toBe(false)
    expect(temNomeDePaciente({
      casos: [{ pacienteIniciais: 'A.B.' }, { pacienteNome: 'Maria Clara Souza', convenio: 'PARTICULAR' }],
    })).toBe(true)
  })

  it('sobrevive a resposta sem casos', () => {
    expect(temNomeDePaciente({})).toBe(false)
    expect(temNomeDePaciente({ casos: [] })).toBe(false)
  })
})

describe('retry', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  const resposta = (status) => new Response(status === 200 ? '{}' : 'erro', { status })

  it('classifica só fila cheia, sobrecarga e falha do lado de lá', () => {
    expect(ehStatusRetentavel(429)).toBe(true)
    expect(ehStatusRetentavel(529)).toBe(true)
    expect(ehStatusRetentavel(500)).toBe(true)
    expect(ehStatusRetentavel(503)).toBe(true)
    expect(ehStatusRetentavel(400)).toBe(false) // schema inválido: repetir não conserta
    expect(ehStatusRetentavel(401)).toBe(false) // chave sem crédito: repetir só gasta tempo
    expect(ehStatusRetentavel(200)).toBe(false)
  })

  it('repete UMA vez no 529 e devolve o resultado da segunda', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(resposta(529))
      .mockResolvedValueOnce(resposta(200))
    vi.stubGlobal('fetch', fetchMock)
    const { res, tentativas } = await fetchComRetry('http://x', {}, { esperaMs: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(tentativas).toBe(2)
    expect(res.status).toBe(200)
  })

  it('NÃO repete uma terceira vez — a espera deixaria de ser aceitável', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(529))
    vi.stubGlobal('fetch', fetchMock)
    const { res, tentativas } = await fetchComRetry('http://x', {}, { esperaMs: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(tentativas).toBe(2)
    expect(res.status).toBe(529) // e o erro chega à tela, que é o certo
  })

  it('não repete em 400 nem em 401 (repetir não conserta e só gasta tempo)', async () => {
    for (const status of [400, 401]) {
      const fetchMock = vi.fn().mockResolvedValue(resposta(status))
      vi.stubGlobal('fetch', fetchMock)
      const { tentativas } = await fetchComRetry('http://x', {}, { esperaMs: 0 })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(tentativas).toBe(1)
    }
  })

  it('não repete quando deu certo de primeira', async () => {
    const fetchMock = vi.fn().mockResolvedValue(resposta(200))
    vi.stubGlobal('fetch', fetchMock)
    const { tentativas } = await fetchComRetry('http://x', {}, { esperaMs: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(tentativas).toBe(1)
  })
})
