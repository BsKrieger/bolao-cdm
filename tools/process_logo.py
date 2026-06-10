# -*- coding: utf-8 -*-
"""
Processa a logo do Bolão CDM / Process the CDM pool logo.
- A logo é um disco; recortamos exatamente no círculo (máscara circular
  com borda suavizada por supersampling), removendo TODO o fundo branco
  e quaisquer resíduos nos cantos, preservando o branco das letras internas.
- Recorta para o conteúdo e aplica leve nitidez.
- Exporta PNG com transparência em assets/img/logo-cdm.png.

Uso / Usage:  python tools/process_logo.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

SRC = r"C:\Users\bruno.krieger\Downloads\IMG_2043.jpeg"
OUT = os.path.join("assets", "img", "logo-cdm.png")
SS = 4  # supersampling para borda suave / for a smooth edge

def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)

    img = Image.open(SRC).convert("RGB")
    w, h = img.size
    print("origem / source size:", (w, h))

    # Extensão do disco = bounding box dos pixels NÃO claros (anel dourado,
    # azul, selo). O fundo branco é claro (>238) e fica de fora.
    gray = img.convert("L")
    content = gray.point(lambda p: 255 if p < 238 else 0)
    bbox = content.getbbox()
    left, top, right, bottom = bbox
    cx = (left + right) / 2.0
    cy = (top + bottom) / 2.0
    radius = min(right - left, bottom - top) / 2.0 - 1  # -1px evita franja branca

    # Máscara circular com supersampling / antialiased circular mask.
    mask = Image.new("L", (w * SS, h * SS), 0)
    ImageDraw.Draw(mask).ellipse(
        [(cx - radius) * SS, (cy - radius) * SS,
         (cx + radius) * SS, (cy + radius) * SS],
        fill=255,
    )
    mask = mask.resize((w, h), Image.LANCZOS)

    img = img.convert("RGBA")
    img.putalpha(mask)

    # Recorta para o conteúdo visível / crop to visible content.
    crop = img.getchannel("A").getbbox()
    if crop:
        img = img.crop(crop)

    # Leve nitidez / subtle sharpen.
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=3))

    img.save(OUT)
    print("salvo / saved:", OUT, img.size)

if __name__ == "__main__":
    main()
