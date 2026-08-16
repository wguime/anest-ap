-- ============================================================================
-- PDFs completos dos artigos da curadoria (pedido do dono 16/08/2026:
-- "publique o resumo + o artigo completo conforme os arquivos enviados").
--
-- Bucket PÚBLICO `noticias-artigos`: os 3 artigos da curadoria de 14/08 são
-- open access CC-BY (a licença permite redistribuição com atribuição — a
-- citação completa está no próprio PDF), sem dado pessoal/de paciente. O
-- PDFEmbed do detalhe exige URL terminando em `.pdf` acessível por iframe
-- sem header de auth — daí público, não signed URL.
--
-- Escrita: NENHUMA policy de INSERT/UPDATE/DELETE — só service_role sobe
-- arquivo (mesma filosofia da tabela noticias), via
-- `node scripts/upload-noticias-artigos.mjs <arquivo.pdf>`.
-- ============================================================================

-- 1. Bucket público, só PDF, 20 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'noticias-artigos',
  'noticias-artigos',
  true,
  20 * 1024 * 1024,
  array['application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Aponta os 3 artigos da curadoria para os PDFs do bucket (upload feito
--    pelo script logo após o apply; o PDFEmbed tolera 404 transitório —
--    esconde a section e volta a mostrar quando o arquivo existe)
update public.noticias set
  oa_pdf_url     = 'https://vjzrahruvjffyyqyhjny.supabase.co/storage/v1/object/public/noticias-artigos/eururo-2026-poise3-txa.pdf',
  is_open_access = true,
  oa_provider    = 'curadoria'
where doi = '10.1016/j.eururo.2026.03.019';

update public.noticias set
  oa_pdf_url     = 'https://vjzrahruvjffyyqyhjny.supabase.co/storage/v1/object/public/noticias-artigos/bja-2026-hipotensao-meta.pdf',
  is_open_access = true,
  oa_provider    = 'curadoria'
where doi = '10.1016/j.bja.2026.05.061';

update public.noticias set
  oa_pdf_url     = 'https://vjzrahruvjffyyqyhjny.supabase.co/storage/v1/object/public/noticias-artigos/aa-2026-dpip-cateter.pdf',
  is_open_access = true,
  oa_provider    = 'curadoria'
where doi = '10.1213/ane.0000000000008211';

-- Inspeção:
--   SELECT doi, oa_pdf_url, is_open_access FROM public.noticias
--    WHERE curadoria_por IS NOT NULL;
