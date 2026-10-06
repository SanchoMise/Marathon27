"""Régénère plan.json à partir de tools/plan.v1.json : sorties longues lissées, départ 35 min, pic 3h00."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
plan = json.loads((root / "tools/plan.v1.json").read_text())
LONG = [35, 38, 42, 32, 46, 51, 56, 43, 62, 68, 75, 56, 83, 92, 101, 76, 111, 122, 135, 101, 148, 163, 180, 120, 85]

# Séances faciles de semaine (n° de semaine -> minutes). Les séances soutenues du mercredi (sem. 13 à 23) et le dernier mois ne changent pas.
WED = {**{n: 30 for n in (1, 2, 3)}, 4: 25, **{n: 35 for n in (5, 6, 7)}, 8: 30, **{n: 40 for n in (9, 10, 11)}, 12: 30}
FRI = {**{n: 25 for n in (1, 2, 3)}, 4: 20, 5: 25, **{n: 30 for n in (6, 7)}, 8: 25, **{n: 35 for n in (9, 10, 11)}, 12: 30}

def fmt(m):
    return f"{m} min" if m < 60 else f"{m//60}h{m%60:02d}"

for w, minutes in zip(plan["weeks"], LONG):
    for s in w["sessions"]:
        if s["day"] == "dim" and s["type"] == "run_long":
            s["minutes"] = minutes
            s["title"] = f"Sortie longue {fmt(minutes)}"
for w in plan["weeks"]:
    for s in w["sessions"]:
        table = {"mer": WED, "ven": FRI}.get(s["day"])
        if table and s["type"] == "run_easy" and w["n"] in table:
            s["minutes"] = table[w["n"]]
            s["title"] = f"{table[w['n']]} min facile"

plan["meta"]["version"] = 3
plan["meta"]["note"] = "Sorties longues : 35 min -> 3h00 (+10 % max entre deux vraies sorties). Séances de semaine : plancher 30 min le mercredi, 25 min le vendredi"
(root / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))
print("ok", [s["minutes"] for w in plan["weeks"] for s in w["sessions"] if s["day"] == "dim"][:25])
