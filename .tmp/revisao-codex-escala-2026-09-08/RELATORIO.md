# Revisão independente da Escala Cirúrgica — relatório final

Base examinada: `12924e89` (origin/main no início). Branch local: `codex/revisao-escala-2026-09-08`.
Último commit de código validado: `aa6cf03a`. O relatório será incluído em commit apenas documental.
As referências de linha abaixo correspondem a essa versão da branch, não à main que continuou evoluindo em outra sessão.

## 1. Resumo em 10 linhas

1. Nove falhas reproduzíveis foram corrigidas em nove commits de código com regressões no mesmo commit.
2. A republicação de swap usa os donos originais dos casos e renova recibos; a migration foi preparada e testada apenas localmente.
3. Consulta rejeitada ou contagem aumentada depois da conferência não autoriza publicação silenciosa.
4. Duplas, cores e repetição atravessam a leitura sem perder pessoas ou marcas.
5. Nenhuma cirurgia é excluída automaticamente por parecer duplicada; a decisão segue na conferência existente.
6. Ajudas homônimas, origem hospitalar e rastro legado por turno são preservados.
7. Falha de recarga conserva o conjunto anterior e avisa; ausência válida continua sendo reconhecida.
8. Avaliação de qualidade, leitura serial e retomada do lote FDS ficam como propostas P2, sem implementação nesta revisão.
9. Cada commit de código passou em lint, suíte completa e build; Deno e inicialização/imports do Vite também foram verificados.
10. Sem push, deploy, chamadas à Vision, SQL de produção ou leitura de credenciais; adoção das correções em produção fica para outra tarefa.

## 2. Achados corrigidos

| Gravidade | Achado | Commit | Filtro Vitest |
|---|---|---|---|
| P0 | Swap republicado transfere cada caso uma só vez | `e3944f17` | `escalaPublicacaoSwapSql` |
| P0 | Erro de consulta ou contagem desatualizada não autoriza republicar | `fdb9f52e` | `importarEscalaPublicacaoDecisoes importarEscalaFdsMapas` |
| P0 | Dupla lida não vira apenas a primeira pessoa | `2b5b1ea1` | `escalaRosterVocabulario` |
| P0 | Cor e repetição atravessam o sanitizador | `e3f78c75` | `escalaSanitizacaoPipeline` |
| P0 | Todas as linhas lidas seguem para conferência | `69b6a225` | `escalaNormalizacaoEdge` |
| P1 | Ajudas homônimas permanecem distintas | `914c88c5` | `escalaCorComoDado` |
| P1 | Renovação mantém o hospital de origem | `bafafd99` | `escalaOrigemRenovacao` |
| P1 | Recarga falha não apaga hospitais nem grava cache parcial | `ae2171a8` | `escalaRecargaFalha` |
| P0 | Desfazer por UID mantém o rastro salvo no apelido do turno | `aa6cf03a` | `escalaOrigemRenovacao` |

Para reproduzir o vermelho sem mexer nesta branch: use um checkout descartável do pai do commit e acrescente **somente** a regressão daquele commit; rode o filtro indicado. A linha antiga do sanitizador e a RPC antiga ficam acessíveis por `git show <commit>^:<arquivo>`. Os logs vermelhos acima foram executados antes de cada correção; os testes agora ficam verdes por construção da correção, não por exclusão de cenários.

### P0 — Swap republicado transfere cada caso uma só vez

Evidência: `supabase/migrations/20260909120000_escala_republicacao_swap.sql:46`. O loop da RPC antiga recapturava casos já transferidos. Com A→B e B→A, os dois conjuntos acabavam na mesma pessoa; recibos também retinham IDs apagados.

Correção: A nova definição calcula destinos a partir dos donos originais e renova os recibos. A ordem do rodapé, o outro turno e a regra de zerar liberações do turno republicado permanecem.

Commit: `e3944f17`. Regressão: `npm run test:run -- escalaPublicacaoSwapSql`. Resultado no código anterior: 3 falhas / 2 passes antes; 5 passes depois. Esperado b, recebido a; recibo com id-obsoleto.

