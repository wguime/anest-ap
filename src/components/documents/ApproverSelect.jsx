import React, { useMemo } from 'react'
import { UserCheck, Users } from 'lucide-react'

const APPROVER_OPTIONS = [
  {
    userId: 'approver-coord-qualidade',
    userName: 'Coordenador de Qualidade',
    role: 'Coordenador de Qualidade',
  },
  {
    userId: 'approver-dir-clinico',
    userName: 'Diretor Clinico',
    role: 'Diretor Clinico',
  },
  {
    userId: 'approver-coord-enfermagem',
    userName: 'Coordenador de Enfermagem',
    role: 'Coordenador de Enfermagem',
  },
  {
    userId: 'approver-comite-etica',
    userName: 'Comite de Etica',
    role: 'Comite de Etica',
  },
  {
    userId: 'approver-coord-anestesia',
    userName: 'Coordenador de Anestesia',
    role: 'Coordenador de Anestesia',
  },
]

export default function ApproverSelect({ selectedApprovers = [], onChange, disabled = false }) {
  const selectedIds = useMemo(
    () => new Set(selectedApprovers.map((a) => a.userId)),
    [selectedApprovers]
  )

  const selectedCount = selectedApprovers.length

  function handleToggle(option) {
    if (disabled) return

    let updated
    if (selectedIds.has(option.userId)) {
      updated = selectedApprovers.filter((a) => a.userId !== option.userId)
    } else {
      updated = [...selectedApprovers, { ...option }]
    }
    onChange(updated)
  }

  return (
    <div className="rounded-lg border border-green-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green-100 px-4 py-3">
        <div className="flex items-center gap-2 text-green-800">
          <Users className="h-5 w-5" />
          <span className="text-sm font-semibold">Aprovadores</span>
        </div>
        {selectedCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Options list */}
      <ul className="divide-y divide-green-50">
        {APPROVER_OPTIONS.map((option) => {
          const isSelected = selectedIds.has(option.userId)
          return (
            <li key={option.userId}>
              <label
                className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors ${
                  disabled
                    ? 'cursor-not-allowed opacity-50'
                    : isSelected
                      ? 'bg-green-50 hover:bg-green-100'
                      : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(option)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-green-300 text-green-600 focus:ring-green-500"
                />
                <UserCheck
                  className={`h-4 w-4 flex-shrink-0 ${
                    isSelected ? 'text-green-600' : 'text-gray-400'
                  }`}
                />
                <span
                  className={`text-sm ${
                    isSelected ? 'font-medium text-green-900' : 'text-gray-700'
                  }`}
                >
                  {option.role}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
