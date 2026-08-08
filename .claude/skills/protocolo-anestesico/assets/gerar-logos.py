#!/usr/bin/env python3
"""Gera os SVGs de marca do ANEST a partir do master raster do repositorio.

O ANEST nao tem logo vetorial: o unico master e um PNG 1024x1024 com canal alpha
(`public/logo-anest-original.png`, identico byte a byte em quatro caminhos do
repositorio). Este script vetoriza esse master uma vez, de forma reproduzivel, e
grava as tres variantes usadas nos protocolos.

O logo tem duas camadas de cor que sao separadas antes do trace, para que cada
uma vire um <path> proprio. E isso que torna as variantes negativa e dark um
simples troca-de-atributo `fill`, em vez de uma reinterpretacao da marca.

Rodar da raiz do repositorio:

    python3 .claude/skills/protocolo-anestesico/assets/gerar-logos.py

Dependencias: pillow, numpy, potracer (`pip install pillow numpy potracer`).
"""
import os
import sys

import numpy as np
import potrace
from PIL import Image

MASTER = "public/logo-anest-original.png"

# Limites da tinta com alpha > 8. O getbbox() cru devolve 1024x583 porque o
# master arrasta um halo de alpha 1-8 ate y=935 -- sujeira invisivel que viraria
# area morta no SVG.
BOX = (28, 352, 1024, 630)

# Cores medidas no proprio master (moda dos pixels de miolo, apos erosao de 2px
# para excluir antialiasing). Nao sao os tokens do design system -- ver o campo
# "observacoes" de marca.json.
ESCURO = (0x13, 0x3A, 0x11)  # wordmark "Anest"
CLARO = (0x9C, 0xCB, 0x64)  # linha de ECG

# Supersampling antes do trace. Em 2x o SVG sai com 17 KB e e indistinguivel do
# raster a 400 dpi; 4x triplica o arquivo sem ganho visivel.
SS = 2

VARIANTES = [
    # arquivo, cor do wordmark, cor do ECG
    ("anest-logo.svg", "#133A11", "#9CCB64"),  # fundo claro
    ("anest-logo-branco.svg", "#FFFFFF", "#FFFFFF"),  # negativo, capa verde
    ("anest-logo-dark.svg", "#FFFFFF", "#9CCB64"),  # fundo escuro
]

MOLDE = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
    'role="img" aria-label="ANEST">\n'
    "  <title>ANEST</title>\n"
    '  <path id="wordmark" fill="{cor_wordmark}" fill-rule="evenodd" d="{d_wordmark}"/>\n'
    '  <path id="ecg" fill="{cor_ecg}" fill-rule="evenodd" d="{d_ecg}"/>\n'
    "</svg>\n"
)


def separa_camadas():
    """Divide o master nas duas mascaras de cor, ja supersampleadas."""
    im = Image.open(MASTER).convert("RGBA").crop(BOX)
    largura, altura = im.size
    grande = im.resize((largura * SS, altura * SS), Image.LANCZOS)
    arr = np.asarray(grande).astype(np.int32)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

    dist_escuro = (r - ESCURO[0]) ** 2 + (g - ESCURO[1]) ** 2 + (b - ESCURO[2]) ** 2
    dist_claro = (r - CLARO[0]) ** 2 + (g - CLARO[1]) ** 2 + (b - CLARO[2]) ** 2

    tinta = a > 110  # descarta halo e antialiasing fraco
    return largura, altura, tinta & (dist_escuro <= dist_claro), tinta & (dist_escuro > dist_claro)


def traca(mascara):
    """Mascara booleana -> atributo `d` de um <path>."""
    # potracer le a imagem como tons de cinza: 0 e tinta, 255 e fundo.
    bitmap = potrace.Bitmap(np.where(mascara, 0, 255).astype(np.uint8))
    caminho = bitmap.trace(turdsize=6, alphamax=1.0, opticurve=True, opttolerance=0.45)

    def pt(p):
        return "%.1f" % (p.x / SS), "%.1f" % (p.y / SS)

    partes = []
    for curva in caminho:
        partes.append("M%s %s" % pt(curva.start_point))
        for seg in curva:
            fx, fy = pt(seg.end_point)
            if seg.is_corner:
                cx, cy = pt(seg.c)
                partes.append("L%s %sL%s %s" % (cx, cy, fx, fy))
            else:
                x1, y1 = pt(seg.c1)
                x2, y2 = pt(seg.c2)
                partes.append("C%s %s %s %s %s %s" % (x1, y1, x2, y2, fx, fy))
        partes.append("Z")
    return "".join(partes)


def main():
    if not os.path.exists(MASTER):
        sys.exit("erro: rode da raiz do repositorio (nao achei %s)" % MASTER)

    destino = os.path.dirname(os.path.abspath(__file__))
    largura, altura, mascara_escura, mascara_clara = separa_camadas()
    d_wordmark = traca(mascara_escura)
    d_ecg = traca(mascara_clara)
    print("viewBox %dx%d" % (largura, altura))

    for arquivo, cor_wordmark, cor_ecg in VARIANTES:
        svg = MOLDE.format(
            w=largura,
            h=altura,
            cor_wordmark=cor_wordmark,
            cor_ecg=cor_ecg,
            d_wordmark=d_wordmark,
            d_ecg=d_ecg,
        )
        caminho = os.path.join(destino, arquivo)
        with open(caminho, "w", encoding="utf-8") as fh:
            fh.write(svg)
        print("  %-24s %6.1f KB" % (arquivo, len(svg) / 1024))


if __name__ == "__main__":
    main()
