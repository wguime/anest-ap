/**
 * Anticoagulantes — consulta perioperatória.
 *
 * Quatro frentes na mesma tela: intervalo por fármaco (punção, retirada de
 * cateter e reintrodução), protocolo do cateter peridural, reversores e
 * suspensão pré-operatória. Toda a regra clínica vive em
 * src/lib/anticoagulantes.js — aqui só a apresentação.
 *
 * DS: sem componente caseiro e sem cor fora de token. Card, Alert, Accordion,
 * Badge, Tabs (variant "underline", o padrão do app em página de detalhe),
 * Input, DatePicker, TimePicker e Button vêm todos de components/ui.
 * Destaque dentro de um card é feito por TIPOGRAFIA, não por fundo tingido:
 * no tema escuro `bg-muted` e `bg-card` são a mesma cor (#1A2420).
 *
 * ⚠️ O efeito dos "dados do paciente" é mostrado DENTRO do painel, ao lado dos
 * campos. Medido em 375px: o campo do ClCr fica em y=330 e o card de
 * intervalos em y=675 — com o teclado do celular aberto o resultado cai fora
 * da tela e digitar parece não fazer nada (relato do dono, 25/08).
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Info, RotateCcw, Search, Siren } from 'lucide-react';
import { cn } from '../../utils/tokens';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Alert } from '../../components/ui/alert';
import { DatePicker } from '../../components/ui/date-picker';
import { TimePicker } from '../../components/ui/time-picker';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../../components/ui/accordion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import ListaFarmacosAgrupada, { PaginaGrupo } from './ListaFarmacosAgrupada';
import { agruparVariantes } from '../../../lib/agrupamentoFarmacos';
import {
  ANTICOAGULANTES,
  REVERSORES,
  PASSOS_CATETER,
  SINAIS_ALARME,
  CONDUTA_HEMATOMA,
  FATORES_RISCO,
  INCIDENCIA,
  LIMIARES,
  PRE_OPERATORIO,
  AVISO_REVERSORES_BLOQUEIO,
  agruparPorClasse,
  avaliarBloqueio,
  buscarFarmacos,
  horasParaTexto,
} from '../../../lib/anticoagulantes';

// =============================================================================
// PEÇAS DE APRESENTAÇÃO (só composição de componentes do DS)
// =============================================================================

const BADGE_CATETER = { success: 'success', warning: 'warning', destructive: 'destructive' };

/**
 * Largura do card: a MESMA da conferência da escala cirúrgica
 * (ImportarEscalaPage: `max-w-3xl mx-auto p-4`), que é o padrão pedido pelo
 * dono — 16px de margem lateral.
 *
 * O wrapper da página de calculadora tem 24px de padding (medido no app, não
 * os 16px do px-4 do App.jsx) e é compartilhado pelas 70 calculadoras, então
 * não é meu para mexer: -mx-2 desconta 8px e fecha os 16px do padrão.
 * ⚠️ -mx-4 (8px de margem) foi testado e REPROVADO: com o card quase colado
 * na borda, a borda arredondada e a sombra ficam cortadas.
 */
const LARGURA = '-mx-2';

/** Rótulo de assunto — o mesmo formato do "DOSE" no card do reversor. */
function Rotulo({ children, tom }) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold uppercase tracking-wider mb-1',
        tom === 'warning' ? 'text-warning' : 'text-muted-foreground'
      )}
    >
      {children}
    </p>
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

/**
 * O Alert do DS põe o ícone numa COLUNA à esquerda, centrado na vertical: em
 * alerta longo ele flutua no meio e rouba ~28px de largura de TODAS as linhas.
 * Aqui o ícone vai para dentro do título e a coluna é colapsada — o texto
 * ganha a largura inteira do card.
 */
const SEM_COLUNA_DE_ICONE = '[&>div>div:first-child]:hidden';

