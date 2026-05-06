"""
Extract structured data from pss.csv

Parses the messy multi-line CSV and extracts:
  - Customer
  - Unit
  - PD No. / WO
  - Line Item Type (SMT info, build type, etc.)
  - Product / Engine Type
  - SN

Outputs a clean CSV: pss_extracted.csv
"""

import csv
import re
import io
import sys
from pathlib import Path

INPUT_FILE = Path(__file__).resolve().parent.parent / "pss.csv"
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "pss_extracted.csv"

# ---------------------------------------------------------------------------
# 1.  Read the raw file, merge multi-line quoted fields into logical rows
# ---------------------------------------------------------------------------

def read_logical_rows(filepath: Path) -> list[tuple[str, str]]:
    """
    Use Python's csv reader to correctly handle multi-line quoted fields,
    then return a list of (col1, col2) tuples — one per logical row.
    """
    text = filepath.read_text(encoding="utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows: list[tuple[str, str]] = []
    for row in reader:
        # Pad to at least 2 columns
        while len(row) < 2:
            row.append("")
        rows.append((row[0].strip(), row[1].strip()))
    return rows


# ---------------------------------------------------------------------------
# 2.  Identify header / separator rows and skip them
# ---------------------------------------------------------------------------

HEADER_PATTERNS = [
    re.compile(r"^SMT\s*$", re.IGNORECASE),
    re.compile(r"^Customer\s*-\s*Unit", re.IGNORECASE),
    re.compile(r"^Power\s+Generation", re.IGNORECASE),
    re.compile(r"^PACKAGING\s+ASSOCIATE", re.IGNORECASE),
    re.compile(r"^Product/", re.IGNORECASE),
    re.compile(r"^Line\s*$", re.IGNORECASE),
]

def is_header_or_empty(col1: str, col2: str) -> bool:
    if not col1 and not col2:
        return True
    if col1 == "," or col2 == ",":
        return True
    for pat in HEADER_PATTERNS:
        if pat.match(col1):
            return True
    return False


# ---------------------------------------------------------------------------
# 3.  Parse the "Customer - Unit  WO" column
# ---------------------------------------------------------------------------

# Matches patterns like:
#   PROP-72 - 1 2-4K351          → customer=PROP-72, unit=1, wo=2-4K351
#   S60-83 - 1 2-4L941           → customer=S60-83, unit=1, wo=2-4L941
#   WILBIG - 22 2-4R121          → customer=WILBIG, unit=22, wo=2-4R121
#   STOCK2 - 1 2-ANG02           → customer=STOCK2, unit=1, wo=2-ANG02
#   PROP100 - 1 2-4N301          → customer=PROP100, unit=1, wo=2-4N301
ENTRY_RE = re.compile(
    r"^(?P<customer>[A-Z0-9][\w. /-]*?)\s*-\s*"   # customer name
    r"(?P<unit>\d+)\s+"                              # unit number
    r"(?P<wo>2-[A-Z0-9]+)",                          # WO (starts with "2-")
    re.IGNORECASE,
)

# PD number patterns: PE..., PG..., PC..., PD..., WWK...
PD_RE = re.compile(r"\b(P[ECGD]\d{7,}|WWK\d{5,})\b", re.IGNORECASE)

# Known product families
PRODUCT_RE = re.compile(
    r"(TITAN\s*\d+\w*|TAUR(?:US)?\s*\d+\w*|CENTAUR\s*\d+|TAURUS\s*\d+|PGM\s*\d+)",
    re.IGNORECASE,
)

# Serial number (Solo XXXXL / XXXXT / bare)
SN_RE = re.compile(r"Solo\s*(\d+[A-Z]?)", re.IGNORECASE)


def parse_entry(col1: str, col2: str) -> dict | None:
    """
    Try to parse a data row into structured fields.
    Returns None if the row doesn't look like a valid entry.
    """
    # Flatten newlines inside each column to spaces for regex matching
    c1 = " ".join(col1.replace("\r", "").split("\n"))
    c2 = " ".join(col2.replace("\r", "").split("\n"))

    m = ENTRY_RE.match(c1)
    if not m:
        return None

    customer = m.group("customer").strip()
    unit = m.group("unit").strip()
    wo = m.group("wo").strip()

    # Remainder of col1 after the WO (may contain PD, SMT type, notes)
    remainder = c1[m.end():].strip()

    # --- PD number ---
    pd_match = PD_RE.search(remainder)
    pd_no = pd_match.group(1) if pd_match else ""

    # --- Line Item Type (SMT / build specs after the WO & PD) ---
    line_item_parts = remainder
    # Remove PD number from the remainder
    if pd_no:
        line_item_parts = line_item_parts.replace(pd_no, "").strip()
    # Clean up leading/trailing commas & whitespace
    line_item_parts = re.sub(r"^[\s,]+|[\s,]+$", "", line_item_parts)
    line_item_type = line_item_parts if line_item_parts else ""

    # --- Product / Engine Type ---
    prod_match = PRODUCT_RE.search(c2)
    product_type = prod_match.group(1).strip() if prod_match else c2.split()[0] if c2 else ""

    # --- SN ---
    sn_match = SN_RE.search(c2)
    sn = f"Solo {sn_match.group(1)}" if sn_match else ""

    return {
        "Customer": customer,
        "Unit": unit,
        "WO": wo,
        "PD_No": pd_no,
        "Line_Item_Type": line_item_type,
        "Product_Engine_Type": product_type,
        "SN": sn,
    }


# ---------------------------------------------------------------------------
# 4.  Main
# ---------------------------------------------------------------------------

def main():
    rows = read_logical_rows(INPUT_FILE)
    entries: list[dict] = []

    for col1, col2 in rows:
        if is_header_or_empty(col1, col2):
            continue
        parsed = parse_entry(col1, col2)
        if parsed:
            entries.append(parsed)

    # De-duplicate (same customer+unit+wo)
    seen = set()
    unique: list[dict] = []
    for e in entries:
        key = (e["Customer"], e["Unit"], e["WO"])
        if key not in seen:
            seen.add(key)
            unique.append(e)

    # Write output
    fieldnames = [
        "Customer",
        "Unit",
        "WO",
        "PD_No",
        "Line_Item_Type",
        "Product_Engine_Type",
        "SN",
    ]
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unique)

    print(f"Extracted {len(unique)} entries → {OUTPUT_FILE.name}")

    # Print summary: PD → Product Type mapping
    print("\n--- PD No. → Product / Engine Type ---")
    pd_product_map: dict[str, set[str]] = {}
    for e in unique:
        if e["PD_No"]:
            pd_product_map.setdefault(e["PD_No"], set()).add(e["Product_Engine_Type"])

    for pd, products in sorted(pd_product_map.items()):
        print(f"  {pd} → {', '.join(sorted(products))}")

    # Print summary: Product Type counts
    print("\n--- Product Type Distribution ---")
    product_counts: dict[str, int] = {}
    for e in unique:
        pt = e["Product_Engine_Type"] or "(unknown)"
        product_counts[pt] = product_counts.get(pt, 0) + 1
    for pt, cnt in sorted(product_counts.items(), key=lambda x: -x[1]):
        print(f"  {pt}: {cnt}")

    # Preview first 20 rows
    print("\n--- Preview (first 20 rows) ---")
    print(f"{'Customer':<15} {'Unit':<5} {'WO':<12} {'PD_No':<14} {'Line_Item_Type':<40} {'Product_Engine_Type':<18} {'SN'}")
    print("-" * 130)
    for e in unique[:20]:
        print(
            f"{e['Customer']:<15} {e['Unit']:<5} {e['WO']:<12} {e['PD_No']:<14} "
            f"{e['Line_Item_Type'][:40]:<40} {e['Product_Engine_Type']:<18} {e['SN']}"
        )


if __name__ == "__main__":
    main()
