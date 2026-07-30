/**
 * CasoDetalheSheet — detalhe do caso COMPARTILHADO pelas abas Completa e Minhas.
 * Fonte única da UI de detalhe/status/troca (antes vivia só no BoardView e a aba
 * Minhas era um beco sem saída — pedido do dono 2026-07-21).
 *
 * Sincronizado AO VIVO: o caso exibido deriva de `escala.casos` (context) — updates
 * otimistas e realtime de outros usuários refletem com o sheet aberto.
 */
import { useMemo, useState } from 'react'
import { GraduationCap, Loader2, MapPin, Timer, UserCog, UserPlus } from 'lucide-react'
import { Button, Input, Select, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import useRosterResidentes from '@/hooks/useRosterResidentes'
import { titleCaseNome } from '@/lib/colunaLiberacao'
import PainelTempo from './PainelTempo'
import { corConvenio, LOCAIS_BASE, normNome, rodapeDoTurno, tipoBadge, turnoDoCaso } from './utils'

const SALA_OUTRO = '__outro__'
// Sentinela do seletor de residente (valor impossível como uid).
const SEM_RESIDENTE = '__sem__'

const STATUS_BOTOES = [
  { valor: 'agendada', label: 'Agendada', ativo: 'default' },
  { valor: 'iniciada', label: 'Iniciada', ativo: 'success' },
  // Button não tem variant azul/roxo — tokens via className
  { valor: 'terminada', label: 'Terminada', ativo: 'default', cls: 'bg-info text-white hover:bg-info/90' },
  { valor: 'atrasada', label: 'Atrasada', ativo: 'warning', extra: true },
  { valor: 'suspensa', label: 'Suspensa', ativo: 'destructive', extra: true },
  { valor: 'passa_tarde', label: 'Passa para tarde', ativo: 'default', extra: true, cls: 'bg-category-purple text-white hover:bg-category-purple/90' },
]

export default function CasoDetalheSheet({ escala, caso, onClose, podeDefinirAnestesista, onDefinirAnestesista, podeEditar }) {
  const { setStatusCirurgia, atualizarCaso, adicionarAjuda, removerAjuda } = useEscalaCirurgicaActions()
  const { options: opcoesResidente, residenteByUid } = useRosterResidentes()
  const isDemo = String(escala?.id).startsWith('demo-')
  const [editandoSala, setEditandoSala] = useState(false)
  const [rascSala, setRascSala] = useState('')
  const [salaOutro, setSalaOutro] = useState(false)
  const [salvandoSala, setSalvandoSala] = useState(false)
  const [salvandoResidente, setSalvandoResidente] = useState(false)
  const [salvandoAjuda, setSalvandoAjuda] = useState(false)
  const [horaExata, setHoraExata] = useState('') // hora exata de término da cirurgia

  // caso VIVO: busca a versão atual no estado (id); cai no prop p/ demo/sem id
  const vivo = useMemo(() => {
    if (!caso) return null
    return (caso.id && (escala?.casos || []).find((c) => c.id === caso.id)) || caso
  }, [escala, caso])

  // Opções de sala/local: salas usadas na escala do dia ∪ base do hospital (IOSC,
  // Umanitá, salas fixas…). "Outro" abre digitação p/ um local ainda não listado.
  const opcoesSala = useMemo(() => {
    const base = LOCAIS_BASE[String(escala?.hospital || '').toLowerCase()] || []
    const doDia = (escala?.casos || []).map((c) => String(c.sala || '').trim()).filter(Boolean)
    const vistos = new Set()
    const out = []
    for (const s of [...doDia, ...base]) {
      const k = s.toLowerCase()
      if (!vistos.has(k)) { vistos.add(k); out.push(s) }
    }
    return out
  }, [escala])

  if (!vivo) return null

  // Um gate só para todos os ajustes do caso: quem edita a escala (canEdit), fora
  // da demo e com o caso já persistido (id) — sem id não há o que atualizar.
  const podeEditarCaso = !!podeEditar && !isDemo && !!vivo.id
  const abrirEditorSala = () => {
    const atual = String(vivo.sala || '')
    setRascSala(atual)
    setSalaOutro(!!atual && !opcoesSala.some((s) => s.toLowerCase() === atual.toLowerCase()))
    setEditandoSala(true)
  }
  const salvarSala = async () => {
    const nova = rascSala.trim()
    if (!nova || nova === String(vivo.sala || '')) { setEditandoSala(false); return }
    setSalvandoSala(true)
    try {
      await atualizarCaso(escala, vivo.id, { sala: nova })
      setEditandoSala(false)
    } catch { /* toast de erro já vem do context */ } finally { setSalvandoSala(false) }
  }

  // RESIDENTE do caso (dono 29/07): acompanha, NÃO responde pelo caso — por isso é
  // seletor próprio e não entra em nenhum caminho de anestesista. Grava uid + nome
  // de exibição, como já é feito com anestesista/anestesistaUserId: com o uid, a aba
  // "Minhas" do residente passa a mostrar os casos dele.
  const residenteNome = vivo.residente
    || (vivo.residenteUserId && residenteByUid.get(vivo.residenteUserId)?.nome)
    || ''
  const trocarResidente = async (valor) => {
    const r = valor === SEM_RESIDENTE ? null : residenteByUid.get(valor)
    if (valor !== SEM_RESIDENTE && !r) return
    setSalvandoResidente(true)
    try {
      await atualizarCaso(escala, vivo.id, {
        residente: r ? r.nome : null,
        residenteUserId: r ? r.uid : null,
      })
    } catch { /* toast de erro já vem do context */ } finally { setSalvandoResidente(false) }
  }

  // TÉRMINO PREVISTO DESTA CIRURGIA (dono 29/07). É o tempo do CASO — o "quanto
  // falta para a pessoa sair" continua sendo o cronômetro da linha, nas Liberações.
  // Este sheet é o mesmo nas duas abas, então preencher aqui atende as duas.
  const definirTerminoCaso = async (hhmm) => {
    try {
      await atualizarCaso(escala, vivo.id, { terminoPrevisto: hhmm || null })
    } catch { /* toast de erro já vem do context */ }
    setHoraExata('')
  }

  // AJUDA à mão pela aba Completa (dono 29/07). A ajuda é do ANESTESISTA, não do
  // caso — mas o detalhe do caso é o lugar menos intrusivo para marcá-la: o
  // cabeçalho da sala já carrega sala + nome + ⚙ + chevron numa linha de 44px a
  // 375px, e um quarto controle ali trunca o nome. Fonte única com as Liberações:
  // as duas escrevem em `ajudaExterna[turno]`, então uma reflete na outra na hora.
  const turnoCaso = turnoDoCaso(vivo)
  const nomeAnest = String(vivo.anestesista || '').trim()
  const entradaAjuda = rodapeDoTurno(escala?.ajudaExterna, turnoCaso)
    .find((n) => normNome(n) === normNome(nomeAnest)) || null
  // sala compartilhada ("A + B") e caso sem dono ("?") não têm um nome só p/ marcar
  const podeMarcarAjuda = podeEditarCaso && !!nomeAnest && !nomeAnest.includes('+') && !/^\?+$/.test(nomeAnest)
  const alternarAjuda = async () => {
    setSalvandoAjuda(true)
    try {
      if (entradaAjuda) await removerAjuda(escala, turnoCaso, entradaAjuda)
      else await adicionarAjuda(escala, turnoCaso, nomeAnest)
    } catch { /* toast de erro já vem do context */ } finally { setSalvandoAjuda(false) }
  }

  // Anestesista DESTE caso, não "o primeiro da sala": `anestesistaDaSala` procura
  // pela SALA e ignora o split por anestesista, então em bloco multi (IOSC/Exames/
  // Umanitá) devolvia o colega. Hoje nenhum chamador de podeDefinirAnestesista lê
  // este argumento, mas deixar a busca errada aqui é armadilha para o próximo.
  const aliasDet = vivo.anestesista || ''
  // Quem pode definir vem de quem renderiza (Completa = toda a equipe que edita;
  // Minhas = os casos já são meus). O caso EM ABERTO deixou de ser exceção em
  // 27/07 — ninguém mais precisa ser dono da sala para assumir.
  const definivel = !!(onDefinirAnestesista && podeDefinirAnestesista?.(vivo.sala, aliasDet))
  // otimista no context (erro reverte + toast lá) — o sheet só dispara
  const mudarStatus = (status) => setStatusCirurgia(escala, vivo, status).catch(() => {})

  return (
    <Sheet open onOpenChange={(o) => !o && onClose?.()}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>{vivo.sala} · {vivo.hora}</SheetTitle>
        </SheetHeader>
        <dl className="px-1 pb-2 space-y-2 text-sm">
          <Linha rotulo="Paciente" valor={vivo.pacienteIniciais} />
          <Linha rotulo="Idade" valor={vivo.idade} />
          <Linha rotulo="Procedimento" valor={vivo.procedimento} />
          <Linha rotulo="Cirurgião" valor={vivo.cirurgiao} />
          <Linha rotulo="Anestesista" valor={vivo.anestesista} destaque />
          {/* leitura p/ quem não edita; quem edita tem o seletor logo abaixo */}
          {!podeEditarCaso && <Linha rotulo="Residente" valor={titleCaseNome(residenteNome)} />}
          <Linha rotulo="Convênio" valor={vivo.convenio && (
            <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${corConvenio(vivo.convenio)?.badge || ''}`}>
              {vivo.convenio}
            </span>
          )} />
          <Linha rotulo="Tempo estimado" valor={vivo.tempoEstimado} />
          <Linha rotulo="Término previsto" valor={vivo.terminoPrevisto} />
          {tipoBadge(vivo.tipo) && <Linha rotulo="Tipo" valor={tipoBadge(vivo.tipo).label} />}
        </dl>

        {/* Trocar SALA/LOCAL do procedimento (pedido do dono 24/07) — corrige onde
            o caso acontece (ex.: mover uma linha lida como HRO para "IOSC - Sala 1").
            O board re-agrupa pela nova sala automaticamente. */}
        {podeEditarCaso && (
          <div className="px-1 pb-3">
            {!editandoSala ? (
              <Button size="sm" variant="outline" className="w-full" onClick={abrirEditorSala}>
                <MapPin className="w-4 h-4" /> Trocar sala/local
              </Button>
            ) : (
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sala / Local do procedimento</p>
                <Select
                  className="w-full"
                  searchable
                  options={[
                    ...opcoesSala.map((s) => ({ value: s, label: s })),
                    { value: SALA_OUTRO, label: 'Outro… (digitar)' },
                  ]}
                  value={salaOutro ? SALA_OUTRO : rascSala}
                  onChange={(v) => {
                    if (v === SALA_OUTRO) { setSalaOutro(true); setRascSala('') }
                    else { setSalaOutro(false); setRascSala(v) }
                  }}
                  placeholder="Escolha a sala/local"
                />
                {salaOutro && (
                  <Input
                    autoFocus
                    value={rascSala}
                    onChange={(e) => setRascSala(e.target.value)}
                    placeholder="ex.: IOSC - Sala 1"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvarSala() }}
                  />
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="ghost" className="flex-1" onClick={() => setEditandoSala(false)}>Cancelar</Button>
                  <Button size="sm" className="flex-1" disabled={salvandoSala || !rascSala.trim()} onClick={salvarSala}>
                    {salvandoSala ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ORDEM DOS BLOCOS (dono 29/07, à noite): "Trocar sala/local" fica logo
            ACIMA de "Definir anestesista deste caso", e o STATUS logo ABAIXO de
            "Marcar como ajuda" — pedido dele olhando a tela em uso. */}
        {definivel && (
          <div className="px-1 pb-2">
            {/* por CASO: caminho certo p/ blocos multi-anestesista (IOSC/Exames) —
                a troca de SALA inteira fica no header da Completa */}
            <Button size="sm" variant="outline" className="w-full"
              onClick={() => { onClose?.(); onDefinirAnestesista(vivo.sala, vivo) }}>
              <UserCog className="w-4 h-4" /> Definir anestesista deste caso
            </Button>
          </div>
        )}

        {/* AJUDA de outro hospital (dono 29/07): marcar/desmarcar à mão quando a
            escala não trouxe o nome em azul no rodapé. Reflete NA HORA na fila
            das Liberações — as duas abas leem o mesmo `ajudaExterna`. */}
        {podeMarcarAjuda && (
          <div className="px-1 pb-3">
            <Button size="sm" variant={entradaAjuda ? 'default' : 'outline'} className="w-full"
              disabled={salvandoAjuda} onClick={alternarAjuda}>
              {salvandoAjuda ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {entradaAjuda
                ? `${titleCaseNome(nomeAnest)} não é ajuda`
                : `Marcar ${titleCaseNome(nomeAnest)} como ajuda`}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Ajuda de outro hospital: entra ao fim da fila de liberação (badge azul, primeiro a ser liberado).
            </p>
          </div>
        )}

        {/* status da cirurgia — qualquer clínico atualiza (RLS cobre) */}
        {!isDemo && vivo.id && (
          <div className="px-1 pb-4">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status da cirurgia
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_BOTOES.map((s) => {
                const atual = s.extra
                  ? vivo.statusExtra === s.valor
                  : (vivo.statusCirurgia || 'agendada') === s.valor
                // extras convivem com agendada/iniciada, nunca com terminada
                const bloqueado = s.extra && vivo.statusCirurgia === 'terminada'
                return (
                  <Button key={s.valor} size="sm"
                    disabled={bloqueado}
                    className={[
                      'h-auto min-h-[36px] w-full whitespace-normal px-1 py-1.5 leading-tight',
                      // inativo com cara de botão (borda+fundo) e grafia padrão (preta)
                      atual ? s.cls : 'border border-border-strong bg-card text-foreground',
                      bloqueado && 'opacity-40',
                    ].filter(Boolean).join(' ')}
                    variant={atual ? s.ativo : 'ghost'}
                    aria-pressed={atual}
                    onClick={() => mudarStatus(s.valor)}>
                    {s.label}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* TÉRMINO PREVISTO DESTA CIRURGIA (dono 29/07) — preenchível pelas DUAS
            abas, porque este sheet é o mesmo que a Completa e o painel da linha
            (Liberações) abrem. Deixa explícito no rótulo que é da CIRURGIA: o
            cronômetro da PESSOA é outro campo, na linha da fila.
            POSIÇÃO (dono 29/07, à noite): fica DEPOIS do status — o conjunto
            sala/anestesista/ajuda/status é o que se toca no meio da cirurgia e
            vem primeiro; tempo e residente ficam abaixo. */}
        {podeEditarCaso && (
          <div className="px-1 pb-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Timer className="h-3.5 w-3.5" /> Término desta cirurgia
            </p>
            <PainelTempo
              atual={vivo.terminoPrevisto || ''}
              horaExata={horaExata}
              onHoraExata={setHoraExata}
              onDefinir={definirTerminoCaso}
            />
            {/* TÉRMINO, não "tempo faltante": o campo guarda uma HORA, e "tempo
                faltante" é o nome do OUTRO campo — o da pessoa, na fila. Os dois
                disputavam a mesma palavra e era daí que vinha a confusão. Só a
                cirurgia EM ANDAMENTO conta o tempo na fila; as agendadas aparecem
                com a hora, então um número nunca vale por três cirurgias. */}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Hora em que ESTA cirurgia acaba. Na fila ela só conta o tempo enquanto está
              Iniciada; agendada aparece como hora. Quando o anestesista fica livre depois
              de todas as cirurgias dele é outro campo, no ⏱ da linha em Liberações.
            </p>
          </div>
        )}

        {/* RESIDENTE que acompanha ESTE caso (dono 29/07): campo por CASO, não por
            sala nem por linha da fila. Salva direto na escolha — é ajuste de rotina
            no meio do plantão e não merece um passo de confirmação. */}
        {podeEditarCaso && (
          <div className="px-1 pb-3">
            <label htmlFor="caso-residente" className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" /> Residente
              {salvandoResidente && <Loader2 className="h-3 w-3 animate-spin" />}
            </label>
            <Select
              id="caso-residente"
              className="w-full"
              searchable
              options={[{ value: SEM_RESIDENTE, label: 'Sem residente' }, ...opcoesResidente]}
              value={vivo.residenteUserId || SEM_RESIDENTE}
              onChange={trocarResidente}
              placeholder="Selecionar residente…"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Acompanha o caso — quem responde por ele continua sendo o anestesista.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Linha({ rotulo, valor, destaque }) {
  if (!valor) return null
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-muted-foreground">{rotulo}</dt>
      <dd className={destaque ? 'font-semibold text-foreground' : 'text-foreground/90'}>{valor}</dd>
    </div>
  )
}
