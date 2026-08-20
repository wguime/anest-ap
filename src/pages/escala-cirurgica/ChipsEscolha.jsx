/**
 * ChipsEscolha — a pastilha de escolha única da escala cirúrgica.
 *
 * FONTE ÚNICA (dono 20/08: "implemente o sistema igual para seleção de tipo de
 * procedimento para deixar uniforme"): o cartão Andamento do detalhe do caso e o
 * "Adicionar caso" perguntam O MESMO — que tipo de cirurgia é, e quão grave —, e
 * perguntavam de dois jeitos: chips de 44px num, Select no outro. Dois controles
 * para o mesmo dado fazem a pessoa aprender a tela duas vezes.
 *
 * Desenho herdado do painel de 17/08: pastilha de 44px (alvo de toque), texto de
 * 12.5px que quebra em duas linhas em vez de truncar ("Passa para tarde" cabe), e
 * a cor SÓ no selecionado — vermelho é urgência/emergência em todo o módulo.
 */
import { GRAVIDADES, GRAVIDADE_LABEL } from '@/lib/escalaCirurgicaUrgencias'

const BASE =
  'min-h-[44px] flex-1 rounded-[10px] border px-1.5 text-[12.5px] font-semibold leading-tight transition-colors'
const INATIVO = 'border-border-strong bg-card text-foreground'

/** Tipo da cirurgia — mesma ordem e mesmas cores do badge do quadro. */
export const TIPOS_CIRURGIA = [
  { valor: 'eletiva', label: 'Eletiva' },
  { valor: 'urgencia', label: 'Urgência', cls: 'border-destructive bg-destructive/15 text-destructive' },
  { valor: 'emergencia', label: 'Emergência', cls: 'border-destructive bg-destructive text-destructive-foreground' },
]

/** Gravidade (adaptação NCEPOD) — o que ordena a fila de urgências do HRO. */
export const GRAVIDADE_CHIPS = GRAVIDADES.map((g) => ({
  valor: g,
  label: GRAVIDADE_LABEL[g],
  cls: {
    imediata: 'border-destructive bg-destructive text-destructive-foreground',
    urgente: 'border-warning bg-warning text-warning-foreground',
    aguarda: 'border-border-strong bg-foreground/80 text-background',
  }[g],
}))

/**
 * @param {{valor:string,label:string,cls?:string}[]} opcoes
 * @param {string} rotulo  texto acima (com a nota curta em peso menor)
 * @param {string} nota    complemento do rótulo — o PORQUÊ do campo
 */
export default function ChipsEscolha({ opcoes, valor, onChange, rotulo, nota, aviso, className = '' }) {
  return (
    <div className={className}>
      {rotulo && (
        <p className="mb-1.5 text-[12.5px] text-muted-foreground">
          {rotulo}
          {nota && <span className="text-[11.5px]"> — {nota}</span>}
        </p>
      )}
      <div className="flex gap-1.5">
        {opcoes.map((o) => {
          const ativo = valor === o.valor
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => onChange(o.valor)}
              className={[BASE, ativo ? (o.cls || 'border-primary bg-primary text-primary-foreground') : INATIVO].join(' ')}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {aviso && <p className="mt-1.5 text-[11.5px] text-warning">{aviso}</p>}
    </div>
  )
}
