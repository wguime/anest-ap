# RIPD — Relatório de Impacto à Proteção de Dados Pessoais
## Módulo de Gestão de Incidentes e Canal de Denúncias — ANEST v3.70.0

**Versão:** 1.0 | **Data de emissão:** 2026-05-04 | **Próxima revisão:** 2027-05-04 (12 meses) ou em caso de mudança material no tratamento.

**Base normativa:** Lei 13.709/2018 (LGPD) Art. 38; Resolução CD/ANPD nº 4/2023; Guia Orientativo ANPD para Elaboração de RIPD; Template Governo Federal/SGD-PR.

> Este documento é elaborado pelo controlador como instrumento de governança preventiva. Será reapresentado à Direção Técnica e ao Comitê de Ética para aprovação formal em reunião ordinária e arquivado no acervo de compliance da ANEST.

---

## I. IDENTIFICAÇÃO DO CONTROLADOR

| Campo | Conteúdo |
|-------|----------|
| Razão social | ANEST — Anestesiologistas Associados *(razão social a ser preenchida pelo Comitê)* |
| CNPJ | *[a preencher pelo Comitê]* |
| Endereço | *[sede administrativa a preencher]* |
| Contato institucional | contato@anest.org *(placeholder)* |
| Encarregado pelo Tratamento de Dados (DPO) | *Nome a ser nominado em ata do Comitê de Ética* |
| Canal do DPO | privacidade@anest.app *(placeholder, a confirmar)* |
| Suplente do DPO | *a designar* |

> **Pendência crítica (Art. 41 LGPD):** DPO ainda não nominado em ata. A indicação do nome, e-mail próprio e publicação no rodapé do app, em URL pública e no `PrivacyPolicyModal.jsx` é pré-condição para conformidade plena. Este RIPD considera o cenário de DPO indicado em até 30 dias e pondera o risco residual nessa premissa.

### Operadores envolvidos (Art. 5°, VII LGPD)

| Operador | Papel | Localização | Instrumento contratual |
|----------|-------|-------------|------------------------|
| Supabase Inc. | Banco PostgreSQL + Auth + Storage + Edge Functions | AWS us-west-2 (Oregon, EUA) | DPA Supabase + Standard Contractual Clauses (SCCs) |
| Google LLC (Firebase Auth + Firestore + Hosting) | Identidade, regras de acesso, hospedagem | us-central1 (Iowa, EUA) | DPA Firebase + SCCs |
| Google LLC (Gmail SMTP via App Password) | Envio de notificações por email | Multi-region | DPA Workspace |

Todas as transferências internacionais serão amparadas pelo Art. 33, II (cláusulas-padrão contratuais) ou Art. 33, IX (garantias específicas), com avaliação documentada do nível de proteção do país destino.

---

## II. IDENTIFICAÇÃO DO TRATAMENTO

### 1. Nome do tratamento
Gestão de Incidentes de Segurança do Paciente e Canal Confidencial de Denúncias da ANEST — versão de software v3.70.0.

### 2. Sistemas envolvidos
- App ANEST (`https://anest-ap.web.app` — Firebase Hosting), módulo `incidents/`.
- Formulários públicos sem autenticação: `public/formulario-incidente.html` e `public/formulario-denuncia.html`.
- Banco transacional: Supabase PostgreSQL, tabela `public.incidentes` (`supabase/migrations/005_incidents.sql`).
- Firestore (Firebase): `incidentes/{id}` e `denuncias/{id}` — espelho/auditoria, regras em `firestore.rules:365-375`.
- Notificação por e-mail: Gmail SMTP via Edge Function `notify-incident`.

### 3. Finalidades específicas (Art. 6°, I LGPD — adequação)

| Finalidade | Descrição operacional |
|------------|------------------------|
| F1 | Notificação compulsória de eventos adversos e incidentes de segurança do paciente ao Núcleo de Segurança do Paciente (NSP), conforme RDC 36/2013 ANVISA. |
| F2 | Apuração e tratamento de denúncias éticas, assédio, fraude e violação de conduta, no âmbito do processo administrativo do Comitê de Ética (Lei 13.964/2019, Lei 14.457/2022, Resolução CFM 2.217/2018). |
| F3 | Comunicação ao titular sobre andamento e resolução do relato (feedback ao notificante/denunciante via tracking code ANEST-YYYY-XXXXXXXX). |
| F4 | Geração de indicadores estatísticos de qualidade e segurança em forma agregada e anonimizada (Qmentum, ROPs, Dashboard). |
| F5 | Aprimoramento contínuo dos protocolos clínicos (RCA — análise de causa raiz). |

