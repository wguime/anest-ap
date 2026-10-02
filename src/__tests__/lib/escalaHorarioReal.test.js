/**
 * HORÁRIO REAL de início e término de cada cirurgia (dono 02/10, modelo A escolhido
 * em protótipo `.tmp/inicio-termino-cirurgia.html`): "quero que seja possível
 * adicionar o horário de início e fim de cada procedimento". Decisão do dono na mesma
 * conversa: o horário ANDA JUNTO com o status.
 *
 * Travas:
 *  1. o espelho do trigger no otimista (`horarioRealNaTransicao`) — o toque preenche só
 *     o que está vazio, reabrir limpa, e o início perdido de quem vai de iniciada a
 *     terminada vem do carimbo;
 *  2. o PAR com o banco: o trigger da migration diz a mesma coisa (se um lado mudar
 *     sem o outro, o bloco pisca no refetch);
 *  3. a validação: nunca no futuro (no dia operacional da escala), início nunca depois
 *     do término;
 *  4. `gravarInicioReal` — a regra única do detalhe do caso e da folha das Liberações;
 *  5. a faixa de urgências conta "em sala há" do início real.
 */
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  duracaoMin, ehDiaOperacionalAtual, erroHorarioReal, gravarInicioReal, gravarTerminoReal, horarioRealNaTransicao, rotuloMinutos,
} from '@/lib/escalaHorarioReal'
import { inicioDaUrgencia } from '@/lib/escalaCirurgicaUrgencias'

const AGORA = new Date('2026-10-02T15:45:00-03:00')

describe('o horário anda junto com o status (espelho do trigger)', () => {
  it('Iniciada preenche o início com a hora do toque', () => {
    expect(horarioRealNaTransicao({ statusCirurgia: 'agendada' }, 'iniciada', { agoraD: AGORA }))
      .toEqual({ inicioReal: '15:45', terminoReal: null })
  })

  it('início informado vence a hora do toque', () => {
    expect(horarioRealNaTransicao({ statusCirurgia: 'agendada' }, 'iniciada', { agoraD: AGORA, inicioInformado: '15:10' }))
      .toEqual({ inicioReal: '15:10', terminoReal: null })
  })

  it('Terminada preenche o término e NÃO mexe no início já informado', () => {
    expect(horarioRealNaTransicao({ statusCirurgia: 'iniciada', inicioReal: '13:50' }, 'terminada', { agoraD: AGORA }))
      .toEqual({ inicioReal: '13:50', terminoReal: '15:45' })
  })

  it('iniciada SEM início (antes do recurso) → terminada: o início vem do carimbo que o toque vai sobrescrever', () => {
    const vivo = { statusCirurgia: 'iniciada', statusAtualizadoEm: '2026-10-02T14:33:00-03:00' }
    expect(horarioRealNaTransicao(vivo, 'terminada', { agoraD: AGORA }))
      .toEqual({ inicioReal: '14:33', terminoReal: '15:45' })
  })

  it('término INFORMADO (02/10, tarde) vence a hora do toque, como o início', () => {
    expect(horarioRealNaTransicao({ statusCirurgia: 'iniciada', inicioReal: '14:05' }, 'terminada', { agoraD: AGORA, terminoInformado: '15:30' }))
      .toEqual({ inicioReal: '14:05', terminoReal: '15:30' })
  })

  it('agendada direto para terminada: só o término (não há de onde tirar o início)', () => {
    expect(horarioRealNaTransicao({ statusCirurgia: 'agendada' }, 'terminada', { agoraD: AGORA }))
      .toEqual({ inicioReal: null, terminoReal: '15:45' })
  })

  it('reabrir (terminada → iniciada) apaga o término real e mantém o início', () => {
    expect(horarioRealNaTransicao({ statusCirurgia: 'terminada', inicioReal: '14:05', terminoReal: '15:22' }, 'iniciada', { agoraD: AGORA }))
      .toEqual({ inicioReal: '14:05', terminoReal: null })
  })

  it('voltar a Agendada apaga os dois', () => {
    expect(horarioRealNaTransicao({ statusCirurgia: 'iniciada', inicioReal: '14:05' }, 'agendada', { agoraD: AGORA }))
      .toEqual({ inicioReal: null, terminoReal: null })
  })

  it('o mesmo status e os avisos (atrasada/suspensa) não mexem no horário', () => {
    expect(horarioRealNaTransicao({ statusCirurgia: 'iniciada', inicioReal: '14:05' }, 'iniciada', { agoraD: AGORA })).toEqual({})
    expect(horarioRealNaTransicao({ statusCirurgia: 'iniciada', inicioReal: '14:05' }, 'atrasada', { agoraD: AGORA })).toEqual({})
  })
})

