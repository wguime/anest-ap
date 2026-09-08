/**
 * Conferência headless = a conferência da tela, sem a tela (dono 08/09/2026).
 *
 * Cada caso aqui é uma regra que a aba de importação aplica antes de publicar e que a
 * publicação pela foto NÃO pode pular: duplicidade entre hospitais bloqueia até a
 * decisão (e a decisão viaja em linhaOverrides), a escala numérica confere o rodapé
 * com as férias do dia, a cauda sem cirurgia avisa, hora inválida e nome ambíguo
 * bloqueiam, a travessia da manhã sem dono avisa, o azul emprestado muda de aba, e o
 * turno já publicado só passa com --republicar (aí com `preservar`).
 */
import { describe, it, expect } from 'vitest'
import dadosNumerica from '@/data/escalaNumerica.json'
import { montarOrdem } from '@/lib/escalaNumerica'
import { conferirLote, montarRoster, validarHorario } from '@/lib/escalaConferenciaHeadless'

const perfis = [
  { id: 'uid-cury', nome: 'GUSTAVO CURY', role: 'anestesiologista' },
  { id: 'uid-edu', nome: 'EDUARDO SAVOLDI', role: 'anestesiologista' },
  { id: 'uid-ana', nome: 'ANA PAULA LIMA', role: 'anestesiologista' },
  { id: 'uid-beto', nome: 'BETO SOUZA', role: 'anestesiologista' },
  { id: 'uid-joao-h', nome: 'JOAO HENRIQUE VANNI', role: 'anestesiologista' },
  { id: 'uid-joao-r', nome: 'JOAO RICARDO MOREIRA', role: 'anestesiologista' },
  { id: 'uid-e2e', nome: 'E2E TESTER', role: 'anestesiologista', email: 'x+e2e@anest.app' },
]
const aliases = [
  { apelido: 'CURY', userId: 'uid-cury' }, { apelido: 'EDUARDO', userId: 'uid-edu' },
  { apelido: 'ANA', userId: 'uid-ana' }, { apelido: 'BETO', userId: 'uid-beto' },
  { apelido: 'JOAO HENRIQUE', userId: 'uid-joao-h' }, { apelido: 'JOAO RICARDO', userId: 'uid-joao-r' },
]
const identidade = montarRoster({ perfis, aliases })

const caso = (sala, anestesista, hora = '13:30', extra = {}) => ({
  sala, hora, anestesista, procedimento: `CIRURGIA ${sala}`, cirurgiao: 'DR TESTE',
  pacienteIniciais: 'A.B.', convenio: 'SUS', bloco: 'normal', tipo: 'eletiva', ...extra,
})

const conferir = (hospitais, extra = {}) => conferirLote({
  data: '2026-09-08', turno: 'vespertino', hospitais, ...identidade, dadosNumerica, ...extra,
})
const codigos = (r) => r.bloqueios.map((b) => b.codigo)
const avisos = (r) => r.avisos.map((a) => a.codigo)

describe('montarRoster — o mesmo roster do hook', () => {
  it('conta de teste fica fora, apelido resolve para o uid, conta duplicada resolve para a principal', () => {
    const r = montarRoster({
      perfis: [...perfis, { id: 'uid-cury-2', nome: 'GUSTAVO CURY', role: 'anestesiologista', contaDuplicadaDe: 'uid-cury' }],
      aliases: [...aliases, { apelido: 'CURY2', userId: 'uid-cury-2' }],
    })
    expect(r.roster.some((p) => p.nome === 'E2E TESTER')).toBe(false)
    expect(r.resolver('cury')).toBe('uid-cury')
    expect(r.resolver('CURY2')).toBe('uid-cury')
    expect(r.resolver('NINGUEM')).toBeNull()
    expect(r.rosterByUid.get('uid-cury').apelidos).toContain('CURY')
  })
})

