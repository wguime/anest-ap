/**
 * Conferência de um MAPA CIRÚRGICO do fim de semana (dono 2026-08-22).
 *
 * Enxuta de propósito, e a razão é do documento: no fim de semana o mapa NÃO
 * traz rodapé de liberação — a fila vem da tabela de posições ("ESCALA DE FINAL
 * DE SEMANA"), que é uma só para os três hospitais. Então aqui não existe lista
 * numerada, ajuda externa, troca nem duplicidade entre hospitais: sobram os
 * blocos por sala e quem responde por cada um. É ~60% menos tela que a
 * conferência de dia útil, que continua intacta no fluxo dela.
 *
 * As abas Manhã/Tarde são a MESMA leitura: o arquivo é lido uma vez e o turno de
 * cada linha sai da faixa MATUTINO/VESPERTINO do documento (`turnoDoCasoImportado`).
 * Antes era preciso anexar o mesmo mapa duas vezes, e as linhas "AS" caíam no
 * período selecionado no anexo.
 *
 * A atribuição é POR GRUPO (`gruposAnestesista`), não por sala: sala com dois
 * anestesistas em cirurgias diferentes vira um bloco por anestesista — a mesma
 * regra que impediu o IOSC de sair com três linhas para uma pessoa só (23/07).
 * As chaves de grupo são calculadas DENTRO de cada turno, então `atribuicoes` é
 * namespaced por turno: "Sala 1" de manhã e "Sala 1" à tarde são gente diferente.
 */
import { useEffect, useMemo } from 'react'
import { ChevronLeft, Check, Sparkles } from 'lucide-react'
import { Badge, Button, Select } from '@/design-system'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import { nomeCirurgiaoCurto } from '@/lib/colunaLiberacao'
import { anestesistaDoPosto, sugerirAtribuicoesDoPosto, sugerirAtribuicoesLidas, turnoDoCasoImportado, TURNOS_MAPA } from '@/lib/escalaFdsMapas'
import { gruposAnestesista, formatData } from './utils'
import SegmentedSelector from './SegmentedSelector'

const TURNO_LABEL = { matutino: 'Manhã', vespertino: 'Tarde' }
const SEM_ANESTESISTA = '__sem__'

/** "a seguir" é o que o mapa do HRO escreve como "AS" — a linha herda a sala. */
const horaExibida = (hora) => {
  const t = String(hora || '').trim()
  if (!t) return 'a seguir'
  return /^(AS|A\s*SEGUIR)$/i.test(t) ? 'a seguir' : t
}

