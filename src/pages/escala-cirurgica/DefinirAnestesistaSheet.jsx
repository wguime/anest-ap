/**
 * DefinirAnestesistaSheet — troca o RESPONSÁVEL (substitui o sistema de trocas,
 * aposentado 2026-07-23) em DOIS modos:
 *   - SALA (header da Completa): atinge SÓ os casos não terminados do
 *     responsável-BASE da sala (+ linhas herdadas "//"/vazias). Linha com
 *     anestesista PRÓPRIO fica de fora — lição 23/07: o update sala-inteira
 *     achatou o IOSC (multi-anestesista) p/ uma pessoa e dois anestesistas
 *     SUMIRAM da escala.
 *   - CASO (detalhe do caso): atinge só aquele caso — é o caminho p/ trocar
 *     uma linha específica de bloco multi (IOSC/Exames/Umanitá).
 * Completa/Liberações/Minhas derivam dos casos → atualizam juntas (realtime).
 *
 * DESENHO "LISTA DE COLEGAS" (dono 17/08, escolhido em protótipo): o Select saiu
 * e o roster É a tela. Dois problemas do desenho antigo:
 *   1. o painel ficava quase vazio (um Select e um botão dentro de 85% da tela);
 *   2. o que o sheet DECIDE — quem passa a responder por quais casos — não
 *      aparecia em lugar nenhum.
 * Agora o cabeçalho declara o alcance ("2 de 3 cirurgias mudam de dono"), cada
 * colega vem com onde ele está agora (posição na fila e cirurgias no turno) e o
 * rodapé repete o efeito inteiro antes de confirmar. Escolher passou de dois
 * toques (abrir o Select, escolher) para um.
 */
