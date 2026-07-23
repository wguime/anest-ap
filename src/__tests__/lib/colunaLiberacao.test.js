import { describe, it, expect } from 'vitest'
import {
  fraseClinica,
  gerarColunaLiberacao,
  nomeCirurgiaoCurto,
  resolverAnestesistas,
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
    expect(nomeCirurgiaoCurto('Cassiano Branco Dal Piva')).toBe('Cassiano Piva')
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
  it('rodapé vazio → plantonista null e nenhuma linha marcada', () => {
    const r = gerarColunaLiberacao([caso('S1', 0, 'EXTRA', 'Pedro Barros')], [])
    expect(r.plantonista).toBeNull()
    expect(r.linhas[0].isPlantonista).toBe(false)
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
