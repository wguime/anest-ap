/**
 * useEstadoUrgencias — a ÚNICA porta de entrada da UI para o estado das urgências.
 *
 * PORQUÊ (dono 21/08): `estadoUrgencias` era montada em dois lugares que
 * escreviam os `opts` à mão, e eles divergiam — a faixa passava o `hojeIso` de
 * verdade, o "Adicionar caso" passava a data da escala. Como a linha do contrato
 * é escolhida comparando `dataEscala × hojeIso`, ver a escala de outro dia fazia
 * um aplicar a NOITE e o outro a manhã, e o formulário dizia "CO · ocupado" ao
 * lado de um card de CO livre. Aqui o `hoje` vem do context e o relógio vem da
 * store — nenhuma tela tem como passar o argumento errado, porque não passa mais.
 *
 * Devolve também `herdados`: as cirurgias que a faixa está contando e que NÃO são
 * do turno exibido. É o que o quadro renderiza no fim, e sai do MESMO estado —
 * derivadas da mesma fonte, faixa e quadro não têm como discordar.
 */
import { useMemo } from 'react'
import { casosHerdados, estadoUrgenciasDaEscala } from '@/lib/escalaCirurgicaUrgencias'
import { useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import useAgoraMinuto from './useAgoraMinuto'

export default function useEstadoUrgencias(escala, { hospital, turno, fds = false } = {}) {
  const agoraMin = useAgoraMinuto()
  const { hoje } = useEscalaCirurgica()

  return useMemo(() => {
    const estado = estadoUrgenciasDaEscala(escala, {
      hospital: hospital ?? escala?.hospital,
      turno,
      agoraMin,
      hojeIso: hoje,
      fds,
    })
    return { estado, herdados: casosHerdados(estado, turno) }
  }, [escala, hospital, turno, agoraMin, hoje, fds])
}
