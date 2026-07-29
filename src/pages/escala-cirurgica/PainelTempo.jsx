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

/** Atalhos de duração a partir de agora (o caminho de 1 toque). */
export const DURACOES = [
  { label: '15min', min: 15 }, { label: '30min', min: 30 }, { label: '1h', min: 60 },
  { label: '1h30', min: 90 }, { label: '2h', min: 120 }, { label: '2h30', min: 150 },
  { label: '3h', min: 180 },
]

/** Opções do Select de hora exata (padrão DS): dia inteiro em passos de 15min. */
export const HORARIOS_OPCOES = Array.from({ length: 96 }, (_, i) => {
  const v = `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`
  return { value: v, label: v }
})

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

export default function PainelTempo({ duracoes = DURACOES, horarios = HORARIOS_OPCOES, atual, horaExata, onHoraExata, onDefinir }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {duracoes.map((d) => (
          <Button key={d.min} size="sm" variant="outline" onClick={() => onDefinir(emMinutos(d.min))}>
            {d.label}
          </Button>
        ))}
      </div>
      <div className="flex items-stretch gap-2">
        {/* GRAVA NA ESCOLHA (dono 29/07: "escolho a hora, toco em Definir e nada
            acontece"). Antes a hora só era gravada pelo botão, e o segundo toque
            era o passo que se perdia — nos dois caminhos que usam este painel
            (painel da linha e detalhe do caso) o banco ficou sem NENHUM valor.
            Mesmo padrão do seletor de residente, no mesmo sheet: ajuste de
            rotina no meio do plantão não merece passo de confirmação. O botão
            fica para quem já toca nele por hábito. */}
        <Select className="flex-1" options={horarios} value={horaExata || atual || ''}
          onChange={(v) => { onHoraExata(v); onDefinir(v) }}
          placeholder="Escolher hora…" aria-label="Hora exata de término" />
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
      {atual && (
        <Button variant="ghost" className="w-full" onClick={() => onDefinir('')}>Limpar cronômetro</Button>
      )}
    </div>
  )
}
