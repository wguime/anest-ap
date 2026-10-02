/**
 * BLOCOS DO HORÁRIO da cirurgia — fonte única do desenho no detalhe do caso
 * (Completa, Minhas, Urgências) e na folha do "+ Tempo total" (Liberações).
 *
 * Revisão do dono em 02/10 à tarde, escolhida em protótipo (`.tmp/horario-compacto.html`)
 * sobre a versão da manhã: "não quero tão grande, reduza 35% da altura". O bloco virou
 * UMA linha — rótulo e a referência à esquerda, o horário à direita (44px contra 88px).
 * A 375/390px a referência "agendada 13:30" era cortada; saiu (a hora agendada já está
 * no cabeçalho da folha) e o lugar ficou com o que só o bloco diz: "há 40min",
 * "faltam 45min", "durou 1h17". As colunas são `grid-cols-2` (minmax(0,1fr)): com
 * `1fr` puro o conteúdo mínimo empurrava o 2º bloco para fora do cartão a 375px.
 */
import { useState } from 'react'
import { Plus, Timer } from 'lucide-react'
import { Button, Input } from '@/design-system'
import { agora } from '@/lib/devClock'
import { hhmmDe } from '@/lib/escalaHorarioReal'
import { formatHoraDigitada, horaCompleta } from './PainelTempo'

/**
 * Um bloco INÍCIO/TÉRMINO. Vazio vira convite tracejado ("Definir"); sem `onClick`
 * (quem não edita a escala) é só leitura. A faixa colorida à esquerda repete a tinta
 * do quadro: verde = iniciada (no início), azul = terminada (no término).
 */
export function BlocoHorario({ rotulo, nomeAcessivel, valor, sub = '', subAviso = false, faixa = '', onClick }) {
  const vazio = !valor
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      aria-label={nomeAcessivel ? `${nomeAcessivel}: ${valor || 'não informado'}` : undefined}
      className={[
        'flex min-h-[44px] w-full min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-[3px] text-left',
        vazio && onClick
          ? 'border-[1.5px] border-dashed border-primary/70'
          : `border border-border-strong bg-card ${faixa}`,
      ].join(' ')}
    >
      <span className="flex min-w-0 flex-col overflow-hidden">
        <span className="text-[11px] font-bold uppercase leading-tight tracking-[0.06em] text-muted-foreground">{rotulo}</span>
        <span className={['truncate text-[11px] leading-tight', subAviso ? 'font-semibold text-warning' : 'text-muted-foreground'].join(' ')}>
          {sub || ' '}
        </span>
      </span>
      {vazio ? (
        <span className={['ml-auto shrink-0 text-[14px] font-bold', onClick ? 'text-primary' : 'text-muted-foreground'].join(' ')}>
          {onClick ? 'Definir' : '—'}
        </span>
      ) : (
        <span className="ml-auto shrink-0 text-[20px] font-extrabold tabular-nums min-[400px]:text-[22px]">{valor}</span>
      )}
    </Tag>
  )
}

/**
 * Botão do TEMPO ESTIMADO (a previsão de término — `terminoPrevisto`), dono 02/10:
 * "configure um botão para tempo estimado nesse espaço" (topo do cartão do horário) e
 * "ao lado do nome do procedimento adicione o tempo estimado" (folha das Liberações).
 * Pílula contornada: o estado (verde sólido) é das pílulas da fila; contorno é AÇÃO.
 * Vazio: "+ Tempo estimado". Com valor: `prefixo` (ex.: "Estimado") + o horário e,
 * se houver, `detalhe` ("faltam 45min"); `aviso` pinta de âmbar quando já passou.
 * O alvo de toque cresce por `after:` (a pílula tem 26px) sem esticar a linha.
 */
export function BotaoEstimado({ valor = '', prefixo = '', detalhe = '', aviso = false, nomeAcessivel, onClick }) {
  const classes = [
    'relative inline-flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] bg-card px-2.5 text-[12.5px] font-semibold',
    aviso ? 'border-warning text-warning' : 'border-primary text-primary',
    onClick ? "after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']" : '',
  ].join(' ')
  const conteudo = valor ? (
    <>
      <Timer className="h-3.5 w-3.5" aria-hidden />
      {prefixo && <span>{prefixo}</span>}
      <b className="font-extrabold tabular-nums">{valor}</b>
      {detalhe && <span className="font-medium">{detalhe}</span>}
    </>
  ) : (
    <>
      <Plus className="h-3.5 w-3.5" aria-hidden /> Tempo estimado
    </>
  )
  if (!onClick) return valor ? <span className={classes}>{conteudo}</span> : null
  return (
    <button type="button" onClick={onClick} aria-label={`${nomeAcessivel}: ${valor || 'não informado'}`} className={classes}>
      {conteudo}
    </button>
  )
}

