---
name: sobreaviso
description: Importar docx mensal da escala de sobreaviso materno (1 funcionária por dia, 19h→07h) e atualizar `src/data/sobreavisoMaterno2026.js` automaticamente. Card "Sobreaviso Materno" da Home e página "Consultar Sobreaviso" passam a refletir a nova escala com rollover das 7h.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
user-invocable: true
disable-model-invocation: true
---

# Importar Sobreaviso Materno — Novo Mês

## Quando Usar
- Usuário colocou arquivo `Colaboradores/Sobreaviso materno <ANO>.<MÊS>.docx` na pasta.
- Precisa adicionar ou atualizar entries em `src/data/sobreavisoMaterno<ANO>.js` para que o app exiba a escala automática.

## Fluxo resumido
1. Ler o(s) docx do(s) mês(es) fornecido(s).
2. Extrair tuplas `(dataKey, funcionariaId)` normalizando nomes.
3. Atualizar `src/data/sobreavisoMaterno<ANO>.js` inserindo/substituindo as entradas de `SOBREAVISO_MATERNO_<ANO>`.
4. Smoke test + build + commit + push + deploy.

---

## 1. Formato esperado do docx

Arquivo único por mês: `Colaboradores/Sobreaviso materno <ANO>.<MÊS>.docx` (ex: `Sobreaviso materno 2026.06.docx`).

Contém **uma tabela** com 3 colunas:
```
DATA          | DIA/SEMANA   | FUNCIONARIA
01/06/2026    | SEGUNDA      | MARTA
02/06/2026    | TERCA        | RENATA
...
```

- Nomes em CAIXA ALTA (normalizar para comparar).
- 30 ou 31 linhas (ou 28/29 em fev).
- Header descartável (primeira linha).
- Pode haver typos em `DIA/SEMANA` (ex: `QURTA` em vez de `QUARTA`) — ignore a coluna DIA/SEMANA e calcule internamente se precisar.
- Coluna FUNCIONARIA é o dado-chave.

## 2. Funcionárias cadastradas

IDs estáveis em `FUNCIONARIAS_SOBREAVISO` (em `src/data/sobreavisoMaterno2026.js`):
```js
{ id: 'marta',    nome: 'Marta',    email: 'martaa0804@gmail.com' }
{ id: 'renata',   nome: 'Renata',   email: 'renatagracielalucca@gmail.com' }
{ id: 'luciana',  nome: 'Luciana',  email: 'lutona3112@hotmail.com' }
{ id: 'elisete',  nome: 'Elisete',  email: 'elibelinha3@gmail.com' }
{ id: 'saionara', nome: 'Saionara', email: 'saionararebelatto@gmail.com' }
```

Nomes do docx → id do sistema (NAME_TO_ID):
```
MARTA    → marta
RENATA   → renata
LUCIANA  → luciana
ELISETE  → elisete
SAIONARA → saionara
```

Se aparecer **nome fora dessa lista** (ex: nova contratada), parar e pedir ao usuário:
1. Email da nova funcionária.
2. Se terá conta no app (Firebase Auth + Supabase).
3. Criar conta via script tipo `/tmp/create-funcionarias.mjs` e adicionar ao array `FUNCIONARIAS_SOBREAVISO`.

---

## 3. Script Python de extração

Rodar via `python3 <<'EOF' ... EOF` no Bash. Usa `python-docx` (instalar se necessário com `pip3 install python-docx --break-system-packages`).

