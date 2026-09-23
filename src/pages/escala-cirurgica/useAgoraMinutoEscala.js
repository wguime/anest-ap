/**
 * useAgoraMinutoEscala — o relógio das telas da escala, em minutos do DIA
 * OPERACIONAL (dono 23/09: o dia vira às 7h).
 *
 * De madrugada, vendo o plantão em andamento (a data da tela é o dia operacional
 * de hoje, que começou ontem às 7h), 01:00 vale 25:00 (1500). Assim toda regra
 * escrita em "minutos do dia" continua certa sem ser reescrita: ≥ 19h é noite,
 * ≥ 23h é a lista zerada, a faixa 19–07 do FDS, a espera da urgência que chegou
 * às 22h. Fora desse caso é o mesmo `useAgoraMinuto` de sempre.
 *
 * ⚠️ Só para telas DENTRO do provider da escala. O card da Home tem a própria
 * regra de madrugada e segue com `useAgoraMinuto`.
 */
import useAgoraMinuto from './useAgoraMinuto'
import { useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'

// 07:00 — o mesmo corte de `diaOperacionalISO` (context) e de `chavePlantaoDoDia`
const CORTE_DIA_OPERACIONAL_MIN = 7 * 60

export function minutoOperacional(agoraMin, { data, hoje } = {}) {
  return agoraMin < CORTE_DIA_OPERACIONAL_MIN && data && data === hoje ? agoraMin + 1440 : agoraMin
}

export default function useAgoraMinutoEscala() {
  const agoraMin = useAgoraMinuto()
  const { data, hoje } = useEscalaCirurgica()
  return minutoOperacional(agoraMin, { data, hoje })
}
