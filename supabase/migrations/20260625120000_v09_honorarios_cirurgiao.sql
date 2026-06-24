-- ==========================================================================
-- 20260625120000_v09_honorarios_cirurgiao.sql
-- Lista Referencial de Honorários Clínicos e Cirúrgicos v.09 (01/04/2026).
-- A UTM local Chapecó subiu 1,73 → 1,75 (tratada no app, MULTIPLICADORES.local).
-- Esta migration aplica as mudanças de QUANTIDADE de UTMs do honorário do CIRURGIÃO
-- (47 códigos HM; aumentos). Modelo: valor_cirurgiao (intercâmbio) = qtd_UTM × 1,17.
-- NÃO toca valor_anestesista/indicador (os UTMs do anestesista não mudaram na v.09).
-- Idempotente: cada UPDATE só altera se o valor diferir (IS DISTINCT FROM).
-- ==========================================================================

update public.unimed_tuss_codigos set valor_cirurgiao = 131.04, updated_at = now() where codigo = '10101012' and valor_cirurgiao is distinct from 131.04;
update public.unimed_tuss_codigos set valor_cirurgiao = 121.68, updated_at = now() where codigo = '10106049' and valor_cirurgiao is distinct from 121.68;
update public.unimed_tuss_codigos set valor_cirurgiao = 524.16, updated_at = now() where codigo = '10106090' and valor_cirurgiao is distinct from 524.16;
update public.unimed_tuss_codigos set valor_cirurgiao = 131.04, updated_at = now() where codigo = '10106103' and valor_cirurgiao is distinct from 131.04;
update public.unimed_tuss_codigos set valor_cirurgiao = 2527.2, updated_at = now() where codigo = '40813193' and valor_cirurgiao is distinct from 2527.2;
update public.unimed_tuss_codigos set valor_cirurgiao = 327.6, updated_at = now() where codigo = '40813231' and valor_cirurgiao is distinct from 327.6;
update public.unimed_tuss_codigos set valor_cirurgiao = 1404.0, updated_at = now() where codigo = '40813282' and valor_cirurgiao is distinct from 1404.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 936.0, updated_at = now() where codigo = '40813304' and valor_cirurgiao is distinct from 936.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1310.4, updated_at = now() where codigo = '40813320' and valor_cirurgiao is distinct from 1310.4;
update public.unimed_tuss_codigos set valor_cirurgiao = 936.0, updated_at = now() where codigo = '40813347' and valor_cirurgiao is distinct from 936.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 936.0, updated_at = now() where codigo = '40813371' and valor_cirurgiao is distinct from 936.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1263.6, updated_at = now() where codigo = '40813401' and valor_cirurgiao is distinct from 1263.6;
update public.unimed_tuss_codigos set valor_cirurgiao = 936.0, updated_at = now() where codigo = '40813487' and valor_cirurgiao is distinct from 936.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 608.4, updated_at = now() where codigo = '40813517' and valor_cirurgiao is distinct from 608.4;
update public.unimed_tuss_codigos set valor_cirurgiao = 2527.2, updated_at = now() where codigo = '40813541' and valor_cirurgiao is distinct from 2527.2;
update public.unimed_tuss_codigos set valor_cirurgiao = 2808.0, updated_at = now() where codigo = '40813550' and valor_cirurgiao is distinct from 2808.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 2574.0, updated_at = now() where codigo = '40813576' and valor_cirurgiao is distinct from 2574.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 2340.0, updated_at = now() where codigo = '40813584' and valor_cirurgiao is distinct from 2340.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1638.0, updated_at = now() where codigo = '40813606' and valor_cirurgiao is distinct from 1638.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 2340.0, updated_at = now() where codigo = '40813614' and valor_cirurgiao is distinct from 2340.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1872.0, updated_at = now() where codigo = '40813622' and valor_cirurgiao is distinct from 1872.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1404.0, updated_at = now() where codigo = '40813630' and valor_cirurgiao is distinct from 1404.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 3276.0, updated_at = now() where codigo = '40813649' and valor_cirurgiao is distinct from 3276.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1404.0, updated_at = now() where codigo = '40813657' and valor_cirurgiao is distinct from 1404.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1638.0, updated_at = now() where codigo = '40813665' and valor_cirurgiao is distinct from 1638.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1404.0, updated_at = now() where codigo = '40813673' and valor_cirurgiao is distinct from 1404.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1170.0, updated_at = now() where codigo = '40813681' and valor_cirurgiao is distinct from 1170.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1404.0, updated_at = now() where codigo = '40813690' and valor_cirurgiao is distinct from 1404.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1170.0, updated_at = now() where codigo = '40813703' and valor_cirurgiao is distinct from 1170.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1029.6, updated_at = now() where codigo = '40813720' and valor_cirurgiao is distinct from 1029.6;
update public.unimed_tuss_codigos set valor_cirurgiao = 1310.4, updated_at = now() where codigo = '40813789' and valor_cirurgiao is distinct from 1310.4;
update public.unimed_tuss_codigos set valor_cirurgiao = 1404.0, updated_at = now() where codigo = '40813800' and valor_cirurgiao is distinct from 1404.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1404.0, updated_at = now() where codigo = '40813819' and valor_cirurgiao is distinct from 1404.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 766.58, updated_at = now() where codigo = '40813851' and valor_cirurgiao is distinct from 766.58;
update public.unimed_tuss_codigos set valor_cirurgiao = 766.58, updated_at = now() where codigo = '40813860' and valor_cirurgiao is distinct from 766.58;
update public.unimed_tuss_codigos set valor_cirurgiao = 748.8, updated_at = now() where codigo = '40813878' and valor_cirurgiao is distinct from 748.8;
update public.unimed_tuss_codigos set valor_cirurgiao = 2808.0, updated_at = now() where codigo = '40813908' and valor_cirurgiao is distinct from 2808.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 2340.0, updated_at = now() where codigo = '40813916' and valor_cirurgiao is distinct from 2340.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 2340.0, updated_at = now() where codigo = '40813983' and valor_cirurgiao is distinct from 2340.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1872.0, updated_at = now() where codigo = '40814017' and valor_cirurgiao is distinct from 1872.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1170.0, updated_at = now() where codigo = '40814068' and valor_cirurgiao is distinct from 1170.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1170.0, updated_at = now() where codigo = '40814076' and valor_cirurgiao is distinct from 1170.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 468.0, updated_at = now() where codigo = '40814149' and valor_cirurgiao is distinct from 468.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 702.0, updated_at = now() where codigo = '40814165' and valor_cirurgiao is distinct from 702.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 1310.4, updated_at = now() where codigo = '40814190' and valor_cirurgiao is distinct from 1310.4;
update public.unimed_tuss_codigos set valor_cirurgiao = 2808.0, updated_at = now() where codigo = '40814211' and valor_cirurgiao is distinct from 2808.0;
update public.unimed_tuss_codigos set valor_cirurgiao = 131.04, updated_at = now() where codigo = '2210101136' and valor_cirurgiao is distinct from 131.04;
