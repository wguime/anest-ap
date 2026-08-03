import { describe, expect, it } from 'vitest'

import {
  PUBLIC_PLACEHOLDER,
  collectLegacyMedicalLeaves,
  extractMedicalLeavesFromStaff,
  isMedicalLeaveActiveOn,
  mergeMedicalLeavesForEditing,
  sanitizeStaffForPublic,
} from '@/lib/staffMedicalLeaves'

function timestamp(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12, 0, 0)
  return { toDate: () => date }
}

function privateLeave(overrides = {}) {
  return {
    id: 'leave-1',
    scope: 'hospitais',
    employeeName: 'Maria Privada',
    kind: 'medical_leave',
    startsAt: timestamp('2026-09-10'),
    endsAt: timestamp('2026-09-14'),
    status: 'active',
    source: 'manual',
    previousAssignment: {
      sectionKey: 'hro',
      turno: '07:00-13:00',
      funcoes: 'Centro cirurgico',
    },
    ...overrides,
  }
}

function publicSchedule() {
  return {
    hospitais: {
      hro: [{ nome: 'Ana Operacional', turno: '07:00-13:00', status: 'ativa' }],
      unimed: [],
      indisponivel: [{ ...PUBLIC_PLACEHOLDER }],
    },
    consultorio: {
      recepcao: [{ nome: 'Beatriz Operacional', turno: '08:00-17:00', status: 'ativa' }],
      financeiro: [],
      indisponivel: [],
    },
    hospitaisCardData: '2026-09-11',
    hospitaisCardTurno: 'manha',
  }
}