Validação integral do commit:
```text
Test Files  297 passed (297)
Tests  5733 passed | 3 skipped (5736)
Duration  101.53s (transform 19.72s, setup 20.11s, import 111.23s, tests 389.83s, environment 143.22s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-swap-{red,lint,test-run,build}.log`.

### P0 — Erro de consulta ou contagem desatualizada não autoriza republicar

Evidência: `src/pages/escala-cirurgica/ImportarEscalaPage.jsx:1518`. Dia útil e FDS tratavam fetch rejeitado como escala inexistente. No lote, a confirmação antiga também permitia reduzir casos adicionados por outro aparelho depois da conferência.

Correção: Falha interrompe a publicação nos dois fluxos. A confirmação de substituição só cobre a contagem conferida; aumento posterior exige nova conferência.

Commit: `fdb9f52e`. Regressão: `npm run test:run -- importarEscalaPublicacaoDecisoes importarEscalaFdsMapas`. Resultado no código anterior: 3 regressões falharam antes: chamada de salvar indevida nos dois fluxos e lote retornando ok em encolhimento novo.

Validação integral do commit:
```text
Test Files  297 passed (297)
Tests  5736 passed | 3 skipped (5739)
Duration  121.89s (transform 21.61s, setup 22.43s, import 125.67s, tests 488.66s, environment 168.08s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-publicacao-{red,lint,test-run,build}.log`.

### P0 — Dupla lida não vira apenas a primeira pessoa

Evidência: `supabase/functions/_shared/escala-roster.ts:73`. O casamento por prefixo ou primeiro nome transformava GABRIELA + DANIELA, GABRIELA + CRISTINA e GABRIELA + ? em GABRIELA.

Correção: Uma célula compartilhada não é candidata a um único nome do roster. O texto inteiro segue para conferência; a versão do cache foi alterada.

Commit: `2b5b1ea1`. Regressão: `npm run test:run -- escalaRosterVocabulario`. Resultado no código anterior: 3 falhas antes: esperado casamento vazio, recebido GABRIELA; os testes também conferem a preservação do texto pela resolução.

Validação integral do commit:
```text
Test Files  297 passed (297)
Tests  5739 passed | 3 skipped (5742)
Duration  112.15s (transform 20.80s, setup 26.77s, import 119.46s, tests 388.58s, environment 192.87s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-roster-{red,lint,test-run,build}.log`.

### P0 — Cor e repetição atravessam o sanitizador

Evidência: `supabase/functions/parse-escala-cirurgica/index.ts:478`. O sanitizador descartava cor e repeticao antes dos helpers. O azul fora do rodapé era apagado; amarelo e // legado desapareciam.

Correção: Os dois campos atravessam a sanitização e continuam validados pelo helper existente. O teste executa o sanitizador real extraído do arquivo TypeScript e o encadeia aos helpers, sem Deno.serve, rede ou credenciais.

Commit: `e3f78c75`. Regressão: `npm run test:run -- escalaSanitizacaoPipeline`. Resultado no código anterior: 3 falhas / 1 controle aprovado antes; 4 passes depois. Nome azul apagado, amarelo vazio e repetição vazia.

Validação integral do commit:
```text
Test Files  298 passed (298)
Tests  5743 passed | 3 skipped (5746)
Duration  104.92s (transform 19.83s, setup 21.18s, import 110.58s, tests 407.44s, environment 145.78s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-cor-{red,lint,test-run,build}.log`.

### P0 — Todas as linhas lidas seguem para conferência

Evidência: `supabase/functions/_shared/escala-normalizacao.ts:159`. A chave de deduplicação ignorava turno e cor e era calculada depois da conversão para iniciais. Eliminava cirurgias distintas e podia eliminar justamente a linha azul.

Correção: A normalização conta possíveis repetições sem excluir linhas. O aviso humano já existe em detectarItensDuplicados e ImportarEscalaPage. A expectativa antiga de excluir duplicatas foi substituída explicitamente pela regra documentada de preservá-las, após a autorização de conclusão do dono.

