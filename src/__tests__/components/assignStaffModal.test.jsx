import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

const { mockToast } = vi.hoisted(() => ({
  mockToast: vi.fn(),
}))

vi.mock('@/design-system/components/ui/toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/design-system/components/ui/modal', () => {
  function MockModal({ open, title, description, children, footer }) {
    if (!open) return null
    return (
      <div role="dialog" aria-label={title}>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
        <footer>{footer}</footer>
      </div>
    )
  }
  MockModal.Body = ({ children }) => <div>{children}</div>
  return { Modal: MockModal }
})

vi.mock('@/design-system/components/ui/button', () => ({
  Button: ({ children, leftIcon, loading, ...props }) => (
    <button type="button" disabled={loading || props.disabled} {...props}>
      {leftIcon}
      {children}
    </button>
  ),
}))

vi.mock('@/design-system/components/ui/input', () => ({
  Input: ({ label, error, ...props }) => (
    <label>
      {label}
      <input aria-invalid={error ? 'true' : undefined} {...props} />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}))

vi.mock('@/design-system/components/ui/textarea', () => ({
  Textarea: ({ label, onChange, showCount: _showCount, ...props }) => (
    <label>
      {label}
      <textarea {...props} onChange={(event) => onChange(event.target.value)} />
    </label>
  ),
}))

vi.mock('@/design-system/components/ui/select', () => ({
  Select: ({ label, options = [], onChange, error, searchable: _searchable, ...props }) => (
    <label>
      {label}
      <select
        aria-invalid={error ? 'true' : undefined}
        {...props}
        onChange={(event) => onChange(event.target.value)}
      >
        {props.placeholder ? <option value="">{props.placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span>{error}</span> : null}
    </label>
  ),
}))

vi.mock('@/design-system/components/ui/date-picker', () => ({
  DatePicker: ({ label }) => (
    <label>
      {label}
      <input type="date" />
    </label>
  ),
}))

vi.mock('@/design-system/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    onConfirm,
    onClose,
  }) => open ? (
    <div role="alertdialog" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
      <button type="button" onClick={onClose}>{cancelText}</button>
      <button type="button" onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null,
}))

import { AssignStaffModal } from '@/design-system/components/anest/assign-staff-modal'

const ana = {
  nome: 'Ana',
  turno: '08:00-12:00 / 13:00-17:00',
  status: 'ativa',
  funcoes: 'Recepcao e agenda',
  observacao: 'Responsavel pelo caixa',
}

function makeStaff(overrides = {}) {
  return {
    hospitais: {
      hro: [{ nome: 'Bruna', turno: '07:00-13:00', status: 'ativa' }],
      unimed: [],
      materno: [],
      ferias: [],
      atestado: [],
    },
    consultorio: {
      volanFinanceiro: [],
      administrativo: [],
      recepcao: [ana],
      telefoneWhatsapp: [],
      financeiro: [],
      enfermagemQmentum: [],
      ferias: [],
      atestado: [],
    },
    ...overrides,
  }
}

function renderModal(props = {}) {
  const onSave = props.onSave ?? vi.fn().mockResolvedValue({ success: true })
  const onClose = props.onClose ?? vi.fn()
  const result = render(
    <AssignStaffModal
      open
      type="consultorio"
      staff={makeStaff()}
      onSave={onSave}
      onClose={onClose}
      {...props}
    />
  )
  return { ...result, onSave, onClose }
}

