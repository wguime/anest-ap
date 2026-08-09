# Contexto institucional

Os campos marcados **[do repositório]** foram extraídos do ANEST App em
2026-08-08 (commit `066a9a6`). Os marcados **[padrão do serviço]** foram
decididos pelo serviço em 2026-08-09 e valem como definitivos — não perguntar de
novo a cada protocolo.

---

## Identificação

- Serviço: Clínica de Anestesiologia Chapecó / GSM Anestesiologista Ltda
- Marca dos documentos: **ANEST** — plataforma de gestão da qualidade em
  anestesiologia **[do repositório]**
- Cidade: Chapecó, SC **[do repositório: a tabela UTM da codificação é a Lista de
  Chapecó]**
- Responsável técnico: **não se aplica — uso interno sem publicação.** A §23 sai
  com os campos de assinatura em branco, preenchidos à mão na reunião de serviço
  que aprovar o documento.
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

### Escopo etário **[padrão do serviço]**

**Padrão: adulto.** Cirurgia pediátrica só quando informada explicitamente no
pedido.

Para procedimentos que existem nas duas populações, **perguntar ao final da
entrega** se o usuário deseja também a versão pediátrica como documento
separado. **Nunca misturar populações no mesmo protocolo** — dose por peso,
via aérea, jejum, volemia e limites de anestésico local mudam o suficiente para
que um documento único vire fonte de erro em vez de referência.

- Papel: assistência + supervisão de residentes **[do repositório: há módulo de
  Residência com estágios, rodízio e o papel `medico-residente`; na escala
  cirúrgica o residente é campo do caso, e não responde pelo caso]**
- Os documentos são usados em acreditação **Qmentum** **[do repositório: há
  módulo de compliance Qmentum com pesos por categoria, flags de revisão vencida
  e workflow de aprovação]** — manter versão, data de revisão, histórico de
  alterações e página de aprovação com assinatura.

## Recursos disponíveis

**Não se aplica como inventário fechado — uso interno sem publicação.** O
serviço opera em mais de dez locais, com disponibilidade que varia entre eles;
manter um checklist único seria falso.

Conduta da skill: **prescrever a conduta correta e, quando ela depender de um
recurso que pode não existir no local, declarar a dependência e oferecer a
alternativa** — "se houver tromboelastometria, guiar por ela; sem ela, usar
gatilhos de coagulograma convencional". O que não se faz é assumir silenciosamente
que o recurso existe, nem omitir a conduta melhor por suposição de que falta.

## Equipamentos padronizados
*(informado pelo dono; não vem do repositório)*

- Bombas de seringa: Santronic, perfusor BBraun
- Seringas de bomba: BBraun 20 ml
- Bombas de infusão: BBraun
- Mantas térmicas: superior e inferior independentes
- Termometria: esofágica + vesical

## Formulário — observações locais

### Noradrenalina — convenção do serviço **[padrão do serviço]**

**Todas as doses e diluições dos protocolos são expressas em NORADRENALINA
BASE** (ampola brasileira = 8 mg de hemitartarato = 4 mg de base).

**Toda prescrição e todo rótulo de bomba devem declarar a convenção em uso.**
A tabela mestra de diluições (§16) traz **sempre** a caixa de atenção sobre a
rotulagem da ampola.

Por que isto é regra e não preferência: a ampola brasileira é rotulada em
hemitartarato, e ler o rótulo como se fosse base — ou o contrário — é **erro de
2× na dose de um vasopressor**. A convenção só protege se estiver escrita no
documento, na prescrição e na bomba; declarada em um lugar só, não protege.

- Fármacos indisponíveis: **não se aplica como lista fixa** — varia por local.
  Quando um protocolo depender de fármaco de disponibilidade incerta, declarar a
  dependência e dar a alternativa padronizada, como em "Recursos disponíveis".
- Conferência de apresentação comercial: responsabilidade de quem usa o
  protocolo, antes do uso. É o que o rodapé de todos os PDFs já declara.

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

**Uso interno, sem publicação externa.** O destino de arquivo é decisão de
operação do serviço, não da skill — a skill entrega os três arquivos e para aí.

Duas opções em aberto, ambas válidas: a Biblioteca / Gestão Documental do próprio
ANEST App (categoria `protocolos_clinicos`, já com versionamento, ciclo de
aprovação e alerta de revisão vencida — é o acervo auditável que o Qmentum
espera), ou a pasta do Google Drive lida pelas tarefas agendadas.

Restrição que vale para qualquer escolha: **tarefas agendadas leem por conector
e não acessam pastas do computador.** Acervo que precise entrar na vigilância
dos loops tem de estar em destino alcançável por conector.
