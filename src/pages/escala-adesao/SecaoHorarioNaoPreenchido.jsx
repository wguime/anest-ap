/**
 * "Horário não preenchido no dia" — o relatório do alerta público da escala (dono 05/10).
 *
 * "esse alerta deve durar o dia todo, se não for preenchido durante o dia, quero que crie um
 * relatório e incorpore ao relatório de adesão à escala cirúrgica na página home". Modelo A
 * escolhido em protótipo (`.tmp/relatorio-horario-nao-preenchido.html`): seção própria logo
 * depois dos indicadores — os três números (último dia encerrado · 7 dias · período da aba) e
 * quem deixou de preencher, de quem deixou mais para quem deixou menos; toque no nome abre as
 * cirurgias por dia. Só leitura: depois da virada das 7h o horário não se preenche mais.
 *
 * Dados: RPC `escala_horario_pendente_relatorio` (mesmos cortes de `escalaHorarioPendente.js`).
 * Quem não opera a escala recebe 42501 e a seção não aparece. Nomes pelo MESMO dicionário do
 * alerta (`useRosterAnestesistas`).
 */
import { useMemo, useState } from 'react'
import { ChevronRight, ClockAlert } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/design-system'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { useHorarioNaoPreenchido } from '@/hooks/useAdesaoEscala'
import { fraseClinica } from '@/lib/colunaLiberacao'
import { montarRelatorioHorario, rotuloDiaRelatorio } from '@/lib/escalaHorarioPendente'
import { nomeAnestesistaExibicao, normNome, salaExibicao } from '@/pages/escala-cirurgica/utils'
import SeloHorarioPendente from '@/pages/escala-cirurgica/SeloHorarioPendente'

