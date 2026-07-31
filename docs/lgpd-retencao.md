# Política de Retenção de Dados — LGPD Art. 15 (ANEST)

**Versão:** 1.0 — 2026-05-04
**Próxima revisão:** 2027-05-04 (anual)
**Aprovação:** ⚠ TODO — Comitê de Ética deve formalmente ratificar prazos (20a / 100a / 5a) em ata
**Escopo:** módulo `incidentes` (incidentes assistenciais + denúncias éticas) e dados auxiliares

---

## 1. Visão geral — framework regulatório aplicável

A retenção de dados pessoais no ANEST é governada por **três camadas regulatórias**, em ordem decrescente de especificidade:

1. **LGPD Art. 15** — o tratamento termina quando a finalidade é alcançada, salvo exceções dos Arts. 15 e 16 (cumprimento de obrigação legal/regulatória, estudo por órgão de pesquisa, transferência a terceiro com bases legais próprias, ou uso exclusivo do controlador anonimizado).
2. **CFM Resolução 1.821/2007** — registros de prontuário em **papel** podem ser eliminados após **20 anos**; registros **digitais** devem ser preservados de forma **permanente** (digitalização é equivalente). Para o ANEST, todos os incidentes nascem digitais — o prazo 20a é para **anonimização**, não eliminação.
3. **Decreto 10.153/2019** (regulamenta Lei Anticrime 13.964/2019) — identidade do denunciante de boa-fé é preservada por **100 anos**, com restrição de acesso. Aplica-se a `tipo='denuncia'`.
4. **Resolução CNS 466/2012 e 510/2016** — pesquisa em saúde requer guarda mínima 5 anos pós-término.

A LGPD Art. 16, II permite conservação além do prazo de finalidade quando há "cumprimento de obrigação legal ou regulatória pelo controlador" — é exatamente o que CFM e Decreto 10.153 impõem.

## 2. Tabela de retenção por tipo de dado

| Tipo de dado | Prazo | Base legal | Ação ao expirar |
|---|---|---|---|
| Incidentes — dados clínicos do paciente (`incidente_data`, `impacto`) | **20 anos** após `created_at` | Obrigação legal — CFM 1.821/2007 + RDC 36/2013 ANVISA | Anonimizar via `rpc_anonimizar_incidente` (preserva categorias agregadas, remove descrição livre) |
| Incidentes — dados de identificação do notificante (`notificante`, `user_id`) | **5 anos** após `gestao_interna.dataResolucao` | Consentimento (LGPD Art. 7, I) — finalidade alcançada | Anonimizar (`tipoIdentificacao='anonimo'`, `user_id=null`) |
| Denúncias — identidade do denunciante (`denunciante`) | **100 anos** após `created_at` | Obrigação legal — Decreto 10.153/2019 (Anticrime) + Lei 14.457/2022 | Manter pseudonimizado em coluna restrita; SELECT só por DPO + Comitê de Ética |
| Denúncias — descrições e fatos (`denuncia_data`, `admin_data`, `gestao_interna`) | **20 anos** após `created_at` | Obrigação legal — apuração disciplinar + compliance regulatório | Manter; após 20a, anonimizar terceiros citados |
| Audit logs (`permission_audit_log`, `documento_changelog`) | **5 anos** após `created_at` | Compliance + auditoria (LGPD Art. 37, ROPA) | Anonimizar via `rpc_anonimizar_dados_antigos` (já existe) |
| Attachments (Supabase Storage `incidentes-anexos/`) | Igual ao registro pai | — | Vínculo de identidade (`owner_id`) anulado pela própria `rpc_anonimizar_incidente` (migration `20260730230000`); exclusão FÍSICA via `scripts/cleanup-incidentes-anexos.mjs` (service-role — pg_cron não remove o objeto do Storage), que também limpa órfãos de submit abortado e atende pedido do DPO por protocolo |

**Notas:**
- "Anonimizar" = irreversível, conforme LGPD Art. 12 (não permite re-identificação por meios razoáveis).
- "Pseudonimizar" = identificador substituído por código, com mapeamento mantido em local separado de acesso restrito (LGPD Art. 13, §4º).
- Para incidentes envolvendo **óbito**, prazo conta a partir da data do óbito (CFM 1.821, Art. 4º), não da criação do registro.

## 3. Procedimento operacional

### 3.1 Coluna de controle

Migration `20260504_lgpd_art15_retencao.sql` adiciona:
- `incidentes.retain_until DATE NOT NULL DEFAULT (now() + interval '20 years')::date`
- Trigger `BEFORE INSERT` calcula `retain_until` por `tipo`
- Backfill: `UPDATE incidentes SET retain_until = (created_at + interval '20 years')::date WHERE retain_until IS NULL`

### 3.2 Job automatizado

Job pg_cron diário **03:00 UTC** (00:00 BRT) invoca `rpc_aplicar_retencao_incidentes()`:

```sql
select cron.schedule(
  'lgpd-retencao-incidentes',
  '0 3 * * *',
  $$ select public.rpc_aplicar_retencao_incidentes(); $$
);
```

