#!/usr/bin/env python3
"""
Extrai a ESCALA NUMÉRICA (PDF colorido do grupo) para `src/data/escalaNumerica.json`.

A cor é dado: cada número da coluna do dia pertence ao hospital cuja letra no
cabeçalho tem a MESMA cor (vermelho/preto alternam entre HRO e Unimed dia a dia;
azul = Materno; verde = consultório; cinza = feriado, coluna sem validade). A
extração por texto puro perde isso — daí pdfplumber com `non_stroking_color`.

Uso:
  .local/venv-pdf/bin/python scripts/extrair-escala-numerica.py <arquivo.pdf> [ano] [--out src/data/escalaNumerica.json]

Depende de `pdfplumber` (venv local em .local/venv-pdf, fora do git). O PDF fica
em .local/ (gitignored) — o JSON é o que o app e a skill consomem.
"""
import sys, json, re, datetime, collections
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    sys.exit("pdfplumber ausente: python3 -m venv .local/venv-pdf && .local/venv-pdf/bin/pip install pdfplumber")

COR = {
    (0.0,): 'preto',
    (1.0, 0.0, 0.0): 'vermelho',
    (0.0, 0.69, 0.941): 'azul',
    (0.0, 0.69, 0.314): 'verde',
    (0.502,): 'cinza',
    (0.651,): 'cinza',   # feriados de novembro vêm num cinza mais claro
}
HOSP = {'R': 'hro', 'U': 'unimed', 'M': 'materno'}
DATA_RE = re.compile(r'^\d{2}/\d{2}$')
NUM_RE = re.compile(r'^\d{2}$')
ORD_RE = re.compile(r'^(\d)[ºo°]?$')

def cor_de(w):
    c = w.get('non_stroking_color')
    if isinstance(c, list): c = tuple(c)
    if c in COR: return COR[c]
    # tolerância a arredondamento
    for k, v in COR.items():
        if len(k) == len(c) and all(abs(a - b) < 0.02 for a, b in zip(k, c)): return v
    return f'desconhecida{c}'

def palavras(page):
    ws = page.extract_words(extra_attrs=['non_stroking_color', 'size'], keep_blank_chars=False)
    for w in ws:
        w['cor'] = cor_de(w)
        w['xc'] = (w['x0'] + w['x1']) / 2
    return ws

def to_iso(ddmm, ano):
    d, m = ddmm.split('/')
    return datetime.date(ano, int(m), int(d)).isoformat()

