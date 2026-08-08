# Fontes, busca e avaliação de evidência

Este arquivo governa **de onde vem** cada afirmação do protocolo. Nenhuma conduta
entra sem passar por aqui.

---

## Regra zero

**Nunca escreva um protocolo apenas de memória.** O conhecimento do modelo tem
data de corte e a literatura perioperatória muda. Toda conduta central precisa
de uma fonte recuperada **nesta sessão**.

Se uma busca não retornar a fonte esperada, **diga isso no documento** em vez de
preencher a lacuna com memória. Uma lacuna declarada é gerenciável; uma
afirmação sem lastro não é.

---

## Hierarquia de fontes (ordem de precedência)

### Nível 1 — Diretrizes de sociedade específicas do procedimento
Buscar sempre primeiro. Se existir diretriz dedicada ao procedimento, ela é a
espinha dorsal do documento.

| Domínio | Sociedades |
|---|---|
| Perioperatório geral | ERAS® Society, ASA, ESAIC, SBA/AMB (Projeto Diretrizes) |
| Cardiovascular perioperatório | SBC (Diretriz de Avaliação Cardiovascular Perioperatória), ACC/AHA, ESC/ESAIC |
| Regional e neuroeixo | ASRA, ESRA |
| Via aérea | DAS, ASA Difficult Airway, SBA |
| Obstétrica | SOAP, OAA, SBA |
| Pediátrica | SPA, ESPA, SBA |
| Cardíaca | SCA, EACTA |
| Neuroanestesia | SNACC |
| Oncológica | SOAPC, ERAS oncológico |
| Sangramento e coagulação | ESAIC Severe Perioperative Bleeding, ASRA |
| Dor aguda | ASRA/ASA Acute Pain, PROSPECT (procedure-specific) |
| Terapia intensiva perioperatória | SCCM, ESICM, AMIB |
| Segurança e acreditação | WHO Safe Surgery, Helsinki Declaration, Qmentum/IQG, ANVISA, CFM |

### Nível 2 — Revisões sistemáticas e metanálises
Cochrane Library, Epistemonikos, revisões em revistas de alto impacto.
Avaliar com **AMSTAR-2** antes de tratar como definitiva.

### Nível 3 — Ensaios clínicos randomizados de referência
Especialmente os que **mudaram prática** ou **refutaram prática estabelecida** —
frequentemente a contribuição mais valiosa do protocolo.
Avaliar risco de viés (Cochrane RoB 2), tamanho amostral e aplicabilidade à
população brasileira.

### Nível 4 — Revisões narrativas e consensos de especialistas
Úteis para estrutura e para procedimentos raros. Declarar explicitamente quando
a recomendação repousa apenas neste nível.

### Nível 5 — Protocolos institucionais de serviços de referência
Ver `protocolos-referencia.md`. **Comparadores, não autoridades** — leia a
ressalva naquele arquivo antes de usar.

### Nível 6 — Livros-texto e formulários
Miller's Anesthesia, Clinical Anesthesia Procedures of the MGH, Stoelting's
Pharmacology & Physiology. Bons para fisiologia e farmacologia estáveis;
inadequados como fonte única para conduta que muda rápido.

---

## Protocolo de busca obrigatório

Executar **antes de escrever uma linha**. Mínimo de 10 buscas para protocolo
novo; 6 para revisão.

**Fase 1 — Mapear o terreno (2–3 buscas)**
1. `<procedimento> anesthesia guidelines <ano atual>`
2. `<procedimento> perioperative management review`
3. `ERAS <procedimento>` ou `<sociedade específica> <procedimento> guideline`

**Fase 2 — Aprofundar por domínio (4–8 buscas, uma por domínio relevante)**
Uma busca separada para cada eixo que o procedimento exige. Combinar domínios
numa única busca retorna resultado raso.
- fluidoterapia e hemodinâmica
- analgesia e neuroeixo
- ventilação
- coagulação e transfusão
- manejo específico do procedimento (térmico, metabólico, neurológico…)
- complicações e desfechos

**Fase 3 — Caçar refutações (1–2 buscas)**
- `<prática tradicional do procedimento> evidence against`
- `<procedimento> myths outdated practice`

Esta fase é o que separa um protocolo atualizado de um protocolo herdado.

**Fase 4 — Comparar com serviços de referência (1–2 buscas)**
Ver `protocolos-referencia.md`.

