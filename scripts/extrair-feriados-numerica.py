#!/usr/bin/env python3
"""
Extrai a ESCALA DE FERIADOS (PDF "FERIADOS <ano>") e grava em `src/data/escalaNumerica.json`
na chave `feriados`: uma FILA ÚNICA por feriado (todos os hospitais), na ordem impressa —
manhã de cima para baixo, tarde invertida (dono 03/09/2026).

Uso: .local/venv-pdf/bin/python scripts/extrair-feriados-numerica.py <feriados.pdf> <ano> [--json src/data/escalaNumerica.json]
"""
import sys, json, re, datetime, collections
from pathlib import Path
try:
    import pdfplumber
except ImportError:
    sys.exit('pdfplumber ausente: python3 -m venv .local/venv-pdf && .local/venv-pdf/bin/pip install pdfplumber')

DATA_RE = re.compile(r'^\d{2}/\d{2}$')

def extrair(pdf_path, ano):
    page = pdfplumber.open(pdf_path).pages[0]
    ws = page.extract_words(extra_attrs=['size'])
    datas = [w for w in ws if DATA_RE.match(w['text'])]
    if not datas: sys.exit('nenhuma data dd/mm encontrada no cabeçalho')
    top_cab = round(datas[0]['top'])
    cab = sorted([w for w in ws if abs(w['top'] - top_cab) < 2], key=lambda w: w['x0'])
    # cada cabeçalho = tokens até a data (inclusive)
    feriados, atual = [], []
    for w in cab:
        atual.append(w)
        if DATA_RE.match(w['text']):
            nome = ' '.join(t['text'] for t in atual[:-1])
            d, m = w['text'].split('/')
            feriados.append({'nome': nome, 'data': datetime.date(ano, int(m), int(d)).isoformat(), 'x0': atual[0]['x0']})
            atual = []
    # nomes: linhas abaixo do cabeçalho, coluna pela banda de x
    bandas = [(f['x0'] - 4, (feriados[i + 1]['x0'] - 4) if i + 1 < len(feriados) else page.width) for i, f in enumerate(feriados)]
    linhas = collections.defaultdict(list)
    for w in ws:
        if w['top'] > top_cab + 4: linhas[round(w['top'])].append(w)
    listas = [[] for _ in feriados]
    for t in sorted(linhas):
        por_col = collections.defaultdict(list)
        for w in sorted(linhas[t], key=lambda x: x['x0']):
            i = next((k for k, (a, b) in enumerate(bandas) if a <= w['x0'] < b), None)
            if i is not None: por_col[i].append(w['text'])
        for i, toks in por_col.items(): listas[i].append(' '.join(toks))
    out = {}
    for f, lista in zip(feriados, listas):
        out[f['data']] = {'nome': f['nome'], 'lista': lista}
    return out

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    alvo = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else 'src/data/escalaNumerica.json'
    if len(args) < 2: sys.exit(__doc__)
    pdf_path, ano = args[0], int(args[1])
    feriados = extrair(pdf_path, ano)
    p = Path(alvo)
    doc = json.loads(p.read_text())
    doc['feriados'] = {'fonte': Path(pdf_path).name, 'regra': 'fila única (todos os hospitais); manhã de cima para baixo, tarde invertida', 'dias': dict(sorted(feriados.items()))}
    # reescreve com o mesmo serializador do extrator principal
    sys.path.insert(0, str(Path(__file__).parent))
    from importlib import import_module
    ser = import_module('extrair-escala-numerica'.replace('-', '_')) if False else None
    p.write_text(serializar(doc))
    print(f'feriados: {len(feriados)} · ' + ' · '.join(f"{v['nome']} {k[5:]} ({len(v['lista'])})" for k, v in sorted(feriados.items())))
    print('→', alvo)

def serializar(doc):
    j = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    linhas = ['{']
    for k, v in doc.items():
        if k in ('dias', 'legenda', 'louise', 'feriados'): continue
        linhas.append(f' {j(k)}:{j(v)},')
    linhas.append(' "louise":{')
    linhas.append(f'  "excecao":{j(doc["louise"]["excecao"])},')
    linhas.append(f'  "vigencia":{j(doc["louise"]["vigencia"])},')
    linhas.append('  "dias":{')
    itens = list(doc['louise']['dias'].items())
    for i, (k, v) in enumerate(itens): linhas.append(f'   {j(k)}:{j(v)}{"," if i < len(itens) - 1 else ""}')
    linhas.append('  }'); linhas.append(' },')
    if 'feriados' in doc:
        linhas.append(' "feriados":{')
        linhas.append(f'  "fonte":{j(doc["feriados"]["fonte"])},')
        linhas.append(f'  "regra":{j(doc["feriados"]["regra"])},')
        linhas.append('  "dias":{')
        itens = list(doc['feriados']['dias'].items())
        for i, (k, v) in enumerate(itens): linhas.append(f'   {j(k)}:{j(v)}{"," if i < len(itens) - 1 else ""}')
        linhas.append('  }'); linhas.append(' },')
    linhas.append(' "legenda":{')
    itens = list(doc['legenda'].items())
    for i, (k, v) in enumerate(itens): linhas.append(f'  {j(k)}:{j(v)}{"," if i < len(itens) - 1 else ""}')
    linhas.append(' },')
    linhas.append(' "dias":{')
    itens = list(doc['dias'].items())
    for i, (k, v) in enumerate(itens): linhas.append(f'  {j(k)}:{j(v)}{"," if i < len(itens) - 1 else ""}')
    linhas.append(' }'); linhas.append('}')
    return '\n'.join(linhas) + '\n'

if __name__ == '__main__':
    main()
