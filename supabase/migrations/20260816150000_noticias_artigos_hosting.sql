-- ============================================================================
-- Artigos da curadoria: PDF servido pelo HOSTING do app, não pelo Storage.
--
-- O upload ao bucket `noticias-artigos` (20260816120000) exigia service_role
-- e ficou travado no guardrail de permissões do agente; os 404 do bucket
-- vazavam como JSON cru dentro do iframe (report do dono 16/08). Os 3 PDFs
-- CC-BY foram commitados em `public/artigos/` — o Firebase Hosting serve
-- arquivo existente ANTES do rewrite pra index.html, e URL relativa funciona
-- em dev e prod. O detalhe passa a renderizar PDF próprio com o PDFViewer da
-- gestão documental (react-pdf); o bucket fica sem uso (mantido vazio).
-- ============================================================================

update public.noticias set
  oa_pdf_url = '/artigos/eururo-2026-poise3-txa.pdf'
where doi = '10.1016/j.eururo.2026.03.019';

update public.noticias set
  oa_pdf_url = '/artigos/bja-2026-hipotensao-meta.pdf'
where doi = '10.1016/j.bja.2026.05.061';

update public.noticias set
  oa_pdf_url = '/artigos/aa-2026-dpip-cateter.pdf'
where doi = '10.1213/ane.0000000000008211';
