/**
 * Recados do WhatsApp → marcações (dono 09/10/2026).
 *
 * A fixture principal é o recado REAL que o dono colou na conversa de 09/10 — o formato
 * de cópia do WhatsApp Desktop, com o "Plantão noturno" em várias linhas. O que trava:
 * o leitor das mensagens, as menções (o "Anest" do contato sai), a classificação de cada
 * tipo, a resolução de nome (dois donos = ambígua, nunca chute) e o plano por hospital.
 */
import { describe, it, expect } from 'vitest'
import { lerMensagens, mencoes, classificarRecado, resolverMencao, planejarRecados } from '@/lib/escalaRecados'

const RECADO_REAL = `[09/10/2026, 11:25:10] Escalas Anest: Consultório 13h30 - 46 consultas: @Gabriel Anest, @Giovana Anest e @Joao Moreira
[09/10/2026, 11:26:03] Escalas Anest: Consultório 13h30 - 03 consultas: @Matheus Cunha
[09/10/2026, 11:26:22] Escalas Anest: @Guilherme R1 na equipe do HRO no período vespertino
[09/10/2026, 11:28:14] Escalas Anest: Plantão noturno:
P1 @Guilherme R1
P2 @Alexandre Danielli Anest
P3 @Marílio `

const ROSTER = [
  { uid: 'u-gab', nome: 'Gabriel Rossi', apelidos: ['GABRIEL'] },
  { uid: 'u-gio', nome: 'Giovana Lima', apelidos: ['GIOVANA'] },
  { uid: 'u-jr', nome: 'João Ricardo Moreira', apelidos: ['JOAO RICARDO'] },
  { uid: 'u-jh', nome: 'João Henrique Lajus', apelidos: ['JOAO HENRIQUE'] },
  { uid: 'u-mat', nome: 'Matheus Cunha', apelidos: ['MATHEUS'] },
  { uid: 'u-gx', nome: 'Guilherme Xavier', apelidos: ['GUILHERME XAVIER'] },
  { uid: 'u-gm', nome: 'Guilherme Melo', apelidos: ['GUILHERME MELO'] },
  { uid: 'u-ad', nome: 'Alexandre Danielli', apelidos: ['ALEXANDRE D'] },
  { uid: 'u-mar', nome: 'Marílio Souza', apelidos: ['MARILIO'] },
]
// o dicionário do grupo resolve só o apelido EXATO, como o resolver da tela
const resolver = (n) => {
  const alvo = String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
  return ROSTER.find((p) => p.apelidos.includes(alvo))?.uid || null
}

describe('lerMensagens', () => {
  it('recado real do WhatsApp Desktop: 4 mensagens, o noturno com as linhas de baixo', () => {
    const ms = lerMensagens(RECADO_REAL)
    expect(ms).toHaveLength(4)
    expect(ms.map((m) => m.hora)).toEqual(['11:25', '11:26', '11:26', '11:28'])
    expect(ms[0].autor).toBe('Escalas Anest')
    expect(ms[3].texto).toContain('P3 @Marílio')
  })

  it('formato do WhatsApp Web ([hora, data])', () => {
    const ms = lerMensagens('[11:25, 09/10/2026] Coord.: Consultório 13h30: @Gabriel Anest')
    expect(ms).toEqual([{ hora: '11:25', autor: 'Coord.', texto: 'Consultório 13h30: @Gabriel Anest' }])
  })

  it('texto sem cabeçalho (transcrição de print): parágrafos e linhas que abrem recado', () => {
    const ms = lerMensagens('Consultório 13h30 - 03 consultas: @Matheus Cunha\n@Guilherme R1 na equipe do HRO no período vespertino\n\nPlantão noturno:\nP1 @Guilherme R1\nP2 @Marílio')
    expect(ms.map((m) => m.texto.split('\n')[0])).toEqual([
      'Consultório 13h30 - 03 consultas: @Matheus Cunha',
      '@Guilherme R1 na equipe do HRO no período vespertino',
      'Plantão noturno:',
    ])
    expect(ms[2].texto).toContain('P2 @Marílio')
  })
})

describe('mencoes', () => {
  it('lista com vírgula e "e"; o "Anest" do contato sai', () => {
    expect(mencoes('Consultório 13h30 - 46 consultas: @Gabriel Anest, @Giovana Anest e @Joao Moreira'))
      .toEqual(['Gabriel', 'Giovana', 'Joao Moreira'])
  })
  it('para antes do verbo/preposição', () => {
    expect(mencoes('@Guilherme R1 na equipe do HRO')).toEqual(['Guilherme R1'])
  })
})

