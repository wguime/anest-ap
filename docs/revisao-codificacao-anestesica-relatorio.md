# Auditoria — Codificação Anestésica (PR #107)

> ⚠️ **HISTÓRICO / SUPERADO.** Este relatório descreve o estado **pré-v2026.03** (recomendação por
> 31602355/31602347 genéricos, endoscopia toda como intervencionista, deny-list de busca). A feature
> foi depois realinhada à hierarquia oficial **§4.3** (exame → lista 31602312 → fallback 304/355),
> dobra por código (item XIV), A=128 UTM e demais regras. Para o estado atual ver
> `docs/codificacao-anestesica-v2026.03-analise.md`. Mantido apenas como registro do PR #107.

**Data:** 2026-06-22 · **Escopo:** corretude/completude dos dados TUSS Unimed e tratamento de zero-anestesia.
**Método:** verificação independente (openpyxl) das planilhas em `Tabela Unimed/` × JSON de extração × tabela `public.unimed_tuss_codigos` (SELECT via Management API). Read-only.

---

## (a) Resumo executivo

**Veredito: dados aprovados. 0 faltantes, 0 divergências de valor.** Os achados acionáveis estão todos na **deny-list de busca** (procedimentos anestesiáveis ocultos), não nos valores.

| Eixo | Resultado |
|---|---|
| Completude | ✅ **0 faltantes.** xlsx = JSON = DB = **5.411** registros, breakdown idêntico por lista/cobertura. 0 colisões de dedup, 0 linhas rejeitadas pelo filtro `^\d{6,10}$`. |
| Valor anestesista | ✅ **0 divergências** em **todas as 2.270** linhas com indicador (não amostra): `valor_anestesista` == letra→R$ exatamente; 0 indicador-sem-valor, 0 valor-sem-indicador, 0 letra fora do mapa. |
| Valor cirurgião / porte / classificação | ✅ **0 divergências.** Soma de `valor_cirurgiao` confere ao centavo por bucket; contagens de porte/classificação idênticas; amostra de 30 códigos HM com diff campo-a-campo = 0. |
| Âncoras | ✅ Todas batem (40813185, 40813266, 30101921, 31602347, 31602355). |
| Integridade DB | ✅ 5.411 total = 5.411 distintos; 0 descrição nula; 0 código nulo. |
| Zero-anestesia (busca) | ⚠️ **3 over-exclusões** ocultam procedimentos anestesiáveis (ECT, medicina nuclear, neurofisiologia). |
| Motor de recomendação | ⚠️ Endoscopia diagnóstica é recomendada como intervencionista (over-coding). |

---

## (b) Divergências de valor

**Nenhuma.** Quatro métodos independentes, todos limpos:

| Verificação | Cobertura | Resultado |
|---|---|---|
| `valor_anestesista` vs letra→R$ (CASE SQL) | **2.270 linhas (100%)** | 0 divergências |
| Âncoras pontuais | 5 códigos | 0 divergências (ver abaixo) |
| `sum(valor_cirurgiao)` por bucket | **4.798 linhas com valor** | bate ao centavo (HM/cob 2.783.836,44; HM/sem 183.826,79; SADT/cob 126.541,01; SADT/sem 34.448,78) |
| Diff campo-a-campo (ind, va, vc, porteCir, porteAne, classif) | amostra 30 HM cobertos | 0 divergências |

Âncoras conferidas (esperado × DB):

| Código | Esperado | DB |
|---|---|---|
| 40813185 | P · R$819 · 9B/3 | P · 819 · 9B/3 ✅ |
| 40813266 | P · R$819 · 10A/5 | P · 819 · 10A/5 ✅ |
| 30101921 | sem ind · porte anest 0 | ind null · va null · pa 0 ✅ |
| 31602347 | F · 327,6 | F · 327,6 ✅ |
| 31602355 | E · 292,5 | E · 292,5 ✅ |

> Os valores na tabela estão em **intercâmbio (1,17)**, como projetado; a UI deriva o local (1,73). Não auditei a multiplicação de runtime (fora do escopo de dados), mas o fator `1,73/1,17` em `codificacaoAnestRules.js` está correto.

---

## (c) Faltantes

**0 faltantes.** Contagens idênticas em xlsx (openpyxl, independente) × JSON commitado × DB:

| Bucket | xlsx | JSON | DB |
|---|---|---|---|
| HM / coberto | 2.520 | 2.520 | 2.520 |
| HM / sem_cobertura | 198 | 198 | 198 |
| SADT / coberto | 1.866 | 1.866 | 1.866 |
| SADT / sem_cobertura | 827 | 827 | 827 |
| **Total** | **5.411** | **5.411** | **5.411** |

