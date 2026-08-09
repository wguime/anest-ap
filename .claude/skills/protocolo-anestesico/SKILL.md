---
name: protocolo-anestesico
description: Gera e revisa protocolos anestesicos institucionais por tipo de cirurgia, com marca ANEST, evidencia verificada e guia rapido. Use sempre que citarem protocolo, rotina ou POP anestesico.
---

# Protocolo Anestésico Institucional — ANEST

Gera protocolos de nível especialista: profundos o bastante para sustentar
decisão clínica e auditoria de acreditação, operacionais o bastante para serem
usados em sala às 3 da manhã.

## Quando acionar

Sempre que o usuário mencionar **criar, escrever, revisar, atualizar ou
formatar** protocolo, rotina, POP ou plano anestésico de qualquer cirurgia.
Exemplos: "protocolo para CRS-HIPEC", "faça o protocolo de transplante
hepático", "rotina anestésica para craniotomia acordado", "revise o protocolo de
cesárea", "atualize o de bariátrica". Acione igualmente para **temas
transversais**: "protocolo de jejum", "protocolo de sedação para endoscopia",
"rotina de NVPO", "protocolo de via aérea difícil", "manejo perioperatório de
semaglutida", "protocolo de hipertermia maligna". Acione também quando o usuário
só informar um tipo de cirurgia ou tema no contexto de padronização
assistencial, e em execuções agendadas de revisão periódica.

## Dois modos

| Modo | Quando | Saída |
|---|---|---|
| **CRIAÇÃO** | Usuário informa um procedimento ou tema | `.md` editável + PDF completo + PDF guia rápido |
| **REVISÃO** | Pedido de atualização, ou execução agendada | Relatório de mudanças; arquivos atualizados só se houver mudança de conduta |

Identifique o modo antes de qualquer coisa. Em seguida, o **tipo de documento**:

| Tipo | Teste | Estrutura |
|---|---|---|
| **Por procedimento** | O leitor pergunta "o que faço NESTA cirurgia?" (CRS-HIPEC, transplante hepático, feocromocitoma...) | `referencias/estrutura-protocolo.md` — 23 seções com cronologia por tempo cirúrgico |
| **Transversal** | O leitor pergunta "como conduzimos ESTE tema em qualquer cirurgia?" (jejum, sedação, NVPO, via aérea difícil, hipertermia maligna, anticoagulantes, semaglutida...) | `referencias/estrutura-transversal.md` — 14 seções temáticas; guia rápido de 1–2 páginas |

Nunca forçar a cronologia por tempo cirúrgico num tema transversal — produz
documento artificial. Todo o resto (pesquisa, verificação de referências e
doses, marca ANEST, página de controle, validação) é **idêntico** nos dois tipos.

---

## MODO CRIAÇÃO — sequência obrigatória

### 1. Contexto (rápido)

Ler `referencias/contexto-institucional.md`. É a fonte das premissas do serviço:
recursos disponíveis, formulário local, marca, repositório.

Você precisa de **uma informação obrigatória**: o procedimento. Faça **no máximo
uma rodada** de perguntas, e só se a ambiguidade mudar a estrutura do documento
(ex.: cardíaca com ou sem CEC). Nunca entreviste longamente antes de escrever —
é melhor entregar documento completo com premissas declaradas.

**Escopo etário é adulto por padrão** — pediátrico só quando o pedido disser.
Nunca misturar as duas populações no mesmo documento: dose por peso, via aérea,
jejum e limites de anestésico local divergem o bastante para que o documento
único vire fonte de erro.

**Noradrenalina é sempre expressa em BASE** (ampola brasileira = 8 mg de
hemitartarato = 4 mg de base), com a convenção declarada no texto, e a caixa de
atenção sobre a rotulagem da ampola na tabela de diluições. Ler o rótulo pela
convenção errada é erro de 2× num vasopressor.

