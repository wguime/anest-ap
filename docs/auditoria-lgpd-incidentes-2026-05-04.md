# Auditoria LGPD — Módulo Incidentes/Denúncias ANEST v3.70.0

**Data:** 2026-05-04 | **Auditor:** Claude (automatizado, Opus 4.7) | **Escopo:** módulo `incidents/` + serviços e migrações relacionados

---

## Sumário Executivo

Dos 14 pontos auditados, **5 estão Conformes (35%)**, **5 Parciais (36%)** e **4 Ausentes (29%)**. O sistema acerta o essencial — coleta granular de identidade (identificado/confidencial/anônimo), checkbox de consentimento bloqueante, modal de Política de Privacidade com 11 seções, painel LGPD no perfil com export e solicitação de exclusão (Art. 18), RLS razoável após `022_fix_incidents_security.sql`. Mas falha em pontos formais críticos para um operador de saúde:

**Top 3 gaps críticos:**
1. **Sem RIPD** (Art. 38) para o canal de denúncias, que é tratamento de alto risco por design (dados sensíveis de saúde + identidade de denunciante de retaliação).
2. **DPO não nominado nem com canal próprio** (Art. 41) — política diz "via Comitê de Ética" sem email/nome (`PrivacyPolicyModal.jsx:152-158`).
3. **Anonimização incompleta** (Art. 12) — `rpc_anonimizar_incidente` (`005_incidents.sql:185-195`) só zera `notificante`/`denunciante`, deixa intactos `incidente_data.descricao`, `denuncia_data.descricao`, `admin_data`, `gestao_interna` e anexos, que rotineiramente contêm PII de paciente e de terceiros citados.

Adicionalmente: **sem RIPD/breach playbook**, **sem cláusula de transferência internacional** (Supabase em `us-west-2`), **retenção 5 anos não tem cron/trigger automático** (a função `rpc_anonimizar_dados_antigos` existe só para `documento_changelog`, não para `incidentes`), e **sem citação explícita de RDC 36/2013 ANVISA** ou Lei 13.964/2019 como bases legais — o módulo se ampara só em "consentimento + legítimo interesse" (`PrivacyPolicyModal.jsx:88-90`), o que é frágil para incidentes de saúde do paciente onde a base correta é obrigação legal (Art. 7, II + Art. 11, II, "a").

---

## Detalhamento por Artigo

### Art. 5 — Dado sensível (saúde)
**Status:** ⚠ Parcial
**Evidência:**
- Tabela `incidentes` (`005_incidents.sql:26-29`) armazena `incidente_data jsonb`, `impacto jsonb`, `denuncia_data jsonb` em texto livre; o frontend (`NovoIncidentePage.jsx`) coleta severidade, dano ao paciente, descrição clínica.
- Política reconhece sensibilidade (`PrivacyPolicyModal.jsx:42-44`) e `9. Armazenamento` cita controle por papéis (`:136-140`).
- **Sem criptografia at-rest aplicacional** (nenhuma referência a `pgcrypto`, encrypted columns ou KMS no `supabase/migrations/`). Há apenas o TLS de transporte e a criptografia padrão do Supabase.
- RLS aplicado (`005_incidents.sql:122-162`) e endurecida em `022_fix_incidents_security.sql:11` (drop da policy `inc_select_anon_tracking` que vazava todos os incidentes a anônimos).
**Risco:** alto — paciente é o titular real da maioria dos dados sensíveis e nunca consentiu.
**Recomendação:** (a) cifrar JSONB sensível com `pgcrypto` (`pgp_sym_encrypt`) usando chave em Supabase Vault; (b) restringir SELECT a admins e `created_by`; (c) revisar texto do form para evitar "nome do paciente" — usar registro/prontuário.

### Art. 7, II — Cumprimento de obrigação legal (RDC 36/2013 ANVISA, Lei 14.026, NSP)
**Status:** ✗ Ausente
**Evidência:** busca por `RDC.36`, `ANVISA`, `NSP`, `seguranca.do.paciente` em `src/`, `docs/`, `public/` e `supabase/` não retorna nada relevante (apenas `rcaConfig.js` para análise de causa raiz). A política cita só "consentimento + legítimo interesse" (`PrivacyPolicyModal.jsx:88-90`).
**Risco:** médio — base legal frágil. Notificação de eventos adversos é obrigatória pelo Núcleo de Segurança do Paciente (RDC 36/2013), portanto a base correta é Art. 7, II (obrigação legal) e Art. 11, II, "a" (saúde com base em obrigação regulatória), não consentimento (que é revogável e quebra o tratamento).
**Recomendação:** (1) acrescentar à seção 4 do `PrivacyPolicyModal` referência explícita à RDC 36/2013, Portaria GM/MS 529/2013 e Resolução CNS 510/2016; (2) classificar incidentes de paciente como base "obrigação legal", denúncias éticas como "exercício regular de direitos" (Art. 7, IX).

