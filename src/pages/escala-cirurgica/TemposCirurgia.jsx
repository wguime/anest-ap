/**
 * OS TEMPOS SEM DÚVIDA (dono 10/11/2026, modelo A de `.tmp/analise-escala-2026-11/modelos-2/
 * a-quatro-folhas.html`: "Sim, aprovo"). Fonte única do DESENHO e das PALAVRAS dos tempos
 * da escala — o mesmo tempo aparecia com nomes e formatos diferentes em cada tela, e um
 * horário solto não dizia se era da cirurgia ou de quem estava nela.
 *
 * Vocabulário (um nome por tempo, no app inteiro):
 *   · Início / Término  = horário REAL da cirurgia;
 *   · Tempo estimado    = previsão DA CIRURGIA — duração antes de começar ("1h"), horário
 *                         de fim depois de começar ("09:30");
 *   · Tempo total       = até quando a PESSOA fica ("fica até 11:40"), informado à mão;
 *   · mapa 1h30         = a duração que veio escrita no mapa, só quando não há estimado.
 *
 * Duas formas que não se confundem:
 *   · `CasasCirurgia`    — três caixas em fileira, SEMPRE de UMA cirurgia (o título do bloco
 *                          diz qual). Vazio é "—" com "ainda não informado".
 *   · `TempoTotalPessoa` — faixa de contorno verde com ícone de pessoa e o NOME dela; nunca
 *                          na mesma fileira das casas.
 * Nada aqui calcula ou soma: as casas mostram o que está gravado na cirurgia e a faixa
 * mostra o tempo total informado na fila.
 */
import { ChevronRight, Clock, UserRound } from 'lucide-react'
import { duracaoMin, rotuloMinutos } from '@/lib/escalaHorarioReal'
import { ehDataFilaUnica, FDS_HOSPITAL } from '@/lib/escalaFds'
import { formatFaltante, rotuloDuracao } from './PainelTempo'
import { casosAtivosDaPessoa, normNome, parseDuracaoMin, parseHoraMinutos } from './utils'

const VAZIO = 'ainda não informado'
const HOSPITAIS_DA_FILA = ['unimed', 'hro', 'materno']

/** Em que pé está a cirurgia — aceita o caso inteiro ou a linha enxuta da fila (`andamento`). */
const estadoDe = (c) => c?.statusCirurgia || (c?.andamento ? 'iniciada' : 'agendada')

/** "01:30" do mapa → "1h30" (o mesmo formato do resto do módulo); o que não parseia sai como veio. */
export function rotuloDoMapa(tempoEstimado) {
  const bruto = String(tempoEstimado || '').trim()
  if (!bruto) return ''
  const min = parseDuracaoMin(bruto)
  return min ? rotuloDuracao(min) : bruto
}

/**
 * O TEMPO ESTIMADO de uma cirurgia, pronto para qualquer tela.
 * @returns {{ valor: string, tipo: 'horario'|'duracao'|null, falta: string, atrasada: boolean }}
 *   `valor` "09:30" (em andamento) ou "1h" (ainda não começou); `falta` "faltam 45min" /
 *   "12min além" só na cirurgia EM ANDAMENTO (regra de 29/07: quem não começou não conta).
 */
export function tempoEstimadoDe(caso, agoraMin = null) {
  const estado = estadoDe(caso)
  if (estado === 'terminada') return { valor: '', tipo: null, falta: '', atrasada: false }
  const horario = String(caso?.terminoPrevisto || '').trim()
  const duracao = Number(caso?.duracaoEstimadaMin) > 0 ? Number(caso.duracaoEstimadaMin) : null
  if (estado !== 'iniciada' && duracao) return { valor: rotuloDuracao(duracao), tipo: 'duracao', falta: '', atrasada: false }
  if (!horario) return { valor: '', tipo: null, falta: '', atrasada: false }
  const alvo = parseHoraMinutos(horario)
  const f = estado === 'iniciada' && alvo != null && agoraMin != null ? formatFaltante(alvo, agoraMin) : null
  const n = f ? f.texto.replace(/^[~+]/, '') : ''
  return { valor: horario, tipo: 'horario', falta: f ? (f.atrasada ? `${n} além` : `faltam ${n}`) : '', atrasada: !!f?.atrasada }
}

/**
 * A FRASE ÚNICA do quadro e da fila: "Tempo estimado 09:30 · faltam 45min" (em andamento),
 * "Tempo estimado 1h · não começou" (agendada) ou, sem estimado, "mapa 1h30".
 * @returns {{ rotulo: string, detalhe: string, atrasada: boolean, mapa: boolean }|null}
 */
