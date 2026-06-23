# Prompt — Auditoria da Codificação Anestésica (rodar em outra aba do Claude Code)

> Copie tudo abaixo da linha em uma nova aba do Claude Code **aberta neste mesmo repositório**
> (`/Users/guilherme/dev/anest`). É uma revisão **read-only**: não altera dados, código nem migrations.

---

Você é um **auditor médico sênior + engenheiro de dados**. Estou validando a feature **Codificação Anestésica** do app ANEST antes de promover o PR #107. Ela ajuda o anestesiologista a saber, para cada código TUSS autorizado pela Unimed, quanto a anestesia paga e — quando não paga — qual código 31602 registrar. Os dados vêm das planilhas referenciais da Unimed e foram seedados numa tabela Supabase. Preciso de uma auditoria independente e cética da **corretude e completude dos dados** e do **tratamento dos procedimentos com valor zero para anestesia**, porque erro de dado aqui vira cobrança errada.

## Fontes da verdade (não confiar no que já está no banco; conferir contra estas)
- **Planilhas-fonte** (pasta não versionada `Tabela Unimed/`):
  - `HM_Lista Referencial_versao 2025.05_01.12.2025.xlsx` — Honorários Médicos/cirúrgicos. Abas relevantes: `Cobertos`, `Sem Cobertura`, `Porte dos Procedimentos`.
  - `SADT_Lista Referencial_Versão 2026.02_01.03.2026.xlsx` — SADT. Abas: `Cobertos`, `Sem Cobertura`.
  - `ANEXO I_Protocolo Nacional_…xlsx` (pertinência P/N/S/N, via de acesso) e a PDF v.03 (duas tabelas de UTM: 1,17 intercâmbio / 1,73 Chapecó).
- **Colunas-chave** (aba `Cobertos` do HM, header na linha 2): TISS código (col 2), Descrição (col 3), Valor Honorários Médicos Intercâmbio (col 4), Indicador anestésico (col 6), Valor do Honorário do Anestesista (col 7), Porte (col 11), Porte Anestésico (col 15), Classificação (col 17). SADT `Cobertos`: código (col 2), descrição (col 3), Indicador Anestésico (col 9), sem coluna de valor de anestesista (calcular pela letra).
- **Mapa letra→R$ (UTM 1,17)**: A=150 B=175,5 C=210,6 D=257,4 E=292,5 F=327,6 G=374,4 H=409,5 I=468 J=526,5 K=585 L=643,5 M=702 N=760,5 P=819 Q=877,5 R=994,5 S=1111,5 T=1345,5 U=1521 V=1755 W=1989 X=2263,95 Y=2784,6 Z=3123,9. (Não há letra "O".)

## Onde está o que foi construído
- Tabela Supabase: `public.unimed_tuss_codigos` (colunas: `codigo, descricao, lista[HM|SADT], cobertura[coberto|sem_cobertura], indicador_anestesico, valor_anestesista, valor_cirurgiao, porte_cirurgico, porte_anestesico, numero_auxiliares, classificacao, documentacao`). Migration `supabase/migrations/20260622120000_unimed_tuss_codigos.sql`.
- Função de busca com **deny-list** (exclui da busca capítulos não-anestesiáveis): `supabase/migrations/20260622160000_unimed_tuss_search_filtro.sql` (`search_unimed_tuss(p_q, p_limit)`).
- Extrator (xlsx→JSON): `scripts/extract-tuss-from-xlsx.mjs` (filtra códigos `^\d{6,10}$`, **dedup HM > SADT**, calcula valor SADT pela letra). Seed: `scripts/seed-unimed-tuss.mjs`.
- Motor + regras: `src/lib/codificacaoAnest.js` (`recomendarCodigo`, `calcularGuia`) e `src/lib/codificacaoAnestRules.js` (`RECOMENDACAO_EXAME`, `RECOMENDACAO_DEFAULT`, `ACOMODACOES`, `OPCOES_PERCENTUAL`). Referência curada: `src/data/codigosAnestesia.js`. Doc: `docs/codigos-anestesia.md`.