### Art. 7, IX — Exercício regular de direitos (denúncia / Lei 13.964/2019)
**Status:** ✗ Ausente
**Evidência:** modal cita só Art. 7, I (consentimento) e Art. 7, IX como "legítimo interesse" — mas **legítimo interesse é Art. 7, IX-bis e não cobre denúncias**. Sem menção à Lei 13.964/2019 ("Pacote Anticrime", que regula canais de denúncia de boa-fé) nem à Lei 14.457/2022 (canal de denúncia de assédio).
**Risco:** médio — o titular pode revogar o consentimento e exigir eliminação da denúncia, comprometendo a apuração.
**Recomendação:** corrigir seção 4 da política para usar Art. 7, IX (exercício regular de direitos no processo administrativo do Comitê de Ética) e citar as leis específicas.

### Art. 8 — Consentimento livre, informado, inequívoco
**Status:** ✓ Conforme
**Evidência:**
- Modal `PrivacyPolicyModal.jsx:34-166` cobre as 11 seções exigidas (controlador, dados, finalidade, base legal, anonimato, compartilhamento, direitos, retaliação, armazenamento, retenção, contato).
- Checkbox bloqueante: `NovoIncidentePage.jsx:787-796` (`isConsentimentoValid()` integrado em `isFormValid()`); botão submit `disabled={!isFormValid()}` em `:1002`.
- Mesma blindagem em `NovaDenunciaPage.jsx:305-308` e nos formulários públicos (`public/formulario-incidente.html:1678` e `public/formulario-denuncia.html:1461` — checkbox + termos).
- Anônimo isenta de consentimento (não há PII a tratar) — `:973` (`tipoIdentificacao !== 'anonimo'`).
**Risco:** baixo.
**Recomendação:** registrar versão do termo aceito (hash + timestamp) — hoje só grava `lgpd_consent_at`; adicionar `lgpd_consent_version` na tabela.

### Art. 9 — Acesso facilitado às informações
**Status:** ✓ Conforme
**Evidência:** banner LGPD aparece **antes** do submit em ambos os formulários públicos (`formulario-incidente.html:993-1008`, `formulario-denuncia.html:919-928`) com botão "Política de Privacidade" que abre o modal. No app autenticado, o link também está disponível no formulário (`NovoIncidentePage.jsx:1031-1033`).
**Risco:** baixo.
**Recomendação:** hospedar versão pública da política em URL fixa (ex.: `/politica-privacidade`) acessível por bookmarking — hoje só vive como modal.

### Art. 11 — Dado sensível (saúde do paciente em incidentes)
**Status:** ⚠ Parcial
**Evidência:** o consentimento é do **notificante** (profissional), não do **paciente** cujos dados aparecem nas descrições. O texto "Autorizo o tratamento dos meus dados pessoais conforme a LGPD…" (`NovoIncidentePage.jsx:991-993`) cobre apenas o relator. Para o paciente, a base legal deveria ser Art. 11, II, "a" (obrigação legal de regulação de saúde — RDC 36/2013) ou "f" (proteção à vida e incolumidade física).
**Risco:** alto — o paciente é titular real dos dados sensíveis sem consentimento nem base correta documentada.
**Recomendação:** documentar na política a base "obrigação legal — RDC 36/2013" para o paciente; orientar relator a usar identificadores (n.º prontuário) em vez de nome quando possível; mascarar PII em UI de gestão fora do necessary-to-know.

### Art. 12 — Anonimização irreversível
**Status:** ✗ Ausente (anonimização incompleta)
**Evidência:** `rpc_anonimizar_incidente` (`005_incidents.sql:185-195`):
```
update incidentes set
  user_id = null,
  notificante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
  denunciante = '{"tipoIdentificacao":"anonimo"}'::jsonb,
  anonymized_at = now()
where id = p_id;
```
Não toca em `incidente_data`, `denuncia_data`, `impacto`, `admin_data`, `gestao_interna`, `attachments`, `updated_by`, `updated_by_name`. As descrições em texto livre rotineiramente contêm nome de paciente, prontuário, nome de colegas citados — após "anonimizar", continuam expostos.
- O `processSolicitacao` (`lgpdService.js:301-312`) também só faz `user_id = null` em `incidentes`, com bug visível na linha 307 (`incidente_data: supabase.rpc ? undefined : null` — `undefined` não é serializado pelo cliente, então o campo nunca muda).
**Risco:** alto — anonimização declarada não é efetiva; ANPD considera violação.
**Recomendação:** estender RPC para (1) limpar `incidente_data->'descricao'`, `denuncia_data->'descricao'`, `admin_data`, `gestao_interna`, `attachments`; (2) zerar `updated_by_name`, `updated_by`; (3) preservar somente campos categóricos não-PII (severidade, categoria, datas). Tornar idempotente e logar em audit trail.