describe('AssignStaffModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mantem o nome original no catalogo depois de substituir sua ultima ocorrencia', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true })
    const { unmount } = renderModal({ onSave })

    const nomeSelect = screen.getByLabelText('Substituir por *')
    expect(within(nomeSelect).getByRole('option', { name: 'Ana' })).toBeInTheDocument()

    fireEvent.change(nomeSelect, { target: { value: 'Bruna' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar substituição' }))

    expect(nomeSelect).toHaveValue('Bruna')
    expect(within(nomeSelect).getByRole('option', { name: 'Ana' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const savedStaff = onSave.mock.calls[0][0]
    expect(savedStaff.staffCatalog).toEqual(expect.arrayContaining(['Ana', 'Bruna']))

    unmount()
    renderModal({ staff: savedStaff })
    expect(within(screen.getByLabelText('Substituir por *'))
      .getByRole('option', { name: 'Ana' })).toBeInTheDocument()
  })

  it('move a funcionaria para outro local preservando nome, turno, funcoes e observacao', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true })
    renderModal({ onSave })

    fireEvent.change(screen.getByLabelText('Mover para'), {
      target: { value: 'financeiro' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const savedStaff = onSave.mock.calls[0][0]

    expect(savedStaff.consultorio.recepcao).toEqual([])
    expect(savedStaff.consultorio.financeiro).toEqual([
      {
        nome: 'Ana',
        turno: '08:00-12:00 / 13:00-17:00',
        status: 'ativa',
        funcoes: 'Recepcao e agenda',
        observacao: 'Responsavel pelo caixa',
      },
    ])
  })

  it('pede confirmacao antes de aplicar a troca de nome', () => {
    renderModal()

    const nomeSelect = screen.getByLabelText('Substituir por *')
    fireEvent.change(nomeSelect, { target: { value: 'Bruna' } })

    expect(screen.getByRole('alertdialog', { name: 'Substituir funcionária?' }))
      .toBeInTheDocument()
    expect(nomeSelect).toHaveValue('Ana')

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar substituição' }))

    expect(nomeSelect).toHaveValue('Bruna')
    expect(screen.queryByRole('alertdialog', { name: 'Substituir funcionária?' }))
      .not.toBeInTheDocument()
  })

  it('nao apaga a edicao local quando o prop staff muda com formulario sujo', () => {
    const initialStaff = makeStaff()
    const { rerender } = renderModal({ staff: initialStaff })

    const observacao = screen.getByLabelText('Observação operacional')
    fireEvent.change(observacao, { target: { value: 'Edicao local ainda nao salva' } })
    expect(observacao).toHaveValue('Edicao local ainda nao salva')

    const staffFromRealtime = makeStaff({
      consultorio: {
        ...initialStaff.consultorio,
        recepcao: [{ ...ana, observacao: 'Atualizacao recebida do servidor' }],
      },
    })

    rerender(
      <AssignStaffModal
        open
        type="consultorio"
        staff={staffFromRealtime}
        onSave={vi.fn().mockResolvedValue({ success: true })}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Observação operacional')).toHaveValue('Edicao local ainda nao salva')
  })

  it('na substituicao remove observacoes da pessoa anterior sem alterar dados do posto', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true })
    renderModal({ onSave })

    fireEvent.change(screen.getByLabelText('Substituir por *'), {
      target: { value: 'Bruna' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar substituição' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const substituta = onSave.mock.calls[0][0].consultorio.recepcao[0]
    expect(substituta).toEqual({
      nome: 'Bruna',
      turno: '08:00-12:00 / 13:00-17:00',
      status: 'ativa',
      funcoes: 'Recepcao e agenda',
    })
  })

  it('RH privado salva atestado sem apagar secoes operacionais nem alterar metadados do card', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true })
    const staff = makeStaff({
      consultorio: {
        volanFinanceiro: [{ nome: 'Carla', turno: '08:00-12:00', status: 'ativa' }],
        administrativo: [],
        recepcao: [ana],
        telefoneWhatsapp: [],
        financeiro: [{ nome: 'Bruna', turno: '13:00-17:00', status: 'ativa' }],
        enfermagemQmentum: [],
        ferias: [{ nome: 'Daniela', turno: '01/09-05/09', status: 'ferias' }],
        atestado: [{
          nome: 'Maria',
          turno: '10/09/2026-14/09/2026',
          status: 'atestado',
          startsOn: '2026-09-10',
          endsOn: '2026-09-14',
          medicalLeaveId: 'leave-1',
          source: 'manual',
          previousAssignment: {
            sectionKey: 'recepcao',
            turno: '08:00-12:00 / 13:00-17:00',
            funcoes: 'Recepcao e agenda',
          },
        }],
      },
      consultorioCardData: '2026-09-11',
      consultorioCardTurno: 'tarde',
    })
    const { atestado: _privateBefore, ...operationalBefore } = staff.consultorio

    renderModal({
      staff,
      onSave,
      canManageAbsences: true,
      canEditOperational: false,
      cardData: staff.consultorioCardData,
      cardTurno: staff.consultorioCardTurno,
    })

    expect(screen.queryByLabelText('Data exibida no card')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /RECEPÇÃO\/ATENDIMENTO/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ATESTADO/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))

    const savedStaff = onSave.mock.calls[0][0]
    const { atestado: savedLeaves, ...operationalAfter } = savedStaff.consultorio
    expect(operationalAfter).toEqual(operationalBefore)
    expect(savedLeaves).toEqual([expect.objectContaining({
      nome: 'Maria',
      turno: '10/09-14/09',
      status: 'atestado',
      startsOn: '2026-09-10',
      endsOn: '2026-09-14',
      medicalLeaveId: 'leave-1',
      source: 'manual',
      previousAssignment: staff.consultorio.atestado[0].previousAssignment,
    })])
    expect(savedStaff.consultorioCardData).toBe('2026-09-11')
    expect(savedStaff.consultorioCardTurno).toBe('tarde')
  })

  // Dono 01/09: ATESTADO passou a ser um destino de "Mover para" para quem edita a
  // escala, e nao mais so para o perfil dedicado de RH. A trava real esta em
  // `useStaff` (quem recebe canManageAbsences); aqui garantimos que a opcao chega
  // ao seletor nas duas categorias.
  it.each([
    ['consultorio'],
    ['hospitais'],
  ])('editor operacional de %s tem ATESTADO entre os destinos de "Mover para"', (type) => {
    renderModal({ type, canManageAbsences: true, canEditOperational: true })

    const moverPara = screen.getAllByLabelText('Mover para')[0]
    expect(within(moverPara).getByRole('option', { name: 'ATESTADO' })).toBeInTheDocument()

    fireEvent.change(moverPara, { target: { value: 'atestado' } })
    expect(moverPara).toHaveValue('atestado')
  })

  it('editor operacional sem acesso privado preserva a secao indisponivel', async () => {
    const onSave = vi.fn().mockResolvedValue({ success: true })
    const staff = makeStaff({
      consultorio: {
        volanFinanceiro: [],
        administrativo: [],
        recepcao: [ana],
        telefoneWhatsapp: [],
        financeiro: [],
        enfermagemQmentum: [],
        ferias: [],
        indisponivel: [
          { nome: 'ATESTADO', status: 'indisponivel' },
          { nome: 'ATESTADO', status: 'indisponivel' },
        ],
      },
      consultorioCardData: '2026-09-11',
      consultorioCardTurno: 'manha',
    })

    renderModal({
      staff,
      onSave,
      canManageAbsences: false,
      canEditOperational: true,
      cardData: staff.consultorioCardData,
      cardTurno: staff.consultorioCardTurno,
    })

    expect(screen.queryByRole('button', { name: /ATESTADO/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /INDISPONÍVEL/ })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Observação operacional'), {
      target: { value: 'Atualizacao operacional segura' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const savedStaff = onSave.mock.calls[0][0]
    expect(savedStaff.consultorio.indisponivel).toEqual([
      { nome: 'ATESTADO', status: 'indisponivel' },
      { nome: 'ATESTADO', status: 'indisponivel' },
    ])
    expect(savedStaff.consultorio.recepcao[0]).toMatchObject({
      nome: 'Ana',
      observacao: 'Atualizacao operacional segura',
    })
  })
})
