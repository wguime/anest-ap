# Codificação Anestésica — análise das Instruções Gerais v2026.03 e melhorias

**Doc-fonte:** `Tabela Unimed/Instrucoes Gerais Lista Referencial_Versao 2026.03_01.06.2026.pdf` (117 págs, vigência 01.06.2026).
**Data:** 2026-06-23. **Escopo:** ajustar a feature de Codificação Anestésica às regras oficiais da v2026.03.

---

## 1. O que a v2026.03 muda (e que a feature precisava absorver)

### 1.1 Indicador anestésico = porte anestésico (itens VI, 4.x)
O documento confirma textualmente: **"o indicador anestésico... anteriormente denominado porte anestésico"** e **"substitui o porte anestésico"**. Ou seja, a coluna `porte_anestesico` (lado Rol Unimed antigo, J–Q) é **legado**; quem rege pagamento de anestesia é o **indicador (A–Z)**. Isso valida a regra do app (`temIndicador = indicador && valor`) e reforça o fix do relatório anterior (não afirmar "tem/não tem porte").

### 1.2 Tabela indicador → UTM foi republicada (item 4.1)
A v2026.03 lista o indicador em **UTMs** (não R$): `A=128 B=150 C=180 D=220 E=250 F=280 G=320 H=350 I=400 J=450 K=500 L=550 M=600 N=650 P=700 Q=750 R=850 S=950 T=1150 U=1300 V=1500 W=1700 X=1935 Y=2380 Z=2670`. Multiplicada por 1,17 (intercâmbio) reproduz **exatamente** os R$ que o app já usava, para **todas as letras exceto A** (app: R$150; oficial: 128 UTM = R$149,76 a 1,17). Modelo canônico = UTM × tabela (1,17 ou 1,73 local).

### 1.3 ⭐ Hierarquia oficial de recomendação do ato anestésico (seção 4.3) — a mudança central
Quando a anestesia não é paga embutida, a v2026.03 define **listas explícitas** (não heurística):

| Regra | O quê | Código |
|---|---|---|
| **4.3.1** | Exame específico (RM/TC/US/endoscopia diag/interv/angio/radioterapia/exame específico) | 31602231·240·258·266·274·282·290·**304** |
| **4.3.2** | **159 procedimentos** listados, sem previsão de anestesia | **31602312** (indicador A, 128 UTM) |
| **4.3.3** | **121 procedimentos** que **em nenhuma hipótese** comportam ato anestésico | **nenhum** |
| **4.3.4** | Não listado em 4.3.2: diagnóstico → 31602304 (B); terapêutico → **31602355** (E, imperativo clínico) |
| **4.4** | Odontológico por imperativo clínico | 31602347 (F, máx. 2×) |

### 1.4 Percentuais de procedimentos múltiplos AGORA constam do referencial (2.1.17 / 2.1.21 / 4.6)
A nota antiga "redutores não constam da tabela" está **superada**. A v2026.03 define a cascata, por ordem decrescente de valor original: **1º 100% · 2º 50% (mesma via) ou 70% (outra via) · 3º 40% · 4º 30% · 5º+ 10%**. Vale para honorário cirúrgico **e** anestésico (4.6). Bilateral: 70% (vias/regiões distintas) ou 50% (mesma via).

### 1.5 Outras regras com impacto (não implementadas ainda — ver §4)
- **Dobra de acomodação (item XIV / SADT VIII):** apartamento/quarto privativo/hospital-dia/UTI dobram o **honorário médico** — **geral para códigos `3xxxxxxx`**, mas **só para os procedimentos listados** quando iniciam com 1, 2 e 4. **SADT não dobra** (nem médico nem anestesista), salvo US/endoscopia intervencionista. → o multiplicador 2× **uniforme** do app está incorreto para parte dos códigos.
- **Urgência/emergência +30%** (1.3.1): 19h–7h ou fins de semana/feriado; **SADT não sofre acréscimo** (1.3.2).
- **Acréscimo pediátrico (2.1.24):** Cap. 3 eletivo, 0–5 anos +20%, 6–12 anos +15% no honorário da equipe cirúrgica.
- **Auxiliares (3.1):** 1º auxiliar 30% do porte do cirurgião, demais 20%.
- **4.16 / 9.10.7-8:** anestesia p/ SADT exclusivamente diagnóstico limitada a 3 procedimentos; endoscopia diagnóstica simultânea: anestesista 100%/50% (mesma via) ou 100%/70% (vias diferentes).

