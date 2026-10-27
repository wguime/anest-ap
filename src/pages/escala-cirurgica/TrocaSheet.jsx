/**
 * TrocaSheet — o ÚNICO fluxo de troca do app (dono 07/08: "as trocas num só
 * local, fáceis de executar e intuitivas").
 *
 * TRÊS PASSOS (dono 27/10, modelo escolhido em `.tmp/auditoria-liberacoes/edicao-liberacoes.html`):
 * em outubro, 16 das 66 posições assumidas à mão foram desfeitas, seis delas em até um
 * minuto — a folha abria vazia ("Trocou com quem?") e só depois de escolher dizia o que
 * ia mexer. Agora:
 *   1. O QUE ACONTECEU, em palavras da equipe, com o efeito escrito em cada opção:
 *      trocou de lugar com um colega (os dois mudam, inclusive entre hospitais) · um
 *      colega SEM escala entra no lugar · a escala já saiu trocada, só registrar;
 *   2. COM QUEM, com a posição e a sala de cada colega (`ondeEstaNoTurno`), e só os que
 *      fazem sentido para a opção — quem está em outra escala não "entra no lugar" de
 *      ninguém (é troca dos dois lados, o caso Garim/Janaína de 27/10);
 *   3. COMO A FILA FICA, nos dois hospitais, antes de gravar, com o botão dizendo o
 *      que acontece. É a confirmação: o pop-up de 18/08 saiu.
 *
 * ⚠️ A DECISÃO CONTINUA SENDO DE QUEM TOCA, nunca suposta (dono 09–10/08): a escala
 * costuma sair JÁ trocada, e mover nessa hora desfaz a troca real — por isso o
 * "só registrar" (`trocaCom.apenasRegistro`) é uma opção explícita do passo 1.
 * Registro NÃO é declaração pendente: a convergência da importação o ignora.
 *
 * O motor é o mesmo: `planoExecucaoTroca` acha as posições em jogo e
 * `executarSubstituicao` grava (assumidaPor + casos em aberto, os lados juntos).
 * O tipo é INFERIDO pela geografia dos slots. ordem_liberacao NUNCA é escrita — a
 * identidade do slot muda via linha_overrides (invariante de 30/07).
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeftRight, ClipboardCheck, Info, Loader2, LogOut, Search } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, Select, Button, Input } from '@/design-system'
import { useUser } from '@/contexts/UserContext'
import { useEscalaCirurgica, useEscalaCirurgicaActions, HOSPITAL_LABEL } from '@/contexts/EscalaCirurgicaContext'
import useRosterAnestesistas from '@/hooks/useRosterAnestesistas'
import { nomeCirurgiaoCurto, titleCaseNome } from '@/lib/colunaLiberacao'
import { hhmmDe } from '@/lib/escalaHorarioReal'
import { planoExecucaoTroca, ondeEstaNoTurno, rodapeDoTurno, estadoDaPosicao, normNome } from './utils'

export const MOTIVO_MAX = 80

export const TIPO_LABEL = {
  entre_hospitais: 'Troca entre hospitais',
  posicoes: 'Troca de posições',
  entre_turnos: 'Troca entre turnos',
  assuncao: 'Colega de fora assume',
}

/** Onde o colega está quando não aparece em escala nenhuma do dia (dono 13/08:
 *  "o colega pode estar no consultório, Materno, e não há essas opções"). É só
 *  o RASTRO — nada a mover — mas é o que responde "cadê o Fulano" para quem lê
 *  a fila depois. Materno entra porque a escala de lá pode ainda não ter saído. */
export const LOCAL_COLEGA_OPCOES = [
  { value: 'Consultório', label: 'Consultório' },
  { value: 'Materno', label: 'Materno' },
  { value: 'Sobreaviso', label: 'Sobreaviso' },
  { value: 'Folga', label: 'Folga' },
  { value: 'Outro local', label: 'Outro local' },
]