### 4. Base legal por finalidade (Art. 7° e Art. 11 LGPD)

| Finalidade | Categoria de dado | Base legal |
|------------|-------------------|------------|
| F1 — eventos adversos do paciente (dado sensível de saúde) | Sensível | **Art. 11, II, "a"** (cumprimento de obrigação legal por controlador) c/c **Art. 7°, II** — RDC 36/2013, Portaria GM/MS 529/2013 (Programa Nacional de Segurança do Paciente), Resolução CNS 510/2016. |
| F1 — dados do notificante identificado | Pessoal comum | **Art. 7°, I** — consentimento explícito (checkbox bloqueante em `NovoIncidentePage.jsx`). |
| F2 — denúncia ética/conduta | Pessoal comum | **Art. 7°, IX** — exercício regular de direitos no processo administrativo (Lei 13.964/2019 art. 4°-A; Lei 14.457/2022 — canal de prevenção e enfrentamento ao assédio). |
| F3 — comunicação ao titular | Pessoal comum | **Art. 7°, V** — execução de contrato/procedimento iniciado pelo titular ao submeter o relato. |
| F4 — indicadores estatísticos | **Anonimizado** (não é dado pessoal — Art. 5°, III + Art. 12) | Fora do escopo de base legal após anonimização efetiva. |
| F5 — RCA | Pessoal comum + sensível | **Art. 7°, IX** — exercício regular de direitos do controlador (avaliação institucional) c/c **Art. 11, II, "f"** — proteção da vida e da incolumidade física do paciente. |

> **Decisão metodológica:** o tratamento NÃO é amparado primariamente em consentimento para os dados do paciente (que sequer interage com o sistema). Consentimento aplica-se apenas ao notificante identificado/confidencial, conforme registro `lgpd_consent_at` na tabela. A política de privacidade (`PrivacyPolicyModal.jsx`) será atualizada para refletir esta hierarquia de bases legais.

### 5. Categorias de titulares e volume estimado

| Titular | Categoria | Volume anual estimado |
|---------|-----------|------------------------|
| Anestesiologista titular ANEST (notificante) | Profissional cadastrado | ~150 ativos |
| Residente em anestesiologia | Profissional em formação | ~30 ativos |
| Profissional terceiro (cirurgião, enfermagem) citado | Terceiro identificável | ~50/ano |
| Paciente | Titular dos dados sensíveis de saúde | ~200/ano (estimativa baseada em incidentes esperados) |
| Denunciado | Pessoa apontada na denúncia | ~10/ano |
| Testemunha | Pessoa citada no relato | ~20/ano |

**Estimativa total:** ~460 titulares/ano.

### 6. Categorias de dados pessoais tratados

**Dados de identificação (notificante/denunciante quando não-anônimo):**
- Nome completo, e-mail, função, setor, ramal — JSONB em `notificante` / `denunciante`.
- Firebase UID (`user_id`) — quando autenticado no app.

**Dados pessoais sensíveis (Art. 5°, II LGPD):**
- Dados de saúde do paciente — em texto livre dentro de `incidente_data.descricao`, `impacto.danoPaciente`, `contexto_anest.*`.
- Dados de saúde mental ou orientação sexual potencialmente em denúncias de assédio (`denuncia_data.descricao`).

**Dados de terceiros:**
- Denunciado: nome, função, setor (em `denuncia_data`).
- Testemunhas: nome, contato (em `denuncia_data` ou `incidente_data`).
- Paciente: nome, prontuário, idade, sexo (em texto livre — recomenda-se substituir por nº de prontuário).

**Anexos:**
- Arquivos em `attachments` JSONB — atualmente referência URL; podem conter PII de paciente (foto, documento).

### 7. Fluxo de dados (collection → eliminação)

