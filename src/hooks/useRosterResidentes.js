/**
 * useRosterResidentes — residentes ativos, para o campo Residente DENTRO do caso.
 *
 * Separado do roster de anestesista por decisão do dono (29/07): o residente
 * acompanha o caso, quem responde por ele é o anestesiologista — misturar os dois
 * numa lista só poluía o seletor e permitia escalar um residente como responsável.
 *
 * Os residentes estão cadastrados SÓ COM O PRIMEIRO NOME e isso está correto: não
 * há nome repetido entre eles, então o primeiro nome identifica. Não "completar"
 * esses cadastros — o rótulo aqui é o nome como está no cadastro.
 *
 * Sem dicionário de apelidos (o de escala é dos anestesistas): a identidade do
 * residente vem sempre do uid escolhido no seletor, nunca de texto importado.
 */
import { useMemo } from 'react'
import { useUsersManagement } from '@/contexts/UsersManagementContext'
import { normalizeRole } from '@/utils/userTypes'
import { titleCaseNome } from '@/lib/colunaLiberacao'

export default function useRosterResidentes() {
  const { users } = useUsersManagement()

  const residentes = useMemo(() => {
    const out = []
    for (const u of users || []) {
      if (u?.active === false || !u?.nome) continue
      if (normalizeRole(u.role) !== 'medico-residente') continue
      // conta secundária (uma pessoa, um nome — migration 20260729100000) fica fora
      // da lista de escolha, como no roster de anestesista
      if (u.contaDuplicadaDe) continue
      out.push({ uid: u.id, nome: u.nome })
    }
    return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [users])

  const options = useMemo(
    () => residentes.map((r) => ({ value: r.uid, label: titleCaseNome(r.nome) })),
    [residentes]
  )

  // uid → residente: um caso salvo com o uid continua exibindo o nome mesmo que o
  // cadastro saia da lista (inativado no meio do dia).
  const residenteByUid = useMemo(() => new Map(residentes.map((r) => [r.uid, r])), [residentes])

  return { residentes, options, residenteByUid }
}
