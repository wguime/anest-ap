#!/usr/bin/env python3
"""
Mantém organizada a pasta das escalas das funcionárias — o dono pediu (02/10/2026)
que ela seja atualizada A CADA escala recebida, para ser o espelho do que está no app.

Layout:
  Escalas funcinárias/
    Modelo - escala mensal das funcionárias.docx   ← o único modelo para preencher (qualquer mês)
    2026-10 Outubro/
      Escala 2026-10 - recebida.docx               ← o arquivo como chegou, nunca editado
      Escala 2026-10 - publicada.docx              ← o que está no app, regerado a cada publicação

Uso:
  python3 pasta.py recebida "<docx>" 2026-10 [rotulo]   # arquiva o original (rotulo: ex. sobreaviso)
  python3 pasta.py publicada dados.json                  # regera a cópia publicada do mês
  python3 pasta.py modelo                                # (re)gera o modelo único

dados.json = {mes, sobreaviso, hospitais} — a forma do doc escalasFuncionarias/{YYYY-MM}.
"""
import sys, os, json, shutil, hashlib
sys.dont_write_bytecode = True  # sem __pycache__ dentro da skill
from gerar_template import OUT_DIR, PT_MESES, gerar_modelo, gerar_preenchido


def pasta_do_mes(ym):
    mm = int(ym.split('-')[1])
    return os.path.join(OUT_DIR, f"{ym} {PT_MESES[mm].capitalize()}")


def _sha(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def arquivar_recebida(src, ym, rotulo=None):
    """Copia o original para a pasta do mês. Não sobrescreve: o mesmo arquivo
    vira no-op, um arquivo diferente com o mesmo nome ganha (2), (3)…"""
    destino_dir = pasta_do_mes(ym)
    os.makedirs(destino_dir, exist_ok=True)
    base = f"Escala {ym} - recebida" + (f" ({rotulo})" if rotulo else "")
    n = 1
    while True:
        nome = base + (f" ({n})" if n > 1 else "") + ".docx"
        destino = os.path.join(destino_dir, nome)
        if not os.path.exists(destino):
            shutil.copy2(src, destino)
            return destino, True
        if _sha(destino) == _sha(src):
            return destino, False
        n += 1


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ('recebida', 'publicada', 'modelo'):
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == 'modelo':
        print(f"OK modelo: {gerar_modelo()}")
    elif cmd == 'recebida':
        src, ym = sys.argv[2], sys.argv[3]
        rotulo = sys.argv[4] if len(sys.argv) > 4 else None
        destino, copiou = arquivar_recebida(src, ym, rotulo)
        print(f"{'OK recebida' if copiou else 'JÁ ARQUIVADA'}: {destino}")
    else:
        dados = json.load(open(sys.argv[2], encoding='utf-8'))
        ym = dados['mes']
        out = os.path.join(pasta_do_mes(ym), f"Escala {ym} - publicada.docx")
        gerar_preenchido(dados, out)
        print(f"OK publicada: {out}  (sobreaviso {len(dados.get('sobreaviso') or {})} dias, "
              f"hospitais {len(dados.get('hospitais') or {})} dias)")


if __name__ == '__main__':
    main()
