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
import { Button, Select } from '@/design-system'
import { agora } from '@/lib/devClock'

/** Opções do Select de hora exata (padrão DS): dia inteiro em passos de 15min. */
export const HORARIOS_OPCOES = Array.from({ length: 96 }, (_, i) => {
  const v = `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`
  return { value: v, label: v }
})

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

  return (
    <div className="space-y-3">
      {/* DUAS ENTRADAS, UMA OU OUTRA (dono 29/07): quem está em sala às vezes pensa
          "falta uma hora" e às vezes já sabe "termina 18:30". Obrigar a converter
          de cabeça é o que fazia o campo ser deixado em branco.
          Os dois gravam o MESMO "HH:MM" — o banco guarda a hora, que é o dado
          estável (duração salva envelhece sozinha; hora não).
          GRAVA NA ESCOLHA: antes só o botão gravava, e o 2º toque era o passo que
          se perdia — nos dois caminhos que usam este painel o banco ficou sem
          NENHUM valor. O botão fica para quem já toca nele por hábito. */}
      <div className="flex items-stretch gap-2">
        {/* duração: é AÇÃO, não estado — volta ao placeholder depois de escolher.
            O estado aparece no seletor de horário e na prévia abaixo. */}
        <Select className="flex-1" options={opcoes} value=""
          onChange={(v) => { onHoraExata(v); onDefinir(v) }}
          placeholder="Tempo faltante" aria-label="Tempo faltante" />
        {/* `disabled` sem valor: o Select mostrava o próximo quarto de hora como
            se já estivesse escolhido — com ✓ verde e tudo — e o painel parecia
            ter um tempo definido quando não tinha nenhum. */}
        <Button
          className="h-auto self-stretch px-4"
          disabled={!(horaExata || atual)}
          onClick={() => onDefinir(horaExata || atual)}
        >
          Definir
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted-foreground">ou</span>
        {/* horário: aqui o valor salvo CASA com uma opção, então este seletor
            também serve de leitura do que está definido */}
        <Select className="flex-1" options={HORARIOS_OPCOES} value={horaExata || atual || ''}
          onChange={(v) => { onHoraExata(v); onDefinir(v) }}
          placeholder="Horário de término" aria-label="Horário de término" />
      </div>
      {restante && (
        <p className={['text-xs', restante.atrasada ? 'text-warning' : 'text-muted-foreground'].join(' ')}>
          {restante.atrasada
            ? `Passou de ${valor} — ${restante.texto.replace('+', '')} além do previsto.`
            : `Acaba às ${valor} · faltam ${restante.texto.replace('~', '')}.`}
        </p>
      )}
      {atual && (
        <Button variant="ghost" className="w-full" onClick={() => onDefinir('')}>Limpar cronômetro</Button>
      )}
    </div>
  )
}
