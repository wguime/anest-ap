/**
 * aplicarAtribuicoes — CAUSA RAIZ dos erros 23/07 (Exames 3×PAULO, IOSC 3×CURY):
 * a atribuição POR SALA sobrescrevia TODAS as linhas e apagava os anestesistas
 * POR LINHA dos blocos multi (Exames/Umanitá/IOSC). Regra nova: linha com nome
 * PRÓPRIO explícito ≠ nome-base da sala NUNCA é sobrescrita (resolve o próprio
 * uid pelo dicionário).
 */
import { describe, it, expect } from 'vitest'
import { aplicarAtribuicoes, alvosTrocaResponsavel, salasDoHospital } from '../../pages/escala-cirurgica/utils'

const apelidoDe = (_sala, uid) => `APELIDO-${uid}`
const resolver = (nome) => ({ PAULO: 'uid-paulo', COSTA: 'uid-costa', MAURICIO: 'uid-mauricio' }[String(nome).trim().toUpperCase()] || null)

describe('aplicarAtribuicoes', () => {
  it('sala uniforme: atribuição sobrescreve todas as linhas (reatribuição Janaina→Cury)', () => {
    const casos = [
      { sala: 'CC - Sala 5', anestesista: 'JANAINA' },
      { sala: 'CC - Sala 5', anestesista: '//' },
      { sala: 'CC - Sala 5', anestesista: '' },
    ]
    const out = aplicarAtribuicoes(casos, { 'CC - Sala 5': 'uid-cury' }, apelidoDe, resolver)
    expect(out.every((c) => c.anestesistaUserId === 'uid-cury')).toBe(true)
    expect(out.every((c) => c.anestesista === 'APELIDO-uid-cury')).toBe(true)
  })

  it('bloco multi (Exames/IOSC): linha com nome PRÓPRIO ≠ base NÃO é sobrescrita', () => {
    const casos = [
      { sala: 'Exames', anestesista: 'PAULO', bloco: 'exames' },     // base
      { sala: 'Exames', anestesista: 'COSTA', bloco: 'exames' },     // própria
      { sala: 'Exames', anestesista: 'MAURICIO', bloco: 'exames' },  // própria
    ]
    const out = aplicarAtribuicoes(casos, { Exames: 'uid-paulo' }, apelidoDe, resolver)
    expect(out[0].anestesista).toBe('APELIDO-uid-paulo')      // base recebe a atribuição
    expect(out[0].anestesistaUserId).toBe('uid-paulo')
    expect(out[1].anestesista).toBe('COSTA')                  // própria: preservada
    expect(out[1].anestesistaUserId).toBe('uid-costa')        // uid resolvido pelo dicionário
    expect(out[2].anestesista).toBe('MAURICIO')
    expect(out[2].anestesistaUserId).toBe('uid-mauricio')
  })

  it('linha própria com uid já vindo da extração mantém o uid (não re-resolve)', () => {
    const casos = [
      { sala: 'IOSC', anestesista: 'CURY' },
      { sala: 'IOSC', anestesista: 'MELO', anestesistaUserId: 'uid-melo-extraido' },
    ]
    const out = aplicarAtribuicoes(casos, { IOSC: 'uid-cury' }, apelidoDe, resolver)
    expect(out[1].anestesista).toBe('MELO')
    expect(out[1].anestesistaUserId).toBe('uid-melo-extraido')
  })

  it('linha própria sem match no dicionário fica sem uid (nunca herda o da sala)', () => {
    const casos = [
      { sala: 'IOSC', anestesista: 'CURY' },
      { sala: 'IOSC', anestesista: 'NOME DESCONHECIDO' },
    ]
    const out = aplicarAtribuicoes(casos, { IOSC: 'uid-cury' }, apelidoDe, resolver)
    expect(out[1].anestesistaUserId).toBeNull()
    expect(out[1].anestesista).toBe('NOME DESCONHECIDO')
  })

  it('sem atribuição: preserva textos e uids como vieram', () => {
    const casos = [{ sala: 'Sala 1', anestesista: 'TIAGO', anestesistaUserId: 'uid-t' }]
    const out = aplicarAtribuicoes(casos, {}, apelidoDe, resolver)
    expect(out[0].anestesista).toBe('TIAGO')
    expect(out[0].anestesistaUserId).toBe('uid-t')
  })

  it('compat: 4º parâmetro ausente não quebra (linha própria fica sem uid)', () => {
    const casos = [
      { sala: 'Exames', anestesista: 'PAULO' },
      { sala: 'Exames', anestesista: 'COSTA' },
    ]
    const out = aplicarAtribuicoes(casos, { Exames: 'uid-paulo' }, apelidoDe)
    expect(out[1].anestesista).toBe('COSTA')
    expect(out[1].anestesistaUserId).toBeNull()
  })
})

