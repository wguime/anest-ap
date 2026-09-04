/**
 * Rascunho durável da conferência em lote (Onda 2; audit A7).
 *
 * O que estas travas protegem: o rascunho guarda a leitura e o trabalho — NUNCA a imagem;
 * volta só quando é dele mesmo (versão, data, turno) e ainda vale (24 h); o storage é
 * tolerante a falha; e a gravação com debounce grava UMA vez por rajada, mas `flush`
 * grava na hora (o iOS mata a PWA sem esperar timer).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  VERSAO_RASCUNHO, VALIDADE_RASCUNHO_MS, PREFIXO_RASCUNHO,
  chaveRascunho, decodificarChaveRascunho, limparParaRascunho, montarRascunho,
  serializarRascunho, restaurarRascunho, rascunhoExpirado, escalaMudouDepoisDoRascunho,
  descreverMomentoRascunho, hospitaisDoRascunho,
  lerRascunho, gravarRascunho, apagarRascunho, limparRascunhosExpirados, criarGravadorRascunho,
} from '@/lib/escalaLoteRascunho'

const AGORA = Date.parse('2026-09-04T12:41:00-03:00')

function storageFake(inicial = {}) {
  const m = new Map(Object.entries(inicial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size },
    _m: m,
  }
}

const lidoHro = {
  nome: 'hro.png', truncado: false,
  lote: {
    rows: [{ _lid: 'l1', sala: 'Sala 1', hora: '13:00', anestesista: 'CURY', pacienteIniciais: 'A.B.' }],
    posicoes: [], ordemLiberacao: ['CURY', 'PAULO'], ajudaExterna: [],
  },
}
const trabalhoHro = {
  casos: [{ _lid: 'l1', sala: 'Sala 1', hora: '13:30', anestesista: 'CURY', pacienteIniciais: 'A.B.', turno: 'vespertino' }],
  atribuicoes: { 'Sala 1': 'uid-cury' }, ordemTexto: 'CURY, PAULO', ajudaTexto: '',
}

const montar = (extra = {}) => montarRascunho({
  data: '2026-09-04', turno: 'vespertino',
  hospitais: { hro: { lido: lidoHro, trabalho: trabalhoHro, escalaPublicadaUpdatedAt: '2026-09-04T11:00:00.000Z' } },
  decisoes: { 'uid-cury': { tipo: 'ajuda' } }, trocas: {}, publicados: [], abaAtiva: 'hro',
  ...extra,
}, { agora: AGORA })

describe('chave do rascunho', () => {
  it('é escala-lote:<data>:<turno>, e só para data ISO e turno de publicação', () => {
    expect(chaveRascunho('2026-09-04', 'vespertino')).toBe('escala-lote:2026-09-04:vespertino')
    expect(chaveRascunho('04/09/2026', 'vespertino')).toBe('')
    expect(chaveRascunho('2026-09-04', 'noturno')).toBe('')
    expect(chaveRascunho('', '')).toBe('')
  })
  it('decodifica a própria chave e recusa as alheias', () => {
    expect(decodificarChaveRascunho('escala-lote:2026-09-04:matutino')).toEqual({ data: '2026-09-04', turno: 'matutino' })
    expect(decodificarChaveRascunho('anest-roster-cache')).toBeNull()
  })
})

describe('montar — o rascunho nunca leva a imagem', () => {
  it('arranca File/Blob, chaves de arquivo e strings que são conteúdo binário', () => {
    const arquivo = new File(['x'], 'hro.png', { type: 'image/png' })
    const r = montarRascunho({
      data: '2026-09-04', turno: 'vespertino',
      hospitais: {
        hro: {
          lido: { ...lidoHro, arquivo, imageBase64: 'AAAA', extra: { blob: new Blob(['x']), dataUrl: 'data:image/png;base64,AAAA' } },
          trabalho: { ...trabalhoHro, nota: 'x'.repeat(30000), ok: 'x'.repeat(100) },
        },
      },
    }, { agora: AGORA })
    const texto = serializarRascunho(r)
    expect(texto).not.toContain('AAAA')
    expect(texto).not.toContain('data:image')
    expect(r.hospitais.hro.lido.arquivo).toBeUndefined()
    expect(r.hospitais.hro.lido.imageBase64).toBeUndefined()
    expect(r.hospitais.hro.lido.extra).toEqual({})
    expect(r.hospitais.hro.trabalho.nota).toBeUndefined()
    expect(r.hospitais.hro.trabalho.ok).toBe('x'.repeat(100))
    // o que é dado de escala continua inteiro
    expect(r.hospitais.hro.lido.lote.rows[0]._lid).toBe('l1')
    expect(r.hospitais.hro.trabalho.casos[0].hora).toBe('13:30')
  })

  it('carimba versão, criação e atualização; a criação sobrevive às gravações seguintes', () => {
    const r1 = montar()
    expect(r1.versao).toBe(VERSAO_RASCUNHO)
    expect(r1.criadoEm).toBe(new Date(AGORA).toISOString())
    const r2 = montarRascunho({
      data: '2026-09-04', turno: 'vespertino', hospitais: { hro: { lido: lidoHro } }, criadoEm: r1.criadoEm,
    }, { agora: AGORA + 60000 })
    expect(r2.criadoEm).toBe(r1.criadoEm)
    expect(r2.atualizadoEm).toBe(new Date(AGORA + 60000).toISOString())
  })

  it('sem hospital lido não há rascunho (faixa vazia não ajuda ninguém)', () => {
    expect(montarRascunho({ data: '2026-09-04', turno: 'vespertino', hospitais: {} }, { agora: AGORA })).toBeNull()
    expect(montarRascunho({ data: '2026-09-04', turno: 'vespertino', hospitais: { hro: { trabalho: trabalhoHro } } }, { agora: AGORA })).toBeNull()
    expect(montarRascunho({ data: 'x', turno: 'vespertino', hospitais: { hro: { lido: lidoHro } } }, { agora: AGORA })).toBeNull()
  })

  it('Map e Set viram JSON; função e undefined somem', () => {
    expect(limparParaRascunho({ a: new Map([['k', 1]]), b: new Set(['x']), c: () => 1, d: undefined, e: null })).toEqual({ a: { k: 1 }, b: ['x'], e: null })
  })
})

describe('restaurar — só volta o que é dele mesmo e ainda vale', () => {
  it('ida e volta pelo JSON preserva leitura, trabalho e decisões', () => {
    const r = montar()
    const volta = restaurarRascunho(serializarRascunho(r), { agora: AGORA + 1000 })
    expect(volta.ok).toBe(true)
    expect(volta.rascunho.hospitais.hro.trabalho.casos[0].hora).toBe('13:30')
    expect(volta.rascunho.decisoes['uid-cury']).toEqual({ tipo: 'ajuda' })
    expect(hospitaisDoRascunho(volta.rascunho)).toEqual(['hro'])
  })

  it('vale por 24 h a partir da última gravação, nem um minuto a mais', () => {
    const r = montar()
    expect(rascunhoExpirado(r, AGORA + VALIDADE_RASCUNHO_MS - 60000)).toBe(false)
    expect(rascunhoExpirado(r, AGORA + VALIDADE_RASCUNHO_MS + 60000)).toBe(true)
    expect(restaurarRascunho(r, { agora: AGORA + VALIDADE_RASCUNHO_MS + 60000 })).toEqual({ ok: false, motivo: 'expirado' })
  })

  it('versão desconhecida, lixo e rascunho sem hospital não restauram', () => {
    expect(restaurarRascunho({ ...montar(), versao: 99 }, { agora: AGORA })).toEqual({ ok: false, motivo: 'versao' })
    expect(restaurarRascunho('{"versao":', { agora: AGORA })).toEqual({ ok: false, motivo: 'invalido' })
    expect(restaurarRascunho('[]', { agora: AGORA })).toEqual({ ok: false, motivo: 'invalido' })
    expect(restaurarRascunho(null, { agora: AGORA })).toEqual({ ok: false, motivo: 'vazio' })
    expect(restaurarRascunho({ ...montar(), hospitais: { hro: { trabalho: {} } } }, { agora: AGORA })).toEqual({ ok: false, motivo: 'sem_hospitais' })
    expect(restaurarRascunho({ ...montar(), turno: 'noturno' }, { agora: AGORA })).toEqual({ ok: false, motivo: 'invalido' })
  })
})

describe('a escala publicada mudou depois do rascunho?', () => {
  it('compara com o updated_at que o rascunho viu por último', () => {
    const r = montar() // viu 11:00Z
    expect(escalaMudouDepoisDoRascunho(r, 'hro', '2026-09-04T16:40:00.000Z')).toBe(true)
    expect(escalaMudouDepoisDoRascunho(r, 'hro', '2026-09-04T11:00:00.000Z')).toBe(false)
    expect(escalaMudouDepoisDoRascunho(r, 'hro', '2026-09-04T10:00:00.000Z')).toBe(false)
    expect(escalaMudouDepoisDoRascunho(r, 'hro', null)).toBe(false)
  })
  it('sem updated_at visto, a referência é a criação do rascunho', () => {
    const r = montarRascunho({ data: '2026-09-04', turno: 'vespertino', hospitais: { hro: { lido: lidoHro } } }, { agora: AGORA })
    expect(escalaMudouDepoisDoRascunho(r, 'hro', new Date(AGORA + 3600000).toISOString())).toBe(true)
    expect(escalaMudouDepoisDoRascunho(r, 'hro', new Date(AGORA - 3600000).toISOString())).toBe(false)
    expect(escalaMudouDepoisDoRascunho(r, 'materno', new Date(AGORA + 3600000).toISOString())).toBe(true)
  })
})

describe('momento do rascunho para a faixa', () => {
  it('hora no mesmo dia; "ontem às" quando virou o dia (fuso da suíte: America/Sao_Paulo)', () => {
    const r = montar()
    expect(descreverMomentoRascunho(r, AGORA + 3600000)).toBe('12:41')
    expect(descreverMomentoRascunho(r, AGORA + 24 * 3600000 - 60000)).toBe('ontem às 12:41')
    expect(descreverMomentoRascunho({ atualizadoEm: 'x' }, AGORA)).toBe('')
  })
})

describe('storage — tolerante a falha e limpa o que venceu', () => {
  it('grava, lê e apaga na chave do lote', () => {
    const storage = storageFake()
    const chave = chaveRascunho('2026-09-04', 'vespertino')
    expect(gravarRascunho(chave, montar(), { storage })).toBe(true)
    expect(lerRascunho(chave, { storage, agora: AGORA + 1000 }).ok).toBe(true)
    apagarRascunho(chave, { storage })
    expect(lerRascunho(chave, { storage, agora: AGORA + 1000 })).toEqual({ ok: false, motivo: 'vazio' })
  })

  it('rascunho vencido ou inválido é apagado ao ser lido', () => {
    const chave = chaveRascunho('2026-09-04', 'vespertino')
    const storage = storageFake({ [chave]: serializarRascunho(montar()), 'escala-lote:x': 'lixo' })
    expect(lerRascunho(chave, { storage, agora: AGORA + VALIDADE_RASCUNHO_MS + 1 })).toEqual({ ok: false, motivo: 'expirado' })
    expect(storage.getItem(chave)).toBeNull()
    expect(lerRascunho('escala-lote:x', { storage, agora: AGORA })).toEqual({ ok: false, motivo: 'invalido' })
    expect(storage.getItem('escala-lote:x')).toBeNull()
  })

  it('a limpeza só toca nas chaves do prefixo', () => {
    const vivo = chaveRascunho('2026-09-04', 'vespertino')
    const velho = chaveRascunho('2026-09-03', 'vespertino')
    const storage = storageFake({
      [vivo]: serializarRascunho(montar()),
      [velho]: serializarRascunho(montarRascunho({ data: '2026-09-03', turno: 'vespertino', hospitais: { hro: { lido: lidoHro } } }, { agora: AGORA - 2 * VALIDADE_RASCUNHO_MS })),
      'anest-roster-cache': '{"x":1}',
    })
    expect(limparRascunhosExpirados({ storage, agora: AGORA })).toBe(1)
    expect(storage.getItem(vivo)).not.toBeNull()
    expect(storage.getItem(velho)).toBeNull()
    expect(storage.getItem('anest-roster-cache')).toBe('{"x":1}')
    expect(PREFIXO_RASCUNHO).toBe('escala-lote:')
  })

  it('storage que estoura (modo privado, quota) não derruba nada', () => {
    const quebrado = {
      getItem: () => { throw new Error('quota') }, setItem: () => { throw new Error('quota') },
      removeItem: () => { throw new Error('quota') }, key: () => { throw new Error('x') }, length: 1,
    }
    const chave = chaveRascunho('2026-09-04', 'vespertino')
    expect(gravarRascunho(chave, montar(), { storage: quebrado })).toBe(false)
    expect(lerRascunho(chave, { storage: quebrado })).toEqual({ ok: false, motivo: 'vazio' })
    expect(() => apagarRascunho(chave, { storage: quebrado })).not.toThrow()
    expect(limparRascunhosExpirados({ storage: quebrado })).toBe(0)
    expect(gravarRascunho(chave, montar(), { storage: null })).toBe(false)
  })
})

describe('gravador com debounce de 500 ms', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('uma rajada de mudanças vira UMA gravação, com o último estado', () => {
    const storage = storageFake()
    const chave = chaveRascunho('2026-09-04', 'vespertino')
    const set = vi.spyOn(storage, 'setItem')
    const g = criarGravadorRascunho({ chave, storage })
    g.agendar(montar({ abaAtiva: 'unimed' }))
    vi.advanceTimersByTime(300)
    g.agendar(montar({ abaAtiva: 'hro' }))
    vi.advanceTimersByTime(300)
    expect(set).not.toHaveBeenCalled()          // 600 ms desde o 1º, 300 desde o último
    expect(g.temPendente()).toBe(true)
    vi.advanceTimersByTime(200)
    expect(set).toHaveBeenCalledTimes(1)
    expect(JSON.parse(storage.getItem(chave)).abaAtiva).toBe('hro')
    expect(g.temPendente()).toBe(false)
  })

  it('flush grava na hora; cancelar descarta; apagar remove do storage', () => {
    const storage = storageFake()
    const chave = chaveRascunho('2026-09-04', 'vespertino')
    const g = criarGravadorRascunho({ chave, storage })
    g.agendar(montar())
    expect(g.flush()).toBe(true)
    expect(storage.getItem(chave)).not.toBeNull()
    expect(g.flush()).toBe(false)                // nada pendente
    g.agendar(montar({ abaAtiva: 'unimed' }))
    g.cancelar()
    vi.advanceTimersByTime(1000)
    expect(JSON.parse(storage.getItem(chave)).abaAtiva).toBe('hro')
    g.apagar()
    expect(storage.getItem(chave)).toBeNull()
  })
})