describe('classificarRecado', () => {
  it('consultório com hora', () => {
    expect(classificarRecado('Consultório 13h30 - 03 consultas: @Matheus Cunha'))
      .toEqual({ tipo: 'consultorio', hora: '13:30', pessoas: ['Matheus Cunha'] })
  })
  it('equipe: hospital e fim do turno pelo "período vespertino" ou "até as 13h"', () => {
    expect(classificarRecado('@Guilherme R1 na equipe do HRO no período vespertino'))
      .toMatchObject({ tipo: 'equipe', hospital: 'hro', turno: 'vespertino', ate: '19:00', pessoas: ['Guilherme R1'] })
    expect(classificarRecado('@Raul na equipe da Unimed até as 13h'))
      .toMatchObject({ tipo: 'equipe', hospital: 'unimed', turno: 'matutino', ate: '13:00' })
  })
  it('plantão noturno: posições, sem o "Anest"', () => {
    const r = classificarRecado('Plantão noturno:\nP1 @Guilherme R1 \nP2 @Alexandre Danielli Anest \nP3 @Marílio ')
    expect(r.posicoes).toEqual([
      { posicao: 'P1', nome: 'Guilherme R1' },
      { posicao: 'P2', nome: 'Alexandre Danielli' },
      { posicao: 'P3', nome: 'Marílio' },
    ])
  })
  it('ajuda e troca', () => {
    expect(classificarRecado('@Gabi como ajuda no HRO')).toMatchObject({ tipo: 'ajuda', hospital: 'hro', pessoas: ['Gabi'] })
    expect(classificarRecado('@Rafael na posição do Diego no Iosc')).toMatchObject({ tipo: 'troca', a: 'Rafael', b: 'Diego' })
    expect(classificarRecado('Troca: @Joao Henrique com @Klisman')).toMatchObject({ tipo: 'troca', a: 'Joao Henrique', b: 'Klisman' })
  })
  it('o que não se reconhece fica como não reconhecido — nunca vira marca', () => {
    expect(classificarRecado('Bom dia a todos!').tipo).toBe('nao_reconhecido')
  })
})

describe('resolverMencao', () => {
  const ctx = { resolver, roster: ROSTER }
  it('apelido do dicionário', () => { expect(resolverMencao('Matheus', ctx).uid).toBe('u-mat') })
  it('todas as palavras no nome de UMA pessoa', () => {
    expect(resolverMencao('Joao Moreira', ctx).uid).toBe('u-jr')
    expect(resolverMencao('Alexandre Danielli', ctx).uid).toBe('u-ad')
  })
  it('"R1" não atrapalha, mas dois Guilhermes ficam ambíguos — sem chute', () => {
    const r = resolverMencao('Guilherme R1', ctx)
    expect(r.uid).toBeNull()
    expect(r.candidatos.map((c) => c.uid).sort()).toEqual(['u-gm', 'u-gx'])
  })
  it('escolha anterior deste aparelho resolve', () => {
    expect(resolverMencao('Guilherme R1', { ...ctx, lembrados: { 'GUILHERME R1': 'u-gx' } }).uid).toBe('u-gx')
  })
})

describe('planejarRecados — o recado real de 09/10', () => {
  const hospitais = {
    hro: { ordem: ['RAUL', 'GABRIEL', 'EDUARDO', 'GIOVANA', 'MAURICIO', 'JOAO RICARDO', 'STAUB', 'GUILHERME XAVIER', 'MATHEUS'] },
    unimed: { ordem: ['CURY', 'MARINA'] },
  }
  const plano = planejarRecados({
    mensagens: lerMensagens(RECADO_REAL), hospitais, turno: 'vespertino', resolver, roster: ROSTER,
    lembrados: { 'GUILHERME R1': 'u-gx' },
  })

  it('consultório vira nota nas posições do HRO, pela pessoa certa', () => {
    expect(plano[0].acoes.map((a) => [a.tipo, a.estado, a.hospital, a.nomeNaOrdem])).toEqual([
      ['nota', 'pronta', 'hro', 'GABRIEL'],
      ['nota', 'pronta', 'hro', 'GIOVANA'],
      ['nota', 'pronta', 'hro', 'JOAO RICARDO'],
    ])
    expect(plano[1].acoes[0]).toMatchObject({ tipo: 'nota', estado: 'pronta', nomeNaOrdem: 'MATHEUS' })
  })
  it('"na equipe do HRO no período vespertino" vira Equipe até 19h no HRO', () => {
    expect(plano[2].acoes[0]).toMatchObject({ tipo: 'equipe', estado: 'pronta', hospital: 'hro', ate: '19:00' })
    expect(plano[2].acoes[0].pessoa.uid).toBe('u-gx')
  })
  it('plantão noturno só confere', () => {
    expect(plano[3].acoes[0]).toMatchObject({ tipo: 'noturno', estado: 'info' })
  })
  it('sem a escolha anterior, o Guilherme R1 espera um toque', () => {
    const p = planejarRecados({ mensagens: lerMensagens(RECADO_REAL), hospitais, turno: 'vespertino', resolver, roster: ROSTER })
    expect(p[2].acoes[0].estado).toBe('ambigua')
  })
  it('recado da equipe da TARDE colado na publicação da MANHÃ não marca', () => {
    const p = planejarRecados({ mensagens: lerMensagens(RECADO_REAL), hospitais, turno: 'matutino', resolver, roster: ROSTER, lembrados: { 'GUILHERME R1': 'u-gx' } })
    expect(p[2].acoes[0]).toMatchObject({ estado: 'info', motivo: 'é do turno da tarde' })
  })
  it('quem não está em nenhuma ordem do lote não ganha marca', () => {
    const p = planejarRecados({ mensagens: lerMensagens('Consultório 13h30: @Marílio'), hospitais, turno: 'vespertino', resolver, roster: ROSTER })
    expect(p[0].acoes[0].estado).toBe('sem_alvo')
  })
})
