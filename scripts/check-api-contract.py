#!/usr/bin/env python3
"""Fail when the HUB requests a path the Integration Core does not serve.

The HUB is a consumer of the normalized API and the Integration Core is its
provider, and the two are versioned independently. Nothing connected them: the
HUB's tests answer every request from a fake, so a path renamed or removed in
the platform leaves this repository green and the failure waits for a browser.

A fake that answers whatever it is asked is the right tool for testing the
HUB's own behaviour and the wrong one for deciding whether the platform serves
the path — it will answer a request for an endpoint that has never existed.
This compares the paths the HUB asks for against the paths the specification
declares, which is the only place the provider's surface is written down.

Test files are excluded on purpose: they name paths the platform does not serve
in order to exercise error handling, and a test naming a deliberately
nonexistent path is not drift.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
# Matches the layout documented in CLAUDE.md: the repositories sit side by side.
SPEC = ROOT.parent / "bsystem-integration-core" / "docs" / "openapi.yaml"
SOURCE = ROOT / "src"

# Both the quoted form and the template-literal form, because an identifier
# interpolated into a path is exactly the case most likely to be renamed.
QUOTED = re.compile(r'"(/api/(?:service/)?v1/[^"]*)"')
TEMPLATE = re.compile(r"`(/api/(?:service/)?v1/[^`]*)`")
INTERPOLATION = re.compile(r"\$\{[^}]*\}")


def requested() -> dict[str, list[str]]:
    """Every platform path the HUB's production code asks for, and where."""
    found: dict[str, list[str]] = {}
    for source in sorted(SOURCE.rglob("*")):
        if source.suffix not in {".ts", ".tsx"}:
            continue
        if ".test." in source.name or source.parent.name == "test":
            continue
        for number, line in enumerate(source.read_text(encoding="utf-8").splitlines(), 1):
            for raw in QUOTED.findall(line) + TEMPLATE.findall(line):
                # A query string is not part of the path the platform routes on.
                path = raw.split("?", 1)[0]
                path = INTERPOLATION.sub("{}", path).rstrip("/")
                found.setdefault(path, []).append(f"{source.relative_to(ROOT)}:{number}")
    return found


def served() -> set[str]:
    spec = yaml.safe_load(SPEC.read_text(encoding="utf-8")) or {}
    return {re.sub(r"\{[^}]+\}", "{}", path) for path in (spec.get("paths") or {})}


def main() -> int:
    if not SPEC.is_file():
        print(
            "the Integration Core is not checked out beside this repository, so "
            "the requested paths were not compared against its OpenAPI spec",
            file=sys.stderr,
        )
        # This is a cross-repository gate. Passing because the provider is
        # absent would make the gate disappear exactly when CI is misconfigured,
        # which is the failure it exists to prevent.
        return 1

    paths = requested()
    if not paths:
        print("the HUB requests no platform path; the check proves nothing", file=sys.stderr)
        return 1

    available = served()
    if len(available) < 2:
        print(f"the specification lists {len(available)} path(s); the check proves nothing", file=sys.stderr)
        return 1

    problems: list[str] = []
    for path, where in sorted(paths.items()):
        # A literal identifier written into a path stands for a placeholder.
        candidates = {path, re.sub(r"/[^/]+$", "/{}", path)}
        # `/api/v1/notifications/{}/read` already matches; this covers a
        # concrete id in the middle of a path.
        candidates.add(re.sub(r"/[A-Za-z]+-?\d[A-Za-z0-9-]*(?=/|$)", "/{}", path))
        if candidates & available:
            continue
        problems.append(f"{', '.join(where)}: requests {path}, which the platform does not serve")

    if problems:
        print("the HUB requests paths the Integration Core does not serve:\n")
        for problem in problems:
            print(f"  {problem}")
        return 1

    print(f"checked {len(paths)} requested path(s) against {len(available)} specified path(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
