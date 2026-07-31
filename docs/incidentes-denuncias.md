# Incidentes & Denúncias — ANEST

## Páginas (12+)
| Página | Função |
|--------|--------|
| IncidentesPage | Hub principal (5 widgets) |
| NovoIncidentePage | Form 4 steps |
| NovaDenunciaPage | Canal confidencial |
| MeusRelatosPage | Tracking do usuário |
| QRCodeGeneratorPage | Gerador QR |
| AcompanhamentoIncidentePage | Tracking incidente |
| AcompanhamentoDenunciaPage | Tracking denúncia |
| RastrearRelatoPage | Busca por código |
| IncidenteDetalhePage | Detalhe (ownership validation) |
| DenunciaDetalhePage | Detalhe (ownership validation) |
| IncidenteGestaoPage | Gestão interna (Comitê) |
| DenunciaGestaoPage | Gestão interna (Comitê) |

## 5 Widgets IncidentesPage
1. Relatar Notificação — Form novo incidente
2. Fazer Denúncia — Canal confidencial seguro
3. Meus Relatos — Tracking pessoal
4. Gerar QR Code — Acesso rápido formulários
5. Notificação Unimed — Link externo: `https://patientsafety.epimedmonitor.com`

## LGPD no Workflow
- Checkbox consentimento por relato
- Coleta condicional userId
- Coleta condicional gênero (denúncias)
- Ownership validation nos detalhes
- PrivacyPolicyModal (11 seções)

## Supabase Service
- `src/services/supabaseIncidentsService.js`
- CRUD + real-time + anonymous tracking
- RLS por role

## Formulários Públicos
Ver `docs/formularios-publicos.md`

## Integração
- Centro de Gestão → aba Incidentes
- LGPD rule → auto-enforced
- QR Codes → formulários públicos
- Dashboard → métricas consolidadas

## Anexos (2026-07-30)
Evidências sobem de verdade para o bucket privado `incidentes-anexos` (antes o form guardava só `file.name` e o INSERT descartava — DEN-20260727-8445 perdeu o anexo). Metadados `{name, path, size, type}` no JSONB `attachments`; download por signed URL TTL 300s (admin ou dono do upload); relato anônimo nunca persiste o nome original (`evidencia-N.ext`) e o trigger anula `owner_id` nas pastas `*-anon`. Detalhes/lições em `src/pages/incidents/CLAUDE.md`; riscos e mitigação em `docs/lgpd-ripd-incidentes.md` (R13/M13); retenção em `docs/lgpd-retencao.md`.

### Runbook — dependências a re-testar
- **Grant de UPDATE em `storage.objects` (role postgres):** `rpc_anonimizar_incidente` (scrub de anexos) depende dele. A Supabase vem restringindo acesso direto ao schema storage — após QUALQUER aviso de mudança de permissões da plataforma, re-testar com o probe de insert+rollback (ver commit ce034ce). Falha aqui = anonimização inteira falha alto e atômico (comportamento desejado; nunca capturar a exceção).
- **Trigger `tr_incidentes_anexos_scrub_anon` é imutável para nós** (DROP exige ownership de `storage.objects`). Mudança de comportamento = editar `fn_scrub_anexo_anonimo` via CREATE OR REPLACE; kill switch = corpo `RETURN NEW`.
- **Limpeza física do bucket:** `node scripts/cleanup-incidentes-anexos.mjs` (dry-run por padrão; `--apply --por <uid>` executa e audita; `--protocolo X` p/ pedido do DPO). Rodar trimestralmente ou sob demanda — cobre órfãos de submit abortado, pastas de relatos anonimizados e eliminação Art. 18.
