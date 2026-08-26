/**
 * Inibidores de apetite — consulta perioperatória.
 *
 * Quatro frentes: conduta por fármaco (suspender × manter), dieta e jejum,
 * POCUS gástrico e conduta no dia. Toda a regra clínica vive em
 * src/lib/inibidoresApetite.js — aqui só a apresentação.
 *
 * O card foi construído sobre o mesmo esqueleto do de Anticoagulantes, e as
 * três armadilhas de DS descobertas lá valem aqui inteiras:
 *   1. DatePicker é `absolute` sem portal e AccordionContent anima altura com
 *      overflow-hidden → calendário dentro de sanfona sai cortado. Usar Sheet.
 *   2. TabsList traz `w-full`, que IGNORA margem negativa → passar `w-auto`.
 *   3. Alert põe o ícone numa coluna à esquerda e rouba largura de todas as
 *      linhas → ícone dentro do título e coluna colapsada.
 *
 * ⚠️ O resultado de qualquer campo digitado aparece ACIMA dos campos, não
 * abaixo: com o teclado do celular aberto, resultado embaixo cai fora da tela
 * e digitar parece não fazer nada (relato do dono no card anterior, 25/08).
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Info, Search, Siren } from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { Alert } from '../../components/ui/alert';
import { Checkbox } from '../../components/ui/checkbox';
import { Switch } from '../../components/ui/switch';
import { DatePicker } from '../../components/ui/date-picker';
import { TimePicker } from '../../components/ui/time-picker';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../components/ui/accordion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import ListaFarmacosAgrupada, { PaginaGrupo } from './ListaFarmacosAgrupada';
import { agruparVariantes } from '../../../lib/agrupamentoFarmacos';
import {
  INIBIDORES,
  FATORES_RISCO,
  DIETA,
  POCUS_QUANDO,
  POCUS_PASSOS,
  PERLAS_GRAUS,
  AVISO_JEJUM_NAO_BASTA,
  CONDUTA_ALTO_RISCO,
  PRE_ANESTESICA,
  COMPARATIVO,
  COMEDICACAO,
  REFERENCIAS,
  DURACAO,
  agruparPorClasse,
  areaAntral,
  avaliarPreOperatorio,
  buscarFarmacos,
  classificarPocus,
  volumeGastrico,
} from '../../../lib/inibidoresApetite';

// =============================================================================
// PEÇAS DE APRESENTAÇÃO (só composição de componentes do DS)
// =============================================================================

/**
 * Largura do card: a MESMA da conferência da escala cirúrgica — 16px de
 * margem lateral. O wrapper da página de calculadora tem 24px de padding e é
 * compartilhado pelas 70 calculadoras; -mx-2 desconta 8px e fecha os 16px.
 */
const LARGURA = '-mx-2';

/** Colapsa a coluna do ícone do Alert do DS (ver cabeçalho). */
const SEM_COLUNA_DE_ICONE = '[&>div>div:first-child]:hidden';

const TOM_BADGE = { success: 'success', warning: 'warning', destructive: 'destructive', info: 'secondary' };
/** O herói do veredito: verde quando pode manter, vermelho no alto risco. */
const TEXTO_TOM = {
  success: 'text-primary',
  warning: 'text-foreground',
  destructive: 'text-destructive',
  info: 'text-foreground',
};

/** Número no padrão brasileiro — toFixed devolve PONTO e o resto do card usa vírgula. */
const numeroBr = (n, casas = 0) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