Investigação das perdas potenciais do extrator:
- **Filtro `^\d{6,10}$`:** 0 linhas com código plausível rejeitadas (nenhum código com ponto/traço/espaço; todos limpos de 6–10 dígitos).
- **Dedup HM>SADT:** **0 colisões** de código entre HM e SADT — a regra "manter HM" nunca precisou descartar nada, então é inócua aqui (e correta caso surja colisão, pois só HM traz colunas de anestesia).
- **col0 vs col2:** 0 linhas com código válido em col0 e col2 vazia (sem perda silenciosa por leitura de coluna).

### Achado de hygiene — LOW (não é faltante)
**30 códigos gravados com o prefixo de tabela TISS "22" (10 dígitos) em vez do código limpo (8 dígitos).** Em 28 linhas SADT + 2 HM, a planilha traz em col2 o valor `22`+código (ex.: `2250005154`) enquanto col0 traz o código real (`50005154`). O extrator lê col2 e grava o prefixado.
- **Impacto: ~nulo.** Todas são **sem_cobertura** e em capítulos não-anestésicos/denied (2250 reabilitação, 2240 toxicologia, 4030 análises clínicas) — ex.: "Método Pediasuit", "Ácido butoxiacético na urina". Nenhuma tem indicador; nunca aparecem na busca de codificação.
- **Repro:** `python3` openpyxl, SADT/Sem Cobertura, comparar `col0` vs `col2` (28 casos) + HM/Sem Cobertura (2 casos).
- **Sugestão (se quiser limpar):** no extrator, quando `len(col2)==10 and col2 == '22'+col0`, preferir col0.

---

## (d) Zero-anestesia

### Distribuição (`indicador_anestesico is null`)
| Bucket | total | com indicador | zero-anestesia |
|---|---|---|---|
| HM / coberto | 2.520 | 2.142 | 378 |
| HM / sem_cobertura | 198 | 118 | 80 |
| SADT / coberto | 1.866 | 9 | 1.857 |
| SADT / sem_cobertura | 827 | 1 | 826 |

Coerente: a anestesia embutida vive quase toda no HM cirúrgico; SADT é majoritariamente exame que não paga anestesia (→ recomenda 31602). O motor trata corretamente: `temIndicador = indicador != null && valor != null` → só então `paga_embutida`; senão `recomenda_codigo`.

### Consistência estrutural (porte × indicador)
- **64 códigos têm `porte_anestesico > 0` mas SEM `indicador_anestesico`** (ex.: 30101670 "Plástica em Z" pa=2; 30101204 "Criocirurgia" pa=2; 30101506 "Shaving" pa=2). A tabela reconhece um porte anestésico (lado ROL/CBHPM) mas não há **indicador** pagável (lado TISS). **Não é erro de dado** (confere com a planilha), e o app age certo: trata como zero-anestesia e recomenda 31602. **Nuance MÉDIA:** `recomendarCodigo` rotula o motivo como "sem porte previsto" (alternativa 31602347) para códigos que, na verdade, *têm* porte anestésico — o principal sugerido (31602355, imperativo clínico) continua adequado, mas o texto "não possui porte anestésico previsto" na justificativa é factualmente impreciso para esses 64. Considerar separar "tem porte mas sem indicador pagável".
- 49 códigos têm indicador mas `porte_anestesico` null/0 — inócuo (o indicador é o que paga).
- **0 contradições críticas** do tipo "porte anestésico mas pagaria zero por engano de extração": os 64 são verdade da planilha, não perda.

### Deny-list de busca — over-exclusões (os achados acionáveis)

A função `search_unimed_tuss` exclui capítulos inteiros. O teste decisivo: **algum código de capítulo denied carrega indicador/porte anestésico (anestesiável, mas oculto)?** → Sim, em **HM 2010** (66 códigos; 2 com indicador). Detalhe + capítulos clinicamente sedáveis ocultos:

