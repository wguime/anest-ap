import { describe, it, expect } from 'vitest'
import {
  fraseClinica,
  gerarColunaLiberacao,
  nomeCirurgiaoCurto,
  resolverAnestesistas,
  separarListaRodape,
  titleCaseNome,
} from '../../lib/colunaLiberacao'

// ============================================================================
// Helpers de fixture — espelham o que a extração Vision + conferência entrega
// (cada caso já com cirurgião/anestesista nas posições corretas).
// ============================================================================
const caso = (sala, ordem, anestesista, cirurgiao, extra = {}) => ({
  sala,
  ordem,
  anestesista,
  cirurgiao,
  bloco: 'normal',
  isContinuacao: false,
  semAnestesista: false,
  ...extra,
})

describe('nomeCirurgiaoCurto — regra 3 (primeiro nome + inicial do último sobrenome)', () => {
  it('reduz nomes compostos preservando acento (regra 17)', () => {
    expect(nomeCirurgiaoCurto('João Rafael de Oliveira Dias')).toBe('João Dias')
    expect(nomeCirurgiaoCurto('Eduardo Francisco')).toBe('Eduardo Francisco')
  })
  it('sobrenome COMPOSTO fica inteiro (dono 31/07: "Adriano Magro" mudava o nome da pessoa)', () => {
    expect(nomeCirurgiaoCurto('ADRIANO DALL MAGRO')).toBe('Adriano Dall Magro')
    expect(nomeCirurgiaoCurto('Cassiano Branco Dal Piva')).toBe('Cassiano Dal Piva')
    // "de/da/do" seguem descartáveis — só as partículas que fazem parte do
    // sobrenome (dal/dall/del/della/di/van/von) se prendem a ele
    expect(nomeCirurgiaoCurto('Maria de Souza')).toBe('Maria Souza')
  })
  it('nome único fica só com o primeiro nome', () => {
    expect(nomeCirurgiaoCurto('Rafael')).toBe('Rafael')
  })
  it('caixa alta vira capitalizado', () => {
    expect(nomeCirurgiaoCurto('ACHYLLES NETO')).toBe('Achylles Neto')
  })
})

describe('titleCaseNome — regra 17 (sem caixa alta, primeira maiúscula)', () => {
  it('capitaliza cada palavra do nome do anestesista', () => {
    expect(titleCaseNome('JOAO HENRIQUE')).toBe('Joao Henrique')
    expect(titleCaseNome('GUILHERME MELO')).toBe('Guilherme Melo')
  })
})

describe('resolverAnestesistas — regra 2 ("//" herda da linha acima)', () => {
  it('propaga o anestesista pelas linhas seguintes da mesma sala', () => {
    const r = resolverAnestesistas([
      caso('S1', 1, 'EDUARDO', 'Rodrigo Souza'),
      caso('S1', 2, '//', 'Benito Bodanese'),
      caso('S1', 3, '', 'Benito Bodanese'),
    ])
    expect(r.map((c) => c.anestesista)).toEqual(['EDUARDO', 'EDUARDO', 'EDUARDO'])
  })
  it('remove o prefixo PED (regra 9) ao resolver', () => {
    const r = resolverAnestesistas([caso('S1', 1, 'PED EDUARDO', 'Benito Bodanese')])
    expect(r[0].anestesista).toBe('EDUARDO')
  })
  it('preserva a REFERÊNCIA do caso quando nada muda (resposta tátil, 19/08)', () => {
    // O update otimista do context troca só o caso tocado; se este map clonasse
    // todos, o React.memo do CasoCard nunca acertaria e cada toque no status
    // re-renderizaria o quadro inteiro — era metade do delay reportado pelo dono.
    const proprio = caso('S1', 1, 'EDUARDO', 'Rodrigo Souza')
    const herdado = caso('S1', 2, '//', 'Benito Bodanese')
    const r = resolverAnestesistas([proprio, herdado])
    expect(r[0]).toBe(proprio) // nome próprio intacto → mesma referência
    expect(r[1]).not.toBe(herdado) // herdou da linha de cima → clone com o valor novo
    expect(r[1].anestesista).toBe('EDUARDO')
  })
})

// ============================================================================
// GOLDEN — escala Unimed 26/06/2026 (cobre //, PED, SRPA, Exames invertido,
// Imagem "?", continuação-com-cirurgião, nomes do rodapé sem casos).
// ============================================================================
describe('gerarColunaLiberacao — golden Unimed 26/06/2026', () => {
  const casos = [
    // C.O - CESAREA → DIEGO
    caso('C.O - CESAREA', 1, 'DIEGO', 'Taciana Lidineia Alflen', { hora: '13:30' }),
    caso('C.O - CESAREA', 2, '//', 'Fernanda Regina Becker', { hora: '15:00' }),
    caso('C.O - CESAREA', 3, '//', 'Fernanda Regina Becker', { hora: '16:30' }),
    caso('C.O - CESAREA', 4, '//', 'Fernanda Regina Becker', { hora: '18:00' }),
    // C.O - SALA 3 → JOAO HENRIQUE
    caso('C.O - SALA 3', 1, 'JOAO HENRIQUE', 'Achylles Neto', { hora: '13:30' }),
    caso('C.O - SALA 3', 2, '//', 'Eduardo Jose Prochazka Frigeri', { hora: '16:30' }),
    // SALA 1 → EDUARDO / PED EDUARDO
    caso('SALA 1', 1, 'EDUARDO', 'Rodrigo Souza', { hora: '13:30' }),
    caso('SALA 1', 2, 'PED EDUARDO', 'Benito Bodanese', { hora: '16:00' }),
    caso('SALA 1', 3, '//', 'Benito Bodanese', { hora: '17:15' }),
    caso('SALA 1', 4, '//', 'Benito Bodanese', { hora: '18:00' }),
    // SALA 2 → STAUB
    caso('SALA 2', 1, 'STAUB', 'Dirceu Felipe Valentini Junior', { hora: '13:30' }),
    caso('SALA 2', 2, '//', 'Dirceu Felipe Valentini Junior', { hora: '14:45' }),
    caso('SALA 2', 3, '//', 'Dirceu Felipe Valentini Junior', { hora: '16:00' }),
    // SALA 3 → MARILIO (1ª linha CONTINUAÇÃO mas com cirurgião informado → usa cirurgião)
    caso('SALA 3', 1, 'MARILIO', 'Leandro Trevizan', { hora: '13:30', isContinuacao: true }),
    caso('SALA 3', 2, '//', 'Eduardo Menegat', { hora: '14:30' }),
    // SALA 4 → LEONARDO
    caso('SALA 4', 1, 'LEONARDO', 'Liana Ortiz Ruas Winkelmann', { hora: '13:30' }),
    // SALA 6 → RODNEI
    caso('SALA 6', 1, 'RODNEI', 'Venilton Vieira', { hora: '13:30' }),
    caso('SALA 6', 2, '//', 'Juliano Esbissigo', { hora: '15:00' }),
    caso('SALA 6', 3, '//', 'Juliano Esbissigo', { hora: '16:15' }),
    caso('SALA 6', 4, '//', 'Ariane Fransozi', { hora: '18:00' }),
    // SALA 7 → OSCAR
    caso('SALA 7', 1, 'OSCAR', 'Pedro Barros', { hora: '13:30' }),
    caso('SALA 7', 2, '//', 'Pedro Barros', { hora: '14:45' }),
    caso('SALA 7', 3, '//', 'Pedro Barros', { hora: '16:00' }),
    // SRPA → GARIM
    caso('SRPA', 1, 'GARIM', '', { bloco: 'srpa', hora: '13:30' }),
    // EXAMES (lógica invertida → cirurgião à esquerda, anestesista à direita)
    caso('EXAMES', 1, 'ADRIANO', 'Elton', { bloco: 'exames', hora: '13:30' }),
    caso('EXAMES', 2, 'CURY', 'Farret', { bloco: 'exames', hora: '13:30' }),
    caso('EXAMES', 3, 'GUILHERME MELO', 'Claudia', { bloco: 'exames', hora: '13:30' }),
    // IMAGEM → "?" (sem anestesista)
    caso('IMAGEM', 1, '', 'Ana', { bloco: 'imagem', semAnestesista: true, hora: '16:00' }),
    // CONSULTORIO → TIAGO (sem cirurgião)
    caso('CONSULTORIO', 1, 'TIAGO', '', { bloco: 'consultorio', hora: '13:30' }),
  ]

  const rodape = [
    'LEONARDO', 'MARILIO', 'DIEGO', 'GARIM', 'RODNEI', 'OSCAR', 'CURY', 'ADRIANO',
    'EDUARDO', 'STAUB', 'JOAO HENRIQUE', 'TIAGO', 'GUILHERME MELO', 'JOAO RICARDO',
    'CRISTINA', 'RAQUEL',
  ]

  const r = gerarColunaLiberacao(casos, rodape, { hospital: 'Unimed' })

  it('produz uma linha por anestesista do rodapé, na ordem do rodapé (regra 1)', () => {
    expect(r.linhas.map((l) => l.texto)).toEqual([
      'Leonardo — Liana Winkelmann',
      'Marilio — Leandro Trevizan/Eduardo Menegat',
      'Diego — Taciana Alflen/Fernanda Becker',
      'Garim — SRPA',
      'Rodnei — Venilton Vieira/Juliano Esbissigo/Ariane Fransozi',
      'Oscar — Pedro Barros',
      'Cury — Farret (Exames)',
      'Adriano — Elton (Exames)',
      'Eduardo — Rodrigo Souza/Benito Bodanese',
      'Staub — Dirceu Junior',
      'Joao Henrique — Achylles Neto/Eduardo Frigeri',
      'Tiago — Consultório',
      'Guilherme Melo — Claudia (Exames)',
      'Joao Ricardo — …',
      'Cristina — …',
      'Raquel — …',
    ])
  })

  it('coloca os casos "?" no fim, com contexto (bloco + hora) (regra 10)', () => {
    expect(r.semAnestesista.map((i) => i.texto)).toEqual(['Ana — (Imagem 16:00) ?'])
  })

  it('o texto final separa o bloco "?" por uma linha em branco (regra 16)', () => {
    expect(r.texto.endsWith('Raquel — …\n\nAna — (Imagem 16:00) ?')).toBe(true)
  })

  it('remove cirurgiões duplicados para o mesmo anestesista (regra 15)', () => {
    const diego = r.linhas.find((l) => l.anestesista === 'Diego')
    expect(diego.cirurgioes).toEqual(['Taciana Alflen', 'Fernanda Becker'])
  })
})

