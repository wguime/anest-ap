/**
 * Análise histórica de férias — semana ISO, ocupação, séries, rankings e
 * métricas/sugestões de gestão.
 */
import { describe, it, expect } from 'vitest'
import {
  semanaISO, segundaDaSemanaISO, labelSemana,
  ocupacaoPorDia, serieSemanal, rankingSemanas, metricasGestao, VAGAS_DIA,
} from '../../lib/feriasAnalise'

const reg = (nome, data) => ({ nome, data })

describe('semanaISO', () => {
  it.each([
    ['2026-01-01', 2026, 1],  // qui — semana 1 de 2026
    ['2026-07-13', 2026, 29],
    ['2026-12-28', 2026, 53], // 2026 tem 53 semanas ISO
    ['2027-01-01', 2026, 53], // sexta 01/01/27 ainda é a semana 53 de 2026
  ])('%s → ano %i semana %i', (data, ano, semana) => {
    expect(semanaISO(data)).toEqual({ ano, semana })
  })

  it('segunda da semana ISO faz o caminho inverso', () => {
    expect(segundaDaSemanaISO(2026, 29)).toBe('2026-07-13')
    expect(labelSemana(2026, 29)).toBe('13–17 jul')
  })

  it('label cruzando mês', () => {
    expect(labelSemana(2026, 27)).toBe('29 jun – 03 jul')
  })
})

describe('ocupacaoPorDia + serieSemanal', () => {
  it('exclui FDS e agrega por dia', () => {
    const porDia = ocupacaoPorDia([
      reg('A', '2026-07-13'), reg('B', '2026-07-13'),
      reg('C', '2026-07-12'), // domingo — fora
    ])
    expect(porDia.get('2026-07-13')).toEqual(['A', 'B'])
    expect(porDia.has('2026-07-12')).toBe(false)
  })

  it('série semanal: média por dia útil, semanas vazias = 0', () => {
    const dias = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']
    const regs = dias.flatMap((d) => [reg('A', d), reg('B', d)])
    const serie = serieSemanal(ocupacaoPorDia(regs), 2026)
    expect(serie).toHaveLength(53)
    expect(serie[28]).toEqual({ semana: 29, media: 2, max: 2 }) // 2 pessoas a semana toda
    expect(serie[0].media).toBe(0)
  })
})

describe('rankingSemanas', () => {
  it('semana cheia em todos os anos lidera; dezembro fica fora do "menos procuradas"', () => {
    const anoCheio = (ano, semanaCheia) => {
      const seg = segundaDaSemanaISO(ano, semanaCheia)
      const dias = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(`${seg}T12:00:00Z`)
        d.setUTCDate(d.getUTCDate() + i)
        return d.toISOString().slice(0, 10)
      })
      return dias.flatMap((d) => ['A', 'B', 'C', 'D'].map((n) => reg(n, d)))
    }
    const series = {
      2024: serieSemanal(ocupacaoPorDia(anoCheio(2024, 29)), 2024),
      2025: serieSemanal(ocupacaoPorDia(anoCheio(2025, 29)), 2025),
    }
    const { maisProcuradas, menosProcuradas } = rankingSemanas(series)
    expect(maisProcuradas[0].semana).toBe(29)
    expect(maisProcuradas[0].mediaAnos).toBe(4)
    for (const s of menosProcuradas) {
      expect(segundaDaSemanaISO(2025, s.semana).slice(5, 7)).not.toBe('12')
    }
  })
})

describe('metricasGestao', () => {
  const semana = (ano, seg, nomes) => {
    const out = []
    for (let i = 0; i < 5; i++) {
      const d = new Date(`${seg}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + i)
      const iso = d.toISOString().slice(0, 10)
      for (const n of nomes) out.push(reg(n, iso))
    }
    return out
  }

  it('conta utilização, teto e 7+ por ano', () => {
    const sete = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    const { porAno } = metricasGestao({
      registrosPorAno: { 2026: semana(2026, '2026-03-02', sete) },
      anoAtual: 2026,
    })
    expect(porAno).toHaveLength(1)
    expect(porAno[0].diasPessoa).toBe(35)
    expect(porAno[0].diasAcimaTeto).toBe(5) // 7 > VAGAS_DIA nos 5 dias
    expect(porAno[0].diasNoTeto).toBe(0)
    expect(porAno[0].utilizacaoPct).toBeGreaterThan(0)
  })

  it('gera sugestões quando os dados sustentam (7+, S1 baixo, ano seguinte)', () => {
    const sete = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    const { insights } = metricasGestao({
      registrosPorAno: {
        2026: semana(2026, '2026-08-03', sete), // tudo no S2 + 7 pessoas
        2027: semana(2027, '2027-02-01', ['A']),
      },
      anoAtual: 2026,
    })
    expect(insights.some((t) => t.includes('7+'))).toBe(true)
    expect(insights.some((t) => t.includes('1º semestre'))).toBe(true)
    expect(insights.some((t) => t.includes('2027'))).toBe(true)
  })

  it('sem dados → sem insights, sem crash', () => {
    const r = metricasGestao({ registrosPorAno: {}, anoAtual: 2026 })
    expect(r.porAno).toEqual([])
    expect(r.insights).toEqual([])
    expect(VAGAS_DIA).toBe(6)
  })
})
