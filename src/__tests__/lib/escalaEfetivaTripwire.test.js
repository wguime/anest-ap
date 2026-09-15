/**
 * TRIPWIRE — ninguém lê a tabela estática de plantão "direto" sem passar por aqui.
 *
 * Os módulos de troca (residência, sobreaviso materno, hospitais FDS, feriados da
 * numérica) têm uma BASE estática e as trocas aceitas viram override (Firestore) ou
 * são aplicadas na leitura (feriados). Ler a base sozinha é ler a escala de ANTES
 * das trocas — foi assim que, em 27/07/2026, um residente que trocou o dia 20 pelo
 * 19 continuou marcado no 20 em "Consultar Plantões", e o lembrete "Plantão amanhã"
 * saiu para a pessoa errada (v5.12.4 corrigiu cinco lugares com o mesmo defeito).
 *
 * Este teste varre `src/` atrás dos acessos crus à base e exige que cada arquivo que
 * os faz esteja na allowlist abaixo, com o motivo. Arquivo novo (ou ocorrência a mais
 * num arquivo conhecido) FALHA aqui — e a correção quase sempre é usar a escala
 * efetiva: `getResidenteEfetivo`/`getDatasDoResidente`, `getDatasDaSobreavisista(id,
 * from, overrides)`, `getHospitaisEfetivos`/`getSlotsFuncionariaNaData(..., overrides)`,
 * `filaEfetiva`/`feriadosDaPessoa(..., { trocas })`. Se a leitura crua for mesmo
 * necessária (fallback DEPOIS do override, faixa do calendário, rótulo), acrescente
 * o arquivo à allowlist dizendo por quê.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const RAIZ = resolve(__dirname, '../../..')
const SRC = join(RAIZ, 'src')

// Acesso cru à base (o que precisa de override por cima)
const PADROES = [
  /PLANTOES_2026\s*\[/,
  /Object\.(entries|keys|values)\(\s*PLANTOES_2026\s*\)/,
  /SOBREAVISO_MATERNO_2026\s*\[/,
  /getSobreavisoBase\(\)\s*\[/,
  /Object\.(entries|keys|values)\(\s*getSobreavisoBase\(\)\s*\)/,
  /HOSPITAIS_2026\s*\[/,
  /getHospitaisBase\(\)\s*\[/,
  /Object\.(entries|keys|values)\(\s*getHospitaisBase\(\)\s*\)/,
  /\bfilaImpressa\(/,
]

/**
 * Arquivo → { max, motivo }. `max` é o número de ocorrências toleradas hoje; subir
 * o número exige dizer por quê na revisão. Os módulos de dados (src/data) e os
 * testes ficam fora da varredura: são a própria base e as fixtures.
 */
const ALLOWLIST = {
  'src/lib/trocasFeriado.js': {
    max: 3,
    motivo: 'é a lib que DEFINE filaImpressa e a converte em filaEfetiva',
  },
  'src/pages/ConsultaPlantoesPage.jsx': {
    max: 1,
    motivo: '"tem escala neste dia?" — só decide se mostra o card; quem está lá vem dos overrides',
  },
  'src/pages/ConsultaSobreavisoPage.jsx': {
    max: 2,
    motivo: 'faixa min/max do calendário e "tem escala?"; bolinhas e detalhe usam overrides',
  },
  'src/components/hospitais/PlantaoTradeRequestForm.jsx': {
    max: 1,
    motivo: 'só o rótulo do feriado (label); os slots vêm de getSlotsFuncionariaNaData com overrides',
  },
  'src/hooks/useResidenteShiftReminders.js': {
    max: 1,
    motivo: 'fallback DEPOIS de consultar residenciaPlantaoDiario',
  },
  'src/hooks/useFuncionariaShiftReminders.js': {
    max: 2,
    motivo: 'fallback DEPOIS dos overrides de sobreavisoMaternoDiario/hospitaisDiario',
  },
  'src/services/trocaPlantaoHospitalarService.js': {
    max: 2,
    motivo: 'escalaBaseDoDia + default do parâmetro; o serviço aplica overridesDoDia por cima',
  },
}

function arquivosDe(dir) {
  const out = []
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome)
    if (statSync(p).isDirectory()) {
      if (['__tests__', 'data', 'scripts', 'node_modules'].includes(nome)) continue
      out.push(...arquivosDe(p))
    } else if (/\.(js|jsx|ts|tsx)$/.test(nome)) {
      out.push(p)
    }
  }
  return out
}

function ocorrencias(texto) {
  return texto.split('\n').reduce((n, linha) => {
    if (linha.trimStart().startsWith('//') || linha.trimStart().startsWith('*')) return n
    return n + (PADROES.some((re) => re.test(linha)) ? 1 : 0)
  }, 0)
}

describe('tripwire — escala EFETIVA = base + override', () => {
  const achados = {}
  for (const abs of arquivosDe(SRC)) {
    const n = ocorrencias(readFileSync(abs, 'utf8'))
    if (n > 0) achados[relative(RAIZ, abs)] = n
  }

  it('todo arquivo que lê a base crua está na allowlist, com o motivo', () => {
    const foraDaLista = Object.keys(achados).filter((f) => !ALLOWLIST[f])
    expect(
      foraDaLista,
      `Arquivo(s) lendo a tabela estática de plantão sem passar pela escala efetiva:\n  ${foraDaLista.join('\n  ')}\n` +
        'Use getResidenteEfetivo/getDatasDoResidente, getDatasDaSobreavisista(..., overrides), ' +
        'getHospitaisEfetivos/getSlotsFuncionariaNaData(..., overrides) ou filaEfetiva — ou, se a leitura crua for ' +
        'um fallback DEPOIS do override, acrescente o arquivo à ALLOWLIST deste teste dizendo por quê.',
    ).toEqual([])
  })

  it('nenhum arquivo conhecido ganhou uma leitura crua a mais', () => {
    const cresceu = Object.entries(achados)
      .filter(([f, n]) => ALLOWLIST[f] && n > ALLOWLIST[f].max)
      .map(([f, n]) => `${f}: ${n} (tolerado ${ALLOWLIST[f].max} — ${ALLOWLIST[f].motivo})`)
    expect(cresceu, 'Leitura crua nova num arquivo já conhecido — confira se falta aplicar o override').toEqual([])
  })

  it('a allowlist não guarda entrada morta', () => {
    const mortas = Object.keys(ALLOWLIST).filter((f) => !achados[f])
    expect(mortas, 'Entrada da allowlist sem ocorrência — remova para a lista continuar dizendo a verdade').toEqual([])
  })
})
