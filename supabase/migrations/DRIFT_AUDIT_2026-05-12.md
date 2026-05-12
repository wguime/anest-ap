# Drift Audit — 2026-05-12

## TL;DR

**Zero drifts detected.** Every migration applied in the linked Supabase project
(`vjzrahruvjffyyqyhjny`) has a matching file in `supabase/migrations/`.

This is good news: post Sprint 15's catch of `20260512200000_incident_settings_realtime.sql`,
the repo is now in full sync with remote.

## Method

```bash
cd .claude/worktrees/fch-drift
npx supabase link --project-ref vjzrahruvjffyyqyhjny
npx supabase migration list --linked 2>&1 | tee /tmp/migration-drift.log
```

Drift rule: a row with empty `Local` column and populated `Remote` column =
remote migration not in repo (applied via dashboard SQL editor, never committed).

## Result

- **Total migrations on remote:** 94 timestamped + 30 numeric-prefix (001..030) = 124 rows
- **Total local files matched 1:1:** 124
- **Rows with empty Local (drift):** 0
- **Rows with empty Remote (local-only, not yet pushed):** 0

Note: `_WAVE_0_CONSOLIDATED.sql` is intentionally skipped by the CLI (filename
doesn't match `<timestamp>_name.sql` pattern). It's a consolidated historical
snapshot kept in repo for documentation; not tracked by `supabase_migrations.schema_migrations`.

## What This Means

- No retroactive `<ts>_<name>.sql` files need to be created.
- No SQL needs to be retrieved from the Supabase dashboard SQL editor.
- Wave 5 deploy is clear of migration drift risk.

## Steps If Drift Is Found in Future Audits

If a future run of `supabase migration list --linked` shows rows with empty
`Local`, follow these steps to retrieve the SQL:

1. Open Supabase dashboard → SQL Editor → History tab.
   URL: `https://supabase.com/dashboard/project/vjzrahruvjffyyqyhjny/sql/history`
2. Find the query whose timestamp matches the orphan `<ts>` (decode YYYYMMDDHHMMSS).
3. Copy the SQL exactly as executed.
4. Create `supabase/migrations/<ts>_<descriptive_name>.sql` with that content.
5. Mark as already-applied so `db push` skips it:
   ```bash
   npx supabase migration repair --status applied <ts>
   ```
6. Verify: `npx supabase migration list --linked` shows the row with both
   columns populated.
7. Commit the retroactive file with `ops(migrations): backfill <ts> drift`.

## Cadence

Recommend running this audit:
- Before each Wave/Sprint deploy that touches Supabase
- Quarterly as part of compliance hygiene
- Any time someone admits to running ad-hoc SQL in the dashboard

## Audit Log

| Date       | Auditor | Result   | Notes                                      |
|------------|---------|----------|--------------------------------------------|
| 2026-05-12 | Claude  | 0 drifts | Post Sprint 15 sync, full repo↔remote match |
