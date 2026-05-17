-- ==========================================================================
-- 20260518130000_aulas_captions.sql
-- Sprint 1 Wave 1.7 T1.1.9 — Schema captions multi-fonte
--
-- Objetivo: armazenar captions de aulas vindas de 3 fontes:
--   1. YouTube auto-captions (puxadas via Edge Function fetch-yt-captions)
--   2. Upload manual VTT/SRT do admin (anexar legenda já pronta)
--   3. Futuro: pipeline Whisper para uploads próprios (Sprint 5)
--
-- Notas arquiteturais:
--   - Aulas vivem em FIRESTORE (educacao_aulas/{aulaId}), não Supabase.
--     Esta migration cria SHADOW table 'aulas_captions' indexada por aulaId
--     (texto Firestore). Não há FK para aulas (eles vivem em outro banco).
--   - Multi-idioma: jsonb array de {lang, url, label, default, source}
--   - Cache YouTube fetched em tabela video_captions (TTL 30 dias)
-- ==========================================================================

-- ──────────────────────────────────────────────
-- 1. Tabela: aulas_captions (shadow para Firestore aulas)
-- ──────────────────────────────────────────────

create table if not exists public.aulas_captions (
  aula_id      text primary key,
  -- Array de tracks: [{ lang: 'pt-BR', url: '<storage_path>', label: 'Português', default: true, source: 'youtube_auto'|'manual_upload'|'whisper' }]
  tracks       jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  updated_by   text -- Firebase UID do admin que atualizou
);

comment on table public.aulas_captions is
  'Captions por aula (multi-idioma, multi-source). Shadow para Firestore educacao_aulas. T1.1.9.';

comment on column public.aulas_captions.tracks is
  'Array jsonb: [{lang, url, label, default, source}]. source: youtube_auto|manual_upload|whisper|vimeo_native.';

-- ──────────────────────────────────────────────
-- 2. RLS aulas_captions
-- ──────────────────────────────────────────────

alter table public.aulas_captions enable row level security;

-- SELECT: qualquer authenticated lê (captions são publicamente acessíveis ao aluno)
drop policy if exists ac_select_authenticated on public.aulas_captions;
create policy ac_select_authenticated on public.aulas_captions
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE: só admin (gestão de conteúdo)
drop policy if exists ac_insert_admin on public.aulas_captions;
create policy ac_insert_admin on public.aulas_captions
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists ac_update_admin on public.aulas_captions;
create policy ac_update_admin on public.aulas_captions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists ac_delete_admin on public.aulas_captions;
create policy ac_delete_admin on public.aulas_captions
  for delete
  to authenticated
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- 3. Tabela: video_captions (cache YouTube fetched)
-- ──────────────────────────────────────────────
-- YouTube captions fetched via youtube-caption-extractor.
-- TTL 30 dias (cron limpa registros antigos para forçar refresh).
-- Reduz chamadas à API/scraper YouTube + mitiga bot checks.
-- ──────────────────────────────────────────────

create table if not exists public.video_captions (
  id           uuid primary key default gen_random_uuid(),
  source       text not null
    check (source in ('youtube', 'vimeo')),
  video_id     text not null, -- YouTube videoId ou Vimeo videoId
  lang         text not null default 'pt',
  vtt          text not null, -- conteúdo VTT completo
  fetched_at   timestamptz not null default now(),
  fetched_by   text, -- Firebase UID do admin (audit)
  unique(source, video_id, lang)
);

comment on table public.video_captions is
  'Cache de captions YouTube/Vimeo fetched. TTL 30 dias via pg_cron. T1.1.9.';

-- UNIQUE constraint (source, video_id, lang) já cria índice implícito — não duplicar.
create index if not exists idx_video_captions_fetched_at
  on public.video_captions (fetched_at);

alter table public.video_captions enable row level security;

-- SELECT: authenticated lê (Edge Function consulta antes de fazer fetch)
drop policy if exists vc_select_authenticated on public.video_captions;
create policy vc_select_authenticated on public.video_captions
  for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE: só admin/service_role
drop policy if exists vc_insert_admin on public.video_captions;
create policy vc_insert_admin on public.video_captions
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists vc_update_admin on public.video_captions;
create policy vc_update_admin on public.video_captions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists vc_delete_admin on public.video_captions;
create policy vc_delete_admin on public.video_captions
  for delete
  to authenticated
  using (public.is_admin());

-- ──────────────────────────────────────────────
-- 4. Função helper: get_aula_tracks
-- ──────────────────────────────────────────────
-- Retorna o jsonb tracks pronto para o player Vidstack consumir.
-- Default vazio se nunca configurada.
-- ──────────────────────────────────────────────

