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
 *
 * ⚠️ CELULAR DEITADO: os três trilhos viram UMA linha de 42px (dono 26/08). Em
 * pé eles são três faixas empilhadas e custam 150px medidos — de 390px de tela
 * na horizontal, isso mais o cabeçalho é 67% da altura só de controle, e a
 * primeira linha da fila ficava 210px ABAIXO da borda. Deitado a largura é o que
 * sobra, então os mesmos trilhos, com a MESMA altura de toque, cabem lado a
 * lado. Nada some e nada encolhe abaixo do piso de 34px.
 */
import SegmentedSelector from './SegmentedSelector'

const ALTURA_FILTRO = 'min-h-[34px]'
const FONTE_FILTRO = 'text-[12px]'

/**
 * deitado, cada controle cresce na PROPORÇÃO do número de opções que carrega —
 * assim toda opção da barra fica com a mesma largura, venha ela do turno, do
 * hospital ou das abas (dono 26/08: "os seletores ficaram assimétricos").
 * Antes as abas levavam toda a sobra da linha e ficavam com o dobro da largura
 * por opção dos trilhos ao lado. Classes literais porque o Tailwind lê o código
 * como texto: `deitado:flex-[${n}]` não seria gerado.
 */
const CRESCE = {
  1: 'deitado:flex-[1]', 2: 'deitado:flex-[2]', 3: 'deitado:flex-[3]',
  4: 'deitado:flex-[4]', 5: 'deitado:flex-[5]', 6: 'deitado:flex-[6]',
}
const cresce = (n) => `deitado:min-w-0 ${CRESCE[n] || 'deitado:flex-[3]'}`

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
    <div className="space-y-2 deitado:flex deitado:items-center deitado:gap-2 deitado:space-y-0">
      <div className={`flex items-stretch gap-2 ${cresce((temEscolhaDeData ? opcoesData.length : 0) + turnoOpcoes.length)}`}>
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

      {/* Hospital SEMPRE visível (dono 16/08) e na mesma altura do turno.
          ⚠️ some no FIM DE SEMANA (dono 24/08): lá a fila é ÚNICA e já cobre os
          três hospitais — o seletor não filtraria nada e só faria perguntar qual
          escolher. Quem passa `null` está dizendo "não há esse eixo aqui". */}
      {hospitalOpcoes && (
        <Trilho className={cresce(hospitalOpcoes.length)} options={hospitalOpcoes} value={hospital} onChange={onEscolherHospital} />
      )}

      {/* Abas em verde sólido (dono 24/07) — separa "o que vejo" de "o que filtro".
          Também somem no fim de semana: lá existe uma tela só. */}
      {abaOpcoes && (
        <SegmentedSelector
          options={abaOpcoes}
          value={aba}
          onChange={onEscolherAba}
          variant="filled"
          // deitado os botões descem de 42px para 34px de corpo — o mesmo piso
          // dos trilhos ao lado, para a linha inteira fechar em 42px — e o corpo
          // do texto passa a ser o MESMO 12px deles (dono 26/08: "diferença de
          // tamanhos nas grafias"). Em pé as abas seguem maiores de propósito:
          // são o controle mais tocado, e lá elas têm uma faixa só para si. Aqui
          // ficam lado a lado com os filtros, e a diferença de corpo lia como
          // desalinhamento. O que continua separando "o que vejo" de "o que
          // filtro" é o verde SÓLIDO da aba ativa, não o tamanho da letra.
          className={`${cresce(abaOpcoes.length)} [&>button]:deitado:min-h-[34px] [&>button]:deitado:py-1 [&>button]:deitado:text-[12px]`}
        />
      )}
    </div>
  )
}