/**
 * CONFIRMAR O HORÁRIO (dono 02/10, tarde, aprovado em protótipo): "quero que ao clicar
 * no início de uma cirurgia abra um card para confirmar se aquele é mesmo o horário de
 * início com opção de acrescentar o horário de início correto [...] a mesma coisa ao
 * clicar em terminar". Serve aos botões Iniciada/Terminada, aos blocos INÍCIO/TÉRMINO
 * (detalhe do caso e Liberações) e ao "Terminada" da faixa de urgências.
 *
 * O horário PROPOSTO é o já informado; sem ele, a `sugestao` de quem chama (a hora em
 * que a cirurgia foi MARCADA iniciada, para quem começou antes de 02/10 e não tem início
 * gravado); sem as duas, AGORA — o mesmo que o toque gravaria.
 * Um toque em "Confirmar" grava; se foi em outro horário, os 4 dígitos do correto gravam
 * sozinhos ao completar (mesma máscara do término), sem segundo botão. `validar(hhmm)`
 * devolve a frase que impede gravar (no futuro, início depois do término…) ou null.
 * "Limpar horário" só existe quando há horário gravado e quem chama permite.
 */
export function ConfirmarHorario({ campo, valor = '', sugestao = null, validar, onConfirmar, onLimpar }) {
  const inicio = campo === 'inicio'
  const [erro, setErro] = useState('')
  const [rascHora, setRascHora] = useState('')
  const proposto = valor || sugestao?.hhmm || hhmmDe(agora())
  const origem = valor ? 'informado' : sugestao?.hhmm ? sugestao.rotulo : 'agora'
  const gravar = (hhmm) => {
    const motivo = validar?.(hhmm) || ''
    setErro(motivo)
    if (!motivo) onConfirmar(hhmm)
    return !motivo
  }
  const digitar = (bruto) => {
    const texto = formatHoraDigitada(bruto)
    setRascHora(texto)
    if (!horaCompleta(texto)) { setErro(''); return }
    if (gravar(texto)) setRascHora('')
  }
  return (
    <div className="space-y-3 pb-1">
      <div className="flex flex-col items-center">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
          {inicio ? 'Começou às' : 'Terminou às'}
        </span>
        <span className="text-[40px] font-extrabold leading-[46px] tabular-nums">{proposto}</span>
        <span className="text-[12.5px] text-muted-foreground">{origem}</span>
      </div>
      <Button
        className={['min-h-[48px] w-full text-[15px] font-bold', inicio ? '' : 'bg-info text-info-foreground hover:bg-info/90'].join(' ')}
        onClick={() => gravar(proposto)}
      >
        Confirmar {inicio ? 'início' : 'término'} às {proposto}
      </Button>
      <p className="pt-1 text-center text-[12.5px] text-muted-foreground">
        Foi em outro horário? <b className="font-semibold text-foreground">Digite o correto:</b>
      </p>
      <Input
        data-slot={inicio ? 'inicio-hora' : 'termino-real-hora'}
        className="mx-auto w-[160px] [&_input]:text-center [&_input]:text-[19px] [&_input]:font-bold [&_input]:tracking-wide"
        value={rascHora}
        onChange={(e) => digitar(e.target.value)}
        inputMode="numeric"
        maxLength={5}
        placeholder={inicio ? '14:05' : '15:30'}
        aria-label={inicio ? 'Horário de início correto' : 'Horário de término correto'}
      />
      {erro && <p role="alert" className="text-center text-xs font-medium text-destructive">{erro}</p>}
      {valor && onLimpar && (
        <Button
          variant="ghost"
          className="mx-auto flex min-h-[44px] text-destructive hover:bg-destructive/10"
          onClick={() => { setErro(''); onLimpar() }}
        >
          Limpar horário
        </Button>
      )}
    </div>
  )
}
