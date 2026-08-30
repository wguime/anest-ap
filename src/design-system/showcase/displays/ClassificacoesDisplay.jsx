/**
 * ClassificacoesDisplay — card único de ASA · Mallampati · Cormack-Lehane.
 *
 * As três eram calculadoras separadas que devolviam a classe que o usuário
 * acabara de escolher: consulta, não cálculo. Agrupadas num card no padrão que
 * `AnticoagulantesDisplay` e `InibidoresApetiteDisplay` já usam.
 *
 * ⚠️ **O estado mora AQUI, na raiz — não dentro de `TabsContent`.** O
 * `TabsContent` do DS DESMONTA o painel inativo (`tabs.jsx:421`), então estado
 * guardado lá dentro morre ao trocar de aba e volta em branco. Isso já apagou
 * dado de paciente em outras telas do app (ver `.claude/rules/padroes-codigo.md`).
 *
 * ⚠️ O `TabsList` do DS traz `w-full` e usa flex, e no flex cada rótulo respeita
 * o próprio `min-width:auto` — "Mallampati" empurraria "ASA" e "Cormack" e as
 * três pastilhas sairiam desiguais. Daí `grid w-auto grid-cols-3` + `px-1`.
 *
 * ⚠️ O ASA é ENTRADA de outras ferramentas (a SORT e a P-POSSUM pedem a classe
 * num select próprio). Agrupar preserva as definições e os exemplos de cada
 * classe; excluir teria perdido isso.
 */
import { useState } from 'react';
import { cn } from '../../utils/tokens';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';

const ESCALAS = {
  asa: {
    rotulo: 'ASA',
    titulo: 'Estado físico — ASA',
    fonte: 'ASA Physical Status Classification System, aprovada pela ASA House of Delegates.',
    nota: 'O sufixo E marca cirurgia de emergência e é acrescentado à classe (ex.: ASA IIIE). Não é uma classe própria.',
    itens: [
      { grau: 'I', titulo: 'ASA I', desc: 'Paciente saudável' },
      { grau: 'II', titulo: 'ASA II', desc: 'Doença sistêmica leve, sem limitação funcional' },
      { grau: 'III', titulo: 'ASA III', desc: 'Doença sistêmica grave, com limitação funcional' },
      { grau: 'IV', titulo: 'ASA IV', desc: 'Doença sistêmica grave, ameaça constante à vida' },
      { grau: 'V', titulo: 'ASA V', desc: 'Moribundo; não se espera sobrevida sem a cirurgia' },
      { grau: 'VI', titulo: 'ASA VI', desc: 'Morte encefálica declarada; doador de órgãos' },
    ],
  },
  mallampati: {
    rotulo: 'Mallampati',
    titulo: 'Via aérea — Mallampati modificado',
    fonte: 'Mallampati SR et al. Can Anaesth Soc J 1985; modificação de Samsoon e Young, 1987.',
    nota: 'Classes III e IV predizem via aérea difícil. Isolada, tem baixo valor preditivo — combinar com distância tireomentoniana, abertura bucal e mobilidade cervical.',
    itens: [
      { grau: 'I', titulo: 'Classe I', desc: 'Pilares, palato mole e úvula visíveis' },
      { grau: 'II', titulo: 'Classe II', desc: 'Pilares e palato mole visíveis; úvula parcialmente oculta' },
      { grau: 'III', titulo: 'Classe III', desc: 'Apenas palato mole visível' },
      { grau: 'IV', titulo: 'Classe IV', desc: 'Apenas palato duro visível' },
    ],
  },
  cormack: {
    rotulo: 'Cormack',
    titulo: 'Laringoscopia direta — Cormack-Lehane',
    fonte: 'Cormack RS, Lehane J. Anaesthesia 1984; subdivisão de graus II e III por Yentis e Lee, 1998.',
    nota: 'Graus IIb, IIIa, IIIb e IV configuram laringoscopia difícil. A classificação é do que se VÊ à laringoscopia, não do que se previu antes.',
    itens: [
      { grau: 'I', titulo: 'Grau I', desc: 'Glote completamente visível' },
      { grau: 'IIa', titulo: 'Grau IIa', desc: 'Glote parcialmente visível' },
      { grau: 'IIb', titulo: 'Grau IIb', desc: 'Apenas aritenoides ou parte posterior da glote' },
      { grau: 'IIIa', titulo: 'Grau IIIa', desc: 'Apenas epiglote visível, pode ser elevada' },
      { grau: 'IIIb', titulo: 'Grau IIIb', desc: 'Apenas epiglote visível, aderida à faringe' },
      { grau: 'IV', titulo: 'Grau IV', desc: 'Nem epiglote nem glote visíveis' },
    ],
  },
};

function Escala({ chave, selecionado, onSelecionar }) {
  const escala = ESCALAS[chave];

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-2">{escala.titulo}</p>

      <div className="space-y-2" role="radiogroup" aria-label={escala.titulo}>
        {escala.itens.map((item) => {
          const ativo = selecionado === item.grau;
          return (
            <button
              key={item.grau}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => onSelecionar(ativo ? null : item.grau)}
              className={cn(
                'w-full flex items-start gap-3 text-left',
                'rounded-2xl border p-3 min-h-[56px]',
                'bg-card transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-primary/50',
                ativo ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-border-strong'
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center shrink-0',
                  'w-10 h-10 rounded-xl text-[13px] font-extrabold',
                  ativo ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                )}
              >
                {item.grau}
              </span>
              <span className="pt-0.5">
                <span className="block text-sm font-semibold text-foreground">{item.titulo}</span>
                <span className="block text-[13px] leading-snug text-muted-foreground">{item.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{escala.nota}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground italic">{escala.fonte}</p>
    </div>
  );
}

export function ClassificacoesDisplay() {
  // ⚠️ Na RAIZ. Dentro de `TabsContent` o estado morre na troca de aba.
  const [selecao, setSelecao] = useState({ asa: null, mallampati: null, cormack: null });

  const selecionar = (chave) => (grau) => setSelecao((prev) => ({ ...prev, [chave]: grau }));

  return (
    <Tabs defaultValue="asa" variant="default">
      {/* grid, não flex: no flex o `min-width:auto` de "Mallampati" empurraria
          as outras duas e as pastilhas sairiam desiguais. `w-auto` porque o
          TabsList do DS traz `w-full`. `px-1` porque a largura vem do grid. */}
      <TabsList aria-label="Escalas de classificação" className="grid w-auto grid-cols-3">
        {Object.entries(ESCALAS).map(([chave, escala]) => (
          <TabsTrigger key={chave} value={chave} className="w-full px-1">
            {escala.rotulo}
          </TabsTrigger>
        ))}
      </TabsList>

      {Object.keys(ESCALAS).map((chave) => (
        <TabsContent key={chave} value={chave} className="mt-3">
          <Escala chave={chave} selecionado={selecao[chave]} onSelecionar={selecionar(chave)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default ClassificacoesDisplay;