Commit: `69b6a225`. Regressão: `npm run test:run -- escalaNormalizacaoEdge`. Resultado no código anterior: 3 falhas / 13 passes antes: outro turno perdido, dois pacientes sintéticos reduzidos a um e linha azul eliminada.

Validação integral do commit:
```text
Test Files  298 passed (298)
Tests  5748 passed | 3 skipped (5751)
Duration  107.54s (transform 18.64s, setup 22.10s, import 111.65s, tests 407.81s, environment 158.91s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-duplicadas-{red,lint,test-run,build}.log`.

### P1 — Ajudas homônimas permanecem distintas

Evidência: `supabase/functions/_shared/escala-cor.ts:48`. Deduplicar por primeiro nome eliminava uma das ajudas JOAO HENRIQUE / JOAO PEDRO. No contrato legado, a mesma comparação pintava os dois de azul quando só um era ajuda.

Correção: A identidade usada na lista de ajudas conserva o nome completo normalizado e remove somente prefixo de pedido e nota final de local. A ordem do rodapé não muda.

Commit: `914c88c5`. Regressão: `npm run test:run -- escalaCorComoDado`. Resultado no código anterior: 2 falhas / 19 passes antes: ajuda ausente e azul atribuído ao homônimo.

Validação integral do commit:
```text
Test Files  298 passed (298)
Tests  5745 passed | 3 skipped (5748)
Duration  188.54s (transform 31.35s, setup 46.33s, import 212.30s, tests 614.54s, environment 368.48s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-homonimos-{red,lint,test-run,build}.log`.

### P1 — Renovação mantém o hospital de origem

Evidência: `src/contexts/EscalaCirurgicaContext.jsx:413`. Desfazer liberação e reativar escalação apagavam origem do override. Uma ajuda do Materno perdia a prioridade derivada dessa informação.

Correção: Origem permanece junto dos campos de identidade nos dois caminhos. Os testes verificam estado, escrita com usuário real, ordem derivada e preservação do outro turno.

Commit: `bafafd99`. Regressão: `npm run test:run -- escalaOrigemRenovacao`. Resultado no código anterior: 2 falhas antes: origem ausente na renovação ou override inteiro undefined; ambas aprovadas após o ajuste.

Validação integral do commit:
```text
Test Files  299 passed (299)
Tests  5750 passed | 3 skipped (5753)
Duration  105.52s (transform 21.45s, setup 21.68s, import 122.83s, tests 381.67s, environment 160.30s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-origem-{red,lint,test-run,build}.log`.

### P1 — Recarga falha não apaga hospitais nem grava cache parcial

Evidência: `src/contexts/EscalaCirurgicaContext.jsx:189`. Uma rejeição de fetch virava null, apagando hospital ou fila FDS. O prefetch também guardava conjunto parcial, impedindo nova tentativa para a mesma data.

Correção: A recarga só substitui o conjunto depois que todas as consultas de escalas concluem. Em falha mantém o conjunto anterior e mostra aviso. Prefetch falho não cacheia. Resposta válida nula continua sendo ausência.

Commit: `ae2171a8`. Regressão: `npm run test:run -- escalaRecargaFalha`. Resultado no código anterior: 3 falhas / 1 controle aprovado antes: HRO apagado, FDS apagado e prefetch chamado uma só vez quando deveria tentar novamente.

Validação integral do commit:
```text
Test Files  300 passed (300)
Tests  5754 passed | 3 skipped (5757)
Duration  106.45s (transform 18.39s, setup 22.22s, import 113.08s, tests 388.58s, environment 168.67s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-recarga-{red,lint,test-run,build}.log`.

### P0 — Desfazer por UID mantém o rastro salvo no apelido do turno

Evidência: `src/contexts/EscalaCirurgicaContext.jsx:410`. Na revisão final, o caminho UID→apelido reconhecia a liberação antiga, mas ignorava linha_overrides[turno:apelido]. A renovação perdia assumidaPor, trocaCom, origem e decisões da conferência.

