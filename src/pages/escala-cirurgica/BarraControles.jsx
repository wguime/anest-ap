/**
 * BarraControles — faixa de controles da Escala Cirúrgica: data (só quando há
 * escolha) · turno · hospital · abas.
 *
 * Desenho escolhido pelo dono em 16/08, depois de comparar 17 protótipos
 * ("Compacta · Verde suave"):
 *   - TRILHO (fundo `bg-muted`, ativo em `bg-primary/20` com texto `primary`)
 *     no lugar das pílulas soltas: o grupo lê como UM controle, e a tinta
 *     translúcida destaca sem competir com o verde sólido das abas;
 *   - turno e hospital na MESMA altura (34px) — o turno muda 3× por dia e o
 *     app já o troca sozinho às 7h/13h/19h, então nenhum dos dois precisa de
 *     peso extra; as abas ficam maiores por serem o controle mais tocado;
 *   - a DATA saiu da barra e virou o subtítulo do cabeçalho ("Hoje · Domingo,
 *     16/08"): o botão "Hoje" sozinho não informava nada. Ele volta como par
 *     Hoje/Amanhã só quando a escala de amanhã está publicada.
 *
 * ⚠️ Regra do dono: TODOS os controles ficam visíveis — nada de colapsar ou
 * esconder ao rolar. 34px é o piso de altura (com ~110px de largura o toque
 * segue confortável); abaixo disso o dedo erra no centro cirúrgico.
 */
import SegmentedSelector from './SegmentedSelector'

const ALTURA_FILTRO = 'min-h-[34px]'
const FONTE_FILTRO = 'text-[12px]'

/**
 * Trilho: fundo único com o item ativo em tinta translúcida do verde.
 * Um trilho = um eixo de escolha (data, turno, hospital).
 */
function Trilho({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`grid gap-1 rounded-[12px] bg-muted p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={[
              ALTURA_FILTRO, FONTE_FILTRO,
              'min-w-0 rounded-[10px] px-1.5 transition-all active:scale-95',
              'inline-flex items-center justify-center',
              active ? 'bg-primary/20 font-semibold text-primary' : 'text-muted-foreground',
            ].join(' ')}
          >
            <span className="truncate">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function BarraControles({
  opcoesData, modoData, onEscolherData,
  turnoOpcoes, turno, onEscolherTurno,
  hospitalOpcoes, hospital, onEscolherHospital,
  abaOpcoes, aba, onEscolherAba,
}) {
  // Uma opção só de data = apenas "Hoje", que não é escolha nenhuma: a linha
  // some e a data fica no subtítulo do cabeçalho.
  const temEscolhaDeData = opcoesData.length > 1

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        {temEscolhaDeData && (
          <Trilho
            className="shrink-0"
            options={opcoesData}
            value={modoData === 'outra' ? '' : modoData}
            onChange={onEscolherData}
          />
        )}
        <Trilho
          className="min-w-0 flex-1"
          options={turnoOpcoes}
          value={turno}
          onChange={onEscolherTurno}
        />
      </div>

      {/* Hospital SEMPRE visível (dono 16/08) e na mesma altura do turno */}
      <Trilho options={hospitalOpcoes} value={hospital} onChange={onEscolherHospital} />

      {/* Abas em verde sólido (dono 24/07) — separa "o que vejo" de "o que filtro" */}
      <SegmentedSelector options={abaOpcoes} value={aba} onChange={onEscolherAba} variant="filled" />
    </div>
  )
}
