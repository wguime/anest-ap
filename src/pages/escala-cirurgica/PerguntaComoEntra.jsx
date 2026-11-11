/**
 * ComoEntra — a pergunta "Como {B} entra?" dentro das folhas de repasse (dono
 * 10–11/11/2026, modelo B, opção A: a mini-fila aparece DEPOIS de escolher).
 *
 * Regras e frases em `repasseForaDoRodape.js`. Aqui só o desenho: nada vem marcado; cada resposta
 * traz o efeito na fila logo abaixo do nome; escolhida, a fila do(s) hospital(is) aparece
 * embaixo. Com uma resposta só (quem passa continua com outra cirurgia aqui) não há
 * pergunta: é um aviso, e o botão da folha diz "{B} entra como ajuda".
 */
import { Info } from 'lucide-react'
import { HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { titleCaseNome } from '@/lib/colunaLiberacao'
import { rodapeDoTurno } from './utils'
import { FilaPrevia } from './TrocaSheet'

const semNota = (n) => String(n || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

/** A fila daqui quando quem recebe entra como AJUDA: a vaga de quem passou e o fim da lista. */
function FilaAjuda({ escala, turno, situacao, nomes }) {
  const rodape = rodapeDoTurno(escala?.ordemLiberacao, turno)
  const m = situacao.slotA?.posicao || 0
  const ultimo = rodape.length
  const selo = situacao.la ? `Ajuda (${HOSPITAL_LABEL[situacao.la.hospital] || situacao.la.hospital})` : 'Ajuda'
  return (
    <div data-fila-previa={escala?.hospital} className="min-w-0 rounded-xl border border-border px-2.5 py-2">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {HOSPITAL_LABEL[escala?.hospital] || escala?.hospital} · depois
      </p>
      {m > 0 && (
        <p className="flex min-h-6 items-center gap-1.5 text-[12.5px]">
          <span className="w-6 shrink-0 text-right font-semibold text-muted-foreground">{m}º</span>
          <span className="min-w-0 truncate">{nomes.A}</span>
          {situacao.semCirurgiaAqui && <span className="shrink-0 text-[11.5px] text-muted-foreground">Livre</span>}
        </p>
      )}
      {ultimo > m + 1 && <p className="pl-6 text-[12px] text-muted-foreground">…</p>}
      {ultimo > m && (
        <p className="flex min-h-6 items-center gap-1.5 text-[12.5px]">
          <span className="w-6 shrink-0 text-right font-semibold text-muted-foreground">{ultimo}º</span>
          <span className="min-w-0 truncate">{titleCaseNome(semNota(rodape[ultimo - 1]))}</span>
        </p>
      )}
      <div className="-mx-1 rounded-md bg-warning/20 px-1 py-0.5">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          <span className="w-6 shrink-0 text-right text-muted-foreground">+</span>
          <span className="min-w-0 truncate">{nomes.B} · {selo}</span>
        </p>
        <p className="pl-[30px] text-[11.5px] text-muted-foreground">sai antes do rodapé</p>
      </div>
    </div>
  )
}

/**
 * @param {object} p
 * @param {object} p.situacao  de `situacaoDeQuemRecebe`
 * @param {object} p.textos    de `textosComoEntra`
 * @param {string|null} p.escolha  'ajuda' | 'assume' | 'trocaram' | null
 * @param {(id: string) => void} p.onEscolha
 * @param {object[]} p.lados   lados da execução (`ladosDeComoEntra`) — a prévia de "assume"/"trocaram"
 */
export default function ComoEntra({ situacao, textos, escolha, onEscolha, lados = [], escalas, escala, turno, resolver, desabilitado = false }) {
  if (!situacao || !textos) return null
  const soAviso = !!textos.aviso
  const efetiva = soAviso ? 'ajuda' : escolha
  const porHospital = new Map()
  for (const l of lados) {
    if (!porHospital.has(l.hospital)) porHospital.set(l.hospital, [])
    porHospital.get(l.hospital).push(l)
  }
  return (
    <div data-como-entra className="space-y-2 border-t border-border py-3">
      {soAviso ? (
        <p role="note" className="flex gap-2 rounded-xl bg-muted px-3 py-2.5 text-[13px] leading-snug text-foreground">
          <Info className="mt-px h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{textos.aviso}</span>
        </p>
      ) : (
        <>
          <p className="text-[14px] font-bold leading-snug">{textos.titulo}</p>
          <div role="radiogroup" aria-label={textos.titulo} className="space-y-2">
            {textos.opcoes.map((o) => {
              const marcada = escolha === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={marcada}
                  data-como-entra-opcao={o.id}
                  disabled={desabilitado}
                  onClick={() => onEscolha?.(o.id)}
                  className={[
                    'flex min-h-[52px] w-full items-start gap-2.5 rounded-2xl border-[1.5px] px-3 py-2.5 text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    marcada ? 'border-primary bg-primary/5' : 'border-border active:bg-muted/50',
                  ].join(' ')}
                >
                  <span aria-hidden="true" className={[
                    'mt-0.5 h-[22px] w-[22px] shrink-0 rounded-full',
                    marcada ? 'border-[7px] border-primary' : 'border-2 border-muted-foreground/50',
                  ].join(' ')} />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-bold leading-snug">{o.rotulo}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{o.efeito}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
      {efetiva && (
        <div data-como-entra-fila={efetiva}>
          <p className="mb-1 mt-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Como a fila fica</p>
          {efetiva === 'ajuda' ? (
            <FilaAjuda escala={escala} turno={turno} situacao={situacao} nomes={textos.nomes} />
          ) : (
            <div className={['grid gap-2.5', porHospital.size > 1 ? 'grid-cols-2' : 'grid-cols-1'].join(' ')}>
              {[...porHospital.entries()].map(([h, ls]) => (
                <FilaPrevia key={h} hospital={h} esc={escalas?.[h]} lados={ls} resolver={resolver} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