const ladoId = (l) => `${l.escalaId}:${l.chaveSlot}`
const curto = (nome) => nomeCirurgiaoCurto(titleCaseNome(nome)) || nome
const horaDe = (iso) => (iso ? hhmmDe(new Date(iso)) : null)
const hospLabel = (h) => HOSPITAL_LABEL[h] || h
/** "do HRO", "da Unimed", "do Materno" — sem artigo errado no hospital. */
const doHosp = (h) => `${h === 'unimed' ? 'da' : 'do'} ${hospLabel(h)}`
const semNota = (n) => String(n || '').replace(/\s*\([^)]*\)\s*$/, '').trim()

/**
 * A POSIÇÃO COMO ELA ESTÁ AGORA (dono 23/10, modelo A de `.tmp/troca-posicao-ja-liberada.html`).
 * A troca de 10:53 gravou "Cristina assume" por cima do Klisman, que estava na posição
 * desde 09:02 e já tinha sido liberado às 10:46. A prévia diz quem ocupa e se já saiu.
 * Sem artigo antes do nome: o app não sabe o gênero de ninguém.
 * @returns {{ situacao: string, quemSai: object, resultado: string }|null}
 */
function avisoDaPosicao(l) {
  if (l.semPosicao || (!l.ocupadoPor && !l.liberadoEm)) return null
  const quemSai = l.ocupadoPor || l.de
  const sai = curto(quemSai.nome)
  const chega = curto(l.para.nome)
  const situacao = [
    l.ocupadoPor && `com ${sai}${horaDe(l.ocupadoPor.em) ? ` desde ${horaDe(l.ocupadoPor.em)}` : ''}`,
    l.liberadoEm && `saiu às ${horaDe(l.liberadoEm)}`,
  ].filter(Boolean).join(' · ')
  const posicao = l.posicao ? `${l.posicao}ª posição` : 'posição'
  if (l.liberadoEm) {
    return {
      situacao, quemSai,
      resultado: `${sai} já saiu desta posição (${situacao}). ${chega} recebe a ${posicao} já liberada e ${sai} continua com a liberação. Se ${chega} for trabalhar, acione pelo card.`,
    }
  }
  return { situacao, quemSai, resultado: `A ${posicao} está ${situacao}: ${sai} deixa a posição e ${chega} assume.` }
}

/** Infere o tipo pela GEOGRAFIA dos slots do par (taxonomia do dono 07/08).
 *  Olha as posições que EXISTEM, não quem se move: numa troca já publicada
 *  ninguém muda de lugar e ainda assim é troca entre hospitais. */
export function inferirTipoTroca(plan) {
  const lados = plan?.lados || []
  if (!lados.length) return null
  if (lados.length === 1) return 'assuncao'
  const hospitais = new Set(lados.map((l) => l.hospital))
  if (hospitais.size > 1) return 'entre_hospitais'
  const turnos = new Set(lados.map((l) => l.turno).filter(Boolean))
  if (turnos.size > 1) return 'entre_turnos'
  return 'posicoes'
}

/** Barra de progresso dos três passos. */
function Passos({ atual }) {
  return (
    <div className="mb-1 flex gap-1.5" aria-hidden="true">
      {[1, 2, 3].map((p) => (
        <span key={p} className={['h-1 flex-1 rounded-full', p <= atual ? 'bg-primary' : 'bg-muted'].join(' ')} />
      ))}
    </div>
  )
}

/**
 * Fila de UM hospital na prévia: as posições que mudam, com o vizinho de cima e o de
 * baixo para dar o contexto ("…" onde a lista pula).
 */