## Ferramentas (read-only)
- Consultar o banco: `node scripts/deploy-sp21-mgmt-api.mjs query "<SQL SELECT>"` (usa o PAT do `.env.local`; só SELECT).
- Reextrair do xlsx para comparar: `node scripts/extract-tuss-from-xlsx.mjs --stats` (imprime contagens por aba e os sanity-checks) e o JSON em `Tabela Unimed/unimed-tuss-extract.json`.
- Ler xlsx direto: `python3` com `openpyxl` (já instalado). Use para contar linhas reais por aba e amostrar.

## Tarefas da auditoria

**1. Corretude de valores (amostra dirigida + estatística).**
- Sorteie ~30 códigos cobertos do HM com indicador e confira no xlsx: `valor_anestesista` == letra→R$ do mapa; `valor_cirurgiao`, `porte_cirurgico`, `porte_anestesico`, `classificacao` batem com a planilha.
- Cheque os códigos-âncora: `40813185` (ind P, R$819, porte 9B/anest 3), `40813266` (P, R$819, 10A/5), `30101921` (sem ind, porte 0), `31602347` (F, 327,6), `31602355` (E, 292,5).
- Para SADT com indicador (poucos), confirme o valor calculado pela letra.
- Reporte qualquer divergência (código, esperado×encontrado).

**2. Completude — faltam códigos/procedimentos?**
- Conte linhas de procedimento reais (código numérico) em cada aba dos 2 xlsx (Cobertos + Sem Cobertura) e compare com `select lista, cobertura, count(*) from unimed_tuss_codigos group by 1,2`.
- Investigue perdas plausíveis do extrator: (a) o filtro `^\d{6,10}$` pode ter descartado códigos com formato atípico; (b) o **dedup HM>SADT** pode ter ocultado um código presente nas duas listas com semântica diferente — verifique se há colisão de `codigo` entre HM e SADT e se a escolha (manter HM) é correta. Liste TODO código que está no xlsx e não na tabela.

**3. Procedimentos com valor ZERO para anestesia (foco clínico).**
- `select count(*) … where indicador_anestesico is null` por lista/cobertura. Amostre as famílias (HM porte 0; SADT).
- Como auditor: há procedimentos **cirúrgicos** marcados sem indicador que **deveriam** ter porte anestésico (erro de extração/planilha)? E o inverso (algo com indicador que não faz sentido)?
- Avalie a **regra de substituição** (`recomendarCodigo` + `RECOMENDACAO_EXAME`): para uma amostra de códigos zero-anestesia (exames de imagem, endoscopia, pequenos atos), o código 31602 sugerido é o clinicamente adequado? Aponte mapeamentos errados ou famílias não cobertas (caindo no default 31602355/347 quando deveria ser um "Anestesia para exames de…" específico).
- **Deny-list da busca** (`search_unimed_tuss`): rode `search_unimed_tuss('<termo>')` para termos cirúrgicos/anestesiáveis e confirme que **nenhum** código cirúrgico/imagem/endoscopia/radioterapia foi excluído por engano; e que análises clínicas/patologia continuam fora. Liste exclusões duvidosas (ex.: capítulos `4010`, `4020`, `4060`).

## Formato da saída
Relatório markdown com: (a) **Resumo executivo** (passou / achados críticos); (b) **Divergências de valor** (tabela código/esperado/encontrado); (c) **Faltantes** (lista de códigos no xlsx ausentes na tabela + causa provável); (d) **Zero-anestesia** (erros de classificação + sugestões de substituição erradas + capítulos da deny-list a revisar); (e) **Recomendações priorizadas**. Cada achado com severidade (Crítico/Alto/Médio/Baixo) e como reproduzir (a query/linha do xlsx).

## Boundaries
- **Read-only**: não edite código, dados, migrations nem rode seed/migração. Apenas leia, consulte (SELECT) e compare.
- A **fonte da verdade são as planilhas em `Tabela Unimed/`** — quando o banco divergir do xlsx, o xlsx vence (a menos que o xlsx tenha erro óbvio, então sinalize).
- Não invente regras de percentual/excludência: o referencial declara que redutores não constam dele (ver `docs/codigos-anestesia.md`).
- Pronto quando: o relatório listar explicitamente "0 faltantes" ou os faltantes; "0 divergências de valor" na amostra ou as divergências; e um veredito claro sobre o tratamento dos zero-anestesia.
