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
import { casosAtivosDaPessoa, normNome, parseDuracaoMin, parseHoraMinutos, rodapeDoTurno } from './utils'

const VAZIO = 'ainda não informado' // só na faixa do tempo total; as casas vazias dizem "—"
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

// CASAS COMPACTAS (dono 11/11/2026, opção A de `modelos-5/1-casas-compactas.html`): 52 px, rótulo
// pequeno em cima e valor grande embaixo; vazia é só "—". Cada casa vazia gastava de 73 a 84 px
// para dizer "ainda não informado", e o apoio ("há 1h22", "faltam 3h25") saiu de dentro delas
// para UMA linha abaixo das três (`apoioDasCasas`).
function Casa({ rotulo, valor, faixa = '', nomeAcessivel, onClick, editavel }) {
  const vazio = !valor
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      aria-label={nomeAcessivel ? `${nomeAcessivel}: ${valor || 'não informado'}` : undefined}
      data-casa={rotulo}
      className={[
        'flex min-h-[52px] min-w-0 flex-col justify-center rounded-[10px] px-2 py-[5px] text-left',
        vazio
          ? 'border-[1.5px] border-dashed border-border-strong bg-transparent'
          : editavel
            ? `border border-border-strong bg-card ${faixa || 'border-l-4 border-l-success'}`
            : 'border border-border bg-muted',
        onClick ? 'active:opacity-70' : '',
      ].join(' ')}
    >
      <span className="text-[9.5px] font-extrabold uppercase leading-[1.1] tracking-[0.05em] text-muted-foreground">{rotulo}</span>
      <span className={['text-[17px] leading-[1.2] tabular-nums', vazio ? 'font-medium text-muted-foreground' : 'font-extrabold text-foreground'].join(' ')}>
        {valor || '—'}
      </span>
    </Tag>
  )
}

/**
 * O APOIO das três casas, numa linha só: "Início: há 1h31 · Tempo estimado: faltam 3h25" ·
 * "Tempo estimado: duração prevista" · "Término: durou 1h17". Vazio quando não há o que dizer.
 * @returns {{ partes: string[], atrasada: boolean }}
 */
export function apoioDasCasas(caso, agoraMin = null, diaAtual = true) {
  const estado = estadoDe(caso)
  const inicio = String(caso?.inicioReal || '').trim()
  const termino = String(caso?.terminoReal || '').trim()
  const est = tempoEstimadoDe(caso, agoraMin)
  const agoraHHMM = agoraMin != null
    ? `${String(Math.floor((agoraMin % 1440) / 60)).padStart(2, '0')}:${String(agoraMin % 60).padStart(2, '0')}` : null
  const emSala = estado === 'iniciada' && inicio && diaAtual && agoraHHMM ? duracaoMin(inicio, agoraHHMM) : null
  const durou = estado === 'terminada' ? duracaoMin(inicio, termino) : null
  const partes = [
    emSala != null ? `Início: há ${rotuloMinutos(emSala)}` : null,
    est.valor ? `Tempo estimado: ${est.tipo === 'duracao' ? 'duração prevista' : (est.falta || (estado === 'iniciada' ? '' : 'não começou'))}` : null,
    durou != null ? `Término: durou ${rotuloMinutos(durou)}` : null,
  ].filter((p) => p && !p.endsWith(': '))
  return { partes, atrasada: est.atrasada }
}

/**
 * AS TRÊS CASAS de UMA cirurgia — Início · Tempo estimado · Término — e, abaixo delas, a linha
 * de apoio. `nomes` = prefixos dos nomes acessíveis ({ inicio, estimado, termino }); cada `on*`
 * presente torna a casa um botão (52 px de altura, alvo ≥ 44). Sem nenhum, é só leitura.
 * `informado` = "informado por Karine às 08:26" (quem registrou o horário), em letra menor.
 */
export function CasasCirurgia({ caso, agoraMin = null, diaAtual = true, nomes = {}, onInicio = null, onEstimado = null, onTermino = null, informado = '' }) {
  const estado = estadoDe(caso)
  const editavel = !!(onInicio || onEstimado || onTermino)
  const inicio = String(caso?.inicioReal || '').trim()
  const termino = String(caso?.terminoReal || '').trim()
  const est = tempoEstimadoDe(caso, agoraMin)
  const apoio = apoioDasCasas(caso, agoraMin, diaAtual)
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        <Casa rotulo="Início" valor={inicio} editavel={editavel} nomeAcessivel={nomes.inicio} onClick={onInicio} />
        <Casa
          rotulo="Tempo estimado" valor={est.valor} editavel={editavel} faixa="border-l-4 border-l-primary"
          nomeAcessivel={nomes.estimado} onClick={estado === 'terminada' ? null : onEstimado}
        />
        <Casa rotulo="Término" valor={termino} editavel={editavel} faixa="border-l-4 border-l-info" nomeAcessivel={nomes.termino} onClick={onTermino} />
      </div>
      {apoio.partes.length > 0 && (
        <p data-apoio-casas className="mt-1.5 pl-0.5 text-[11.5px] leading-[1.3] text-muted-foreground">
          {apoio.partes.map((parte, i) => (
            <span key={parte}>
              {i > 0 && ' · '}
              <span className={apoio.atrasada && parte.startsWith('Tempo estimado') ? 'font-semibold text-warning' : ''}>{parte}</span>
            </span>
          ))}
        </p>
      )}
      {informado && <p data-informado-por className="mt-0.5 pl-0.5 text-[11px] leading-[1.3] text-muted-foreground/90">{informado}</p>}
    </>
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

/**
 * O TEMPO TOTAL e a POSIÇÃO de quem responde por um caso, lidos de onde a fila lê: a escala
 * do hospital no dia útil; a linha 'fds' (com as cirurgias dos três hospitais) na fila única.
 * Só LEITURA — a mesma resolução do espelho (`casosAtivosDaPessoa`), então posição assumida
 * cai na linha do slot. Null quando o caso não tem UM dono (dupla, "?", sem anestesista).
 * @returns {{ termino: string, cirurgias: number, turno: string, chave: string, posicao: number, liberada: boolean }|null}
 */
export function tempoTotalDaPessoa(escala, caso, escalas = null, resolverUid = null) {
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
  // POSIÇÃO NA FILA (11/11): o lugar da CHAVE da linha na ordem publicada do turno — quem
  // assumiu a posição de um colega ocupa o lugar dele (`ctx.chave` já é a do slot). Fora da
  // ordem publicada (ajuda, extra, Materno sem rodapé) não há posição a dizer: 0.
  const dona = filaUnica ? fds : escala
  const rodape = rodapeDoTurno(dona?.ordemLiberacao, ctx.turno)
  const ehOSlot = ctx.chave !== (ctx.uid || normNome(ctx.nomeBruto)) // posição assumida de outro
  const posicao = rodape.findIndex((n) => normNome(n) === ctx.chave
    || (typeof resolverUid === 'function' && resolverUid(n) === ctx.chave)
    || (!ehOSlot && normNome(n) === normNome(ctx.nomeBruto))) + 1
  // já liberada neste turno? (o marcador `{ escalado: true }` do repasse não é liberação)
  const marca = (dona?.liberacoes || {})[`${ctx.turno}:${ctx.chave}`]
  const liberada = !!marca && marca.escalado !== true
  return { termino, cirurgias: ctx.ativos.length, turno: ctx.turno, chave: ctx.chave, posicao, liberada }
}