describe('bloqueios — o que a tela recusa', () => {
  it('hora inválida (data colada) bloqueia e nomeia a sala', () => {
    const r = conferir({ unimed: { rows: [caso('CC - Sala 1', 'CURY', '08/09/2026 13:30')], ordem: ['CURY'], ajuda: [] } })
    expect(codigos(r.hospitais.unimed)).toContain('hora inválida')
    expect(r.hospitais.unimed.bloqueios.find((b) => b.codigo === 'hora inválida').texto).toMatch(/CC - Sala 1/)
    expect(validarHorario([{ hora: 'AS' }, { hora: '' }], 'vespertino').semHora).toBe(2)
  })

  it('nome ambíguo (JOAO com dois donos) bloqueia; o apelido inteiro passa', () => {
    const amb = conferir({ unimed: { rows: [caso('CC - Sala 1', 'JOAO')], ordem: ['JOAO'], ajuda: [] } })
    expect(codigos(amb.hospitais.unimed)).toContain('nome ambíguo')
    const ok = conferir({ unimed: { rows: [caso('CC - Sala 1', 'JOAO HENRIQUE')], ordem: ['JOAO HENRIQUE'], ajuda: [] } })
    expect(codigos(ok.hospitais.unimed)).not.toContain('nome ambíguo')
    expect(ok.hospitais.unimed.payload.casos[0].anestesistaUserId).toBe('uid-joao-h')
  })

  it('HRO/Unimed sem rodapé bloqueiam; Materno não', () => {
    const r = conferir({
      hro: { rows: [caso('Sala 1', 'CURY')], ordem: [], ajuda: [] },
      materno: { rows: [caso('Sala 3 HC', 'ANA')], ordem: [], ajuda: [] },
    })
    expect(codigos(r.hospitais.hro)).toContain('rodapé vazio')
    expect(codigos(r.hospitais.materno)).not.toContain('rodapé vazio')
  })

  it('turno já publicado bloqueia sem --republicar; com ele monta `preservar`', () => {
    const existente = {
      id: 'e-unimed', hospital: 'unimed', ordemLiberacao: { vespertino: ['CURY', 'ANA'] }, ajudaExterna: {},
      linhaOverrides: { 'vespertino:uid-cury': { observacao: 'ficou', por: 'x', em: 'y' } },
      publicacaoTurnos: { vespertino: { status: 'publicada' } },
      casos: [caso('CC - Sala 1', 'CURY', '13:30', { anestesistaUserId: 'uid-cury', turno: 'vespertino' })],
    }
    const hospitais = { unimed: { rows: [caso('CC - Sala 1', 'CURY'), caso('CC - Sala 2', 'ANA')], ordem: ['CURY', 'ANA'], ajuda: [] } }
    const trava = conferir(hospitais, { publicadas: { unimed: existente } })
    expect(codigos(trava.hospitais.unimed)).toContain('já publicado')
    const passa = conferir(hospitais, { publicadas: { unimed: existente }, republicar: true })
    expect(codigos(passa.hospitais.unimed)).not.toContain('já publicado')
    expect(passa.hospitais.unimed.payload.preservar.linhas.map((l) => l.chave)).toEqual(expect.arrayContaining(['uid-cury', 'uid-ana']))
  })
})

describe('duplicidade entre hospitais', () => {
  const dois = {
    unimed: { rows: [caso('CC - Sala 1', 'CURY')], ordem: ['CURY', 'ANA'], ajuda: [] },
    hro: { rows: [caso('Sala 1', 'CURY'), caso('Sala 2', 'BETO')], ordem: ['CURY', 'BETO'], ajuda: [] },
  }

  it('a mesma pessoa com caso em dois hospitais BLOQUEIA os dois até a decisão', () => {
    const r = conferir(dois)
    expect(codigos(r.hospitais.unimed)).toContain('duplicidade')
    expect(codigos(r.hospitais.hro)).toContain('duplicidade')
    expect(r.hospitais.unimed.bloqueios.find((b) => b.codigo === 'duplicidade').texto).toMatch(/CURY/)
  })

  it('"intencional" libera e viaja em linhaOverrides dos dois lados', () => {
    const r = conferir(dois, { decisoes: { CURY: { tipo: 'intencional' } }, carimbo: { por: 'u1', em: '2026-09-08T15:00:00.000Z' } })
    expect(codigos(r.hospitais.unimed)).not.toContain('duplicidade')
    expect(codigos(r.hospitais.hro)).not.toContain('duplicidade')
    expect(r.hospitais.unimed.payload.linhaOverrides['uid-cury']?.duplicidade).toBe('intencional')
    expect(r.hospitais.hro.payload.linhaOverrides['uid-cury']?.duplicidade).toBe('intencional')
  })

  it('"troca com X" grava trocaCom com o parceiro resolvido', () => {
    const r = conferir(dois, { decisoes: { CURY: { tipo: 'troca', parceiro: 'BETO' } }, carimbo: { por: 'u1', em: '2026-09-08T15:00:00.000Z' } })
    expect(codigos(r.hospitais.hro)).not.toContain('duplicidade')
    const ov = r.hospitais.hro.payload.linhaOverrides['uid-cury']
    expect(ov?.trocaCom).toMatchObject({ uid: 'uid-beto', nome: 'BETO', tipo: 'entre_hospitais', por: 'u1' })
  })

  it('a decisão já gravada na escala publicada não pergunta de novo', () => {
    const existente = {
      id: 'e-unimed', hospital: 'unimed', ordemLiberacao: { vespertino: ['CURY', 'ANA'] }, ajudaExterna: {},
      linhaOverrides: { 'vespertino:uid-cury': { duplicidade: 'intencional' } }, publicacaoTurnos: {}, casos: [],
    }
    const r = conferir(dois, { publicadas: { unimed: existente } })
    expect(codigos(r.hospitais.unimed)).not.toContain('duplicidade')
  })

  it('ajuda declarada no rodapé não é duplicidade por classificar', () => {
    const r = conferir({ ...dois, hro: { ...dois.hro, ajuda: ['CURY'] } })
    expect(codigos(r.hospitais.hro)).not.toContain('duplicidade')
  })
})

