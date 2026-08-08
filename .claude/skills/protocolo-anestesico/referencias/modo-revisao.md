# Modo revisão — verificação periódica de protocolos

Usado quando o usuário pede atualização ou quando a execução vem de uma tarefa
agendada. O objetivo é **não reescrever documentos que não precisam mudar**.

## Procedimento

### 1. Inventariar

Ler cada protocolo do acervo e extrair: procedimento, versão, data da última
revisão, data da próxima revisão prevista, e as **condutas centrais** (as que,
se mudassem, mudariam o documento).

### 2. Buscar por delta

**Onde ficam os arquivos.** Em execução agendada no Cowork, os protocolos são lidos
do Google Drive ou do Notion via conector — tarefas agendadas rodam remotamente e
não enxergam pastas do computador. Em execução manual no chat, o usuário anexa os
arquivos.

Para cada protocolo, buscar publicações **posteriores à data da última revisão**:

1. Atualizações das diretrizes citadas na §22 (novas versões, errata, retirada).
2. Ensaios randomizados e metanálises sobre as condutas centrais.
3. Alertas regulatórios: ANVISA, CFM, retirada de fármaco do mercado, mudança
   de apresentação comercial.
4. Mudanças no formulário da própria instituição, se informadas.

Usar a data da última revisão como filtro explícito nas buscas. Não vale
recolher literatura antiga já contemplada.

### 3. Classificar cada achado

| Classe | Definição | Ação |
|---|---|---|
| **Sem impacto** | Confirma o que já está escrito | Registrar, não alterar o documento |
| **Atualização de referência** | Nova versão de diretriz já citada, sem mudança de conduta | Atualizar a §22 e a data de revisão |
| **Mudança de conduta** | Recomendação nova, revertida ou contraindicação nova | Atualizar o corpo do texto, a §21 e regerar os PDFs |
| **Urgente** | Alerta de segurança, retirada de fármaco, contraindicação nova | Sinalizar em destaque no topo do relatório |

### 4. Entregar

**Se não houve mudança de conduta:**
Relatório curto dizendo o que foi verificado, quais fontes foram consultadas, e
que o protocolo permanece válido. Registrar a data da verificação. Não gerar
PDF novo.

**Se houve mudança de conduta:**
- Incrementar a versão (2.0 → 2.1 para ajuste, → 3.0 para revisão estrutural).
- Expandir a §21 com uma linha por alteração: item anterior → nova recomendação
  → justificativa com referência.
- Regerar os três arquivos.
- No resumo, listar **só as mudanças**, não o documento inteiro.

### 5. Formato do relatório

```
REVISÃO PERIÓDICA — <data>

Protocolos verificados: <n>
Mudanças de conduta encontradas: <n>
Alertas urgentes: <n>

[URGENTE] <se houver>

<Procedimento> — v<x> (última revisão <data>)
  Status: sem alterações | referências atualizadas | conduta alterada
  Achados:
    - <fonte, ano> — <o que diz> — <classe> — <impacto>
  Ação tomada: <...>

Próxima verificação: <data>
```

## Cadência sugerida

| Frequência | O que verificar |
|---|---|
| **Mensal** | Alertas regulatórios e de segurança apenas (rápido, raramente gera mudança) |
| **Trimestral** | Diretrizes das sociedades e ensaios de grande porte sobre as condutas centrais |
| **A cada 2 anos** | Revisão estrutural completa, com reescrita e nova aprovação em reunião de serviço |

## Regra que não se quebra

Nunca alterar uma conduta clínica sem citar a fonte que motivou a mudança, e
nunca alterar silenciosamente. Toda mudança aparece na §21 e no relatório.

Se a evidência nova for ambígua ou conflitante, **não decidir sozinho**:
apresentar os dois lados no relatório e marcar como "requer decisão do serviço".
