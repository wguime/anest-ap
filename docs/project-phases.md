# Fases do Projeto ANEST

## Progresso Geral
- Fases 1-13: ✅ Completas (95%)
- Fase 14: ✅ Parcial (split + lazy done; Lighthouse >90 aspiracional pendente)

## Fases Completadas
1. Setup Inicial — Vite + React 19 + Tailwind + ESLint
2. Design Tokens — Cores light/dark, tipografia, espaçamentos, sombras
3. Componentes Base — Button, Card, Badge, Avatar, Input, Skeleton
4. Layout & Navegação — Header, BottomNav, Sidebar, Tabs, Breadcrumb
5. Formulários — Select, Checkbox, RadioGroup, Textarea, Switch, DatePicker, FileUpload, FormField
6. Feedback — Toast, Modal, Alert, Progress, Spinner, EmptyState, ConfirmDialog
7. Data Display — Table, DataGrid, Calendar, Timeline, ChartContainer, DonutChart, SparklineChart
8. Utilitários & Mídia — Tooltip, Popover, Accordion, Collapsible, ScrollArea, AudioPlayer, PDFViewer, QRCode
9. Gamificação & ANEST — Quiz, Leaderboard, Achievement, Checklist + 24 componentes ANEST
9.5. KPIs — KPIDataProvider, KPIEditor, 21 indicadores qualidade

## Fase 10: Backend Integration ✅ (Sprint 21 fechou os 2 gaps abertos)
- [x] Firebase config + Auth service
- [x] Upload service com mock fallback
- [x] Supabase project (us-west-2)
- [x] PostgreSQL schema (5 tabelas)
- [x] supabaseDocumentService.js + supabaseIncidentsService.js
- [x] RLS + Firebase Auth → Supabase JWT (HS256)
- [x] **Migrate uploads para Supabase Storage** (Sprint 21 #87 — 3 buckets `profile-photos`/`reuniao-documentos`/`reuniao-atas` + dual-mode service layer + data migration script). Educacao paths continuam Firebase (não-regressão; Sprint 22+ se priorizar).
- [x] **Seed mock data** (Sprint 21 #88 — `supabase/seed.sql` + `scripts/seed-firebase.mjs` + orchestrador idempotente).

## Fase 11: E2E Tests ✅ (Sprint 16-18)
- [x] Playwright infra + scenarios golden path

## Fase 12: PWA ✅ (Sprint 14b + 21)
- [x] Service Worker via Workbox (Sprint 14b)
- [x] Offline shell + Quiz Firestore offline (Sprint 14b)
- [x] **Push notifications** (Sprint 21 #89 — FCM web push, opt-in component, edge function `send-fcm-push`, LGPD docs)

## Fase 13: Deploy ✅
- [x] Firebase Hosting deployed (anest-ap.web.app)
- [x] CI/CD GitHub Actions (Sprint 16-18)
- [x] Env vars (.env.local + Supabase Edge Secrets)

## Fase 14: Optimization ✅ parcial
- [x] Code splitting + lazy loading (Sprint 16-18 — bundle 4.25 MB → 1.20 MB → 1.23 MB v5.0.0)
- [x] WebP final pass (-472 KB acumulado v4.0.0+)
- [x] Lighthouse audit baseline + quick-wins (Perf 55 → 62, A11y/SEO/BP 100)
- [ ] **Lighthouse Performance >90** — gap 28pts. **Aspiracional**, pendente de decisão de produto. Exige SSR/SSG arquitetural (Vite SSR, Next.js migration, pré-render landing). Multi-sprint.

## Métricas Atuais (v5.0.0, 2026-05-13)
| Métrica | Atual | Target | Status |
|---------|-------|--------|--------|
| Componentes UI | 61 | 57 ✅ | OK |
| Componentes ANEST | 31 | 24 ✅ | OK |
| Hooks | 30+ | 15 ✅ | OK |
| Calculadoras | 76+ | 25 ✅ | OK |
| Páginas | 145+ | — | OK |
| Services | 37+ | — | OK |
| Contexts | 12 | — | OK |
| Tests | 1411 | — | OK (baseline 1 fail conflictQueue) |
| Test Coverage | ~13-15% | 80% | **Aspiracional** — gap ~65pp |
| Lighthouse Perf | 62 | >90 | **Aspiracional** — gap 28pts |
| Bundle main | 1.23 MB | — | OK |
| Storage providers | Supabase + Firebase fallback | Supabase only | Cleanup Sprint 22+ pós ≥30d |

## Backlog aspiracional (fora do planejamento inicial — decisão de produto)

Sprint 21 fechou os 3 gaps **bounded** restantes. Os itens abaixo NÃO fazem parte do mandato inicial — são metas evolutivas que dependem de priorização explícita do produto:

- **Lighthouse >90** (gap 28pts, SSR/SSG mudança arquitetural)
- **Test Coverage 80%** (gap ~65pp, ~50h ritmo atual)
- 3-way merge UI evolutiva
- API v3 cursor-based pagination (breaking)
- Self-host Inter (Google Fonts -845ms)
- Sitemap.xml + llms.txt automatizados
- Source maps em prod (decisão BP vs leak)
- Sentry DSN setup (user action — fallback Firebase Analytics ativo)
- CLS regression v4.2.0 (0.12 → 0.146)
- Reduce unused JS adicional
- Cleanup Firebase Storage legado pós ≥30d validação (Sprint 22+)
- Educacao paths para Supabase Storage (banners, videos, audios, thumbnails)
