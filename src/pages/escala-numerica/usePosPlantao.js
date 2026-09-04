/**
 * Plantão noturno da VÉSPERA, para a regra do pós-plantão (dono 03/09).
 *
 * A fonte muda com o dia da semana e isso não é detalhe: de terça a sexta o P1/P2 da noite
 * está no Pega Plantão, lançado na data da véspera às 19h. Na SEGUNDA a véspera é domingo, e
 * domingo à noite NÃO existe no Pega Plantão (conferido em 23/08 e 30/08: só o P11 de 24h) —
 * vem da faixa `19-07` da grade do documento de fim de semana publicado no app.
 *
 * Sem o dado, a regra simplesmente não se aplica: a tela mostra a numérica pura em vez de
 * inventar quem plantonou.
 */
import { useState, useEffect } from 'react'
import { getPlantoesPorData } from '@/services/pegaPlantaoApi'
import svcEscala from '@/services/supabaseEscalaCirurgicaService'
import { vesperaDe, fonteDoNoturno, noturnosDoPegaPlantao, noturnosDoDocumentoFds } from '@/lib/posPlantao'

const VAZIO = { hro: null, unimed: null }

export function usePosPlantao(dataISO) {
  const fonte = dataISO ? fonteDoNoturno(dataISO) : null
  const vespera = fonte ? vesperaDe(dataISO) : null
  const [resposta, setResposta] = useState(null)

  useEffect(() => {
    if (!fonte || !vespera) return undefined
    let vivo = true
    const guardar = (noturnos) => { if (vivo) setResposta({ vespera, noturnos, erro: null }) }
    const falhar = (e) => { if (vivo) setResposta({ vespera, noturnos: VAZIO, erro: e?.message || 'indisponível' }) }

    if (fonte === 'pega-plantao') {
      getPlantoesPorData(vespera).then((r) => guardar(noturnosDoPegaPlantao(r.plantoes))).catch(falhar)
    } else {
      svcEscala.fetchEscala(vespera, 'fds')
        .then((row) => guardar(noturnosDoDocumentoFds(row?.fdsMeta?.grade)))
        .catch(falhar)
    }
    return () => { vivo = false }
  }, [fonte, vespera])

  const pronto = Boolean(vespera) && resposta?.vespera === vespera
  return {
    fonte,
    vespera,
    noturnos: pronto ? resposta.noturnos : VAZIO,
    erro: pronto ? resposta.erro : null,
    loading: Boolean(vespera) && !pronto,
  }
}
