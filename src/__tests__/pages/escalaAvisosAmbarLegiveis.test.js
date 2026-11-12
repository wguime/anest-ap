/**
 * AVISOS EM ÂMBAR LEGÍVEIS nas telas da escala cirúrgica (dono 11/2026).
 *
 * `text-warning` (#F59E0B) como cor de TEXTO mede ~2:1 sobre os fundos claros do app
 * (2,06 na página, 2,13 no cartão) — o mínimo para texto pequeno é 4,5:1. O dono viu o
 * modelo com os três avisos mais comuns e depois mandou "trocar os demais textos": todo
 * TEXTO de aviso passa a `text-category-orange-fg` (5,7–5,9:1 no claro; no escuro é a
 * mesma cor de antes). O token `--warning` não mudou — a troca é por uso.
 *
 * O que FICA em `text-warning`, de propósito:
 *  - ÍCONES (o triângulo âmbar é o sinal de aviso; ícone não tem o piso de 4,5:1);
 *  - TEMPO ESTOURADO ("+43min", "25min além", o estimado que passou): é o mesmo sentido
 *    da etiqueta "Atrasada" e da pílula âmbar do tempo, que o dono mandou manter;
 *  - a etiqueta de GRAVIDADE "Urgente" da fila de urgências (categoria, par da "Imediata");
 *  - a pastilha do ÍCONE nas linhas e opções de decisão da conferência.
 *
 * Este teste é uma CATRACA: texto de aviso novo em `text-warning` numa tela da escala
 * falha aqui, com o arquivo e a linha. Se for um dos casos acima, entra na lista com o porquê.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PASTA = resolve(process.cwd(), 'src/pages/escala-cirurgica')
const ICONE = /<(AlertTriangle|TriangleAlert|UserPlus|Clock|ArrowLeftRight)\b.*text-warning/

/** arquivo → trechos que identificam cada uso PERMITIDO (e por quê). */
const PERMITIDOS = {
  // 10/11/2026 (modelo A do dono): o tempo estimado passou a ter UMA frase e UMA casa, em
  // `TemposCirurgia.jsx` — os usos de tempo estourado do quadro, da folha do total e do
  // botão "Estimado" saíram de BoardView/LiberacoesView/BlocoHorario e moram aqui.
  'TemposCirurgia.jsx': [
    "f.atrasada ? 'font-semibold text-warning'", // "· 15min além" na frase do quadro e da fila
    "parte.startsWith('Tempo estimado') ? 'font-semibold text-warning'", // "X além" no apoio das casas
  ],
  'BlocoHorario.jsx': [
    "subAviso ? 'font-semibold text-warning'", // "X além" sob o bloco (folha Antes de liberar)
  ],
  'LiberacoesView.jsx': [
    "falta?.atrasada ? 'font-medium text-warning'", // tempo estourado por cirurgião (desenho antigo da linha)
  ],
  'PainelTempo.jsx': ["restante?.atrasada ? 'text-warning'"], // prévia do tempo estourado
  // 11/11/2026: a etiqueta de gravidade saiu da faixa junto com a "Fila — N aguardando" e mora
  // no bloco "Urgências aguardando" (o mesmo na Completa e nas Liberações)
  'UrgenciasAguardando.jsx': ["f.gravidade === 'urgente' && 'bg-warning/[0.18] text-warning'"], // etiqueta de gravidade
  'ImportarEscalaPage.jsx': ["'bg-warning/15 text-warning'"], // pastilha do ÍCONE das decisões
}

describe('telas da escala — texto de aviso não usa o âmbar do token', () => {
  const arquivos = readdirSync(PASTA).filter((f) => f.endsWith('.jsx'))

  it('todo `text-warning` que sobrou é ícone ou está na lista de exceções', () => {
    const fora = []
    for (const arq of arquivos) {
      readFileSync(resolve(PASTA, arq), 'utf8').split('\n').forEach((linha, i) => {
        if (!/text-warning(?!-foreground)/.test(linha)) return
        const t = linha.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('{/*') || t.startsWith('/*')) return
        if (ICONE.test(linha)) return
        if ((PERMITIDOS[arq] || []).some((p) => linha.includes(p))) return
        fora.push(`${arq}:${i + 1}  ${t.slice(0, 110)}`)
      })
    }
    expect(fora).toEqual([])
  })

  it('cada exceção da lista ainda existe — exceção morta sai da lista', () => {
    for (const [arq, trechos] of Object.entries(PERMITIDOS)) {
      const src = readFileSync(resolve(PASTA, arq), 'utf8')
      for (const t of trechos) expect(src.includes(t), `${arq}: ${t}`).toBe(true)
    }
  })

  it('os avisos trocados usam o laranja-escuro', () => {
    const tem = (arq, trecho) => expect(readFileSync(resolve(PASTA, arq), 'utf8')).toContain(trecho)
    tem('LiberacoesView.jsx', 'font-medium leading-snug text-category-orange-fg')
    tem('FaixaUrgencias.jsx', 'items-center gap-2 text-[11px] text-category-orange-fg')
    tem('TrocaSheet.jsx', 'text-[12.5px] text-category-orange-fg')
    tem('BoardView.jsx', 'tracking-wide text-category-orange-fg')
    tem('ImportarEscalaFdsPage.jsx', 'bg-warning/10 p-2.5 text-xs text-category-orange-fg')
  })
})