describe('avisos — a tela publica assim mesmo, mas diz', () => {
  it('cauda sem cirurgia e nome na ordem sem caso avisam; "conferidos" cala', () => {
    const hospitais = { unimed: { rows: [caso('CC - Sala 1', 'CURY'), caso('CC - Sala 2', 'BETO')], ordem: ['CURY', 'ANA', 'BETO', 'EDUARDO'], ajuda: [] } }
    const r = conferir(hospitais)
    expect(avisos(r.hospitais.unimed)).toContain('cauda')
    expect(avisos(r.hospitais.unimed)).toContain('na ordem sem caso')
    const ok = conferir(hospitais, { conferidos: ['ANA', 'EDUARDO'] })
    expect(avisos(ok.hospitais.unimed)).not.toContain('cauda')
    expect(avisos(ok.hospitais.unimed)).not.toContain('na ordem sem caso')
    expect(ok.hospitais.unimed.payload.linhaOverrides['uid-ana']?.conferido).toBe(true)
  })

  it('caso de quem não está no rodapé nem na ajuda avisa (azul não lido)', () => {
    const r = conferir({ unimed: { rows: [caso('CC - Sala 1', 'CURY'), caso('Exames', 'EDUARDO', '13:30', { bloco: 'exames' })], ordem: ['CURY'], ajuda: [] } })
    expect(avisos(r.hospitais.unimed)).toContain('fora da ordem')
    const ok = conferir({ unimed: { rows: [caso('CC - Sala 1', 'CURY'), caso('Exames', 'EDUARDO', '13:30', { bloco: 'exames' })], ordem: ['CURY'], ajuda: ['EDUARDO'] } })
    expect(avisos(ok.hospitais.unimed)).not.toContain('fora da ordem')
    expect(ok.hospitais.unimed.payload.ajudaExterna).toEqual(['EDUARDO'])
  })

  it('HRO sem Exames/Imagem/Hemodinâmica na leitura avisa por seção', () => {
    const r = conferir({ hro: { rows: [caso('Sala 1', 'CURY')], ordem: ['CURY'], ajuda: [] } })
    expect(r.hospitais.hro.avisos.find((a) => a.codigo === 'seção ausente').texto).toMatch(/Exames, Imagem, Hemodinâmica/)
  })

  it('cirurgia da manhã que passa para a tarde sem dono presente avisa (só à tarde)', () => {
    const existente = {
      id: 'e-unimed', hospital: 'unimed', ordemLiberacao: { matutino: ['ANA'] }, ajudaExterna: {}, linhaOverrides: {}, publicacaoTurnos: { matutino: { status: 'publicada' } },
      casos: [caso('CC - Sala 3', 'ANA', '07:30', { anestesistaUserId: 'uid-ana', turno: 'matutino', statusExtra: 'passa_tarde', statusCirurgia: 'iniciada' })],
    }
    const r = conferir({ unimed: { rows: [caso('CC - Sala 1', 'CURY')], ordem: ['CURY'], ajuda: [] } }, { publicadas: { unimed: existente } })
    expect(avisos(r.hospitais.unimed)).toContain('travessia órfã')
    const presente = conferir({ unimed: { rows: [caso('CC - Sala 1', 'CURY')], ordem: ['CURY', 'ANA'], ajuda: [] } }, { publicadas: { unimed: existente } })
    expect(avisos(presente.hospitais.unimed)).not.toContain('travessia órfã')
  })

  it('azul emprestado sai da ajuda de onde está no rodapé e entra na ajuda de onde trabalha', () => {
    const r = conferir({
      hro: { rows: [caso('Sala 1', 'CURY')], ordem: ['CURY', 'EDUARDO'], ajuda: ['EDUARDO'] },
      materno: { rows: [caso('Sala 3 HC', 'EDUARDO')], ordem: [], ajuda: [] },
    })
    expect(r.realocados).toEqual([{ nome: 'EDUARDO', de: 'hro', para: 'materno' }])
    expect(r.hospitais.hro.payload.ajudaExterna).toEqual([])
    expect(r.hospitais.materno.payload.ajudaExterna).toEqual(['EDUARDO'])
  })
})