### Art. 15 — Término do tratamento (retenção)
**Status:** ⚠ Parcial
**Evidência:** política declara 5 anos com anonimização automática (`PrivacyPolicyModal.jsx:144-146`), porém:
- Função `rpc_anonimizar_dados_antigos` (`004_lgpd.sql:14-27`) só anonimiza `documento_changelog`, **não** a tabela `incidentes`.
- Nenhum job pg_cron agendado para incidentes (busca `pg_cron` retorna apenas `schedule_shift_reminders`, `fetch_noticias`, `fetch_classics` — nada para LGPD/incidentes).
- A coluna `anonymized_at` existe (`005_incidents.sql:41`) mas nada a popula automaticamente.
**Risco:** médio — política promete o que código não cumpre.
**Recomendação:** criar `rpc_anonimizar_incidentes_antigos()` análoga + agendar `cron.schedule('lgpd-anonimizar-incidentes','0 3 * * 0', …)` semanal; documentar prazo na tabela como `COMMENT`.

### Art. 18 — Direitos do titular
**Status:** ✓ Conforme (com ressalva)
**Evidência:** `ProfilePage.jsx:431-545` expõe painel LGPD colapsável com:
- Lista dos 6 direitos (`:455-486`).
- "Exportar Meus Dados" → `lgpdService.js:exportUserData` cobre 13 fontes (perfil, documentos, changelog, distribuições, **incidentes**, aprovações, mensagens, educação, certificados, comunicados, autoavaliações, planos de ação, auditorias) — `:71-83`.
- "Solicitar Exclusão" → cria registro em `lgpd_solicitacoes` (`lgpdService.js:213-247`).
- Status das solicitações exibido (`ProfilePage.jsx:514-546`).
**Ressalva:** não há fluxo de **correção** dos campos do incidente já submetido (Art. 18, III) — o usuário precisa abrir nova solicitação manual; **portabilidade** entrega JSON, não formato interoperável (FHIR/HL7) — para saúde isso pode ser exigido.
**Risco:** baixo a médio.
**Recomendação:** botão "Corrigir relato" em `MeusRelatosPage` enquanto status='pending'; documentar formato do export JSON em `docs/`.

### Art. 33 — Transferência internacional
**Status:** ✗ Ausente
**Evidência:** Supabase está em `us-west-2` (memória do projeto + `.claude/rules/supabase-firebase.md:25`), porém **nenhuma menção** a transferência internacional na política, no termo de consentimento, ou em `docs/`. Busca por `transferencia.internacional`, `cl.usula.padr`, `nivel.adequado`, `adequad` em todo o repo retorna zero matches relevantes.
**Risco:** alto — Art. 33 exige base legal específica (consentimento específico, cláusulas-padrão, certificações ou país com nível adequado de proteção; EUA não tem decisão de adequação da ANPD).
**Recomendação:** (1) adicionar seção 12 na política descrevendo armazenamento em AWS us-west-2, base legal (cláusulas-padrão contratuais) e link ao DPA da Supabase; (2) avaliar mover a infra para `sa-east-1` (São Paulo) para incidentes de saúde — disponível na Supabase Pro.

### Art. 38 — RIPD (Relatório de Impacto à Proteção de Dados)
**Status:** ✗ Ausente
**Evidência:** busca por `RIPD`, `dpia`, `risk.assessment`, `relatorio.impacto` em todo o repo: zero matches. Não existe documento de avaliação de impacto, mesmo o módulo sendo de **alto risco** (dados sensíveis de saúde + canal de denúncia, dois fatores que a ANPD cita explicitamente em sua Resolução CD/ANPD nº 4/2023 como demandando RIPD).
**Risco:** alto.
**Recomendação:** produzir `docs/lgpd-ripd-incidentes.md` com: contexto do tratamento, atores, fluxos de dados, ameaças (vazamento, retaliação, re-identificação de denunciante), salvaguardas (RLS, criptografia, anonimização, audit), riscos residuais e plano de mitigação. Revisar a cada 12 meses.

