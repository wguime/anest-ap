/**
 * FAIXA DO HORÁRIO PENDENTE (dono 05/10, modelo A em `.tmp/alerta-horario-pendente.html`):
 * alerta PÚBLICO, logo abaixo dos seletores, nas três abas e em qualquer hospital/turno.
 * "Horário pendente · N cirurgias" e, embaixo, os NOMES com quantas cirurgias cada um deve
 * — cabem os que couberem numa linha, o resto vira "+N". Toque abre a lista por
 * anestesista; cada linha abre a cirurgia já no cartão "Horário da cirurgia".
 *
 * Liberado com a cirurgia ABERTA (dono 05/10, mesma conversa: "ou se ele foi substituído
 * por algum colega"): a linha oferece os dois caminhos — preencher o horário, ou passar a
 * cirurgia para o colega que assumiu (o `DefinirAnestesistaSheet` de sempre, modo caso).
 *
 * Regras em `src/lib/escalaHorarioPendente.js`; dados em `useHorarioPendente`. Sem
 * pendência a faixa não ocupa espaço — mas as folhas ficam montadas: preencher a última
 * cirurgia com o detalhe aberto não pode fechar o detalhe debaixo do dedo.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight, ClockAlert } from 'lucide-react'
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/design-system'
import { HOSPITAL_LABEL, useEscalaCirurgica } from '@/contexts/EscalaCirurgicaContext'
import { fraseClinica } from '@/lib/colunaLiberacao'
import { quantasPilulasCabem } from '@/lib/escalaHorarioPendente'
import CasoDetalheSheet from './CasoDetalheSheet'
import DefinirAnestesistaSheet from './DefinirAnestesistaSheet'
import SeloHorarioPendente from './SeloHorarioPendente'
import { salaExibicao } from './utils'

const ROTULO_TURNO = { matutino: 'Manhã', vespertino: 'Tarde' }
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

function Pilula({ nome, n }) {
  return (
    <span className="inline-flex h-[26px] shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full border border-destructive/45 bg-card px-[9px] text-[12.5px] font-semibold text-foreground dark:border-destructive/60">
      {nome} <b className="font-extrabold tabular-nums text-category-red-fg">{n}</b>
    </span>
  )
}

/**
 * Os nomes numa linha só. Mede as pílulas numa fileira invisível e mostra as que cabem,
 * reservando o "+N". Sem layout (teste, primeira pintura) mostra todas.
 */
