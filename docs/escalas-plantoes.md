# Escalas e Plantões — ANEST

## Integração API Pega Plantão v1.7
- OAuth 2.0, cache 5min
- Service: `src/services/pegaPlantaoApi.js`
- Hook: `src/hooks/usePegaPlantao.js` → `useEscalaDia()`

## Hook useEscalaDia() Returns
- `plantoesManha` / `plantoesTarde` / `plantoes` (combined)
- `plantoesFDS` (deduplicated by sector P1-P11 weekends)
- `ferias` (weekdays only)
- `isWeekend` (Sat 7h → Mon 7h)
- `periodoAtual` ('manha' | 'tarde')
- `expanded`, `toggleExpanded`, `loading`, `error`, `usandoMock`, `refetch`

## Shift Data Structure
```javascript
{ setor: 'P1', hospital: 'Name', data: 'P1 - Diurno', hora: '07:00', bgColor: '#B8E0C8' }
```

## Regra 24h (HORA_CORTE_PLANTAO = 7)
| Momento | isWeekendMode | API Date | Setores | Férias |
|---------|---------------|----------|---------|--------|
| Sáb 00-06:59 | false | Sexta | P1-P4 (Night) | Sim |
| Sáb 07:00+ | true | Sábado | P1-P11 | Não |
| Dom inteiro | true | Sábado | P1-P11 | Não |
| Seg 00-06:59 | true | Sábado | P1-P11 | Não |
| Seg 07:00+ | false | Segunda | P1-P4 (Night) | Sim |
| Ter-Sex | false | Dia atual/anterior | P1-P4 (Night) | Sim |

## Setores
- Dias úteis: P1, P2, P3, P4
- Fim de semana: P1-P11

## Férias
Extraídas do API onde `Setor = "Férias"`.

## Vite Proxy (Dev)
```javascript
'/api/pegaplantao': { target: 'https://pegaplantao.com.br/api', changeOrigin: true }
```

## Páginas
- `HomePage.jsx` — Card Plantões (max 4 items)
- `EscalasPage.jsx` — Escala completa