```python
from docx import Document
import re
from datetime import datetime

FILES = ['Colaboradores/Sobreaviso materno 2026.06.docx']  # ajustar
NAME_TO_ID = {
  'MARTA':'marta', 'RENATA':'renata', 'LUCIANA':'luciana',
  'ELISETE':'elisete', 'SAIONARA':'saionara',
}

entries = []
unknowns = set()
for path in FILES:
  d = Document(path)
  for t in d.tables:
    for row in t.rows[1:]:  # pula header
      cells = [c.text.strip() for c in row.cells]
      if len(cells) < 3: continue
      data_raw, _, nome_raw = cells[0], cells[1], cells[2]
      # Extrair data em qualquer formato (DD/MM/YYYY)
      m = re.search(r'(\d{2})/(\d{2})/(\d{4})', data_raw)
      if not m: continue
      dd, mm, yy = m.groups()
      key = f"{yy}-{mm}-{dd}"
      nome_upper = nome_raw.strip().upper()
      fid = NAME_TO_ID.get(nome_upper)
      if not fid:
        unknowns.add(nome_upper)
        continue
      entries.append((key, fid))

entries.sort()
print(f"Entries extraídas: {len(entries)}")
print(f"Nomes não mapeados: {unknowns}")
for k, v in entries[:5]:
  print(f"  '{k}': '{v}',")
```

### Validações obrigatórias
- **Contagem**: mês 30/31 dias (28/29 para fevereiro). Se fora, parar e reportar.
- **Nomes desconhecidos**: listar antes de aplicar. Não gerar arquivo com IDs faltantes.
- **Colisão**: se alguma data já existe em `SOBREAVISO_MATERNO_2026` com valor diferente, confirmar sobrescrita.

---

## 4. Atualizar o arquivo `src/data/sobreavisoMaterno<ANO>.js`

Ler o arquivo atual, preservar helpers e funcionárias, **adicionar/substituir** as chaves do novo mês no objeto `SOBREAVISO_MATERNO_<ANO>`.

Usar `Edit` apontando o bloco do objeto — não reescrever o arquivo inteiro.

Exemplo de bloco a inserir (abril já existe, adicionar junho):
```js
  // Maio 2026
  '2026-05-31': 'elisete',
  // Junho 2026
  '2026-06-01': 'marta',
  '2026-06-02': 'renata',
  // ...
};
```

Manter ordem cronológica. Testar com vitest depois.

---

## 5. Smoke test + deploy

```bash
cd "/Users/guilherme/Documents/IA/ANEST V2"
npm run test -- --run src/__tests__/data/sobreavisoMaterno2026.test.js
```

Se o teste de "contém N dias" quebrar, atualizar o `expect(...).toHaveLength(N)` no teste para refletir o novo total (abr+mai+junho = 91).

```bash
npm run build
git add src/data/sobreavisoMaterno2026.js src/__tests__/data/sobreavisoMaterno2026.test.js
git commit -m "feat(sobreaviso): importa escala <MÊS>/<ANO> (<N> dias)"
git push origin main
rm -f .firebase/hosting.*.cache
firebase deploy --only hosting:anest-ap
```

---

## 6. O que muda no app

- **Card "Sobreaviso Materno"** na Home e no hub "Escalas Funcionárias" passa a mostrar a funcionária do dia a partir do novo período.
- **Página "Consultar Sobreaviso"** expande `MAX_DATE` automaticamente? **NÃO** — precisa editar `ConsultaSobreavisoPage.jsx` linha `MAX_DATE = new Date('2026-05-31T00:00:00')` para o novo limite do último mês importado.
- **Trocas de sobreaviso**: continuam funcionando. Overrides em `sobreavisoMaternoDiario/{YYYY-MM-DD}` no Firestore não são apagados.
- **Bolinhas azuis** (dia da funcionária logada) e feriados (amarelo) atualizam sozinho no calendário.

---

## 7. Anomalias conhecidas
- docx de abril 2026 tinha typo `QURTA` no dia 29/04 (DIA/SEMANA coluna). Não afeta extração, mas bom estar ciente.

---

## 8. Se esquecer
- Lista completa de skills: `CLAUDE.md` seção "Skills Disponíveis".
- Docx de referência: `Colaboradores/LEIA-ME-PLANTOES.docx`-like (se criar um LEIA-ME para sobreaviso).