function TituloAlerta({ icone: Icone, children }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icone className="w-4 h-4 shrink-0" aria-hidden="true" />
      {children}
    </span>
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

/** Linha rótulo → valor: formato mais denso para par curto. */
function LinhaDado({ rotulo, valor, destaque = false, bloqueado = false, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug">{rotulo}</p>
        {children}
      </div>
      <span
        className={cn(
          'shrink-0 text-right leading-tight tabular-nums',
          destaque ? 'text-base font-bold' : 'text-sm font-semibold',
          bloqueado ? 'text-destructive' : 'text-foreground'
        )}
      >
        {valor}
      </span>
    </div>
  );
}

function LinhaJanela({ rotulo, janela, liberacao }) {
  if (!janela) return null;
  return (
    <LinhaDado rotulo={rotulo} valor={janela.texto || '—'} destaque bloqueado={janela.bloqueado}>
      {janela.motivo && (
        <p className={cn('text-xs leading-snug mt-0.5', janela.bloqueado ? 'text-destructive' : 'text-warning')}>
          {janela.motivo}
        </p>
      )}
      {janela.nota && !janela.bloqueado && (
        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{janela.nota}</p>
      )}
      {liberacao && !janela.bloqueado && (
        <p className="text-xs font-semibold text-primary leading-snug mt-0.5">
          A partir de {liberacao.texto} · {liberacao.falta}
        </p>
      )}
    </LinhaDado>
  );
}

function GrupoLinhas({ titulo, children }) {
  return (
    <div>
      {titulo && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {titulo}
        </p>
      )}
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

/**
 * Card do DS que embrulha um Accordion sem borda dupla.
 *
 * ⚠️ `recorta={false}` onde houver DatePicker dentro: o popup do calendário é
 * `absolute z-50`, sem portal (date-picker.jsx:434), e QUALQUER ancestral com
 * overflow-hidden corta o mês pela metade.
 */
function CardSanfona({ children, className, recorta = true }) {
  return (
    <Card padding="none" className={cn(LARGURA, recorta && 'overflow-hidden', className)}>
      <Accordion type="single" collapsible>
        {children}
      </Accordion>
    </Card>
  );
}

// =============================================================================
// ABA 1 — BLOQUEIO E CATETER POR FÁRMACO
// =============================================================================

const PACIENTE_VAZIO = { clcr: '', idade: '', plaquetas: '', inr: '', data: null, hora: '' };

/**
 * O estado da aba Bloqueio mora no componente RAIZ, não aqui.
 *
 * ⚠️ `TabsContent` DESMONTA o painel inativo. Com o estado local, abrir um
 * fármaco, tocar em "Cateter" e voltar descartava o fármaco E os dados do
 * paciente — ClCr, idade, plaquetas, RNI e o horário da última dose —, em
 * silêncio. Medido em 26/08 no card irmão de Inibidores de apetite e
 * confirmado idêntico aqui (RNI 2,5 digitado, perdido na volta).
 *
 * `painelAberto` fica de fora de propósito: uma folha aberta não deve
 * sobreviver a uma troca de aba.
 */
function useEstadoBloqueio() {
  const [termo, setTermo] = useState('');
  const [farmacoId, setFarmacoId] = useState(null);
  const [grupoId, setGrupoId] = useState(null);
  const [paciente, setPaciente] = useState(PACIENTE_VAZIO);
  return { termo, setTermo, farmacoId, setFarmacoId, grupoId, setGrupoId, paciente, setPaciente };
}

function AbaBloqueio({ estado }) {
  const { termo, setTermo, farmacoId, setFarmacoId, grupoId, setGrupoId, paciente, setPaciente } = estado;
  const [painelAberto, setPainelAberto] = useState(false);

  const grupos = useMemo(() => agruparPorClasse(buscarFarmacos(termo)), [termo]);

  /* A tela do grupo sai da base COMPLETA, não do resultado da busca: quem
     pediu a medicação quer ver todas as doses e vias dela, mesmo que o termo
     digitado só casasse com uma. */
  const cardGrupo = useMemo(
    () => (grupoId ? agruparVariantes(ANTICOAGULANTES).find((c) => c.chave === grupoId) : null),
    [grupoId]
  );
  const lerResumo = (f) => f.antes?.resumo || f.antes?.texto || horasParaTexto(f.antes?.horas);

  const num = (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  /** Data (DatePicker) + hora (TimePicker) → um instante só. */
  const ultimaDose = useMemo(() => {
    if (!paciente.data) return null;
    const d = new Date(paciente.data);
    const [h, m] = (paciente.hora || '00:00').split(':');
    d.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    return d;
  }, [paciente.data, paciente.hora]);

  const avaliacao = useMemo(() => {
    if (!farmacoId) return null;
    return avaliarBloqueio({
      farmacoId,
      ultimaDose,
      clcr: num(paciente.clcr),
      idade: num(paciente.idade),
      plaquetas: num(paciente.plaquetas),
      inr: num(paciente.inr),
    });
  }, [farmacoId, paciente, ultimaDose]);

  const setCampo = (campo) => (e) => setPaciente((p) => ({ ...p, [campo]: e.target.value }));

  // ------------------------------------------------ DOSES E VIAS DE UM FÁRMACO
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
          placeholder="Nome ou marca (ex.: Xarelto)"
          leftIcon={<Search className="size-5" aria-hidden="true" />}
          aria-label="Buscar anticoagulante"
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
  const { farmaco, janelas, liberacao, liberacaoRetirada, avisos, cateter, reversor } = avaliacao;

  const preenchidos = [
    paciente.clcr && `ClCr ${paciente.clcr}`,
    paciente.idade && `${paciente.idade} anos`,
    paciente.plaquetas && `Plaq ${paciente.plaquetas}`,
    paciente.inr && `RNI ${paciente.inr}`,
    ultimaDose && 'última dose',
  ].filter(Boolean);

  const houveAjuste = janelas.antes?.ajustado || janelas.retirada?.ajustado;

  return (
    <div className="space-y-3">
      {/* Identificação — o voltar mora no card, não solto acima dele (solto,
          o header fixo da página passava por cima ao rolar) */}
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
            {farmaco.comerciais?.map((c) => (
              <Badge key={c} variant="secondary" badgeStyle="outline">{c}</Badge>
            ))}
            <Badge variant={BADGE_CATETER[cateter.tom] || 'warning'} badgeStyle="solid">
              {cateter.label}
            </Badge>
          </div>
          {farmaco.dosesTipicas && farmaco.dosesTipicas !== '—' && (
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">Doses usuais: </span>
              {farmaco.dosesTipicas}
            </p>
          )}
        </div>
      </Card>

      {/* Intervalos — o resultado vem ANTES dos campos: é o que se consulta */}
      <Bloco className="space-y-3">
        <GrupoLinhas titulo="A partir da última dose">
          <LinhaJanela rotulo="Punção / instalação do cateter" janela={janelas.antes} liberacao={liberacao} />
          <LinhaJanela rotulo="Retirada do cateter" janela={janelas.retirada} liberacao={liberacaoRetirada} />
        </GrupoLinhas>
        <GrupoLinhas titulo="Até a próxima dose">
          <LinhaJanela rotulo="Depois da punção" janela={janelas.aposPuncao} />
          <LinhaJanela rotulo="Depois de retirar o cateter" janela={janelas.aposRetirada} />
        </GrupoLinhas>
      </Bloco>

      {avisos.length > 0 && (
        <Alert
          variant="warning"
          title={<TituloAlerta icone={AlertTriangle}>Atenção com este paciente</TituloAlerta>}
          className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
        >
          <Lista itens={avisos} />
        </Alert>
      )}

      {/* Dados do paciente em SHEET, não em sanfona.
          ⚠️ O popup do DatePicker é `absolute` sem portal (date-picker.jsx:434)
          e o AccordionContent do DS anima altura com `overflow-hidden` — o
          calendário saía cortado no meio do mês (medido). O Sheet é o padrão
          do app para editor e ainda tira ~300px da tela de consulta. */}
      <Card padding="none" className={cn(LARGURA, 'overflow-hidden')}>
        <button
          type="button"
          onClick={() => setPainelAberto(true)}
          className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Dados do paciente</span>
            {preenchidos.length > 0 ? (
              <span className="block text-xs text-primary leading-snug">{preenchidos.join(' · ')}</span>
            ) : (
              <span className="block text-xs text-muted-foreground leading-snug">
                Ajusta o intervalo pela função renal, idade e horário
              </span>
            )}
          </div>
          <Badge variant={preenchidos.length > 0 ? 'success' : 'secondary'} badgeStyle="subtle" className="shrink-0">
            {preenchidos.length > 0 ? 'Editar' : 'Informar'}
          </Badge>
        </button>
      </Card>

      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        {/* !h-auto: POSITION_CLASSES.bottom do DS fixa h-[85vh], não max-h —
            sem isso a folha nasce com 85% da tela quase vazia */}
        <SheetContent side="bottom" className="!h-auto max-h-[88vh]">
          <SheetHeader>
            <SheetTitle>Dados do paciente</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-2.5">
            {/* Resultado no TOPO: é o que muda enquanto se digita */}
            <Card padding="sm" variant="flat" className="border-border-strong">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {farmaco.farmaco}
              </p>
              {janelas.antes?.bloqueado ? (
                <p className="text-sm font-bold text-destructive leading-snug">
                  Não realizar — {janelas.antes.motivo}
                </p>
              ) : (
                <>
                  <p className="text-base font-bold text-foreground leading-tight">
                    Punção: {janelas.antes?.texto}
                    {houveAjuste && <span className="text-warning"> (ajustado)</span>}
                  </p>
                  {liberacao && (
                    <p className="text-sm font-semibold text-primary leading-snug">
                      Liberado {liberacao.texto} · {liberacao.falta}
                    </p>
                  )}
                  {!houveAjuste && preenchidos.length > 0 && (
                    <p className="text-xs text-muted-foreground leading-snug">
                      Sem ajuste: estes valores não mudam o intervalo deste fármaco.
                    </p>
                  )}
                </>
              )}
              {avisos.length > 0 && (
                <p className="text-xs text-warning leading-snug">
                  {avisos.length} alerta{avisos.length > 1 ? 's' : ''} na tela de trás.
                </p>
              )}
            </Card>

            <DatePicker
              label="Data da última dose"
              value={paciente.data}
              onChange={(d) => setPaciente((p) => ({ ...p, data: d }))}
              placeholder="Selecione a data"
            />
            <TimePicker
              label="Hora da última dose"
              value={paciente.hora}
              onChange={(v) => setPaciente((p) => ({ ...p, hora: v }))}
              step={5}
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                inputMode="numeric"
                label="ClCr (mL/min)"
                value={paciente.clcr}
                onChange={setCampo('clcr')}
                placeholder="45"
              />
              <Input
                type="number"
                inputMode="numeric"
                label="Idade (anos)"
                value={paciente.idade}
                onChange={setCampo('idade')}
                placeholder="78"
              />
              <Input
                type="number"
                inputMode="numeric"
                label="Plaquetas (mil)"
                value={paciente.plaquetas}
                onChange={setCampo('plaquetas')}
                placeholder="120"
              />
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                label="RNI"
                value={paciente.inr}
                onChange={setCampo('inr')}
                placeholder="1,2"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaciente(PACIENTE_VAZIO)}
                className="min-h-[44px] text-muted-foreground"
              >
                <RotateCcw className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Limpar
              </Button>
              <Button className="min-h-[44px] flex-1" onClick={() => setPainelAberto(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {farmaco.alertas?.length > 0 && (
        <Bloco titulo="Pontos-chave">
          <Lista itens={farmaco.alertas} />
        </Bloco>
      )}

      <Bloco>
        <div className="divide-y divide-border">
          <div className="pb-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Laboratório
            </p>
            <p className="text-sm text-foreground leading-snug">{farmaco.laboratorio}</p>
          </div>
          {reversor && (
            <div className="pt-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reversor
              </p>
              <p className="text-sm font-semibold text-foreground leading-snug">{reversor.nome}</p>
              {reversor.dose !== '—' && (
                <p className="text-xs text-muted-foreground leading-snug">{reversor.dose}</p>
              )}
            </div>
          )}
        </div>
      </Bloco>

      {(farmaco.notas?.esra || farmaco.notas?.sba) && (
        <CardSanfona>
          <AccordionItem value="diretrizes">
            <AccordionTrigger className="px-4">
              <span className="text-sm font-semibold">O que dizem as outras diretrizes</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2">
                {farmaco.notas.esra && (
                  <p className="text-sm text-muted-foreground leading-snug">
                    <span className="font-semibold text-foreground">ESAIC/ESRA 2022: </span>
                    {farmaco.notas.esra}
                  </p>
                )}
                {farmaco.notas.sba && (
                  <p className="text-sm text-muted-foreground leading-snug">
                    <span className="font-semibold text-foreground">SBA 2020: </span>
                    {farmaco.notas.sba}
                  </p>
                )}
                <p className="text-xs text-muted-foreground leading-snug">
                  Os números em destaque seguem a ASRA 5ª edição (2025). Divergindo as diretrizes,
                  prevalece o protocolo do serviço.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </CardSanfona>
      )}
    </div>
  );
}

// =============================================================================
// ABA 2 — CATETER PERIDURAL
// =============================================================================

function AbaCateter() {
  return (
    <div className="space-y-3">
      {/* O que salva vem primeiro e fica sempre aberto */}
      <Alert
        variant="error"
        title={<TituloAlerta icone={Siren}>Sinais de alarme — hematoma espinhal</TituloAlerta>}
        className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
      >
        <Lista itens={SINAIS_ALARME} />
      </Alert>

      <Alert
        variant="warning"
        title={<TituloAlerta icone={AlertTriangle}>Suspeitou? A conduta é esta</TituloAlerta>}
        className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
      >
        <Lista itens={CONDUTA_HEMATOMA} marcador="numero" />
      </Alert>

      {/* Números que se conferem ANTES de puncionar — valor em destaque */}
      <Bloco titulo="Antes de puncionar ou retirar">
        <div className="divide-y divide-border">
          {LIMIARES.map((l) => (
            <LinhaDado key={l.exame} rotulo={l.exame} valor={l.alvo} destaque>
              <p className="text-xs text-muted-foreground leading-snug mt-0.5">{l.nota}</p>
            </LinhaDado>
          ))}
        </div>
      </Bloco>

      {/* Protocolo em sanfona: cinco cards abertos viravam paredão de texto */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Protocolo do cateter
        </p>
        <Card padding="none" className={cn(LARGURA, 'overflow-hidden')}>
          <Accordion type="single" collapsible defaultValue={PASSOS_CATETER[0]?.id}>
            {PASSOS_CATETER.map((passo) => (
              <AccordionItem key={passo.id} value={passo.id}>
                <AccordionTrigger className="px-4">
                  <span className="text-sm font-semibold text-left">{passo.titulo}</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <Lista itens={passo.itens} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      </div>

      <Card padding="none" className={cn(LARGURA, 'overflow-hidden')}>
        <Accordion type="single" collapsible>
          <AccordionItem value="risco">
            <AccordionTrigger className="px-4">
              <span className="text-sm font-semibold text-left">Fatores de risco para hematoma</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {[
                  { titulo: 'Do paciente', itens: FATORES_RISCO.paciente },
                  { titulo: 'Do procedimento', itens: FATORES_RISCO.procedimento },
                  { titulo: 'Dos fármacos', itens: FATORES_RISCO.farmaco },
                ].map((bloco) => (
                  <div key={bloco.titulo}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {bloco.titulo}
                    </p>
                    <Lista itens={bloco.itens} />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="incidencia">
            <AccordionTrigger className="px-4">
              <span className="text-sm font-semibold text-left">Incidência por técnica</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="divide-y divide-border">
                {INCIDENCIA.map((i) => (
                  <LinhaDado key={i.contexto} rotulo={i.contexto} valor={i.valor} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-snug mt-2">
                Peridural com cateter é a técnica de maior risco; raquianestesia, a de menor. Inserção e
                retirada do cateter são os dois momentos críticos.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    </div>
  );
}

// =============================================================================
// ABA 3 — REVERSORES
// =============================================================================

function AbaReversores() {
  const lista = REVERSORES.filter((r) => r.id !== 'nenhum');
  const semAntidoto = REVERSORES.find((r) => r.id === 'nenhum');

  return (
    <div className="space-y-3">
      <Alert
        variant="warning"
        title={<TituloAlerta icone={AlertTriangle}>Antes de tudo</TituloAlerta>}
        className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
      >
        {AVISO_REVERSORES_BLOQUEIO}
      </Alert>

      {lista.map((r) => (
        <Card key={r.id} padding="none" className={cn(LARGURA, 'overflow-hidden')}>
          <div className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground leading-tight">{r.nome}</h3>
                <p className="text-xs text-muted-foreground leading-snug">{r.alvo}</p>
              </div>
              {/* Azul não dizia nada aqui (dono 25/08) e o número sozinho
                  também não: "1–2 h" do quê? Verde institucional do DS e o
                  rótulo dentro do badge. */}
              <Badge variant="default" badgeStyle="subtle" className="shrink-0">
                Início {r.inicio}
              </Badge>
            </div>

            {/* A dose é o que se procura: maior peso tipográfico do card */}
            <div>
              <Rotulo>Dose</Rotulo>
              <p className="text-base font-bold text-foreground leading-snug">{r.dose}</p>
            </div>
          </div>

          {/* Detalhe e risco descem para a sanfona — o card fica escaneável */}
          <Accordion type="single" collapsible>
            <AccordionItem value={`det-${r.id}`}>
              <AccordionTrigger className="px-4">
                <span className="text-sm font-semibold">Como usar, riscos e disponibilidade</span>
              </AccordionTrigger>
              {/* Três assuntos, três rótulos — antes eram bullets seguidos de
                  duas linhas soltas com o rótulo embutido no meio da frase, e
                  nada dizia onde um assunto acabava e o outro começava. Os
                  rótulos são os MESMOS do "DOSE" do cabeçalho do card. */}
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  <div>
                    <Rotulo>Como usar</Rotulo>
                    <Lista itens={r.detalhes} />
                  </div>
                  {r.riscos !== '—' && (
                    <div>
                      <Rotulo tom="warning">Riscos</Rotulo>
                      <p className="text-sm text-foreground leading-snug">{r.riscos}</p>
                    </div>
                  )}
                  {r.brasil !== '—' && (
                    <div>
                      <Rotulo>Disponibilidade no Brasil</Rotulo>
                      <p className="text-sm text-muted-foreground leading-snug">{r.brasil}</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      ))}

      {semAntidoto && (
        <Bloco titulo={semAntidoto.nome}>
          <p className="text-xs text-muted-foreground leading-snug">{semAntidoto.alvo}</p>
          <Lista itens={semAntidoto.detalhes} />
        </Bloco>
      )}
    </div>
  );
}

// =============================================================================
// ABA 4 — PRÉ-OPERATÓRIO
// =============================================================================

function AbaPreOperatorio() {
  return (
    <div className="space-y-3">
      <Alert
        variant="info"
        title={<TituloAlerta icone={Info}>Esta aba é sobre a CIRURGIA</TituloAlerta>}
        className={cn(LARGURA, SEM_COLUNA_DE_ICONE)}
      >
        O intervalo para operar com segurança é bem menor que o intervalo para puncionar o neuroeixo.
        Se houver bloqueio ou cateter no plano, decida pela aba Bloqueio.
      </Alert>

      {PRE_OPERATORIO.map((bloco) => (
        <Bloco key={bloco.id} titulo={bloco.titulo}>
          <Lista itens={bloco.itens} />
        </Bloco>
      ))}
    </div>
  );
}

// =============================================================================
// COMPONENTE
// =============================================================================

export default function AnticoagulantesDisplay() {
  const estado = useEstadoBloqueio();
  /* Dentro de um fármaco a barra de abas some: encostada num cartão
     intitulado "Varfarina", ela lia como sub-abas DAQUELE remédio em vez de
     abas da página. Mesma correção do card de Inibidores de apetite, onde o
     dono reportou (26/08). Sai também o único caminho para perder o fármaco
     por engano — resta o "← Todos os fármacos", que é explícito. */
  const imerso = Boolean(estado.farmacoId || estado.grupoId);

  return (
    <div className="space-y-3">
      {/* underline é o padrão do app em página de detalhe com abas (Reuniões,
          Planos de Ação, Dashboard, Educação) e dá 44px de alvo com flex-1 —
          as 4 abas cabem sem rolagem horizontal, ao contrário de pills. */}
      <Tabs defaultValue="bloqueio" variant="default">
        {/* grid-cols-4: com flex o `min-width:auto` de cada rótulo mandava e as
            pastilhas saíam com 82/74/86/70px. Em grid as quatro têm largura
            idêntica e o texto centraliza sozinho.
            ⚠️ `w-auto` é obrigatório: o TabsList do DS traz `w-full`, e largura
            fixa em 100% do pai IGNORA a margem negativa — a barra ficava com
            327px contra os 343px dos cards, deslocada 8px à esquerda. Era isso
            que se via como "seletores não centralizados". */}
        <TabsList
          aria-label="Seções de anticoagulantes"
          className={cn(LARGURA, 'grid w-auto grid-cols-4', imerso && 'hidden')}
        >
          {/* px-1 em vez do px-3 do DS: com a coluna do grid em 76px, os 24px
              de padding não deixavam "Bloqueio" e "Reversão" caberem. A largura
              vem do grid, então o padding não tem mais função aqui. */}
          <TabsTrigger value="bloqueio" className="w-full px-1">Bloqueio</TabsTrigger>
          <TabsTrigger value="cateter" className="w-full px-1">Cateter</TabsTrigger>
          <TabsTrigger value="reversores" className="w-full px-1">Reversão</TabsTrigger>
          <TabsTrigger value="preop" className="w-full px-1">Pré-op</TabsTrigger>
        </TabsList>

        <TabsContent value="bloqueio" className="mt-3">
          <AbaBloqueio estado={estado} />
        </TabsContent>
        <TabsContent value="cateter" className="mt-3">
          <AbaCateter />
        </TabsContent>
        <TabsContent value="reversores" className="mt-3">
          <AbaReversores />
        </TabsContent>
        <TabsContent value="preop" className="mt-3">
          <AbaPreOperatorio />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground leading-snug px-1">
        {ANTICOAGULANTES.length} fármacos · regras da ASRA 5ª ed. (2025), com ESAIC/ESRA 2022 e SBA 2020
        como contraponto. Consulta de apoio: a decisão é do anestesiologista, caso a caso.
      </p>
    </div>
  );
}