// ============================================================================
// HRO — blocos especiais Hemodinâmica/IOSC + emergência
// ============================================================================
describe('gerarColunaLiberacao — HRO (Hemodinâmica, IOSC, emergência)', () => {
  const casos = [
    caso('Sala 5', 1, 'DANIELA', 'Mateus Baptistella', { tipo: 'emergencia', hora: '13:00' }),
    // HEMO → ROSE (continuação sem cirurgião + angiografia com cirurgião, // herda)
    caso('HEMO', 1, 'ROSE', '', { bloco: 'hemodinamica', isContinuacao: true, hora: '13:00' }),
    caso('HEMO', 2, '//', 'Alexandre Medeiros', { bloco: 'hemodinamica', hora: '15:00' }),
    // IOSC → ROBERTA / MAURICIO (cirurgião informado)
    caso('IOSC-2', 1, 'ROBERTA', 'Rafael', { bloco: 'iosc', isContinuacao: true, hora: '13:00' }),
    caso('IOSC-3', 1, 'MAURICIO', 'Marco Antonio', { bloco: 'iosc', isContinuacao: true, hora: '13:00' }),
  ]
  const rodape = ['DANIELA', 'MAURICIO', 'ROSE', 'ROBERTA']
  const r = gerarColunaLiberacao(casos, rodape, { hospital: 'HRO' })

  it('emergência entra como caso normal (sem sufixo de bloco)', () => {
    expect(r.linhas.find((l) => l.anestesista === 'Daniela').texto).toBe('Daniela — Mateus Baptistella')
  })
  it('acrescenta (Hemodinamica) ao cirurgião e à continuação (regras 4/8)', () => {
    expect(r.linhas.find((l) => l.anestesista === 'Rose').texto).toBe(
      'Rose — Continuação (Hemodinamica)/Alexandre Medeiros (Hemodinamica)'
    )
  })
  it('acrescenta (IOSC) aos blocos IOSC (regra 6)', () => {
    expect(r.linhas.find((l) => l.anestesista === 'Roberta').texto).toBe('Roberta — Rafael (IOSC)')
    expect(r.linhas.find((l) => l.anestesista === 'Mauricio').texto).toBe('Mauricio — Marco Antonio (IOSC)')
  })
})

// ============================================================================
// Materno/HC — formato pediátrico simples (um anestesista, vários cirurgiões)
// ============================================================================
describe('gerarColunaLiberacao — Materno/HC (pediátrico)', () => {
  const casos = [
    caso('Sala 3 HC', 1, 'ROMULO', 'Larissa Vendrame de Marchi', { hora: '07:30' }),
    caso('Sala 3 HC', 2, '//', 'Vanessa Bau', { hora: '13:30' }),
    caso('Sala 3 HC', 3, '//', 'Vanessa Bau', { hora: '14:30' }),
  ]
  const r = gerarColunaLiberacao(casos, ['ROMULO'], { hospital: 'Materno' })

  it('agrupa todos os cirurgiões do anestesista, dedup, na ordem', () => {
    expect(r.linhas[0].texto).toBe('Romulo — Larissa Marchi/Vanessa Bau')
  })
})

describe('gerarColunaLiberacao — robustez', () => {
  it('lista vazia não quebra', () => {
    expect(gerarColunaLiberacao([], []).texto).toBe('')
  })
  it('anestesista do caso ausente do rodapé é anexado ao final', () => {
    const r = gerarColunaLiberacao([caso('S1', 1, 'EXTRA', 'Pedro Barros')], ['FULANO'])
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Fulano', 'Extra'])
  })
})

describe('gerarColunaLiberacao — salas, plantonista e casos descobertos (F1)', () => {
  it('cada linha carrega as salas onde o anestesista está escalado', () => {
    const casos = [
      caso('SALA 1', 0, 'EDUARDO', 'Rodrigo Souza'),
      caso('SALA 5', 0, 'EDUARDO', 'Benito Bodanese'),
      caso('SALA 2', 0, 'STAUB', 'Dirceu Valentini'),
    ]
    const r = gerarColunaLiberacao(casos, ['EDUARDO', 'STAUB'])
    expect(r.linhas[0].salas).toEqual(['SALA 1', 'SALA 5'])
    expect(r.linhas[1].salas).toEqual(['SALA 2'])
  })
  it('o 1º nome do rodapé é o plantonista (badge) e o retorno expõe o nome', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'LEONARDO', 'Liana W')], ['LEONARDO', 'MARILIO'])
    expect(r.plantonista).toBe('Leonardo')
    expect(r.linhas.map((l) => l.isPlantonista)).toEqual([true, false])
  })
  // MUDANÇA 27/07: o mapa do Materno não traz a lista vermelha, então rodapé
  // vazio era o normal lá — e ninguém aparecia como plantonista (nem no card da
  // Home). Sem rodapé, a ordem passa a ser DERIVADA dos casos: quem tem o caso
  // mais tarde é o último a ir embora, logo o nº 1.
  // Regra do dono 27/07: no turno exibido, plantonista = quem tem MAIS cirurgias.
  // (a lista chega filtrada pelo turno, então de manhã concorre quem opera de manhã)
  it('rodapé vazio → plantonista é quem tem MAIS cirurgias no turno', () => {
    const r = gerarColunaLiberacao([
      caso('S1', 0, 'MATHEUS', 'Pedro Barros', { hora: '07:30' }),
      caso('S1', 1, 'MATHEUS', 'Ana Lima', { hora: '09:30' }),
      caso('S2', 0, 'THAYNA', 'Bia Souza', { hora: '10:30' }),
    ], [])
    expect(r.plantonista).toBe('Matheus')         // 2 cirurgias × 1
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Matheus', 'Thayna'])
    expect(r.linhas.map((l) => l.isPlantonista)).toEqual([true, false])
  })
  it('empate no número de cirurgias → fica quem termina mais tarde', () => {
    const r = gerarColunaLiberacao([
      caso('S1', 0, 'MATHEUS', 'Pedro Barros', { hora: '07:30' }),
      caso('S2', 0, 'THAYNA', 'Bia Souza', { hora: '10:30' }),
    ], [])
    expect(r.plantonista).toBe('Thayna')
  })
  it('mais cirurgias vence mesmo terminando antes', () => {
    const r = gerarColunaLiberacao([
      caso('S1', 0, 'MATHEUS', 'Pedro Barros', { hora: '07:00' }),
      caso('S1', 1, 'MATHEUS', 'Ana Lima', { hora: '08:00' }),
      caso('S1', 2, 'MATHEUS', 'Bia Souza', { hora: '09:00' }),
      caso('S2', 0, 'THAYNA', 'Caio Reis', { hora: '11:00' }),
    ], [])
    expect(r.plantonista).toBe('Matheus')
  })
  it('rodapé vazio e um só anestesista: ele é o plantonista', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'EXTRA', 'Pedro Barros')], [])
    expect(r.plantonista).toBe('Extra')
    expect(r.linhas[0].isPlantonista).toBe(true)
  })
  it('RODAPÉ VENCE: havendo lista vermelha, a derivação nem roda', () => {
    const r = gerarColunaLiberacao([
      caso('S1', 0, 'MATHEUS', 'Pedro Barros', { hora: '07:30' }),
      caso('S2', 0, 'THAYNA', 'Ana Lima', { hora: '14:30' }),
    ], ['MATHEUS', 'THAYNA'])
    expect(r.plantonista).toBe('Matheus')         // ordem do rodapé, não a hora
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Matheus', 'Thayna'])
  })
  it('sem casos com anestesista, não inventa plantonista', () => {
    const r = gerarColunaLiberacao([caso('S9', 0, '', 'Pedro Barros', { hora: '14:00' })], [])
    expect(r.plantonista).toBeNull()
    expect(r.linhas).toHaveLength(0)
  })
  it('caso com anestesista vazio (não-"?") NÃO some: vira sala descoberta (?)', () => {
    const r = gerarColunaLiberacao([caso('S9', 0, '', 'Pedro Barros', { hora: '14:00' })], [])
    expect(r.linhas).toHaveLength(0)
    expect(r.semAnestesista).toHaveLength(1)
    expect(r.semAnestesista[0].cirurgiao).toBe('Pedro Barros')
  })
  it('"//" no PRIMEIRO caso da sala não vira linha literal — vira sala descoberta', () => {
    const r = gerarColunaLiberacao([caso('S9', 0, '//', 'Pedro Barros')], [])
    expect(r.linhas.find((l) => l.anestesista.includes('/'))).toBeUndefined()
    expect(r.semAnestesista).toHaveLength(1)
  })
})

describe('troca de sala refletida na coluna (F1.5)', () => {
  it('após o swap dos casos, cada linha mostra cirurgiões/sala novos e a ORDEM do rodapé não muda', () => {
    // antes: ANA na S1 (Cir Um), BETO na S2 (Cir Dois) → swap aplicado nos casos:
    const depois = [
      caso('S1', 0, 'BETO', 'Cirillo Umberto'),
      caso('S2', 0, 'ANA', 'Cirilo Doisberg'),
    ]
    const r = gerarColunaLiberacao(depois, ['ANA', 'BETO'])
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Ana', 'Beto']) // ordem intacta
    expect(r.linhas[0].salas).toEqual(['S2'])                          // Ana agora na S2
    expect(r.linhas[0].cirurgioes).toEqual(['Cirilo Doisberg'])
    expect(r.linhas[1].salas).toEqual(['S1'])
    expect(r.linhas[1].cirurgioes).toEqual(['Cirillo Umberto'])
  })
})

