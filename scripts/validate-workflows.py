#!/usr/bin/env python3
"""Valida los JSON de workflows: estructura, conexiones, expresiones y sintaxis JS de los Code nodes.
Uso: python3 scripts/validate-workflows.py [directorio]   (requiere Node.js para el chequeo de sintaxis JS)"""
import json, glob, os, re, subprocess, sys, tempfile, shutil

d = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "automation", "n8n", "workflows")
files = sorted(glob.glob(os.path.join(d, "wf-*.json")))
node_bin = shutil.which("node")
errors, warnings = [], []

def strings(o):
    if isinstance(o, str): yield o
    elif isinstance(o, dict):
        for v in o.values(): yield from strings(v)
    elif isinstance(o, list):
        for v in o: yield from strings(v)


for f in files:
    base = os.path.basename(f)
    try:
        wf = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        errors.append(f"{base}: JSON inválido ({e})"); continue
    for k in ("name", "nodes", "connections", "settings"):
        if k not in wf: errors.append(f"{base}: falta '{k}'")
    names = [n["name"] for n in wf["nodes"]]
    ids = [n["id"] for n in wf["nodes"]]
    if len(set(names)) != len(names): errors.append(f"{base}: nombres de nodo duplicados")
    if len(set(ids)) != len(ids): errors.append(f"{base}: ids de nodo duplicados")
    if wf["settings"].get("executionOrder") != "v1": errors.append(f"{base}: executionOrder != v1")
    if wf.get("active"): errors.append(f"{base}: active debe ser false")
    nset = set(names)
    triggers = [n for n in wf["nodes"] if any(t in n["type"] for t in ("Trigger", "webhook"))]
    if not triggers: errors.append(f"{base}: sin trigger")
    targets = set()
    for src, v in wf["connections"].items():
        if src not in nset: errors.append(f"{base}: conexión desde nodo inexistente '{src}'")
        for out in v.get("main", []):
            for c in out:
                targets.add(c["node"])
                if c["node"] not in nset: errors.append(f"{base}: conexión hacia nodo inexistente '{c['node']}'")
    for n in wf["nodes"]:
        if n["name"] not in targets and n not in triggers and n["type"] != "n8n-nodes-base.noOp":
            errors.append(f"{base}: nodo huérfano '{n['name']}'")
        s = json.dumps(n["parameters"])
        for e in strings(n["parameters"]):
            if e.startswith("=") and e.count("{{") != e.count("}}"):
                errors.append(f"{base}/{n['name']}: expresión con llaves desbalanceadas: {e[:80]}")
        for m in re.finditer(r"\$\('([^']+)'\)", s):
            if m.group(1) not in nset: errors.append(f"{base}/{n['name']}: referencia a nodo inexistente '{m.group(1)}'")
        if re.search(r"(?<![\$\w.])json\.(severity|fail|evidence)", json.dumps(n["parameters"].get("options", {})) + n["parameters"].get("query", "")):
            errors.append(f"{base}/{n['name']}: referencia 'json.' sin '$'")
        if re.search(r"(api[_-]?key|secret|password|token)\"?\s*:\s*\"[A-Za-z0-9]{16,}", s, re.I):
            errors.append(f"{base}/{n['name']}: posible secreto hardcodeado")
        if n["type"] == "n8n-nodes-base.code" and node_bin:
            js = n["parameters"]["jsCode"]
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as t:
                t.write("(async () => {\n" + js + "\n})();"); p = t.name
            r = subprocess.run([node_bin, "--check", p], capture_output=True, text=True)
            os.unlink(p)
            if r.returncode: errors.append(f"{base}/{n['name']}: error de sintaxis JS\n{r.stderr.strip()[:400]}")
        if n["type"] == "n8n-nodes-base.splitInBatches":
            warnings.append(f"{base}: usa splitInBatches (requiere loop-back manual)")
    print(f"{'OK ' if not any(e.startswith(base) for e in errors) else 'ERR'} {base}  ({len(wf['nodes'])} nodos)")

for w in warnings: print("WARN", w)
if errors:
    print("\n".join("ERROR " + e for e in errors)); sys.exit(1)
print(f"\n{len(files)} workflows válidos" + ("" if node_bin else " (sin chequeo JS: node no encontrado)"))
