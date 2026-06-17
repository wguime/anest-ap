---
name: escala
description: Importa a escala mensal UNIFICADA das funcionárias (sobreaviso materno + hospitais HRO/UNIMED/Plantão Pago) de um único docx, ou gera o template do mês para preenchimento. Atualiza src/data/sobreavisoMaterno2026.js e src/data/hospitaisTecnicas2026.js. Substitui as skills antigas /sobreaviso e /hospitais.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
disable-model-invocation: true
---

# Escala Mensal Unificada — Sobreaviso Materno + Hospitais

Repo canônico: `/Users/guilherme/dev/anest`. Um docx por mês cobre **as duas escalas**; a mesma pessoa preenche.

**Pasta dos modelos (padrão):** `/Users/guilherme/Documents/IA/Escalas funcinárias/` (nome com o typo "funcinárias" — manter). É onde os docx vazios ficam pra preencher e de onde o usuário anexa os preenchidos. O gerador salva lá quando chamado sem caminho de saída.

## Dois modos

### A. Gerar template do mês (antes de preencher)
Invocação típica: `/escala gerar 2026-08` (ou usuário pede "gera o template de agosto").
```bash
# Sem caminho → salva em /Users/guilherme/Documents/IA/Escalas funcinárias/Escala 2026-08.docx
python3 .claude/skills/escala/scripts/gerar_template.py 2026-08
```
Produz um docx com **uma tabela, uma linha por dia**, já com DATA, DIA-da-semana e FERIADO preenchidos. As células de hospital que não se aplicam vêm com `—`; as linhas de FDS/feriado ficam destacadas em verde. A pessoa só digita NOMES nas células vazias. Feriados saem de `FERIADO_LABELS` (`src/data/plantao2026.js`) — fonte única.

### B. Importar o docx preenchido
Invocação: `/escala <caminho-do-docx>` (anexo do usuário ou já na pasta de escalas). Use o path do argumento.
```bash
python3 .claude/skills/escala/scripts/importar.py "<docx preenchido>" --arquivar
```
Emite dois blocos JS prontos para colar + a conferência legível + um relatório de validação. **Exit ≠ 0 = há issues; não aplique sem resolver.** O script não escreve nos data files — quem aplica os `Edit` é você, depois de ler a conferência.

**`--arquivar` mantém a pasta de escalas espelhando o app:** com zero issues, copia o docx preenchido para `Documents/IA/Escalas funcinárias/Escala <YYYY-MM>.docx` (substitui o modelo em branco daquele mês). Se o usuário anexou de outro lugar, fica arquivado na pasta canônica; se já está lá, é no-op. Com issues, o arquivamento é pulado. Sempre rode com `--arquivar` no fluxo de atualização do app — é o que o dono pediu (pasta = espelho do que está em produção).

## Formato do docx (uma tabela, 7 colunas)
`DATA · DIA · SOBREAVISO · UNIMED (07-15) · HRO (07-15) · PLANTÃO PAGO (15-23) · FERIADO`

Regras de quem se aplica (espelham `hospitaisTecnicas2026.js`):
- **SOBREAVISO**: todo dia (19h→07h, 1 funcionária).
- **UNIMED**: sábados e feriados (domingo não tem).
- **HRO / PLANTÃO PAGO**: sábados, domingos e feriados.
- Feriado em dia útil (ex.: 25/08 ter, Dia do Município) → libera os 3 slots.
- Célula com `—` ou vazia em slot não-aplicável = ignorada pelo parser.

## Funcionárias válidas
`Marta · Renata · Luciana · Elisete · Saionara · Mari` (Mari é técnica, só hospitais). IDs estáveis em `FUNCIONARIAS_SOBREAVISO` / `FUNCIONARIAS_HOSPITAIS`. **Nome fora da lista** → o importador acusa; pare e confirme com o usuário (nova contratada precisa de email + conta Firebase/Supabase + entrada nos dois arrays).

## Aplicar nos data files
Use `Edit` apontando o fim do objeto, mantendo ordem cronológica — não reescreva o arquivo inteiro.
- `src/data/sobreavisoMaterno2026.js` → objeto `SOBREAVISO_MATERNO_2026` (todo dia do mês).
- `src/data/hospitaisTecnicas2026.js` → objeto `HOSPITAIS_2026` (só FDS/feriado).
- Atualizar o comentário de cabeçalho de cada arquivo (range + fonte).

## Depois de aplicar — testes (atualizar asserções!)
Cada import muda contagens e ranges. Atualize **antes** de rodar:

`src/__tests__/data/sobreavisoMaterno2026.test.js`:
1. `toHaveLength(N)` → total acumulado (abr+mai+jun+jul = 122; +mês cheio = +30/31).
2. Regex de key: `/^2026-(04|05|06|07|...)-\d{2}$/` — **incluir o novo mês**.
3. Caso `'retorna null para data fora do range'` — a data usada precisa continuar fora do range; ao importar um mês, mova-a para o mês seguinte.

`src/__tests__/data/hospitaisTecnicas2026.test.js`:
4. `toHaveLength(N)` → total (abr+mai+jun+jul = 38; +mês = +nº de FDS/feriados).
5. Regex de key: `/^2026-(04|05|06|07|...)-\d{2}$/` — incluir o novo mês.

Página de consulta:
6. `src/pages/ConsultaSobreavisoPage.jsx` → `const MAX_DATE = new Date('2026-07-31T00:00:00')` para o último dia do mês importado (senão o calendário não avança). Hospitais não tem MAX_DATE.

```bash
npm run test -- --run src/__tests__/data/sobreavisoMaterno2026.test.js src/__tests__/data/hospitaisTecnicas2026.test.js
npm run build
git add src/data/sobreavisoMaterno2026.js src/data/hospitaisTecnicas2026.js \
        src/__tests__/data/sobreavisoMaterno2026.test.js src/__tests__/data/hospitaisTecnicas2026.test.js \
        src/pages/ConsultaSobreavisoPage.jsx
git commit -m "feat(escala): importa <MÊS>/<ANO> (sobreaviso N dias + hospitais M dias)"
git push origin main
```

## Deploy (autorização explícita)
O classificador bloqueia `firebase deploy` quando a skill foi invocada só com o arquivo — e autorização de import anterior NÃO vale para o próximo. Faça commit+push e **confirme com o usuário** antes:
```bash
rm -f .firebase/hosting.*.cache && firebase deploy --only hosting:anest-ap
```
Ou peça que o usuário rode `! firebase deploy --only hosting:anest-ap`.

## O que muda no app
- Card "Sobreaviso Materno" e "Técnicas de Enfermagem" (Home + hub Escalas Funcionárias) passam a refletir o novo mês, com rollover às 07h.
- Trocas (`sobreavisoMaternoDiario` / `hospitaisDiario` no Firestore) continuam; overrides não são apagados.
- MATERNO/Férias/Atestado em dias úteis seguem manuais via Firestore.

## Anomalias herdadas (do formato antigo, já não ocorrem no template novo)
- Export do Numbers grudava domingo na célula do sábado e usava células multi-linha → era a maior fonte de erro de parsing. O template gerado por esta skill elimina isso (um valor por célula).
- Typos em DIA/SEMANA (`QURTA`) eram inofensivos — o parser usa a coluna DATA, não DIA.
