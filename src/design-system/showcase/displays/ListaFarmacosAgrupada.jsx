/**
 * Lista de fármacos agrupada por classe e por MEDICAÇÃO, mais a tela das
 * variantes de uma medicação.
 *
 * Componente único consumido pelos cards de Anticoagulantes e de Inibidores
 * de apetite. Existe por pedido do dono (25/08): "a lista ficou muito extensa
 * e com medicações repetidas, organize a mesma medicação num único card" — e
 * "faça isso também com os anticoagulantes", que é o caso grave (30 linhas
 * para 22 medicações; só a HNF ocupava 4).
 *
 * ⚠️ As variantes abrem em OUTRA TELA, não em sanfona (dono 25/08, 2ª rodada:
 * *"quero que o usuário clique no card e apareçam as opções numa outra
 * página"*). A primeira versão expandia no lugar e mostrava um badge com a
 * contagem — os dois foram reprovados, e a seta que os substituiu também
 * ("retire as setas", mesma tarde): ela só existia nos cartões de grupo e
 * deixava a margem direita da lista irregular. O cartão de grupo é igual aos
 * outros; quem diz que há mais lá dentro é a linha das apresentações.
 *
 * Fica num arquivo próprio para os dois cards não divergirem: a única coisa
 * que muda entre eles é ONDE mora o número do badge, que entra por
 * `lerResumo`.
 */

import { ArrowLeft } from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { agruparVariantes, resumoDoGrupo } from '../../../lib/agrupamentoFarmacos';

/** Nome do fármaco em 16px/700 — o h4 do DS. É o que se procura na lista. */
const NOME = 'text-base font-bold text-foreground leading-tight';
const APOIO = 'text-xs text-muted-foreground leading-snug';

/** Corpo comum ao cartão único e ao da variante. */
function Corpo({ titulo, regime, comerciais, resumo }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={NOME}>{titulo}</p>
        {regime && <p className={cn(APOIO, 'mt-0.5')}>{regime}</p>}
        {/* sem truncate: o nome comercial é como a droga chega na prescrição
            e na fala do paciente — cortar "Rybelsus" esconde o dado */}
        {comerciais?.length > 0 && <p className={cn(APOIO, 'mt-0.5')}>{comerciais.join(' · ')}</p>}
      </div>
      {resumo && (
        <Badge variant="default" badgeStyle="subtle" className="shrink-0">
          {resumo}
        </Badge>
      )}
    </div>
  );
}

function CartaoBotao({ largura, onClick, children }) {
  return (
    <Card variant="interactive" padding="none" className={cn(largura, 'overflow-hidden')}>
      <button type="button" onClick={onClick} className="w-full min-h-[44px] px-3 py-2.5 text-left">
        {children}
      </button>
    </Card>
  );
}

/**
 * Lista principal. Medicação com mais de uma apresentação vira UM cartão que
 * leva à tela das variantes; o subtítulo já diz o que há lá dentro, então a
 * contagem não faz falta.
 */
export default function ListaFarmacosAgrupada({ grupos, largura, lerResumo, onEscolher, onAbrirGrupo }) {
  return (
    <>
      {grupos.map((grupo) => (
        <div key={grupo.classe} className="space-y-1.5">
          {/* Título da classe (dono 25/08: "estão quase invisíveis no meio
              deles"). Eram 11px/600 em `muted-foreground`, do mesmo peso dos
              rótulos DENTRO dos cartões — não separavam nada. Agora 13px/700
              em `foreground`, com a barrinha do verde institucional e respiro
              acima: o olho encontra a divisão antes de ler o texto. */}
          <div className="flex items-center gap-2 px-1 pt-3 first:pt-0">
            <span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-foreground leading-none">
              {grupo.label}
            </h3>
          </div>
          {agruparVariantes(grupo.farmacos).map((card) => {
            if (card.unico) {
              const f = card.variantes[0];
              return (
                <CartaoBotao key={card.chave} largura={largura} onClick={() => onEscolher(f.id)}>
                  <Corpo
                    titulo={card.nome}
                    regime={f.regime}
                    comerciais={f.comerciais}
                    resumo={lerResumo(f)}
                  />
                </CartaoBotao>
              );
            }

            const resumo = resumoDoGrupo(card.variantes, lerResumo);
            return (
              <CartaoBotao key={card.chave} largura={largura} onClick={() => onAbrirGrupo(card.chave)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={NOME}>{card.nome}</p>
                    <p className={cn(APOIO, 'mt-0.5')}>{card.rotulos.join(' · ')}</p>
                    {/* marcas na MESMA posição do cartão simples: 3ª linha,
                        abaixo da via/apresentação */}
                    {card.comerciais.length > 0 && (
                      <p className={cn(APOIO, 'mt-0.5')}>{card.comerciais.join(' · ')}</p>
                    )}
                  </div>
                  {/* Sem seta (dono 25/08, "retire as setas"): ela só aparecia
                      nos cartões de grupo e deixava a margem direita da lista
                      irregular. O cartão do grupo passa a ser visualmente
                      igual aos demais. */}
                  {resumo && (
                    <Badge variant="default" badgeStyle="subtle" className="shrink-0">
                      {resumo}
                    </Badge>
                  )}
                </div>
              </CartaoBotao>
            );
          })}
        </div>
      ))}
    </>
  );
}

/**
 * Tela das variantes de UMA medicação.
 *
 * O voltar mora DENTRO do cartão de cabeçalho, e não solto acima dele, pelo
 * mesmo motivo do detalhe do fármaco: solto, o header fixo da página passa
 * por cima ao rolar.
 */
export function PaginaGrupo({ card, largura, lerResumo, onVoltar, onEscolher, rotuloVoltar }) {
  if (!card) return null;
  return (
    <div className="space-y-3">
      <Card padding="none" className={cn(largura, 'overflow-hidden')}>
        <button
          type="button"
          onClick={onVoltar}
          className="w-full min-h-[44px] px-4 py-2 flex items-center gap-1.5 text-left border-b border-border text-primary"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold">{rotuloVoltar}</span>
        </button>
        <div className="p-4">
          <h3 className="text-lg font-bold text-foreground leading-tight">{card.nome}</h3>
          <p className={cn(APOIO, 'mt-0.5')}>Toque na apresentação que o paciente usa.</p>
        </div>
      </Card>

      {card.variantes.map((f) => (
        <CartaoBotao key={f.id} largura={largura} onClick={() => onEscolher(f.id)}>
          <Corpo
            titulo={f.variante || f.farmaco}
            regime={f.regime}
            comerciais={f.comerciais}
            resumo={lerResumo(f)}
          />
        </CartaoBotao>
      ))}
    </div>
  );
}
