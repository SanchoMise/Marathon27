"""Génère le récap d'une page (A4 portrait) du plan, à imprimer en PDF avec Chrome :
   python3 tools/make_pdf_html.py /tmp/plan.html
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-pdf-header-footer --print-to-pdf=Plan-marathon-2027.pdf file:///tmp/plan.html
"""
import json, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
plan = json.load(open(root / 'plan.json'))
mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
def d(s): y, m, j = map(int, s.split('-')); return f"{j} {mois[m-1]}"
def short(s):
    t = s['title']
    if s['type'] == 'rest': return 'Repos'
    if s['type'] == 'race': return '<b>MARATHON</b> · 4 avr.'
    if s['day'] == 'lun': return t
    if s['day'] == 'dim': return t.replace('Sortie longue ', '')
    t = re.sub(r' soutenu \(≈ (\d+) min avec échauffement\)', r' soutenu (≈ \1 min)', t)
    return t.replace(' min facile', ' min')
rows, prev = [], None
for w in plan['weeks']:
    ss = {s['day']: s for s in w['sessions']}
    if w['phase'] != prev:
        rows.append(f"<tr class='phr'><td colspan='6'>{w['phase']}</td></tr>"); prev = w['phase']
    cls = 'all' if w['allegee'] else ('peak' if w['n'] == 23 else '')
    tag = ' <i>allégée</i>' if w['allegee'] else (' <i>pic</i>' if w['n'] == 23 else '')
    rows.append(f"<tr class='{cls}'><td class='n'>{w['n']}</td><td class='dt'>{d(w['start'])}</td><td>{short(ss['lun'])}</td><td>{short(ss['mer'])}</td><td>{short(ss['ven'])}</td><td class='lg'>{short(ss['dim'])}{tag}</td></tr>")
html = f'''<!doctype html><html lang="fr"><meta charset="utf-8"><title>Plan marathon 2027</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap">
<style>
@page {{ size: A4 portrait; margin: 0 }}
* {{ box-sizing: border-box }}
html, body {{ margin: 0 }}
body {{ width: 210mm; height: 297mm; padding: 10mm 12mm 8mm; font-family: 'Archivo', -apple-system, Helvetica, Arial, sans-serif; color: #0A1F5C; background: #fff; overflow: hidden }}
.bar {{ height: 2.4mm; background: linear-gradient(90deg, #E8622C, #DE5FB8 38%, #7D52C3 68%, #1F4BC8); border-radius: 2mm; margin-bottom: 4mm }}
h1 {{ margin: 0; font-size: 21pt; font-weight: 800; font-stretch: 80%; letter-spacing: -.02em; line-height: 1 }}
.sub {{ margin: 1.5mm 0 4mm; color: #46527F; font-size: 9pt; font-weight: 600 }}
table {{ border-collapse: collapse; width: 100%; table-layout: fixed }}
th {{ text-align: left; font-size: 6.6pt; text-transform: uppercase; letter-spacing: .03em; color: #46527F; padding: 0 1.5mm 1mm; border-bottom: .4mm solid #0A1F5C; vertical-align: bottom }}
td {{ padding: 1.15mm 1.5mm; border-bottom: .15mm solid #d8dbe6; white-space: nowrap; overflow: hidden; font-size: 8.4pt; line-height: 1.2 }}
td.n {{ font-weight: 800; font-size: 9.2pt }}
td.dt {{ color: #46527F }}
td.lg {{ font-weight: 800 }}
tr.phr td {{ background: #0A1F5C; color: #fff; font-size: 6.4pt; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; padding: .55mm 1.5mm; border: 0 }}
tr.all td {{ background: #FCE9DD }}
tr.peak td {{ background: #EDE6FA }}
td i {{ font-style: normal; font-size: 6pt; font-weight: 800; background: #F5A36C; color: #0A1F5C; border-radius: 2mm; padding: .1mm 1.2mm; margin-left: 1.2mm }}
.box {{ margin-top: 4.5mm; border-left: 1.4mm solid #F2692F; padding: .5mm 0 .5mm 3.5mm }}
.box h2 {{ margin: 0 0 1.4mm; font-size: 9.4pt; font-weight: 800 }}
.box ul {{ margin: 0; padding-left: 3.8mm }}
.box li {{ margin: 0 0 1.2mm; font-size: 8.3pt; line-height: 1.35 }}
</style>
<div class="bar"></div>
<h1>Marathon de Paris 2027 · mon plan de prépa</h1>
<p class="sub">26 semaines, du 5 octobre 2026 au 4 avril 2027 · objectif autour de 4h30, sans enjeu · 4 séances par semaine</p>
<table><colgroup><col style="width:10mm"><col style="width:19mm"><col style="width:37mm"><col style="width:52mm"><col style="width:31mm"><col style="width:37mm"></colgroup>
<thead><tr><th>Sem.</th><th>Début</th><th>Lun. · renfo A</th><th>Mer. · course</th><th>Ven. · course + renfo B</th><th>Dim. · sortie longue</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table>
<div class="box"><h2>Principes du plan</h2><ul>
<li><b>Point de départ :</b> reprise après kiné, 30 min maximum et une seule sortie par semaine.</li>
<li><b>Progression :</b> +10 % maximum entre deux vraies sorties longues, une semaine allégée (environ −25 %) toutes les 4 semaines.</li>
<li><b>Allures :</b> tout en facile (6:45 à 7:15 au km, phrases complètes), sauf les blocs soutenus (5:55 à 6:10) et l'allure marathon (≈ 6:25). Sur tapis, pente de 1 %.</li>
<li><b>Sortie longue :</b> 1 min de marche toutes les 10 à 15 min dès qu'on dépasse 1 h. Pic à 3h00 en semaine 23, ramené au niveau de la semaine 22 si un genou a protesté.</li>
<li><b>Renfo A (lundi) :</b> presse à cuisses, curl ischios, montée sur marche basse ou fentes bulgares (une séance sur deux), hip thrust à la machine, mollets, gainage. 2 séries, 3 de la semaine 5 à 22, 90 s de repos entre séries. <b>Renfo B (vendredi, 10 min) :</b> hip thrust à la machine, marche latérale avec élastique, mollets, planche.</li>
<li><b>À éviter :</b> accroupissements profonds, extension de jambe en charge, fentes avec rotation, sauts.</li>
<li><b>Règles :</b> une séance ratée ne se rattrape pas. En cas de gêne ou de douleur, on lève le pied et on n'allonge pas la sortie longue.</li>
</ul></div>
</html>'''
pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'plan.html').write_text(html)
