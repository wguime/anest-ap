# Códigos de Anestesiologia — Unimed (referência de cobrança)

> Referência de consulta para o anestesiologista. Fonte: Lista Referencial de Honorários
> Clínicos e Cirúrgicos — Sistema Unimed (HM v.2025.05 / SADT v.2026.02) + ANEXO I Protocolo
> Nacional v.2026.02. Valores na tabela **Intercâmbio Nacional (UTM R$ 1,17)**; a tabela
> **Unimed Chapecó (UTM R$ 1,75, com subsídio)** é o mesmo valor × (1,75/1,17).
>
> ⚠️ **Atualização v2026.03:** os **percentuais redutores de procedimentos múltiplos AGORA
> constam** das Instruções Gerais (itens 2.1.21/4.6: 100/50/40/30/10 por ordem decrescente;
> 70% se outra via). A recomendação do ato anestésico segue a **hierarquia oficial §4.3** (listas
> em `src/data/codificacaoAnestProtocolo.js`). Ver `docs/codificacao-anestesica-v2026.03-analise.md`.
> Valores aqui são de conferência, não substituem a auditoria da Unimed Executora.

## 1. Como a Unimed paga a anestesia

Não existe código TUSS separado de anestesiologia. O honorário do anestesista está **embutido na
linha do procedimento cirúrgico**, na coluna **`Indicador anestésico`** (letra A–Z) → coluna
**`Valor do Honorário do Anestesista`**. Você fatura o **mesmo código do cirurgião**, identificado
como **anestesista** (grau de participação + CBO).

| Indicador | R$ | Indicador | R$ | Indicador | R$ |
|---|---|---|---|---|---|
| A | 149,76 | J | 526,50 | T | 1.345,50 |
| B | 175,50 | K | 585,00 | U | 1.521,00 |
| C | 210,60 | L | 643,50 | V | 1.755,00 |
| D | 257,40 | M | 702,00 | W | 1.989,00 |
| E | 292,50 | N | 760,50 | X | 2.263,95 |
| F | 327,60 | P | 819,00 | Y | 2.784,60 |
| G | 374,40 | Q | 877,50 | Z | 3.123,90 |
| H | 409,50 | R | 994,50 | | |
| I | 468,00 | S | 1.111,50 | | |

**Sem indicador (célula vazia) ou porte anestésico 0 ⇒ não paga anestesia** naquele código:
- o procedimento é presumido sob anestesia local (ex.: exérese de pele `30101921`, DIU `31303293`);
- ou é um ato **SADT diagnóstico** (angiografias, doppler, exames).

## 2. Procedimento múltiplo na mesma guia

A partir da **v2026.03** (itens 2.1.17/2.1.21 p/ cirurgia e 4.6 p/ anestesia) os percentuais de
procedimentos múltiplos **constam do referencial**: por ordem decrescente de valor original →
**1º 100% · 2º 50% (mesma via) ou 70% (outra via) · 3º 40% · 4º 30% · 5º+ 10%**. Bilateral: 70%
(vias/regiões distintas) ou 50% (mesma via). Na ferramenta o % é **manual por linha** (cada código
entra a 100%; o faturista ajusta no badge) — o auto-preenchimento foi removido por decisão do dono.
A cascata oficial é **explicada na legenda do card** como referência (`CASCATA_PERCENTUAL`); o badge
oferece **10% · 30% · 40% · 50% (mesma via) · 70% (outra via) · 100% (principal)** — escolha 70% no
2º procedimento quando a via de acesso for diferente.

## 2b. Valor e tipo de acomodação

- Valores exibidos na ferramenta usam **UTM R$ 1,75** (Unimed Chapecó, com subsídio) = valor de
  intercâmbio (1,17) × (1,75/1,17). A UTM local subiu de 1,73 → **1,75** na Lista Referencial de
  Honorários Clínicos e Cirúrgicos **v.09 (01/04/2026)**; a mesma v.09 reajustou a quantidade de
  UTMs do honorário do cirurgião em 47 códigos HM (migration `20260625120000`) — a anestesia
  (indicador→UTM) ficou inalterada.
- **Acomodação:** **Apartamento = 2×** o valor da tabela; **Enfermaria / Ambulatório / One Day Clinic = 1×**
  (One Day Clinic assumido = Ambulatório).

## 3. Quando a anestesia zera: qual código adicionar

Você lança uma **linha própria** do anestesista com um código do grupo `31602xxx`:

