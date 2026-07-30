/**
 * PainelTempo — FONTE ÚNICA da UI de "tempo faltante" da Escala Cirúrgica.
 *
 * Usado em três lugares que precisam concordar: o cronômetro da PESSOA (pílula do
 * card na fila e painel da linha) e o término de UMA CIRURGIA (detalhe do caso,
 * dono 29/07). Antes de 29/07 já havia duas cópias divergentes — uma delas com o
 * input de hora nativo, que abre o picker cru do browser e o dono já tinha
 * rejeitado. Um componente só evita a terceira.
 *
 * O tempo é 100% MANUAL (decisão do dono 23/07): a estimativa automática enchia a
 * coluna de "+8h53" e ninguém confiava. NÃO reintroduzir — e, pela mesma razão, o
 * total da PESSOA nunca é a soma dos tempos das cirurgias dela: estimativa que
 * estoura não converge para zero, então somar as partes só acumula o erro.
 */
import { useState } from 'react'
import { Button, Input, Select } from '@/design-system'
import { agora } from '@/lib/devClock'

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
  for (let m = passo; m <= maxMin; m += passo) out.push({ value: emMinutos(m), label: rotuloDuracao(m) })
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
  const diff = alvoMin - agoraMin
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

/** Minutos desde a meia-noite de um "HH:MM" (null se não parseia). */
function paraMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim())
  if (!m) return null
  const h = Number(m[1]); const min = Number(m[2])
  return h > 23 || min > 59 ? null : h * 60 + min
}

export default function PainelTempo({ horarios, atual, horaExata, onHoraExata, onDefinir }) {
  // `horarios` sobrescrevível só para teste; em produção são as opções de tempo
  // faltante, recalculadas a cada render (são relativas a agora).
  const opcoes = horarios || opcoesTempoFaltante()
  // PRÉVIA DO RESULTADO (dono 29/07): o campo guarda uma HORA, e sozinha ela não
  // diz o que importa — "16:15" exige o usuário calcular de cabeça quanto falta.
  // Mostrar os dois lados tira a conta do plantonista.
  const valor = horaExata || atual || ''
  const alvo = paraMinutos(valor)
  const agoraD = agora()
  const restante = alvo != null ? formatFaltante(alvo, agoraD.getHours() * 60 + agoraD.getMinutes()) : null

  // CAMPO DE HORÁRIO MASCARADO: `null` = não está sendo editado, então mostra o
  // valor salvo. Grava só quando a hora está COMPLETA e válida — "18:3" no meio da
  // digitação não pode virar um término gravado.
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

  return (
    <div className="space-y-3">
      {/* DUAS ENTRADAS, UMA OU OUTRA (dono 29/07): quem está em sala às vezes pensa
          "falta uma hora" e às vezes já sabe "termina 18:30". Obrigar a converter
          de cabeça é o que fazia o campo ser deixado em branco.
          Os dois gravam o MESMO "HH:MM" — o banco guarda a hora, que é o dado
          estável (duração salva envelhece sozinha; hora não).
          GRAVA NA ESCOLHA: antes só o botão gravava, e o 2º toque era o passo que
          se perdia — nos dois caminhos que usam este painel o banco ficou sem
          NENHUM valor.
          UMA LINHA SÓ: rótulos e divisor gastavam quatro linhas num painel que já
          estourava a altura do sheet. Os placeholders carregam o significado
          ("Falta" à esquerda, "18:30" à direita) e a prévia abaixo diz o resultado
          em palavras. */}
      <div className="flex items-stretch gap-1.5">
        {/* duração: é AÇÃO, não estado — volta ao placeholder depois de escolher.
            O estado aparece no campo de horário e na prévia. */}
        {/* SIMÉTRICOS (dono 29/07): `flex-1 basis-0` dá aos dois a MESMA largura,
            independente do texto dentro. Antes o "Falta" tomava todo o espaço
            sobrando e o horário ficava num quadradinho de 86px. */}
        <Select className="min-w-0 flex-1 basis-0" options={opcoes} value=""
          onChange={(v) => { onHoraExata(v); onDefinir(v) }}
          placeholder="Falta" aria-label="Tempo faltante" />
        <span className="shrink-0 self-center text-xs text-muted-foreground">ou</span>
        {/* horário digitado com máscara — teclado numérico no celular. Digitação
            MANTIDA por decisão do dono: dos componentes prontos pesquisados, os
            que passam a régua do projeto (React Aria TimeField, OpenStatus
            TimePicker) também exigem digitar, e a roleta (react-mobile-picker)
            tem 357★, abaixo do mínimo de 1k. */}
        <Input
          data-slot="termino-hora"
          className="min-w-0 flex-1 basis-0 text-center"
          value={horaTexto}
          onChange={(e) => digitarHora(e.target.value)}
          inputMode="numeric"
          maxLength={5}
          placeholder="18:30"
          aria-label="Horário de término"
        />
      </div>

      {/* AÇÕES LADO A LADO ABAIXO DOS CAMPOS (dono 29/07): mesmo tamanho e forma,
          cores diferentes — "Definir" em verde sólido (ação principal) e "Limpar"
          em contorno vermelho (apagar não pode ter o mesmo peso visual de gravar).
          Os DOIS aparecem sempre, desde o primeiro render: layout que muda de
          forma conforme o estado obriga a reprocurar o botão a cada vez. Sem
          valor, "Limpar" fica desabilitado — não há o que apagar, e desabilitado
          é honesto onde esconder seria confuso. */}
      <div className="flex items-stretch gap-2">
        <Button
          className="min-w-0 flex-1 basis-0"
          disabled={!(horaExata || atual)}
          onClick={() => onDefinir(horaExata || atual)}
        >
          Definir
        </Button>
        <Button
          variant="outline"
          className="min-w-0 flex-1 basis-0 border-destructive text-destructive hover:bg-destructive/10"
          disabled={!atual}
          onClick={() => onDefinir('')}
        >
          Limpar
        </Button>
      </div>

      {restante && (
        <p className={['text-xs', restante.atrasada ? 'text-warning' : 'text-muted-foreground'].join(' ')}>
          {restante.atrasada
            ? `Passou de ${valor} — ${restante.texto.replace('+', '')} além do previsto.`
            : `Acaba às ${valor} · faltam ${restante.texto.replace('~', '')}.`}
        </p>
      )}
    </div>
  )
}
