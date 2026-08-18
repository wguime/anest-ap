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
import SegmentedSelector from './SegmentedSelector'

/** Atalhos de duração da grade (minutos) — o resto vive em "Outro tempo…". */
export const ATALHOS_MIN = [30, 45, 60, 90, 120, 180]

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
 */
export function fraseCronometro(alvoMin, agoraMin) {
  const f = formatFaltante(alvoMin, agoraMin)
  return f.atrasada ? fraseFaltante(f) : f.texto
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

  // MODO: qual das duas rotas está na tela. Nasce em "Horário" quando já existe
  // um valor gravado — o que está salvo é uma HORA, e escondê-la atrás da outra
  // aba faria o painel abrir sem mostrar o que já vale.
  const [modo, setModo] = useState(valor ? 'hora' : 'falta')
  const gravar = (hhmm) => { onHoraExata(hhmm); onDefinir(hhmm) }

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
          O "OU" VIROU A PRÓPRIA ESCOLHA (dono 17/08): eram dois campos lado a lado
          com um "ou" minúsculo entre eles, lidos como dois campos A PREENCHER. Com
          o alternador só um caminho existe de cada vez, e a frase abaixo diz que
          são duas maneiras de dizer a mesma coisa. */}
      <SegmentedSelector
        variant="filled"
        options={[
          { value: 'falta', label: 'Tempo faltante' },
          { value: 'hora', label: 'Horário de término' },
        ]}
        value={modo}
        onChange={setModo}
      />
      <p className="text-[12.5px] leading-snug text-muted-foreground">
        Dois jeitos de dizer a mesma coisa. Preencha um.
      </p>

      {/* ALTURA CONSTANTE (dono 17/08): as duas rotas ocupam a mesma caixa. A da
          duração é a mais alta (grade de 6 + "Outro tempo…"); sem a altura fixa, alternar
          fazia o painel encolher e crescer debaixo do dedo.
          172px = 2 fileiras de 44 + gap 8 + respiro 16 + o seletor de 44, com
          folga para o "Limpar" não encostar (dono 17/08). */}
      <div className="h-[172px]">
      {modo === 'falta' ? (
        <>
          {/* atalhos: é AÇÃO, não estado — o que vale aparece na prévia abaixo */}
          <div className="grid grid-cols-3 gap-2">
            {ATALHOS_MIN.map((min) => (
              <Button
                key={min}
                variant="outline"
                className="min-h-[44px] font-bold"
                onClick={() => gravar(emMinutos(min))}
              >
                {rotuloDuracao(min)}
              </Button>
            ))}
          </div>
          {/* respiro: sem ele o seletor encostava na fileira de atalhos e os três
              viravam um bloco só (dono 17/08) */}
          <Select className="mt-4 w-full" options={opcoes} value=""
            onChange={gravar}
            placeholder="Outro tempo…" aria-label="Outro tempo faltante" />
        </>
      ) : (
        /* horário digitado com máscara — teclado numérico no celular. Digitação
           MANTIDA por decisão do dono: dos componentes prontos pesquisados, os
           que passam a régua do projeto (React Aria TimeField, OpenStatus
           TimePicker) também exigem digitar, e a roleta (react-mobile-picker)
           tem 357★, abaixo do mínimo de 1k. */
        /* CENTRADO E ESTREITO (dono 17/08): o campo guarda quatro dígitos e
           ocupava a largura da tela — a caixa vazia parecia esperar uma frase.
           `mx-auto` com largura fixa põe o alvo debaixo do polegar. A tipografia
           vai em `[&_input]` porque o `className` do Input do DS pousa no WRAPPER:
           aplicado ali, o `text-center` centralizava a caixa e deixava os dígitos
           encostados na borda esquerda. */
        <Input
          data-slot="termino-hora"
          className="mx-auto w-[160px] [&_input]:text-center [&_input]:text-[19px] [&_input]:font-bold [&_input]:tracking-wide"
          value={horaTexto}
          onChange={(e) => digitarHora(e.target.value)}
          inputMode="numeric"
          maxLength={5}
          placeholder="18:30"
          aria-label="Horário de término"
        />
      )}
      </div>

      {/* "Definir" SAIU (dono 17/08): no caminho comum ele era um botão morto —
          atalho, seletor e campo já gravam na escolha, e ele só regravava um valor
          que já estava salvo. Ficou "Limpar", que é a única ação que sobra: sem
          valor, desabilitado (esconder seria pior que mostrar apagado). */}
      <Button
        variant="outline"
        className="w-full border-destructive text-destructive hover:bg-destructive/10"
        disabled={!atual}
        onClick={() => onDefinir('')}
      >
        Limpar
      </Button>

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