```
[1] Coleta
    ├─ App autenticado: NovoIncidentePage / NovaDenunciaPage → supabaseIncidentsService
    └─ Formulário público: HTML + JS → INSERT direto no Supabase (RLS policy inc_insert_anon)
[2] Persistência
    ├─ Supabase: tabela incidentes (RLS por papel — admin / owner / anon-tracking)
    ├─ Trigger: gera protocolo (INC/DEN-YYYYMMDD-NNNN) e tracking_code (ANEST-YYYY-XXXXXXXX)
    └─ Fire-and-forget email notification (Gmail SMTP) → admins do Comitê de Ética
[3] Acesso
    ├─ Notificante identificado: vê seus relatos (RLS inc_select_own)
    ├─ Anônimo: rastreia por tracking_code via RPC (rpc_fetch_by_tracking_code)
    ├─ Admin: gestão completa (IncidenteGestaoPage / DenunciaGestaoPage)
    └─ Confidencial: somente "gestor externo designado" (controle organizacional, sem ACL técnica refinada hoje)
[4] Tratamento
    ├─ Triagem → análise → parecer → ação corretiva → resolução
    └─ Audit trail: updated_by, updated_by_name, updated_at
[5] Retenção
    └─ Conforme política em docs/lgpd-retencao.md (incidentes 20a, denúncias 100a, notificante 5a)
[6] Anonimização ou eliminação
    ├─ rpc_anonimizar_incidente v2 (limpa todo JSONB com PII — migration 20260504_lgpd_art12)
    └─ Cron pg_cron diário aos vencimentos (migration 20260504_lgpd_art15)
```

### 8. Compartilhamento

| Destinatário | Finalidade | Base legal | Salvaguarda |
|--------------|------------|------------|-------------|
| Comitê de Ética ANEST | Apuração e parecer | Art. 7°, IX e Art. 11, II, "a" | Termo de confidencialidade dos membros |
| Gestor externo designado (denúncias confidenciais) | Apuração isolada do canal interno | Art. 7°, IX | Acordo de confidencialidade + ACL nominal |
| ANVISA via NOTIVISA (potencial) | Notificação de eventos adversos graves | Art. 7°, II — RDC 36/2013 | Submissão manual, dados mínimos necessários |
| Direção Técnica e Médica | Aprovação de plano de ação corretiva | Art. 7°, IX | Restrito a relatos identificados não-confidenciais |
| Justiça/Polícia (mediante requisição) | Cumprimento de ordem judicial | Art. 7°, VI | Apenas mediante mandado; comunicar titular se permitido |

**Não compartilha:** seguradoras, planos de saúde, empregadores diretos do denunciante, mídia, outros prestadores de serviço, finalidades comerciais.

### 9. Transferência internacional (Art. 33 LGPD)

Os dados são armazenados em **Supabase / AWS us-west-2 (Oregon, EUA)** e em **Firebase / Google us-central1 (Iowa, EUA)**. Os EUA não possuem decisão de adequação da ANPD.

**Base legal:** Art. 33, II — cláusulas-padrão contratuais (SCCs) constantes do DPA da Supabase Inc. e do DPA do Google Cloud, complementadas pela política interna de classificação de dados ANEST.

**Mitigação adicional:** avaliação semestral de migração para `sa-east-1` (São Paulo, AWS) ou para a região `southamerica-east1` da Google, eliminando o tópico de transferência internacional — a ANEST adotará São Paulo como destino preferencial em até 180 dias para tratamento de saúde, condicionado à análise de custo e disponibilidade do plano Supabase Pro.

---

## III. NECESSIDADE E PROPORCIONALIDADE

### 1. Necessidade do tratamento
A ANEST, como entidade que provê serviços de anestesiologia em ambiente hospitalar, está sujeita à RDC 36/2013 ANVISA, que obriga o NSP a manter sistema de notificação de eventos adversos. A não-existência do canal configura infração sanitária (Art. 5°, III RDC 36/2013) e descumprimento de obrigação legal — risco regulatório, civil e ético maior do que o risco do tratamento.

Adicionalmente, a Lei 13.964/2019 e a Lei 14.457/2022 demandam canal de denúncia próprio. A operação do canal de denúncia é, portanto, exigência simultaneamente regulatória (saúde) e protetiva (boa-fé do denunciante).

### 2. Proporcionalidade — minimização aplicada (Art. 6°, III LGPD)