import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button, Switch, Input } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { HOSPITAL_LABEL, useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { fraseClinica, nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import {
  alvosTrocaResponsavel, anestesistaDaSala, anestesistaDoCasoEh, filtrarPorTurno, localizarSlotRodape,
  nomeAnestesistaExibicao, normNome, rodapeDoTurno, salaExibicao,
} from './utils'

const primeiroNomeUpper = (nome) => String(nome || '').trim().split(/\s+/)[0]?.toUpperCase() || ''

// Sentinela: "deixar sem anestesista" (valor impossível como uid).
const SEM_ANESTESISTA = '__sem__'
const TURNO_LABEL = { matutino: 'Matutino', vespertino: 'Vespertino' }

export default function DefinirAnestesistaSheet({ escala, sala, casosAlvo = null, turno = null, onClose }) {
  const { user } = useUser()
  const { setAnestesistaCasos, executarSubstituicao } = useEscalaCirurgicaActions()
  const { options: rosterOpcoes, rosterByUid, resolver, loading: rosterLoading } = useRosterAnestesistas()
  const [uidEscolhido, setUidEscolhido] = useState('')
  const [uidSegundo, setUidSegundo] = useState('') // dupla na MESMA cirurgia
  const [abrirSegundo, setAbrirSegundo] = useState(false)
  // A LISTA NASCE FECHADA (dono 17/08): quem abre é o card ASSUME. Sem ninguém
  // escolhido ela já abre — não há o que mostrar no lugar dela.
  const [abrirLista, setAbrirLista] = useState(false)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [assumirPosicao, setAssumirPosicao] = useState(false)

  // MODO SALA opera SÓ no turno exibido (bug 31/07): a sala existe nos dois
  // turnos e o sheet consultava os casos do DIA INTEIRO — "Responsável atual"
  // mostrava o dono da MANHÃ com o board na tarde (CC-Sala 3: header
  // "Paulo + Guilherme", sheet "Aline"), e o repasse alcançaria caso
  // não-terminado do outro turno. Sem turno (chamada legada) = dia inteiro.
  const casosTurno = useMemo(() => filtrarPorTurno(escala?.casos || [], turno), [escala, turno])

  // casosAlvo explícito (grupo por anestesista / caso do detalhe) → alvos são
  // exatamente eles (não-terminados); senão modo SALA = TODOS os casos não-terminados
  // da sala NO TURNO (pedido do dono 24/07 — terminados mantêm quem os fez).
  const { alvos } = useMemo(() => {
    if (casosAlvo?.length) {
      return { alvos: casosAlvo.filter((c) => (c.statusCirurgia || 'agendada') !== 'terminada') }
    }
    return alvosTrocaResponsavel(casosTurno, sala)
  }, [casosTurno, sala, casosAlvo])

  // O QUE NÃO MUDA: cirurgia terminada mantém quem a fez. Era a parte invisível
  // da decisão — quem repassava a sala não sabia que uma das linhas ficava para
  // trás, e só descobria olhando o quadro depois.
  const naoMudam = useMemo(() => {
    const base = casosAlvo?.length ? casosAlvo : casosTurno.filter((c) => c.sala === sala)
    return base.filter((c) => (c.statusCirurgia || 'agendada') === 'terminada')
  }, [casosAlvo, casosTurno, sala])

  const atual = useMemo(() => {
    const ref = casosAlvo?.[0]
    if (ref) {
      const alias = String(ref.anestesista || '').trim()
      return { alias, uid: ref.anestesistaUserId || (alias ? resolver(alias) : null) }
    }
    const direto = anestesistaDaSala(casosTurno, sala)
    const alias = direto.alias || casosTurno.find((c) => c.sala === sala && c.anestesista)?.anestesista || ''
    return { alias, uid: direto.uid || (alias ? resolver(alias) : null) }
  }, [casosTurno, sala, casosAlvo, resolver])

  // Nome mostrado = MESMA função do cabeçalho da sala na Completa (bug 29/07: o
  // cabeçalho vinha do cadastro e este texto vinha do alias importado, então
  // "Guilherme Staub" no cabeçalho e "Staub" aqui — o dono leu como duas pessoas).
  const nomeAtual = useMemo(
    () => nomeAnestesistaExibicao({ uid: atual.uid, alias: atual.alias, rosterByUid }),
    [atual, rosterByUid]
  )

  // ONDE CADA COLEGA ESTÁ AGORA — o que faz a lista valer mais que um Select:
  // a posição dele na fila deste turno e quantas cirurgias já carrega aqui.
  // Leitura pura; nada disto escreve (a `ordem_liberacao` segue intocada).
  const contextoDe = useMemo(() => {
    const rodape = rodapeDoTurno(escala?.ordemLiberacao, turno || 'matutino')
    return (r) => {
      const casa = (nome) => resolver?.(nome) === r.uid
        || normNome(nome) === normNome(r.nome)
        || (r.apelidos || []).some((a) => normNome(a) === normNome(nome))
      const idx = rodape.findIndex(casa)
      const nCasos = casosTurno.filter((c) => anestesistaDoCasoEh(c, { uid: r.uid, alias: r.apelidos?.[0] || r.nome })).length
      return [
        idx >= 0 ? `${idx + 1}º na fila` : null,
        nCasos ? `${nCasos} ${nCasos === 1 ? 'cirurgia' : 'cirurgias'}` : null,
      ].filter(Boolean).join(' · ')
    }
  }, [escala, turno, casosTurno, resolver])

  const jaSemAnestesista = !!alvos.length && alvos.every((c) => c.semAnestesista)
  // O seletor nasce VAZIO quando já existe responsável: repetir o nome de quem
  // está lá, com "Confirmar" desabilitado, era o botão morto do print de 29/07.
  const escolhido = uidEscolhido || (jaSemAnestesista ? SEM_ANESTESISTA : '')
  const casoUnico = casosAlvo?.length === 1 ? casosAlvo[0] : null

  // LISTA filtrada pela busca — o roster passa de 45 pessoas e rolar tudo com o
  // dedo no meio do plantão é pior que digitar duas letras.
  const lista = useMemo(() => {
    const q = normNome(busca)
    return (rosterOpcoes || []).filter((o) => {
      if (!q) return true
      const r = rosterByUid.get(o.value)
      return normNome(o.label).includes(q) || (r?.apelidos || []).some((a) => normNome(a).includes(q))
    })
  }, [rosterOpcoes, rosterByUid, busca])

  const pergunta = casoUnico
    ? 'Quem responde por esta cirurgia?'
    : `Quem responde pela ${salaExibicao(sala)}?`
  // Contexto do alvo. "agora com X" NÃO é decoração: é o que denunciou o bug de
  // 31/07 (com o board na tarde, o sheet mostrava o dono da MANHÃ). Some com o
  // nome daqui e a divergência de turno volta a ser invisível.
  const contexto = [
    TURNO_LABEL[turno],
    HOSPITAL_LABEL?.[escala?.hospital],
    casoUnico
      ? [casoUnico.hora, nomeCirurgiaoCurto(titleCaseNome(casoUnico.cirurgiao))].filter(Boolean).join(' · ')
      : null,
    nomeAtual ? `agora com ${nomeAtual}` : null,
  ].filter(Boolean).join(' · ')
  const rotulo = casoUnico
    ? `${salaExibicao(sala)}${casoUnico.cirurgiao ? ` · ${nomeCirurgiaoCurto(casoUnico.cirurgiao)}` : ''}`
    : `${salaExibicao(sala)}${casosAlvo?.length && atual.alias ? ` — ${nomeAtual}` : ''} (${alvos.length} caso${alvos.length === 1 ? '' : 's'})`

  // POSIÇÃO NA FILA (dono 30/07): quando o responsável ANTERIOR ocupa posição no
  // rodapé, definir um novo responsável pode herdar também a posição — foi o
  // buraco do caso Giovana↔Maurício (ela assumiu os casos e virou linha extra
  // "primeira a ser liberada" em vez de ocupar a posição dele). O toggle escreve
  // `assumidaPor` no slot (a ordem_liberacao NUNCA é escrita) JUNTO da troca de
  // casos — os dois efeitos ou nenhum (executarSubstituicao compensa falha).
  const slotAnterior = useMemo(() => {
    if (!atual.uid && !atual.alias) return null
    const r = atual.uid ? rosterByUid.get(atual.uid) : null
    // SÓ o turno da tela (turnos independentes, dono 13/08): posição da manhã
    // não é assumível a partir da tarde. Achar o slot do outro turno e gravar
    // lá punha o assumidaPor numa chave que o rodapé exibido não continha
    // (defeito D3, 07/08 — o cruzamento era a raiz, não só o turno da escrita)
    return localizarSlotRodape(escala, { uid: atual.uid, nome: r?.nome || atual.alias }, resolver, turno)
  }, [escala, atual, rosterByUid, resolver, turno])
  const ofereceAssumir = !!slotAnterior && !!escolhido && escolhido !== SEM_ANESTESISTA && escolhido !== atual.uid

  // DUPLA NA MESMA CIRURGIA (dono 11/08). Duas pessoas não cabem num uid: o
  // texto "A + B" É o dado — a Completa mostra as duas no cabeçalho, a fila
  // conta presença das duas e nenhuma transferência mexe em sala compartilhada.
  // Só no modo CASO: dupla é da CIRURGIA, não da sala (sala com anestesistas
  // diferentes em cirurgias diferentes segue com um bloco para cada, 27/07).
  const podeDupla = !!casoUnico && !!escolhido && escolhido !== SEM_ANESTESISTA
  const opcoesSegundo = useMemo(
    () => [{ value: '', label: 'Só um anestesista' }, ...(rosterOpcoes || []).filter((o) => o.value !== escolhido)],
    [rosterOpcoes, escolhido]
  )
  const segundo = podeDupla && uidSegundo ? rosterByUid.get(uidSegundo) : null
  const apelidoDe = (r) => r?.apelidos?.[0] || primeiroNomeUpper(r?.nome)
  const nomeEscolhido = escolhido && escolhido !== SEM_ANESTESISTA
    ? nomeAnestesistaExibicao({ uid: escolhido, alias: '', rosterByUid })
    : ''

  const confirmar = async () => {
    const semAnest = escolhido === SEM_ANESTESISTA
    const r = semAnest ? null : rosterByUid.get(escolhido)
    if (!semAnest && !r) return
    setSalvando(true)
    try {
      if (segundo) {
        // a posição na fila NÃO é oferecida junto: com dois donos não existe um
        // slot único a assumir — quem trocou de posição resolve pelo ✏️/Troca.
        await setAnestesistaCasos(
          escala,
          alvos.map((c) => c.id),
          { uid: null, apelido: `${apelidoDe(r)} + ${apelidoDe(segundo)}`, dupla: true },
          { rotulo }
        )
      } else if (!semAnest && assumirPosicao && ofereceAssumir) {
        const rAtual = atual.uid ? rosterByUid.get(atual.uid) : null
        await executarSubstituicao({
          lados: [{
            hospital: escala.hospital, escalaId: escala.id,
            // o turno da ESCRITA é o do slot achado, nunca o da tela (D3)
            turno: slotAnterior.turno || turno,
            chaveSlot: slotAnterior.chave, nomeSlot: slotAnterior.nome,
            tipo: 'assuncao',
            de: { uid: atual.uid || null, nome: rAtual?.nome || atual.alias, apelido: atual.alias || slotAnterior.nome },
            para: { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome) },
            casoIds: alvos.map((c) => c.id).filter(Boolean),
          }],
          limparTroca: [],
        }, { userId: user?.uid || user?.id || null })
      } else {
        await setAnestesistaCasos(
          escala,
          alvos.map((c) => c.id),
          semAnest ? { uid: null, apelido: '?' } : { uid: r.uid, apelido: r.apelidos?.[0] || primeiroNomeUpper(r.nome) },
          { rotulo }
        )
      }
      onClose?.()
    } catch { /* toast de erro já vem do context */ } finally {
      setSalvando(false)
    }
  }

  // Resumo do lado que SAI: quantas cirurgias ele tem aqui e quantas ficam com
  // ele por já terem terminado.
  const totalLado = alvos.length + naoMudam.length
  const resumoSai = [
    totalLado ? `${totalLado} ${totalLado === 1 ? 'cirurgia' : 'cirurgias'}` : 'sem cirurgia',
    naoMudam.length ? `${naoMudam.length} terminada${naoMudam.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ')
  const contextoEscolhido = escolhido && escolhido !== SEM_ANESTESISTA
    ? contextoDe(rosterByUid.get(escolhido) || { uid: escolhido, nome: nomeEscolhido })
    : ''

  const listaAberta = abrirLista || !escolhido

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      {/* o painel acompanha o conteúdo: o default do DS fixa 85% da tela e era
          justamente o que fazia este sheet parecer vazio (dono 17/08) */}
      <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
        <SheetHeader className="pb-2">
          <div className="flex items-center gap-2">
            {!casoUnico && (
              <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-primary-foreground">
                {salaExibicao(sala)}
              </span>
            )}
            <SheetTitle className="text-[17px] leading-tight">{pergunta}</SheetTitle>
          </div>
          {contexto && <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{contexto}</p>}
        </SheetHeader>

        <div className="px-1 pb-4">
          {/* ── DE → PARA (dono 17/08): quem sai e quem assume lado a lado, no
              topo, logo abaixo do título. O card ASSUME É o seletor — abre a
              lista aqui dentro, sem Select e sem sheet por cima de sheet. ── */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5">
            <div className="flex min-h-[58px] flex-col justify-center gap-px rounded-2xl border border-border-strong px-2.5 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sai</span>
              <span className="text-[15px] font-bold leading-tight [overflow-wrap:anywhere]">{nomeAtual || '—'}</span>
              <span className="text-[11px] text-muted-foreground">{resumoSai}</span>
            </div>
            <ChevronRight className="h-4 w-4 self-center text-muted-foreground" />
            <button
              type="button"
              aria-expanded={listaAberta}
              onClick={() => setAbrirLista((v) => !v)}
              className="flex min-h-[58px] items-center gap-1.5 rounded-2xl border border-primary bg-primary/[0.08] px-2.5 py-1.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assume</span>
                <span className={[
                  'block text-[15px] font-bold leading-tight [overflow-wrap:anywhere]',
                  escolhido ? '' : 'text-primary',
                ].join(' ')}>
                  {escolhido === SEM_ANESTESISTA ? 'Sem anestesista' : (nomeEscolhido || 'Escolher…')}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {escolhido ? (contextoEscolhido || 'toque para trocar') : 'toque para ver a lista'}
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-primary transition-transform ${listaAberta ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {listaAberta ? (
            <>
              {!rosterLoading && (
                <div className="mt-2">
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar anestesista…"
                    aria-label="Buscar anestesista"
                    leftIcon={<Search className="h-4 w-4" />}
                  />
                </div>
              )}
              {rosterLoading ? (
                <p className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando roster…
                </p>
              ) : (
                <div role="listbox" aria-label="Escolher anestesista" className="mt-1">
                  {/* "Sem anestesista" (pedido do dono 26/07): deixar a sala/caso
                      descoberto de propósito — vira "?" e volta ao alerta da fila. */}
                  <OpcaoColega
                    nome="Sem anestesista (?)"
                    contexto="a sala volta ao alerta da fila"
                    escolhido={escolhido === SEM_ANESTESISTA}
                    onClick={() => { setUidEscolhido(SEM_ANESTESISTA); setAbrirLista(false) }}
                  />
                  {lista.map((o) => (
                    <OpcaoColega
                      key={o.value}
                      nome={o.label}
                      contexto={contextoDe(rosterByUid.get(o.value) || { uid: o.value, nome: o.label })}
                      escolhido={escolhido === o.value}
                      onClick={() => { setUidEscolhido(o.value); setAbrirLista(false) }}
                    />
                  ))}
                  {!lista.length && (
                    <p className="px-1 py-4 text-sm text-muted-foreground">Ninguém com esse nome no roster.</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* ── O QUE MUDA DE MÃOS ─────────────────────────────────────── */}
              <p className="mb-1 mt-3 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                Procedimentos assumidos
              </p>
              {alvos.map((c) => (
                <div key={c.id} className="flex items-baseline gap-2 border-b border-border py-1.5 text-[12.5px] last:border-b-0">
                  <b className="tabular-nums">{c.hora || '—'}</b>
                  {c.pacienteIniciais && <span>{c.pacienteIniciais}</span>}
                  <span className="min-w-0 truncate">{fraseClinica(c.procedimento)}</span>
                </div>
              ))}
              {!alvos.length && (
                <p className="py-1.5 text-[12.5px] text-muted-foreground">
                  Nada a passar: as cirurgias já terminaram e mantêm quem as fez.
                </p>
              )}
              {naoMudam.map((c) => (
                <div key={c.id} className="flex items-baseline gap-2 border-b border-border py-1.5 text-[12.5px] text-muted-foreground last:border-b-0">
                  <b className="tabular-nums">{c.hora || '—'}</b>
                  {c.pacienteIniciais && <span>{c.pacienteIniciais}</span>}
                  <span className="min-w-0 truncate line-through">{fraseClinica(c.procedimento)}</span>
                </div>
              ))}
              {naoMudam.length > 0 && (
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {naoMudam.length === 1 ? `A das ${naoMudam[0].hora} já terminou` : `${naoMudam.length} já terminaram`}
                  : fica{naoMudam.length === 1 ? '' : 'm'} com {nomeAtual || 'quem fez'}.
                </p>
              )}

              {/* DUPLA na mesma cirurgia (dono 11/08) — só no modo CASO. No modo
                  SALA a linha nem existe: "só no modo cirurgia" era uma frase que
                  não dizia nada a quem estava olhando (dono 17/08). */}
              {podeDupla && (
                <>
                  <button
                    type="button"
                    onClick={() => setAbrirSegundo((v) => !v)}
                    className="flex min-h-[48px] w-full items-center gap-2 border-t border-border py-2 text-left"
                  >
                    <span className="text-[14.5px] font-semibold">Dois anestesistas nesta cirurgia</span>
                    <span className="ml-auto text-[11.5px] text-muted-foreground">
                      {segundo ? nomeAnestesistaExibicao({ uid: segundo.uid, alias: '', rosterByUid }) : 'não'}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${abrirSegundo ? 'rotate-180' : ''}`} />
                  </button>
                  {abrirSegundo && (
                    <div className="mb-2 rounded-xl border border-border bg-muted/30 p-3">
                      <Select
                        className="w-full"
                        searchable
                        options={opcoesSegundo}
                        value={uidSegundo}
                        onChange={setUidSegundo}
                        placeholder="Só um anestesista"
                      />
                      <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                        A cirurgia fica com os dois no cabeçalho da Completa e conta presença dos dois na fila.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Posição na fila junto com os casos (dono 30/07): sem isto quem
                  assume vira linha EXTRA no fim da fila — o caso Giovana↔Maurício. */}
              {ofereceAssumir && !segundo && (
                <div className="border-t border-border py-3">
                  <Switch
                    checked={assumirPosicao}
                    onChange={setAssumirPosicao}
                    label={`Assumir também a posição de ${nomeAtual} na fila`}
                    size="sm"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {!listaAberta && (
          <div className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-card px-1 pb-4 pt-3">
            <Button variant="outline" className="flex-1" onClick={() => onClose?.()}>Cancelar</Button>
            <Button
              className="flex-1"
              disabled={salvando || !escolhido || escolhido === atual.uid || !alvos.length}
              onClick={confirmar}
            >
              {salvando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : segundo ? 'Confirmar os dois anestesistas'
                  : escolhido === SEM_ANESTESISTA ? 'Deixar sem anestesista'
                    : 'Confirmar responsável'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/** Linha full-bleed de colega: nome em cima, onde ele está agora embaixo. */
function OpcaoColega({ nome, contexto, escolhido, onClick }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={escolhido}
      onClick={onClick}
      className={[
        'flex min-h-[52px] w-full items-center gap-2 border-b border-border px-2 py-2 text-left transition-colors',
        escolhido ? 'bg-primary/10' : 'active:bg-muted/60',
      ].join(' ')}
    >
      <span className="min-w-0 flex-1">
        {/* nome de pessoa não abrevia: quebra */}
        <span className="block text-[15px] font-bold leading-tight [overflow-wrap:anywhere]">{nome}</span>
        {contexto && <span className="block text-[11.5px] text-muted-foreground">{contexto}</span>}
      </span>
      {escolhido && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  )
}