describe('só os casos do turno entram na conferência (como a aba)', () => {
  it('a manhã do lote do Materno não rende aviso nem caso na tarde; a SRPA da Unimed ganha 09:00 só de manhã', () => {
    const r = conferir({
      materno: { rows: [caso('Sala 3 HC', '', '07:30'), caso('Sala 3 HC', '', '08:30'), caso('Sala 3 HC', 'ANA', '13:30')], ordem: [], ajuda: [] },
    })
    expect(r.hospitais.materno.payload.casos).toHaveLength(1)
    expect(avisos(r.hospitais.materno)).not.toContain('sem vínculo')
    const manha = conferirLote({
      data: '2026-09-08', turno: 'matutino', ...identidade, dadosNumerica,
      hospitais: { unimed: { rows: [caso('CC - Sala 1', 'CURY', '07:30')], posicoes: [{ local: 'SRPA', anestesista: 'ANA' }], ordem: ['CURY', 'ANA'], ajuda: [] } },
    })
    const srpa = manha.hospitais.unimed.payload.casos.find((c) => c.sala === 'SRPA')
    expect(srpa?.hora).toBe('09:00')
    expect(srpa?.anestesistaUserId).toBe('uid-ana')
  })
})

describe('escala numérica e férias', () => {
  const esperada = montarOrdem(dadosNumerica, { data: '2026-09-08', hospital: 'hro', turno: 'vespertino', ferias: null }).lista.map((p) => p.nome)

  it('rodapé igual à numérica não avisa; trocar dois nomes avisa "fora de ordem"', () => {
    const rows = [caso('Sala 1', esperada[0])]
    const igual = conferir({ hro: { rows, ordem: esperada, ajuda: [] } })
    expect(avisos(igual.hospitais.hro)).not.toContain('escala numérica')
    expect(igual.hospitais.hro.numerica?.iguais).toBe(true)
    const trocado = [...esperada]; [trocado[0], trocado[1]] = [trocado[1], trocado[0]]
    const r = conferir({ hro: { rows, ordem: trocado, ajuda: [] } })
    expect(r.hospitais.hro.avisos.find((a) => a.codigo === 'escala numérica').texto).toMatch(/fora de ordem/)
  })

  it('quem está de férias sai da lista esperada, e a conferência diz que as férias foram conferidas', () => {
    const semFerias = montarOrdem(dadosNumerica, { data: '2026-09-08', hospital: 'hro', turno: 'vespertino', ferias: ['THAYNÁ REGINA SANTOS'] }).lista.map((p) => p.nome)
    expect(semFerias).not.toContain('THAYNA')
    const r = conferir({ hro: { rows: [caso('Sala 1', semFerias[0])], ordem: semFerias, ajuda: [] } }, { ferias: ['THAYNÁ REGINA SANTOS'] })
    expect(r.hospitais.hro.numerica?.iguais).toBe(true)
    expect(r.hospitais.hro.numerica?.feriasConferidas).toBe(true)
    const semConsulta = conferir({ hro: { rows: [caso('Sala 1', semFerias[0])], ordem: semFerias, ajuda: [] } })
    expect(semConsulta.hospitais.hro.avisos.find((a) => a.codigo === 'escala numérica').texto).toMatch(/férias NÃO conferidas/)
  })
})