export function fraseTempoEstimado(caso, agoraMin = null) {
  const t = tempoEstimadoDe(caso, agoraMin)
  if (t.valor) {
    const detalhe = estadoDe(caso) === 'iniciada' ? t.falta : 'não começou'
    return { rotulo: `Tempo estimado ${t.valor}`, detalhe, atrasada: t.atrasada, mapa: false }
  }
  if (estadoDe(caso) === 'terminada') return null
  const mapa = rotuloDoMapa(caso?.tempoEstimado)
  return mapa ? { rotulo: `mapa ${mapa}`, detalhe: '', atrasada: false, mapa: true } : null
}

/** A frase acima como linha de texto (card do quadro e linha da fila — mesmas palavras). */
export function LinhaTempoEstimado({ caso, agoraMin = null, icone = true, suave = false, className = '' }) {
  const f = fraseTempoEstimado(caso, agoraMin)
  if (!f) return null
  return (
    <span data-tempo-estimado className={['flex min-w-0 items-center gap-1 text-[12.5px] leading-tight', className].join(' ')}>
      {icone && <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      <span className={['whitespace-nowrap', f.mapa || suave ? 'text-muted-foreground' : 'font-semibold text-foreground'].join(' ')}>{f.rotulo}</span>
      {f.detalhe && (
        <span className={['whitespace-nowrap', f.atrasada ? 'font-semibold text-warning' : 'text-muted-foreground'].join(' ')}>· {f.detalhe}</span>
      )}
    </span>
  )
}

function Casa({ rotulo, valor, sub, subAviso = false, faixa = '', nomeAcessivel, onClick, editavel }) {
  const vazio = !valor
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      aria-label={nomeAcessivel ? `${nomeAcessivel}: ${valor || 'não informado'}` : undefined}
      data-casa={rotulo}
      className={[
        'flex min-w-0 flex-col rounded-[10px] px-2 py-1.5 text-left',
        editavel
          ? (vazio
            ? 'min-h-[64px] border-[1.5px] border-dashed border-border-strong bg-card'
            : `min-h-[64px] border border-border-strong bg-card ${faixa || 'border-l-4 border-l-success'}`)
          : 'min-h-[58px] border border-border bg-muted',
        onClick ? 'active:opacity-70' : '',
      ].join(' ')}
    >
      <span className="text-[9.5px] font-extrabold uppercase leading-[1.2] tracking-[0.05em] text-muted-foreground">{rotulo}</span>
      <span className={['text-[17px] leading-tight tabular-nums', vazio ? 'font-medium text-muted-foreground' : 'font-extrabold text-foreground'].join(' ')}>
        {valor || '—'}
      </span>
      <span className={[
        'text-[10.5px] leading-tight',
        subAviso ? 'font-semibold text-warning' : vazio && onClick ? 'font-semibold text-primary' : 'text-muted-foreground',
      ].join(' ')}>
        {sub || (vazio ? VAZIO : '')}
      </span>
    </Tag>
  )
}

/**
 * AS TRÊS CASAS de UMA cirurgia — Início · Tempo estimado · Término.
 * `nomes` = prefixos dos nomes acessíveis ({ inicio, estimado, termino }); cada `on*`
 * presente torna a casa um botão (≥ 64px de altura). Sem nenhum, é só leitura.
 */
export function CasasCirurgia({ caso, agoraMin = null, diaAtual = true, nomes = {}, onInicio = null, onEstimado = null, onTermino = null }) {
  const estado = estadoDe(caso)
  const editavel = !!(onInicio || onEstimado || onTermino)
  const inicio = String(caso?.inicioReal || '').trim()
  const termino = String(caso?.terminoReal || '').trim()
  const est = tempoEstimadoDe(caso, agoraMin)
  const agoraHHMM = agoraMin != null
    ? `${String(Math.floor((agoraMin % 1440) / 60)).padStart(2, '0')}:${String(agoraMin % 60).padStart(2, '0')}` : null
  const emSala = estado === 'iniciada' && inicio && diaAtual && agoraHHMM ? duracaoMin(inicio, agoraHHMM) : null
  const durou = estado === 'terminada' ? duracaoMin(inicio, termino) : null
  return (
    <div className="grid grid-cols-3 gap-1.5">
      <Casa
        rotulo="Início" valor={inicio} editavel={editavel}
        sub={emSala != null ? `há ${rotuloMinutos(emSala)}` : ''}
        nomeAcessivel={nomes.inicio} onClick={onInicio}
      />
      <Casa
        rotulo="Tempo estimado" valor={est.valor} editavel={editavel}
        sub={est.valor ? (est.tipo === 'duracao' ? 'duração prevista' : (est.falta || (estado === 'iniciada' ? '' : 'não começou'))) : (estado === 'terminada' ? 'cirurgia terminada' : '')}
        subAviso={est.atrasada}
        faixa="border-l-4 border-l-primary"
        nomeAcessivel={nomes.estimado} onClick={estado === 'terminada' ? null : onEstimado}
      />
      <Casa
        rotulo="Término" valor={termino} editavel={editavel}
        sub={durou != null ? `durou ${rotuloMinutos(durou)}` : ''}
        faixa="border-l-4 border-l-info"
        nomeAcessivel={nomes.termino} onClick={onTermino}
      />
    </div>
  )
}