function NomesNaFaixa({ grupos }) {
  const trilhoRef = useRef(null)
  const medidaRef = useRef(null)
  const [cabem, setCabem] = useState(grupos.length)
  useLayoutEffect(() => {
    const trilho = trilhoRef.current
    const medida = medidaRef.current
    if (!trilho || !medida) return undefined
    const medir = () => {
      const disponivel = trilho.clientWidth
      if (!disponivel) { setCabem(grupos.length); return }
      const filhos = [...medida.children]
      const larguras = filhos.slice(0, -1).map((el) => el.offsetWidth)
      const mais = filhos[filhos.length - 1]?.offsetWidth || 40
      setCabem(quantasPilulasCabem(larguras, disponivel, { gap: 6, mais }))
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(medir)
    ro.observe(trilho)
    return () => ro.disconnect()
  }, [grupos])
  const resto = grupos.length - cabem
  return (
    <span className="relative mt-[7px] block">
      <span ref={trilhoRef} className="flex gap-1.5 overflow-hidden">
        {grupos.slice(0, cabem).map((g) => <Pilula key={g.chave} nome={g.nome} n={g.itens.length} />)}
        {resto > 0 && (
          <span className="inline-flex h-[26px] shrink-0 items-center rounded-full border border-dashed border-destructive/45 bg-card px-[9px] text-[12.5px] font-semibold text-muted-foreground dark:border-destructive/60">
            +{resto}
          </span>
        )}
      </span>
      {/* fileira de MEDIDA: as mesmas pílulas, fora do fluxo e invisíveis */}
      <span ref={medidaRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex gap-1.5 whitespace-nowrap">
        {grupos.map((g) => <Pilula key={g.chave} nome={g.nome} n={g.itens.length} />)}
        <span className="inline-flex h-[26px] items-center rounded-full border px-[9px] text-[12.5px] font-semibold">+{grupos.length}</span>
      </span>
    </span>
  )
}

function LinhaPendente({ item, podeEditar, onAbrir, onColegaAssumiu }) {
  const { caso } = item
  const onde = [ROTULO_TURNO[item.turno], HOSPITAL_LABEL[item.hospital], salaExibicao(caso.sala)].filter(Boolean).join(' · ')
  const procedimento = fraseClinica(caso.procedimento)
  return (
    <div className="border-t border-border/70">
      <button
        type="button"
        onClick={() => onAbrir(item)}
        aria-label={`Abrir a cirurgia ${caso.hora || ''} ${procedimento}, ${onde}`}
        className="flex min-h-[56px] w-full items-center gap-2 py-1.5 text-left active:bg-muted/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] text-muted-foreground">{onde}</span>
          <span className="mt-0.5 flex gap-1.5 text-sm">
            {caso.hora && <b className="shrink-0 font-bold tabular-nums">{caso.hora}</b>}
            <span className="truncate">{procedimento}</span>
          </span>
        </span>
        <SeloHorarioPendente falta={item.falta} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {item.aberta && (
        <div className="pb-3">
          <p className="text-[12px] font-semibold text-category-red-fg">Liberado com a cirurgia aberta</p>
          <p className="text-[12px] leading-snug text-muted-foreground">
            Preencha o horário ou, se um colega assumiu, passe a cirurgia para ele.
          </p>
          {podeEditar && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" onClick={() => onAbrir(item)}>Preencher horário</Button>
              <Button size="sm" variant="outline" onClick={() => onColegaAssumiu(item)}>Colega assumiu</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FaixaHorarioPendente({ pendencias, podeEditar = false }) {
  const { escalas } = useEscalaCirurgica()
  const [lista, setLista] = useState(false)
  const [detalhe, setDetalhe] = useState(null) // { hospital, caso, turno }
  const [definir, setDefinir] = useState(null) // { hospital, sala, casosAlvo, turno }
  const { itens = [], grupos = [] } = pendencias || {}

  const abrirDetalhe = (item) => {
    setLista(false)
    setDetalhe({ hospital: item.hospital, caso: item.caso, turno: item.turno })
  }
  const colegaAssumiu = (item) => {
    setLista(false)
    setDefinir({ hospital: item.hospital, sala: item.caso.sala, casosAlvo: [item.caso], turno: item.turno })
  }

  return (
    <>
      {itens.length > 0 && (
        <button
          type="button"
          onClick={() => setLista(true)}
          aria-label={`Horário pendente: ${plural(itens.length, 'cirurgia', 'cirurgias')} de ${plural(grupos.length, 'anestesista', 'anestesistas')}. Ver a lista`}
          className="block w-full rounded-xl border border-destructive/45 bg-destructive/[0.07] px-3 pb-2.5 pt-2 text-left transition-opacity active:opacity-80 dark:border-destructive/60 dark:bg-destructive/[0.16]"
        >
          <span className="flex min-h-[22px] items-center gap-[7px]">
            <ClockAlert className="h-[18px] w-[18px] shrink-0 text-category-red-fg" aria-hidden="true" />
            <span className="text-sm font-bold text-category-red-fg">Horário pendente</span>
            <span className="ml-auto flex items-center gap-0.5 whitespace-nowrap text-[12.5px] font-semibold text-foreground/75">
              {plural(itens.length, 'cirurgia', 'cirurgias')}
              <ChevronRight className="h-[15px] w-[15px] text-muted-foreground" aria-hidden="true" />
            </span>
          </span>
          <NomesNaFaixa grupos={grupos} />
        </button>
      )}

      {lista && (
        <Sheet open onOpenChange={(o) => !o && setLista(false)}>
          <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
            <SheetHeader className="pb-1">
              <SheetTitle className="flex items-center gap-2 text-[17px] font-bold">
                <ClockAlert className="h-[19px] w-[19px] shrink-0 text-category-red-fg" aria-hidden="true" />
                Horário pendente
              </SheetTitle>
              <SheetDescription className="mt-1 text-[12.5px] leading-snug">
                {plural(itens.length, 'cirurgia', 'cirurgias')} · {plural(grupos.length, 'anestesista', 'anestesistas')}.
                {' '}Cada uma sai da lista quando início e término forem preenchidos, por quem fez ou por qualquer colega.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              {!itens.length && (
                <p className="py-6 text-center text-[13px] text-muted-foreground">Nenhum horário pendente.</p>
              )}
              {grupos.map((g) => (
                <section key={g.chave} aria-label={`${g.nome}: ${plural(g.itens.length, 'cirurgia', 'cirurgias')} sem horário`}>
                  <h3 className="flex items-center gap-2 pb-1.5 pt-3 text-[15px] font-bold">
                    {g.nome}
                    <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-destructive px-1.5 text-[12px] font-extrabold tabular-nums text-white">
                      {g.itens.length}
                    </span>
                  </h3>
                  {g.itens.map((item) => (
                    <LinhaPendente
                      key={`${g.chave}-${item.caso.id || `${item.hospital}-${item.caso.sala}-${item.caso.ordem}`}`}
                      item={item}
                      podeEditar={podeEditar}
                      onAbrir={abrirDetalhe}
                      onColegaAssumiu={colegaAssumiu}
                    />
                  ))}
                </section>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {detalhe && escalas?.[detalhe.hospital] && (
        <CasoDetalheSheet
          escala={escalas[detalhe.hospital]}
          caso={detalhe.caso}
          turno={detalhe.turno}
          onClose={() => setDetalhe(null)}
          podeDefinirAnestesista={() => podeEditar}
          onDefinirAnestesista={(sala, casoAlvo) => setDefinir({
            hospital: detalhe.hospital, sala, casosAlvo: casoAlvo ? [casoAlvo] : null, turno: detalhe.turno,
          })}
          podeEditar={podeEditar}
        />
      )}

      {definir && escalas?.[definir.hospital] && (
        <DefinirAnestesistaSheet
          escala={escalas[definir.hospital]}
          sala={definir.sala}
          casosAlvo={definir.casosAlvo}
          turno={definir.turno}
          onClose={() => setDefinir(null)}
        />
      )}
    </>
  )
}
