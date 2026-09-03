/**
 * Trocas de feriado — formulário e lista, dentro da página Feriados.
 *
 * Segue o fluxo que o app já usa para residentes e funcionárias (dono 03/09): quem pede cria
 * a solicitação, ela fica pendente, e só vale quando o colega aceita. Dois escopos, escolhidos
 * por quem pede: trocar de FERIADO com o colega, ou trocar de POSIÇÃO no mesmo feriado.
 */
import { useState, useMemo } from 'react'
import { Modal, Button, Select, Textarea, useToast } from '@/design-system'
import { ArrowLeftRight, Check, X, Clock, Ban } from 'lucide-react'
import dadosNumerica from '@/data/escalaNumerica.json'
import SegmentedSelector from '../escala-cirurgica/SegmentedSelector'
import { feriadosDaPessoa, filaImpressa, validarPedido, resumirTroca, mesmaEntrada } from '@/lib/trocasFeriado'

const FORM_ID = 'form-troca-feriado'
const brData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

const ESCOPOS = [
  { value: 'data', label: 'Trocar de feriado' },
  { value: 'posicao', label: 'Trocar de posição' },
]

const STATUS = {
  pendente: { rotulo: 'Pendente', icone: Clock, classe: 'bg-warning/15 text-warning' },
  aceita: { rotulo: 'Aceita', icone: Check, classe: 'bg-success/15 text-success' },
  rejeitada: { rotulo: 'Recusada', icone: X, classe: 'bg-destructive/12 text-destructive' },
  cancelada: { rotulo: 'Cancelada', icone: Ban, classe: 'bg-muted text-muted-foreground' },
}

/** Todo mundo que aparece em algum feriado dali para frente — o universo de colegas. */
function colegasPossiveis(hojeISO, eu) {
  const vistos = new Map()
  for (const data of Object.keys(dadosNumerica.feriados?.dias || {})) {
    if (data < hojeISO) continue
    for (const p of filaImpressa(dadosNumerica, data) || []) {
      if (mesmaEntrada(p, eu)) continue
      const chave = p.numero || p.nome
      if (!vistos.has(chave)) vistos.set(chave, { numero: p.numero, nome: p.nome })
    }
  }
  return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}

function FormTroca({ eu, hojeISO, onSubmit, loading }) {
  const [escopo, setEscopo] = useState('data')
  const [feriadoData, setFeriadoData] = useState('')
  const [colega, setColega] = useState('')
  const [feriadoDesejado, setFeriadoDesejado] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState(null)

  const meusFeriados = useMemo(() => feriadosDaPessoa(dadosNumerica, eu, { aPartirDe: hojeISO }), [eu, hojeISO])

  // na troca de POSIÇÃO o colega tem de estar no MESMO feriado; na de DATA, em qualquer um
  const colegas = useMemo(() => {
    if (escopo === 'posicao') {
      if (!feriadoData) return []
      return (filaImpressa(dadosNumerica, feriadoData) || [])
        .filter((p) => !mesmaEntrada(p, eu))
        .map((p) => ({ numero: p.numero, nome: p.nome }))
    }
    return colegasPossiveis(hojeISO, eu)
  }, [escopo, feriadoData, eu, hojeISO])

  const colegaSel = useMemo(() => colegas.find((c) => (c.numero || c.nome) === colega) || null, [colegas, colega])

  const feriadosDoColega = useMemo(() => {
    if (escopo !== 'data' || !colegaSel) return []
    return feriadosDaPessoa(dadosNumerica, colegaSel, { aPartirDe: hojeISO })
      .filter((f) => f.data !== feriadoData)
  }, [escopo, colegaSel, hojeISO, feriadoData])

  const enviar = (e) => {
    e.preventDefault()
    const pedido = {
      escopo,
      solicitante: eu,
      destinatario: colegaSel,
      feriadoData,
      feriadoDesejado: escopo === 'data' ? feriadoDesejado : null,
    }
    const problema = validarPedido(dadosNumerica, pedido) || (descricao.trim() ? null : 'Escreva o motivo da troca')
    if (problema) { setErro(problema); return }
    setErro(null)
    onSubmit({
      escopo,
      feriadoData,
      feriadoDesejado: escopo === 'data' ? feriadoDesejado : null,
      destinatarioNumero: colegaSel.numero,
      destinatarioNome: colegaSel.nome,
      descricao,
    })
  }

  return (
    <form id={FORM_ID} onSubmit={enviar} className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-sm font-semibold text-primary">Tipo de troca</p>
        <SegmentedSelector
          options={ESCOPOS}
          value={escopo}
          onChange={(v) => { setEscopo(v); setColega(''); setFeriadoDesejado('') }}
          size="sm"
        />
      </div>

      <Select
        label="Meu feriado"
        placeholder={meusFeriados.length ? 'Escolha o seu feriado' : 'Você não está escalado em nenhum feriado à frente'}
        options={meusFeriados.map((f) => ({ value: f.data, label: `${brData(f.data)} · ${f.nome} · ${f.posicao}ª posição` }))}
        value={feriadoData}
        onChange={(v) => { setFeriadoData(v); setColega(''); setFeriadoDesejado('') }}
        disabled={loading || !meusFeriados.length}
      />

      <Select
        label="Colega"
        placeholder={escopo === 'posicao' && !feriadoData ? 'Escolha o seu feriado antes' : 'Escolha o colega'}
        options={colegas.map((c) => ({ value: c.numero || c.nome, label: `${c.numero ? `${c.numero} ` : ''}${c.nome}` }))}
        value={colega}
        onChange={(v) => { setColega(v); setFeriadoDesejado('') }}
        disabled={loading || !colegas.length}
      />

      {escopo === 'data' && colegaSel && (
        <Select
          label={`Feriado de ${colegaSel.nome}`}
          placeholder={feriadosDoColega.length ? 'Escolha o feriado do colega' : 'O colega não tem outro feriado à frente'}
          options={feriadosDoColega.map((f) => ({ value: f.data, label: `${brData(f.data)} · ${f.nome} · ${f.posicao}ª posição` }))}
          value={feriadoDesejado}
          onChange={setFeriadoDesejado}
          disabled={loading || !feriadosDoColega.length}
        />
      )}

      <Textarea
        label="Motivo"
        placeholder="Por que a troca"
        value={descricao}
        onChange={setDescricao}
        maxLength={200}
        rows={3}
        disabled={loading}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        {escopo === 'data'
          ? 'Vocês trocam os feriados: cada um assume a posição que o outro tinha.'
          : 'Vocês continuam no mesmo feriado e trocam de lugar na fila.'}{' '}
        A troca só vale depois que o colega aceitar.
      </p>

      {erro && <p role="alert" className="text-sm font-medium text-destructive">{erro}</p>}
    </form>
  )
}

