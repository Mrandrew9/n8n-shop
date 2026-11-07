#!/usr/bin/env python3
"""Validate every n8n workflow in workflows/.

Checks: valid JSON, required node fields, unique node names, every connection
points at a real node, every node is reachable from a trigger, Code nodes are
valid JavaScript, and no secrets are hardcoded (use credentials or $env).
"""

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SECRET_PATTERNS = {
    "Slack token": re.compile(r"xox[abpors]-[0-9A-Za-z-]{10,}"),
    "GitHub token": re.compile(r"gh[pousr]_[0-9A-Za-z]{30,}"),
    "AWS key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "Google API key": re.compile(r"AIza[0-9A-Za-z_-]{35}"),
    "Bearer literal": re.compile(r"Bearer\s+[0-9A-Za-z._-]{20,}"),
}
REQUIRED = ("name", "type", "typeVersion", "position", "parameters")


def check(path: Path) -> list[str]:
    errors: list[str] = []
    raw = path.read_text(encoding="utf-8")
    try:
        wf = json.loads(raw)
    except json.JSONDecodeError as e:
        return [f"invalid JSON: {e}"]

    for label, pattern in SECRET_PATTERNS.items():
        if pattern.search(raw):
            errors.append(f"possible hardcoded secret ({label})")

    nodes = wf.get("nodes", [])
    names = [n.get("name") for n in nodes]
    for n in nodes:
        missing = [k for k in REQUIRED if k not in n]
        if missing:
            errors.append(f"node {n.get('name')!r} missing {missing}")
    dupes = {x for x in names if names.count(x) > 1}
    if dupes:
        errors.append(f"duplicate node names: {sorted(dupes)}")

    graph: dict[str, set[str]] = {name: set() for name in names}
    for src, outputs in wf.get("connections", {}).items():
        if src not in graph:
            errors.append(f"connection from unknown node {src!r}")
            continue
        for branch in outputs.get("main", []):
            for link in branch or []:
                if link["node"] not in graph:
                    errors.append(f"{src!r} connects to unknown node {link['node']!r}")
                else:
                    graph[src].add(link["node"])

    triggers = [n["name"] for n in nodes if re.search(r"(webhook|Trigger)$", n["type"])]
    if not triggers:
        errors.append("no trigger node")
    seen, stack = set(), list(triggers)
    while stack:
        cur = stack.pop()
        if cur not in seen:
            seen.add(cur)
            stack.extend(graph.get(cur, ()))
    orphans = sorted(set(names) - seen)
    if orphans:
        errors.append(f"unreachable nodes: {orphans}")

    for n in nodes:
        code = n.get("parameters", {}).get("jsCode")
        if code is None:
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
            f.write("async function node($input, $) {\n" + code + "\n}\n")
        result = subprocess.run(["node", "--check", f.name], check=False, capture_output=True, text=True)
        Path(f.name).unlink()
        if result.returncode != 0:
            lines = result.stderr.strip().splitlines()
            detail = next((ln for ln in lines if "Error" in ln), lines[-1] if lines else "unknown error")
            errors.append(f"Code node {n['name']!r} has a JS syntax error: {detail}")
    return errors


def main() -> int:
    files = sorted(Path("workflows").rglob("*.json"))
    failed = 0
    for path in files:
        errors = check(path)
        status = "FAIL" if errors else "ok"
        print(f"[{status}] {path}")
        for e in errors:
            print(f"       - {e}")
        failed += bool(errors)
    print(f"\n{len(files) - failed}/{len(files)} workflows valid")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