| Situação | Código | R$ | Observação |
|---|---|---|---|
| Indicação do **paciente** (criança, não colaborativo, deficiência, alergia a local, vaginismo) | **31602355** Imperativo clínico | 292,50 | Mais defensável; justificativa obrigatória |
| Ato **sem porte anestésico previsto** na tabela (porte 0) | **31602347** Atos sem porte previsto | 327,60 | Quando a anestesia decorre do ato |
| Exame de imagem / endoscopia / diagnóstico | código específico "Anestesia para…" | ver §4 | Mapear pelo tipo de exame |

Ambos exigem **justificativa clínica no relatório** (auditoria prévia — Protocolo instr. 2 / CFM 12/2017).

## 4. Códigos que o anestesista fatura diretamente

### Imperativo clínico / ato sem porte
| Código | Descrição | Ind. | R$ |
|---|---|---|---|
| 31602355 | Anestesia para situações de imperativo clínico | E | 292,50 |
| 31602347 | Anestesia em atos sem porte especialmente previsto | F | 327,60 |

### Anestesia para exames/procedimentos
| Código | Descrição | Ind. | R$ |
|---|---|---|---|
| 31602231 | Endoscopia diagnóstica | B | 175,50 |
| 31602240 | Endoscopia intervencionista | E | 292,50 |
| 31602258 | Angiorradiologia | E | 292,50 |
| 31602266 | Ultrassonografia | B | 175,50 |
| 31602274 | Tomografia computadorizada | C | 210,60 |
| 31602282 | Ressonância magnética | E | 292,50 |
| 31602290 | Radioterapia | E | 292,50 |
| 31602304 | Exames específicos/testes diagnósticos | B | 175,50 |
| 31602312 | Procedimentos clínicos ambulatoriais e hospitalares | A | 149,76 |
| 31602320 | Medicina nuclear | G | 374,40 |

### Analgesia / dor
| Código | Descrição | Ind. | R$ |
|---|---|---|---|
| 31602029 | Analgesia por dia subsequente (cateter peridural) | B | 175,50 |
| 31602207 | Instalação de bomba de infusão para analgesia | G | 374,40 |
| 31602223 | Passagem de cateter peridural/subaracnóideo com bloqueio de prova | D | 257,40 |

### Bloqueios anestésicos / dor
| Código | Descrição | Ind. | R$ |
|---|---|---|---|
| 31602037 | Anestesia geral/condutiva para bloqueio neurolítico | J | 526,50 |
| 31602045 | Bloqueio de nervos cranianos | D | 257,40 |
| 31602053 | Bloqueio de plexo celíaco | D | 257,40 |
| 31602061 | Bloqueio de simpático lombar | D | 257,40 |
| 31602096 | Bloqueio de gânglio estrelado (anestésico local) | D | 257,40 |
| 31602126 | Bloqueio facetário para-espinhoso | F | 327,60 |
| 31602169 | Bloqueio peridural/subaracnóideo com corticóide | D | 257,40 |
| 31602339 | Bloqueio de plexos (lombossacro/braquial/cervical) p/ dor | D | 257,40 |

> Fonte de dados desta lista: `src/data/codigosAnestesia.js`. A base completa (~5.4k códigos
> HM+SADT) usada pela calculadora vive na tabela Supabase `unimed_tuss_codigos`.

## 5. Auditoria — procedimentos sem valor de anestesia

Levantamento sobre a base seedada (`unimed_tuss_codigos`), procedimentos **cobertos** que **não
remuneram a anestesia** (sem indicador anestésico / porte anestésico 0):

| Lista | Pagam anestesia | **Valor zero p/ anestesia** |
|---|---|---|
| HM (honorários cirúrgicos) | 2.142 | **378** |
| SADT (diagnóstico/terapia) | 9 | **1.857** |

Famílias típicas de valor-zero: pequenos atos sob anestesia local (exérese de unha/lesão, gesso,
cauterização, miringotomia em consultório, biópsia, toxina botulínica) e quase todo o SADT
diagnóstico (exames de imagem, endoscopia, doppler).

**Regra de substituição** (aplicada **dinamicamente** na Consulta — busque o procedimento e a
ferramenta sugere o código + justificativa):

- Exame diagnóstico por imagem/endoscopia → "Anestesia para exames de…" específico
  (`31602231/240/258/266/274/282/290/320`).
- Demais atos sem porte anestésico → **`31602355`** (imperativo clínico — indicação do paciente)
  ou **`31602347`** (ato sem porte previsto). Ambos exigem justificativa (auditoria prévia).

> Como não há, nos documentos, um mapa código→código de substituição, a ferramenta resolve pela
> **natureza do procedimento** (palavras-chave da descrição), cobrindo qualquer dos ~2,2k códigos
> de valor-zero. O anestesiologista confirma o código conforme o caso clínico.