Correção: O lookup do override usa também a chave legada com o mesmo turno antes de migrar o rastro para a chave do UID. O outro turno permanece intacto.

Commit: `aa6cf03a`. Regressão: `npm run test:run -- escalaOrigemRenovacao`. Resultado no código anterior: 1 falha / 2 passes antes: recebido só renovado/por/em, sem os cinco campos preservados.

Validação integral do commit:
```text
Test Files  300 passed (300)
Tests  5755 passed | 3 skipped (5758)
Duration  118.97s (transform 19.19s, setup 20.57s, import 114.80s, tests 498.53s, environment 150.65s)
```
Lint: zero erros; build concluído. Logs: `/private/tmp/anest-review-legado-{red,lint,test-run,build}.log`.


**Escopo da migration:** `20260909120000_escala_republicacao_swap.sql` substitui a definição da RPC existente; não foi aplicada fora do PostgreSQL WASM local dos testes. A autorização específica do dono foi recuperada da sessão anterior. O teste usa os corpos SQL reais, valida swap, ciclo de três pessoas, transferência unilateral, recibos, outro turno, caso sem UID e reaplicação da migration. Auth/RLS reais não são simulados por esse teste: as funções auxiliares de autorização são stubs locais.

**Cache e prompt:** a versão final do contrato/cache é `v14-preserva-linhas-2026-09-11`. O texto do prompt, modelo e schema da Vision não foram alterados nesta revisão. A versão foi atualizada para que o servidor atualizado não reutilize respostas processadas pelas regras antigas.

**Ajustes no teste, com motivo explícito:** o primeiro ensaio do sanitizador não executou assertions porque importar esbuild no jsdom violava a invariância TextEncoder/Uint8Array. A extração usa agora `stripTypeScriptTypes` do Node 24, a mesma versão declarada no CI; depois disso, as três regressões de produto falharam como esperado. Na normalização, a antiga expectativa de excluir duplicatas foi substituída para cumprir a regra documentada em `escalaCirurgicaItens.js` e a conferência humana já existente; as três regressões novas não foram afrouxadas.

## 3. Achados propostos e não corrigidos

### P2 — O eval aceita troca de homônimos como ordem exata

Evidência: `scripts/lib/escalaVisionEval.mjs:102`. Reproduzido localmente, sem executar o runner da Vision:

```js
compararOrdem(['JOAO HENRIQUE', 'JOAO PEDRO'], ['JOAO PEDRO', 'JOAO HENRIQUE'])
// observado: { total: 2, posicoesCertas: 2, presentes: 2, exato: true, ... }
```

Impacto: o placar pode aprovar uma inversão operacional. Também não há métrica específica de acerto da hora em `pontuarLeitura`: a hora participa do pareamento de casos, mas não é pontuada separadamente.

Diff proposto: comparar identidades completas ou IDs curados no gabarito em `compararOrdem`/`compararConjunto`/anestesista; incluir um resultado `hora` por caso pareado e casos não pareados. Não aplicar aproximação por primeiro nome no placar. Regressões propostas: inversão dos dois JOAO deve resultar `exato: false`; hora inválida, vazia ou com data colada deve aparecer como erro de hora, separado de caso ausente. Sem migration, regra operacional ou mudança de prompt. Não foi alterado por ser P2; a medição com fotos continua fora do escopo autorizado.

### P2 — O lote ainda lê arquivos em série

Evidência: `src/pages/escala-cirurgica/ImportarEscalasPage.jsx:437`: cada iteração aguarda `lerArquivo`. Passo reproduzível com mock: selecionar três arquivos, manter a primeira Promise de `parseEscalaImagem` pendente e observar que a segunda chamada não começou. Não foi medido tempo de Vision nesta execução.