describe('nomes em AZUL — ajuda de outro hospital (F1.8)', () => {
  it('azuis vão ao FIM da lista (primeiros a serem liberados), com isAjuda', () => {
    const casos = [
      caso('S1', 0, 'LEONARDO', 'Liana Winkelmann'),
      caso('S2', 0, 'DIEGO', 'Taciana Alflen'),
      caso('S3', 0, 'CURY', 'Farret Gomes'),
    ]
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'DIEGO', 'CURY'], { ajudaExterna: ['DIEGO'] })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Cury', 'Diego'])
    expect(r.linhas[2].isAjuda).toBe(true)
    expect(r.linhas[0].isPlantonista).toBe(true)
    expect(r.plantonista).toBe('Leonardo')
  })
  it('azul como 1º do rodapé NÃO vira plantonista (plantonista = 1º não-azul)', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'DIEGO', 'Xavier Yves')], ['DIEGO', 'LEONARDO'], { ajudaExterna: ['DIEGO'] })
    expect(r.plantonista).toBe('Leonardo')
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Diego'])
  })
  it('azul listado só em ajudaExterna (fora do rodapé) também entra ao fim', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'CURY', 'Farret Gomes')], ['LEONARDO'], { ajudaExterna: ['CURY'] })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Cury'])
    expect(r.linhas[1].isAjuda).toBe(true)
  })
  it('sem ajudaExterna nada muda (retrocompat golden)', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'LEONARDO', 'Liana W')], ['LEONARDO', 'MARILIO'])
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio'])
    expect(r.linhas.every((l) => !l.isAjuda)).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// PLANTÃO DO TURNO SEGUINTE (regra do dono 2026-07-29): o ÚLTIMO nome do rodapé,
// quando está escalado, é o plantonista do turno seguinte e sai PRIMEIRO — antes
// até das ajudas. Como a liberação corre de baixo p/ cima, ele vai para o fim.
// Vale nos DOIS turnos (ampliação da tarde de 29/07); só o rótulo muda.
// ════════════════════════════════════════════════════════════════════════════
describe('plantão do turno seguinte — último nome escalado do rodapé', () => {
  const casos = [
    caso('S1', 0, 'LEONARDO', 'Liana Winkelmann'),
    caso('S2', 0, 'MARILIO', 'Taciana Alflen'),
    caso('S3', 0, 'KARINE', 'Farret Gomes'),
  ]
  it('vai para o FIM da lista e ganha isProximoPlantao', () => {
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'MARILIO', 'KARINE'], { turno: 'matutino' })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Karine'])
    expect(r.linhas[2].isProximoPlantao).toBe(true)
    expect(r.linhas[0].isPlantonista).toBe(true) // o plantonista do turno segue sendo o 1º
  })

  // Defeito D11 (07/08, confirmado por sonda): quando o ÚNICO nome nosso do
  // rodapé é também o último (o resto é ajuda de fora), a mesma pessoa levava os
  // dois selos e era MOVIDA para o fim — e o fim libera PRIMEIRO: o plantonista
  // viraria o primeiro a sair. Segurar o plantão do hospital prevalece.
  it('plantonista que também fecha o rodapé NÃO desce para o fim (mantém os 2 selos no topo)', () => {
    const soUmNosso = [
      caso('S1', 0, 'AJUDA_A', 'Cirurgião X'),
      caso('S2', 0, 'NOSSO_B', 'Cirurgião Y'),
    ]
    const r = gerarColunaLiberacao(soUmNosso, ['AJUDA_A', 'NOSSO_B'], {
      turno: 'vespertino', ajudaExterna: ['AJUDA_A'],
    })
    const nosso = r.linhas.find((l) => l.anestesista === 'Nosso_b')
    expect(nosso.isPlantonista).toBe(true)
    expect(nosso.isProximoPlantao).toBe(true) // os dois selos convivem
    expect(nosso.plantaoLabel).toBe('Plantão da manhã')
    // e ele NÃO é o último da lista — o fim libera primeiro
    expect(r.linhas[r.linhas.length - 1].anestesista).not.toBe('Nosso_b')
    expect(r.plantonista).toBe('Nosso_b')
  })
  it('fica ABAIXO das ajudas — sai antes delas', () => {
    const comAjuda = [...casos, caso('S4', 0, 'DIEGO', 'Xavier Yves')]
    const r = gerarColunaLiberacao(comAjuda, ['LEONARDO', 'MARILIO', 'KARINE'], {
      turno: 'matutino', ajudaExterna: ['DIEGO'],
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Diego', 'Karine'])
    expect(r.linhas[2].isAjuda).toBe(true)
    expect(r.linhas[3].isProximoPlantao).toBe(true)
  })
  it('a ordem das ajudas segue o array (a última sai primeiro)', () => {
    const comAjudas = [...casos, caso('S4', 0, 'PAULO', 'Goelzer'), caso('S5', 0, 'JANAINA', 'Maridiane')]
    const r = gerarColunaLiberacao(comAjudas, ['LEONARDO', 'MARILIO', 'KARINE'], {
      turno: 'matutino', ajudaExterna: ['PAULO', 'JANAINA'],
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Paulo', 'Janaina', 'Karine'])
  })
  // ── HRO 30/07: o rodapé terminava em FERNANDO, que estava em AZUL. O app marcou
  // a JANAÍNA (último nome NÃO-azul) como "Plantão da tarde" e o dono corrigiu: a
  // regra é POSICIONAL — quem fecha o rodapé pega o contraturno, azul ou não.
  it('último nome do rodapé EM AZUL ainda é o plantão do contraturno', () => {
    const comAzulNoFim = [...casos, caso('S4', 0, 'FERNANDO', 'Marco Alecio')]
    const r = gerarColunaLiberacao(comAzulNoFim, ['LEONARDO', 'MARILIO', 'KARINE', 'FERNANDO'], {
      turno: 'matutino', ajudaExterna: ['FERNANDO'],
    })
    // Fernando fecha a lista (sai primeiro) — e NÃO a Karine, que é o último não-azul
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Karine', 'Fernando'])
    expect(r.linhas[3].isProximoPlantao).toBe(true)
    expect(r.linhas[3].plantaoLabel).toBe('Plantão da tarde')
    // carrega os DOIS selos: é ajuda de outro hospital E pega o plantão da tarde
    expect(r.linhas[3].isAjuda).toBe(true)
    // e quem não é o último não recebe o rótulo por engano
    expect(r.linhas[2].isProximoPlantao).toBe(false)
    expect(r.linhas[2].plantaoLabel).toBeFalsy()
  })

  it('com azul no fim E outra ajuda no meio, só o último do rodapé leva o rótulo', () => {
    const casosMais = [...casos, caso('S4', 0, 'PAULO', 'Goelzer'), caso('S5', 0, 'FERNANDO', 'Marco Alecio')]
    const r = gerarColunaLiberacao(casosMais, ['LEONARDO', 'MARILIO', 'KARINE', 'FERNANDO'], {
      turno: 'matutino', ajudaExterna: ['PAULO', 'FERNANDO'],
    })
    const nomes = r.linhas.map((l) => l.anestesista)
    expect(nomes[nomes.length - 1]).toBe('Fernando')
    expect(r.linhas[r.linhas.length - 1].isProximoPlantao).toBe(true)
    const paulo = r.linhas.find((l) => l.anestesista === 'Paulo')
    expect(paulo.isAjuda).toBe(true)
    expect(paulo.isProximoPlantao).toBe(false)
  })

  it('último nome SEM casos TAMBÉM leva o badge (dono 31/07) — e segue nascendo liberado', () => {
    // 31/07: nem ADRIANO (HRO) nem ALEXANDRE D (Unimed) mostravam o selo por
    // estarem sem caso — o dono pediu o badge em todos os contraturnos.
    const r = gerarColunaLiberacao(casos.slice(0, 2), ['LEONARDO', 'MARILIO', 'KARINE'], { turno: 'matutino' })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Karine'])
    expect(r.linhas[2].isProximoPlantao).toBe(true)
    expect(r.linhas[2].plantaoLabel).toBe('Plantão da tarde')
    expect(r.linhas[2].teveCasos).toBe(false) // sem caso: nasce liberado, mas identificado
  })
  it('no MATUTINO o rótulo é "Plantão da tarde"', () => {
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'MARILIO', 'KARINE'], { turno: 'matutino' })
    expect(r.linhas[2].plantaoLabel).toBe('Plantão da tarde')
  })
  // Ampliação do dono na tarde de 29/07: quem pega o plantão da MANHÃ seguinte e
  // está escalado à tarde sai primeiro pela mesma razão (descansar).
  it('no VESPERTINO a regra também vale, com rótulo "Plantão da manhã"', () => {
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'MARILIO', 'KARINE'], { turno: 'vespertino' })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Karine'])
    expect(r.linhas[2].isProximoPlantao).toBe(true)
    expect(r.linhas[2].plantaoLabel).toBe('Plantão da manhã')
    expect(r.linhas[0].isPlantonista).toBe(true)
  })
  it('no vespertino também fica ABAIXO das ajudas', () => {
    const comAjuda = [...casos, caso('S4', 0, 'DIEGO', 'Xavier Yves')]
    const r = gerarColunaLiberacao(comAjuda, ['LEONARDO', 'MARILIO', 'KARINE'], {
      turno: 'vespertino', ajudaExterna: ['DIEGO'],
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Diego', 'Karine'])
    expect(r.linhas[3].isProximoPlantao).toBe(true)
  })
  it('sem turno informado (chamada legada) a regra não dispara', () => {
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'MARILIO', 'KARINE'])
    expect(r.linhas.every((l) => !l.isProximoPlantao)).toBe(true)
  })
  it('rodapé de um nome só não perde o plantonista', () => {
    const r = gerarColunaLiberacao([casos[0]], ['LEONARDO'], { turno: 'matutino' })
    expect(r.linhas[0].isPlantonista).toBe(true)
    expect(r.linhas[0].isProximoPlantao).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// TEMPO POR CIRURGIA (dono 29/07): o término previsto de cada caso viaja até a
// fila junto do cirurgião a que pertence. O total da PESSOA é outro número,
// manual e independente — nunca a soma destes.
// ════════════════════════════════════════════════════════════════════════════
describe('tokenTermino — término previsto por cirurgião', () => {
  const comTermino = (sala, ordem, anest, cirurgiao, hora, terminoPrevisto) =>
    ({ ...caso(sala, ordem, anest, cirurgiao), hora, terminoPrevisto })

  it('leva o término do caso para o token do cirurgião', () => {
    const r = gerarColunaLiberacao(
      [comTermino('S1', 0, 'LEONARDO', 'Liana Winkelmann', '07:30', '10:30')],
      ['LEONARDO'], { turno: 'matutino' }
    )
    expect(r.linhas[0].tokenTermino['Liana Winkelmann']).toBe('10:30')
  })

  it('dois casos no mesmo cirurgião ficam com o término MAIS PRÓXIMO', () => {
    const r = gerarColunaLiberacao([
      comTermino('S1', 0, 'LEONARDO', 'Liana Winkelmann', '07:30', '12:00'),
      comTermino('S1', 1, 'LEONARDO', 'Liana Winkelmann', '10:00', '11:00'),
    ], ['LEONARDO'], { turno: 'matutino' })
    expect(r.linhas[0].tokenTermino['Liana Winkelmann']).toBe('11:00')
  })

  it('caso encerrado não deixa término para trás', () => {
    const r = gerarColunaLiberacao([
      { ...comTermino('S1', 0, 'LEONARDO', 'Liana Winkelmann', '07:30', '10:30'), statusCirurgia: 'terminada' },
    ], ['LEONARDO'], { turno: 'matutino' })
    expect(r.linhas[0].tokenTermino).toEqual({})
  })

  it('sem término informado o mapa fica vazio (nada é estimado sozinho)', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'LEONARDO', 'Liana Winkelmann')], ['LEONARDO'], { turno: 'matutino' })
    expect(r.linhas[0].tokenTermino).toEqual({})
  })
})