/** Bloco de UMA cirurgia com o nome dela no título e as três casas embaixo. */
export function CartaoCirurgia({ titulo, acao = null, children }) {
  return (
    <div data-cirurgia-tempos className="rounded-[14px] border border-border-strong bg-card px-2.5 pb-2.5 pt-2">
      <div className="mb-1.5 flex min-h-[20px] min-w-0 items-center gap-1.5 text-[13px] font-bold leading-tight">
        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{titulo}</span>
        {acao}
      </div>
      {children}
    </div>
  )
}

/**
 * O TEMPO TOTAL DE UMA PESSOA — "Tempo total de Fernanda · fica até 11:40". Contorno verde e
 * ícone de pessoa: outro desenho, para nunca ser lido como horário de cirurgia.
 * `acao` = { label, onClick, nomeAcessivel } vira o botão à direita (44px de alvo).
 */
export function TempoTotalPessoa({ nome, termino = '', sub = '', acao = null, className = '' }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'a pessoa'
  return (
    <div
      data-tempo-total
      className={['flex min-h-[56px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-primary bg-primary/[0.08] py-2 pl-3 pr-2.5 dark:bg-primary/[0.12]', className].join(' ')}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <UserRound className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-extrabold uppercase leading-tight tracking-[0.05em] text-primary">Tempo total de {primeiro}</span>
        {termino
          ? <span className="block text-[17px] font-extrabold leading-tight tabular-nums">fica até {termino}</span>
          : <span className="block text-[14px] font-semibold leading-tight text-muted-foreground">{VAZIO}</span>}
        {sub && <span className="block text-[11px] leading-snug text-muted-foreground">{sub}</span>}
      </span>
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          aria-label={acao.nomeAcessivel || acao.label}
          className="relative flex h-9 shrink-0 items-center gap-1 rounded-[10px] border border-primary px-3 text-[13px] font-semibold text-primary active:opacity-70 after:absolute after:-inset-x-1 after:-inset-y-1 after:content-['']"
        >
          {acao.label}{acao.seta && <ChevronRight className="h-4 w-4" aria-hidden />}
        </button>
      )}
    </div>
  )
}

/** Pílula do cabeçalho da sala (Completa, opção B do dono): "Tempo total 11:40" com ícone de pessoa. */
export function PilulaTempoTotal({ termino, nome = '' }) {
  if (!termino) return null
  return (
    <span
      data-pilula-tempo-total
      aria-label={`Tempo total${nome ? ` de ${nome}` : ''}: fica até ${termino}`}
      className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-2 text-[12px] font-bold tabular-nums text-primary-foreground"
    >
      <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {/* a 360–389px o rótulo sai (o nome do anestesista sumiria no "…"); o ícone de pessoa
          e o nome acessível seguem dizendo de quem é o horário */}
      <span className="hidden text-[11px] font-medium opacity-90 min-[390px]:inline">Tempo total</span>
      {termino}
    </span>
  )
}

/**
 * O TEMPO TOTAL e a POSIÇÃO de quem responde por um caso, lidos de onde a fila lê: a escala
 * do hospital no dia útil; a linha 'fds' (com as cirurgias dos três hospitais) na fila única.
 * Só LEITURA — a mesma resolução do espelho (`casosAtivosDaPessoa`), então posição assumida
 * cai na linha do slot. Null quando o caso não tem UM dono (dupla, "?", sem anestesista).
 * @returns {{ termino: string, cirurgias: number, turno: string, chave: string }|null}
 */
export function tempoTotalDaPessoa(escala, caso, escalas = null) {
  if (!escala || !caso) return null
  const fds = escalas?.[FDS_HOSPITAL]
  const filaUnica = escala.hospital !== FDS_HOSPITAL && ehDataFilaUnica(escala.data)
    && fds?.status === 'publicada' && fds?.data === escala.data
  const visao = filaUnica
    ? {
      ...escala,
      casos: HOSPITAIS_DA_FILA.flatMap((h) => (h === escala.hospital ? (escala.casos || []) : (escalas?.[h]?.casos || []))),
      linhaOverrides: fds.linhaOverrides || {},
    }
    : escala
  const ctx = casosAtivosDaPessoa(visao, caso)
  if (!ctx) return null
  const lo = visao.linhaOverrides || {}
  const bruto = lo[`${ctx.turno}:${ctx.chave}`] ?? lo[ctx.chave]
    ?? lo[`${ctx.turno}:${normNome(ctx.nomeBruto)}`] ?? lo[normNome(ctx.nomeBruto)]
  const termino = bruto && typeof bruto === 'object' ? String(bruto.termino || '').trim() : ''
  return { termino, cirurgias: ctx.ativos.length, turno: ctx.turno, chave: ctx.chave }
}