function FilaPrevia({ hospital, esc, lados, resolver }) {
  const turno = lados[0]?.turno || null
  const rodape = rodapeDoTurno(esc?.ordemLiberacao, turno)
  const porPos = new Map(lados.filter((l) => l.posicao).map((l) => [l.posicao, l]))
  const mostrar = new Set()
  for (const p of porPos.keys()) [p - 1, p, p + 1].forEach((x) => { if (x >= 1 && x <= rodape.length) mostrar.add(x) })
  const posicoes = [...mostrar].sort((x, y) => x - y)
  const semPos = lados.filter((l) => !l.posicao)
  // o vizinho é quem OCUPA a vaga hoje (a posição pode ter sido assumida numa troca),
  // não o nome escrito no rodapé
  const ocupante = (nome) => {
    const chave = resolver?.(semNota(nome)) || normNome(nome)
    const asm = estadoDaPosicao(esc, turno, chave).ocupadoPor
    return asm ? curto(asm.nome) : titleCaseNome(semNota(nome))
  }
  return (
    <div data-fila-previa={hospital} className="min-w-0 rounded-xl border border-border px-2.5 py-2">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{hospLabel(hospital)}</p>
      {posicoes.map((p, i) => {
        const l = porPos.get(p)
        const pulo = i > 0 && p - posicoes[i - 1] > 1
        return (
          <div key={p}>
            {pulo && <p className="pl-6 text-[12px] text-muted-foreground">…</p>}
            {l ? (
              // a linha que muda em DUAS: quem entra (forte) e quem sai (riscado) — numa
              // coluna de ~190px "Rodnei Lima → Rafael P…" truncava justo o nome novo
              <div className="-mx-1 rounded-md bg-warning/20 px-1 py-0.5">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
                  <span className="w-6 shrink-0 text-right text-muted-foreground">{p}º</span>
                  <span className="min-w-0 truncate">{curto(l.para.nome)}</span>
                </p>
                <p className="pl-[30px] text-[11.5px] text-muted-foreground">
                  sai <s>{curto((l.ocupadoPor || l.de).nome)}</s>
                </p>
              </div>
            ) : (
              <p className="flex min-h-6 items-center gap-1.5 text-[12.5px]">
                <span className="w-6 shrink-0 text-right font-semibold text-muted-foreground">{p}º</span>
                <span className="min-w-0 truncate">{ocupante(rodape[p - 1])}</span>
              </p>
            )}
          </div>
        )
      })}
      {semPos.map((l) => (
        <p key={ladoId(l)} className="text-[12.5px] leading-snug">
          Cirurgias de <s className="text-muted-foreground">{curto(l.de.nome)}</s> → <b>{curto(l.para.nome)}</b>
          <span className="text-muted-foreground"> · sem fila de liberação</span>
        </p>
      ))}
    </div>
  )
}

