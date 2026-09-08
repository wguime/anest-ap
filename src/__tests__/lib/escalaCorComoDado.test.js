/**
 * A cor do mapa como dado (Onda 4, item 4.3).
 *
 * Cada teste aqui trava uma lição que custou uma escala em produção:
 *
 * - 30/07: a Unimed publicou SEM AJUDA NENHUMA. O bloco Exames traz o
 *   anestesista em AZUL, o prompt só pedia azul no rodapé, e o guardrail
 *   anti-alucinação apagou a pessoa por "não estar no rodapé". Azul em qualquer
 *   lugar é ajuda, e o guardrail não pode apagar quem veio azul.
 * - 07/2026: "//" lido como "Tiago". O guardrail continua matando nome
 *   inventado — essa parte não pode afrouxar junto.
 * - 23/07: o AMARELO é intencional (a pessoa está em dois locais de propósito) e
 *   não pode virar suspeita de erro.
 */
import { describe, it, expect } from 'vitest'
import {
  corValida, primeiroNomeNorm, lerRodape,
  aplicarCorNosCasos, derivarRodape, blanquearForaDoRodape,
} from '../../../supabase/functions/_shared/escala-cor.ts'

describe('leitura do rodapé colorido', () => {
  it('aceita o contrato novo com cor por nome', () => {
    expect(lerRodape({ rodape: [{ nome: 'ANA', cor: 'vermelho' }, { nome: 'BETO', cor: 'azul' }] }))
      .toEqual([{ nome: 'ANA', cor: 'vermelho' }, { nome: 'BETO', cor: 'azul' }])
  })

  it('ainda aceita o contrato antigo (ordemLiberacao + ajudaExterna)', () => {
    expect(lerRodape({ ordemLiberacao: ['ANA', 'BETO'], ajudaExterna: ['BETO'] }))
      .toEqual([{ nome: 'ANA', cor: '' }, { nome: 'BETO', cor: 'azul' }])
  })

  it('preserva a anotação entre parênteses como UMA entrada, na posição', () => {
    const r = lerRodape({ rodape: [
      { nome: 'ANA', cor: 'vermelho' },
      { nome: 'BETO (CONSULTORIO)', cor: 'vermelho' },
      { nome: 'CARLA', cor: 'vermelho' },
    ] })
    expect(r.map((x) => x.nome)).toEqual(['ANA', 'BETO (CONSULTORIO)', 'CARLA'])
  })

  it('ignora cor desconhecida em vez de propagar lixo', () => {
    expect(corValida('roxo')).toBe('roxo')
    expect(corValida('AZUL')).toBe('azul')
    expect(corValida('turquesa')).toBe('')
    expect(corValida(undefined)).toBe('')
  })
})

describe('azul em qualquer lugar é ajuda (incidente 30/07)', () => {
  const rodape = [{ nome: 'ANA', cor: 'vermelho' }, { nome: 'BETO', cor: 'vermelho' }]

  it('o azul do CORPO entra na ajuda mesmo sem estar no rodapé', () => {
    const casos = [{ sala: 'Exames', anestesista: 'CRISTINA', cor: 'azul' }]
    const { ordemLiberacao, ajudaExterna } = derivarRodape(rodape, casos)
    expect(ordemLiberacao).toEqual(['ANA', 'BETO'])
    expect(ajudaExterna).toEqual(['CRISTINA'])
  })

  it('e o guardrail NÃO apaga esse anestesista', () => {
    const casos = [{ sala: 'Exames', anestesista: 'CRISTINA', cor: 'azul' }]
    const { ajudaExterna } = derivarRodape(rodape, casos)
    const r = blanquearForaDoRodape(casos, ['ANA', 'BETO'], ajudaExterna)
    expect(r.apagados).toBe(0)
    expect(r.casos[0].anestesista).toBe('CRISTINA')
  })

  it('mesmo se a derivação da ajuda falhar, a cor azul sozinha protege o caso', () => {
    const r = blanquearForaDoRodape(
      [{ anestesista: 'CRISTINA', cor: 'azul' }], ['ANA', 'BETO'], [],
    )
    expect(r.apagados).toBe(0)
    expect(r.casos[0].anestesista).toBe('CRISTINA')
  })

  it('não duplica quem já está azul no rodapé e no corpo', () => {
    const { ajudaExterna } = derivarRodape(
      [{ nome: 'ANA', cor: 'vermelho' }, { nome: 'CRISTINA', cor: 'azul' }],
      [{ anestesista: 'Cristina', cor: 'azul' }],
    )
    expect(ajudaExterna).toEqual(['CRISTINA'])
  })
})

describe('o guardrail continua matando nome inventado', () => {
  it('apaga quem não está no rodapé e não veio azul ("//" lido como Tiago)', () => {
    const r = blanquearForaDoRodape(
      [{ anestesista: 'TIAGO', cor: '' }], ['ANA', 'BETO'], [],
    )
    expect(r.apagados).toBe(1)
    expect(r.casos[0].anestesista).toBe('')
    expect(r.casos[0].semAnestesista).toBe(true) // visível p/ o plantonista cobrir
  })

  it('preserva "//" e vazio, e não roda sem rodapé', () => {
    const comMarca = blanquearForaDoRodape([{ anestesista: '//' }, { anestesista: '' }], ['ANA'], [])
    expect(comMarca.apagados).toBe(0)
    const semRodape = blanquearForaDoRodape([{ anestesista: 'QUEMQUER' }], [], [])
    expect(semRodape.apagados).toBe(0)
  })

  it('amarelo NÃO é suspeita: a pessoa está em dois locais de propósito', () => {
    const casos = [
      { sala: 'Sala 1', anestesista: 'ANA', cor: 'amarelo' },
      { sala: 'IOSC', anestesista: 'ANA', cor: 'amarelo' },
    ]
    const r = blanquearForaDoRodape(casos, ['ANA', 'BETO'], [])
    expect(r.apagados).toBe(0)
    expect(r.casos.every((c) => c.anestesista === 'ANA')).toBe(true)
    expect(r.casos.every((c) => c.cor === 'amarelo')).toBe(true) // a cor sobrevive p/ a tela
  })
})

describe('repeticao substitui o "//"', () => {
  it('vira "//" para a conferência, que já sabe herdar', () => {
    const [c] = aplicarCorNosCasos([{ anestesista: '', repeticao: true }])
    expect(c.anestesista).toBe('//')
  })

  it('não sobrescreve um nome que veio junto da marca de repetição', () => {
    const [c] = aplicarCorNosCasos([{ anestesista: 'ANA', repeticao: true }])
    expect(c.anestesista).toBe('ANA')
  })

  it('preserva a cor na mesma passada', () => {
    const [c] = aplicarCorNosCasos([{ anestesista: 'ANA', cor: 'azul' }])
    expect(c.cor).toBe('azul')
    expect(aplicarCorNosCasos([{ anestesista: 'ANA', cor: 'turquesa' }])[0].cor).toBe('')
  })
})

describe('primeiroNomeNorm', () => {
  it('colapsa acento, sobrenome e prefixo Ped', () => {
    expect(primeiroNomeNorm('João Henrique')).toBe('JOAO')
    expect(primeiroNomeNorm('Ped. Janaína')).toBe('JANAINA')
    expect(primeiroNomeNorm('GUILHERME M ELO')).toBe('GUILHERME')
    expect(primeiroNomeNorm('')).toBe('')
  })
})