create or replace function public.get_aula_tracks(p_aula_id text)
returns jsonb
language sql
security invoker
stable
as $$
  select coalesce(tracks, '[]'::jsonb)
  from public.aulas_captions
  where aula_id = p_aula_id;
$$;

comment on function public.get_aula_tracks(text) is
  'Retorna array de tracks (captions) para uma aula. Vazio se não configurada. T1.1.9.';

-- ──────────────────────────────────────────────
-- 5. Função helper: upsert_aula_track
-- ──────────────────────────────────────────────
-- Insere/atualiza um track específico (por idioma) em aulas_captions.tracks.
-- Idempotente: chamar 2x com mesmo lang substitui.
-- ──────────────────────────────────────────────

create or replace function public.upsert_aula_track(
  p_aula_id text,
  p_lang text,
  p_url text,
  p_label text default null,
  p_default boolean default false,
  p_source text default 'manual_upload'
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id text;
  v_existing jsonb;
  v_new_track jsonb;
  v_updated jsonb;
begin
  v_user_id := public.firebase_uid();
  if v_user_id is null then
    raise exception 'upsert_aula_track: user not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'upsert_aula_track: admin required';
  end if;

  -- Validar source
  if p_source not in ('youtube_auto','manual_upload','whisper','vimeo_native') then
    p_source := 'manual_upload';
  end if;

  -- Validar URL: deve ser HTTPS (defesa em profundidade contra XSS via VTT injection)
  -- Aceita storage Supabase, YouTube/Vimeo, ou qualquer HTTPS — bloqueia javascript:, data:, etc.
  if p_url is null or p_url = '' or p_url !~* '^https://' then
    raise exception 'upsert_aula_track: p_url must be HTTPS URL (got: %)', left(p_url, 60);
  end if;

  v_new_track := jsonb_build_object(
    'lang', p_lang,
    'url', p_url,
    'label', coalesce(p_label, p_lang),
    'default', coalesce(p_default, false),
    'source', p_source,
    'updated_at', to_jsonb(now())
  );

  -- Insert ou update
  insert into public.aulas_captions (aula_id, tracks, updated_at, updated_by)
  values (p_aula_id, jsonb_build_array(v_new_track), now(), v_user_id)
  on conflict (aula_id) do update
    set tracks = (
      -- Remove track com mesmo lang. Se novo é default=true, desmarca default
      -- dos outros (player Vidstack precisa de no máximo 1 default por track group).
      coalesce(
        (select jsonb_agg(
            case
              when coalesce(p_default, false) then jsonb_set(t, '{default}', 'false'::jsonb)
              else t
            end)
         from jsonb_array_elements(public.aulas_captions.tracks) t
         where t->>'lang' <> p_lang),
        '[]'::jsonb
      ) || v_new_track
    ),
    updated_at = now(),
    updated_by = v_user_id
  returning tracks into v_updated;

  return v_updated;
end;
$$;

comment on function public.upsert_aula_track(text, text, text, text, boolean, text) is
  'Insere/atualiza um track de caption por idioma. Admin-only. Idempotente. T1.1.9.';

-- ──────────────────────────────────────────────
-- 6. Função helper: delete_aula_track
-- ──────────────────────────────────────────────

create or replace function public.delete_aula_track(
  p_aula_id text,
  p_lang text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_user_id text;
  v_updated jsonb;
begin
  v_user_id := public.firebase_uid();
  if v_user_id is null then
    raise exception 'delete_aula_track: user not authenticated';
  end if;
  if not public.is_admin() then
    raise exception 'delete_aula_track: admin required';
  end if;

  update public.aulas_captions
  set tracks = coalesce(
        (select jsonb_agg(t) from jsonb_array_elements(tracks) t where t->>'lang' <> p_lang),
        '[]'::jsonb
      ),
      updated_at = now(),
      updated_by = v_user_id
  where aula_id = p_aula_id
  returning tracks into v_updated;

  return coalesce(v_updated, '[]'::jsonb);
end;
$$;

comment on function public.delete_aula_track(text, text) is
  'Remove track de um idioma específico. Admin-only. T1.1.9.';

-- ──────────────────────────────────────────────
-- 7. Grants
-- ──────────────────────────────────────────────

grant select on public.aulas_captions to authenticated;
grant select on public.video_captions to authenticated;
grant execute on function public.get_aula_tracks(text) to authenticated;
grant execute on function public.upsert_aula_track(text, text, text, text, boolean, text) to authenticated;
grant execute on function public.delete_aula_track(text, text) to authenticated;