const HOSPITAL = { unimed: 'Unimed', hro: 'HRO', materno: 'Materno' }
const TURNO = { matutino: 'Manhã', vespertino: 'Tarde' }
const VISIVEIS = 5
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`
const hojeIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function Numero({ valor, rotulo }) {
  return (
    <span className="rounded-lg bg-category-red-bg py-1 text-center text-[16px] font-extrabold leading-tight tabular-nums text-category-red-fg">
      {valor}
      <small className="block text-[10px] font-semibold opacity-85">{rotulo}</small>
    </span>
  )
}

function LinhaCirurgia({ item }) {
  const { caso } = item
  const onde = [TURNO[item.turno], HOSPITAL[item.hospital], salaExibicao(caso.sala)].filter(Boolean).join(' · ')
  return (
    <div className="flex min-h-[52px] items-center gap-2 border-t border-border py-1">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] text-muted-foreground">{onde}</span>
        <span className="flex gap-1.5 text-sm">
          {caso.hora && <b className="shrink-0 font-bold tabular-nums">{caso.hora}</b>}
          <span className="truncate">{fraseClinica(caso.procedimento)}</span>
        </span>
      </span>
      <SeloHorarioPendente falta={item.falta} />
    </div>
  )
}

function FichaPessoa({ pessoa, rotuloPeriodo, hoje, onClose }) {
  const dias = []
  for (const item of pessoa.itens) {
    const ultimo = dias[dias.length - 1]
    if (ultimo?.data === item.data) ultimo.itens.push(item)
    else dias.push({ data: item.data, itens: [item] })
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
        <SheetHeader className="pb-1">
          <SheetTitle className="text-[17px] font-extrabold">{pessoa.nome}</SheetTitle>
          <SheetDescription className="mt-1 text-[12.5px] leading-snug">
            {plural(pessoa.itens.length, 'cirurgia', 'cirurgias')} sem horário no fim do dia · {rotuloPeriodo}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {dias.map((d) => (
            <section key={d.data} aria-label={rotuloDiaRelatorio(d.data, hoje)}>
              <h3 className="pb-1 pt-3 text-[11.5px] font-extrabold uppercase tracking-wide text-muted-foreground">
                {rotuloDiaRelatorio(d.data, hoje)}
              </h3>
              {d.itens.map((item) => <LinhaCirurgia key={item.caso.id} item={item} />)}
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function SecaoHorarioNaoPreenchido({ aba, rotuloPeriodo }) {
  const { dados } = useHorarioNaoPreenchido(aba)
  const { resolver, rosterByUid } = useRosterAnestesistas()
  const [todos, setTodos] = useState(false)
  const [aberta, setAberta] = useState(null)
  const hoje = hojeIso()

  const rel = useMemo(() => {
    if (!dados) return null
    const uidDe = (p) => p.uid || resolver(p.alias) || null
    return montarRelatorioHorario(dados, {
      chaveDe: (p) => uidDe(p) || normNome(p.alias),
      nomeDe: (p) => nomeAnestesistaExibicao({ uid: uidDe(p), alias: p.alias, rosterByUid }),
    })
  }, [dados, resolver, rosterByUid])

  // sem acesso (42501), falha ou sem dado ainda: a seção não ocupa espaço
  if (!rel) return null

  const max = rel.pessoas[0]?.itens.length || 1
  const lista = todos ? rel.pessoas : rel.pessoas.slice(0, VISIVEIS)
  const rotuloUltimo = rel.ate ? rotuloDiaRelatorio(rel.ate, hoje) : 'último dia'

  return (
    <section
      className="rounded-xl border border-destructive/45 bg-card dark:border-destructive/60"
      aria-label="Horário não preenchido no dia"
    >
      <h2 className="flex items-center gap-1.5 rounded-t-xl bg-destructive/[0.08] px-3 py-1.5 text-[12px] font-extrabold uppercase tracking-wide text-category-red-fg dark:bg-destructive/[0.16]">
        <ClockAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        Horário não preenchido no dia
      </h2>
      <p className="px-3 pb-1.5 pt-2 text-[12px] leading-snug text-muted-foreground">
        Cirurgias que terminaram o dia sem início ou sem término. Conta desde a tarde de 05/10.
      </p>
      {rel.vazio ? (
        <p className="px-3 pb-3 text-[12.5px] text-muted-foreground">
          O primeiro dia entra quando ele acabar: o alerta da escala vale até as 7h do dia seguinte.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5 px-3 pb-2.5">
            <Numero valor={rel.ultimoDia} rotulo={rotuloUltimo} />
            <Numero valor={rel.seteDias} rotulo="7 dias" />
            <Numero valor={rel.total} rotulo={rotuloPeriodo} />
          </div>
          {rel.pessoas.length === 0 ? (
            <p className="border-t border-border px-3 py-3 text-[12.5px] text-muted-foreground">
              Nenhuma cirurgia ficou sem horário no período.
            </p>
          ) : (
            <>
              {lista.map((p) => (
                <button
                  key={p.chave}
                  type="button"
                  onClick={() => setAberta(p)}
                  aria-label={`${p.nome}: ${plural(p.itens.length, 'cirurgia', 'cirurgias')} sem horário, a última ${rotuloDiaRelatorio(p.ultima, hoje)}`}
                  className="grid min-h-[46px] w-full grid-cols-[minmax(0,1fr)_64px_26px_64px_14px] items-center gap-2 border-t border-border pl-3 pr-2.5 text-left active:bg-muted"
                >
                  <b className="truncate text-[13.5px] font-semibold">{p.nome}</b>
                  <span className="h-[7px] overflow-hidden rounded bg-muted">
                    <span className="block h-full rounded bg-destructive" style={{ width: `${(p.itens.length / max) * 100}%` }} />
                  </span>
                  <span className="text-right text-[15px] font-extrabold tabular-nums text-category-red-fg">{p.itens.length}</span>
                  <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">{rotuloDiaRelatorio(p.ultima, hoje)}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </button>
              ))}
              {rel.pessoas.length > VISIVEIS && (
                <button
                  type="button"
                  onClick={() => setTodos((v) => !v)}
                  className="flex min-h-[44px] w-full items-center justify-center border-t border-border text-[13px] font-semibold text-primary"
                >
                  {todos ? 'Mostrar menos' : `Ver todos (${rel.pessoas.length})`}
                </button>
              )}
            </>
          )}
        </>
      )}
      {aberta && (
        <FichaPessoa pessoa={aberta} rotuloPeriodo={rotuloPeriodo} hoje={hoje} onClose={() => setAberta(null)} />
      )}
    </section>
  )
}
