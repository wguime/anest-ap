/**
 * PainelTempo — FONTE ÚNICA da UI de "tempo faltante" da Escala Cirúrgica.
 *
 * Usado nos lugares que precisam concordar: o cronômetro da PESSOA (pílula do card
 * na fila) e o término de UMA CIRURGIA (detalhe do caso, dono 29/07; e, desde
 * 25/09, a folha "Término · …" que sobe da própria folha do tempo total). Antes de
 * 29/07 já havia duas cópias divergentes — uma delas com o input de hora nativo,
 * que abre o picker cru do browser e o dono já tinha rejeitado. Um componente só
 * evita a terceira.
 *
 * O tempo é 100% MANUAL (decisão do dono 23/07): a estimativa automática enchia a
 * coluna de "+8h53" e ninguém confiava. NÃO reintroduzir. O total da PESSOA é
 * informado à mão e independente das cirurgias (15/09) — com uma exceção, decidida
 * em 14/09: com o término de TODAS informado, ele vira o da última
 * (`espelhoTempoTotal`). Soma parcial não existe: estimativa que estoura não
 * converge para zero, então somar só algumas partes acumula o erro.
 */
import { useState } from 'react'
import { Button, Input, Select } from '@/design-system'
import { agora } from '@/lib/devClock'
import { diffRelogioMin } from './utils'

/** Atalhos de duração da grade (minutos) — o resto vive em "Outro". Sete atalhos +
 *  "Outro" fecham a grade de 4×2 (dono 02/10: "aproveite melhor os espaços"). */
export const ATALHOS_MIN = [15, 30, 45, 60, 90, 120, 180]

/** Opções do Select de hora exata (padrão DS): dia inteiro em passos de 15min. */
export const HORARIOS_OPCOES = Array.from({ length: 96 }, (_, i) => {
  const v = `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`
  return { value: v, label: v }
})

/**
 * Máscara de hora enquanto digita: só dígitos → "HH:MM". MESMA função do
 * "Adicionar caso" (dono aprovou lá em 24/07) — digitar "1830" vira "18:30".
 *
 * Por que digitação e não roleta (pesquisa 29/07): as duas libs de roleta iOS para
 * React não passam a régua do projeto — `react-ios-time-picker` foi ARQUIVADA em
 * 14/04/2026 e `react-mobile-picker` tem 357★ (mínimo é 1k). Uma lista única de 96
 * horários obrigava a rolar muito, e duas roletas de Select não cabiam na linha.
 * Digitar 4 dígitos com teclado numérico é o caminho mais curto e sem dependência.
 * O picker NATIVO (`input type="time"`) segue fora: o dono já rejeitou.
 */
export const formatHoraDigitada = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`
}

/** "18:30" completo e válido? (a máscara deixa passar estados parciais) */
export const horaCompleta = (v) => /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(String(v || '').trim())

/** "90" → "1h30"; "45" → "45min". */
export const rotuloDuracao = (min) =>
  min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min}min`

/**
 * Opções em TEMPO FALTANTE (dono 29/07): quem está em sala pensa "falta uma hora",
 * não "termina às 16:15". O rótulo é a duração e o VALOR é a hora (agora + duração)
 * — o banco continua guardando "HH:MM", que é o dado estável: uma duração salva
 * envelhece sozinha, uma hora não.
 *
 * Passos de 15min até 8h: acima disso não é estimativa, é chute.
 */
export function opcoesTempoFaltante(passo = 15, maxMin = 480) {
  const out = []
  for (let m = passo; m <= maxMin; m += passo) out.push({ value: emMinutos(m), label: rotuloDuracao(m), min: m })
  return out
}