| Medida | Implementação |
|--------|---------------|
| Modalidade anônima permitida | `tipoIdentificacao = 'anonimo'` zera coleta de PII; rastreio por código aleatório de 8 caracteres alfanuméricos sem ambíguos. |
| Modalidade confidencial | Atualmente oculta na UI (2026-05-04) até que o gestor externo seja designado em ata. |
| Coleta condicional de gênero | Em denúncias, gênero é opcional e excluído quando anônimo. |
| Campo de descrição é livre | Recomendação textual no formulário para usar nº de prontuário em vez de nome do paciente — *(a implementar como UI hint no v3.71)*. |
| Audit trail seletivo | Apenas mutações de status/parecer registram `updated_by`; leitura simples não é logada (princípio da necessidade). |

### 3. Aderência aos princípios da LGPD (Art. 6°)

| Princípio | Aderência | Observação |
|-----------|-----------|-------------|
| Finalidade | Conforme | Finalidades F1-F5 explicitadas; sem uso secundário não-compatível. |
| Adequação | Conforme | Base legal específica por finalidade (§II.4). |
| Necessidade | Parcial | Texto livre permite coleta excessiva — UI hint recomendado. |
| Livre acesso | Conforme | Painel "Meus Relatos" + export JSON via Profile > LGPD. |
| Qualidade | Parcial | Sem fluxo de correção pós-submit. |
| Transparência | Parcial | Modal cobre 11 seções; falta hospedar em URL pública estável. |
| Segurança | Parcial | RLS, JWT HS256 e audit trail; falta criptografia at-rest aplicacional dos JSONB sensíveis. |
| Prevenção | Conforme | Este RIPD evidencia governança preventiva. |
| Não-discriminação | Conforme | Cláusula de não-retaliação na política. |
| Responsabilização | Parcial | Falta DPO nominado e ROPA formalizado. |

---

## IV. PARTES INTERESSADAS CONSULTADAS

| Parte | Papel na consulta | Status |
|-------|-------------------|--------|
| Comitê de Ética ANEST | Validação da finalidade e base legal | Pendente — ata a ser produzida |
| Direção Técnica e Médica | Aprovação do RIPD e do plano de mitigação | Pendente |
| Equipe de Tecnologia / Desenvolvimento | Validação das medidas técnicas (RLS, criptografia, anonimização) | Consultada (auditoria interna 2026-05-04) |
| Assessoria Jurídica externa | Revisão da base legal e cláusulas de transferência internacional | Recomendado contratar antes da publicação v1.0 |
| Titulares (anestesiologistas e residentes) | Pesquisa de satisfação e percepção de privacidade | **Recomendação:** aplicar pesquisa qualitativa com no mínimo 5 anestesiologistas e 5 residentes antes da próxima revisão (2027). |
| Representante de pacientes | Indireta (via Direção Médica) | Não aplicável — paciente não interage com o sistema diretamente. |

> Caso a consulta aos titulares aponte risco residual relevante (ex.: percepção de vigilância ou retaliação em denúncia), os resultados deverão ser anexados a este RIPD e os controles revistos.

---

## V. RISCOS À PROTEÇÃO DE DADOS

**Metodologia:** matriz Probabilidade × Impacto, com classificação de severidade. Probabilidade: Baixa(1)/Média(2)/Alta(3). Impacto: Baixo(1)/Médio(2)/Alto(3)/Crítico(4). Severidade: Baixa(1-2)/Média(3-4)/Alta(6-8)/Crítica(9-12).

