/**
 * Observação livre no pé de cada card da numérica — HRO, Unimed, Materno e Consultório
 * (dono 08/10). Modelo B, escolhido no protótipo `.tmp/obs-modelo/escala-numerica-observacoes.html`:
 * sem anotação, só a linha "+ Observação" (o teclado não abre sem querer enquanto se rola a
 * lista); com anotação, o texto com quem escreveu e quando; o toque abre o campo com
 * Cancelar/Salvar. Quem não pode escrever só lê — e o card sem anotação fica como era.
 */
import { useState } from 'react'
import { Plus, Pencil, NotebookPen, Check } from 'lucide-react'
import { Button, Textarea, useToast } from '@/design-system'
import { nomeCirurgiaoCurto } from '@/lib/colunaLiberacao'
import { MissingUserIdError } from '@/utils/audit'
import { OBSERVACAO_MAX } from '@/services/escalaNumericaObservacaoService'

/** "10:42" no dia em que foi escrita; "07/10 10:42" quando foi antes. */
function quando(iso, agora = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === agora.toDateString()
    ? hora
    : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hora}`
}

function Titulo({ className = '' }) {
  return (
    <span className={`flex items-center gap-1.5 font-bold ${className}`}>
      <NotebookPen className="size-[15px] flex-none text-muted-foreground" aria-hidden="true" />
      Observações
    </span>
  )
}

/**
 * `observacao`: { texto, autorNome, atualizadoEm } ou null. `onSalvar(texto)` grava (texto
 * vazio apaga) e lança se falhar — o campo continua aberto com o que foi digitado.
 */
export default function ObservacaoCard({ rotulo, observacao, podeEscrever, onSalvar }) {
  const { toast } = useToast()
  const atual = observacao?.texto || ''
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)

  if (!editando && !atual && !podeEscrever) return null

  const abrir = () => { setTexto(atual); setEditando(true) }
  const salvar = async () => {
    if (texto.trim() === atual) { setEditando(false); return }
    setSalvando(true)
    try {
      await onSalvar(texto)
      setEditando(false)
    } catch (e) {
      toast({
        variant: 'error',
        title: e instanceof MissingUserIdError
          ? 'Sua sessão expirou. Entre de novo para salvar a observação.'
          : 'Não foi possível salvar a observação. Tente de novo.',
      })
    } finally {
      setSalvando(false)
    }
  }

  if (editando) {
    return (
      <div data-slot="observacao" data-estado="editando" className="mt-2 border-t border-border pt-2">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Titulo className="text-[12.5px]" />
          <span className="text-[11px] tabular-nums text-muted-foreground">{texto.length}/{OBSERVACAO_MAX}</span>
        </div>
        <Textarea
          value={texto}
          onChange={setTexto}
          rows={3}
          maxLength={OBSERVACAO_MAX}
          resize="none"
          autoFocus
          aria-label={`Observações: ${rotulo}`}
        />
        <p className="mx-0.5 mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Todo o grupo vê, e sai na folha impressa. Recado de trabalho: sem motivo de afastamento nem dado de paciente.
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditando(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} loading={salvando} leftIcon={<Check />}>Salvar</Button>
        </div>
      </div>
    )
  }

  if (!atual) {
    return (
      <div data-slot="observacao" data-estado="vazia" className="mt-2 border-t border-border">
        <button
          type="button"
          onClick={abrir}
          className="flex h-11 w-full items-center gap-1.5 px-0.5 text-[13.5px] font-semibold text-primary"
          aria-label={`Escrever observação: ${rotulo}`}
        >
          <Plus className="size-[15px]" aria-hidden="true" />
          Observação
        </button>
      </div>
    )
  }

  const autor = nomeCirurgiaoCurto(observacao.autorNome)
  return (
    <div data-slot="observacao" data-estado="lida" className="mt-2 border-t border-border">
      <div className="mt-2 rounded-[12px] bg-muted px-3 pt-2.5">
        <Titulo className="mb-[3px] text-[12px] text-muted-foreground" />
        <p data-slot="observacao-texto" className="whitespace-pre-wrap break-words text-[13.5px] font-medium leading-[1.45]">
          {atual}
        </p>
        <div className={`flex items-center justify-between gap-2 ${podeEscrever ? 'min-h-10' : 'py-2'}`}>
          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
            {[autor, quando(observacao.atualizadoEm)].filter(Boolean).join(' · ')}
          </span>
          {podeEscrever && (
            <button
              type="button"
              onClick={abrir}
              className="flex h-10 flex-none items-center gap-1 pl-2 pr-0.5 text-[12.5px] font-semibold text-primary"
              aria-label={`Editar observação: ${rotulo}`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