function CardTroca({ troca, souOSolicitante, podeResponder, onResponder, onCancelar, ocupado }) {
  const s = STATUS[troca.status] || STATUS.pendente
  const Icone = s.icone
  return (
    <div className="flex flex-col gap-2 rounded-[16px] border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug">{resumirTroca(troca)}</p>
        <span className={`inline-flex flex-none items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-bold ${s.classe}`}>
          <Icone className="size-3" aria-hidden="true" />
          {s.rotulo}
        </span>
      </div>
      {troca.descricao && <p className="text-[12px] leading-snug text-muted-foreground">{troca.descricao}</p>}
      <p className="text-[11px] text-muted-foreground">{troca.codigo}</p>
      {troca.status === 'pendente' && (podeResponder || souOSolicitante) && (
        <div className="flex gap-2">
          {podeResponder && (
            <>
              <Button size="sm" onClick={() => onResponder(troca.codigo, true)} disabled={ocupado} className="flex-1">
                Aceitar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onResponder(troca.codigo, false)} disabled={ocupado} className="flex-1">
                Recusar
              </Button>
            </>
          )}
          {souOSolicitante && !podeResponder && (
            <Button size="sm" variant="secondary" onClick={() => onCancelar(troca.codigo)} disabled={ocupado} className="flex-1">
              Cancelar pedido
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function TrocasFeriado({ troca, hojeISO }) {
  const { eu, podePedir, minhas, pendentesParaMim, salvando, pedir, responder, cancelar } = troca
  const [aberto, setAberto] = useState(false)
  const toast = useToast()

  const lista = useMemo(() => {
    const vistas = new Set()
    return [...pendentesParaMim, ...minhas].filter((t) => !vistas.has(t.id) && vistas.add(t.id))
  }, [pendentesParaMim, minhas])

  const enviar = async (dados) => {
    const { error } = await pedir(dados)
    if (error) { toast?.error?.(error); return }
    toast?.success?.('Pedido de troca enviado. O colega precisa aceitar.')
    setAberto(false)
  }

  const responderComAviso = async (codigo, aceitar) => {
    const r = await responder(codigo, aceitar)
    if (r.error) toast?.error?.(r.error)
    else toast?.success?.(aceitar ? 'Troca aceita. A fila do feriado já mostra a mudança.' : 'Troca recusada.')
  }

  const cancelarComAviso = async (codigo) => {
    const r = await cancelar(codigo)
    if (r.error) toast?.error?.(r.error)
    else toast?.success?.('Pedido cancelado.')
  }

  return (
    <section className="rounded-[20px] border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold">Trocas de feriado</h2>
        {podePedir && (
          <Button size="sm" onClick={() => setAberto(true)} className="min-h-[36px]">
            <ArrowLeftRight className="mr-1 size-4" aria-hidden="true" />
            Pedir troca
          </Button>
        )}
      </div>

      {!podePedir && (
        <p className="py-1 text-[12px] leading-snug text-muted-foreground">
          Você não aparece na escala de feriados, então não há troca para pedir. As trocas dos colegas seguem
          refletidas nas filas acima.
        </p>
      )}

      {podePedir && !lista.length && (
        <p className="py-1 text-[12px] text-muted-foreground">Nenhuma troca sua no momento.</p>
      )}

      {Boolean(lista.length) && (
        <div className="flex flex-col gap-2">
          {lista.map((t) => (
            <CardTroca
              key={t.id}
              troca={t}
              souOSolicitante={t.solicitanteNumero === eu?.numero}
              podeResponder={pendentesParaMim.some((p) => p.id === t.id)}
              onResponder={responderComAviso}
              onCancelar={cancelarComAviso}
              ocupado={salvando}
            />
          ))}
        </div>
      )}

      <Modal
        open={aberto}
        onClose={() => setAberto(false)}
        title="Pedir troca de feriado"
        description="A troca só vale depois que o colega aceitar."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" form={FORM_ID} loading={salvando}>
              Enviar pedido
            </Button>
          </>
        }
      >
        <Modal.Body>
          <FormTroca eu={eu} hojeISO={hojeISO} onSubmit={enviar} loading={salvando} />
        </Modal.Body>
      </Modal>
    </section>
  )
}
