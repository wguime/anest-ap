# Residentes — Como atualizar a escala anual

## Passo 1 — Colocar o PDF nesta pasta
Nome esperado: `<ANO> Estágios.pdf` — ex: `2027 Estágios.pdf`.

## Passo 2 — No Claude Code, rodar
```
/rotacao-residencia
```

O Claude vai:
1. Ler o PDF desta pasta.
2. Gerar `src/data/residencia<ANO>.js` com a nova escala.
3. Integrar no app (registry multi-ano).
4. Rodar smoke tests.
5. Fazer build, commit, push, deploy em produção.

## Se esquecer o nome da skill
- Lista completa das skills: `CLAUDE.md` (raiz do projeto), seção **Skills Disponíveis**.
- Documentação da skill: `.claude/skills/rotacao-residencia/SKILL.md`.
- Alternativa: digitar `/` no Claude Code para ver todas as skills.

## Arquitetura atual (pra contexto)
- **Tabela estática 2026**: `src/data/residencia2026.js` (24 quinzenas × 8 residentes).
- **Card Home**: "Estágios Residência" em `src/pages/HomePage.jsx`.
- **Rollover automático**: 00h-12h = Manhã, 12h-19h = Tarde, 19h-00h = Manhã do dia seguinte.
- **Cirurgião + overrides por dia**: Firestore `residenciaEstagiosDiarios/{YYYY-MM-DD}-{manha|tarde}`.

## Observações
- Arquivos PDF nesta pasta **não** vão para produção (não aparecem no app publicado).
- Manter IDs de residente estáveis entre anos (ex: `r1-augusto` → `r2-augusto`) para preservar histórico de cirurgiões no Firestore.