describe('resolverUid — vínculo colapsa variantes do mesmo anestesista (bug do piloto 2026-07-21)', () => {
  // Reprodução real: rodapé "GUILHERME DIDOMENICO", caso da Sala 4 "GUILHERME D.".
  // Sem vínculo, a variante do caso virava linha EXTRA depois de todo o rodapé
  // (inclusive dos já liberados) e roubava o badge "próximo a ser liberado".
  const aliases = { 'GUILHERME D.': 'uid-dido', 'GUILHERME DIDOMENICO': 'uid-dido', 'DIDO': 'uid-dido' }
  const resolverUid = (nome) => aliases[String(nome || '').trim().toUpperCase()] || null

  it('rodapé e caso com nomes diferentes viram UMA linha, com o display do rodapé', () => {
    const r = gerarColunaLiberacao(
      [caso('Sala 4', 0, 'GUILHERME D.', 'Igor Maurer'), caso('Sala 2', 0, 'STAUB', 'Theodoro Gonzalez')],
      ['STAUB', 'GUILHERME DIDOMENICO'],
      { resolverUid }
    )
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Staub', 'Guilherme Didomenico'])
    const dido = r.linhas[1]
    expect(dido.cirurgioes).toEqual(['Igor Maurer'])
    expect(dido.salas).toEqual(['Sala 4'])
  })

  it('sem resolver, mantém o comportamento legado (variante vira linha extra)', () => {
    const r = gerarColunaLiberacao(
      [caso('Sala 4', 0, 'GUILHERME D.', 'Igor Maurer')],
      ['STAUB', 'GUILHERME DIDOMENICO']
    )
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Staub', 'Guilherme Didomenico', 'Guilherme D.'])
  })

  it('caso já atribuído por uid (anestesistaUserId) agrupa mesmo sem alias do apelido do caso', () => {
    const r = gerarColunaLiberacao(
      [caso('Sala 4', 0, 'G. D.', 'Igor Maurer', { anestesistaUserId: 'uid-dido' })],
      ['GUILHERME DIDOMENICO'],
      { resolverUid }
    )
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Guilherme Didomenico'])
    expect(r.linhas[0].salas).toEqual(['Sala 4'])
  })

  it('rodapé com variantes duplicadas do mesmo anestesista vira uma linha só', () => {
    const r = gerarColunaLiberacao([], ['DIDO', 'GUILHERME DIDOMENICO', 'STAUB'], { resolverUid })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Dido', 'Staub'])
    expect(r.plantonista).toBe('Dido')
  })
})

describe('nomeExibicao — apelido só-primeiro-nome ganha o diferencial (pedido 2026-07-21)', () => {
  const resolverUid = (n) => ({ GUSTAVO: 'uid-biesdorf', GARIM: 'uid-garim' })[String(n || '').trim().toUpperCase()] || null
  const nomes = { 'uid-biesdorf': 'GUSTAVO BIESDORF', 'uid-garim': 'GUSTAVO ALMANSA GARIM' }
  // mesma política da view: 1 palavra E igual ao primeiro nome do cadastro → nome curto completo
  const nomeExibicao = (uid, apelido) => {
    const nome = nomes[uid]
    if (!nome || /\s/.test(String(apelido).trim())) return null
    const primeiro = nome.split(/\s+/)[0]
    return String(apelido).trim().toUpperCase() === primeiro ? nomeCirurgiaoCurto(nome) : null
  }

  it('GUSTAVO vira "Gustavo Biesdorf"; GARIM (já diferencial) fica "Garim"', () => {
    const r = gerarColunaLiberacao([], ['GUSTAVO', 'GARIM'], { resolverUid, nomeExibicao })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Gustavo Biesdorf', 'Garim'])
  })

  it('linha de ajuda externa também recebe o diferencial e a flag isAjuda', () => {
    const r = gerarColunaLiberacao([], ['GARIM', 'GUSTAVO'], { resolverUid, nomeExibicao, ajudaExterna: ['GUSTAVO'] })
    expect(r.linhas.map((l) => [l.anestesista, l.isAjuda])).toEqual([['Garim', false], ['Gustavo Biesdorf', true]])
    expect(r.plantonista).toBe('Garim')
  })
})

describe('alertas "?" com horário + procedimento como token (pedidos 2026-07-21)', () => {
  it('anestesista literal "??" vira alerta com hora/sala/procedimento, ordenado por hora', () => {
    const r = gerarColunaLiberacao(
      [
        caso('Sala 8', 0, '???', 'Marcelo Zeni', { hora: '17:00', procedimento: 'DUPLO J + URETERORRENOLITOTRIPSIA' }),
        caso('CO - Cesárea', 0, '??', 'Elis Biasuz', { hora: '13:30', procedimento: 'CESARIANA' }),
      ],
      ['STAUB']
    )
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Staub']) // "??" nunca vira linha
    expect(r.semAnestesista.map((i) => [i.hora, i.sala])).toEqual([
      ['13:30', 'CO - Cesárea'],
      ['17:00', 'Sala 8'],
    ])
    expect(r.semAnestesista[0].procedimento).toBe('Cesariana')
  })

  it('caso sem cirurgião mas com procedimento mostra o procedimento (acréscimo AMIU)', () => {
    const r = gerarColunaLiberacao(
      [caso('CC - Sala 4', 0, 'GABRIELA', '', { procedimento: 'ACRESCIMO AMIU' })],
      ['GABRIELA']
    )
    expect(r.linhas[0].cirurgioes).toEqual(['Acrescimo AMIU'])
  })

  it('fraseClinica: caps vira frase, preservando siglas curtas; texto já minúsculo fica', () => {
    expect(fraseClinica('FRATURA DOS METACARPIANOS')).toBe('Fratura dos metacarpianos')
    expect(fraseClinica('AMIU')).toBe('AMIU')
    expect(fraseClinica('DUPLO J + URETERORRENOLITOTRIPSIA')).toBe('Duplo J + ureterorrenolitotripsia')
    expect(fraseClinica('Artroplastia total de joelho')).toBe('Artroplastia total de joelho')
  })
})

describe('casos encerrados saem da linha em tempo real (pedido 2026-07-21)', () => {
  it('Terminada/Suspensa removem sala e cirurgião, mas a linha NÃO auto-libera (teveCasos)', () => {
    const r = gerarColunaLiberacao(
      [
        caso('Sala 1', 0, 'GIOVANA', 'Marcelo Cunha', { statusCirurgia: 'terminada' }),
        caso('Sala 2', 0, 'STAUB', 'Theodoro Gonzalez', { statusCirurgia: 'iniciada' }),
        caso('Sala 2', 1, 'STAUB', 'Alberto Biazussi', { statusExtra: 'suspensa' }),
      ],
      ['STAUB', 'GIOVANA', 'ROMULO']
    )
    const giovana = r.linhas.find((l) => l.anestesista === 'Giovana')
    expect(giovana.salas).toEqual([])
    expect(giovana.cirurgioes).toEqual([])
    expect(giovana.teveCasos).toBe(true) // encerrou tudo ≠ nunca escalado
    const staub = r.linhas.find((l) => l.anestesista === 'Staub')
    expect(staub.cirurgioes).toEqual(['Theodoro Gonzalez']) // o suspenso saiu
    const romulo = r.linhas.find((l) => l.anestesista === 'Romulo')
    expect(romulo.teveCasos).toBe(false) // nunca escalado → view auto-libera
  })

  it('alerta "?" some quando o caso encerra', () => {
    const r = gerarColunaLiberacao(
      [caso('Sala 8', 0, '??', 'Zeni', { hora: '17:00', statusCirurgia: 'terminada' })],
      ['STAUB']
    )
    expect(r.semAnestesista).toEqual([])
  })
})

describe('token não duplica o bloco (pedido 2026-07-22)', () => {
  it('procedimento "CONSULTÓRIO AJUDA" no bloco consultório vira só "Consultório"', () => {
    const r = gerarColunaLiberacao(
      [caso('Consultório', 0, 'OSCAR', '', { bloco: 'consultorio', procedimento: 'CONSULTÓRIO AJUDA' })],
      ['OSCAR']
    )
    expect(r.linhas[0].cirurgioes).toEqual(['Consultório'])
  })
  it('procedimento diferente do bloco mantém o sufixo', () => {
    const r = gerarColunaLiberacao(
      [caso('Exames', 0, 'GABRIEL', '', { bloco: 'exames', procedimento: '01 BRONCO' })],
      ['GABRIEL']
    )
    expect(r.linhas[0].cirurgioes).toEqual(['01 bronco (Exames)'])
  })
})

describe('chave estável + nome original (persistência — bug 2026-07-22)', () => {
  const resolverUid = (n) => (String(n || '').trim().toUpperCase() === 'CURY' ? 'uid-cury' : null)
  it('linha expõe chave (uid do vínculo ou nome normalizado) e o nome ORIGINAL do rodapé', () => {
    const r = gerarColunaLiberacao(
      [caso('Sala 3', 0, 'CURY', 'Diego Nascimento')],
      ['Cury', 'NOME SEM VINCULO'],
      { resolverUid }
    )
    expect(r.linhas[0]).toMatchObject({ chave: 'uid-cury', uid: 'uid-cury', nomeOriginal: 'Cury' })
    expect(r.linhas[1].chave).toBe('NOME SEM VINCULO') // norm(nome) como fallback
    expect(r.linhas[1].nomeOriginal).toBe('NOME SEM VINCULO')
  })
  it('linha extra (caso fora do rodapé) também carrega chave e nome original', () => {
    const r = gerarColunaLiberacao([caso('Sala 1', 0, 'FULANO', 'X Y')], [], {})
    expect(r.linhas[0].chave).toBe('FULANO')
    expect(r.linhas[0].nomeOriginal).toBe('FULANO')
  })
})

