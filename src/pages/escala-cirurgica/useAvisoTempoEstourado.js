/**
 * useAvisoTempoEstourado — push de "atualize o tempo" quando o cronômetro estoura
 * (dono 2026-08-24: "após terminar o tempo estabelecido, quero que o usuário
 * receba uma mensagem para atualizar o tempo, caso o procedimento não tenha
 * terminado").
 *
 * O aviso tem duas metades e esta é a SEGUNDA. A primeira — pílula âmbar +
 * "Atualize o tempo se a cirurgia não terminou" no card — é 100% tela, não
 * depende de rede nem de opt-in, e é a que sempre funciona. Este hook cuida do
 * push, que é o que alcança quem está em sala com o celular no bolso.
 *
 * ⚠️ QUEM DISPARA É O CLIENTE, e isso tem um limite honesto: o push sai do
 * aparelho de quem estiver com a aba Liberações aberta. Se ninguém estiver com a
 * tela aberta naquele minuto, ninguém recebe — só o estado âmbar aparece, depois,
 * para quem abrir. Um cron no servidor resolveria isso, mas precisaria refazer em
 * SQL a resolução de identidade da fila (uid do vínculo ou nome normalizado, as
 * quatro camadas de matching do módulo), que é justamente onde este módulo já
 * errou várias vezes. Aqui a identidade já vem resolvida pela lib.
 *
 * A trava contra push repetida é do BANCO, não daqui: num turno normal há várias
 * telas abertas e todas veriam o mesmo estouro no mesmo minuto.
 * `reservarAvisoTempo` insere com ON CONFLICT DO NOTHING e só devolve `true` para
 * quem inseriu — esse é o único que manda. O `jaTentei` local é só para não bater
 * no banco a cada minuto com o mesmo alvo.
 */
import { useEffect, useRef } from 'react'
import svc from '@/services/supabaseEscalaCirurgicaService'
import { enviarPush } from '@/services/pushDispatchService'

export default function useAvisoTempoEstourado({ escalaId, turno, alvos }) {
  const jaTentei = useRef(new Set())
  // A lista chega recriada a cada render (deriva do relógio); a dependência do
  // efeito é a ASSINATURA dela, senão o efeito rodaria a cada minuto de novo.
  const assinatura = (alvos || []).map((a) => `${a.chave}@${a.alvo}`).sort().join('|')

  useEffect(() => {
    if (!escalaId || String(escalaId).startsWith('demo-') || !turno) return
    const pendentes = (alvos || []).filter((a) => a.uid && a.alvo && a.chave)
    if (!pendentes.length) return
    let cancelado = false
    ;(async () => {
      for (const a of pendentes) {
        const id = `${escalaId}|${turno}|${a.chave}|${a.alvo}`
        if (jaTentei.current.has(id)) continue
        jaTentei.current.add(id)
        // try/catch por ITEM: este caminho é aviso, não operação clínica, e uma
        // rejeição solta aqui vira unhandled rejection dentro da aba Liberações.
        // Um alvo que falha não pode levar os outros junto.
        let meu = false
        try {
          meu = await svc.reservarAvisoTempo(escalaId, turno, a.chave, a.alvo)
        } catch (err) {
          console.warn('[escala] reserva do aviso de tempo falhou:', err?.message || err)
        }
        if (!meu || cancelado) continue
        // ⚠️ LGPD: nada de paciente aqui — só o horário que estourou. O corpo
        // aparece na tela bloqueada de quem recebe.
        await enviarPush({
          userIds: [a.uid],
          title: 'Passou do tempo previsto',
          body: `O tempo que você informou (${a.alvo}) já passou. Se a cirurgia não terminou, atualize.`,
          url: '/escala-cirurgica',
          // uma tag só: se estourar de novo mais tarde, o aviso novo SUBSTITUI o
          // antigo na bandeja em vez de empilhar dois "passou do tempo"
          tag: 'escala-tempo',
          priority: 'high',
        }).catch(() => { /* best-effort: a tela âmbar é a metade confiável */ })
      }
    })()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escalaId, turno, assinatura])
}

/**
 * Casca de componente para o hook.
 *
 * A view tem um `return` cedo enquanto o dicionário de vínculos carrega (sem ele
 * a fila classifica errado), e a lista de estourados só existe DEPOIS desse
 * ponto — chamar o hook lá embaixo violaria a ordem dos hooks. Um componente que
 * não renderiza nada resolve sem mover o guard nem recalcular a fila duas vezes:
 * dentro dele o hook é chamado sempre, que é o que a regra exige.
 */
export function AvisoTempoEstourado(props) {
  useAvisoTempoEstourado(props)
  return null
}
