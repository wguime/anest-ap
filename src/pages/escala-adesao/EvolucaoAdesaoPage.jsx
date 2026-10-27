/**
 * EvolucaoAdesaoPage — infográfico "Evolução da adesão" (dono 27/10/2026).
 *
 * Escolhido por imagem o exemplo 3 ("Impacto") de `.tmp/adesao-infografico-exemplos.html`: blocos
 * de cor inteira, um recado por bloco, números gigantes. Aberto pelo card à esquerda do "Adesão à
 * Escala Cirúrgica" nos Destaques da Home.
 *
 * Página ÚNICA em qualquer tela (pedido do dono): 1 coluna no celular, 2 no tablet (lg), 3 no
 * desktop (xl) — os blocos fluem em colunas CSS, sem abas nem paginação.
 *
 * Dados ao vivo: as 5 últimas semanas completas + as 4 anteriores de contexto
 * (`useAdesaoSemanas`, uma `escala_adesao_periodo` por semana). Textos e números saem de
 * `montarInfografico` (lib/escalaAdesaoInfografico), para a frase seguir a semana que mudou.
 */
import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components'
import { cn } from '@/design-system/utils/tokens'
import { useAdesaoSemanas } from '@/hooks/useAdesaoEscala'
import { montarEvolucao } from '@/lib/escalaAdesaoSemanal'
import { montarInfografico, percentualSemana } from '@/lib/escalaAdesaoInfografico'
import { BarrasQuemMarca, COR_LINHA, ColunasEngajados, EvolucaoLinhas, SerieInterrompida } from './InfograficoGraficos'

const CLARO_EM_TODO_TEMA = 'text-primary-foreground'
const COR_CARGO = { anest: 'text-category-green-fg', enf: 'text-category-teal', res: 'text-category-blue' }

function Bloco({ tom, className, children, rotulo }) {
  const fundo = {
    verde: cn('bg-primary', CLARO_EM_TODO_TEMA),
    menta: 'bg-category-green-bg text-foreground',
    branco: 'bg-card text-foreground',
    laranja: 'bg-category-orange-bg text-foreground',
  }[tom]
  return (
    <section aria-label={rotulo} className={cn('break-inside-avoid px-[22px] py-[26px]', fundo, className)}>
      {children}
    </section>
  )
}

const Rotulo = ({ className, children }) => (
  <p className={cn('text-[11px] font-extrabold uppercase tracking-[0.16em]', className)}>{children}</p>
)

const Giga = ({ className, children }) => (
  <p className={cn('mt-2.5 text-[96px] font-black leading-[0.9] tracking-[-0.045em] tabular-nums', className)}>{children}</p>
)

const Lead = ({ children }) => (
  <p className="mt-2.5 text-[20px] font-extrabold leading-[1.22] tracking-[-0.01em]">{children}</p>
)

const maiuscula = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

function Carregando() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Carregando o infográfico">
      <div className="h-[420px] animate-pulse bg-primary/80" />
      <div className="h-[380px] animate-pulse bg-category-green-bg" />
      <div className="h-[200px] animate-pulse bg-card" />
    </div>
  )
}