describe('staffMedicalLeaves', () => {
  describe('sanitizeStaffForPublic', () => {
    it('remove atestados dos dois escopos e publica apenas placeholders anonimos', () => {
      const rawStaff = {
        hospitais: {
          hro: [{ nome: 'Ana Operacional', turno: '07:00-13:00', status: 'ativa' }],
          atestado: [{
            nome: 'Maria Privada',
            turno: '10/09/2026-14/09/2026',
            startsOn: '2026-09-10',
            endsOn: '2026-09-14',
            status: 'atestado',
          }],
        },
        consultorio: {
          recepcao: [{ nome: 'Beatriz Operacional', turno: '08:00-17:00', status: 'ativa' }],
          atestado: [{
            nome: 'Joana Privada',
            turno: '11/09/2026-12/09/2026',
            startsOn: '2026-09-11',
            endsOn: '2026-09-12',
            status: 'atestado',
          }],
        },
        medicalLeaves: [{ employeeName: 'Nao deve vazar' }],
        staffMedicalLeaves: [{ employeeName: 'Nem este nome' }],
      }
      const leaves = [
        privateLeave(),
        privateLeave({
          id: 'leave-2',
          scope: 'consultorio',
          employeeName: 'Joana Privada',
          startsAt: timestamp('2026-09-11'),
          endsAt: timestamp('2026-09-12'),
        }),
      ]

      const sanitized = sanitizeStaffForPublic(rawStaff, leaves, '2026-09-11')

      expect(sanitized.hospitais).not.toHaveProperty('atestado')
      expect(sanitized.consultorio).not.toHaveProperty('atestado')
      expect(sanitized).not.toHaveProperty('medicalLeaves')
      expect(sanitized).not.toHaveProperty('staffMedicalLeaves')
      expect(sanitized.hospitais.indisponivel).toEqual([{ ...PUBLIC_PLACEHOLDER }])
      expect(sanitized.consultorio.indisponivel).toEqual([{ ...PUBLIC_PLACEHOLDER }])
      expect(sanitized.hospitais.hro[0].nome).toBe('Ana Operacional')
      expect(sanitized.consultorio.recepcao[0].nome).toBe('Beatriz Operacional')

      const publicJson = JSON.stringify(sanitized)
      expect(publicJson).not.toContain('Maria Privada')
      expect(publicJson).not.toContain('Joana Privada')
      expect(publicJson).not.toContain('2026-09-10')
      expect(publicJson).not.toContain('2026-09-14')
    })

    it('considera a data futura selecionada e ignora afastamentos cancelados ou fora do dia', () => {
      const leaves = [
        privateLeave(),
        privateLeave({ id: 'leave-future', startsAt: timestamp('2026-10-01'), endsAt: timestamp('2026-10-03') }),
        privateLeave({ id: 'leave-cancelled', status: 'cancelled' }),
      ]

      const duringSeptember = sanitizeStaffForPublic(publicSchedule(), leaves, '2026-09-12')
      const duringOctober = sanitizeStaffForPublic(publicSchedule(), leaves, '2026-10-02')
      const afterAll = sanitizeStaffForPublic(publicSchedule(), leaves, '2026-10-10')

      expect(duringSeptember.hospitais.indisponivel).toHaveLength(1)
      expect(duringOctober.hospitais.indisponivel).toHaveLength(1)
      expect(afterAll.hospitais.indisponivel).toEqual([])
    })

    it('projeta o ciclo futuro, ativo e encerrado preservando a atribuicao anterior', () => {
      const leave = privateLeave({
        employeeName: 'Maria Privada',
        startsAt: timestamp('2026-09-10'),
        endsAt: timestamp('2026-09-14'),
        previousAssignment: {
          sectionKey: 'hro',
          turno: '07:00-13:00',
          funcoes: 'Centro cirurgico',
        },
      })
      const scheduleBeforeLeave = {
        hospitais: {
          hro: [{
            nome: 'Maria Privada',
            turno: '07:00-13:00',
            status: 'ativa',
            funcoes: 'Centro cirurgico',
          }],
          unimed: [],
          indisponivel: [],
        },
        consultorio: { recepcao: [], indisponivel: [] },
      }

      const futureProjection = sanitizeStaffForPublic(
        scheduleBeforeLeave,
        [leave],
        '2026-09-09'
      )
      expect(futureProjection.hospitais.hro).toEqual([
        {
          nome: 'Maria Privada',
          turno: '07:00-13:00',
          status: 'ativa',
          funcoes: 'Centro cirurgico',
        },
      ])
      expect(futureProjection.hospitais.indisponivel).toEqual([])

      const firstDayProjection = sanitizeStaffForPublic(
        futureProjection,
        [leave],
        '2026-09-10'
      )
      expect(firstDayProjection.hospitais.hro).toEqual([])
      expect(firstDayProjection.hospitais.indisponivel).toEqual([
        { ...PUBLIC_PLACEHOLDER },
      ])

      const afterEndProjection = sanitizeStaffForPublic(
        firstDayProjection,
        [leave],
        '2026-09-15'
      )
      expect(afterEndProjection.hospitais.hro).toEqual([
        {
          nome: 'Maria Privada',
          turno: '07:00-13:00',
          status: 'ativa',
          funcoes: 'Centro cirurgico',
        },
      ])
      expect(afterEndProjection.hospitais.indisponivel).toEqual([])
      expect(leave.previousAssignment).toEqual({
        sectionKey: 'hro',
        turno: '07:00-13:00',
        funcoes: 'Centro cirurgico',
      })
    })

    it('nao restaura afastamentos passados ou futuros do mesmo nome enquanto outro esta ativo', () => {
      const active = privateLeave({
        id: 'leave-active',
        startsAt: timestamp('2026-09-10'),
        endsAt: timestamp('2026-09-14'),
        previousAssignment: { sectionKey: 'hro', turno: '07:00-13:00' },
      })
      const past = privateLeave({
        id: 'leave-past',
        startsAt: timestamp('2026-08-01'),
        endsAt: timestamp('2026-08-05'),
        previousAssignment: { sectionKey: 'unimed', turno: '08:00-14:00' },
      })
      const future = privateLeave({
        id: 'leave-future',
        startsAt: timestamp('2026-10-01'),
        endsAt: timestamp('2026-10-05'),
        previousAssignment: { sectionKey: 'materno', turno: '13:00-19:00' },
      })
      const publicDuringActiveLeave = {
        hospitais: {
          hro: [],
          unimed: [],
          materno: [],
          indisponivel: [{ ...PUBLIC_PLACEHOLDER }],
        },
        consultorio: { recepcao: [], indisponivel: [] },
      }

      const projection = sanitizeStaffForPublic(
        publicDuringActiveLeave,
        [past, active, future],
        '2026-09-11'
      )

      expect(projection.hospitais.hro).toEqual([])
      expect(projection.hospitais.unimed).toEqual([])
      expect(projection.hospitais.materno).toEqual([])
      expect(projection.hospitais.indisponivel).toEqual([
        { ...PUBLIC_PLACEHOLDER },
      ])
      expect(JSON.stringify(projection.hospitais)).not.toContain('Maria Privada')
    })
  })

  describe('schema privado e edicao', () => {
    it('reconhece inclusivamente os limites de um afastamento no schema Firestore real', () => {
      const leave = privateLeave()

      expect(isMedicalLeaveActiveOn(leave, '2026-09-09')).toBe(false)
      expect(isMedicalLeaveActiveOn(leave, '2026-09-10')).toBe(true)
      expect(isMedicalLeaveActiveOn(leave, '2026-09-14')).toBe(true)
      expect(isMedicalLeaveActiveOn(leave, '2026-09-15')).toBe(false)
    })

    it('mescla afastamentos privados com a escala publica somente para edicao autorizada', () => {
      const merged = mergeMedicalLeavesForEditing(publicSchedule(), [privateLeave()])

      expect(merged.hospitais).not.toHaveProperty('indisponivel')
      expect(merged.hospitais.atestado).toEqual([{
        nome: 'Maria Privada',
        turno: '10/09/2026-14/09/2026',
        status: 'atestado',
        medicalLeaveId: 'leave-1',
        startsOn: '2026-09-10',
        endsOn: '2026-09-14',
        source: 'manual',
        requiresDateConfirmation: false,
        previousAssignment: {
          sectionKey: 'hro',
          turno: '07:00-13:00',
          funcoes: 'Centro cirurgico',
        },
        funcoes: 'Centro cirurgico',
      }])
      expect(merged.consultorio.atestado).toEqual([])
    })

    it('extrai do formulario o contrato privado sem carregar campos operacionais arbitrarios', () => {
      const staffForEditing = {
        hospitais: {
          hro: [],
          atestado: [{
            nome: '  Maria Privada  ',
            turno: '10/09/2026-14/09/2026',
            status: 'atestado',
            medicalLeaveId: 'leave-1',
            startsOn: '2026-09-10',
            endsOn: '2026-09-14',
            source: 'manual',
            observacao: 'nao deve ir ao documento privado',
            previousAssignment: { sectionKey: 'hro', turno: '07:00-13:00' },
          }],
        },
        consultorio: { recepcao: [], atestado: [] },
      }

      expect(extractMedicalLeavesFromStaff(staffForEditing)).toEqual([{
        id: 'leave-1',
        scope: 'hospitais',
        employeeName: 'Maria Privada',
        startsOn: '2026-09-10',
        endsOn: '2026-09-14',
        source: 'manual',
        previousAssignment: { sectionKey: 'hro', turno: '07:00-13:00' },
      }])
    })
  })

  describe('legado', () => {
    it('coleta o formato antigo sem inventar datas e exige confirmacao do ano', () => {
      const rawStaff = {
        hospitais: {
          hro: [],
          atestado: [{ nome: 'Maria Legada', turno: '03/08 - 09/08', status: 'atestado' }],
        },
        consultorio: {
          recepcao: [],
          atestado: [{ nome: 'Joana Legada', turno: 'A partir de 10/08', status: 'atestado' }],
        },
      }

      expect(collectLegacyMedicalLeaves(rawStaff)).toEqual([
        {
          id: 'legacy-hospitais-0',
          scope: 'hospitais',
          employeeName: 'Maria Legada',
          legacyRange: '03/08 - 09/08',
          status: 'active',
          source: 'legacy',
          requiresDateConfirmation: true,
        },
        {
          id: 'legacy-consultorio-0',
          scope: 'consultorio',
          employeeName: 'Joana Legada',
          legacyRange: 'A partir de 10/08',
          status: 'active',
          source: 'legacy',
          requiresDateConfirmation: true,
        },
      ])
    })

    it('mostra o intervalo legado na edicao, mas mantem datas ISO vazias ate confirmacao', () => {
      const legacy = collectLegacyMedicalLeaves({
        hospitais: {
          atestado: [{ nome: 'Maria Legada', turno: '03/08 - 09/08' }],
        },
      })

      const merged = mergeMedicalLeavesForEditing(publicSchedule(), [], legacy)

      expect(merged.hospitais.atestado[0]).toMatchObject({
        nome: 'Maria Legada',
        turno: '03/08 - 09/08',
        startsOn: null,
        endsOn: null,
        source: 'legacy',
        requiresDateConfirmation: true,
      })
    })
  })
})