describe('dupla lida pela metade ("OSCAR + ?") — dono 02/09', () => {
  // O mapa da Unimed de 02/09 trouxe "GABRIELA + ?": dois anestesistas na sala,
  // o segundo ilegível. A fila abria uma linha para a INTERROGAÇÃO — um card sem
  // dono, com badge de Ajuda, encravado no meio de quem já estava liberado
  // ("ponto de interrogação não é ajuda"; "não pode haver card amarelo no meio
  // dos vermelhos"). O que falta é ausência, não colega.
  it('o "?" não vira linha; o lado conhecido fica com o caso', () => {
    const r = gerarColunaLiberacao(
      [caso('CC - Sala 3', 0, 'OSCAR + ?', 'Eduardo Menegat')],
      ['GABRIELA', 'OSCAR'],
      {}
    )
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Gabriela', 'Oscar'])
    expect(r.linhas.some((l) => /\?/.test(l.anestesista))).toBe(false)
    expect(r.linhas.find((l) => l.anestesista === 'Oscar').salas).toContain('CC - Sala 3')
  })

  it('o "?" não entra nem quando ninguém do par está no rodapé', () => {
    const r = gerarColunaLiberacao([caso('CC - Sala 3', 0, 'OSCAR + ?', 'Eduardo Menegat')], [], {})
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Oscar'])
  })

  it('nome só de interrogações ("? + ?") cai no ALERTA de sala descoberta', () => {
    const r = gerarColunaLiberacao([caso('CC - Sala 3', 0, '? + ?', 'Eduardo Menegat')], ['OSCAR'], {})
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Oscar'])
    expect(r.semAnestesista).toHaveLength(1)
    expect(r.semAnestesista[0].sala).toBe('CC - Sala 3')
  })
})

describe('dois anestesistas na mesma sala ("A + B") — pedido do dono 23/07', () => {
  it('o caso conta para AMBOS: cada um aparece na sua posição do rodapé, com a sala', () => {
    const r = gerarColunaLiberacao(
      [caso('Hemodinâmica', 0, 'ROBERTA + FERNANDO', 'Claudio Ferreira')],
      ['GUSTAVO', 'ROBERTA', 'FERNANDO'], // ordem enviada: Roberta e Fernando em posições distintas
      {}
    )
    const roberta = r.linhas.find((l) => l.anestesista === 'Roberta')
    const fernando = r.linhas.find((l) => l.anestesista === 'Fernando')
    expect(roberta).toBeTruthy()
    expect(fernando).toBeTruthy()
    expect(roberta.salas).toContain('Hemodinâmica')
    expect(fernando.salas).toContain('Hemodinâmica') // o MESMO caso conta p/ os dois
    expect(roberta.teveCasos).toBe(true)
    expect(fernando.teveCasos).toBe(true)
    // ordem preservada: Gustavo (plantonista) → Roberta → Fernando
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Gustavo', 'Roberta', 'Fernando'])
  })
  it('um único nome não é afetado (segue com o uid do caso)', () => {
    const resolverUid = (n) => (String(n).toUpperCase() === 'GUSTAVO' ? 'uid-g' : null)
    const r = gerarColunaLiberacao([caso('SRPA', 0, 'GUSTAVO', '')], ['GUSTAVO'], { resolverUid })
    expect(r.linhas).toHaveLength(1)
    expect(r.linhas[0].uid).toBe('uid-g')
  })
})

describe('prefixo de PEDIDO "PED"/"PED."/"Ped." (regra do dono 24/07)', () => {
  it('"Ped. Janaína" é um pedido p/ a Janaína → resolve ao nome e MERGE numa linha só', () => {
    const r = gerarColunaLiberacao(
      [caso('Sala 6', 0, 'JANAINA', 'Juliano'), caso('Sala 3', 3, 'PED. JANAINA', 'Leandro')],
      ['JANAINA'],
      {}
    )
    const janaina = r.linhas.filter((l) => l.anestesista === 'Janaina')
    expect(janaina).toHaveLength(1) // não vira linha órfã "Ped. Janaina"
    expect(janaina[0].salas.sort()).toEqual(['Sala 3', 'Sala 6']) // escalada nos 2 locais
  })
  it('não estraga nome que começa com "Ped" (Pedro)', () => {
    const r = gerarColunaLiberacao([caso('Sala 1', 0, 'PEDRO', 'X')], ['PEDRO'], {})
    expect(r.linhas[0].anestesista).toBe('Pedro')
  })
})

describe('cirurgiões em ordem de horário (pedido do dono 24/07)', () => {
  it('ordena os cirurgiões do anestesista pela MENOR hora do caso', () => {
    const r = gerarColunaLiberacao(
      [
        caso('CC - Sala 2', 2, 'CURY', 'Dirceu Junior', { hora: '11:15' }),
        caso('CC - Sala 2', 0, 'CURY', 'Matheus Militz', { hora: '07:30' }),
        caso('CC - Sala 2', 1, 'CURY', 'Dirceu Junior', { hora: '09:00' }),
      ],
      ['CURY'], {}
    )
    // Militz (07:30) antes de Dirceu (menor hora 09:00), mesmo Dirceu tendo vindo 1º na lista
    expect(r.linhas[0].cirurgioes).toEqual(['Matheus Militz', 'Dirceu Junior'])
  })
})

