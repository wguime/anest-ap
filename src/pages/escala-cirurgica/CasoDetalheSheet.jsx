/**
 * CasoDetalheSheet — detalhe do caso COMPARTILHADO pelas abas Completa e Minhas.
 * Fonte única da UI de detalhe/status/troca (antes vivia só no BoardView e a aba
 * Minhas era um beco sem saída — pedido do dono 2026-07-21).
 *
 * Sincronizado AO VIVO: o caso exibido deriva de `escala.casos` (context) — updates
 * otimistas e realtime de outros usuários refletem com o sheet aberto.
 */
import { useMemo, useState } from 'react'
import { Loader2, MapPin, UserCog } from 'lucide-react'
import { Button, Input, Select, Sheet, SheetContent, SheetHeader, SheetTitle } from '@/design-system'
import { useEscalaCirurgicaActions } from '@/contexts/EscalaCirurgicaContext'
import { anestesistaDaSala, corConvenio, LOCAIS_BASE, tipoBadge, temAnestesistaReal } from './utils'

const SALA_OUTRO = '__outro__'

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
  const { setStatusCirurgia, atualizarCaso } = useEscalaCirurgicaActions()
  const isDemo = String(escala?.id).startsWith('demo-')
  const [editandoSala, setEditandoSala] = useState(false)
  const [rascSala, setRascSala] = useState('')
  const [salaOutro, setSalaOutro] = useState(false)
  const [salvandoSala, setSalvandoSala] = useState(false)

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

  const podeEditarSala = !!podeEditar && !isDemo && !!vivo.id
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

  const aliasDet = anestesistaDaSala(escala?.casos, vivo.sala).alias || vivo.anestesista || ''
  // Caso EM ABERTO (sem anestesista): qualquer um da equipe (podeEditar) assume —
  // não há dono para repassar (pedido do dono 24/07). Caso COM dono segue a regra
  // normal (o próprio dono ou o coordenador).
  const emAberto = !temAnestesistaReal(vivo)
  const definivel = !!(onDefinirAnestesista && (
    (podeDefinirAnestesista && podeDefinirAnestesista(vivo.sala, aliasDet)) || (podeEditar && emAberto)
  ))
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
          <Linha rotulo="Convênio" valor={vivo.convenio && (
            <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${corConvenio(vivo.convenio)?.badge || ''}`}>
              {vivo.convenio}
            </span>
          )} />
          <Linha rotulo="Tempo estimado" valor={vivo.tempoEstimado} />
          {tipoBadge(vivo.tipo) && <Linha rotulo="Tipo" valor={tipoBadge(vivo.tipo).label} />}
        </dl>

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

        {/* Trocar SALA/LOCAL do procedimento (pedido do dono 24/07) — corrige onde
            o caso acontece (ex.: mover uma linha lida como HRO para "IOSC - Sala 1").
            O board re-agrupa pela nova sala automaticamente. */}
        {podeEditarSala && (
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