| ID | Risco | Vetor | Probabilidade | Impacto | Severidade pré-mitigação |
|----|-------|-------|---------------|---------|---------------------------|
| **R1** | Vazamento de descrição clínica em `incidente_data` | SQL injection via campo livre, sessão admin comprometida, backup mal-configurado | Média (2) | Crítico (4) | **8 — Alta** |
| **R2** | Reidentificação por correlação de relato "anônimo" + descrição livre contendo nome de paciente ou colega | Análise lateral por insider; cruzamento com escala de plantão | Alta (3) | Crítico (4) | **12 — Crítica** |
| **R3** | Acesso administrativo além do necessário (curiosidade, conflito de interesse) | Política RLS atual concede SELECT * a `is_admin()` sem distinção de papel | Média (2) | Alto (3) | **6 — Alta** |
| **R4** | Interceptação ou retenção indevida do email de notificação contendo PII | Gmail SMTP em texto puro no corpo; conta admin comprometida | Média (2) | Alto (3) | **6 — Alta** |
| **R5** | Retaliação contra denunciante por leak interno do `denunciante.nome` | Acesso de gestor interno a relato confidencial sem ACL técnica | Média (2) | Crítico (4) | **8 — Alta** |
| **R6** | Perda do `tracking_code` pelo titular (impede acompanhamento e exercício do Art. 18) | Código exibido apenas na tela final; sem confirmação por e-mail para anônimos | Alta (3) | Médio (2) | **6 — Alta** |
| **R7** | Anonimização incompleta — Art. 12 LGPD violado | `rpc_anonimizar_incidente` original (`005_incidents.sql:185-195`) ignorava `incidente_data.descricao`, `denuncia_data.descricao`, `admin_data`, `gestao_interna`, `attachments`, `updated_by_name` | Alta (3) | Crítico (4) | **12 — Crítica** |
| **R8** | Transferência internacional sem cláusula-padrão documentada | Supabase us-west-2; política não cita Art. 33 | Alta (3) | Alto (3) | **9 — Crítica** |
| **R9** | Retenção indeterminada — promessa sem cron | `rpc_anonimizar_dados_antigos` cobre só `documento_changelog`; `incidentes` sem job | Alta (3) | Médio (2) | **6 — Alta** |
| **R10** | Submissão pública abusiva (Firestore `create: if true`) | Spam, DoS, poisoning de dados | Alta (3) | Médio (2) | **6 — Alta** |
| **R11** | Base legal frágil — revogação de consentimento quebra apuração | Política atual ampara só Art. 7°, I e IX como "legítimo interesse" | Média (2) | Alto (3) | **6 — Alta** |
| **R12** | Falha de comunicação à ANPD em incidente de segurança (Art. 48) | Sem playbook de breach; tempo de detecção/resposta indefinido | Média (2) | Crítico (4) | **8 — Alta** |

**Sumário pré-mitigação:** 3 Crítico, 9 Alta, 0 Média, 0 Baixa. Tratamento classificado como **alto risco**.

---

## VI. MEDIDAS DE MITIGAÇÃO

Para cada risco identificado, são aplicadas medidas técnicas (T) e organizacionais (O), com indicação de status: **[I]** implementado, **[P]** parcial, **[Pe]** pendente. A coluna "Severidade pós" considera o risco residual.

### M1 — Vazamento de descrição clínica (R1)
- **T1.1 [P]** RLS em `incidentes` (`005_incidents.sql:122-162`), endurecida em `022_fix_incidents_security.sql:11`.
- **T1.2 [Pe]** Criptografia at-rest aplicacional dos campos sensíveis com `pgp_sym_encrypt` e chave em Supabase Vault — **prazo 60 dias**.
- **T1.3 [I]** TLS 1.3 in transit (Supabase, Firebase, Gmail SMTP).
- **T1.4 [P]** Backup criptografado padrão Supabase (AES-256); falta validação trimestral de restore.
- **O1.1 [Pe]** Termo de confidencialidade assinado por todos com acesso admin — **prazo 90 dias**.
- **Severidade pós:** 4 — Média.

### M2 — Reidentificação por correlação (R2)
- **T2.1 [Pe]** UI hint no formulário: "Use nº de prontuário, evite nome do paciente" — **prazo 30 dias**.
- **T2.2 [Pe]** Pipeline de mascaramento server-side (regex de CPF/nome próprio) antes de gravar em `incidente_data.descricao` — **prazo 90 dias**.
- **T2.3 [I]** Função `rpc_anonimizar_incidente` v2 (migration `20260504_lgpd_art12_full_anonimization.sql`) — apaga descrição livre.
- **O2.1 [Pe]** Política institucional de classificação de dados (público/interno/confidencial/restrito) — **prazo 60 dias**.
- **O2.2 [I]** Treinamento de RCA já reforça uso de identificadores de prontuário.
- **Severidade pós:** 4 — Média.

### M3 — Acesso admin além do necessário (R3)
- **T3.1 [Pe]** RBAC granular: separar `admin_geral`, `admin_etica`, `gestor_externo_denuncia` com policies RLS distintas — **prazo 90 dias**.
- **T3.2 [I]** Audit trail: `updated_by`, `updated_by_name`, `updated_at` (migration 022).
- **T3.3 [Pe]** Log de SELECT em `permission_audit_log` para registros sensíveis — **prazo 120 dias**.
- **O3.1 [I]** Lista de admins documentada em memória do projeto e gerenciada por código.
- **Severidade pós:** 3 — Média.

