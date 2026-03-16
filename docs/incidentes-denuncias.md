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
