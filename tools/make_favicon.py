"""Favicon (onglet du navigateur) : un « M » seul en dégradé sur fond marine, lisible en tout petit.
Produit icons/favicon-{16,32,48,64}.png et favicon.ico."""
import pathlib
from PIL import Image, ImageDraw, ImageFont
root = pathlib.Path(__file__).resolve().parent.parent
FONT = '/System/Library/Fonts/Supplemental/Impact.ttf'
STOPS = [(0, (232, 98, 44)), (.4, (222, 95, 184)), (.7, (125, 82, 195)), (1, (31, 75, 200))]
def grad(t):
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        if t <= b:
            k = (t - a) / (b - a)
            return tuple(round(ca[i] + (cb[i] - ca[i]) * k) for i in range(3))
    return STOPS[-1][1]
def make(n, radius=0.18):
    S = n * 8
    bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(bg).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * radius), fill=(7, 20, 63, 255))
    size = S
    while True:
        f = ImageFont.truetype(FONT, size)
        l, t, r, b = f.getbbox('M')
        if (r - l) <= S * 0.80 and (b - t) <= S * 0.80: break
        size -= 4
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).text(((S - (r - l)) / 2 - l, (S - (b - t)) / 2 - t), 'M', font=f, fill=255)
    g = Image.new('RGBA', (S, S))
    gd = ImageDraw.Draw(g)
    x0, x1 = (S - (r - l)) / 2, (S + (r - l)) / 2
    for x in range(S):
        gd.line([(x, 0), (x, S)], fill=grad(min(1, max(0, (x - x0) / (x1 - x0)))) + (255,))
    bg.paste(g, mask=mask)
    return bg.resize((n, n), Image.LANCZOS)
for n in (16, 32, 48, 64):
    make(n).save(root / f'icons/favicon-{n}.png')
make(64).save(root / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