### M4 — Interceptação de email (R4)
- **T4.1 [I]** Gmail SMTP via TLS obrigatório.
- **T4.2 [Pe]** Reduzir conteúdo do email a "novo relato — protocolo INC-YYYYMMDD-NNNN — clique para ver no app", removendo PII completa — **prazo 30 dias**.
- **T4.3 [Pe]** Avaliar substituição por notificação push in-app (`createSystemNotification`) — **prazo 90 dias**.
- **O4.1 [I]** App Password Gmail rotacionado; conta dedicada `noreply@anest.app`.
- **Severidade pós:** 2 — Baixa.

### M5 — Retaliação contra denunciante (R5)
- **T5.1 [Pe]** Policy RLS específica `inc_select_denuncia_confidencial` que filtra por `gestor_externo_uid` — **prazo 90 dias** (combinada com M3).
- **T5.2 [I]** Tracking code aleatório de 8 caracteres sem ambíguos (`005_incidents.sql:98`).
- **T5.3 [I]** Modal de política declara expressamente proteção contra retaliação.
- **O5.1 [Pe]** Designar gestor externo titular + suplente em ata do Comitê — **prazo 60 dias**.
- **O5.2 [Pe]** Procedimento documentado de denúncia de retaliação com escalonamento à Direção Médica — **prazo 90 dias**.
- **Severidade pós:** 4 — Média.

### M6 — Perda de tracking code (R6)
- **T6.1 [I]** (2026-05-04) Tracking code agora exibido para TODOS os relatos (incluindo Identificado), não só anônimos.
- **T6.2 [Pe]** Reenvio do tracking code por email para identificados/confidenciais ao final do submit — **prazo 30 dias**.
- **T6.3 [Pe]** PDF de comprovante baixável com tracking code, protocolo e data — **prazo 60 dias**.
- **T6.4 [Pe]** Para anônimos, exibir tracking code em página dedicada com botão "copiar" + lembrete "anote agora" — **prazo 30 dias**.
- **O6.1 [I]** Página `RastrearRelatoPage` permite recuperar status digitando o código.
- **Severidade pós:** 2 — Baixa.

### M7 — Anonimização incompleta (R7)
- **T7.1 [I] CRÍTICO RESOLVIDO** Migration `20260504_lgpd_art12_full_anonimization.sql` reescreve `rpc_anonimizar_incidente` para limpar todos JSONB com PII. **A aplicar manualmente em produção via Supabase Dashboard**.
- **T7.2 [Pe]** Testes regredindo casos com nome em descrição — Vitest — **prazo 14 dias**.
- **O7.1 [I]** Política de retenção (`docs/lgpd-retencao.md`) informa anonimização nos prazos legais.
- **Severidade pós:** 3 — Média (resíduo: anonimização não cobre logs de banco e backups antigos; mitigação por retenção contratual de backup ≤ 30 dias na Supabase).

### M8 — Transferência internacional (R8)
- **T8.1 [Pe]** Adicionar seção 12 ao `PrivacyPolicyModal.jsx`: "Os dados são armazenados nos EUA (AWS us-west-2). A transferência é amparada nas cláusulas-padrão do DPA Supabase, com link público à versão vigente." — **prazo 30 dias**.
- **T8.2 [Pe]** Atualizar formulários públicos HTML com mesma cláusula — **prazo 30 dias**.
- **T8.3 [Pe]** Avaliar e iniciar migração para `sa-east-1` — **prazo 180 dias**.
- **O8.1 [Pe]** Anexar DPA Supabase + DPA Firebase ao acervo de compliance — **prazo 30 dias**.
- **Severidade pós:** 4 — Média (até migração) ou 2 — Baixa (após migração).

### M9 — Retenção indeterminada (R9)
- **T9.1 [I] (parcial)** Migration `20260504_lgpd_art15_retencao.sql` cria `rpc_aplicar_retencao_incidentes()`.
- **T9.2 [Pe]** Habilitar `cron.schedule` no Supabase após validação do Comitê — **prazo 30 dias**.
- **T9.3 [Pe]** Métrica em `useComplianceMetrics.js`: `lgpdRetentionAdherence = anonimizados_a_tempo / devidos`. — **prazo 90 dias**.
- **O9.1 [I]** Política `docs/lgpd-retencao.md` declara prazos diferenciados (incidentes 20a, denúncias 100a, notificante 5a).
- **Severidade pós:** 2 — Baixa.