### Art. 41 — Encarregado (DPO)
**Status:** ✗ Ausente
**Evidência:** `PrivacyPolicyModal.jsx:152-158` diz "entre em contato com o Encarregado de Proteção de Dados (DPO) por meio do Comitê de Ética" — sem nome, sem email, sem telefone. Busca por `dpo@`, `privacidade@`, `encarregado` (com valor) em `src/`, `docs/` e `public/` retorna zero. ANPD exige nome e canal de contato direto, publicados.
**Risco:** alto — não-conformidade formal evidente, fácil de ser apontada em fiscalização.
**Recomendação:** indicar DPO (pode ser um membro do Comitê designado formalmente em ata), criar email `dpo@anest.org` (ou similar) e listar nome + email no modal de política, na home pública e no rodapé do app.

### Art. 46-48 — Segurança e comunicação à ANPD
**Status:** ⚠ Parcial
**Evidência:** salvaguardas técnicas existem (RLS, JWT HS256, audit trail `permission_audit_log` em `20260221194522_lgpd_and_audit.sql:51-86`, `updated_by`/`updated_by_name`). Mas **sem playbook de incidente de segurança** (procedimento documentado de detecção, contenção, notificação ANPD em "prazo razoável", comunicação ao titular). Busca por `vazamento`, `breach`, `ANPD`, `comunicacao.incidente` retorna zero docs.
**Risco:** alto — Art. 48 exige comunicação à ANPD; sem playbook, tempo de reação será ruim e configura agravante.
**Recomendação:** criar `docs/lgpd-resposta-incidentes-seguranca.md` com (a) árvore de decisão "é incidente de segurança?", (b) prazos (ANPD recomenda até 2 dias úteis), (c) template de comunicação à ANPD e ao titular, (d) responsáveis. Configurar alerta no Supabase para queries anômalas.

### Art. 50 — Boas práticas e governança
**Status:** ⚠ Parcial
**Evidência:** existem rules internas em `.claude/rules/lgpd.md` e comando `/lgpd-audit` (`.claude/commands/lgpd-audit.md`), o que é positivo para governança no ciclo de desenvolvimento. Falta: (a) política interna documentada para usuários finais (treinamento de uso do canal de denúncias e da gestão de incidentes); (b) registro de operações de tratamento (ROPA — Art. 37); (c) reciclagem periódica de aceite quando a política mudar (versão atual "Fevereiro de 2026" — `PrivacyPolicyModal.jsx:164` — sem versionamento estruturado).
**Risco:** médio.
**Recomendação:** (1) `docs/lgpd-treinamento.md` para staff; (2) ROPA tabular dos tratamentos (incidentes, denúncias, perfis); (3) campo `lgpd_consent_version` no registro de aceite + tela de re-aceite quando subir.

---

## Top 5 correções prioritárias (com effort)

1. **Estender `rpc_anonimizar_incidente` para limpar todos os JSONB com PII** — *effort: 4h* — corrige Art. 12; criar testes regredindo casos com nome em descrição.
2. **Criar `docs/lgpd-ripd-incidentes.md` (RIPD)** — *effort: 8-12h* — exigência regulatória explícita; usar template ANPD CD/4/2023.
3. **Nominar DPO + canal de contato + atualizar política** — *effort: 2h código + decisão administrativa do Comitê* — corrige Art. 41.
4. **Trocar base legal para "obrigação legal" (RDC 36/2013) em incidentes e "exercício regular de direitos" em denúncias; documentar transferência internacional** — *effort: 3h (texto da política + revisão jurídica)* — corrige Arts. 7, 11 e 33.
5. **Job pg_cron para anonimização aos 5 anos + playbook de breach** — *effort: 6h (migration + doc)* — corrige Arts. 15, 46-48.

---

## Próximos passos

1. Validar com o Comitê de Ética/jurídico a indicação formal do DPO (Art. 41) e produzir ata.
2. Implementar correções 1 e 5 (Top 5) na próxima sprint — ambos são código, não bloqueados por terceiros.
3. Redigir RIPD (correção 2) — pode usar este relatório como insumo.
4. Atualizar `PrivacyPolicyModal.jsx` e os dois HTMLs públicos com (a) base legal correta, (b) cláusula de transferência internacional, (c) DPO nominado, (d) versão do termo. Subir versão e disparar re-aceite no próximo login.
5. Avaliar migração da Supabase de `us-west-2` para `sa-east-1` para tratamento de saúde, eliminando o tópico de transferência internacional.
6. Agendar reauditoria em 90 dias para verificar fechamento.
