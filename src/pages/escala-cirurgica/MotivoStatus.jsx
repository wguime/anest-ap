/**
 * MotivoStatus — escolha do MOTIVO da suspensão ou do atraso (dono 19/11/2026, modelo em
 * `.tmp/motivo-suspensa-atrasada.html`, quadros A2/B1/B3).
 *
 * Os chips (2 colunas, 44px) são a lista de `escalaMotivoStatus`; o último, "Outro", abre o
 * campo livre. Usado na folha do horário pendente ("Não aconteceu — foi suspensa") e no
 * Andamento do detalhe do caso. Quem decide o que o botão faz é quem usa: aqui só se escolhe.
 */
import { useState } from 'react'
import { Button, Textarea } from '@/design-system'
import { MOTIVO_MAX, OUTRO, motivoEscolhido, motivoObrigatorio, motivoParaEdicao, motivosDe, pareceIdentificarPaciente } from '@/lib/escalaMotivoStatus'

const CHIP = 'min-h-[44px] rounded-[10px] border px-2 py-1 text-[12.5px] font-semibold leading-tight transition-colors'
const INATIVO = 'border-border-strong bg-card text-foreground'
const ATIVO = {
  suspensa: 'border-destructive bg-destructive/10 text-destructive',
  atrasada: 'border-warning bg-warning/15 text-foreground',
}

/**
 * @param {'suspensa'|'atrasada'} status
 * @param {string?}  inicial      motivo já gravado (reabre marcado)
 * @param {string}   titulo       pergunta acima dos chips
 * @param {string}   rotuloBotao  texto do botão de confirmar
 * @param {(motivo: string|null) => void} onConfirmar
 * @param {Function?} onCancelar  link abaixo do botão (ex.: "Voltar aos horários")
 * @param {string?}  rotuloCancelar
 */
export default function MotivoStatus({ status, inicial = null, titulo, rotuloBotao, onConfirmar, onCancelar = null, rotuloCancelar = 'Cancelar' }) {
  const [escolha, setEscolha] = useState(() => motivoParaEdicao(status, inicial))
  const motivo = motivoEscolhido(escolha)
  const obrigatorio = motivoObrigatorio(status)
  const pronto = !!motivo
  const opcoes = [...motivosDe(status), OUTRO]
  return (
    <div data-motivo-status={status}>
      <p className="text-[15px] font-extrabold leading-tight">{titulo}</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        {obrigatorio ? 'Toque no motivo mais próximo.' : 'Opcional — toque no motivo mais próximo.'}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label={titulo}>
        {opcoes.map((o) => {
          const ativo = escolha.chip === o
          return (
            <button
              key={o}
              type="button"
              aria-pressed={ativo}
              onClick={() => setEscolha((e) => ({ ...e, chip: ativo ? null : o }))}
              className={[CHIP, ativo ? ATIVO[status] : INATIVO].join(' ')}
            >
              {o === OUTRO ? 'Outro' : o}
            </button>
          )
        })}
      </div>
      {escolha.chip === OUTRO && (
        <Textarea
          className="mt-2"
          label="Outro motivo"
          rows={2}
          resize="none"
          maxLength={MOTIVO_MAX}
          value={escolha.outro}
          onChange={(v) => setEscolha((e) => ({ ...e, outro: v }))}
          placeholder="Descreva sem o nome do paciente"
          autoFocus
        />
      )}
      {/* LGPD (revisão 19/11): o placeholder some ao digitar — o aviso fica; e alerta (sem
          bloquear) quando o texto parece nome, CPF ou prontuário */}
      {escolha.chip === OUTRO && (
        <p className={['mt-1 text-[11.5px] leading-snug', pareceIdentificarPaciente(escolha.outro) ? 'font-semibold text-destructive' : 'text-muted-foreground'].join(' ')} role="note">
          {pareceIdentificarPaciente(escolha.outro)
            ? 'Parece um nome ou número do paciente — remova antes de salvar.'
            : 'Toda a equipe vê este texto: não escreva nome nem dado que identifique o paciente.'}
        </p>
      )}
      <Button
        variant={status === 'suspensa' ? 'destructive' : 'default'}
        className="mt-3 min-h-[48px] w-full text-[15px] font-bold"
        disabled={!pronto}
        onClick={() => onConfirmar(motivo)}
      >
        {rotuloBotao}
      </Button>
      {onCancelar && (
        <button
          type="button"
          onClick={onCancelar}
          className="mx-auto mt-1 flex min-h-[44px] items-center text-[13px] font-semibold text-primary active:opacity-70"
        >
          {rotuloCancelar}
        </button>
      )}
    </div>
  )
}