### M10 — Submissão pública abusiva (R10)
- **T10.1 [Pe]** Rate limit no Supabase Edge Function que faz INSERT em nome de `anon` (5 submits/IP/hora) — **prazo 60 dias**.
- **T10.2 [Pe]** Captcha (hCaptcha ou Turnstile) nos formulários públicos — **prazo 60 dias**.
- **T10.3 [Pe]** Endurecer `firestore.rules` para `incidentes`/`denuncias`: validação de schema mínimo e `request.time` rate — **prazo 60 dias**.
- **O10.1 [I]** Monitoria manual via dashboard.
- **Severidade pós:** 2 — Baixa.

### M11 — Base legal frágil (R11)
- **T11.1 [Pe]** Reescrever `PrivacyPolicyModal.jsx` para refletir hierarquia de bases legais (§II.4 deste RIPD) — **prazo 30 dias**.
- **T11.2 [Pe]** Adicionar coluna `lgpd_consent_version` a `incidentes` + tela de re-aceite no próximo login após mudança da política — **prazo 60 dias**.
- **O11.1 [Pe]** Validação jurídica externa do novo texto antes da publicação — **prazo 45 dias**.
- **Severidade pós:** 3 — Média.

### M12 — Comunicação de incidente à ANPD (R12)
- **T12.1 [Pe]** Alerta no Supabase para queries anômalas (>1000 SELECTs em `incidentes` em 5 min) — **prazo 90 dias**.
- **O12.1 [Pe]** Criar `docs/lgpd-resposta-incidentes-seguranca.md` com (a) árvore "é incidente?", (b) prazos (até 2 dias úteis para ANPD, conforme guia), (c) templates de comunicação ANPD e ao titular, (d) responsáveis nominados — **prazo 60 dias**.
- **O12.2 [Pe]** Simulação tabletop semestral — **prazo 180 dias** e recorrente.
- **Severidade pós:** 3 — Média.

### Tabela-resumo dos riscos pós-mitigação

| ID | Sev pré | Sev pós | Δ |
|----|--------:|--------:|---|
| R1 | 8 | 4 | -4 |
| R2 | 12 | 4 | -8 |
| R3 | 6 | 3 | -3 |
| R4 | 6 | 2 | -4 |
| R5 | 8 | 4 | -4 |
| R6 | 6 | 2 | -4 |
| R7 | 12 | 3 | -9 |
| R8 | 9 | 4 (→2 c/migração) | -5 |
| R9 | 6 | 2 | -4 |
| R10 | 6 | 2 | -4 |
| R11 | 6 | 3 | -3 |
| R12 | 8 | 3 | -5 |

Pós-mitigação: 0 Crítico, 0 Alto, 7 Médio, 5 Baixo. **Risco residual aceitável** mediante implementação integral do plano.

---

## VII. CONCLUSÃO

### 1. Avaliação geral
O Módulo de Gestão de Incidentes e Denúncias da ANEST v3.70.0 trata dados pessoais sensíveis de saúde e dados de denunciantes em situação de potencial vulnerabilidade. Sem mitigação adicional, o tratamento apresenta **risco crítico** em três frentes (R2, R7, R8). Com as 12 medidas propostas — todas factíveis no prazo de 30 a 180 dias — o risco residual é reduzido a níveis **médio/baixo** e enquadra-se como **aceitável**.

### 2. Decisão
**Prosseguir com o tratamento, com ajustes obrigatórios.** Os ajustes T7.1, M11, M8 e M2 são pré-condição; os demais são plano contínuo. O tratamento NÃO deve ser suspenso, dadas as obrigações legais incidentes (RDC 36/2013).

### 3. Recomendação priorizada (Top 5 ações imediatas)

| # | Ação | Risco que mitiga | Status |
|---|------|------------------|--------|
| 1 | Reescrever `rpc_anonimizar_incidente` v2 (limpa todo JSONB com PII) + testes | R2, R7 | **Migration pronta — aplicar em produção** |
| 2 | Atualizar `PrivacyPolicyModal.jsx` com base legal correta + cláusula de transferência internacional + DPO nominado | R8, R11, Art. 41 | Em curso (B6) |
| 3 | Reduzir conteúdo do email de notificação (sem PII) + reenvio do tracking code ao notificante | R4, R6 | Pendente (próxima sprint) |
| 4 | Designar DPO em ata + criar canal `privacidade@anest.app` + publicar no app e na URL pública | Art. 41, R5 | Em curso (B3) |
| 5 | Implementar `rpc_aplicar_retencao_incidentes()` + `pg_cron` semanal + playbook de breach | R9, R12 | Migration pronta (B4); cron + playbook pendentes |