**Fase 5 — Verificar doses (ver `verificacao-doses.md`)**

**Fase 6 — Checar o local (1 busca)**
- Alertas ANVISA, resoluções CFM, disponibilidade do fármaco no Brasil,
  apresentação comercial vigente.

---

## Recência

| Tipo de conteúdo | Janela aceitável |
|---|---|
| Diretriz de sociedade | Versão vigente; sinalizar se > 5 anos |
| Conduta hemodinâmica, fluidoterapia, transfusão | Últimos 5–7 anos |
| Farmacologia básica e fisiologia | Sem limite |
| Apresentação comercial e disponibilidade | Últimos 12 meses |
| Alertas regulatórios | Últimos 24 meses |

Ao citar diretriz com mais de 5 anos, **verificar ativamente** se há versão nova
ou errata antes de usar.

---

## Avaliação crítica antes de incorporar

Para diretriz — critérios do **AGREE II** aplicados de forma pragmática:
- Quem financiou? Conflitos de interesse declarados?
- O método de busca e de graduação da evidência está descrito?
- Usa **GRADE** ou sistema equivalente?
- Houve revisão externa?
- Aplicável ao contexto brasileiro e aos recursos do serviço?

Para ensaio clínico:
- População comparável? Desfecho clinicamente relevante ou substituto?
- Tamanho adequado? Interrompido precocemente?
- Efeito consistente com o restante da literatura?

**Quando duas fontes de peso semelhante divergem:** apresentar as duas posições
no protocolo, indicar qual foi adotada e por quê. Não esconder controvérsia —
protocolo que finge consenso inexistente perde credibilidade em auditoria.

---

## Gradação declarada no documento

Cada recomendação central recebe uma marca de força, colocada ao lado da citação:

| Marca | Significado |
|---|---|
| **[A]** | Diretriz vigente com recomendação forte, ou metanálise consistente |
| **[B]** | ECR único de bom porte, ou diretriz com recomendação condicional |
| **[C]** | Consenso de especialistas, série de casos, extrapolação fisiológica |
| **[D]** | Prática institucional sem lastro externo — declarada como tal |

Ser honesto no **[C]** e no **[D]** aumenta a credibilidade do documento. Grande
parte da anestesia de grande porte é consenso; fingir que é [A] é o que
desmoraliza um protocolo em discussão técnica.

---

## Integridade das referências — limite duro

- **Nunca inventar PMID, DOI, volume ou página.** Só entram se vieram de uma
  busca desta sessão.
- Quando o identificador não foi confirmado: citar autor, título, revista, ano.
  Sem número inventado.
- Marcar no rodapé da §22 quais referências foram **confirmadas em busca nesta
  sessão** e quais vêm de conhecimento prévio, para conferência humana dirigida.
- Referência que não foi possível localizar: **remover a afirmação** ou marcá-la
  como consenso institucional [D]. Nunca manter afirmação órfã.

---

## Restrição técnica que define o método de verificação

**O ambiente de execução de código não alcança PubMed nem CrossRef** — ambos
retornam 403. Testado e confirmado.

- ❌ Não escrever script Python que consulte a E-utilities do NCBI ou a API do
  CrossRef. Falha silenciosa ou erro.
- ✅ Toda verificação bibliográfica passa por `web_search` + `web_fetch`.
- ✅ `web_fetch` só abre URL que já apareceu em resultado de busca. O fluxo é
  sempre **buscar → abrir o resultado**, nunca montar URL de cabeça.

O script `checa_qualidade.py` confere **aritmética e estrutura**, não
bibliografia. Verificação de referência é trabalho de busca, não de código.

## Marcação de status na §22

Cada referência da lista final recebe um marcador:

| Marca | Significado | O que entra na §22 |
|-------|-------------|--------------------|
| ✅ | Conferida no PubMed nesta sessão | Referência completa **com DOI e PMID** |
| ⚠ | Não localizada ou não conferida | Autor/revista/ano/páginas, **sem identificador**, marcada como pendente |
| ❌ | Encontrada, mas com dados divergentes | Corrigir para o que a fonte diz e registrar a correção na §21 |
| 🔴 | Retratada ou com errata | **Não usar** como sustentação |

A §22 abre declarando a contagem: quantas verificadas, quantas pendentes.
