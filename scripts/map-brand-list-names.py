#!/usr/bin/env python3
"""
map-brand-list-names.py
───────────────────────
Scans Share/Brand List/ to extract project names from filename conventions,
then patches the `name` field in every matching Share/Legal Drawings/<PD#>/*
/project-manifest.json.

Usage:
  python3 scripts/map-brand-list-names.py           # dry-run (no writes)
  python3 scripts/map-brand-list-names.py --apply   # actually write files
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path


# ─── Config ───────────────────────────────────────────────────────────────────

SHARE_DIR = Path(__file__).resolve().parent.parent / "Share"
BRAND_LIST_DIR = SHARE_DIR / "Brand List"
LEGAL_DIR = SHARE_DIR / "Legal Drawings"

# Keywords that mark the END of the project name inside a filename stem.
# Matched case-insensitively; everything before the first match is the name.
NAME_STOP_PATTERNS = [
    r"-?brand\s*list",
    r"-?brandlist",
    r"-?ucp\s*wiring\s*list",
    r"-?wiring\s*list",
    r"-?wire\s*list",
    r"\bcover\s*sheet\b",
    r"\bwire\s*bin\b",
    r"\bgreen\s*change\b",
    r"\boutwiref?ref?\b",
    r"\bgroundwiref?ref?\b",
    r"\bfor\s+ref\b",
    r"\bog\b",              # "OG Brandlist for Ref"
    r"\btags\b",            # "Wire Bin Tags"
    r"\brev\.?\s+[0-9a-z]",
    r"\b[0-9]+\.[0-9]+\b", # bare revision like "0.1"
]
STOP_RE = re.compile(
    "|".join(NAME_STOP_PATTERNS),
    re.IGNORECASE,
)

# Files to ignore entirely when hunting for a project name
IGNORE_FILES = {
    "panel branding priority cover sheet",
    "wire bin tags",
}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def extract_project_name(folder_name: str, filename_stem: str) -> str | None:
    """
    Given the Brand List folder name (= PD number) and a file stem (no ext),
    return the embedded project name or None if the file should be skipped.

    Examples
    --------
    folder="J0750"  stem="J0750 YALE SSP-BrandList_A.1 #1" → "YALE SSP"
    folder="4N171_CB" stem="4N171_CB SOU-FLN Brandlist B.1" → "SOU-FLN"
    folder="ANG01"  stem="ANG01 STOCK Brandlist A.6_M.2 #9"  → "STOCK"
    folder="J0401"  stem="J0401CC NOC-A-1 Brandlist 0.1"    → "NOC-A-1"
    """
    stem_lower = filename_stem.strip().lower()

    # Skip utility files whose names START WITH a known ignore prefix
    for ignore in IGNORE_FILES:
        if stem_lower.startswith(ignore):
            return None

    # The file MUST start with the folder name (case-insensitive).
    # Files that don't (e.g. misplaced files, "Copy of …") are skipped.
    pd_prefix_re = re.compile(
        r"^" + re.escape(folder_name) + r"[A-Z0-9]*[\s\-]+",
        re.IGNORECASE,
    )
    if not pd_prefix_re.match(filename_stem):
        return None

    remainder = pd_prefix_re.sub("", filename_stem).strip()
    if not remainder:
        return None

    # Find the first stop keyword to know where the project name ends
    m = STOP_RE.search(remainder)
    if m:
        candidate = remainder[: m.start()].strip(" -_")
    else:
        # No stop keyword — take the full remainder (unusual, but accept it)
        candidate = remainder.strip(" -_")

    # Remove trailing unit/copy markers: "# 1", "#1", "UNIT #2", "copy of"
    candidate = re.sub(r"\s*(UNIT\s+)?#\d+\s*$", "", candidate, flags=re.IGNORECASE).strip()
    candidate = re.sub(r"^Copy\s+of\s+", "", candidate, flags=re.IGNORECASE).strip()

    # Must be at least 2 chars and not just whitespace/punctuation
    if len(candidate) < 2:
        return None

    # Reject if the candidate is itself a bare PD number (e.g. "4M891CB")
    if re.match(r"^[0-9][A-Z0-9_]{3,}\s*$", candidate):
        return None

    # Reject if the candidate is only punctuation / parenthetical noise (e.g. "(LF)")
    if re.match(r"^[\(\)\[\]\-\._\s]+$", candidate):
        return None

    return candidate or None


def pick_best_name(candidates: list[str]) -> str | None:
    """
    Given multiple candidate names extracted from different files in a folder,
    pick the most representative one (longest non-generic candidate wins).
    """
    if not candidates:
        return None
    # Prefer longer names (more informative), deduplicate
    seen: set[str] = set()
    unique = []
    for c in candidates:
        key = c.lower()
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return max(unique, key=len)


def scan_brand_list() -> dict[str, str]:
    """
    Walk Share/Brand List/ and return {pd_number: project_name} for every
    folder where a project name can be confidently extracted.
    """
    mapping: dict[str, str] = {}

    for folder in sorted(BRAND_LIST_DIR.iterdir()):
        if not folder.is_dir():
            continue
        pd = folder.name  # e.g. "J0750", "4N171_CB"

        candidates: list[str] = []
        for f in sorted(folder.iterdir()):
            if f.suffix.lower() not in {".xlsx", ".xls", ".csv"}:
                continue
            name = extract_project_name(pd, f.stem)
            if name:
                candidates.append(name)

        best = pick_best_name(candidates)
        if best:
            mapping[pd] = best

    return mapping


def find_manifests(pd_number: str) -> list[Path]:
    """
    Return all project-manifest.json paths under Legal Drawings/<pd_number>/.
    Handles PD numbers that may differ by case.
    """
    base = LEGAL_DIR / pd_number
    if not base.is_dir():
        # Try case-insensitive fallback
        for d in LEGAL_DIR.iterdir():
            if d.name.upper() == pd_number.upper():
                base = d
                break
        else:
            return []
    return list(base.rglob("project-manifest.json"))


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to disk (default is dry-run)",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite even if the manifest already has a non-placeholder name",
    )
    args = parser.parse_args()

    dry_run = not args.apply

    print(f"{'DRY RUN — ' if dry_run else ''}Scanning Brand List…\n")

    mapping = scan_brand_list()

    if not mapping:
        print("No project names found. Check BRAND_LIST_DIR path.")
        sys.exit(1)

    print(f"Found {len(mapping)} project name(s) in Brand List:\n")
    for pd, name in sorted(mapping.items()):
        print(f"  {pd:<14}  →  {name}")
    print()

    updated = 0
    skipped = 0
    not_found = 0

    print("Matching against Legal Drawings manifests…\n")

    for pd, project_name in sorted(mapping.items()):
        manifests = find_manifests(pd)

        if not manifests:
            print(f"  ⚠  {pd}: no Legal Drawings folder found")
            not_found += 1
            continue

        for manifest_path in manifests:
            try:
                with open(manifest_path, encoding="utf-8") as fh:
                    data = json.load(fh)
            except (json.JSONDecodeError, OSError) as exc:
                print(f"  ✗  {manifest_path}: read error — {exc}")
                continue

            current_name: str = data.get("name", "")
            is_placeholder = (not current_name) or (current_name == pd)

            if not is_placeholder and not args.overwrite:
                print(f"  –  {manifest_path.relative_to(SHARE_DIR)} — already named \"{current_name}\" (skip)")
                skipped += 1
                continue

            action = "WOULD UPDATE" if dry_run else "UPDATED"
            old = f'"{current_name}"' if current_name else "(empty)"
            print(f"  ✓  {action}: {manifest_path.relative_to(SHARE_DIR)}")
            print(f"       {old} → \"{project_name}\"")

            if not dry_run:
                data["name"] = project_name
                with open(manifest_path, "w", encoding="utf-8") as fh:
                    json.dump(data, fh, indent=2, ensure_ascii=False)
                    fh.write("\n")
            updated += 1

    print()
    print("─" * 60)
    print(f"  Mapped:    {updated}")
    print(f"  Skipped:   {skipped} (already named)")
    print(f"  Not found: {not_found} (no Legal Drawings folder)")
    if dry_run:
        print("\n  Run with --apply to write changes.")


if __name__ == "__main__":
    main()
