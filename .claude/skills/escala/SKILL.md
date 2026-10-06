---
name: escala
description: Publica no app a escala mensal das FUNCIONÁRIAS da enfermagem (sobreaviso materno + hospitais HRO/UNIMED/Plantão Pago) a partir do docx que o dono envia, mantém organizada a pasta Documents/IA/Escalas funcinárias e gera o modelo único de preenchimento. Use quando o dono mandar o docx e pedir "publique a escala das funcionárias", quando pedir o modelo/template da escala, ou ao mexer na pasta das escalas. Não é a escala cirúrgica (essa é a skill publicar-escala).
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
---

# Escala Mensal das Funcionárias — Sobreaviso Materno + Hospitais

Um docx por mês cobre **as duas escalas**. O app lê o Firestore `escalasFuncionarias/{YYYY-MM}`
(sem deploy: todos veem na hora). Mês publicado substitui o mês inteiro da base estática; abr→ago/2026
seguem congelados nos data files como fallback.

## Quando o dono envia a escala

1. **Achar todos os anexos do envio.** O WhatsApp copia o mesmo arquivo em várias pastas UUID e às
   vezes manda dois docx: `find ~/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents -name '*.docx' -newermt <data>`.
2. **Conferir com o parser do app:**
   `node .claude/skills/escala/scripts/conferir.mjs "<docx>" <scratchpad>`. O mês é o das DATAS,
   não o do nome do arquivo (em 02/10 veio `Escala 2026-08 gui.docx` com outubro). Se as sugestões de
   nome forem óbvias (Sayonara → Saionara), rode de novo com `--aplicar-sugestoes`; nome sem sugestão,
   pergunte. Exit 1 = o mês principal tem pendência, então não publique.
3. **Publicar cada mês** com o Firebase MCP `firestore_update_document` em
   `projects/anest-ap/databases/(default)/documents/escalasFuncionarias/<YYYY-MM>`: os campos de
   `escala-<YYYY-MM>.firestore.json` mais `updatedAt` com a hora real (`updatedBy` já é o dono, quem
   pede a publicação). Mês novo vai com `currentDocument: {exists: false}`. Substituir um mês já
   publicado completo apaga o mês inteiro, por isso pergunte antes; mês parcial é substituído sem perguntar.
   Linhas do mês seguinte coladas no fim do arquivo viram um mês parcial (decisão do dono, 02/10/2026).
   Sem sobreaviso ele é inofensivo: a Consulta do sobreaviso vai só até o último dia que tem nome.
4. **Atualizar a pasta** (o dono pediu que seja a cada envio, para a pasta espelhar o app):
   ```bash
   python3 .claude/skills/escala/scripts/pasta.py recebida "<docx>" <YYYY-MM> [rotulo]   # o original, no mês principal
   python3 .claude/skills/escala/scripts/pasta.py publicada <scratchpad>/escala-<YYYY-MM>.json   # cada mês publicado
   ```
5. **Reportar:** dias de sobreaviso e de hospitais por mês, cada correção feita no arquivo e o que ficou de fora.

**Formato antigo** (dois docx: sobreaviso de 3 colunas e hospitais de 4, com o domingo grudado no
sábado) devolve 0 dias, porque o parser exige as 7 colunas. Copie as colunas para o modelo e confira o
resultado; a legenda de totais no rodapé do docx é o cross-check.

## A pasta das escalas

`/Users/guilherme/Documents/IA/Escalas funcinárias/`. O typo "funcinárias" fica, porque é o nome que
o dono usa.
```
Modelo - escala mensal das funcionárias.docx   ← o único modelo para preencher
2026-10 Outubro/
  Escala 2026-10 - recebida.docx               ← como chegou; nunca editar
  Escala 2026-10 - publicada.docx              ← o que está no app; regerado a cada publicação
```
Rótulo na recebida quando vêm dois arquivos: `recebida (sobreaviso)`, `recebida (hospitais)`.

## Modelo de preenchimento

`Modelo - escala mensal das funcionárias.docx`, na raiz da pasta, serve para qualquer mês: não tem
datas nem faixas verdes, e quem preenche escreve o mês no título e a data em cada linha (pedido do
dono, 02/10/2026). Para regerar: `python3 .claude/skills/escala/scripts/gerar_template.py modelo`. O
template de um mês específico (`gerar_template.py YYYY-MM`, com datas e faixas verdes) ficou como legado.

## Formato do docx (uma tabela, 7 colunas)
`DATA · DIA · SOBREAVISO · UNIMED (07-15) · HRO (07-15) · PLANTÃO PAGO (15-23) · FERIADO`

- **SOBREAVISO**: todo dia (19h→07h, 1 funcionária).
- **UNIMED**: sábados e feriados (domingo não tem).
- **HRO / PLANTÃO PAGO**: sábados, domingos e feriados.
- Feriado em dia útil libera os 3 slots; feriado conhecido vem de `FERIADO_LABELS` (`src/data/plantao2026.js`)
  mesmo com a coluna FERIADO em branco, e o rótulo publicado é o de lá.
- O parser usa a coluna DATA, não o DIA: um typo no dia da semana é inofensivo.
- `FUNC.UNIMED` numa célula vira pendência: apague, porque o app já acrescenta a linha "Func. Unimed".

## Funcionárias válidas
`Marta · Renata · Luciana · Elisete · Saionara · Mari` (Mari é técnica, só hospitais). IDs em
`FUNCIONARIAS_SOBREAVISO` (`src/data/sobreavisoMaterno2026.js`). Nome fora da lista: pare e confirme com
o dono, porque uma nova contratada precisa de e-mail, conta Firebase/Supabase e entrada nos dois arrays.

## Outros caminhos
- **Pelo app** (o dono ou quem tem `hasEscalasEditPermission`): Hub Escalas Funcionárias → Importar.
  A tela recusa arquivo com dois meses e trata o "—" grudado no nome como nome desconhecido; por isso,
  quando o docx vem pelo chat, o caminho é o de cima.
- **Legado — data files + deploy** (`importar.py "<docx>" --arquivar`): só com o app e o Firestore fora
  do ar. Ele emite blocos JS para `SOBREAVISO_MATERNO_2026` / `HOSPITAIS_2026`; atualize junto as
  contagens e os regex de mês em `src/__tests__/data/{sobreavisoMaterno2026,hospitaisTecnicas2026}.test.js`
  e faça `git commit --only` desses 4 arquivos. O push publica pelo CI e recarrega o app de todos
  (CLAUDE.md → Deploy).
