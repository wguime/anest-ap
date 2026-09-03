/**
 * Escala NUMÉRICA como referência da ordem de liberação (dono 03/09/2026).
 *
 * Os exemplos abaixo são os que o dono pediu para conferir contra o PDF: um dia com R
 * vermelho, outro com U vermelho, a inversão manhã/tarde, uma coluna cinza, a inserção
 * da Louise e a exclusão por férias preservando a ordem relativa. Os valores esperados
 * foram conferidos visualmente na página renderizada (`.local/escala-numerica/pagina-1.png`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  ordemBase, inserirLouise, excluirFerias, montarOrdem, compararComRodape, casarNomeComLegenda, formatarOrdem,
} from '../../lib/escalaNumerica'

const dados = JSON.parse(readFileSync(resolve(__dirname, '../../data/escalaNumerica.json'), 'utf8'))
const nomes = (r) => r.lista.map((p) => p.nome)

describe('dataset — integridade do que foi extraído do PDF', () => {
  it('cobre 03/08 → 18/12 de 2026, dia útil a dia útil, com 5 feriados em cinza', () => {
    expect(dados.vigencia).toEqual({ inicio: '2026-08-03', fim: '2026-12-18' })
    expect(Object.keys(dados.dias)).toHaveLength(100)
    expect(Object.entries(dados.dias).filter(([, d]) => d.feriado).map(([k]) => k))
      .toEqual(['2026-08-25', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-20'])
  })
  it('cada coluna é a sequência circular impressa (44 → 01), sem repetição — nunca ordenada por valor', () => {
    for (const [data, d] of Object.entries(dados.dias)) {
      const ns = d.coluna.map((e) => Number(e.n))
      expect(new Set(ns).size, data).toBe(ns.length)
      for (let i = 1; i < ns.length; i += 1) {
        let esperado = ns[i - 1] + 1
        if (esperado === 43 && data < '2026-11-23') esperado = 44
        if (esperado === 45) esperado = 1
        expect(ns[i], `${data} posição ${i}`).toBe(esperado)
      }
    }
  })
  it('o 43 (Louise) só volta à grade a partir de 23/11; antes disso o quadro dela manda', () => {
    const com43 = Object.entries(dados.dias).filter(([, d]) => d.coluna.some((e) => e.n === '43')).map(([k]) => k)
    expect(com43[0]).toBe('2026-11-23')
    expect(dados.louise.vigencia).toEqual({ inicio: '2026-08-24', fim: '2026-11-20' })
  })
  it('a legenda tem os 44 números, grupo 1 ímpar em vermelho e grupo 2 par em preto', () => {
    expect(Object.keys(dados.legenda)).toHaveLength(44)
    for (const [n, e] of Object.entries(dados.legenda)) {
      expect(e.grupo, n).toBe(Number(n) % 2 === 1 ? 1 : 2)
      expect(e.cor, n).toBe(e.grupo === 1 ? 'vermelho' : 'preto')
    }
    expect(dados.legenda['05']).toMatchObject({ nome: 'HUMBERTO / ROBERTA', compartilhada: true })
    expect(dados.legenda['29'].nome).toBe('ALEXANDRE S')
    expect(dados.legenda['35'].nome).toBe('ALEXANDRE D')
    expect(dados.legenda['41'].nome).toBe('GUILHERME D')
  })
})

describe('cor do cabeçalho decide o hospital — dia a dia', () => {
  it('03/08 (seg): R vermelho → vermelhos são do HRO, pretos da Unimed', () => {
    expect(dados.dias['2026-08-03']).toMatchObject({ vermelho: 'hro', preto: 'unimed' })
    const hro = ordemBase(dados, { data: '2026-08-03', hospital: 'hro', turno: 'matutino' })
    expect(hro.corDoHospital).toBe('vermelho')
    expect(hro.posicoes.slice(0, 3).map((p) => `${p.numero} ${p.nome}`)).toEqual(['23 EDUARDO', '25 ERLEI', '27 NATHALIA'])
    expect(hro.posicoes.at(-1).nome).toBe('TIAGO')
    const unimed = ordemBase(dados, { data: '2026-08-03', hospital: 'unimed', turno: 'matutino' })
    expect(unimed.posicoes[0]).toMatchObject({ numero: '24', nome: 'CURY' })
    expect(hro.consultorio.map((c) => c.nome)).toEqual(['CRISTINA', 'LEANDRO', 'MELO'])
    expect(ordemBase(dados, { data: '2026-08-03', hospital: 'materno', turno: 'matutino' }).posicoes.map((p) => p.nome)).toEqual(['VICENTE', 'RAUL'])
  })
  it('04/08 (ter): U vermelho → a correspondência inverte', () => {
    expect(dados.dias['2026-08-04']).toMatchObject({ vermelho: 'unimed', preto: 'hro' })
    expect(ordemBase(dados, { data: '2026-08-04', hospital: 'unimed', turno: 'matutino' }).posicoes[0]).toMatchObject({ numero: '25', nome: 'ERLEI' })
    expect(ordemBase(dados, { data: '2026-08-04', hospital: 'hro', turno: 'matutino' }).posicoes[0]).toMatchObject({ numero: '24', nome: 'CURY' })
  })
  it('a sequência que passa de 44 para 01 conserva a ordem impressa', () => {
    const r = ordemBase(dados, { data: '2026-08-03', hospital: 'hro', turno: 'matutino' })
    const ns = r.posicoes.map((p) => p.numero)
    expect(ns.indexOf('41')).toBeLessThan(ns.indexOf('05'))
    // nada reordena por valor: a sequência impressa NÃO é a numérica crescente
    expect(ns).not.toEqual([...ns].sort((x, y) => Number(x) - Number(y)))
  })
})

describe('turno: manhã de cima para baixo, tarde de baixo para cima', () => {
  it('a tarde é a manhã invertida, sem segunda inversão', () => {
    const m = ordemBase(dados, { data: '2026-08-03', hospital: 'hro', turno: 'matutino' }).posicoes.map((p) => p.numero)
    const t = ordemBase(dados, { data: '2026-08-03', hospital: 'hro', turno: 'vespertino' }).posicoes.map((p) => p.numero)
    expect(t).toEqual([...m].reverse())
    expect(t[0]).toBe('21') // TIAGO abre a tarde
  })
})

describe('coluna cinza = feriado: a escala própria é uma FILA ÚNICA', () => {
  it('a escala de feriados tem 10 datas com 20 nomes cada; 40 pessoas, cada uma em 5 feriados (duas equipes alternadas)', () => {
    const F = dados.feriados.dias
    expect(Object.keys(F)).toHaveLength(10)
    const freq = {}
    for (const f of Object.values(F)) {
      expect(f.lista).toHaveLength(20)
      for (const n of f.lista) freq[n] = (freq[n] || 0) + 1
    }
    expect(Object.keys(freq)).toHaveLength(40)
    expect(new Set(Object.values(freq))).toEqual(new Set([5]))
  })
  it('25/08 (Dia do Município): a numérica cede lugar à fila do feriado, de cima para baixo de manhã', () => {
    const r = montarOrdem(dados, { data: '2026-08-25', hospital: 'hro', turno: 'matutino', ferias: [] })
    expect(r.ok).toBe(true)
    expect(r.filaUnica).toBe(true)
    expect(r.feriado).toBe('DIA DO MUNICIPIO')
    expect(nomes(r)[0]).toBe('FERNANDA')
    expect(nomes(r).at(-1)).toBe('MATHEUS')
    expect(r.lista).toHaveLength(20)
    expect(r.lista[0]).toMatchObject({ posicao: 1, numero: '34' })
  })
  it('à tarde a fila do feriado inverte; e o hospital pedido não muda a lista (é de todos)', () => {
    const m = nomes(montarOrdem(dados, { data: '2026-09-07', hospital: 'unimed', turno: 'matutino', ferias: [] }))
    const t = nomes(montarOrdem(dados, { data: '2026-09-07', hospital: 'hro', turno: 'vespertino', ferias: [] }))
    expect(m[0]).toBe('GIOVANA')
    expect(t).toEqual([...m].reverse())
    expect(nomes(montarOrdem(dados, { data: '2026-09-07', hospital: 'materno', turno: 'matutino', ferias: [] }))).toEqual(m)
  })
  it('"GUILHERME" é o Melo (04) e "JOAO" é o João Ricardo (06) — dono 03/09; nada fica sem número', () => {
    const r = montarOrdem(dados, { data: '2026-08-25', hospital: 'hro', turno: 'matutino', ferias: [] })
    expect(r.lista.filter((p) => !p.numero)).toEqual([])
    expect(r.lista.find((p) => p.impresso === 'GUILHERME')).toMatchObject({ numero: '04', nome: 'MELO' })
    expect(r.lista.find((p) => p.impresso === 'JOAO')).toMatchObject({ numero: '06', nome: 'JOAO RICARDO' })
    expect(r.pendencias.filter((p) => /não identifica/.test(p))).toHaveLength(0)
    // e Humberto/Roberta/Rose/Aline aparecem por si nos feriados, com o número compartilhado
    expect(r.lista.find((p) => p.nome === 'ROBERTA')).toMatchObject({ numero: '05' })
    expect(r.lista.find((p) => p.nome === 'ROSE / ALINE')).toMatchObject({ numero: '07' })
  })
  it('férias do Guilherme Melo tiram o "GUILHERME" do feriado', () => {
    const r = montarOrdem(dados, { data: '2026-08-25', hospital: 'hro', turno: 'matutino', ferias: ['Guilherme Souza Melo'] })
    expect(r.excluidos.map((e) => e.nome)).toEqual(['MELO'])
    expect(nomes(r)).not.toContain('MELO')
  })
  it('Louise já vem impressa no feriado: nada é inserido, ela aparece uma vez', () => {
    const r = montarOrdem(dados, { data: '2026-08-25', hospital: 'unimed', turno: 'vespertino', ferias: [] })
    expect(r.louise).toBeNull()
    expect(nomes(r).filter((n) => n === 'LOUISE')).toHaveLength(1)
  })
  it('férias também saem da fila do feriado preservando a ordem', () => {
    const sem = nomes(montarOrdem(dados, { data: '2026-08-25', hospital: 'hro', turno: 'matutino', ferias: [] }))
    const com = montarOrdem(dados, { data: '2026-08-25', hospital: 'hro', turno: 'matutino', ferias: ['Fernanda Guollo', 'Marcos Tadeu Cury'] })
    expect(com.excluidos.map((e) => e.nome)).toEqual(['FERNANDA', 'CURY'])
    expect(nomes(com)).toEqual(sem.filter((n) => !['FERNANDA', 'CURY'].includes(n)))
  })
  it('feriado da grade sem escala própria no dataset não inventa lista', () => {
    const semFeriados = { ...dados, feriados: { dias: {} } }
    const r = montarOrdem(semFeriados, { data: '2026-08-25', hospital: 'hro', turno: 'matutino', ferias: [] })
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('feriado')
    expect(r.pendencias[0]).toMatch(/registrar a ausência/)
  })
  it('fora da vigência e fim de semana também não inventam lista', () => {
    expect(montarOrdem(dados, { data: '2026-07-31', hospital: 'hro', turno: 'matutino' }).motivo).toBe('fora_da_vigencia')
    expect(montarOrdem(dados, { data: '2026-09-05', hospital: 'hro', turno: 'matutino' }).motivo).toBe('fim_de_semana')
  })
})

describe('Louise — quadro próprio, só à tarde, inserida (ninguém sai)', () => {
  it('24/08: U 1ª → Louise abre a tarde da Unimed; o 1º original vira 2º', () => {
    const r = montarOrdem(dados, { data: '2026-08-24', hospital: 'unimed', turno: 'vespertino', ferias: [] })
    expect(r.louise).toEqual({ posicao: 1, hospital: 'unimed' })
    expect(r.lista[0]).toMatchObject({ posicao: 1, numero: '43', nome: 'LOUISE', inserida: true })
    expect(r.lista[1]).toMatchObject({ posicao: 2, numero: '37', nome: 'MATHEUS' })
    expect(r.lista).toHaveLength(ordemBase(dados, { data: '2026-08-24', hospital: 'unimed', turno: 'vespertino' }).posicoes.length + 1)
  })
  it('26/08: R 2ª → no HRO ela entra em 2º, entre Leonardo e Marilio', () => {
    const r = montarOrdem(dados, { data: '2026-08-26', hospital: 'hro', turno: 'vespertino', ferias: [] })
    expect(nomes(r).slice(0, 3)).toEqual(['LEONARDO', 'LOUISE', 'MARILIO'])
  })
  it('não entra na manhã, nem no hospital que o quadro não indica, nem pelo 43 (não está na grade)', () => {
    expect(montarOrdem(dados, { data: '2026-08-24', hospital: 'unimed', turno: 'matutino', ferias: [] }).louise).toBeNull()
    expect(montarOrdem(dados, { data: '2026-08-24', hospital: 'hro', turno: 'vespertino', ferias: [] }).louise).toBeNull()
    expect(nomes(montarOrdem(dados, { data: '2026-08-24', hospital: 'hro', turno: 'vespertino', ferias: [] }))).not.toContain('LOUISE')
  })
  it('a partir de 23/11 o 43 está na grade e o quadro cala — sem duplicar', () => {
    const r = montarOrdem(dados, { data: '2026-11-23', hospital: 'hro', turno: 'vespertino', ferias: [] })
    expect(nomes(r).filter((n) => n === 'LOUISE')).toHaveLength(1)
    expect(r.louise).toBeNull()
  })
  it('05/11 e 06/11: o ordinal saiu cinza por erro de formatação (dono 03/09) — Louise entra normalmente', () => {
    for (const data of ['2026-11-05', '2026-11-06']) {
      const q = dados.louise.dias[data]
      expect(q.ordinalCinza).toBe(true) // o fato do PDF fica registrado
      const r = montarOrdem(dados, { data, hospital: q.hospital, turno: 'vespertino', ferias: [] })
      expect(r.louise).toEqual({ posicao: q.posicao, hospital: q.hospital })
      expect(r.lista[q.posicao - 1]).toMatchObject({ numero: '43', nome: 'LOUISE', inserida: true })
      expect(r.pendencias.some((p) => /Louise/.test(p))).toBe(false)
    }
  })
  it('inserirLouise é puro e não muda quem estava na lista', () => {
    const base = ordemBase(dados, { data: '2026-08-26', hospital: 'hro', turno: 'vespertino' }).posicoes
    const { posicoes } = inserirLouise(dados, { data: '2026-08-26', hospital: 'hro', turno: 'vespertino' }, base)
    expect(posicoes.filter((p) => p.numero !== '43')).toEqual(base)
  })
})

describe('férias (Pega Plantão) — exclusão preserva a ordem relativa', () => {
  const ferias = ['Gabriel Juan Kettenhuber Costa', 'João Ricardo Moreira', 'Karine Bedin', 'Marcos Tadeu Cury', 'Matheus Vieira da Cunha', 'Thayná Regina Santos']
  it('03/09 HRO manhã: saem João Ricardo, Gabriel e Karine; os outros mantêm a sequência e são renumerados', () => {
    const sem = montarOrdem(dados, { data: '2026-09-03', hospital: 'hro', turno: 'matutino', ferias: [] })
    const com = montarOrdem(dados, { data: '2026-09-03', hospital: 'hro', turno: 'matutino', ferias })
    expect(com.excluidos.map((e) => e.nome)).toEqual(['JOAO RICARDO', 'GABRIEL', 'KARINE'])
    expect(nomes(com)).toEqual(nomes(sem).filter((n) => !['JOAO RICARDO', 'GABRIEL', 'KARINE'].includes(n)))
    expect(com.lista.map((p) => p.posicao)).toEqual(com.lista.map((_, i) => i + 1))
    expect(com.feriasConferidas).toBe(true)
    expect(com.excluidos[0].fonte).toBe('Pega Plantão')
  })
  it('quem está de férias mas em OUTRO hospital não vira pendência; identidade desconhecida vira', () => {
    const r = montarOrdem(dados, { data: '2026-09-03', hospital: 'hro', turno: 'matutino', ferias: [...ferias, 'Fulano de Tal'] })
    expect(r.pendencias.filter((p) => /Marcos Tadeu Cury/.test(p))).toHaveLength(0)
    expect(r.pendencias.filter((p) => /Fulano de Tal/.test(p))).toHaveLength(1)
  })
  it('Louise entra ANTES da retirada por férias: a posição dela referencia a escala principal', () => {
    // 26/08 HRO tarde: Louise em 2º entre LEONARDO e MARILIO; com Leonardo de férias ela passa a abrir
    const r = montarOrdem(dados, { data: '2026-08-26', hospital: 'hro', turno: 'vespertino', ferias: ['Leonardo Ferrazzo'] })
    expect(nomes(r).slice(0, 2)).toEqual(['LOUISE', 'MARILIO'])
    expect(r.louise.posicao).toBe(2)
  })
  it('entrada compartilhada com um dos dois de férias fica com o outro; com os dois, sai', () => {
    const base = [{ numero: '05', nome: 'HUMBERTO / ROBERTA', nomes: ['HUMBERTO', 'ROBERTA'], compartilhada: true }]
    expect(excluirFerias(base, ['Humberto Hepp']).posicoes[0]).toMatchObject({ nome: 'ROBERTA', observacao: 'HUMBERTO de férias' })
    expect(excluirFerias(base, ['Humberto Hepp', 'Roberta Marina Grando']).excluidos).toHaveLength(1)
  })
  it('sem consulta ao Pega Plantão a lista sai marcada como pendente', () => {
    const r = montarOrdem(dados, { data: '2026-09-03', hospital: 'hro', turno: 'matutino' })
    expect(r.feriasConferidas).toBe(false)
    expect(r.pendencias.some((p) => /Pega Plantão/.test(p))).toBe(true)
  })
})

describe('casarNomeComLegenda — legenda × nome completo do Pega Plantão', () => {
  it.each([
    ['MATHEUS', 'Matheus Vieira da Cunha', true],
    ['THAYNA', 'Thayná Regina Santos', true],
    ['CURY', 'Marcos Tadeu Cury', true],
    ['ROSE', 'Rosemary Cury', true],
    ['CURY', 'Rosemary Cury', false],
    ['COSTA', 'Marcos Cardoso Costa', true],
    ['COSTA', 'Gabriel Juan Kettenhuber Costa', false],
    ['GABRIEL', 'Gabriel Juan Kettenhuber Costa', true],
    ['GUILHERME D', 'Guilherme Xavier Didomenico', true],
    ['MELO', 'Guilherme Souza Melo', true],
    ['GUILHERME D', 'Guilherme Souza Melo', false],
    ['ALEXANDRE S', 'Alexandre Schmidt', true],
    ['ALEXANDRE D', 'Alexandre Schmidt', false],
    ['ADRIANO', 'Adriano Dall´Magro', true],
    ['OSCAR', 'Oscar Augusto De Oliveira Morais', true],
    ['JOAO RICARDO', 'João Henrique Salvão Vanni', false],
  ])('%s × %s → %s', (legenda, completo, esperado) => {
    expect(casarNomeComLegenda(legenda, completo)).toBe(esperado)
  })
})

describe('compararComRodape — a numérica como conferência do rodapé lido', () => {
  it('03/09 HRO: aponta quem trocou de hospital e quem veio do consultório, e a sequência relativa bate', () => {
    const ferias = ['Gabriel Juan Kettenhuber Costa', 'João Ricardo Moreira', 'Karine Bedin', 'Marcos Tadeu Cury', 'Matheus Vieira da Cunha', 'Thayná Regina Santos']
    const r = montarOrdem(dados, { data: '2026-09-03', hospital: 'hro', turno: 'matutino', ferias })
    const rodape = 'GUILHERME MELO / ROMULO / GIOVANA / JOAO HENRIQUE / RAFAEL / DANIELA / NATHALIA / ADRIANO / RODNEI / GARIM / DIEGO / EDUARDO / MARILIO / LEONARDO / GABRIELA / OSCAR / CRISTINA / LEANDRO'.split(' / ')
    const c = compararComRodape(r.lista, rodape)
    expect(c.iguais).toBe(false)
    expect(c.faltamNoRodape).toEqual(['PAULO', 'KLISMAN', 'FERNANDA'])
    expect(c.sobramNoRodape).toEqual(['RAFAEL', 'DANIELA', 'NATHALIA', 'EDUARDO'])
    expect(c.foraDeOrdem).toEqual(['ROMULO'])
  })
  it('rodapé idêntico à lista esperada é "iguais"', () => {
    const r = montarOrdem(dados, { data: '2026-08-03', hospital: 'hro', turno: 'matutino', ferias: [] })
    expect(compararComRodape(r.lista, nomes(r)).iguais).toBe(true)
  })
})

describe('formatarOrdem — o resultado que o dono pediu', () => {
  it('traz data, turno, hospital, posição final + número + nome, consultório à parte, Louise, exclusões e pendências', () => {
    const txt = formatarOrdem(montarOrdem(dados, { data: '2026-08-24', hospital: 'unimed', turno: 'vespertino', ferias: ['Matheus Vieira da Cunha'] }))
    expect(txt).toContain('2026-08-24 · Tarde · Unimed')
    expect(txt).toContain(' 1. 43 LOUISE  ← Louise inserida')
    expect(txt).toContain('consultório: 15 GUSTAVO · 17 JANAINA · 19 FERNANDO')
    expect(txt).toContain('Louise: 1ª posição da tarde (Unimed)')
    expect(txt).toContain('excluídos por férias (Pega Plantão): 37 MATHEUS')
    // dia útil: o par compartilhado é a posição, como impresso — sem pendência (dono 03/09)
    expect(txt).toContain('05 HUMBERTO / ROBERTA')
    expect(txt).not.toContain('compartilhada')
  })
})
