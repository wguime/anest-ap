/**
 * URGÊNCIAS AGUARDANDO (dono 11/11/2026, opção A de `.tmp/analise-escala-2026-11/modelos-6/
 * 2-urgencias-aguardando.html`).
 *
 * Um bloco com o MESMO nome e o MESMO desenho na Completa (abaixo da faixa de urgências) e nas
 * Liberações (no topo): uma linha por urgência que ainda não começou — selo da gravidade ·
 * procedimento · sala (ou "Sala a definir") · quem faz (ou "sem anestesista") · "lançada há X" ·
 * "Definir" (44 px) quando falta o anestesista. Substitui a "Fila — N aguardando" de dentro da
 * faixa e, para urgências, o cartão "Procedimentos sem anestesista" (que continua para as
 * ELETIVAS). Só HRO.
 *
 * Aqui fica a trava do COMPONENTE (o que cada linha diz e o que cada toque dispara). As duas
 * telas que o montam têm as suas: `escalaUrgenciasFaixa.test.jsx` (Completa: a lista vem de
 * `estado.fila`, e "Definir" abre a folha de quem responde) e `liberacoesPainelLinha.test.jsx`
 * (Liberações: o bloco no topo, e a eletiva continua na caixa de sem anestesista).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UrgenciasAguardando from '@/pages/escala-cirurgica/UrgenciasAguardando'

const caso = (id, extra = {}) => ({
  id, sala: 'Sala 4', hora: '', tipo: 'urgencia', statusCirurgia: 'agendada',
  procedimento: 'FRATURA DE RADIO', anestesista: 'PAULA', anestesistaUserId: 'uid-paula',
  semAnestesista: false, ...extra,
})
const item = (c, gravidade, esperaMin) => ({ id: c.id, caso: c, gravidade, esperaMin })
const nomeDe = (c) => ({ 'uid-paula': 'Paula Reis' }[c.anestesistaUserId] || c.anestesista)

const SEM_DONO = caso('u1', { sala: '', procedimento: 'APENDICECTOMIA', anestesista: '?', anestesistaUserId: null, semAnestesista: true })
const COM_DONO = caso('u2', { sala: 'Sala 7 - CO', procedimento: 'CESARIANA' })
const TRES = [item(SEM_DONO, 'imediata', 48), item(COM_DONO, 'urgente', 31), item(caso('u3'), 'aguarda', 12)]

const linhas = () => [...document.querySelectorAll('[data-urgencias-aguardando] > div > div')].map((l) => l.textContent)

describe('UrgenciasAguardando — uma linha por urgência que ainda não começou', () => {
  it('título com a contagem, e cada linha: selo · procedimento · sala · quem · há quanto tempo', () => {
    render(<UrgenciasAguardando itens={TRES} nomeDe={nomeDe} />)
    expect(screen.getByText('Urgências aguardando (3)')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Urgências aguardando' })).toBeTruthy()
    expect(linhas()).toEqual([
      'ImediataApendicectomiaSala a definir · sem anestesista · lançada há 48min',
      'UrgenteCesarianaSala 7 - CO · Paula Reis · lançada há 31min',
      'Pode aguardarFratura de radioSala 4 · Paula Reis · lançada há 12min',
    ])
  })

  it('a lista sai na ordem recebida — quem ordena (gravidade → chegada) é a lib, não a tela', () => {
    render(<UrgenciasAguardando itens={[...TRES].reverse()} nomeDe={nomeDe} />)
    expect(linhas().map((l) => l.slice(0, 8))).toEqual(['Pode agu', 'UrgenteC', 'Imediata'])
  })

  it('urgência sem gravidade pede "Classificar"; espera de uma hora ou mais sai como "1h05"', () => {
    render(<UrgenciasAguardando itens={[item(COM_DONO, null, 65)]} nomeDe={nomeDe} />)
    expect(linhas()[0]).toBe('ClassificarCesarianaSala 7 - CO · Paula Reis · lançada há 1h05')
  })

  it('sem nada aguardando o bloco não existe', () => {
    render(<UrgenciasAguardando itens={[]} nomeDe={nomeDe} />)
    expect(document.querySelector('[data-urgencias-aguardando]')).toBeNull()
  })
})

describe('UrgenciasAguardando — os toques', () => {
  it('"Definir" só aparece na que está SEM anestesista, com alvo de 44 px, e entrega a cirurgia', () => {
    const onDefinir = vi.fn()
    render(<UrgenciasAguardando itens={TRES} nomeDe={nomeDe} onDefinir={onDefinir} />)
    const botoes = screen.getAllByRole('button', { name: /^Definir anestesista de / })
    expect(botoes).toHaveLength(1)
    expect(botoes[0].className).toContain('min-h-[44px]')
    expect(botoes[0].className).toContain('min-w-[44px]')
    fireEvent.click(botoes[0])
    expect(onDefinir).toHaveBeenCalledWith(SEM_DONO)
  })

  it('quem não edita (sem `onDefinir`) não vê "Definir" — a linha ainda diz "sem anestesista"', () => {
    render(<UrgenciasAguardando itens={TRES} nomeDe={nomeDe} />)
    expect(screen.queryByRole('button', { name: /^Definir anestesista de / })).toBeNull()
    expect(linhas()[0]).toContain('sem anestesista')
  })

  it('o toque na LINHA abre a cirurgia; "Definir" não dispara o abrir', () => {
    const onAbrir = vi.fn()
    const onDefinir = vi.fn()
    render(<UrgenciasAguardando itens={TRES} nomeDe={nomeDe} onAbrir={onAbrir} onDefinir={onDefinir} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a urgência Cesariana' }))
    expect(onAbrir).toHaveBeenCalledWith(COM_DONO)
    onAbrir.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /^Definir anestesista de / }))
    expect(onAbrir).not.toHaveBeenCalled()
  })

  it('"//" e nome vazio também contam como sem anestesista', () => {
    const onDefinir = vi.fn()
    render(
      <UrgenciasAguardando
        itens={[item(caso('a', { anestesista: '//', anestesistaUserId: null }), 'urgente', 5), item(caso('b', { anestesista: '', anestesistaUserId: null }), 'urgente', 6)]}
        nomeDe={nomeDe} onDefinir={onDefinir}
      />,
    )
    expect(screen.getAllByRole('button', { name: /^Definir anestesista de / })).toHaveLength(2)
  })
})

// O "DEFINIR" É PEQUENO E IGUAL EM TODO LUGAR (dono 11/11/2026, 22h37, olhando o modelo: o botão a
// 44 px VISÍVEIS "ficou grande demais"; quer menor e harmônico com o cartão). A pílula que se vê
// tem 24 px (`h-6`, a altura das pílulas do cartão — dono 11/11, 2ª volta: 32 ainda destoava), só contorno — sem fundo branco —, e o ALVO DE TOQUE continua com 44 px ou
// mais (o botão em volta dela). É a mesma pílula da caixa "Procedimentos sem anestesista" das
// Liberações (`liberacoesPainelLinha.test.jsx` trava a de lá). Não subir para 44 visíveis.
describe('UrgenciasAguardando — pílula "Definir" de 24 px dentro de um alvo de 44 px', () => {
  it('a pílula visível tem 24 px, só contorno, sem fundo; o alvo de toque tem ≥ 44 px', () => {
    render(<UrgenciasAguardando itens={TRES} nomeDe={nomeDe} onDefinir={vi.fn()} />)
    const alvo = screen.getByRole('button', { name: /^Definir anestesista de / })
    const pilula = alvo.querySelector('span')
    expect(pilula.textContent).toBe('Definir')
    // visível: 24 px de altura
    expect(pilula.className).toContain('h-6')
    expect(pilula.className).not.toMatch(/\bh-(7|8|9|10|11|12)\b|min-h-\[4\d px\]|min-h-\[44px\]/)
    // só contorno na cor primária — nada de fundo branco/cartão/sólido
    expect(pilula.className).toContain('border-primary')
    expect(pilula.className).toContain('text-primary')
    expect(pilula.className).not.toMatch(/\bbg-/)
    // o alvo de toque é o botão em volta: 44 × 44 no mínimo, e ele mesmo não pinta fundo
    expect(alvo.className).toContain('min-h-[44px]')
    expect(alvo.className).toContain('min-w-[44px]')
    expect(alvo.className).not.toMatch(/\bbg-/)
  })
})