Se o usuário anexar um esboço, ele é a **base, não a autoridade**. Trate como
rascunho a corrigir contra a evidência.

### 2. Pesquisar — não negociável

Ler `referencias/fontes-e-evidencia.md` e executar o **protocolo de busca**
descrito lá: mínimo de 10 buscas, organizadas em fases (mapear → aprofundar por
domínio → caçar refutações → comparar com serviços de referência → verificar
doses → checar regulatório local).

Ler `referencias/protocolos-referencia.md` antes da fase de comparação.
Protocolo institucional de outro serviço é **comparador, não autoridade**.

**Nunca escreva de memória.** Se uma busca não retornar a fonte esperada,
declare a lacuna no documento em vez de preenchê-la.

### 3. Verificar doses — as três camadas

Ler `referencias/verificacao-doses.md`. Toda dose precisa de:
1. **Duas fontes independentes** que concordem (bula ANVISA + referência
   farmacológica, ou diretriz + literatura primária)
2. **Aritmética recalculada por script**, nunca conferida de cabeça
3. **Contexto** — ajuste renal/hepático, extremos de peso, dose máxima somada de
   anestésico local por todas as vias, disponibilidade real no serviço

Consultar `referencias/apresentacoes-brasil.md` para apresentação comercial e
convenções. Atenção às armadilhas de rotulagem listadas lá — noradrenalina base
vs. hemitartarato é erro de 2×.

### 4. Estruturar e escrever

Ler a estrutura do tipo identificado — `referencias/estrutura-protocolo.md`
(por procedimento, 23 seções) ou `referencias/estrutura-transversal.md`
(temático, 14 seções) — e
`referencias/padroes-clinicos.md` (padrões do serviço e práticas refutadas a
caçar ativamente).

Regras que definem a qualidade:

- **Marcador de citação `[n]` + grau de evidência `[A]`–`[D]`** em toda conduta
  central. Condutas contraintuitivas exigem citação.
- **Faseamento por tempo cirúrgico** com tempos escritos **por extenso**,
  ancorados em eventos nomeados (INCISÃO + evento crítico do procedimento):
  "45 min antes da incisão", "faltando 30 min para a perfusão", "aos 30 min de
  perfusão". **Proibido código de tempo** (I0, H0, T−30) — regra completa em
  `estrutura-protocolo.md`.
- **Quadro "Linha do tempo de medicações"** obrigatório na §8: antibiótico e
  redoses, antieméticos, analgésicos/AINE, adjuvantes com regra de suspensão,
  HBPM e fármacos específicos — cada um com o seu momento.
- **Metas numéricas**, nunca adjetivas. "Diurese ≥ 0,5 ml/kg/h", não "adequada".
- **Tabela de gatilhos**: achado → conduta imediata, escalonada.
- **§21 (mudanças)** com justificativa e referência por alteração — é o que
  permite defender o documento em reunião de serviço.
- **§23 (página de aprovação)** com assinaturas e histórico de versões.
- Ao corrigir o esboço do usuário, **diga o que estava errado e por quê**.

### 5. Validar — bloqueante

Ler `referencias/controle-qualidade.md` e rodar:

```bash
pip install weasyprint markdown pdf2image pypdf --break-system-packages -q
python3 scripts/checa_qualidade.py protocolo.md --doses doses.json
```

Não renderizar com erro bloqueante pendente. O script pega tabela quebrada,
citação órfã e erro de aritmética de diluição — os três defeitos silenciosos.

### 6. Renderizar com a marca

Ler `referencias/identidade-visual.md`. Verde institucional ANEST `#004225`.

```bash
python3 scripts/build_pdf.py protocolo.md saida.pdf \
  --titulo "<procedimento>" --subtitulo "<subtítulo>" \
  --versao "1.0" --data "<mês/ano>" --proxima "<mês/ano + 2 anos>" \
  --base "<diretrizes que sustentam>" --refs <n> \
  --logo assets/anest-logo.svg
```