---

## VIII. APROVAÇÃO E REVISÃO

### Aprovação

| Função | Nome | Assinatura | Data |
|--------|------|------------|------|
| Encarregado pelo Tratamento de Dados (DPO) | _______________________ | _______________________ | ____/____/______ |
| Presidente do Comitê de Ética | _______________________ | _______________________ | ____/____/______ |
| Direção Técnica | _______________________ | _______________________ | ____/____/______ |
| Direção Médica | _______________________ | _______________________ | ____/____/______ |

### Revisão

- **Periodicidade obrigatória:** 12 meses a contar da emissão (próxima: 2027-05-04).
- **Revisão extraordinária:** mandatória em caso de (i) alteração material no tratamento (novo campo sensível, novo operador, mudança de finalidade); (ii) nova orientação ANPD ou alteração legislativa relevante (LGPD, RDC 36/2013, Lei 13.964/2019); (iii) ocorrência de incidente de segurança que afete o módulo; (iv) alteração da localização do operador (ex.: migração para `sa-east-1`).
- **Histórico de revisões:**

| Versão | Data | Autor | Alterações |
|--------|------|-------|-------------|
| 1.0 | 2026-05-04 | DPO + Comitê de Ética | Versão inicial. |

---

**Referências normativas**
- Lei 13.709/2018 (LGPD) — Arts. 5°, 6°, 7°, 8°, 9°, 11, 12, 14, 15, 18, 33, 38, 41, 46, 48.
- Resolução CD/ANPD nº 4/2023 — Regulamento de Aplicação de Sanções.
- Resolução CD/ANPD nº 15/2024 — Comunicação de Incidente.
- Guia Orientativo para Elaboração de Relatório de Impacto à Proteção de Dados Pessoais — ANPD.
- ANVISA RDC 36/2013 — Núcleo de Segurança do Paciente.
- ANVISA RDC 4/2009 — Farmacovigilância.
- Portaria GM/MS 529/2013 — Programa Nacional de Segurança do Paciente.
- Lei 13.964/2019 — Pacote Anticrime (canal de denúncia).
- Lei 14.457/2022 — Programa Emprega + Mulher (canal de assédio).
- Resolução CFM 2.217/2018 — Código de Ética Médica.
- Resolução CNS 510/2016 — Pesquisa em saúde.

---

## TODOs para o Comitê de Ética (com prazos)

| # | Ação | Responsável | Prazo |
|---|------|-------------|-------|
| 1 | Indicar DPO/Encarregado em ata; nome + e-mail próprio (sugerido `privacidade@anest.app`) | Comitê de Ética + Direção | 30 dias |
| 2 | Designar suplente do DPO | Comitê de Ética | 30 dias |
| 3 | Designar gestor externo titular + suplente para canal de denúncia confidencial | Comitê de Ética | 60 dias |
| 4 | Validar bases legais (Art. 7 II, 11 II "a", 7 IX) com assessoria jurídica externa | Direção + Jurídico | 45 dias |
| 5 | Aprovar política de retenção em ata | Comitê de Ética | 45 dias |
| 6 | Aprovar este RIPD em ata + arquivar no acervo de compliance | Direção Técnica + Comitê | 90 dias |
| 7 | Aplicar pesquisa de satisfação/percepção de privacidade com 5+ anestesiologistas e 5+ residentes | Comitê + TI | antes da revisão 2027 |
| 8 | Avaliar e decidir migração Supabase us-west-2 → sa-east-1 | Direção + TI | 180 dias |
| 9 | Aprovar plano de treinamento LGPD (1ª edição + reciclagem semestral) | Comitê + RH | 120 dias |
| 10 | Assinatura de termo de confidencialidade por todos com acesso admin ao módulo | RH + DPO | 90 dias |
| 11 | Marcar revisão ordinária do RIPD para 2027-05-04 em calendário institucional | DPO | imediato |