/** "agora + N minutos" como "HH:MM". */
export function emMinutos(min) {
  const d = new Date(agora().getTime() + min * 60000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Texto curto do cronômetro. Mesmo formato para a pessoa e para a cirurgia — o
 * que os distingue na tela é o PESO visual (pílula verde sólida × chip cinza),
 * nunca o texto, que seria a fonte da confusão que o dono quer evitar.
 * @returns {{texto:string, atrasada:boolean}}
 */
export function formatFaltante(alvoMin, agoraMin) {
  // meia-noite: "01:30" pedido às 21:30 ainda FALTA (ver diffRelogioMin)
  const diff = diffRelogioMin(alvoMin, agoraMin)
  const abs = Math.abs(diff)
  const fmt = abs >= 60 ? `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}` : `${abs}min`
  return { texto: diff >= 0 ? `~${fmt}` : `+${fmt}`, atrasada: diff < 0 }
}

/**
 * O MESMO tempo em FRASE, para o tempo de UMA cirurgia na fila de liberação.
 *
 * O chip com ícone de relógio saiu de lá (dono 30/07): o card ficava com DOIS ⏱
 * lado a lado — um da cirurgia, um da pessoa — e ninguém sabia qual era qual.
 * Em palavra, colada ao cirurgião a que pertence, a posição diz de quem é e o
 * verbo diz o que é, sem precisar de tooltip (que em celular não existe).
 *
 * Consome o retorno de `formatFaltante` em vez de recalcular: um só lugar decide
 * quanto falta, e este só escolhe as palavras.
 *
 * @param {{texto:string, atrasada:boolean}} f  saída de formatFaltante
 * @returns {string} "faltam 45min" | "12min além"
 */
export function fraseFaltante(f) {
  if (!f) return ''
  const n = f.texto.replace(/^[~+]/, '')
  return f.atrasada ? `${n} além` : `faltam ${n}`
}

/**
 * Texto da PÍLULA do total da pessoa, na fila de liberação.
 *
 * Assimétrico de propósito: enquanto FALTA, "~25min" se explica sozinho e o
 * espaço é curto; quando PASSA, o sinal vira palavra ("25min além"). Um delta
 * solto é o pior formato possível para um número que alguém precisa ler de
 * relance — é relativo, não tem rótulo e não tem âncora, e as três referências
 * que consultei convergem nisso: painel de aeroporto mostra o horário previsto
 * MAIS a palavra de status (nunca só o atraso), o guia de timestamps do
 * Cloudscape exige que todo horário venha com um rótulo dizendo a que evento se
 * refere, e Dexter & Epstein (Anesth Analg) mostram que, depois que a cirurgia
 * passa da estimativa, o tempo restante médio fica quase CONSTANTE — ou seja, um
 * contador que segue subindo não prevê nada, só informa que estourou.
 *
 * SEM O "~" (dono 24/08): a pílula mostra "1h18", não "~1h18". O til vinha de
 * `formatFaltante`, que é compartilhado — por isso ele é retirado AQUI e não lá:
 * a coluna de tempo do quadro da Completa ("~45min", desenho de 18/08) segue
 * como está, e é a pílula da fila que o dono pediu limpa.
 */
export function fraseCronometro(alvoMin, agoraMin) {
  const f = formatFaltante(alvoMin, agoraMin)
  return f.atrasada ? fraseFaltante(f) : f.texto.replace(/^~/, '')
}

/** Minutos desde a meia-noite de um "HH:MM" (null se não parseia). */
function paraMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  if (!m) return null
  const h = Number(m[1]); const min = Number(m[2])
  return h > 23 || min > 59 ? null : h * 60 + min
}

/** Atalhos da DURAÇÃO de uma cirurgia que ainda não começou (dono 27/10, 5ª rodada). */
export const ATALHOS_DURACAO_MIN = [30, 45, 60, 90, 120, 150, 180]

/**
 * O PAINEL (dono 27/10, Modelo 2 da 4ª rodada de `.tmp/horarios-auditoria/`): "Horário de
 * término" e "Tempo faltante" UM ACIMA DO OUTRO, os dois à vista e qualquer um grava, como
 * antes — sai o alternador de 17/08 e, com ele, a caixa de altura fixa e o "abre sempre no
 * horário de término" (02/10). O próprio campo mostra o horário gravado, com o "faltam X" e
 * o "Limpar" ao lado (o "Limpar" só existe com valor); a grade de durações vem logo abaixo.
 *
 * `soDuracao` (dono 27/10, 5ª rodada): o estimado de uma cirurgia que AINDA NÃO COMEÇOU é uma
 * DURAÇÃO, que começa a contar no toque em Iniciada (o gatilho a converte em término). Aí o
 * painel oferece só durações; `onDefinir(null, { minutos })` grava e `onDefinir('', {
 * minutos: null })` limpa. `exemploDuracao(min)` → frase de exemplo ("Se começar às 16:00,
 * termina às 18:00.").
 */
export default function PainelTempo({ soDuracao = false, duracaoAtual = null, exemploDuracao = null, ...props }) {
  return soDuracao
    ? <PainelDuracao atual={duracaoAtual} onDefinir={props.onDefinir} exemplo={exemploDuracao} />
    : <PainelHorario {...props} />
}

function PainelHorario({ horarios, atual, horaExata, onHoraExata, onDefinir }) {
  // `horarios` sobrescrevível só para teste; em produção são as opções de tempo
  // faltante, recalculadas a cada render (são relativas a agora).
  const opcoes = horarios || opcoesTempoFaltante()
  const valor = horaExata || atual || ''
  const alvo = paraMinutos(valor)
  const agoraD = agora()
  const restante = alvo != null ? formatFaltante(alvo, agoraD.getHours() * 60 + agoraD.getMinutes()) : null
  // CAMPO DE HORÁRIO MASCARADO: `null` = não está sendo editado, então mostra o valor
  // salvo. Grava só quando a hora está COMPLETA e válida — "18:3" no meio da digitação
  // não pode virar um término gravado.
  const [rascHora, setRascHora] = useState(null)
  const horaTexto = rascHora ?? valor
  const digitarHora = (bruto) => {
    const texto = formatHoraDigitada(bruto)
    setRascHora(texto)
    if (horaCompleta(texto)) {
      onHoraExata(texto)
      onDefinir(texto)
      setRascHora(null) // volta a espelhar o salvo
    }
  }
  // `meta.minutos` acompanha a DURAÇÃO escolhida (atalho ou "Outro"): quem grava sabe que
  // foi duração, e não hora exata, por aqui.
  const gravar = (hhmm, meta) => { onHoraExata(hhmm); onDefinir(hhmm, meta) }

  return (
    <div className="space-y-2">
      <div className="flex min-h-[48px] items-center gap-2.5">
        {/* horário digitado com máscara — teclado numérico no celular (o picker NATIVO
            segue recusado pelo dono). A tipografia vai em `[&_input]` porque o
            `className` do Input do DS pousa no WRAPPER. */}
        <Input
          data-slot="termino-hora"
          className="w-[140px] shrink-0 [&_input]:text-center [&_input]:text-[22px] [&_input]:font-extrabold [&_input]:tabular-nums"
          value={horaTexto}
          onChange={(e) => digitarHora(e.target.value)}
          inputMode="numeric"
          maxLength={5}
          placeholder="--:--"
          aria-label="Horário de término"
        />
        <p className={['min-w-0 text-[13px] leading-snug', restante?.atrasada ? 'text-warning' : 'text-muted-foreground'].join(' ')}>
          {restante
            ? (restante.atrasada ? `${restante.texto.replace('+', '')} além` : `faltam ${restante.texto.replace('~', '')}`)
            : 'Sem tempo informado.'}
        </p>
        {atual && (
          <button
            type="button"
            className="ml-auto flex min-h-[44px] shrink-0 items-center px-1.5 text-[13.5px] font-semibold text-destructive active:opacity-70"
            onClick={() => onDefinir('')}
          >
            Limpar
          </button>
        )}
      </div>
      <p className="pt-0.5 text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">ou daqui a</p>
      {/* GRADE 4×2 (dono 02/10): sete atalhos e o "Outro" na 8ª casa. O gatilho do Select
          do DS traz padding INLINE (16×18px); o `!` dos descendentes encolhe só este. */}
      <div className="grid grid-cols-4 gap-1.5">
        {ATALHOS_MIN.map((min) => (
          <Button
            key={min}
            variant="outline"
            className="min-h-[44px] px-1 font-bold"
            onClick={() => gravar(emMinutos(min), { minutos: min })}
          >
            {rotuloDuracao(min)}
          </Button>
        ))}
        <Select
          size="sm"
          className="[&_[role=combobox]]:!min-h-[44px] [&_[role=combobox]]:!rounded-xl [&_[role=combobox]]:!px-2 [&_[role=combobox]]:!py-0 [&_[role=combobox]]:!text-[13.5px]"
          options={opcoes}
          value=""
          onChange={(v) => gravar(v, { minutos: opcoes.find((o) => o.value === v)?.min })}
          placeholder="Outro"
          aria-label="Outro tempo faltante"
        />
      </div>
    </div>
  )
}

/** Só durações, para a cirurgia que ainda não começou (ver `soDuracao` acima). */
function PainelDuracao({ atual, onDefinir, exemplo }) {
  const opcoes = Array.from({ length: 32 }, (_, i) => (i + 1) * 15).map((min) => ({ value: String(min), label: rotuloDuracao(min) }))
  const frase = atual ? exemplo?.(atual) : null
  return (
    <div className="space-y-2">
      <p className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-muted-foreground">Quanto tempo deve durar</p>
      <div className="grid grid-cols-4 gap-1.5">
        {ATALHOS_DURACAO_MIN.map((min) => (
          <Button
            key={min}
            variant="outline"
            aria-pressed={atual === min}
            className={['min-h-[44px] px-1 font-bold', atual === min ? 'border-primary bg-primary/15 text-primary' : ''].join(' ')}
            onClick={() => onDefinir(null, { minutos: min })}
          >
            {rotuloDuracao(min)}
          </Button>
        ))}
        <Select
          size="sm"
          className="[&_[role=combobox]]:!min-h-[44px] [&_[role=combobox]]:!rounded-xl [&_[role=combobox]]:!px-2 [&_[role=combobox]]:!py-0 [&_[role=combobox]]:!text-[13.5px]"
          options={opcoes}
          value=""
          onChange={(v) => onDefinir(null, { minutos: Number(v) })}
          placeholder="Outro"
          aria-label="Outra duração"
        />
      </div>
      <div className="flex min-h-[44px] items-center gap-2">
        <p className="min-w-0 text-[13px] leading-snug text-muted-foreground">
          {atual ? (frase || `Estimado ${rotuloDuracao(atual)}, contado do início.`) : 'Sem tempo estimado.'}
        </p>
        {atual && (
          <button
            type="button"
            className="ml-auto flex min-h-[44px] shrink-0 items-center px-1.5 text-[13.5px] font-semibold text-destructive active:opacity-70"
            onClick={() => onDefinir('', { minutos: null })}
          >
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}