A função:
1. Busca `WHERE retain_until < CURRENT_DATE AND anonymized_at IS NULL`
2. Para cada registro, invoca `rpc_anonimizar_incidente(id)` (versão LGPD Art. 12 completa em `20260504_lgpd_art12_full_anonimization.sql`; desde `20260730230000` também anula `owner_id` dos anexos do protocolo no bucket `incidentes-anexos`)
3. Registra operação em `permission_audit_log` com `action='lgpd_retencao_aplicada'` (contagens, data, base legal) — **fix `20260730240000`**: o INSERT original usava colunas inexistentes (`user_id`/`resource_type`/`details`) e, por estar atrás de `IF count > 0`, nunca tinha executado; teria quebrado (e revertido) a primeira rodada real de anonimização

> **Drift corrigido nesta doc (2026-07-30):** a versão anterior descrevia anonimização total de denúncias >100a e notificação diária ao DPO via `notifications` — **nenhum dos dois existe na função viva**. O sumário das execuções vive em `permission_audit_log` e o DPO consulta o dashboard LGPD no Centro de Gestão. Se a notificação ao DPO for desejada, deve nascer como decisão explícita (política atual do dono: avisos opt-in e agregados, nunca por evento).

## 4. Pedido de eliminação antecipada (Art. 18 V) vs obrigação legal

### 4.1 Conflito

Titular tem direito de pedir eliminação (LGPD Art. 18, VI) — já implementado em `lgpdService.js` via `lgpd_solicitacoes`. Porém:

- **Incidente assistencial:** CFM 1.821 obriga preservação por 20a do registro de cuidado (interpretação extensiva: notificação de evento adverso é parte do cuidado).
- **Denúncia:** Decreto 10.153 obriga preservação da identidade do denunciante por 100a (proteção contra retaliação) e dos fatos por 20a (continuidade da apuração).

### 4.2 Resolução

Aplica-se LGPD Art. 16, II — conservação por obrigação legal/regulatória sobrepõe-se ao Art. 18, VI.

**Resposta padrão ao titular** (template em `docs/lgpd-templates.md` — TODO):

> Sua solicitação de eliminação foi avaliada. Por força de obrigação legal (CFM 1.821/2007 e/ou Decreto 10.153/2019), o registro será **anonimizado** em vez de eliminado. A anonimização será aplicada conforme o prazo aplicável a cada categoria de dado. Você pode acompanhar o status em [link]. Esta decisão é fundamentada na LGPD Art. 16, II.

### 4.3 Anonimização antecipada possível

Se o titular pedir eliminação **antes** do prazo de retenção:
- **Permitido:** anonimizar `notificante`/`denunciante` (identidade) — atende ao espírito do pedido.
- **Não permitido:** apagar `incidente_data`/`denuncia_data` (fatos clínicos/disciplinares) antes do prazo legal.
- DPO documenta a decisão em `permission_audit_log` com justificativa.

## 5. Implementação técnica — checklist

- [x] Migration `rpc_anonimizar_incidente` LGPD Art. 12 completa criada (`20260504_lgpd_art12_full_anonimization.sql`)
- [ ] **Comitê de Ética** ratificar prazos em ata (TODO bloqueante)
- [ ] Aplicar `supabase/migrations/20260504_lgpd_art15_retencao.sql` (após revisão jurídica)
- [ ] Habilitar extensão `pg_cron` no Supabase
- [ ] Implementar exclusão de attachments no Storage (loop sobre `attachments` JSONB e DELETE no bucket)
- [ ] Criar dashboard LGPD em Centro de Gestão (visualizar registros vencidos e ações aplicadas)
- [ ] Atualizar `PrivacyPolicyModal.jsx` seção 10 — substituir texto genérico por tabela diferenciada
- [ ] Adicionar campo `lgpd_consent_version` na tabela e disparar re-aceite quando política mudar
- [ ] Reauditoria 90 dias após implementação

## 6. Versionamento

| Versão | Data | Autor | Mudanças |
|---|---|---|---|
| 1.0 | 2026-05-04 | Claude (Opus 4.7) — gerado automaticamente | Documento inicial; pendente ratificação Comitê de Ética |

**Próxima revisão obrigatória:** 2027-05-04 (anual ou a cada mudança regulatória).

## 7. Referências cruzadas

- Auditoria que originou esta política: `docs/auditoria-lgpd-incidentes-2026-05-04.md` (Art. 15 — Parcial)
- Migration rascunho retenção: `supabase/migrations/20260504_lgpd_art15_retencao.sql`
- Migration anonimização Art. 12: `supabase/migrations/20260504_lgpd_art12_full_anonimization.sql`
- Função existente correlata: `supabase/migrations/004_lgpd.sql:14` (`rpc_anonimizar_dados_antigos`)
- Política de privacidade (UI): `src/components/lgpd/PrivacyPolicyModal.jsx`
- Service LGPD: `src/services/lgpdService.js`
- Rule LGPD do projeto: `.claude/rules/lgpd.md`
