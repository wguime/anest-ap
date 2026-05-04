---
description: Audita o(s) arquivo(s) atual(is) contra checklist LGPD — base legal, consentimento, anonimização, retenção, direitos do titular
allowed-tools: Read, Grep, Glob
argument-hint: "[caminho-do-arquivo]"
---

# /lgpd-audit

Auditoria LGPD rápida sobre arquivo(s) específico(s) ou sobre o último diff de trabalho.

## Argumento
- `$ARGUMENTS` (opcional): caminho de arquivo ou diretório a auditar
- Se vazio: auditar todos arquivos modificados no working tree (`git diff --name-only`)

## Procedimento

### 1. Identificar escopo
- Se arg: arquivo(s) passado(s)
- Senão: `git diff --name-only` + `git diff --staged --name-only`

### 2. Para cada arquivo, identificar dados pessoais tocados
- Grep por: `email`, `nome`, `cpf`, `telefone`, `endereco`, `nascimento`, `userId`, `firebaseUid`, `consentimento`, `anonimo`, `dadosSensitivos`, `prontuario`, `incidente`, `denuncia`
- Listar campos detectados

### 3. Aplicar checklist LGPD (use rule `lgpd.md` + agent `lgpd-reviewer` como referência)

#### Categoria do dado
- [ ] Dado pessoal comum? Sensível (saúde)?
- [ ] Base legal explícita ou inferível?

#### Consentimento
- [ ] Há captura de consentimento antes da coleta?
- [ ] Consentimento é específico e revogável?
- [ ] Para dados sensíveis: destacado?

#### Anonimização
- [ ] Se feature suporta anônimo, identidade é IMUTÁVEL após escolha?
- [ ] Não há vazamento por correlação?

#### Minimização
- [ ] Algum campo coletado parece desnecessário?

#### Retenção
- [ ] Política de retenção declarada?
- [ ] DELETE automático configurado?

#### Segurança
- [ ] Firestore rule / RLS protege leitura?
- [ ] Não há dado sensível em `console.log()` ou response error?
- [ ] Não há secret hardcoded?

#### Audit trail
- [ ] Mutation registra `changedBy` real?

### 4. Reportar

```
## LGPD Audit — <arquivo(s)>

### Dados pessoais detectados
- campo X (categoria: comum/sensível, base legal: ...)

### Issues por categoria
**Consentimento:** ⚠️ ...
**Anonimização:** ✅ OK
**Retenção:** ❌ Não definida
...

### Risco geral
Alto / Médio / Baixo

### Ações sugeridas
1. ...
2. ...
```

## Quando escalar para agent `lgpd-reviewer`
- Se feature toca **prontuário eletrônico** (regras CFM além da LGPD)
- Se há **transferência internacional** de dados
- Se há **decisão automatizada** (Art. 20)
- Se feature manipula dados de **menores** (Art. 14)

Nessas, finalize seu relatório e invoque `@lgpd-reviewer` para revisão profunda.