Se existir `assets/marca.json` (gerado pela extração da marca no repositório do
ANEST App), o script carrega a paleta e os caminhos de logo automaticamente —
não é preciso passar `--logo`. Sem logo, usa wordmark tipográfico: funciona, mas
avise o usuário que o arquivo real melhora o resultado.

O **guia rápido** é HTML escrito à mão (não convertido de markdown), conforme
`referencias/guia-rapido.md`. Renderizar com `--modo rapido`. Usar o marcador
`{{LOGO}}` no HTML onde o logo deve entrar.

### 7. Conferir visualmente e entregar

Renderizar páginas para imagem e inspecionar antes de entregar (capa, sumário,
página com mais tabelas, diluições, algoritmos, última página).

Entregar nesta ordem: **guia rápido → PDF completo → `.md` editável**.

No chat, declarar sempre:
1. Quantas doses foram verificadas em duas fontes; quais ficaram com fonte única
2. Quais referências foram confirmadas em busca nesta sessão
3. O que depende de confirmação com a farmácia da instituição
4. Quais recomendações ficaram em grau [C] ou [D] e por quê
5. As mudanças de maior impacto clínico — não descreva a estrutura do documento

Se o procedimento também existe em pediatria, **perguntar ao final** se o
usuário quer a versão pediátrica como documento separado. Perguntar depois de
entregar, nunca antes — a pergunta não pode atrasar o documento adulto.

---

## MODO REVISÃO

Ler `referencias/modo-revisao.md`. Em resumo: inventariar → buscar publicações
posteriores à última revisão → classificar cada achado (sem impacto /
atualização de referência / mudança de conduta / urgente) → só regerar arquivos
se houver mudança de conduta.

**Nunca alterar conduta clínica sem citar a fonte que motivou a mudança.**
Quando a evidência nova for ambígua, apresentar os dois lados e marcar como
"requer decisão do serviço" — não decidir sozinho.

---

## Limites que não se atravessam

- **Não inventar identificadores.** PMID, DOI, volume e página só entram se
  vierem de busca desta sessão. Na dúvida: autor/revista/ano.
- **Não afirmar grau de evidência não verificado.**
- **Declarar quando a evidência é fraca.** Boa parte da anestesia de grande porte
  é consenso; escrever isso aumenta a credibilidade.
- **Não copiar texto de protocolo institucional alheio.** Reescrever integralmente.
- **Rodapé obrigatório** em todos os PDFs: uso interno, doses a conferir com as
  apresentações da instituição, não substitui julgamento clínico.
- **Afirmação sem fonte não fica no documento** — ou se acha a fonte, ou se marca
  como [D], ou se remove.

## Arquivos

| Arquivo | Ler quando |
|---|---|
| `referencias/contexto-institucional.md` | Início, sempre |
| `referencias/fontes-e-evidencia.md` | Antes de pesquisar, sempre |
| `referencias/protocolos-referencia.md` | Fase de comparação com serviços de referência |
| `referencias/verificacao-doses.md` | Antes de escrever qualquer dose |
| `referencias/apresentacoes-brasil.md` | Ao escrever dose, diluição ou cálculo |
| `referencias/estrutura-protocolo.md` | Antes de estruturar (por procedimento) |
| `referencias/estrutura-transversal.md` | Antes de estruturar (tema transversal: jejum, sedação, NVPO, emergências...) |
| `referencias/padroes-clinicos.md` | Antes de escrever qualquer conduta |
| `referencias/controle-qualidade.md` | Antes de renderizar |
| `referencias/identidade-visual.md` | Ao renderizar |
| `referencias/guia-rapido.md` | Ao montar o guia rápido |
| `referencias/modo-revisao.md` | Modo revisão |
| `scripts/checa_qualidade.py` | Validação (bloqueante) |
| `scripts/build_pdf.py` | Renderização |