| Sev | O que está oculto | Por quê é problema | Repro |
|---|---|---|---|
| **ALTO** | **20104170 — "Sessão de eletroconvulsoterapia (…), sob anestesia"** (ind=A, R$150) | ECT é **sempre** sob anestesia geral conduzida por anestesista; tem indicador próprio (paga embutida). A deny-list HM `2010` o torna **não-buscável** — `search_unimed_tuss('eletroconvulsoterapia')` → **0 hits**. O anestesista não consegue localizar um procedimento que ele faz rotineiramente. | `select count(*) from search_unimed_tuss('eletroconvulsoterapia',50)` → 0 |
| **MÉDIO-ALTO** | **56 códigos de medicina nuclear / cintilografia (caps 4070/4071)** | A deny-list rotula 4070/4071 como "lab/medicina nuclear **in-vitro**", mas o capítulo contém cintilografia **in-vivo** (ex.: cintilografia óssea), que em pediatria exige sedação. **Contradiz o próprio app:** a referência curada oferece **31602320 "Anestesia para procedimentos de medicina nuclear"** — mas o procedimento-fonte não pode ser encontrado. `search('cintilografia')` → 0. | `select count(*) from unimed_tuss_codigos where descricao ilike '%cintilografia%'` → 56, todos cap 4070/4071 |
| **MÉDIO** | **Cap 4010 (121 códigos): potencial evocado, eletroneuromiografia, eletro-retinografia, eletrococleografia** + 20104340 "Cateterismo de canais ejaculadores" (ind=B) | São exatamente os exames que a referência curada (31602304) lista como sedáveis em criança/não-colaborativo ("Potencial evocado sob sedação", "Eletroneuromiografia em criança", "Exame oftalmológico sob narcose"). Excluí-los impede o anestesista de puxá-los para gerar a recomendação. | `select … where lista='SADT' and substring(codigo,1,4)='4010'` |
| **BAIXO** | termo "arteriografia" | Gap de vocabulário, **não** exclusão: os códigos vivem em 4080/4081 (mantidos) e aparecem por "angiografia" (`search('angiografia')` → 20). | — |

> Capítulos 4020 (mantido) e 4060 (anatomia patológica, denied) estão corretos — patologia nunca sob anestesia.

### Adequação de `recomendarCodigo` / `RECOMENDACAO_EXAME`
- Mapeamentos de imagem (RM/TC/US/radioterapia/medicina nuclear/angio) e default (31602355/347) estão **adequados** para as famílias amostradas.
- **MÉDIO — endoscopia super-codificada:** o regex de endoscopia mapeia **toda** endoscopia para **31602240 (intervencionista, E, R$292,5)**. Endoscopia **diagnóstica** deveria ser **31602231 (B, R$175,5)**. Como o redutor não distingue, uma EDA/colonoscopia diagnóstica que zera anestesia recebe a sugestão do código mais caro → risco de glosa/over-coding. Sugerir: default endoscopia = 31602231; subir para 31602240 só com palavras-chave de intervenção (polipectomia, CPRE, dilatação, ligadura, gastrostomia).
- `RECOMENDACAO_EXAME` não tem entrada para 31602304 (exames específicos/eletrofisiologia) nem 31602312 — exames do cap 4010 cairiam no default genérico **se** fossem buscáveis (ver over-exclusão acima).

---

## (e) Recomendações priorizadas

1. **[ALTO] Tirar ECT da deny-list.** Não excluir HM `2010` em bloco — ele contém 20104170 (ECT, sob anestesia, ind=A) e 20104340 (ind=B). Trocar deny por-capítulo por deny por-código nesses 2, ou whitelist de códigos com indicador. *Verificável:* `search_unimed_tuss('eletroconvulsoterapia')` passa a retornar ≥1.
2. **[MÉDIO-ALTO] Revisar 4070/4071 (medicina nuclear).** Manter cintilografia in-vivo na busca (alinhado a 31602320). Distinguir in-vitro (RIA/lab) do imageamento in-vivo, ou manter o capítulo e filtrar por descrição. *Verificável:* `search('cintilografia')` ≥1.
3. **[MÉDIO] Revisar 4010 (neurofisiologia/oftalmo funcional).** Liberar potencial evocado/ENMG/exames sob narcose pediátrica, coerente com 31602304. *Verificável:* `search('potencial evocado')` ≥1.
4. **[MÉDIO] Endoscopia: default diagnóstico (31602231).** Ajustar `RECOMENDACAO_EXAME`/lógica para só subir a intervencionista (31602240) com keywords de intervenção.
5. **[MÉDIO] Texto da justificativa para os 64 com porte_anestesico>0.** Evitar afirmar "não possui porte anestésico previsto" quando há porte; ajustar o motivo para "sem indicador anestésico pagável".
6. **[BAIXO] Limpar os 30 códigos com prefixo "22".** Preferir col0 quando `col2 == '22'+col0`. Sem impacto clínico (todos sem_cobertura/denied), só hygiene.
7. **[BAIXO] Vocabulário "arteriografia".** Opcional: sinônimo→"angiografia" na busca.

**Pronto:** 0 faltantes; 0 divergências de valor (amostra e full-table); veredito de zero-anestesia = lógica de pagamento correta, mas a **deny-list de busca oculta procedimentos anestesiáveis legítimos (ECT, medicina nuclear, neurofisiologia)** — corrigir antes de promover, pois impede o uso na ponta.
