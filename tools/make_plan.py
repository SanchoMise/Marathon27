"""Régénère plan.json à partir de tools/plan.v1.json : sorties longues lissées, départ 35 min, pic 3h00."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
plan = json.loads((root / "tools/plan.v1.json").read_text())
LONG = [35, 38, 42, 32, 46, 51, 56, 43, 62, 68, 75, 56, 83, 92, 101, 76, 111, 122, 135, 101, 148, 163, 180, 120, 85]

def fmt(m):
    return f"{m} min" if m < 60 else f"{m//60}h{m%60:02d}"

for w, minutes in zip(plan["weeks"], LONG):
    for s in w["sessions"]:
        if s["day"] == "dim" and s["type"] == "run_long":
            s["minutes"] = minutes
            s["title"] = f"Sortie longue {fmt(minutes)}"
plan["meta"]["version"] = 2
plan["meta"]["note"] = "Sorties longues : 35 min -> 3h00, +10 % max entre deux vraies sorties"
(root / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1))
print("ok", [s["minutes"] for w in plan["weeks"] for s in w["sessions"] if s["day"] == "dim"][:25])