describe('procedimentos sem anestesista somem ao terminar (pedido do dono 24/07)', () => {
  it('caso "?" sem anestesista entra no alerta; marcado terminada, SAI', () => {
    const base = [caso('Imagem', 0, '???', 'Klita', { hora: '10:00', procedimento: 'Ecodoppler', semAnestesista: true })]
    expect(gerarColunaLiberacao(base, [], {}).semAnestesista).toHaveLength(1)
    const terminado = [{ ...base[0], statusCirurgia: 'terminada' }]
    expect(gerarColunaLiberacao(terminado, [], {}).semAnestesista).toHaveLength(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// DEFINIR ANESTESISTA NÃO MUDA A ORDEM (bug 30/07). O seletor grava uid+apelido
// no caso, mas o rodapé só resolvia uid pelo DICIONÁRIO — sem o alias lá (vínculo
// novo, ou o 403 de 29/07 que bloqueava o aprendizado), o MESMO nome virava duas
// chaves: a linha do rodapé ficava vazia na posição dela e os casos nasciam como
// linha EXTRA no fim. Para quem usa: "definir anestesista mudou a ordem da fila".
// Vale para os DOIS caminhos (Liberações e Completa): ambos passam por
// setAnestesistaCasos e a fila é derivada daqui.
// ════════════════════════════════════════════════════════════════════════════
describe('caso com uid casa com o rodapé mesmo SEM alias no dicionário', () => {
  it('o caso migra para a linha do novo responsável, na posição do rodapé', () => {
    const casos = [
      caso('S1', 0, 'ANA', 'Liana Winkelmann', { anestesistaUserId: 'uid-ana' }),
      // definido pelo seletor: uid + apelido — e "CAROL" NÃO está no dicionário
      caso('S2', 0, 'CAROL', 'Taciana Alflen', { anestesistaUserId: 'uid-carol' }),
    ]
    const r = gerarColunaLiberacao(casos, ['ANA', 'BRUNO', 'CAROL'], {
      turno: 'matutino',
      resolverUid: (n) => (String(n).trim().toUpperCase() === 'ANA' ? 'uid-ana' : null),
    })
    // SEM linha extra e SEM duplicata: Carol fica onde o rodapé a pôs
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Ana', 'Bruno', 'Carol'])
    const carol = r.linhas[2]
    expect(carol.isExtra).toBeFalsy()
    expect(carol.teveCasos).toBe(true)
    expect(carol.uid).toBe('uid-carol')
    // e a chave da linha é o uid — marcações novas vão pela identidade forte
    expect(carol.chave).toBe('uid-carol')
  })

  it('nome que aponta para DOIS uids é ambíguo e não casa sozinho', () => {
    // dois "GUSTAVO" de logins diferentes: casar pelo texto escolheria um errado.
    // Regra do dicionário: 1º nome com >1 candidato nunca casa sozinho.
    const casos = [
      caso('S1', 0, 'GUSTAVO', 'Liana Winkelmann', { anestesistaUserId: 'uid-g1' }),
      caso('S2', 0, 'GUSTAVO', 'Taciana Alflen', { anestesistaUserId: 'uid-g2' }),
    ]
    const r = gerarColunaLiberacao(casos, ['GUSTAVO', 'BRUNO'], { turno: 'matutino' })
    // o rodapé "GUSTAVO" fica na chave-nome (não escolhe uid no palpite);
    // os dois casos seguem nos seus uids — podem virar extras, mas NUNCA um
    // engolir o caso do outro
    const doRodape = r.linhas.find((l) => !l.isExtra && l.nomeOriginal === 'GUSTAVO')
    expect(doRodape.uid).toBeNull()
  })

  it('o responsável ANTERIOR mantém a posição dele no rodapé (sem casos = aguardando)', () => {
    // Ana repassou o único caso dela para Carol: a linha da Ana continua na
    // posição 1 do rodapé — a ordem NUNCA se reescreve por definição de anestesista
    const casos = [
      caso('S2', 0, 'CAROL', 'Taciana Alflen', { anestesistaUserId: 'uid-carol' }),
    ]
    const r = gerarColunaLiberacao(casos, ['ANA', 'BRUNO', 'CAROL'], { turno: 'matutino' })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Ana', 'Bruno', 'Carol'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// EMPRESTADO (dono 30/07 — caso TIAGO): o azul no rodapé tem DOIS sentidos e o
// cruzamento desambigua. Quem tem caso AQUI veio ajudar aqui (bloco do fim, sai
// primeiro). Quem tem caso em OUTRO hospital foi emprestado — e MANTÉM a posição
// de liberação no hospital de origem, com badge de Ajuda (o destino vai no card).
// ════════════════════════════════════════════════════════════════════════════
describe('emprestado a outro hospital mantém a posição do rodapé', () => {
  const casos = [
    caso('S1', 0, 'LEONARDO', 'Liana Winkelmann'),
    caso('S2', 0, 'MARILIO', 'Taciana Alflen'),
    caso('S3', 0, 'KARINE', 'Farret Gomes'),
  ]

  it('azul no rodapé que está ajudando FORA fica na posição, com isAjuda + ajudaFora', () => {
    // TIAGO no meio do rodapé do HRO, marcado azul, com caso na Unimed
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'TIAGO', 'MARILIO', 'KARINE'], {
      turno: 'vespertino',
      ajudaExterna: ['TIAGO'],
      ajudandoFora: [{ nome: 'TIAGO', uid: 'uid-tiago', sala: 'Hemodinâmica' }],
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Tiago', 'Marilio', 'Karine'])
    const tiago = r.linhas[1]
    expect(tiago.isAjuda).toBe(true)      // badge
    expect(tiago.ajudaFora).toBe(true)    // o card mostra o destino
    expect(tiago.ajudaIdx).toBeNull()     // sem setas: a posição é a do rodapé
  })

  it('azul SEM caso fora segue o comportamento clássico: bloco do fim', () => {
    const comAjudaLocal = [...casos, caso('S4', 0, 'DIEGO', 'Xavier Yves')]
    const r = gerarColunaLiberacao(comAjudaLocal, ['LEONARDO', 'DIEGO', 'MARILIO', 'KARINE'], {
      turno: 'vespertino',
      ajudaExterna: ['DIEGO'],
    })
    // Diego (azul, caso AQUI) desce para o fim — chegou para ajudar
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Diego', 'Karine'])
    expect(r.linhas[2].ajudaFora).toBe(false)
  })

  it('rodapé NÃO-azul com caso fora também ganha o badge, sem sair do lugar', () => {
    // a secretária esqueceu o azul: o cruzamento cobre
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'MARILIO', 'TIAGO', 'KARINE'], {
      turno: 'vespertino',
      ajudandoFora: [{ nome: 'TIAGO', uid: null, sala: 'Hemodinâmica' }],
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Tiago', 'Karine'])
    expect(r.linhas[2].isAjuda).toBe(true)
    expect(r.linhas[2].ajudaFora).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// SLOT ASSUMIDO (dono 30/07 — troca declarada executada). Caso real que motivou:
// Giovana (rodapé do HRO) assumiu os casos do Maurício na Unimed via Definir
// anestesista; o rodapé da Unimed dizia MAURICIO, ela não estava na ordem
// publicada e virava linha EXTRA no fim — "primeira a ser liberada", errado.
// Com `assumidas`, o slot do Maurício TROCA DE IDENTIDADE: exibe a Giovana,
// aponta o uid dela, consome os casos dela e a remove dos extras. A chave do
// slot NÃO muda e a ordem do rodapé NUNCA é escrita.
// ════════════════════════════════════════════════════════════════════════════
describe('slot assumido (troca declarada, dono 30/07)', () => {
  // pós-execução: os casos do Maurício já foram transferidos para a Giovana
  const casosPos = [
    caso('S1', 0, 'ANDRE', 'Liana Winkelmann'),
    caso('S2', 0, 'GIOVANA', 'Taciana Alflen', { anestesistaUserId: 'uid-gio' }),
    caso('S3', 0, 'CARLA', 'Farret Gomes'),
  ]
  const assumidas = { MAURICIO: { uid: 'uid-gio', nome: 'GIOVANA SILVA' } }

  it('caso Giovana↔Maurício: ela ocupa a posição dele — SEM linha extra no fim', () => {
    const r = gerarColunaLiberacao(casosPos, ['ANDRE', 'MAURICIO', 'CARLA'], { assumidas })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Andre', 'Giovana Silva', 'Carla'])
    expect(r.linhas.some((l) => l.isExtra)).toBe(false)
    const slot = r.linhas[1]
    expect(slot.chave).toBe('MAURICIO') // chave ESTÁVEL: marcações do slot não órfãm
    expect(slot.uid).toBe('uid-gio') // status/casos casam por quem assumiu
    expect(slot.nomeOriginal).toBe('MAURICIO') // nada reescreve o rodapé
    // deNomeOriginal = nome CRU do rodapé (D8): é por ele que o desfazer casa o dono
    // `local` = de onde veio quem assumiu quando não estava em escala nenhuma
    expect(slot.assumida).toEqual({ deNome: 'Mauricio', deNomeOriginal: 'MAURICIO', deUid: null, motivo: null, local: null })
    expect(slot.cirurgioes).toEqual(['Taciana Alflen']) // consome o grupo dela
    expect(slot.teveCasos).toBe(true) // nunca nasce "não escalado"/liberado
  })

  it('lookup cai no fallback por norm(nome) quando a chave derivada é uid', () => {
    // dicionário resolve MAURICIO→uid-mau: a chave do slot vira o uid, mas a
    // assunção foi gravada sob o nome — o fallback tem de achar mesmo assim
    const resolverUid = (n) => (String(n).toUpperCase() === 'MAURICIO' ? 'uid-mau' : null)
    const r = gerarColunaLiberacao(casosPos, ['ANDRE', 'MAURICIO', 'CARLA'], { assumidas, resolverUid })
    expect(r.linhas[1].anestesista).toBe('Giovana Silva')
    expect(r.linhas[1].chave).toBe('uid-mau')
  })

  it('plantonista e contraturno são POSICIONAIS: quem assume herda o selo do slot', () => {
    // Maurício era o 1º (plantonista) — Giovana assume e herda o posto
    const r1 = gerarColunaLiberacao(casosPos, ['MAURICIO', 'ANDRE', 'CARLA'], { assumidas })
    expect(r1.linhas[0].isPlantonista).toBe(true)
    expect(r1.plantonista).toBe('Giovana Silva')
    // Maurício fechava o rodapé matutino (plantão da tarde) — o selo segue o SLOT
    const r2 = gerarColunaLiberacao(casosPos, ['ANDRE', 'CARLA', 'MAURICIO'], { assumidas, turno: 'matutino' })
    const ultima = r2.linhas[r2.linhas.length - 1]
    expect(ultima.anestesista).toBe('Giovana Silva')
    expect(ultima.isProximoPlantao).toBe(true)
    expect(ultima.plantaoLabel).toBe('Plantão da tarde')
  })

  it('swap no MESMO hospital: os dois slots trocam de identidade sem pular linha', () => {
    const casosSwap = [
      caso('S1', 0, 'BEATRIZ', 'Liana Winkelmann', { anestesistaUserId: 'uid-bea' }),
      caso('S2', 0, 'ANTONIO', 'Taciana Alflen', { anestesistaUserId: 'uid-ant' }),
    ]
    const r = gerarColunaLiberacao(casosSwap, ['ANTONIO', 'BEATRIZ'], {
      assumidas: {
        ANTONIO: { uid: 'uid-bea', nome: 'BEATRIZ LIMA' },
        BEATRIZ: { uid: 'uid-ant', nome: 'ANTONIO REIS' },
      },
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Beatriz Lima', 'Antonio Reis'])
    expect(r.linhas.map((l) => l.cirurgioes)).toEqual([['Liana Winkelmann'], ['Taciana Alflen']])
    expect(r.linhas.some((l) => l.isExtra)).toBe(false)
  })

  it('republicação devolve os casos ao nome antigo: o slot segue assumido e o dono vira extra', () => {
    // republicar a MESMA imagem re-importa os casos como MAURICIO; a assunção
    // persiste no override (a RPC preserva). Estado conflitante de propósito:
    // o slot mostra quem assumiu (sem casos, ainda ativo) e os casos re-importados
    // do dono aparecem como extra — verdade dos dados, sem corromper a ordem.
    const casosRepub = [
      caso('S1', 0, 'ANDRE', 'Liana Winkelmann'),
      caso('S2', 0, 'MAURICIO', 'Taciana Alflen'),
    ]
    const r = gerarColunaLiberacao(casosRepub, ['ANDRE', 'MAURICIO'], { assumidas })
    const slot = r.linhas.find((l) => l.chave === 'MAURICIO' && !l.isExtra)
    expect(slot.anestesista).toBe('Giovana Silva')
    expect(slot.teveCasos).toBe(true)
    const extra = r.linhas.find((l) => l.isExtra)
    expect(extra?.anestesista).toBe('Mauricio')
  })

  it('quem assumiu também some do bloco de ajuda avulsa (sem linha dupla)', () => {
    // Giovana tinha sido marcada como ajuda antes de executar a troca
    const r = gerarColunaLiberacao(casosPos, ['ANDRE', 'MAURICIO', 'CARLA'], {
      assumidas,
      ajudaExterna: ['GIOVANA'],
    })
    expect(r.linhas.filter((l) => l.uid === 'uid-gio' || /Giovana/.test(l.anestesista))).toHaveLength(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// NOTA DE LOCAL entre parênteses no rodapé (dono 31/07 — caso real Unimed):
// "MATHEUS (CONSULT)" é o MESMO Matheus, anotado que está no consultório. Sem o
// strip, o rodapé não casava com o vínculo e a pessoa virava DUAS linhas — a do
// rodapé "não escalada" (nascia liberada) + o vínculo como extra no fim.
// ════════════════════════════════════════════════════════════════════════════
describe('nota de local entre parênteses no rodapé — "MATHEUS (CONSULT)" (dono 31/07)', () => {
  it('é a MESMA pessoa: casa com o caso/vínculo, mantém a posição, sem linha extra', () => {
    const r = gerarColunaLiberacao(
      [caso('Consultório', 0, 'MATHEUS', 'Roberta', { anestesistaUserId: 'uid-mat' })],
      ['ANA', 'MATHEUS (CONSULT)', 'BEA']
    )
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Ana', 'Matheus', 'Bea'])
    const mat = r.linhas[1]
    expect(mat.chave).toBe('uid-mat')                    // vínculo do caso venceu
    expect(mat.nomeOriginal).toBe('MATHEUS (CONSULT)')   // persistência intacta (nome cru do rodapé)
    expect(mat.salas).toEqual(['Consultório'])
    expect(r.linhas.some((l) => l.isExtra)).toBe(false)  // nada duplicado no fim
  })

  it.each(['CONS', 'CONS.', 'CONSULT', 'CONSULT.', 'CONSULTORIO', 'CONSULTÓRIO'])(
    'sem caso, (%s) continua uma posição ativa no índice exato do rodapé',
    (abreviacao) => {
      const nomeCru = `ANEST B (${abreviacao})`
      const r = gerarColunaLiberacao(
        [caso('S1', 0, 'ANEST A', 'Cir')],
        ['ANEST A', nomeCru, 'ANEST C'],
      )
      expect(r.linhas.map((l) => l.nomeOriginal)).toEqual(['ANEST A', nomeCru, 'ANEST C'])
      expect(r.linhas[1]).toEqual(expect.objectContaining({
        anestesista: 'Anest B',
        notaRodape: 'Consultório',
        teveCasos: true,
      }))
    },
  )

  // SOBREAVISO É POSIÇÃO ATIVA, COMO O CONSULTÓRIO (dono 04/09, escolhendo entre as duas
  // leituras possíveis): quem está de sobreaviso ocupa a posição na fila e não nasce
  // liberado — sair de lá é decisão humana, igual a todo mundo.
  it.each(['SOBREAVISO', 'SOBREAV', 'SOBRE AVISO', 'S/A', 'SA'])(
    'sem caso, (%s) é posição ativa no índice exato do rodapé',
    (abreviacao) => {
      const nomeCru = `ANEST B (${abreviacao})`
      const r = gerarColunaLiberacao(
        [caso('S1', 0, 'ANEST A', 'Cir')],
        ['ANEST A', nomeCru, 'ANEST C'],
      )
      expect(r.linhas.map((l) => l.nomeOriginal)).toEqual(['ANEST A', nomeCru, 'ANEST C'])
      expect(r.linhas[1]).toEqual(expect.objectContaining({
        anestesista: 'Anest B',
        notaRodape: 'Sobreaviso',
        teveCasos: true,
      }))
      expect(r.linhas[1].liberado).toBeFalsy()
    },
  )

  it('não divide vírgula dentro da nota e aceita parênteses Unicode', () => {
    expect(separarListaRodape('ANEST A, ANEST B (CONSULT, APOIO), ANEST C（EXAMES）')).toEqual([
      'ANEST A', 'ANEST B (CONSULT, APOIO)', 'ANEST C（EXAMES）',
    ])
    const r = gerarColunaLiberacao(
      [caso('S1', 0, 'ANEST A', 'Cir')],
      separarListaRodape('ANEST A, ANEST B（CONS.）, ANEST C'),
    )
    expect(r.linhas.map((l) => l.nomeOriginal)).toEqual(['ANEST A', 'ANEST B（CONS.）', 'ANEST C'])
    expect(r.linhas[1]).toEqual(expect.objectContaining({ chave: 'ANEST B', notaRodape: 'Consultório' }))
  })

  it('notas genéricas continuam sendo exibidas como local', () => {
    const outra = gerarColunaLiberacao([caso('S1', 0, 'ANA', 'Cir')], ['ANA', 'FERNANDA (EXAMES)'])
    expect(outra.linhas[1].notaRodape).toBe('Exames')    // variação genérica em title case
  })
})

// ════════════════════════════════════════════════════════════════════════════
// VISITANTES de outro hospital (dono 31/07 — caso real Unimed/HRO): MELO,
// GABRIELA e LEONARDO (rodapé do HRO, posições 6-8) com casos na Unimed devem
// ser os PRIMEIROS a liberar na Unimed, na ordem de liberação do rodapé do HRO
// (quem sairia antes lá sai antes aqui) — não na ordem do array de ajuda nem na
// de encontro dos casos (que punha o Leonardo, primeiro caso do dia, no topo).
// ════════════════════════════════════════════════════════════════════════════
describe('visitantes de outro hospital — ordem do rodapé de ORIGEM (dono 31/07)', () => {
  const casos = [
    caso('CO - Cesárea', 0, 'LEONARDO', 'Cristiane Melo'),
    caso('CC - Sala 3', 0, 'PAULO + GUILHERME MELO', 'Eduardo Menegat'),
    caso('CC - Sala 6', 0, 'GABRIELA', 'Leonardo Winkelmann'),
    caso('S9', 0, 'RAUL', 'Barbara Anahy'),
  ]
  const rodapeOutros = [
    { nome: 'GUILHERME MELO', rodapeIdx: 6 },
    { nome: 'GABRIELA', rodapeIdx: 7 },
    { nome: 'LEONARDO', rodapeIdx: 8 },
  ]

  it('extras com origem conhecida vão ao FIM na ordem de liberação de origem (maior índice = libera primeiro)', () => {
    const r = gerarColunaLiberacao(casos, ['PAULO', 'RAUL'], { rodapeOutros })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(
      ['Paulo', 'Raul', 'Guilherme Melo', 'Gabriela', 'Leonardo']
    )
    // continuam extras (a view põe o badge "Ajuda (HRO)" pelo cruzamento)
    expect(r.linhas.slice(2).every((l) => l.isExtra)).toBe(true)
  })

  it('no bloco de ajuda: com origem ordena pela origem DEPOIS das ajudas manuais, e perde as setas', () => {
    const cs = [...casos, caso('S2', 0, 'DIEGO', 'Xavier')]
    const r = gerarColunaLiberacao(cs, ['PAULO', 'RAUL', 'DIEGO'], {
      ajudaExterna: ['LEONARDO', 'GUILHERME MELO', 'GABRIELA', 'DIEGO'],
      rodapeOutros,
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(
      ['Paulo', 'Raul', 'Diego', 'Guilherme Melo', 'Gabriela', 'Leonardo']
    )
    const [melo, gabriela, leonardo] = r.linhas.slice(3)
    // ordem derivada da origem → o array de ajuda não manda mais nesses três
    expect([melo.ajudaIdx, gabriela.ajudaIdx, leonardo.ajudaIdx]).toEqual([null, null, null])
    expect(r.linhas[2].ajudaIdx).toBe(3) // Diego (sem origem) segue reordenável
  })

  it('sem rodapeOutros nada muda (comportamento clássico preservado)', () => {
    const r = gerarColunaLiberacao(casos, ['PAULO', 'RAUL'], {})
    // extras na ordem de ENCONTRO (como era antes)
    expect(r.linhas.map((l) => l.anestesista)).toEqual(
      ['Paulo', 'Raul', 'Leonardo', 'Guilherme Melo', 'Gabriela']
    )
  })
})

// ════════════════════════════════════════════════════════════════════════════
// AZUL DO RODAPÉ SEM CASO AQUI mantém a posição (dono 31/07 — caso LEONARDO):
// a Cesárea dele na Unimed foi repassada ao Tiago e, sem caso em lugar nenhum,
// o HRO o rebaixava pro bloco do fim. Azul no NOSSO rodapé é gente NOSSA
// emprestada — a posição segura; só desce quem tem caso AQUI (caso TIAGO 30/07).
// ════════════════════════════════════════════════════════════════════════════
describe('azul do rodapé sem caso aqui mantém a posição (dono 31/07)', () => {
  const casos = [
    caso('S1', 0, 'MARILIO', 'Eduardo Baldissera'),
    caso('S9', 0, 'KARINE', 'Barbara Anahy'),
  ]

  it('fica na posição do rodapé, com badge e sem nascer liberado', () => {
    const r = gerarColunaLiberacao(casos, ['MARILIO', 'LEONARDO', 'KARINE'], {
      ajudaExterna: ['LEONARDO'],
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Marilio', 'Leonardo', 'Karine'])
    const leo = r.linhas[1]
    expect(leo.isAjuda).toBe(true)
    expect(leo.teveCasos).toBe(true) // está trabalhando — em outro lugar
  })

  it('azul sem caso abrindo o rodapé NÃO leva o selo de plantonista', () => {
    const r = gerarColunaLiberacao(casos, ['LEONARDO', 'MARILIO', 'KARINE'], {
      ajudaExterna: ['LEONARDO'],
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Leonardo', 'Marilio', 'Karine'])
    expect(r.linhas[0].isPlantonista).toBe(false)
    expect(r.linhas[1].isPlantonista).toBe(true) // 1º dos NOSSOS
    expect(r.plantonista).toBe('Marilio')
  })

  it('azul com caso AQUI segue descendo pro fim (regra do caso TIAGO intacta)', () => {
    const comCasoAqui = [...casos, caso('S4', 0, 'DIEGO', 'Xavier Yves')]
    const r = gerarColunaLiberacao(comCasoAqui, ['MARILIO', 'DIEGO', 'KARINE'], {
      ajudaExterna: ['DIEGO'],
    })
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Marilio', 'Karine', 'Diego'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// VISITANTE SEM CASO no destino (dono 31/07): repassado o último caso dele, a
// entrada em ajuda_externa (gravada pelo repasse ou à mão) sustenta a linha —
// com origem conhecida ele não nasce "não escalado"/liberado e ordena pela
// liberação do rodapé de ORIGEM.
// ════════════════════════════════════════════════════════════════════════════
describe('visitante sem caso no destino — linha sustentada pela ajuda (dono 31/07)', () => {
  it('ajuda com origem conhecida: teveCasos, fim da fila, ordem de origem', () => {
    const r = gerarColunaLiberacao(
      [caso('S1', 0, 'PAULO', 'Eduardo Menegat')],
      ['PAULO', 'RAUL'],
      {
        ajudaExterna: ['LEONARDO'],
        rodapeOutros: [{ nome: 'LEONARDO', rodapeIdx: 8 }],
      }
    )
    expect(r.linhas.map((l) => l.anestesista)).toEqual(['Paulo', 'Raul', 'Leonardo'])
    const leo = r.linhas[2]
    expect(leo.teveCasos).toBe(true)  // não nasce liberado: veio de fora p/ trabalhar
    expect(leo.ajudaIdx).toBeNull()   // ordem derivada da origem — sem setas
  })
})

// Defeitos D8/D12 (07/08): identidade NUNCA vem do nome exibido.
describe('identidade da linha — nunca pelo display', () => {
  it('slot assumido expõe deNomeOriginal (nome CRU do rodapé) além do display', () => {
    const r = gerarColunaLiberacao(
      [caso('S1', 0, 'GIOVANA', 'Cirurgião X', '07:30', { anestesistaUserId: 'uid-gio' })],
      ['GUILHERME STAUB'],
      { assumidas: { 'GUILHERME STAUB': { uid: 'uid-gio', nome: 'GIOVANA SILVA' } } },
    )
    const linha = r.linhas[0]
    // o desfazer casa o dono por normNome do nome CRU — o display encurtado
    // ("G. Staub") não bate com o cadastro e degradava p/ "só posição"
    expect(linha.assumida.deNomeOriginal).toBe('GUILHERME STAUB')
    expect(linha.nomeOriginal).toBe('GUILHERME STAUB')
  })

  it('nomeOriginal não defaulta para o display (a classe do bug de 22/07)', () => {
    const r = gerarColunaLiberacao(
      [caso('S1', 0, 'MARILIO', 'Cirurgião X')],
      ['MARILIO'],
      {},
    )
    // call sites reais SEMPRE passam nomeOriginal; o contrato é que ele venha do
    // RODAPÉ (cru), nunca do texto exibido na tela
    expect(r.linhas[0].nomeOriginal).toBe('MARILIO')
    expect(r.linhas[0].anestesista).toBe('Marilio') // display é outra coisa
  })
})

// ════════════════════════════════════════════════════════════════════════════
// ORDEM DA CAUDA POR HOSPITAL DE ORIGEM (dono 27/08): "sempre os primeiros a
// irem embora são os plantões do contraturno, após os anestesistas que estariam
// escalados no materno e após os anestesistas de outro hospital, sempre
// respeitando a ordem de liberação do hospital de origem".
//
// O caso que originou a regra é REAL — Unimed, tarde de 27/08. GUSTAVO e
// ALEXANDRE S ajudavam a Unimed vindos do HRO, onde o rodapé da tarde tem
// ALEXANDRE S em 6º e GUSTAVO em 10º. A fila da Unimed liberava o Alexandre
// primeiro (ordem de ENCONTRO dos casos), quando quem sai antes é o Gustavo —
// ele está mais para o fim do rodapé de origem.
// ════════════════════════════════════════════════════════════════════════════
describe('cauda da fila: Materno antes dos outros hospitais (dono 27/08)', () => {
  // recorte fiel da Unimed/tarde de 27/08 (nomes do rodapé publicado)
  const casosUnimed = [
    caso('CC - Sala 2', 0, 'MARILIO', 'Cirurgião A'),
    caso('CC - Sala 3', 0, 'GABRIELA', 'Cirurgião B'),
    caso('CO - Cesárea', 0, 'GUSTAVO', 'Cirurgião C'),
    caso('Exames', 0, 'ROMULO', 'Cirurgião D'),
    caso('Imagem', 0, 'ALEXANDRE S', 'Cirurgião E'),
  ]
  const rodapeUnimed = ['GABRIELA', 'MARILIO', 'OSCAR']
  // rodapé do HRO da tarde: ALEXANDRE S em 6º, GUSTAVO em 10º
  const doHro = [
    { nome: 'ALEXANDRE S', hospital: 'hro', rodapeIdx: 5 },
    { nome: 'GUSTAVO', hospital: 'hro', rodapeIdx: 9 },
  ]

  it('entre ajudas do MESMO hospital vale a ordem de liberação de lá: Gustavo sai antes de Alexandre', () => {
    const r = gerarColunaLiberacao(casosUnimed, rodapeUnimed, {
      turno: 'vespertino', rodapeOutros: doHro,
    })
    const nomes = r.linhas.map((l) => l.anestesista)
    // Oscar fecha o rodapé → plantão do contraturno, sempre o último da lista
    expect(nomes[nomes.length - 1]).toBe('Oscar')
    // índice MAIOR no rodapé de origem = sai antes = mais embaixo aqui
    expect(nomes.indexOf('Gustavo')).toBeGreaterThan(nomes.indexOf('Alexandre S'))
  })

  it('quem estaria no MATERNO sai antes de quem veio de outro hospital', () => {
    const r = gerarColunaLiberacao(casosUnimed, rodapeUnimed, {
      turno: 'vespertino',
      rodapeOutros: [...doHro, { nome: 'ROMULO', hospital: 'materno', rodapeIdx: 0 }],
    })
    const nomes = r.linhas.map((l) => l.anestesista)
    // cauda, de cima para baixo: Alexandre (HRO 6º) · Gustavo (HRO 10º) · Rômulo
    // (Materno) · Oscar (contraturno). O fim libera primeiro.
    expect(nomes.slice(-4)).toEqual(['Alexandre S', 'Gustavo', 'Romulo', 'Oscar'])
  })

  it('o Materno vem primeiro mesmo sendo o 1º do rodapé de lá — hospital manda antes do índice', () => {
    const r = gerarColunaLiberacao(casosUnimed, rodapeUnimed, {
      turno: 'vespertino',
      rodapeOutros: [
        { nome: 'ALEXANDRE S', hospital: 'hro', rodapeIdx: 15 }, // último do HRO
        { nome: 'ROMULO', hospital: 'materno', rodapeIdx: 0 },   // primeiro do Materno
      ],
    })
    const nomes = r.linhas.map((l) => l.anestesista)
    expect(nomes.indexOf('Romulo')).toBeGreaterThan(nomes.indexOf('Alexandre S'))
  })

  it('sem `hospital` na origem o comportamento de 31/07 é idêntico (só o índice manda)', () => {
    const r = gerarColunaLiberacao(casosUnimed, rodapeUnimed, {
      turno: 'vespertino',
      rodapeOutros: [{ nome: 'ALEXANDRE S', rodapeIdx: 5 }, { nome: 'GUSTAVO', rodapeIdx: 9 }],
    })
    const nomes = r.linhas.map((l) => l.anestesista)
    expect(nomes.indexOf('Gustavo')).toBeGreaterThan(nomes.indexOf('Alexandre S'))
  })
})

// ════════════════════════════════════════════════════════════════════════════
// ORIGEM INFORMADA À MÃO (dono 27/08): "crie um sistema para informar, pq
// eventualmente o materno não tem escala e esses anestesistas não aparecem em
// escala nenhuma". Sem escala do Materno publicada não há rodapé de onde
// derivar, e quem veio de lá ficava sem lugar na cauda. A marca vive em
// `linha_overrides[turno:chave].origem` e chega aqui como `origemManual`.
// ════════════════════════════════════════════════════════════════════════════
describe('origem informada à mão — o Materno sem escala (dono 27/08)', () => {
  const casos = [
    caso('CC - Sala 2', 0, 'MARILIO', 'Cirurgião A'),
    caso('CO - Cesárea', 0, 'GUSTAVO', 'Cirurgião C'),
    caso('Exames', 0, 'ROMULO', 'Cirurgião D'),
    caso('Imagem', 0, 'ALEXANDRE S', 'Cirurgião E'),
  ]
  const rodape = ['GABRIELA', 'MARILIO', 'OSCAR']
  const doHro = [
    { nome: 'ALEXANDRE S', hospital: 'hro', hospitalLabel: 'HRO', rodapeIdx: 5 },
    { nome: 'GUSTAVO', hospital: 'hro', hospitalLabel: 'HRO', rodapeIdx: 9 },
  ]

  it('marcado como Materno, vai para o fim da cauda e sai antes dos vindos do HRO', () => {
    const r = gerarColunaLiberacao(casos, rodape, {
      turno: 'vespertino', rodapeOutros: doHro,
      origemManual: { ROMULO: { hospital: 'materno', label: 'Materno' } },
    })
    const nomes = r.linhas.map((l) => l.anestesista)
    // recorte real de 27/08 na Unimed: o fim libera primeiro
    expect(nomes.slice(-4)).toEqual(['Alexandre S', 'Gustavo', 'Romulo', 'Oscar'])
  })

  it('sem a marca, quem não está em rodapé nenhum não tem ordem de origem e sai por último', () => {
    const r = gerarColunaLiberacao(casos, rodape, { turno: 'vespertino', rodapeOutros: doHro })
    const nomes = r.linhas.map((l) => l.anestesista)
    // é exatamente este buraco que a marca fecha — Rômulo acima dos dois do HRO
    expect(nomes.indexOf('Romulo')).toBeLessThan(nomes.indexOf('Alexandre S'))
  })

  it('a marca é a fonte do RÓTULO do badge, não só da ordem', () => {
    const r = gerarColunaLiberacao(casos, rodape, {
      turno: 'vespertino', rodapeOutros: doHro,
      origemManual: { ROMULO: { hospital: 'materno', label: 'Materno' } },
    })
    const porNome = Object.fromEntries(r.linhas.map((l) => [l.anestesista, l]))
    expect(porNome.Romulo.origemLabel).toBe('Materno')
    expect(porNome.Romulo.origemHospital).toBe('materno')
    // derivada do rodapé de origem entrega o mesmo par, sem marca nenhuma
    expect(porNome.Gustavo.origemLabel).toBe('HRO')
    expect(porNome.Gustavo.origemHospital).toBe('hro')
    // quem é da casa não tem origem
    expect(porNome.Marilio.origemHospital).toBeNull()
  })

  it('marca do MESMO hospital em que a pessoa já aparece preserva a posição real de lá', () => {
    const r = gerarColunaLiberacao(casos, rodape, {
      turno: 'vespertino', rodapeOutros: doHro,
      // confirmar "veio do HRO" não pode zerar o 10º do Gustavo e empatá-lo com o 6º
      origemManual: { GUSTAVO: { hospital: 'hro', label: 'HRO' } },
    })
    const nomes = r.linhas.map((l) => l.anestesista)
    expect(nomes.indexOf('Gustavo')).toBeGreaterThan(nomes.indexOf('Alexandre S'))
  })
})

// ════════════════════════════════════════════════════════════════════════════
// MATERNO SEM PLANTÃO DE CONTRATURNO (dono 31/08): "o segundo anestesista no
// materno não precisa de badge de plantão". A regra do último-do-rodapé (29/07)
// nasceu do HRO/Unimed; no Materno, com rodapé de 2, ela rotulava o 2º nome
// como plantão de um turno que não existe lá — e o movia para o fim da fila.
// `plantaoContraturno: false` desliga o selo E o movimento; o Plantonista (1º)
// fica.
// ════════════════════════════════════════════════════════════════════════════
describe('plantaoContraturno: false — o Materno não tem plantão do turno seguinte', () => {
  const casos = [
    caso('Sala 1', 0, 'ANA', 'Cir A'),
    caso('Sala 2', 0, 'BIA', 'Cir B'),
  ]

  it('não marca o último como plantão do turno seguinte nem o move', () => {
    const { linhas } = gerarColunaLiberacao(casos, ['ANA', 'BIA'], {
      turno: 'matutino', plantaoContraturno: false,
    })
    expect(linhas.some((l) => l.isProximoPlantao)).toBe(false)
    expect(linhas.map((l) => l.anestesista)).toEqual(['Ana', 'Bia'])
    // o plantonista continua sendo o 1º
    expect(linhas[0].isPlantonista).toBe(true)
  })

  it('sem a opção, a regra de sempre segue valendo (HRO/Unimed)', () => {
    const { linhas } = gerarColunaLiberacao(casos, ['ANA', 'BIA'], { turno: 'matutino' })
    const ultimo = linhas[linhas.length - 1]
    expect(ultimo.isProximoPlantao).toBe(true)
    expect(ultimo.plantaoLabel).toBe('Plantão da tarde')
  })
})