def extrair(pdf_path, ano):
    pdf = pdfplumber.open(pdf_path)
    dias = {}
    legenda = {}
    louise = {}
    avisos = []
    for pi, page in enumerate(pdf.pages):
        ws = palavras(page)
        # ---- cabeçalhos de semana: "dd/mm a dd/mm" (preto, tamanho 6.5) fora da tabela da Louise
        titulo_louise = next((w for w in ws if w['text'].startswith('ESCALA') and 'LOUISE' in ' '.join(x['text'] for x in ws if abs(x['top'] - w['top']) < 2)), None)
        y_louise = titulo_louise['top'] if titulo_louise else 10**9
        datas = [w for w in ws if DATA_RE.match(w['text'])]
        # pares (inicio, fim) na mesma linha, separados por 'a'
        cabecalhos = []
        for w in datas:
            prox = [x for x in ws if abs(x['top'] - w['top']) < 1.5 and x['x0'] > w['x1'] and x['x0'] - w['x1'] < 30]
            prox.sort(key=lambda x: x['x0'])
            if len(prox) >= 2 and prox[0]['text'] == 'a' and DATA_RE.match(prox[1]['text']):
                cabecalhos.append({'ini': w['text'], 'fim': prox[1]['text'], 'x0': w['x0'], 'x1': prox[1]['x1'], 'top': w['top']})
        # bandas: cabeçalhos agrupados por top
        bandas = collections.defaultdict(list)
        for c in cabecalhos: bandas[round(c['top'])].append(c)
        for top_banda, cabs in sorted(bandas.items()):
            cabs.sort(key=lambda c: c['x0'])
            eh_louise = top_banda > y_louise
            # limites verticais da banda: até o próximo cabeçalho de banda (ou fim da página)
            proximos = [t for t in bandas if t > top_banda]
            y_fim = min(proximos) - 1 if proximos else page.height
            if not eh_louise and y_louise < y_fim: y_fim = y_louise - 1
            for bi, cab in enumerate(cabs):
                x_ini = cab['x0'] - 6
                # o último bloco da banda termina logo depois do cabeçalho — a legenda (números + nomes) mora à direita
                x_fim = (cabs[bi + 1]['x0'] - 6) if bi + 1 < len(cabs) else cab['x1'] + 12
                bloco = [w for w in ws if x_ini <= w['xc'] < x_fim and cab['top'] < w['top'] < y_fim]
                d0 = datetime.date.fromisoformat(to_iso(cab['ini'], ano))
                datas_semana = [(d0 + datetime.timedelta(days=i)).isoformat() for i in range(5)]
                if eh_louise:
                    letras = [w for w in bloco if w['text'] in ('U', 'R', 'M')]
                    # "1°" às vezes sai como "1" (vermelho) + "°" (preto): o dígito manda
                    ords = [w for w in bloco if re.match(r'^\d[ºo°]?$', w['text'])]
                    letras.sort(key=lambda w: w['x0']); ords.sort(key=lambda w: w['x0'])
                    if len(letras) != 5 or len(ords) != 5:
                        avisos.append(f'Louise {cab["ini"]}: {len(letras)} letras / {len(ords)} ordinais')
                    for i, d in enumerate(datas_semana):
                        if i < len(letras) and i < len(ords):
                            # letra E ordinal em cinza = coluna sem validade (feriado); só o ordinal em
                            # cinza, com letra colorida, é ambíguo no documento → vira pendência, nunca dedução
                            louise[d] = {'hospital': HOSP[letras[i]['text']], 'posicao': int(ORD_RE.match(ords[i]['text']).group(1)),
                                         'cinza': letras[i]['cor'] == 'cinza' and ords[i]['cor'] == 'cinza',
                                         'ordinalCinza': ords[i]['cor'] == 'cinza' and letras[i]['cor'] != 'cinza'}
                    continue
                # cabeçalho de hospitais: linha vermelha e linha preta com 5 letras cada
                letras = [w for w in bloco if w['text'] in ('U', 'R')]
                por_linha = collections.defaultdict(list)
                for w in letras: por_linha[round(w['top'])].append(w)
                linhas_letras = [sorted(v, key=lambda w: w['x0']) for _, v in sorted(por_linha.items())][:2]
                if len(linhas_letras) != 2 or any(len(l) != 5 for l in linhas_letras):
                    avisos.append(f'bloco {cab["ini"]}: cabeçalho de hospitais inesperado')
                    continue
                # centros das 5 colunas = média das posições das letras das 2 linhas
                centros = [(linhas_letras[0][i]['xc'] + linhas_letras[1][i]['xc']) / 2 for i in range(5)]
                nums = [w for w in bloco if NUM_RE.match(w['text']) and w['top'] > linhas_letras[1][0]['top'] + 20]
                colunas = [[] for _ in range(5)]
                passo = (centros[4] - centros[0]) / 4  # distância entre colunas (~6,8pt)
                for w in nums:
                    i = min(range(5), key=lambda k: abs(centros[k] - w['xc']))
                    # fora do passo de uma coluna não é da grade (legenda à direita, por exemplo)
                    if abs(centros[i] - w['xc']) <= passo * 0.75:
                        colunas[i].append(w)
                for i, d in enumerate(datas_semana):
                    col = sorted(colunas[i], key=lambda w: w['top'])
                    mapa_cor = {}
                    for l in linhas_letras:
                        mapa_cor[l[i]['cor']] = HOSP[l[i]['text']]
                    mapa_cor['azul'] = 'materno'; mapa_cor['verde'] = 'consultorio'
                    cores = collections.Counter(w['cor'] for w in col)
                    feriado = cores.get('cinza', 0) > 0 and cores.get('cinza', 0) >= len(col) - 1
                    entradas = []
                    for w in col:
                        c = w['cor']
                        entradas.append({'n': w['text'], 'cor': c, 'hospital': None if c == 'cinza' else mapa_cor.get(c, f'?{c}')})
                    dias[d] = {
                        'semana': f"{cab['ini']} a {cab['fim']}",
                        'diaSemana': ['seg', 'ter', 'qua', 'qui', 'sex'][i],
                        'vermelho': mapa_cor.get('vermelho'), 'preto': mapa_cor.get('preto'),
                        'feriado': feriado,
                        'coluna': entradas,
                    }
                    if not feriado and any(e['hospital'] and e['hospital'].startswith('?') for e in entradas):
                        avisos.append(f'{d}: cor sem hospital no cabeçalho')
        # ---- legenda (números + nome, à direita): "01 VICENTE", "05 HUMBERTO / ROBERTA"
        grupos = [w for w in ws if w['text'] == 'GRUPO']
        for g in grupos:
            num_grupo = next((x['text'] for x in ws if abs(x['top'] - g['top']) < 1.5 and x['x0'] > g['x1']), '?')
            # linhas abaixo do título até o próximo GRUPO ou fim
            outros = sorted([o['top'] for o in grupos if o['top'] > g['top']])
            y_fim = outros[0] if outros else page.height
            linhas = collections.defaultdict(list)
            for w in ws:
                if g['top'] < w['top'] < y_fim and w['x0'] >= g['x0'] - 2 and w['x0'] < g['x0'] + 200:
                    linhas[round(w['top'])].append(w)
            for _, l in sorted(linhas.items()):
                l.sort(key=lambda w: w['x0'])
                if NUM_RE.match(l[0]['text']) and len(l) > 1:
                    nome = ' '.join(w['text'] for w in l[1:])
                    legenda[l[0]['text']] = {'nome': nome, 'grupo': int(num_grupo), 'cor': l[0]['cor'],
                                             'compartilhada': '/' in nome}
    return dias, legenda, louise, avisos

