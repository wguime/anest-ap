# Contexto institucional

Os campos marcados **[do repositório]** foram extraídos do ANEST App em
2026-08-08 (commit `066a9a6`) e são confiáveis. Os que continuam com
`_(preencher)_` são coisas que o repositório **não sabe** — foram deixados em
branco de propósito, em vez de preenchidos por inferência. Quanto mais completo,
menos perguntas a skill precisa fazer e mais executável fica o documento.

---

## Identificação

- Serviço: Clínica de Anestesiologia Chapecó / GSM Anestesiologista Ltda
- Marca dos documentos: **ANEST** — plataforma de gestão da qualidade em
  anestesiologia **[do repositório]**
- Cidade: Chapecó, SC **[do repositório: a tabela UTM da codificação é a Lista de
  Chapecó]**
- Responsável técnico: _(preencher — nome e CRM, entra na página de aprovação.
  O organograma do app tem o **cargo** de Responsável Técnico, mas a pessoa está
  no Firestore, não no código)_
- Idioma: português do Brasil **[do repositório]**

### Locais onde os protocolos se aplicam **[do repositório]**

Lista curada em `src/data/incidentesConfig.js` (`LOCAIS`) — é onde o serviço
declara que atua:

- Clínica/Consultório de Anestesiologia
- Hospital Unimed · Hospital Regional do Oeste (HRO) · Hospital Materno Infantil
  — os três com escala cirúrgica diária e plantão noturno próprios
- IOSC – Hospital dos Olhos SC · AHO – Accurata Hospital dos Olhos · Hospital dos
  Olhos Chapecó
- Centro de Coluna e Imagem · Umanitá · Digimax · La Forme · Conception
- Clínica Cirúrgica Chapecó · Clínicas odontológicas

Cateter peridural só é registrado em **Unimed e HRO**.

## Perfil assistencial

- Público: adulto — _(confirmar: o serviço cobre o Hospital Materno Infantil e
  faz analgesia de parto, então obstetrícia e pediatria podem estar no escopo.
  O repositório não define faixa etária.)_
- Papel: assistência + supervisão de residentes **[do repositório: há módulo de
  Residência com estágios, rodízio e o papel `medico-residente`; na escala
  cirúrgica o residente é campo do caso, e não responde pelo caso]**
- Os documentos são usados em acreditação **Qmentum** **[do repositório: há
  módulo de compliance Qmentum com pesos por categoria, flags de revisão vencida
  e workflow de aprovação]** — manter versão, data de revisão, histórico de
  alterações e página de aprovação com assinatura.

## Recursos disponíveis
*(marcar o que existe; a skill não deve prescrever o que o serviço não tem, e
deve sinalizar quando um recurso ausente for clinicamente relevante)*

**O repositório não sabe nada sobre isto.** O ANEST App não tem inventário de
equipamento de anestesia — a busca por BIS, ROTEM/TEG, cell saver, TCI,
termodiluição, eco transesofágico e videolaringoscópio só encontra menções em
calculadoras clínicas e na taxonomia de incidentes, nunca como "o serviço tem".
Toda a lista abaixo depende de resposta humana.

- [ ] Débito cardíaco calibrado (termodiluição transpulmonar)
- [ ] Débito cardíaco não calibrado (contorno de pulso)
- [ ] Ecocardiografia transesofágica
- [ ] Tromboelastometria (ROTEM/TEG)
- [ ] TOF quantitativo (aceleromiografia/eletromiografia)
- [ ] Índice processado de EEG (BIS/entropia)
- [ ] Gasometria point-of-care em sala
- [ ] Aquecedor de fluidos de alto fluxo
- [ ] Recuperador de células (cell saver)
- [ ] Infusão alvo-controlada (TCI)
- [ ] Ultrassom para acesso vascular e bloqueios
- [ ] Videolaringoscópio / fibroscópio
- [ ] Banco de sangue no local (vs. remoto — muda o tempo de resposta)

## Equipamentos padronizados
*(informado pelo dono; não vem do repositório)*

- Bombas de seringa: Santronic, perfusor BBraun
- Seringas de bomba: BBraun 20 ml
- Bombas de infusão: BBraun
- Mantas térmicas: superior e inferior independentes
- Termometria: esofágica + vesical

## Formulário — observações locais

- Convenção adotada para noradrenalina: _(base ou hemitartarato — **preencher, é
  fonte de erro de 2×**)_
- Fármacos indisponíveis: _(preencher)_
- Substituições padronizadas: _(preencher)_
- Contato da farmácia para conferência de apresentação: _(preencher)_

## Marca **[do repositório]**

- Cor institucional ANEST: `#004225` (token `--primary` do app)
- Arquivos de logo: `assets/anest-logo.svg`, `assets/anest-logo-branco.svg` e
  `assets/anest-logo-dark.svg` — presentes, vetorizados do master do repositório
- Paleta e caminhos vêm de `assets/marca.json`, carregado automaticamente
- Detalhes e ressalvas: `referencias/identidade-visual.md`

## Preferências de documento

- Estrutura de 22 seções (`estrutura-protocolo.md`)
- Marcadores de citação numerados + grau de evidência [A]–[D]
- Referências em Vancouver abreviado, **sem PMID/DOI** salvo confirmados na sessão
- Entregar sempre: `.md` editável + PDF completo + PDF guia rápido
- Página de aprovação com campos de assinatura em todo documento completo
- Ciclo de revisão: 2 anos, com verificação periódica de diretrizes

## Onde ficam os protocolos aprovados

- **O próprio ANEST App tem o destino natural [do repositório]:** a Biblioteca /
  Gestão Documental já tem a categoria `protocolos_clinicos`, com versionamento,
  ciclo de aprovação, alertas de revisão vencida e arquivamento. É o repositório
  auditável que a acreditação Qmentum espera.
- _(preencher: se o protocolo publicado deve ser carregado na Biblioteca do app,
  em Google Drive/Notion, ou nos dois)_
- Tarefas agendadas leem por conector e **não acessam pastas do computador** —
  o destino escolhido precisa ser alcançável por conector.