describe('aplicarAtribuicoes — caso SEM anestesista ("?") e escolha manual (dono 26/07)', () => {
  it('caso "?" NÃO recebe o anestesista da sala (ficar sem dono é informação)', () => {
    const casos = [
      { sala: 'CO - Sala 3', anestesista: 'PAULO' },
      { sala: 'CO - Sala 3', anestesista: '?', semAnestesista: true },
    ]
    const out = aplicarAtribuicoes(casos, { 'CO - Sala 3': 'uid-paulo' }, apelidoDe, resolver)
    expect(out[0].anestesistaUserId).toBe('uid-paulo')
    expect(out[1].anestesistaUserId).toBeNull()
    expect(out[1].semAnestesista).toBe(true)
    expect(out[1].anestesista).not.toBe('APELIDO-uid-paulo')
  })

  it('"?" sem o flag (só o texto) também é preservado e marcado', () => {
    const casos = [{ sala: 'Imagem', anestesista: '?' }]
    const out = aplicarAtribuicoes(casos, { Imagem: 'uid-paulo' }, apelidoDe, resolver)
    expect(out[0].anestesistaUserId).toBeNull()
    expect(out[0].semAnestesista).toBe(true)
  })

  it('sala TODA "?" continua sem dono mesmo com atribuição', () => {
    const casos = [
      { sala: 'Hemodinâmica', anestesista: '?', semAnestesista: true },
      { sala: 'Hemodinâmica', anestesista: '', semAnestesista: true },
    ]
    const out = aplicarAtribuicoes(casos, { 'Hemodinâmica': 'uid-paulo' }, apelidoDe, resolver)
    expect(out.every((c) => c.anestesistaUserId === null)).toBe(true)
  })

  it('"?" não vira o nome-base da sala (as demais linhas seguem atribuíveis)', () => {
    const casos = [
      { sala: 'CC - Sala 2', anestesista: '?', semAnestesista: true }, // 1ª linha!
      { sala: 'CC - Sala 2', anestesista: 'JANAINA' },
      { sala: 'CC - Sala 2', anestesista: '//' },
    ]
    const out = aplicarAtribuicoes(casos, { 'CC - Sala 2': 'uid-cury' }, apelidoDe, resolver)
    expect(out[0].anestesistaUserId).toBeNull()          // o "?" segue sem dono
    expect(out[1].anestesistaUserId).toBe('uid-cury')    // base da sala foi reatribuída
    expect(out[2].anestesistaUserId).toBe('uid-cury')    // "//" herda
  })

  it('escolha MANUAL no caso vence a atribuição da sala (mesmo com nome igual)', () => {
    const casos = [
      { sala: 'Exames', anestesista: 'PAULO' },
      { sala: 'Exames', anestesista: 'PAULO', anestesistaManual: true, anestesistaUserId: 'uid-costa' },
    ]
    const out = aplicarAtribuicoes(casos, { Exames: 'uid-paulo' }, apelidoDe, resolver)
    expect(out[0].anestesistaUserId).toBe('uid-paulo')
    expect(out[1].anestesistaUserId).toBe('uid-costa') // não foi achatado pela sala
  })
})