export default function ConferirMapaFdsPage({ mapa, grade, onSalvar, onVoltar, canEdit = true }) {
  const { options: rosterOpcoes, rosterByUid, resolver } = useRosterAnestesistas()

  const porTurno = useMemo(() => {
    const out = { matutino: [], vespertino: [] }
    for (const c of mapa?.casos || []) out[turnoDoCasoImportado(c)].push(c)
    return out
  }, [mapa])

  // turno aberto: começa no que tem casos (domingo do HRO não tem tarde)
  const turno = TURNOS_MAPA.includes(mapa?.turnoAberto)
    ? mapa.turnoAberto
    : (porTurno.matutino.length ? 'matutino' : 'vespertino')
  const casosDoTurno = porTurno[turno]
  const grupos = useMemo(
    () => gruposAnestesista(casosDoTurno, mapa?.hospital),
    [casosDoTurno, mapa?.hospital],
  )

  // a data entra porque a sugestão pelo posto vale SÓ na manhã de sábado
  // (dono 29/08) — ver `anestesistaDoPosto`
  const nomePosto = anestesistaDoPosto(grade, mapa?.hospital, turno, mapa?.data)
  const atribuicoes = mapa?.atribuicoes?.[turno] || {}
  const sugeridos = mapa?.sugeridos?.[turno] || {}

  // PRÉ-SELEÇÃO DO LOGIN, em duas fontes que não se cruzam:
  //
  // 1. NOME LIDO no mapa (dono 25/08: "identificou o anestesista no cabeçalho
  //    mas o campo abaixo deixou 'sem anestesista'"). O dicionário só diz a que
  //    login o nome do documento pertence — não é palpite, então entra sem
  //    marca de sugestão, igual à conferência de dia útil.
  // 2. POSTO DA GRADE (dono 22/08): o mapa do HRO de sábado veio com a coluna do
  //    anestesista vazia nas 6 cirurgias da tarde, e a grade diz que das 13–19h
  //    o HRO é do Rômulo. Esse SIM é sugestão e leva o rótulo.
  //
  // Uma alcança só grupo COM nome, a outra só grupo SEM nome. Em nenhuma das
  // duas a atribuição é gravada sozinha: o Select continua mandando.
  useEffect(() => {
    if (!canEdit) return
    const lidas = sugerirAtribuicoesLidas(grupos, resolver)
    const doPosto = sugerirAtribuicoesDoPosto(grupos, nomePosto, resolver)
    const novasLidas = Object.entries(lidas).filter(([k]) => atribuicoes[k] === undefined)
    const novasPosto = Object.entries(doPosto).filter(([k]) => atribuicoes[k] === undefined)
    if (!novasLidas.length && !novasPosto.length) return
    onSalvar({
      ...mapa,
      atribuicoes: {
        ...mapa.atribuicoes,
        [turno]: {
          ...atribuicoes,
          ...Object.fromEntries(novasLidas),
          ...Object.fromEntries(novasPosto.map(([k, v]) => [k, v.uid])),
        },
      },
      sugeridos: { ...mapa.sugeridos, [turno]: { ...sugeridos, ...Object.fromEntries(novasPosto.map(([k, v]) => [k, v.nome])) } },
    }, { silencioso: true })
  }, [grupos, nomePosto, resolver, canEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const definirGrupo = (chave, uid) => {
    const proximas = { ...atribuicoes }
    const proxSug = { ...sugeridos }
    if (uid === SEM_ANESTESISTA || !uid) delete proximas[chave]
    else proximas[chave] = uid
    delete proxSug[chave]   // escolha humana deixa de ser sugestão
    onSalvar({
      ...mapa,
      atribuicoes: { ...mapa.atribuicoes, [turno]: proximas },
      sugeridos: { ...mapa.sugeridos, [turno]: proxSug },
    }, { silencioso: true })
  }

  const trocarTurno = (t) => onSalvar({ ...mapa, turnoAberto: t }, { silencioso: true })

  const semAnestesista = grupos.filter((g) => !atribuicoes[g.chave] && (!g.nome || g.nome === '?')).length
  const titulo = `${HOSPITAL_LABEL[mapa?.hospital] || mapa?.hospital || 'Mapa'} · ${formatData(mapa?.data)}`

  return (
    <div className="fixed inset-0 z-modal bg-background overflow-y-auto" data-no-swipe-back="true">
      <div className="sticky top-0 z-10 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <button type="button" onClick={onVoltar} aria-label="Voltar para os documentos"
            className="flex min-h-[44px] min-w-[70px] items-center gap-1 text-primary active:opacity-60">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Voltar</span>
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-base font-semibold text-foreground">{titulo}</h1>
          <span className="min-w-[70px]" aria-hidden="true" />
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-2.5 p-4 pb-28">
        <SegmentedSelector
          options={TURNOS_MAPA.map((t) => ({ value: t, label: `${TURNO_LABEL[t]} · ${porTurno[t].length}` }))}
          value={turno}
          onChange={trocarTurno}
        />

        {nomePosto && (
          <p className="flex items-start gap-1.5 rounded-lg bg-primary/10 p-2 text-[11.5px] text-primary">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            A grade põe <b className="font-bold">{nomePosto}</b> no {HOSPITAL_LABEL[mapa?.hospital]} das{' '}
            {turno === 'matutino' ? '7–13h' : '13–19h'} — sala sem nome no mapa entra sugerida com esse posto.
          </p>
        )}

        {!casosDoTurno.length && (
          <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            Nenhuma cirurgia neste turno no documento. Nada será publicado para {TURNO_LABEL[turno].toLowerCase()}.
          </p>
        )}

        {grupos.map((g) => {
          const uid = atribuicoes[g.chave] || ''
          const sugerido = !!sugeridos[g.chave] && !!uid
          const r = uid ? rosterByUid.get(uid) : null
          const rotulo = r?.nome || g.nome || 'Sem anestesista'
          return (
            <section key={g.chave} className="overflow-hidden rounded-2xl border border-border-strong">
              <header className="flex items-center gap-2 bg-card-elevated px-3 py-2">
                <Badge className="shrink-0 border-transparent bg-primary text-primary-foreground">{g.sala}</Badge>
                <span className={`min-w-0 flex-1 truncate text-sm font-bold ${uid || g.nome ? '' : 'text-warning'}`}>
                  {rotulo}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {g.indices.length} cir.
                </span>
              </header>
              <div className="bg-card px-3 py-2">
                <Select
                  className="w-full"
                  searchable
                  aria-label={`Anestesista de ${g.sala}`}
                  options={[{ value: SEM_ANESTESISTA, label: '— sem anestesista —' }, ...rosterOpcoes]}
                  value={uid || SEM_ANESTESISTA}
                  onChange={(v) => definirGrupo(g.chave, v)}
                  disabled={!canEdit}
                  placeholder="Escolher quem responde"
                />
                {sugerido && (
                  <p className="mt-1 text-[11px] font-semibold text-primary">Sugerido pelo posto da grade — confirme ou troque</p>
                )}
              </div>
              <ul className="bg-card">
                {g.indices.map((i) => {
                  const c = casosDoTurno[i]
                  return (
                    <li key={i} className="border-t border-border px-3 py-1.5 text-[12.5px] text-muted-foreground">
                      {horaExibida(c.hora)} · <b className="font-semibold text-foreground">{c.pacienteIniciais || '—'}</b>
                      {c.idade ? ` (${c.idade})` : ''}
                      {c.cirurgiao ? ` · ${nomeCirurgiaoCurto(c.cirurgiao)}` : ''}
                      {c.procedimento ? ` · ${c.procedimento}` : ''}
                      {c.convenio ? ` · ${c.convenio}` : ''}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl space-y-2">
          <p className="text-center text-[11px] text-muted-foreground">
            {semAnestesista
              ? `${semAnestesista} sala(s) sem anestesista — dá para publicar assim e resolver na tela.`
              : `${TURNO_LABEL[turno]} conferida — ${grupos.length} sala(s).`}
          </p>
          <Button className="w-full" onClick={() => onSalvar({ ...mapa, conferido: true })}>
            <Check className="h-4 w-4" /> Salvar conferência
          </Button>
        </div>
      </div>
    </div>
  )
}