function TituloAlerta({ icone: Icone, children }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icone className="w-4 h-4 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

function Bloco({ titulo, acessorio, children, className, padding = 'md' }) {
  return (
    <Card padding={padding} className={cn(LARGURA, 'space-y-2.5', className)}>
      {(titulo || acessorio) && (
        <div className="flex items-center justify-between gap-2">
          {titulo && <h3 className="text-sm font-bold text-foreground leading-tight">{titulo}</h3>}
          {acessorio}
        </div>
      )}
      {children}
    </Card>
  );
}

function Lista({ itens, marcador = 'ponto' }) {
  return (
    <ul className="space-y-1.5">
      {itens.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-muted-foreground">
          <span className="shrink-0 text-primary font-semibold tabular-nums">
            {marcador === 'numero' ? `${i + 1}.` : '•'}
          </span>
          <span className="leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function LinhaDado({ rotulo, valor, destaque = false, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">{rotulo}</p>
        {children}
      </div>
      <span
        className={cn(
          'shrink-0 text-right leading-tight tabular-nums text-foreground',
          destaque ? 'text-base font-bold' : 'text-sm font-semibold'
        )}
      >
        {valor}
      </span>
    </div>
  );
}

/** Card do DS que embrulha um Accordion sem borda dupla. */
function CardSanfona({ children, className }) {
  return (
    <Card padding="none" className={cn(LARGURA, 'overflow-hidden', className)}>
      <Accordion type="single" collapsible>
        {children}
      </Accordion>
    </Card>
  );
}

function ItemSanfona({ valor, titulo, children }) {
  return (
    <AccordionItem value={valor}>
      <AccordionTrigger className="px-4">
        <span className="text-sm font-semibold text-left pr-2">{titulo}</span>
      </AccordionTrigger>
      <AccordionContent className="px-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

// =============================================================================
// ABA 1 — PRÉ-OP
// =============================================================================

/**
 * O estado da Pré-op mora no componente RAIZ, não aqui.
 *
 * ⚠️ `TabsContent` DESMONTA o painel inativo. Com o estado local, tocar em
 * "No dia" e voltar descartava o fármaco aberto E a avaliação do paciente
 * inteira — os 17 fatores marcados, a data e a hora da última dose, o toggle
 * do POCUS. Medido em 26/08: abrir Liraglutida → No dia → Pré-op devolvia a
 * lista, calado. Subindo o estado, a troca de aba não perde nada.
 *
 * `painelAberto` fica de fora de propósito: uma folha aberta não deve
 * sobreviver a uma troca de aba.
 */
function useEstadoPreOp() {
  const [termo, setTermo] = useState('');
  const [farmacoId, setFarmacoId] = useState(null);
  const [grupoId, setGrupoId] = useState(null);
  const [fatores, setFatores] = useState([]);
  const [pocusDisponivel, setPocusDisponivel] = useState(false);
  const [data, setData] = useState(null);
  const [hora, setHora] = useState('');
  return {
    termo, setTermo,
    farmacoId, setFarmacoId,
    grupoId, setGrupoId,
    fatores, setFatores,
    pocusDisponivel, setPocusDisponivel,
    data, setData,
    hora, setHora,
  };
}

function SelecaoFarmaco({ estado }) {
  const {
    termo, setTermo,
    farmacoId, setFarmacoId,
    grupoId, setGrupoId,
    fatores, setFatores,
    pocusDisponivel, setPocusDisponivel,
    data, setData,
    hora, setHora,
  } = estado;
  const [painelAberto, setPainelAberto] = useState(false);

  const grupos = useMemo(() => agruparPorClasse(buscarFarmacos(termo)), [termo]);

  /* A tela do grupo sai da base COMPLETA, não do resultado da busca: quem
     pediu a medicação quer ver todas as apresentações dela, mesmo que o termo
     digitado só casasse com uma. */
  const cardGrupo = useMemo(
    () => (grupoId ? agruparVariantes(INIBIDORES).find((c) => c.chave === grupoId) : null),
    [grupoId]
  );
  const lerResumo = (f) => f.suspensao?.resumo;

  /** Data (DatePicker) + hora (TimePicker) → um instante só. */
  const ultimaDose = useMemo(() => {
    if (!data) return null;
    const d = new Date(data);
    const [h, m] = (hora || '00:00').split(':');
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    return d;
  }, [data, hora]);

  const avaliacao = useMemo(
    () => avaliarPreOperatorio({ farmacoId, fatores, pocusDisponivel, ultimaDose }),
    [farmacoId, fatores, pocusDisponivel, ultimaDose]
  );

  const alternarFator = (id) =>
    setFatores((atual) => (atual.includes(id) ? atual.filter((f) => f !== id) : [...atual, id]));

  // ------------------------------------------- APRESENTAÇÕES DE UMA MEDICAÇÃO
  if (!avaliacao && cardGrupo) {
    return (
      <PaginaGrupo
        card={cardGrupo}
        largura={LARGURA}
        lerResumo={lerResumo}
        rotuloVoltar="Todos os fármacos"
        onVoltar={() => setGrupoId(null)}
        onEscolher={setFarmacoId}
      />
    );
  }

  // ------------------------------------------------------------------ LISTA
  if (!avaliacao) {
    return (
      <div className="space-y-3">
        <Input
          type="search"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Nome ou marca (ex.: Mounjaro)"
          leftIcon={<Search className="size-5" aria-hidden="true" />}
          aria-label="Buscar inibidor de apetite"
          className={LARGURA}
        />

        {grupos.length === 0 && (
          <Bloco>
            <p className="text-sm text-muted-foreground">Nenhum fármaco encontrado para “{termo}”.</p>
          </Bloco>
        )}

        <ListaFarmacosAgrupada
          grupos={grupos}
          largura={LARGURA}
          lerResumo={lerResumo}
          onEscolher={setFarmacoId}
          onAbrirGrupo={setGrupoId}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------- DETALHE
  const { farmaco, conduta, explicacao, liberacao, avisos, passos, fatoresAtivos, foraDoAlgoritmo } = avaliacao;

  const preenchidos = [
    fatoresAtivos.length > 0 && `${fatoresAtivos.length} fator${fatoresAtivos.length > 1 ? 'es' : ''}`,
    pocusDisponivel && 'POCUS disponível',
    ultimaDose && 'última dose',
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      {/* Identificação — o voltar mora DENTRO do card: solto acima dele, o
          header fixo da página passa por cima ao rolar */}
      <Card padding="none" className={cn(LARGURA, 'overflow-hidden')}>
        <button
          type="button"
          onClick={() => setFarmacoId(null)}
          className="w-full min-h-[44px] px-4 py-2 flex items-center gap-1.5 text-left border-b border-border text-primary"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          {/* devolve à tela do grupo quando foi por ela que se chegou aqui */}
          <span className="text-sm font-semibold">{cardGrupo ? cardGrupo.nome : 'Todos os fármacos'}</span>
        </button>
        <div className="p-4 space-y-2">
          <div>
            <h3 className="text-lg font-bold text-foreground leading-tight">{farmaco.farmaco}</h3>
            <p className="text-sm text-muted-foreground leading-snug">{farmaco.regime}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" badgeStyle="subtle">{farmaco.via}</Badge>
            {farmaco.duracao && (
              <Badge variant="secondary" badgeStyle="solid">{DURACAO[farmaco.duracao]?.label}</Badge>
            )}
            {farmaco.comerciais?.map((c) => (
              <Badge key={c} variant="secondary" badgeStyle="outline">{c}</Badge>
            ))}
          </div>
          <div className="divide-y divide-border">
            <LinhaDado rotulo="Meia-vida" valor={farmaco.meiaVida} />
            {farmaco.dosesTipicas && (
              <LinhaDado rotulo="Doses usuais" valor="">
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{farmaco.dosesTipicas}</p>
              </LinhaDado>
            )}
          </div>
        </div>
      </Card>

      {/* UM card para o veredito (dono 26/08: "informação duplicada, exclua o
          card amarelo"). O alerta acima repetia o que este card já dizia.
          ⚠️ O herói é a FRASE do veredito, não o número: no caso "manter", um
          "7 dias antes" em corpo 24 diria o OPOSTO da conduta — por isso o
          intervalo desce para `conduta.alternativa`. */}
      <Bloco
        titulo="Suspensão"
        acessorio={
          <Badge variant={TOM_BADGE[conduta.tom] || 'secondary'} badgeStyle="subtle" className="shrink-0">
            {conduta.chip}
          </Badge>
        }
      >
        <div>
          <p className={cn('text-2xl font-bold leading-none', TEXTO_TOM[conduta.tom] || 'text-foreground')}>
            {conduta.heroi}
          </p>
          {explicacao && (
            <p className="text-sm text-muted-foreground leading-snug mt-1.5">{explicacao}</p>
          )}
          {conduta.alternativa && (
            <p className="text-sm font-semibold text-foreground leading-snug mt-1.5">
              {conduta.alternativa}
            </p>
          )}
          {liberacao && (
            <p
              className={cn(
                'text-sm font-semibold leading-snug mt-1.5',
                liberacao.cumprido ? 'text-primary' : 'text-warning'
              )}
            >
              {liberacao.cumprido ? 'Cumprido em' : 'Completa em'} {liberacao.texto} · {liberacao.falta}
            </p>
          )}
        </div>

        {/* De onde vem o número. A nota da SBA cobre SÓ GLP-1 e coagonistas —
            sem dizer isso, a tela sugere que ela também manda suspender
            sibutramina por 7 dias. */}
        <div className="flex items-start gap-2">
          <Badge
            variant={farmaco.fonteSuspensao.orgao === 'SBA' ? 'success' : 'secondary'}
            badgeStyle={farmaco.fonteSuspensao.orgao === 'SBA' ? 'solid' : 'outline'}
            className="shrink-0"
          >
            {farmaco.fonteSuspensao.orgao}
          </Badge>
          <span className="text-xs text-muted-foreground leading-snug min-w-0 pt-1">
            {farmaco.fonteSuspensao.detalhe}
          </span>
        </div>

        <div className="border-t border-border pt-2.5">
          <p className="text-sm font-semibold text-foreground leading-snug">Reintrodução</p>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">{farmaco.reinicio}</p>
        </div>
      </Bloco>

      {!foraDoAlgoritmo && passos.length > 0 && (
        <Bloco titulo="Vale para este paciente, decida o que decidir">
          <Lista itens={passos} marcador="numero" />
        </Bloco>
      )}

      {avisos.length > 0 && (
        <Alert
          variant="warning"
          title={<TituloAlerta icone={AlertTriangle}>Atenção com este fármaco</TituloAlerta>}
          className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
        >
          <Lista itens={avisos} />
        </Alert>
      )}

      {/* Avaliação em SHEET, não em sanfona: tem DatePicker dentro (ver
          cabeçalho) e ainda tira ~400px da tela de consulta */}
      <Card padding="none" className={cn(LARGURA, 'overflow-hidden')}>
        <button
          type="button"
          onClick={() => setPainelAberto(true)}
          className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Avaliação do paciente</span>
            {preenchidos.length > 0 ? (
              <span className="block text-xs text-primary leading-snug">{preenchidos.join(' · ')}</span>
            ) : (
              <span className="block text-xs text-muted-foreground leading-snug">
                Fatores de risco, estrutura do serviço e horário da última dose
              </span>
            )}
          </div>
          <Badge
            variant={fatoresAtivos.length > 0 ? 'destructive' : preenchidos.length > 0 ? 'success' : 'secondary'}
            badgeStyle="subtle"
            className="shrink-0"
          >
            {preenchidos.length > 0 ? 'Editar' : 'Informar'}
          </Badge>
        </button>
      </Card>

      {farmaco.interacoes?.length > 0 && (
        <CardSanfona>
          <ItemSanfona valor="interacoes" titulo="Interações e plano anestésico">
            <Lista itens={farmaco.interacoes} />
          </ItemSanfona>
          {farmaco.notas?.sba && (
            <ItemSanfona valor="sba" titulo="Nota da SBA">
              <p className="text-sm leading-snug">{farmaco.notas.sba}</p>
            </ItemSanfona>
          )}
          {farmaco.notas?.internacional && (
            <ItemSanfona valor="int" titulo="Contraponto internacional">
              <p className="text-sm leading-snug">{farmaco.notas.internacional}</p>
            </ItemSanfona>
          )}
        </CardSanfona>
      )}

      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        {/* !h-auto: POSITION_CLASSES.bottom do DS fixa h-[85vh], não max-h —
            sem isso a folha nasce com 85% da tela quase vazia */}
        <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
          <SheetHeader>
            <SheetTitle>Avaliação do paciente</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-2.5">
            {/* Resultado no TOPO: é o que muda enquanto se marca */}
            <Card padding="sm" variant="flat" className="border-border-strong">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {farmaco.farmaco}
              </p>
              <p
                className={cn(
                  'text-base font-bold leading-tight',
                  conduta.tom === 'destructive' && 'text-destructive',
                  conduta.tom === 'warning' && 'text-warning',
                  conduta.tom === 'success' && 'text-primary',
                  conduta.tom === 'info' && 'text-foreground'
                )}
              >
                {conduta.titulo}
              </p>
              {liberacao && (
                <p className="text-sm font-semibold text-primary leading-snug">
                  {liberacao.cumprido ? 'Intervalo cumprido' : 'Completa'} {liberacao.texto} · {liberacao.falta}
                </p>
              )}
              {fatoresAtivos.length === 0 && (
                <p className="text-xs text-muted-foreground leading-snug">
                  Nenhum fator marcado. A ausência de sintomas não exclui resíduo gástrico.
                </p>
              )}
            </Card>

            <Switch
              checked={pocusDisponivel}
              onChange={setPocusDisponivel}
              label="POCUS gástrico disponível no centro cirúrgico"
              description="Sistemático, por profissional treinado e com aparelho no local. Sem isso, manter o fármaco não é opção."
            />

            <DatePicker
              label="Data da última aplicação"
              value={data}
              onChange={setData}
              placeholder="Selecione a data"
            />
            <TimePicker label="Hora da última aplicação" value={hora} onChange={setHora} step={15} />

            {FATORES_RISCO.map((grupo) => (
              <div key={grupo.grupo} className="space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {grupo.label} · {grupo.fonte}
                </p>
                {grupo.itens.map((item) => (
                  <Checkbox
                    key={item.id}
                    size="sm"
                    checked={fatores.includes(item.id)}
                    onChange={() => alternarFator(item.id)}
                    label={item.label}
                    description={item.detalhe || undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// =============================================================================
// ABA 1 (composição) — a decisão, e o que ela manda prescrever
// =============================================================================

/**
 * Título de seção — gêmeo do que ListaFarmacosAgrupada usa para a classe do
 * fármaco. Barrinha do verde institucional + 13px/700: os de 11px/600 em
 * `muted-foreground` sumiam no meio dos cartões (dono 25/08).
 */
function TituloSecao({ children }) {
  return (
    <div className="flex items-center gap-2 px-1 pt-3">
      <span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-foreground leading-none">
        {children}
      </h3>
    </div>
  );
}

function AbaPreOp({ estado }) {
  return (
    <div className="space-y-3">
      <SelecaoFarmaco estado={estado} />

      {/* A dieta era uma ABA (dono 26/08 mandou reorganizar por momento): ela
          não é assunto paralelo, é o que a decisão acima manda prescrever. E
          a regra dela já aparecia como passo 1 do veredito — 100% de
          sobreposição, medida por trigramas. */}
      <TituloSecao>O que prescrever</TituloSecao>
      <Alert
        variant="warning"
        title={<TituloAlerta icone={AlertTriangle}>Vale para todos, suspendendo ou não</TituloAlerta>}
        className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
      >
        {DIETA.regra}
      </Alert>
      <Bloco titulo="Líquidos sem resíduos — pode">
        <Lista itens={DIETA.permitidos} />
      </Bloco>
      <Bloco titulo="Não pode">
        <Lista itens={DIETA.proibidos} />
        <p className="text-xs text-muted-foreground leading-snug pt-1">{DIETA.nota}</p>
      </Bloco>

      <TituloSecao>Na avaliação pré-anestésica</TituloSecao>
      {PRE_ANESTESICA.map((bloco) => (
        <Bloco key={bloco.id} titulo={bloco.titulo}>
          <Lista itens={bloco.itens} />
        </Bloco>
      ))}
    </div>
  );
}

// =============================================================================
// ABA 2 — NO DIA
// =============================================================================

const POCUS_VAZIO = { ap: '', cc: '', idade: '', peso: '' };

function AbaNoDia() {
  const [medidas, setMedidas] = useState(POCUS_VAZIO);
  const [solido, setSolido] = useState(false);

  const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const acsa = useMemo(() => areaAntral({ ap: num(medidas.ap), cc: num(medidas.cc) }), [medidas.ap, medidas.cc]);
  const volume = useMemo(() => volumeGastrico({ acsa, idade: num(medidas.idade) }), [acsa, medidas.idade]);
  const achado = useMemo(
    () => classificarPocus({ solido, volumeMl: volume, pesoKg: num(medidas.peso) }),
    [solido, volume, medidas.peso]
  );

  const setCampo = (campo) => (e) => setMedidas((m) => ({ ...m, [campo]: e.target.value }));

  const sintomas = FATORES_RISCO.find((g) => g.grupo === 'farmaco')?.itens.find((i) => i.id === 'sintomas_tgi');

  return (
    <div className="space-y-3">
      {/* Três passos na ordem em que acontecem com o paciente na frente — era
          o que as abas Jejum/POCUS/Conduta partiam em três telas. */}
      <TituloSecao>1 · Reavaliar na admissão</TituloSecao>
      <Bloco>
        <Lista
          itens={[
            'Confirme a data e a hora da última aplicação.',
            sintomas?.detalhe || '',
            'Confirme se a dieta líquida sem resíduos foi cumprida nas últimas 24 h.',
          ].filter(Boolean)}
        />
      </Bloco>
      {/* ⚠️ variant "error", não "destructive": o Alert do DS não tem essa
          variante e cai calado no `default`, que é fundo de card. */}
      <Alert
        variant="error"
        title={<TituloAlerta icone={Siren}>O jejum não basta aqui</TituloAlerta>}
        className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
      >
        {AVISO_JEJUM_NAO_BASTA}
      </Alert>

      <TituloSecao>2 · POCUS gástrico</TituloSecao>
      {/* Verde, não azul (dono 26/08): o azul do `info` lia como fora do DS. */}
      <Alert
        variant="success"
        title={<TituloAlerta icone={Info}>Quando fazer</TituloAlerta>}
        className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
      >
        <Lista itens={POCUS_QUANDO} />
      </Alert>

      <Bloco titulo="Volume gástrico estimado">
        {/* Resultado ACIMA dos campos: com o teclado aberto, resultado embaixo
            cai fora da tela e digitar parece não fazer nada */}
        <Card padding="sm" variant="flat" className="border-border-strong space-y-0.5">
          {achado ? (
            <>
              <p
                className={cn(
                  'text-base font-bold leading-tight',
                  achado.risco === 'alto' ? 'text-destructive' : 'text-primary'
                )}
              >
                {achado.titulo}
              </p>
              {achado.mlPorKg != null && (
                <p className="text-sm font-semibold text-foreground tabular-nums">
                  {numeroBr(volume)} mL · {numeroBr(achado.mlPorKg, 2)} mL/kg
                  {acsa && <span className="text-muted-foreground font-normal"> · ACSA {numeroBr(acsa, 1)} cm²</span>}
                </p>
              )}
              <p className="text-sm leading-snug text-muted-foreground">{achado.conduta}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground leading-snug">
              Informe os dois diâmetros do antro, a idade e o peso — ou marque conteúdo sólido, que decide sozinho.
            </p>
          )}
        </Card>

        <Switch
          checked={solido}
          onChange={setSolido}
          label="Conteúdo sólido ou particulado"
          description="Padrão de vidro fosco. Independe de volume: é alto risco por si."
        />

        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            inputMode="decimal"
            label="Diâmetro AP (cm)"
            value={medidas.ap}
            onChange={setCampo('ap')}
            placeholder="3,2"
            disabled={solido}
          />
          <Input
            type="number"
            inputMode="decimal"
            label="Diâmetro CC (cm)"
            value={medidas.cc}
            onChange={setCampo('cc')}
            placeholder="4,1"
            disabled={solido}
          />
          <Input
            type="number"
            inputMode="numeric"
            label="Idade (anos)"
            value={medidas.idade}
            onChange={setCampo('idade')}
            placeholder="58"
            disabled={solido}
          />
          <Input
            type="number"
            inputMode="numeric"
            label="Peso (kg)"
            value={medidas.peso}
            onChange={setCampo('peso')}
            placeholder="82"
            disabled={solido}
          />
        </div>

        <p className="text-xs text-muted-foreground leading-snug">
          Fórmula de Perlas em decúbito lateral direito: volume = 27,0 + 14,6 × ACSA − 1,28 × idade. Validada em
          adultos não gestantes com IMC abaixo de 40. O corte é 1,5 mL/kg.
        </p>
      </Bloco>

      <Bloco titulo="Como examinar">
        <Lista itens={POCUS_PASSOS} marcador="numero" />
      </Bloco>

      <TituloSecao>3 · O achado decide</TituloSecao>
      {PERLAS_GRAUS.map((g) => (
        <Card key={g.titulo} padding="sm" className={cn(LARGURA, 'space-y-0.5')}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-tight">{g.titulo}</p>
            <Badge
              variant={g.risco === 'alto' ? 'destructive' : 'success'}
              badgeStyle="subtle"
              className="shrink-0"
            >
              {g.risco === 'alto' ? 'Alto risco' : 'Baixo risco'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{g.descricao}</p>
          <p className="text-xs font-semibold text-foreground leading-snug">{g.conduta}</p>
        </Card>
      ))}

      <Alert
        variant="error"
        title={<TituloAlerta icone={Siren}>Estômago cheio confirmado ou suspeito</TituloAlerta>}
        className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
      >
        <Lista itens={CONDUTA_ALTO_RISCO} />
      </Alert>
    </div>
  );
}

// =============================================================================
// ABA 3 — REFERÊNCIA
// =============================================================================

function AbaReferencia() {
  return (
    <div className="space-y-3">
      {/* Os 17 fatores só existiam DENTRO da folha "Avaliação do paciente",
          que exige escolher um fármaco antes — a pergunta mais consultável do
          card não tinha tela (achado da investigação de 26/08). */}
      <TituloSecao>Quem é alto risco</TituloSecao>
      <p className="text-sm text-muted-foreground leading-snug px-1">
        Um fator basta. A ausência de sintomas gastrointestinais NÃO exclui resíduo gástrico aumentado.
      </p>
      {FATORES_RISCO.map((grupo) => (
        <Bloco
          key={grupo.grupo}
          titulo={grupo.label}
          acessorio={
            <Badge variant="secondary" badgeStyle="outline" className="shrink-0">
              {grupo.fonte}
            </Badge>
          }
        >
          <ul className="space-y-2">
            {grupo.itens.map((item) => (
              <li key={item.id} className="flex gap-2 text-sm">
                <span className="shrink-0 text-primary font-semibold">•</span>
                <span className="leading-snug">
                  <span className="font-medium text-foreground">{item.label}</span>
                  {item.detalhe && (
                    <span className="block text-xs text-muted-foreground leading-snug">{item.detalhe}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      ))}

      <TituloSecao>O que cada sociedade recomenda</TituloSecao>
      <p className="text-sm text-muted-foreground leading-snug px-1">
        A conduta deste card segue a SBA. As demais entram como contraponto, para quando o caso ou o protocolo
        do serviço pedirem outra leitura.
      </p>
      {COMPARATIVO.map((c) => (
        <Card key={c.id} padding="sm" className={cn(LARGURA, 'space-y-1.5')}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-foreground leading-tight">{c.fonte}</p>
            {c.principal && (
              <Badge variant="success" badgeStyle="solid" className="shrink-0">
                Adotada
              </Badge>
            )}
          </div>
          <div className="divide-y divide-border">
            <LinhaDado rotulo="Suspensão" valor="">
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">{c.suspensao}</p>
            </LinhaDado>
            <LinhaDado rotulo="Dieta" valor="">
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">{c.dieta}</p>
            </LinhaDado>
            <LinhaDado rotulo="Ultrassom gástrico" valor="">
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">{c.pocus}</p>
            </LinhaDado>
          </div>
        </Card>
      ))}

      <TituloSecao>Co-medicação que viaja junto</TituloSecao>
      <CardSanfona>
        {COMEDICACAO.map((c) => (
          <ItemSanfona key={c.id} valor={c.id} titulo={c.titulo}>
            <p className="text-sm leading-snug">{c.detalhe}</p>
          </ItemSanfona>
        ))}
      </CardSanfona>

      <TituloSecao>Referências</TituloSecao>
      <Bloco>
        <ul className="space-y-2.5">
          {REFERENCIAS.map((r) => (
            <li key={r.id}>
              <p className="text-sm font-medium text-foreground leading-snug">{r.titulo}</p>
              <p className="text-xs text-muted-foreground leading-snug">{r.detalhe}</p>
            </li>
          ))}
        </ul>
      </Bloco>
    </div>
  );
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function InibidoresApetiteDisplay() {
  const estado = useEstadoPreOp();
  /* Dentro de um fármaco (ou das apresentações de um), a barra de abas some.
     ⚠️ Encostada num cartão intitulado "Liraglutida", ela lia como sub-abas
     DAQUELE remédio — "Liraglutida: Pré-op / No dia / Referência" — em vez de
     abas da página (dono 26/08). Escondê-la também fecha o único caminho para
     sair do fármaco por engano: resta o "← Todos os fármacos", que é
     explícito. A imersão é DERIVADA do estado, não avisada por callback. */
  const imerso = Boolean(estado.farmacoId || estado.grupoId);

  return (
    <div className="space-y-3">
      {/* TRÊS abas, por MOMENTO, não por assunto (dono 26/08, depois da
          investigação): quem abre o card tem um paciente e um instante — ou
          está na pré-anestésica, ou está com o paciente na sala. As quatro
          antigas partiam a mesma decisão em duas telas (Fármacos mandava
          fazer POCUS, POCUS dizia como) e juntavam momentos diferentes numa
          só (o comparativo, de gabinete, ao lado da broncoaspiração, de
          emergência). "Pré-op" é o mesmo vocabulário do card de
          Anticoagulantes, na mesma seção. */}
      <Tabs defaultValue="preop" variant="default">
        {/* `w-auto` é obrigatório: o TabsList do DS traz `w-full`, e largura
            fixa em 100% do pai IGNORA a margem negativa — a barra fica mais
            estreita que os cards e deslocada à esquerda. */}
        <TabsList
          aria-label="Seções de inibidores de apetite"
          className={cn(LARGURA, 'grid w-auto grid-cols-3', imerso && 'hidden')}
        >
          <TabsTrigger value="preop" className="w-full px-1">Pré-op</TabsTrigger>
          <TabsTrigger value="nodia" className="w-full px-1">No dia</TabsTrigger>
          <TabsTrigger value="referencia" className="w-full px-1">Referência</TabsTrigger>
        </TabsList>

        <TabsContent value="preop" className="mt-3">
          <AbaPreOp estado={estado} />
        </TabsContent>
        <TabsContent value="nodia" className="mt-3">
          <AbaNoDia />
        </TabsContent>
        <TabsContent value="referencia" className="mt-3">
          <AbaReferencia />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground leading-snug px-1">
        {INIBIDORES.length} fármacos · a suspensão segue a nota SBA/SBD/ABESO de 15/05/2026, que cobre GLP-1 e
        coagonistas GLP-1/GIP; os demais fármacos vêm marcados com a própria fonte. Consulta de apoio: a decisão
        é do anestesiologista, caso a caso.
      </p>
    </div>
  );
}