export default function TrocaSheet({ linha, escala, turno, colegaInicial = null, opcaoInicial = null, modo = null, onClose }) {
  const { user } = useUser()
  const { escalas } = useEscalaCirurgica()
  const { marcarTroca, executarSubstituicao } = useEscalaCirurgicaActions()
  const { roster, rosterByUid, resolver } = useRosterAnestesistas()

  // pessoa A = dona da linha de origem (uid do vínculo > resolução do rodapé)
  const a = useMemo(() => {
    const uid = linha?.uid || resolver(linha?.nomeOriginal || linha?.anestesista || '') || null
    const r = uid ? rosterByUid.get(uid) : null
    return {
      uid,
      nome: r?.nome || linha?.nomeOriginal || linha?.anestesista || '',
      apelido: r?.apelidos?.[0] || String(linha?.nomeOriginal || linha?.anestesista || '').trim().split(/\s+/)[0]?.toUpperCase() || '',
    }
  }, [linha, rosterByUid, resolver])

  // `modo='posicao'` (legado das duas entradas) = a opção "trocou de lugar"; reabrir de
  // uma troca JÁ registrada traz o colega e cai direto na prévia.
  const opcaoPartida = opcaoInicial || (modo === 'posicao' ? 'troca' : null)
  const [opcao, setOpcao] = useState(opcaoPartida)
  const [uidColega, setUidColega] = useState(colegaInicial || '')
  const [passo, setPasso] = useState(opcaoPartida && colegaInicial ? 3 : opcaoPartida ? 2 : 1)
  const [busca, setBusca] = useState('')
  const [motivo, setMotivo] = useState('')
  const [local, setLocal] = useState('') // onde o colega está, quando não há escala dele
  const [salvando, setSalvando] = useState(false)

  const ondeDe = (pessoa) => ondeEstaNoTurno({ escalas, resolverUid: resolver, pessoa, turno })
  const ondeA = useMemo(() => (a.uid || a.nome ? ondeDe(a) : []), [escalas, resolver, a, turno]) // eslint-disable-line react-hooks/exhaustive-deps
  const posA = ondeA.find((o) => o.hospital === escala?.hospital) || ondeA[0] || null

  const b = useMemo(() => {
    const r = uidColega ? rosterByUid.get(uidColega) : null
    if (!r) return null
    return { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || String(r.nome).trim().split(/\s+/)[0]?.toUpperCase() || '' }
  }, [uidColega, rosterByUid])

  // COLEGAS (passo 2): onde cada um está agora e se serve para a opção escolhida
  const colegas = useMemo(() => {
    if (passo !== 2) return []
    return (roster || [])
      .filter((r) => r.uid && r.uid !== a.uid)
      .map((r) => {
        const pessoa = { uid: r.uid, nome: r.nome, apelido: r.apelidos?.[0] || '' }
        return { ...pessoa, apelidos: r.apelidos || [], onde: ondeDe(pessoa) }
      })
  }, [passo, roster, a.uid, escalas, resolver, turno]) // eslint-disable-line react-hooks/exhaustive-deps

  const elegibilidade = (c) => {
    const temEscala = c.onde.length > 0
    if (opcao === 'troca' && !temEscala) return 'Sem escala neste turno: use "Um colega entra no lugar".'
    if (opcao === 'entra' && temEscala) return `Está na escala ${doHosp(c.onde[0].hospital)}: use "trocou de lugar".`
    return null
  }
  const ordemHosp = [escala?.hospital, 'unimed', 'hro', 'materno'].filter((h, i, arr) => h && arr.indexOf(h) === i)
  const grupos = useMemo(() => {
    const q = normNome(busca)
    const lista = colegas.filter((c) => !q || normNome(c.nome).includes(q) || c.apelidos.some((ap) => normNome(ap).includes(q)))
    const porGrupo = new Map()
    for (const c of lista) {
      const g = c.onde[0]?.hospital || 'sem'
      if (!porGrupo.has(g)) porGrupo.set(g, [])
      porGrupo.get(g).push(c)
    }
    const chaves = [...ordemHosp.filter((h) => porGrupo.has(h)), ...[...porGrupo.keys()].filter((g) => g !== 'sem' && !ordemHosp.includes(g)), ...(porGrupo.has('sem') ? ['sem'] : [])]
    return chaves.map((g) => ({
      g,
      titulo: g === 'sem' ? 'Sem escala neste turno' : `Escala ${doHosp(g)}`,
      itens: porGrupo.get(g).sort((x, y) => (x.onde[0]?.posicao || 99) - (y.onde[0]?.posicao || 99) || x.nome.localeCompare(y.nome)),
    }))
  }, [colegas, busca, opcao]) // eslint-disable-line react-hooks/exhaustive-deps

  // PLANO EM MODO SECO — nada é escrito aqui; cada lado é uma POSIÇÃO em jogo
  const plan = useMemo(
    // âncora = a escala de onde a troca foi aberta: a posição de `a` em jogo é
    // a DESTA tela (dono 13/08 — a Karine no Materno trazia junto o HRO)
    () => (b ? planoExecucaoTroca({ escalas, resolverUid: resolver, a, b, turno, escalaAncora: escala?.id || null }) : null),
    [escalas, resolver, a, b, turno, escala?.id],
  )
  const ehDoColega = (l) => (l.de.uid && b?.uid ? l.de.uid === b.uid : normNome(l.de.nome) === normNome(b?.nome || ''))
  const slots = plan?.lados || []
  // "entra no lugar": só a posição de A muda de dono; "trocou": todas as do par. A
  // posição de A vem primeiro: a prévia começa por quem assume o lugar de quem abriu.
  const ladosEfetivos = (opcao === 'registro' ? [] : opcao === 'entra' ? slots.filter((l) => !ehDoColega(l)) : slots)
    .slice().sort((x, y) => ehDoColega(x) - ehDoColega(y))
  const colegaSemEscala = !!b && !slots.some((l) => ehDoColega(l) && (!turno || l.turno === turno))
  const semVinculo = (plan?.pendencias || []).filter((p) => p.motivo === 'sem_uid')

  const tipoEfetivo = opcao === 'entra' ? 'assuncao' : inferirTipoTroca(plan)
  const meta = {
    ...(tipoEfetivo && { tipo: tipoEfetivo }),
    ...(motivo.trim() && { motivo: motivo.trim().slice(0, MOTIVO_MAX) }),
    ...(colegaSemEscala && local && { local }),
  }
  const userInfo = { userId: user?.uid || user?.id || null, userName: user?.displayName }
  const podeGravar = !!b && !salvando && (opcao === 'registro' || ladosEfetivos.length > 0)

  const gravar = async () => {
    if (!podeGravar) return
    setSalvando(true)
    try {
      if (opcao === 'registro') {
        // ninguém muda de lugar: fica só o RASTRO (badge nos dois lados).
        // `apenasRegistro` impede que a convergência da importação execute
        // depois um swap que a própria escala já resolveu.
        await marcarTroca(escala, linha, { uid: b.uid, nome: b.nome, ...meta, apenasRegistro: true }, userInfo, turno)
      } else {
        await executarSubstituicao({
          lados: ladosEfetivos.map((l) => ({ ...l, ...meta })),
          limparTroca: plan?.limparTroca || [],
        }, userInfo)
      }
      onClose?.()
    } catch { /* toast no context */ } finally { setSalvando(false) }
  }

  const A = curto(a.nome)
  const B = b ? curto(b.nome) : ''
  const OPCOES = [
    { id: 'troca', Icone: ArrowLeftRight, titulo: `${A} trocou de lugar com um colega`,
      texto: 'Os dois trocam de posição e levam as cirurgias em aberto. Vale entre hospitais.' },
    { id: 'entra', Icone: LogOut, titulo: `Um colega entra no lugar de ${A}`,
      texto: `Para quem não está em nenhuma escala neste turno (consultório, folga). ${A} sai da fila deste turno.` },
    { id: 'registro', Icone: ClipboardCheck, titulo: 'A escala já saiu com a troca: só registrar',
      texto: 'Ninguém muda de lugar. Aparece o selo Troca nos dois cards.' },
  ]

  // ── prévia (passo 3) ─────────────────────────────────────────────────────────
  const porHospital = new Map()
  for (const l of ladosEfetivos) {
    if (!porHospital.has(l.hospital)) porHospital.set(l.hospital, [])
    porHospital.get(l.hospital).push(l)
  }
  const frasesLados = ladosEfetivos.filter((l) => l.posicao).map((l) => `${curto(l.para.nome)} fica com o ${l.posicao}º ${doHosp(l.hospital)}`)
  const casosMovidos = ladosEfetivos.filter((l) => l.casoIds.length)
    .map((l) => `${l.casoIds.length} ${l.casoIds.length === 1 ? 'cirurgia' : 'cirurgias'} ${doHosp(l.hospital)} para ${curto(l.para.nome)}`)
  const resumo = opcao === 'registro'
    ? `Ninguém muda de lugar. O selo Troca aparece no card de ${A} e de ${B}.`
    : [
      frasesLados.length ? `${frasesLados.join(' e ')}.` : '',
      opcao === 'entra' ? `${A} sai da fila deste turno.` : '',
      casosMovidos.length ? `Vão junto as cirurgias em aberto: ${casosMovidos.join('; ')}.` : 'Nenhuma cirurgia em aberto muda de mãos.',
    ].filter(Boolean).join(' ')
  const viraPlantonista = ladosEfetivos.filter((l) => l.posicao === 1)
  const rotuloGravar = opcao === 'registro' ? 'Registrar a troca'
    : opcao === 'entra' ? `${B} entra no lugar de ${A}` : `Trocar ${A} ⇄ ${B}`

  const tituloPasso = passo === 1 ? `Trocas de ${A}`
    : passo === 2 ? (opcao === 'entra' ? `Quem entra no lugar de ${A}?` : opcao === 'troca' ? `${A} trocou de lugar com…` : `${A} trocou com…`)
      : 'Como a fila fica'

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
        <SheetHeader className="pb-1">
          <Passos atual={passo} />
          <SheetTitle className="flex items-center gap-2 text-[17px]">
            <ArrowLeftRight className="h-5 w-5 shrink-0 text-category-indigo-fg" aria-hidden="true" />
            {tituloPasso}
          </SheetTitle>
          {passo === 1 && posA && (
            <p className="text-[12.5px] text-muted-foreground">
              {posA.posicao ? `${posA.posicao}º na escala ${doHosp(posA.hospital)}` : `Cirurgias ${doHosp(posA.hospital)}`}
              {posA.sala ? ` · ${posA.sala}` : ''}
            </p>
          )}
        </SheetHeader>

        {/* ── PASSO 1: o que aconteceu ─────────────────────────────────────── */}
        {passo === 1 && (
          <div className="space-y-2.5 px-4 pb-2">
            {OPCOES.map(({ id, Icone, titulo, texto }) => (
              <button
                key={id}
                type="button"
                aria-pressed={opcao === id}
                onClick={() => { setOpcao(id); setUidColega('') }}
                className={[
                  'flex w-full gap-3 rounded-2xl border-[1.5px] p-3 text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  opcao === id ? 'border-primary bg-primary/5' : 'border-border active:bg-muted/50',
                ].join(' ')}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-primary">
                  <Icone className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-snug">{titulo}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{texto}</span>
                </span>
              </button>
            ))}
            <p className="flex gap-2 rounded-xl bg-muted px-3 py-2.5 text-[12.5px] leading-snug">
              <Info className="mt-px h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Na dúvida, escreva na <b>Observação</b> do card: ela não muda a fila.</span>
            </p>
            <Button className="min-h-12 w-full" disabled={!opcao} onClick={() => setPasso(2)}>Continuar</Button>
          </div>
        )}

        {/* ── PASSO 2: com quem ─────────────────────────────────────────────── */}
        {passo === 2 && (
          <div className="space-y-1 px-4 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                aria-label="Buscar colega pelo nome"
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pelo nome"
              />
            </div>
            {grupos.map(({ g, titulo, itens }) => (
              <div key={g}>
                <p className="mb-0.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
                {itens.map((c) => {
                  const bloqueio = elegibilidade(c)
                  const escolhido = c.uid === uidColega
                  const [o1, ...outros] = c.onde
                  const onde = o1
                    ? [o1.posicao ? `${o1.posicao}º` : 'cirurgia sem posição', o1.sala, ...outros.map((o) => `também ${hospLabel(o.hospital)}`)].filter(Boolean).join(' · ')
                    : null
                  return (
                    <button
                      key={c.uid}
                      type="button"
                      data-colega={c.uid}
                      aria-pressed={escolhido}
                      disabled={!!bloqueio}
                      onClick={() => setUidColega(c.uid)}
                      className="flex min-h-[52px] w-full items-center gap-2.5 border-b border-border py-1.5 text-left disabled:opacity-45"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold leading-snug">
                          {titleCaseNome(c.nome)}
                          {o1?.posicao === 1 && <span className="ml-1.5 rounded-[8px] bg-primary px-1.5 py-px text-[11px] font-bold text-primary-foreground">Plantonista</span>}
                        </span>
                        {(onde || bloqueio) && (
                          <span className="block text-[12px] leading-snug text-muted-foreground">{bloqueio || onde}</span>
                        )}
                      </span>
                      <span aria-hidden="true" className={[
                        'h-[22px] w-[22px] shrink-0 rounded-full',
                        escolhido ? 'border-[7px] border-primary' : 'border-2 border-muted-foreground/50',
                      ].join(' ')} />
                    </button>
                  )
                })}
              </div>
            ))}
            {!grupos.length && <p className="py-4 text-center text-sm text-muted-foreground">Ninguém com esse nome.</p>}
            <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-card px-4 pb-1 pt-3">
              <Button variant="outline" className="min-h-12 flex-1" onClick={() => setPasso(1)}>Voltar</Button>
              <Button className="min-h-12 flex-1" disabled={!b} onClick={() => setPasso(3)}>Ver como fica</Button>
            </div>
          </div>
        )}

        {/* ── PASSO 3: como a fila fica ─────────────────────────────────────── */}
        {passo === 3 && b && (
          <div className="space-y-2.5 px-4 pb-2">
            {porHospital.size > 0 && (
              <div className={['grid gap-2.5', porHospital.size > 1 ? 'grid-cols-2' : 'grid-cols-1'].join(' ')}>
                {[...porHospital.entries()].map(([h, lados]) => (
                  <FilaPrevia key={h} hospital={h} esc={escalas?.[h]} lados={lados} resolver={resolver} />
                ))}
              </div>
            )}
            <p data-resumo-troca className="text-[13px] leading-relaxed">{resumo}</p>
            {viraPlantonista.map((l) => (
              <p key={ladoId(l)} className="flex gap-2 rounded-xl bg-warning/15 px-3 py-2.5 text-[13px] font-semibold leading-snug text-foreground">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                {curto(l.para.nome)} passa a ser o plantonista {doHosp(l.hospital)}.
              </p>
            ))}
            {ladosEfetivos.map((l) => avisoDaPosicao(l) && (
              <p key={`av-${ladoId(l)}`} className="flex gap-2 text-[12px] leading-snug text-muted-foreground">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {avisoDaPosicao(l).resultado}
              </p>
            ))}
            {opcao !== 'registro' && !ladosEfetivos.length && (
              <p className="text-[12.5px] text-warning">
                {A} não tem posição nem cirurgia em aberto neste turno: não há o que trocar. Use "só registrar".
              </p>
            )}
            {semVinculo.map((p) => (
              <p key={p.pessoa.uid || p.pessoa.nome} className="text-[12px] text-warning">
                {curto(p.pessoa.nome)} está sem vínculo de login — a posição troca, mas os casos não (vincule pelo 🔗).
              </p>
            ))}
            {opcao === 'registro' && colegaSemEscala && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Onde {B} está {turno === 'matutino' ? 'de manhã' : 'à tarde'}
                </p>
                <Select className="w-full" options={LOCAL_COLEGA_OPCOES} value={local} onChange={setLocal} placeholder="Consultório, Materno, folga…" />
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Motivo (opcional)</p>
              <Input value={motivo} maxLength={MOTIVO_MAX} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: plantão trocado, compromisso pessoal" />
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              A ordem publicada não muda: muda quem ocupa cada posição. Dá para desfazer pelo Editar do card.
            </p>
            <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-card px-4 pb-1 pt-3">
              <Button variant="outline" className="min-h-12 flex-1" disabled={salvando} onClick={() => setPasso(2)}>Voltar</Button>
              <Button className="min-h-12 flex-[1.6]" disabled={!podeGravar} onClick={gravar}>
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                {rotuloGravar}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