Impacto: a duração do lote soma a duração de cada leitura. Diff proposto: fila com concorrência limitada e resultados/carimbos por arquivo, mantendo descarte de respostas antigas, reanexo, cancelamento e limitação de memória. Testes propostos: falha de um arquivo não derruba os outros, ordem de resolução não troca hospital e cancelamento não aplica resultado atrasado. Mudaria a estratégia de execução/custo, não o prompt. Fica como proposta, conforme o escopo P0/P1.

### P2 — Retomar uma publicação parcial de FDS ainda reenvia unidades já concluídas

Evidência: `src/pages/escala-cirurgica/ImportarEscalaFdsPage.jsx:587` e o loop `for (const item of planoMapas)`: os arrays `publicados`/`falhas` são locais à tentativa e não filtram uma nova tentativa por unidade já concluída. A mensagem atual diz “Republicar é seguro (substitui o turno)”; isso descreve substituição, não uma retomada idempotente.

Reprodução proposta com a fixture `importarEscalaFdsMapas.test.jsx`: fazer `salvarEscalaTurno` resolver para sábado/manhã e rejeitar para sábado/tarde; repetir a tentativa e verificar que sábado/manhã é enviado de novo. Não executar em produção. Esta revisão comprovou o fluxo por inspeção, não executou esse cenário de retry em browser.

Impacto: repetição desnecessária e possível surpresa com a regra existente de zerar liberação numa republicação. Diff proposto: registrar resultado por `(data,hospital,turno)` e permitir retomar somente falhas, invalidando os sucessos se a conferência daquela unidade mudar; revisar a mensagem junto. Testar alterações concorrentes e rascunho reaberto. Depende de definir a semântica de retomada em sessão nova; não introduzida como feature durante a revisão.

### P2 — A matriz curta ainda lista lacunas que não descrevem todo o código atual

Evidência: `docs/escala-cirurgica-regras.md:38`, itens de lacunas 4/5. O contexto já possui `loadSeqRef`, `mutSeqRef` e guarda de escritas; a nova regressão cobre parte do contrato sanitizado. Diff proposto: atualizar as lacunas com o que falta de fato (duas sessões reais, pipeline completo autenticado, corpus por hospital), mantendo o histórico das decisões. Não é prova de que todas as corridas ou contratos estejam cobertos.

## 4. Regras sem trava completa

| Regra / limite | Onde está documentado | Cobertura atual | Trava que ainda deveria existir |
|---|---|---|---|
| Dois publicadores simultâneos não podem usar confirmação de perda vencida durante o RTT | Matriz canônica, Publicação; regras de conferência | Fetch fresco e comparação de contagem; RPC com lock | Dois clientes reais e validação/versionamento sob o mesmo lock; janela entre fetch e RPC ainda não é eliminada pelo cliente |
| Auth/RLS só permite os papéis previstos e auditoria usa identidade real | Matriz canônica, Acesso/Publicação | Personas e stubs de autorização no teste SQL | Integração com JWTs de papéis diferentes e banco isolado com todas as policies reais |
| A resposta completa da Vision por hospital preserva cor, linhas, turno e repetição | `.claude/rules/escala-visao-geral.md` | Helpers e sanitizador real testados; teste novo não chama o handler HTTP completo | Handler autenticado com resposta Anthropic simulada e fixtures desidentificadas por hospital |
| A ordem visual corresponde à operacional depois de todas as ações no celular | `.claude/rules/escala-liberacoes.md`; matriz canônica | Libs puras e testes de componentes/personas | Smoke E2E determinístico sem seed de produção; spec visual principal está explicitamente pausado |
| Retry de FDS não reenvia unidades já concluídas | Política de retomada do lote na matriz; FDS ainda difere | Fluxo de publicação e bloqueio por erro de consulta | Fixture de falha parcial, retomada e alteração da conferência por unidade |

Não confundir ausência de integração completa com defeito comprovado de RLS ou concorrência. Nenhum SQL de diagnóstico foi executado em produção.

## 5. Perguntas para o dono