def serializar(doc):
    """JSON legível no diff (uma linha por dia / por entrada da legenda) e compacto no bundle."""
    j = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    linhas = ['{']
    simples = {k: v for k, v in doc.items() if k not in ('dias', 'legenda', 'louise')}
    for k, v in simples.items(): linhas.append(f' {j(k)}:{j(v)},')
    linhas.append(' "louise":{')
    linhas.append(f'  "excecao":{j(doc["louise"]["excecao"])},')
    linhas.append(f'  "vigencia":{j(doc["louise"]["vigencia"])},')
    linhas.append('  "dias":{')
    itens = list(doc['louise']['dias'].items())
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

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = 'src/data/escalaNumerica.json'
    if '--out' in sys.argv: out = sys.argv[sys.argv.index('--out') + 1]
    if not args: sys.exit(__doc__)
    pdf_path = args[0]
    ano = int(args[1]) if len(args) > 1 else datetime.date.today().year
    dias, legenda, louise, avisos = extrair(pdf_path, ano)
    datas = sorted(dias)
    doc = {
        'fonte': Path(pdf_path).name,
        'extraidoEm': datetime.date.today().isoformat(),
        'ano': ano,
        'vigencia': {'inicio': datas[0], 'fim': datas[-1]},
        'louise': {'excecao': 'vespertino 13h-19h; inserida na posição indicada da ordem da TARDE do hospital do dia',
                   'vigencia': {'inicio': min(louise) if louise else None, 'fim': max(louise) if louise else None},
                   'dias': dict(sorted(louise.items()))},
        'legenda': dict(sorted(legenda.items())),
        'dias': {d: dias[d] for d in datas},
        'avisos': avisos,
    }
    Path(out).write_text(serializar(doc))
    print(f'dias: {len(datas)} ({datas[0]} → {datas[-1]}) · feriados: {sum(1 for d in datas if dias[d]["feriado"])} · legenda: {len(legenda)} · louise: {len(louise)} dias · avisos: {len(avisos)}')
    for a in avisos: print('  aviso:', a)
    print('→', out)

if __name__ == '__main__':
    main()