describe('alvosTrocaResponsavel — modo SALA pega TODOS os não-terminados (dono 24/07)', () => {
  // O IOSC não é mais protegido AQUI: salas multi-anestesista vêm SPLIT por
  // anestesista no board (gruposExibicao) → o clique no cabeçalho passa casosAlvo
  // scoped e não chega a esta função. Modo SALA só roda em card de anestesista único.
  const iosc = [
    { id: 'a', sala: 'IOSC', anestesista: 'CURY', anestesistaUserId: 'uid-cury' },
    { id: 'b', sala: 'IOSC', anestesista: 'MELO', anestesistaUserId: 'uid-melo' },
    { id: 'c', sala: 'IOSC', anestesista: 'GUILHERME DIDOMENICO', anestesistaUserId: 'uid-dido' },
    { id: 'x', sala: 'Sala 2', anestesista: 'FERNANDA', anestesistaUserId: 'uid-f' },
  ]
  it('modo SALA atinge TODAS as linhas não-terminadas da sala (sem exclusão por próprio)', () => {
    const { alvos, proprios } = alvosTrocaResponsavel(iosc, 'IOSC')
    expect(alvos.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']) // todos da sala IOSC
    expect(proprios).toEqual([])                                    // sem mais "não mudam"
  })
  it('modo CASO atinge só o caso', () => {
    const { alvos, proprios } = alvosTrocaResponsavel(iosc, 'IOSC', iosc[1])
    expect(alvos.map((c) => c.id)).toEqual(['b'])
    expect(proprios).toEqual([])
  })
  it('sala uniforme: todas as linhas (inclusive "//"/vazias) vão juntas', () => {
    const sala5 = [
      { id: '1', sala: 'CC - Sala 5', anestesista: 'JANAINA', anestesistaUserId: 'uid-j' },
      { id: '2', sala: 'CC - Sala 5', anestesista: '//' },
      { id: '3', sala: 'CC - Sala 5', anestesista: '' },
    ]
    const { alvos, proprios } = alvosTrocaResponsavel(sala5, 'CC - Sala 5')
    expect(alvos.map((c) => c.id)).toEqual(['1', '2', '3'])
    expect(proprios).toEqual([])
  })
  it('caso terminado nunca entra (preserva quem de fato fez)', () => {
    const casos = [
      { id: '1', sala: 'S1', anestesista: 'X', anestesistaUserId: 'uid-x', statusCirurgia: 'terminada' },
      { id: '2', sala: 'S1', anestesista: 'X', anestesistaUserId: 'uid-x' },
    ]
    const { alvos } = alvosTrocaResponsavel(casos, 'S1')
    expect(alvos.map((c) => c.id)).toEqual(['2'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// salasDoHospital — seletor de "Adicionar caso" (pedido do dono 26/07): a lista
// trazia só as salas COM caso no dia, então sala que abriu não existia lá.
// ════════════════════════════════════════════════════════════════════════════
describe('salasDoHospital', () => {
  it('HRO: traz TODAS as salas da base, não só as que já têm caso', () => {
    const casos = [{ sala: 'Sala 2' }, { sala: 'Sala 6' }]
    const out = salasDoHospital('hro', casos)
    for (const s of ['Sala 1', 'Sala 3', 'Sala 5 - Emergência', 'Sala 7 - CO', 'IOSC', 'Hospital de Olhos']) {
      expect(out).toContain(s)
    }
    expect(out.length).toBeGreaterThan(casos.length)
  })

  it('Unimed: inclui CO, CC e os blocos auxiliares', () => {
    const out = salasDoHospital('unimed', [])
    expect(out).toContain('CO - Cesárea')
    expect(out).toContain('CC - Sala 1')
    expect(out).toContain('SRPA')
    expect(out).toContain('Umanitá')
  })

  it('não duplica sala que já está em uso', () => {
    const out = salasDoHospital('hro', [{ sala: 'Sala 2' }, { sala: 'Sala 2' }])
    expect(out.filter((s) => s === 'Sala 2')).toHaveLength(1)
  })

  it('a grafia EM USO vence a canônica (não cria sala separada no board)', () => {
    const out = salasDoHospital('hro', [{ sala: 'SALA 2' }])
    expect(out).toContain('SALA 2')
    expect(out).not.toContain('Sala 2')
  })

  it('sala fora da base (local novo já usado no dia) continua na lista', () => {
    const out = salasDoHospital('hro', [{ sala: 'Clínica Nova' }])
    expect(out).toContain('Clínica Nova')
  })

  it('hospital desconhecido → só o que está em uso', () => {
    expect(salasDoHospital('outro', [{ sala: 'Sala X' }])).toEqual(['Sala X'])
    expect(salasDoHospital('outro', [])).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Sala sem NINGUÉM vira "?" automaticamente (pedido do dono 26/07): antes saía
// com o campo em branco e só quem abrisse a sala percebia.
// ════════════════════════════════════════════════════════════════════════════
describe('aplicarAtribuicoes — sala sem ninguém vira "?" sozinha', () => {
  it('sala sem atribuição E sem nome importado sai como "?"', () => {
    const casos = [{ sala: 'Hemodinâmica', anestesista: '' }, { sala: 'Hemodinâmica', anestesista: '//' }]
    const out = aplicarAtribuicoes(casos, {}, apelidoDe, resolver)
    expect(out.every((c) => c.semAnestesista === true)).toBe(true)
    expect(out.every((c) => c.anestesista === '?')).toBe(true)
    expect(out.every((c) => c.anestesistaUserId === null)).toBe(true)
  })

  it('sala COM atribuição não vira "?" mesmo sem nome importado', () => {
    const casos = [{ sala: 'CO - Sala 3', anestesista: '' }]
    const out = aplicarAtribuicoes(casos, { 'CO - Sala 3': 'uid-paulo' }, apelidoDe, resolver)
    expect(out[0].semAnestesista).toBeFalsy()
    expect(out[0].anestesistaUserId).toBe('uid-paulo')
  })

  it('sala com nome importado (sem login) NÃO vira "?" — tem nome, falta vínculo', () => {
    const casos = [{ sala: 'CC - Sala 5', anestesista: 'NOME DESCONHECIDO' }]
    const out = aplicarAtribuicoes(casos, {}, apelidoDe, resolver)
    expect(out[0].semAnestesista).toBeFalsy()
    expect(out[0].anestesista).toBe('NOME DESCONHECIDO')
  })

  it('só a sala vazia vira "?" — as outras seguem intactas', () => {
    const casos = [
      { sala: 'CC - Sala 1', anestesista: 'PAULO' },
      { sala: 'Imagem', anestesista: '' },
    ]
    const out = aplicarAtribuicoes(casos, { 'CC - Sala 1': 'uid-paulo' }, apelidoDe, resolver)
    expect(out[0].semAnestesista).toBeFalsy()
    expect(out[1].semAnestesista).toBe(true)
  })

  it('escolha manual no caso segura a sala: linha vazia HERDA, não vira "?"', () => {
    // a sala tem alguém (COSTA) → a linha vazia é herança ("//"), não abandono
    const casos = [
      { sala: 'Exames', anestesista: 'COSTA', anestesistaManual: true, anestesistaUserId: 'uid-costa' },
      { sala: 'Exames', anestesista: '' },
    ]
    const out = aplicarAtribuicoes(casos, {}, apelidoDe, resolver)
    expect(out[0].anestesistaUserId).toBe('uid-costa')
    expect(out[0].semAnestesista).toBeFalsy()
    expect(out[1].semAnestesista).toBeFalsy()
  })
})