describe('o PAR com o banco: o trigger diz o mesmo que o otimista', () => {
  const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261002190000_escala_caso_horario_real.sql'), 'utf8')
  // o cabeçalho cita o mesmo `drop trigger` no roteiro de rollback — o fim do corpo é a ÚLTIMA ocorrência
  const corpo = sql.slice(sql.indexOf('create or replace function public.escala_caso_horario_real'), sql.lastIndexOf('drop trigger if exists tr_escala_caso_horario_real'))

  it('o horário só acompanha quando o STATUS muda, antes do UPDATE', () => {
    // BEFORE UPDATE de qualquer coluna: a 2ª metade do trigger carimba o autor da
    // correção à mão; a 1ª (o espelho) só roda com o status mudando
    expect(sql).toMatch(/before update on public\.escala_cirurgica_caso/)
    expect(corpo).toMatch(/if new\.status_cirurgia is distinct from old\.status_cirurgia then/)
  })

  it('agendada limpa os dois; iniciada limpa o término e só PREENCHE o início vazio', () => {
    expect(corpo).toMatch(/= 'agendada' then\s+new\.inicio_real := null;\s+new\.termino_real := null;/)
    expect(corpo).toMatch(/= 'iniciada' then\s+new\.termino_real := null;\s+if new\.inicio_real is null then/)
  })

  it('terminada: início vazio vem do carimbo ANTIGO de iniciada; término só se vazio', () => {
    expect(corpo).toMatch(/old\.status_cirurgia = 'iniciada' and old\.status_atualizado_em is not null/)
    expect(corpo).toMatch(/to_char\(old\.status_atualizado_em at time zone 'America\/Sao_Paulo', 'HH24:MI'\)/)
    expect(corpo).toMatch(/if new\.termino_real is null then/)
  })

  it('republicar o turno preserva os dois junto com o andamento', () => {
    expect(sql).toMatch(/'inicio_real', x\.inicio_real, 'termino_real', x\.termino_real/)
    expect(sql).toMatch(/inicio_real,termino_real,inicio_real_por,termino_real_por\)/)
    expect(sql).toMatch(/a\.inicio_real, a\.termino_real/)
  })
})

describe('validação do horário informado à mão', () => {
  const hoje = '2026-10-02'

  it('nunca no futuro — no dia da escala', () => {
    expect(erroHorarioReal({ campo: 'inicio', hhmm: '16:00', dataEscala: hoje, agoraD: AGORA })).toBe('O início não pode ser depois de agora.')
    expect(erroHorarioReal({ campo: 'termino', hhmm: '16:00', dataEscala: hoje, agoraD: AGORA })).toBe('O término não pode ser depois de agora.')
    // 1 min de folga: o relógio do aparelho não é o do banco
    expect(erroHorarioReal({ campo: 'inicio', hhmm: '15:46', dataEscala: hoje, agoraD: AGORA })).toBeNull()
  })

  it('escala de outro dia: "agora" não diz nada sobre ela', () => {
    expect(erroHorarioReal({ campo: 'inicio', hhmm: '16:00', dataEscala: '2026-09-30', agoraD: AGORA })).toBeNull()
  })

  it('madrugada: a noite é continuação da escala de ontem', () => {
    const madrugada = new Date('2026-10-03T00:30:00-03:00')
    expect(ehDiaOperacionalAtual('2026-10-02', madrugada)).toBe(true)
    expect(erroHorarioReal({ campo: 'inicio', hhmm: '23:50', dataEscala: '2026-10-02', agoraD: madrugada })).toBeNull()
    expect(erroHorarioReal({ campo: 'inicio', hhmm: '00:40', dataEscala: '2026-10-02', agoraD: madrugada })).toBe('O início não pode ser depois de agora.')
    expect(ehDiaOperacionalAtual('2026-10-02', new Date('2026-10-03T08:00:00-03:00'))).toBe(false)
  })

  it('início nunca depois do término, término nunca antes do início', () => {
    expect(erroHorarioReal({ campo: 'inicio', hhmm: '15:30', terminoReal: '15:22', dataEscala: hoje, agoraD: AGORA }))
      .toBe('O início não pode ser depois do término (15:22).')
    expect(erroHorarioReal({ campo: 'termino', hhmm: '14:00', inicioReal: '14:05', dataEscala: hoje, agoraD: AGORA }))
      .toBe('O término não pode ser antes do início (14:05).')
  })

  it('horário que não existe', () => {
    expect(erroHorarioReal({ campo: 'inicio', hhmm: '25:00', dataEscala: hoje, agoraD: AGORA })).toBe('Horário inválido.')
  })

  it('duração atravessa a meia-noite; ordem invertida não é duração', () => {
    expect(duracaoMin('14:05', '15:22')).toBe(77)
    expect(duracaoMin('23:50', '00:40')).toBe(50)
    expect(duracaoMin('15:30', '15:22')).toBeNull()
    expect(rotuloMinutos(77)).toBe('1h17')
    expect(rotuloMinutos(40)).toBe('40min')
  })
})

