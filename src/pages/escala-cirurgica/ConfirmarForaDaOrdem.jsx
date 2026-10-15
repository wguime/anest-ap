/**
 * ConfirmarForaDaOrdem — o diálogo do modelo A (dono 15/10/2026,
 * `.tmp/confirmar-anestesista-fora-da-ordem.html`): a cirurgia vai para quem não é o
 * próximo a ser chamado, e quem lança vê o PORQUÊ antes de confirmar.
 *
 * É o `ConfirmDialog` do DS (o mesmo de excluir caso e mover de turno), com os
 * motivos em `children` e o atalho "Usar <próximo>" — trocar para quem a fila manda
 * sem voltar ao formulário. Não bloqueia nada: "Confirmar" segue com o escolhido.
 * Regras em `foraDaOrdem.js`.
 */
import { ArrowRight, Building2, Clock, LogOut, TriangleAlert, Users } from 'lucide-react'
import { ConfirmDialog } from '@/design-system'
import { titleCaseNome } from '@/lib/colunaLiberacao'
import { nomeAnestesistaExibicao } from './utils'

const PLANTAO_LABEL = { matutino: 'plantão da tarde', vespertino: 'plantão da manhã' }
const primeiroNome = (s) => titleCaseNome(String(s || '').trim().split(/\s+/)[0] || '')

function Motivo({ icon: Icon, titulo, sub }) {
  return (
    <div className="flex items-start gap-2.5 border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{titulo}</p>
        {sub && <p className="mt-px text-[13px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {object} props.avaliacao  retorno de `avaliarEscolhaAnestesista`
 * @param {string} props.nome  nome de exibição de quem foi escolhido
 * @param {string} props.hospitalLabel  hospital da cirurgia ("HRO")
 * @param {string} props.turno
 * @param {Map} [props.rosterByUid]
 * @param {() => void} props.onConfirmar  segue com o escolhido
 * @param {(proximo: {uid: string, nome: string}) => void} [props.onUsarProximo]
 * @param {() => void} props.onTrocar  volta à escolha do anestesista
 * @param {boolean} [props.salvando]
 */
export default function ConfirmarForaDaOrdem({ avaliacao, nome, hospitalLabel, turno, rosterByUid, onConfirmar, onUsarProximo, onTrocar, salvando = false }) {
  if (!avaliacao) return null
  const { motivos, proximo, resumo } = avaliacao
  const curto = primeiroNome(nome)
  const nomeProximo = proximo ? nomeAnestesistaExibicao({ uid: proximo.uid, alias: proximo.nome, rosterByUid }) : ''
  const linhas = motivos.map((m) => {
    if (m.tipo === 'outroHospital') {
      return { icon: Building2, titulo: `Está na escala ${m.hospital === 'materno' ? 'do' : 'da'} ${m.hospitalLabel}`, sub: `${m.posicao}º lá${m.plantao ? ` · ${PLANTAO_LABEL[turno] || 'plantão'} ${m.hospital === 'materno' ? 'do' : 'da'} ${m.hospitalLabel}` : ''}` }
    }
    if (m.tipo === 'trabalhando') {
      const onde = [m.sala, m.hospitalLabel !== hospitalLabel ? m.hospitalLabel : null].filter(Boolean).join(' · ')
      const estado = m.status === 'iniciada' ? 'em andamento' : `agendada${m.hora ? ` ${m.hora}` : ''}`
      return { icon: Clock, titulo: 'Está trabalhando', sub: [onde, estado].filter(Boolean).join(' · ') }
    }
    return { icon: LogOut, titulo: 'Já foi liberado', sub: m.hora ? `às ${m.hora}` : null }
  })
  if (proximo) {
    linhas.push({
      icon: Users,
      titulo: `O próximo a ser chamado é ${nomeProximo}`,
      sub: `${proximo.posicao}º no ${hospitalLabel} · ${proximo.livreDesde ? `sem cirurgia desde ${proximo.livreDesde}` : 'sem cirurgia aberta'}`,
    })
  } else {
    linhas.push({ icon: Users, titulo: `Ninguém livre no ${hospitalLabel} agora`, sub: `${resumo.emCirurgia} em cirurgia · ${resumo.liberados} liberados` })
  }

  return (
    <ConfirmDialog
      open
      onClose={onTrocar}
      onConfirm={onConfirmar}
      loading={salvando}
      icon={<TriangleAlert className="h-11 w-11 text-warning" />}
      title={`Confirmar ${curto} fora da ordem?`}
      description={proximo
        ? `Há alguém livre na fila do ${hospitalLabel} para esta cirurgia.`
        : `A cirurgia vai para quem não está na fila do ${hospitalLabel} neste turno.`}
      confirmText={`Confirmar ${curto}`}
      cancelText="Trocar anestesista"
    >
      <div data-fora-da-ordem>
        {linhas.map((l) => <Motivo key={l.titulo} {...l} />)}
        {proximo?.uid && onUsarProximo && (
          <button
            type="button"
            disabled={salvando}
            onClick={() => onUsarProximo({ uid: proximo.uid, nome: proximo.nome })}
            className="mt-3.5 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-primary/70 text-[14.5px] font-semibold text-primary disabled:opacity-50"
          >
            Usar {nomeProximo} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </ConfirmDialog>
  )
}
