---
description: Testa uma calculadora clínica no browser via Playwright MCP — abre, preenche inputs limites, valida resultados
allowed-tools: mcp__playwright, Read, Grep, Bash
argument-hint: "<id-calculadora>"
---

# /test-calc

Testa uma calculadora clínica do ANEST executando inputs **limites + edge cases** num browser real (Playwright MCP) e validando os resultados.

## Argumento
`$ARGUMENTS` deve conter o ID/nome da calculadora (ex: `imc`, `peso-ideal-devine`, `dose-propofol-inducao`). Se vazio, listar calculadoras disponíveis.

## Procedimento

### 1. Localizar a calculadora
- Grep em `src/pages/calculadoras/` por arquivo correspondente a `$ARGUMENTS`
- Ler o arquivo para entender:
  - Inputs (campos, tipos, faixas declaradas)
  - Fórmula usada
  - Unidades
  - Faixas normais/alteradas

### 2. Iniciar dev server (se não estiver rodando)
- Bash: `lsof -i :5173 || npm run dev &` (em background)
- Aguardar até porta 5173 responder

### 3. Abrir calculadora no Playwright
- Navegar para `http://localhost:5173/calculadoras/<id>`
- Capturar screenshot inicial

### 4. Bateria de testes
Para cada input da calculadora, executar:

**Test 1 — Caso normal (clinicamente típico)**
- Adulto saudável: peso 70kg, idade 35, etc.
- Verificar resultado é finito, plausível, dentro de faixa esperada

**Test 2 — Limites declarados**
- Min input declarado e Max input declarado
- Verificar resultado não estoura nem é NaN

**Test 3 — Edge cases**
- Input = 0 (deve rejeitar ou retornar valor seguro)
- Input negativo (deve rejeitar)
- Input vazio (deve mostrar placeholder, não calcular)
- Pediátrico (peso 5kg, idade 1) — fórmula é apropriada?
- Obesidade extrema (peso 200kg) — fórmula faz sentido ou precisa peso ajustado?

**Test 4 — Comparação com fonte**
- Calcular o mesmo input manualmente usando a fórmula da literatura
- Comparar com resultado do app (tolerância 1% para float, exato para inteiros)

### 5. Capturar evidências
- Screenshot de cada teste
- Console errors no browser (Chrome DevTools MCP se disponível)
- Network errors

### 6. Reportar
```
## Calculadora: <nome>

### Test 1 — Caso normal
Input: ...
Esperado: ...
Resultado: ...
Status: ✅ / ❌

### Test 2 — Limites
...

### Test 3 — Edge cases
...

### Test 4 — vs literatura
Fórmula citada: ...
Manual: ...
App: ...
Diff: ...
Status: ✅ / ❌

### Console errors
...

### Veredicto
✅ Aprovada / ⚠️ Issues menores / ❌ Bug crítico (NÃO usar em prod)
```

## Notas
- Se Playwright MCP não estiver conectado, abortar e instruir `claude mcp list`.
- Se uma fórmula tiver suspeita de erro, **NÃO ajustar** — invocar agent `calc-validator` primeiro.