Nenhuma decisão pendente bloqueia a entrega local. A autorização para preparar a migration foi dada na sessão anterior, e a autorização posterior para concluir permitiu alinhar a expectativa de duplicatas à regra documentada.

Para uma tarefa futura: definir se a retomada FDS deve sobreviver ao fechamento da conferência e em que condições uma unidade já publicada passa a ser uma republicação explícita; definir também se a confirmação de encolhimento deve ganhar uma precondição de versão validada no servidor. Ambos ultrapassam o ajuste local e podem exigir contrato/RPC ou persistência adicionais. Aplicação da migration, publicação da edge e integração na main não fazem parte desta entrega.

## 6. O que foi verificado e está bem

Última suíte completa, após o último ajuste de código:

```text
Test Files  300 passed (300)
Tests  5755 passed | 3 skipped (5758)
Duration  118.97s (transform 19.19s, setup 20.57s, import 114.80s, tests 498.53s, environment 150.65s)
```

`npm run lint`: ✖ 291 problems (0 errors, 291 warnings).
`npm run build`: ✓ built in 26.03s. Os avisos de lint são avisos existentes na base, não “lint sem avisos”.

`deno check --no-lock --node-modules-dir=false supabase/functions/parse-escala-cirurgica/index.ts`: aprovado. A primeira tentativa sem `--no-lock` tentou escrever `deno.lock` no worktree e foi recusada pelo sandbox; a verificação sem gerar lockfile passou. Não foi necessário alterar dependências Deno.

`npm run dev -- --host 127.0.0.1 --port 5196 --strictPort`: iniciou; `/` e os módulos `EscalaCirurgicaContext`, `ImportarEscalaPage` e `ImportarEscalaFdsPage` responderam HTTP 200 após transformação. A primeira checagem respondeu HTTP 200, mas encerrar o grupo de processos interrompeu o otimizador e gerou EPIPE; ela foi repetida em terminal interativo. Na repetição, os quatro endpoints responderam HTTP 200 e o comando próprio `q` encerrou o Vite com código 0, sem EPIPE. Evidência: `/private/tmp/anest-review-final-dev-recheck.log`. Permaneceram avisos de Browserslist/Tailwind. Isso confirma inicialização/imports; não substitui teste de fluxo autenticado.

Coberturas relevantes mantidas: isolamento de turno e recibos na RPC; normalização de iniciais; `//` e `?`; posição/rodapé e contraturno azul; casos compartilhados; FDS/feriado; ausência de notificações de eventos. Referências: `escalaPublicacaoSwapSql`, `escalaCirurgicaPaciente`, `turnoConvivencia`, `colunaLiberacao`, `plantaoNoturno`, `escalaFds`, `escalaCirurgicaPersonas` e novos testes listados na seção 2.

**Limites da verificação:** nenhum browser autenticado foi executado; os specs demo exigem credenciais e o pedido proíbe ler credenciais. O spec `escala-cirurgica-visual.spec.ts` contém `test.skip(true)` por fixture removida; `escala-cirurgica-troca.spec.ts` documenta instabilidade prévia. Não houve screenshot nem mudança de layout, navegação ou tema. Nenhuma leitura paga ou eval contra a Vision foi executada. O erro de crédito, o timeout e o cache são cobertos pelos testes existentes, mas latência/custo reais não foram medidos.

**Entrega Git:** nove commits de código, todos com testes no próprio commit, mais um commit documental com dispensa explícita de teste por ser documentação. Os artefatos desta revisão são versionados para deixar o worktree limpo. O checkout principal não foi editado por esta execução; os commits da outra sessão não foram incorporados nem revertidos. O origin/main atual pode diferir da base original, por isso o intervalo exato desta revisão é `12924e89..codex/revisao-escala-2026-09-08`.

Revisão solicitada pelo dono:
```sh
git log origin/main..codex/revisao-escala-2026-09-08
```
Intervalo exato dos commits desta revisão:
```sh
git log 12924e89..codex/revisao-escala-2026-09-08
git diff 12924e89..codex/revisao-escala-2026-09-08
```