---

## 2. Gap medido contra o banco (antes das mudanças)

| Achado | Evidência |
|---|---|
| 4.3.2: app recomendava **31602355 (E, 250 UTM)** para procedimentos que a v2026.03 manda cobrar como **31602312 (A, 128 UTM)** | **157/159** códigos da lista 4.3.2 estão na tabela, **todos sem indicador** → over-coding de ~2× |
| 4.3.3: app recomendava 31602355 para procedimentos que **nunca** comportam anestesia | **121/121** na tabela (24 HM + 97 SADT) — ex.: cateterismo PAM, monitorização PIC, hemodiálise |
| Cascata de redutores incompleta | `sugerirPercentuais` dava 100% ao maior e **50% a todos os demais** (faltavam 40/30/10 por rank) |
| 31602347 usado como "alternativa genérica" | A v2026.03 reserva 31602347 para **odontológico** (4.4) |

---

## 3. O que foi implementado (build ✓ · lint ✓ · 30 testes ✓)

1. **`src/data/codificacaoAnestProtocolo.js`** (novo) — listas oficiais extraídas do PDF: `INDICADOR_UTM` (A–Z), `LISTA_31602312` (159), `SEM_ATO_ANESTESICO` (121). Geradas por script a partir do texto do PDF (sem transcrição manual).
2. **`recomendarCodigo` reescrito** com a hierarquia 4.3: deny (4.3.3 → `null`) → exame (4.3.1) → lista 31602312 (4.3.2) → fallback diagnóstico/terapêutico (4.3.4). Motivos: `exame`/`lista_312`/`diagnostico`/`imperativo`.
3. **`calcularGuia`** — novo status **`sem_anestesia`** para os códigos 4.3.3 (não inventa recomendação).
4. **`sugerirPercentuais`** — cascata oficial **100/50/40/30/10** por rank (`CASCATA_PERCENTUAL`), com nota de que o 2º vai a 70% (outra via) por ajuste manual no badge.
5. **Justificativas** (`gerarJustificativaCompleta`) e **textos de motivo** da UI reescritos citando os itens 4.3.1/4.3.2/4.3.4 e o código correto.
6. **UI** (`CodificacaoAnestesicaPage`) — exibe "Procedimento sem ato anestésico (4.3.3)" tanto no cálculo de guia quanto na consulta/lookup.
7. Removido `RECOMENDACAO_DEFAULT`/`SUGESTAO_REDUTOR` (semântica superada).

**Endoscopia diagnóstica × intervencionista** (fix do relatório anterior, 31602231 B vs 31602240 E) está **confirmada pela v2026.03 4.3.1** — o split estava certo.

---

## 4. Itens aprovados — implementados em 2026-06-23

| # | Item | Status |
|---|---|---|
| 1 | **Dobra de acomodação por código** (item XIV/SADT VIII) | ✅ `LISTA_DOBRA` (111 cods) + `dobraAcomodacao(codigo, lista)` no protocolo; `calcularGuia` aplica a dobra **por linha** (3xxx HM e listados 1/2/4 dobram; SADT/não-listados não). Vale também p/ a aba **Consulta** e p/ o código 31602 recomendado (segue a elegibilidade do procedimento). |
| 2 | **Migração da deny-list de busca** `20260623120000` | ✅ **aplicada em produção** — smoke ok: `eletroconvulsoterapia`→1, `cintilografia`→50, `potencial evocado`→10, `hemograma`→0. |
| 3 | **Indicador A = 128 UTM** | ✅ `INDICADOR_VALOR` deriva de `INDICADOR_UTM` (×1,17) — A = R$149,76; curado 31602312 atualizado. **DB corrigido**: migration `20260624120000` fez `UPDATE` das 2 linhas A (20104170, 31602312) p/ 149,76; extrator normaliza A em re-seeds futuros. |

## 4b. Segunda rodada — implementado em 2026-06-23 (card + auditoria profunda)