export default function EvolucaoAdesaoPage({ goBack }) {
  const { dados, carregando, erro, recarregar } = useAdesaoSemanas()
  const vm = useMemo(() => montarInfografico(montarEvolucao(dados || {})), [dados])

  return (
    <div className="min-h-dvh bg-background pb-24">
      <PageHeader
        title="Evolução da adesão"
        subtitle={vm ? `Escala Cirúrgica · ${vm.periodo}` : 'Escala Cirúrgica'}
        onBack={goBack}
        actions={
          <button
            type="button"
            onClick={recarregar}
            disabled={carregando}
            aria-label="Atualizar"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn('h-5 w-5', carregando && 'animate-spin')} aria-hidden="true" />
          </button>
        }
      />

      <div className="mx-auto w-full max-w-[1280px] lg:px-5 lg:pt-4">
        {!vm && carregando && <Carregando />}
        {!vm && !carregando && (
          <div className="mx-4 mt-4 rounded-xl border border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
            {erro ? `Não foi possível carregar: ${erro}` : 'Ainda não há semanas completas gravadas para mostrar a evolução.'}
            <button type="button" onClick={recarregar} className="mt-3 flex min-h-[44px] items-center font-semibold text-primary">
              Tentar de novo
            </button>
          </div>
        )}

        {vm && (
          <div className="overflow-hidden bg-card lg:columns-2 lg:gap-0 lg:rounded-2xl lg:border lg:border-border xl:columns-3">
            {/* 1 · engajados */}
            <Bloco tom="verde" rotulo="Pessoas engajadas por semana">
              <Rotulo>Escala Cirúrgica · {vm.semanas} semanas · {vm.periodo}</Rotulo>
              <Giga>
                <span className="text-[44px] font-extrabold tracking-[-0.02em] opacity-55">{vm.engajados.antes}→</span>
                {vm.engajados.agora}
              </Giga>
              <Lead>pessoas engajadas com a escala por semana</Lead>
              <p className="mt-2 text-[13px] leading-[1.45] opacity-80">
                Anestesiologistas, enfermagem e residentes.
                {vm.engajados.faixaAnterior && vm.engajados.quando && (
                  <> {maiuscula(vm.engajados.quando)}, {vm.engajados.faixaAnterior[0] === vm.engajados.faixaAnterior[1]
                    ? `eram ${vm.engajados.faixaAnterior[0]}`
                    : `eram de ${vm.engajados.faixaAnterior[0]} a ${vm.engajados.faixaAnterior[1]}`}.</>
                )}
              </p>
              <div className="mt-3.5"><ColunasEngajados colunas={vm.engajados.colunas} /></div>
            </Bloco>

            {/* 2 · a inclinação */}
            <Bloco tom="menta" rotulo="A inclinação do início marcado">
              <Rotulo className="text-category-green-fg">A inclinação</Rotulo>
              <Giga className="text-category-green-fg">{percentualSemana(vm.inclinacao.valor)}</Giga>
              <Lead>
                por semana no início marcado
                {vm.inclinacao.antes != null && vm.inclinacao.quando && ` — era ${percentualSemana(vm.inclinacao.antes)} ${vm.inclinacao.quando}`}
              </Lead>
              <p className="mt-2 text-[13px] leading-[1.45] text-muted-foreground">
                De {vm.inclinacao.primeiro ?? '—'}% para {vm.inclinacao.ultimo ?? '—'}% das cirurgias em {vm.semanas} semanas. Aumento
                semanal = inclinação da reta de tendência sobre o nível em que ela começa.
              </p>
              <div className="mt-3">
                <SerieInterrompida
                  anteriores={vm.inclinacao.anteriores}
                  serie={vm.inclinacao.serie}
                  rotulos={vm.inclinacao.rotulos}
                  rotuloAntes={vm.inclinacao.antes == null ? null : `${percentualSemana(vm.inclinacao.antes)}/sem`}
                  rotuloDepois={vm.inclinacao.valor == null ? null : `${percentualSemana(vm.inclinacao.valor)}/sem`}
                  marco={vm.inclinacao.marco}
                  meta={vm.inclinacao.meta}
                />
              </div>
            </Bloco>

            {/* 3 · agora */}
            <Bloco tom="branco" rotulo="Agora">
              <Rotulo className="text-category-green-fg">Agora</Rotulo>
              <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                {vm.agora.map((a) => (
                  <div key={a.rotulo}>
                    <p className="text-[40px] font-black leading-none tracking-[-0.03em] tabular-nums">{a.valor}</p>
                    <p className="mt-1.5 text-[12px] font-semibold leading-tight">{a.rotulo}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{a.antes}</p>
                  </div>
                ))}
              </div>
            </Bloco>

            {/* 4 · evolução semana a semana */}
            <Bloco tom="branco" className="border-t border-border" rotulo="Evolução semana a semana">
              <Rotulo className="text-category-green-fg">Evolução semana a semana</Rotulo>
              <Lead>{vm.evolucao.manchete}</Lead>
              <div className="mt-2.5"><EvolucaoLinhas linhas={vm.evolucao.linhas} rotulos={vm.evolucao.rotulos} meta={vm.evolucao.meta} /></div>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {vm.evolucao.linhas.map((l) => (
                  <li key={l.chave} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: COR_LINHA[l.chave] }} aria-hidden="true" />
                    {l.nome}
                    <b className={cn('tabular-nums', l.crescimento >= 0.5 ? 'text-category-green-fg' : 'text-muted-foreground')}>{percentualSemana(l.crescimento)}/sem</b>
                  </li>
                ))}
              </ul>
            </Bloco>

            {/* 5 · quem marca */}
            {vm.quemMarca && (
              <Bloco tom="menta" rotulo="Quem marca">
                <Rotulo className="text-category-green-fg">Quem marca</Rotulo>
                <Giga className="text-category-green-fg">{vm.quemMarca.agora}%</Giga>
                <Lead>
                  das marcações agora são feitas pelos anestesiologistas.
                  {vm.quemMarca.antes != null && ` Eram ${vm.quemMarca.antes}%.`}
                </Lead>
                <div className="mt-3"><BarrasQuemMarca barras={vm.quemMarca.barras} /></div>
              </Bloco>
            )}

            {/* 6 · por cargo e hospital */}
            <Bloco tom="branco" rotulo="Por cargo e hospital">
              <Rotulo className="text-category-green-fg">Por cargo e hospital</Rotulo>
              <div className="mt-3.5 grid grid-cols-3 gap-2.5">
                {vm.cargos.map((c) => (
                  <div key={c.cor}>
                    <p className={cn('text-[40px] font-black leading-none tracking-[-0.03em] tabular-nums', c.melhorou ? COR_CARGO[c.cor] : 'text-category-orange-fg')}>{c.agora}</p>
                    <p className="mt-1.5 text-[12px] font-semibold leading-tight">{c.nome}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{c.antes === 1 ? 'era' : 'eram'} {c.antes} · de {c.base}</p>
                  </div>
                ))}
              </div>
              {vm.hospitais.length > 0 && (
                <div className="mt-[18px] grid grid-cols-3 gap-2.5">
                  {vm.hospitais.map((h) => (
                    <div key={h.chave}>
                      <p className={cn('text-[32px] font-black leading-none tracking-[-0.03em] tabular-nums', h.abaixo && 'text-category-orange-fg')}>{h.ter ?? '—'}%</p>
                      <p className="mt-1.5 text-[12px] font-semibold leading-tight">término no {h.nome}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">era {h.terAntes ?? '—'}% · início {h.ini ?? '—'}%</p>
                    </div>
                  ))}
                </div>
              )}
            </Bloco>

            {/* 7 · o que falta */}
            <Bloco tom="laranja" rotulo="O que falta">
              <Rotulo className="text-category-orange-fg">O que falta</Rotulo>
              {vm.falta.length ? (
                <div className="mt-3.5 grid grid-cols-2 gap-x-3.5 gap-y-4">
                  {vm.falta.map((f) => (
                    <div key={f.rotulo}>
                      <p className="text-[44px] font-black leading-none tracking-[-0.03em] text-category-orange-fg tabular-nums">{f.valor}</p>
                      <p className="mt-1.5 text-[12.5px] font-bold leading-tight">{f.rotulo}</p>
                      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{f.detalhe}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Lead>Todos os indicadores estão na meta nesta semana.</Lead>
              )}
            </Bloco>

            {/* 8 · como medimos */}
            <section aria-label="Como medimos" className="break-inside-avoid bg-card px-[22px] pb-[22px] pt-4 text-[10.5px] leading-[1.5] text-muted-foreground">
              Semanas de segunda a domingo; cirurgias das escalas publicadas (HRO, Unimed, Materno).{' '}
              <b>Anestesiologista engajado</b>: índice de uso 50+ (abrir a escala, início, término, previsão de término e tempo total,
              cada um contra a meta) — a régua da tela Adesão à Escala, por semana. <b>Enfermagem e residentes</b>: abriram a escala
              em 4+ dos 5 dias úteis e fizeram 3+ marcações na semana. <b>Aumento por semana</b>: inclinação da reta de mínimos quadrados sobre o nível em que ela começa. Feriado conta
              como dia útil. A previsão de término não entra: o app a apaga quando a cirurgia termina.
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