describe('gravarInicioReal — a mesma regra no detalhe do caso e nas Liberações', () => {
  const deps = () => ({ setStatusCirurgia: vi.fn(async () => {}), atualizarCaso: vi.fn(async () => {}) })
  const escala = { id: 'e1' }

  it('cirurgia AGENDADA: informar o início a marca como iniciada, com o horário junto', async () => {
    const d = deps()
    const caso = { id: 'c1', statusCirurgia: 'agendada' }
    await gravarInicioReal({ escala, caso, hhmm: '15:10', userId: 'u1', ...d })
    expect(d.setStatusCirurgia).toHaveBeenCalledWith(escala, caso, 'iniciada', { userId: 'u1', inicioReal: '15:10' })
    expect(d.atualizarCaso).not.toHaveBeenCalled()
  })

  it('já iniciada: só corrige o horário, sem toast', async () => {
    const d = deps()
    await gravarInicioReal({ escala, caso: { id: 'c1', statusCirurgia: 'iniciada' }, hhmm: '13:50', ...d })
    expect(d.atualizarCaso).toHaveBeenCalledWith(escala, 'c1', { inicioReal: '13:50' }, { silencioso: true })
    expect(d.setStatusCirurgia).not.toHaveBeenCalled()
  })

  it('"Limpar" apaga só o horário — não mexe no status', async () => {
    const d = deps()
    await gravarInicioReal({ escala, caso: { id: 'c1', statusCirurgia: 'agendada' }, hhmm: '', ...d })
    expect(d.atualizarCaso).toHaveBeenCalledWith(escala, 'c1', { inicioReal: null }, { silencioso: true })
    expect(d.setStatusCirurgia).not.toHaveBeenCalled()
  })
})

describe('faixa de urgências: "em sala há" conta do início real', () => {
  it('o início informado vence a hora da marcação', () => {
    const caso = { statusCirurgia: 'iniciada', statusAtualizadoEm: '2026-10-02T14:33:00-03:00', inicioReal: '14:05' }
    expect(inicioDaUrgencia(caso, { dataEscala: '2026-10-02' })).toBe(14 * 60 + 5)
  })

  it('sem início informado, segue a marcação (como sempre foi)', () => {
    const caso = { statusCirurgia: 'iniciada', statusAtualizadoEm: '2026-10-02T14:33:00-03:00' }
    expect(inicioDaUrgencia(caso, { dataEscala: '2026-10-02' })).toBe(14 * 60 + 33)
  })

  it('madrugada: marcada 00:10, iniciada 23:50 da véspera — o dia vem da marcação', () => {
    const caso = { statusCirurgia: 'iniciada', statusAtualizadoEm: '2026-10-03T00:10:00-03:00', inicioReal: '23:50' }
    expect(inicioDaUrgencia(caso, { dataEscala: '2026-10-02' })).toBe(23 * 60 + 50)
    const depois = { ...caso, inicioReal: '00:05' }
    expect(inicioDaUrgencia(depois, { dataEscala: '2026-10-02' })).toBe(24 * 60 + 5)
  })
})

describe('gravarTerminoReal — informar o término marca Terminada (dono 02/10, tarde)', () => {
  const deps = () => ({ setStatusCirurgia: vi.fn(async () => {}), atualizarCaso: vi.fn(async () => {}) })
  const escala = { id: 'e1' }

  it('cirurgia aberta (iniciada ou agendada): vai pelo status, com o horário junto', async () => {
    for (const statusCirurgia of ['iniciada', 'agendada']) {
      const d = deps()
      const caso = { id: 'c1', statusCirurgia }
      await gravarTerminoReal({ escala, caso, hhmm: '15:30', userId: 'u1', ...d })
      expect(d.setStatusCirurgia).toHaveBeenCalledWith(escala, caso, 'terminada', { userId: 'u1', terminoReal: '15:30' })
      expect(d.atualizarCaso).not.toHaveBeenCalled()
    }
  })

  it('já terminada: só corrige o horário; vazio só apaga', async () => {
    const d = deps()
    await gravarTerminoReal({ escala, caso: { id: 'c1', statusCirurgia: 'terminada' }, hhmm: '15:10', ...d })
    await gravarTerminoReal({ escala, caso: { id: 'c1', statusCirurgia: 'iniciada' }, hhmm: '', ...d })
    expect(d.atualizarCaso.mock.calls.map((c) => c[2])).toEqual([{ terminoReal: '15:10' }, { terminoReal: null }])
    expect(d.setStatusCirurgia).not.toHaveBeenCalled()
  })
})