| # | Item | Status |
|---|---|---|
| A | **Card mostra Porte cir. + Indicador anest. (porte oficial) + UTM por código** (anest. = `INDICADOR_UTM[ind]`; proc. = valor/1,17) + nº auxiliares | ✅ app + demo |
| B | **2º anestesista (item 4.8)** por tipo (transplante/CEC/neonato/gastroplastia) — `indicaSegundoAnestesista`; nota "auxiliar = 30% do titular" | ✅ app + demo |
| C | **Justificar não-dobra por linha** (`motivoNaoDobra`: SADT item VIII / fora da lista item XIV) + selo "dobrado" | ✅ app + demo |
| D | **Contraste dark mode**: títulos dos cards de recomendação eram `text-warning-foreground` (preto, invisível no dark) → `text-foreground`; pill "Sem valor" idem; demo `.rec .hd`/`.pill.sem` | ✅ app + demo |
| E | **Urgência/emergência +30%** (item 1.3, só HM) — toggle + `opts.urgencia` | ✅ app + demo |
| F | **Limite de 3 proc. SADT diagnóstico** (item 4.16) — flag `limiteSadt`, exclui de `totalRecomendado`, aviso na UI | ✅ app + demo |
| G | **2 códigos DIU faltantes** (31303374/31303382) | ✅ inseridos via migration `20260624120000`; busca retorna |
| H | **`totalRecomendado`** passou a aplicar quantidade × percentual da linha | ✅ |

## 5. Achados do review da aplicação (além do documento)

| # | Achado | Status |
|---|---|---|
| a | `STATUS_META` não tinha `sem_anestesia` → badge caía em "Não encontrado" | ✅ corrigido |
| b | Aba **Consulta** aplicava a dobra de apartamento **uniforme** (mesmo bug do `acomodacaoMult`) | ✅ corrigido (por código) |
| c | Disclaimers diziam "percentuais redutores **não constam** do referencial" e "apartamento dobra o honorário" (genérico) | ✅ textos atualizados (cascata oficial + dobra por código) |
| d | **`sugerirPercentuais` NÃO está ligado à UI** — `addCodigo` insere tudo a 100% (auto-% foi removido deliberadamente em commits recentes). Agora que a cascata é oficial, religar (auto 100/50/40/30/10, respeitando edição manual) seria a melhoria de UX de maior valor. | ⏳ **decisão sua** — religo? |

## 6. Pendências restantes (opcionais / dados)

| # | Item | Sev |
|---|---|---|
| 5 | **Acréscimo pediátrico (2.1.24) e auxiliares cirúrgicos (3.1)** — incidem sobre honorário **cirúrgico**, não anestésico; validar antes de implementar (risco de over-coding se aplicado ao anestesista). | MÉD |
| 6 | **Migrar storage de valores p/ UTM** (DB + extrator) e re-seedar — modelo mais limpo; o resíduo do A já foi corrigido por UPDATE pontual. | BAIXO |
| d | **Religar auto-%** (cascata 100/50/40/30/10) — **recusado pelo dono**; mantido manual. | — |

## 7. Terceira rodada — Lista Referencial de Honorários v.09 (01/04/2026), implementada em 2026-06-25

| # | Item | Status |
|---|---|---|
| I | **UTM local Chapecó 1,73 → 1,75** | ✅ `MULTIPLICADORES.local = 1.75` (lib + demo + textos + docs). Afeta todos os valores locais (anestesista e cirurgião). |
| II | **47 códigos HM — honorário do cirurgião** reajustado (qtd de UTMs) | ✅ migration `20260625120000` (`valor_cirurgiao = qtd_nova × 1,17`, idempotente). **Anestesia inalterada** (UTMs do anestesista não mudaram na v.09; indicador→UTM segue igual). |
| III | **Aba Consulta — tabela "Procedimentos SADT → anestesia"** (item 4.3.1) | ✅ `SADT_EXAME_ANESTESIA` (app + demo): por tipo de exame → código 31602 + indicador + valor local. |
| IV | **Legenda do card** "Anestesia não embutida (4.3)" reescrita em linguagem de fluxo, mais clara | ✅ app + demo. |

> A v.09 é só HM (clínico/cirúrgico) e tem formato de *change-log* (anterior↔nova em quantidades de UTM) — por isso o reajuste foi via UPDATE pontual, não re-seed. SADT (2026.02) inalterado, exceto a UTM local universal.
