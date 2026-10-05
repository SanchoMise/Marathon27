"""Génère les icônes : gros « M27 » en dégradé orange > rose > violet > bleu sur fond marine."""
import sys
from PIL import Image, ImageDraw, ImageFont
FONT = sys.argv[1] if len(sys.argv) > 1 else '/System/Library/Fonts/Supplemental/Impact.ttf'
IDX = int(sys.argv[2]) if len(sys.argv) > 2 else 0
STOPS = [(0, (232, 98, 44)), (.4, (222, 95, 184)), (.7, (125, 82, 195)), (1, (31, 75, 200))]
def grad(t):
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        if t <= b:
            k = (t - a) / (b - a)
            return tuple(round(ca[i] + (cb[i] - ca[i]) * k) for i in range(3))
    return STOPS[-1][1]
def make(n, out, fill=0.86):
    S = n * 4
    bg = Image.new('RGB', (S, S), (7, 20, 63))
    # texte le plus large possible dans la zone sûre
    size = S
    while True:
        f = ImageFont.truetype(FONT, size, index=IDX)
        l, t, r, b = f.getbbox('M27')
        if r - l <= S * fill or size < 10: break
        size -= 4
    mask = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(mask)
    d.text(((S - (r - l)) / 2 - l, (S - (b - t)) / 2 - t), 'M27', font=f, fill=255)
    g = Image.new('RGB', (S, S))
    gd = ImageDraw.Draw(g)
    x0, x1 = (S - (r - l)) / 2, (S + (r - l)) / 2
    for x in range(S):
        gd.line([(x, 0), (x, S)], fill=grad(min(1, max(0, (x - x0) / (x1 - x0)))))
    bg.paste(g, mask=mask)
    bg.resize((n, n), Image.LANCZOS).save(out)
make(512, 'icons/icon-512.png'); make(192, 'icons/icon-192.png'); make(180, 'icons/apple-touch-icon.png')
