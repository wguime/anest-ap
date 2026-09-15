---
paths:
  - "src/pages/ConsultaPlantoesPage.jsx"
  - "src/pages/ConsultaSobreavisoPage.jsx"
  - "src/pages/Trocas*Page.jsx"
  - "src/pages/AdminTodasTrocas*.jsx"
  - "src/pages/escala-numerica/TrocasFeriado.jsx"
  - "src/pages/escala-numerica/FeriadosPage.jsx"
  - "src/components/residencia/**"
  - "src/components/sobreaviso/**"
  - "src/components/hospitais/**"
  - "src/services/troca*"
  - "src/services/residenciaPlantao*"
  - "src/services/sobreavisoMaternoService.js"
  - "src/hooks/useTroca*"
  - "src/hooks/useOverridesDiario.js"
  - "src/hooks/useHospitaisOverrides.js"
  - "src/hooks/use*ShiftReminders.js"
  - "src/data/plantao2026.js"
  - "src/data/sobreavisoMaterno2026.js"
  - "src/data/hospitaisTecnicas2026.js"
  - "src/lib/trocasFeriado.js"
  - "src/lib/trocaResidenciaValidacao.js"
  - "supabase/functions/schedule-shift-reminders/**"
description: Trocas de plantão (residência, sobreaviso materno, hospitais FDS, feriados) — escala EFETIVA = base + override; espelho Supabase da residência para a edge de lembretes
---

# Trocas de plantão — a escala que vale é a EFETIVA

Quatro módulos partem de uma **base estática** e recebem trocas por cima:

| Módulo | Base | Onde a troca aceita vive | Como ler "de quem é" |
|---|---|---|---|
| Residência | `PLANTOES_2026` (`plantao2026.js`) | Firestore `residenciaPlantaoDiario/{data}` (`residenteOverride`) | `getResidenteEfetivo(data, overrides)` · `getDatasDoResidente(id, overrides)` |
| Sobreaviso materno | `getSobreavisoBase()` | `sobreavisoMaternoDiario/{data}` (`funcionariaOverride`) | `getDatasDaSobreavisista(id, from, overrides)` |
| Hospitais FDS/feriado | `getHospitaisBase()` | `hospitaisDiario/{data}_{hospital}_{turno}` | `getHospitaisEfetivos(date, overrides)` · `getSlotsFuncionariaNaData(id, data, overrides)` |
| Feriados (numérica) | `filaImpressa` do JSON | `trocas_feriado` aplicadas NA LEITURA | `filaEfetiva(dados, data, trocasAceitas)` · `feriadosDaPessoa(..., { trocas })` |

Os overrides vêm de `useOverridesDiario` (residência/sobreaviso) e `useHospitaisOverrides` —
**a coleção INTEIRA, em tempo real**, não só o dia selecionado. Ler a base sozinha é ler a escala
de antes das trocas: em 27/07/2026 um residente trocou o 20 pelo 19 e "Consultar Plantões"
continuou marcando o 20 (o detalhe do dia lia o override; as bolinhas e a lista do mês, não). O
mesmo defeito estava no formulário de troca (destinatário auto-selecionado pela tabela), no serviço
hospitalar (validava pela base e recusava quem tinha RECEBIDO o slot), no sobreaviso e nos feriados.
Corrigido em v5.12.4; `src/__tests__/lib/escalaEfetivaTripwire.test.js` falha para qualquer arquivo
novo que leia a base crua sem estar na allowlist com motivo.

Consequência para formulários: **quem recebeu um dia numa troca pode oferecê-lo de novo; quem o
cedeu, não** — e o serviço revalida pela escala efetiva (o formulário pode ser burlado).

## Lembretes da residência NÃO leem Firestore

O "Plantão amanhã" dos residentes vem da edge `schedule-shift-reminders` (pg_cron 3×/dia), que
consulta a tabela Supabase `residencia_plantao_diario_overrides` e cai na tabela estática sem a
linha. Ela não existiu até a migration `20260914150000` — por isso em 18/07 o aviso do 19/07 foi
para quem já tinha trocado, e em setembro dois residentes receberam aviso do mesmo dia (a edge
avisava o da tabela; o hook `useResidenteShiftReminders`, do admin, avisava o da troca).

- **Toda escrita em `residenciaPlantaoDiario` passa por `espelharOverridesResidencia`**
  (`residenciaPlantaoOverridesMirror.js`): aceite de troca, ajuste manual e volta à base (apaga a
  linha). Best-effort: falha do espelho não desfaz a troca, só avisa no console.
- `updated_by` é o UID real de quem gravou (audit trail, nunca `'system'`).
- Sinal de drift entre Firestore e espelho: dois `Plantão amanhã` do mesmo dia em `notifications`
  (`related_entity_type = 'plantao-residencia'`).
- A base estática da edge (`_data.ts`) é gerada por `src/scripts/generate-edge-function-data.js`;
  nova edição de `PLANTOES_2026` exige regerar e redeployar a edge.

## Ao investigar "a marcação está errada"

Puxar `residenciaPlantaoDiario` (ou a coleção do módulo) e `trocas_*` ANTES de mexer em `src/`:
na foto de 27/07 o Firestore já estava certo — o defeito era só de leitura. E escrever o teste com
a fixture real E a hipótese contrária (sem overrides → base), para a fixture separar as duas.
