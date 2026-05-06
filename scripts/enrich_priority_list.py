"""
Enrich priority-list.json with unit type + average time estimates.

Cross-references:
  - priority-list.json  → each project entry (customer, unit, pd/WO)
  - pss_extracted.csv    → maps WO → Product_Engine_Type + Line_Item_Type
  - unit-type-estimates.ts → maps unit type key → avgTotalHours + operations

Outputs:
  - Share/Schedule/priority-list-enriched.json  (full enriched priority list)
  - prints a summary table to stdout
"""

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PSS_CSV     = ROOT / "pss_extracted.csv"
PL_JSON     = ROOT / "Share" / "Schedule" / "priority-list.json"
ESTIMATES   = ROOT / "lib" / "priority-list" / "unit-type-estimates.ts"
OUTPUT_JSON = ROOT / "Share" / "Schedule" / "priority-list-enriched.json"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Parse unit-type-estimates.ts → dict of { key: { unitType, sampleCount, avgTotalHours, avgPanelCount } }
# ─────────────────────────────────────────────────────────────────────────────

def parse_estimates(filepath: Path) -> dict[str, dict]:
    """Parse the UNIT_TYPE_SUMMARY array from the TS file."""
    text = filepath.read_text(encoding="utf-8")

    # Extract the UNIT_TYPE_SUMMARY array entries
    summary_block = text[text.index("UNIT_TYPE_SUMMARY"):]
    entries: dict[str, dict] = {}

    for m in re.finditer(
        r'\{\s*unitType:\s*"([^"]+)".*?sampleCount:\s*(\d+).*?avgTotalHours:\s*([\d.]+).*?avgPanelCount:\s*([\d.]+)',
        summary_block,
        re.DOTALL,
    ):
        key = m.group(1)
        entries[key] = {
            "unitType": key,
            "sampleCount": int(m.group(2)),
            "avgTotalHours": float(m.group(3)),
            "avgPanelCount": float(m.group(4)),
        }

    # Also parse per-operation details from UNIT_TYPE_ESTIMATES
    est_block = text[:text.index("UNIT_TYPE_SUMMARY")]
    # Extract each unit type's operations
    for m in re.finditer(
        r'"([^"]+)":\s*\{\s*unitType:\s*"[^"]+".*?operations:\s*\[(.*?)\]\s*\}',
        est_block,
        re.DOTALL,
    ):
        key = m.group(1)
        ops_text = m.group(2)
        operations = []
        for op_m in re.finditer(
            r'\{\s*code:\s*"([^"]+)".*?label:\s*"([^"]+)".*?avgHours:\s*([\d.]+).*?avgBup:\s*([\d.]+).*?avgAsm:\s*([\d.]+).*?avgVis:\s*([\d.]+)\s*\}',
            ops_text,
            re.DOTALL,
        ):
            operations.append({
                "code": op_m.group(1),
                "label": op_m.group(2),
                "avgHours": float(op_m.group(3)),
                "avgBup": float(op_m.group(4)),
                "avgAsm": float(op_m.group(5)),
                "avgVis": float(op_m.group(6)),
            })
        if key in entries:
            entries[key]["operations"] = operations
        else:
            entries[key] = {
                "unitType": key,
                "sampleCount": 0,
                "avgTotalHours": 0,
                "avgPanelCount": 0,
                "operations": operations,
            }

    return entries


# ─────────────────────────────────────────────────────────────────────────────
# 2. Load pss_extracted.csv → dict keyed by WO (and customer-unit for multi-match)
# ─────────────────────────────────────────────────────────────────────────────

def load_pss(filepath: Path) -> dict[str, list[dict]]:
    """Load PSS data, indexed by WO for quick lookup."""
    wo_map: dict[str, list[dict]] = {}
    with open(filepath, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            wo = row["WO"].strip()
            if wo:
                wo_map.setdefault(wo, []).append(row)
    return wo_map


# ─────────────────────────────────────────────────────────────────────────────
# 3. Product Engine Type + Line Item Type → Unit Type Estimate key mapping
# ─────────────────────────────────────────────────────────────────────────────

def classify_unit_type(product_engine: str, line_item: str, customer: str) -> str | None:
    """
    Map PSS Product_Engine_Type + Line_Item_Type to the best unit-type-estimates key.

    Product families from PSS:
      TITAN 23001S  → TITAN 130 family (SMT 130, PGM 130, T130 CS/GS)
      TITAN 20501S  → TITAN 205
      TITAN 23502S  → TITAN 235
      TAUR60 / TAUR60 7901S → TAURUS 60 family (SMT 60, T60 CS/GS)
      TAUR70        → TAURUS 70 family (T70 CS/GS, TAUR70 CS)
      TTN250        → TITAN 250 (TTN250 CS, T250 CS)
      TTN350        → TITAN 350 (TTN350 MD, T350)
      MRS100        → MARS 100 (MRS100 CS, M100 CS)
      MARS90        → MARS 90 (MARS90 GS, MARS 90)
      EMD           → EMD CS
      CENT50        → CENTAUR 50 (C50 CS/GS)
      CENT40        → CENTAUR 40 (C40 CS/GS)
    """
    pe = (product_engine or "").upper().strip()
    li = (line_item or "").upper().strip()
    cust = (customer or "").upper().strip()

    # ----- TITAN 130 family (TITAN 23001S) -----
    if "23001" in pe or ("TITAN" in pe and "130" in li):
        # PGM 130 variants
        if any(k in li for k in ["PGM130", "PGM 130", "PGMT130", "T130 PGM", "T130PGM", "PGM130 CORE"]):
            return "PGM 130 TITAN GS"
        if "PGM" in li and "130" in li:
            return "PGM 130 TITAN GS"
        # SMT 130 variants
        if any(k in li for k in ["SMT130", "SMT 130", "T130SMT", "130SMT"]):
            return "SMT 130"
        if "SMT" in li and "130" in li:
            return "SMT 130"
        # Full pre-release (often SMT 130 equivalent)
        if "PRE-RELEASE" in li or "PRERELEASE" in li or "PRE RELEASE" in li:
            return "SMT 130"
        # Alliance builds (Williams, Targa) - typically SMT/PGM
        if "ALLIANC" in li:
            if "PGM" in li:
                return "PGM 130 TITAN GS"
            return "SMT 130"
        # Default TITAN 130
        return "SMT 130"

    # ----- TITAN 205 family (TITAN 20501S, TITAN 20501, TITAN 20502S) -----
    if "20501" in pe or "20502" in pe or "205" in pe:
        return "TITAN CS"

    # ----- TITAN 235 family (TITAN 23502S) -----
    if "23502" in pe or "235" in pe:
        return "TITAN CS"

    # ----- TAURUS 60 family (TAUR60) -----
    if "TAUR60" in pe or "TAURUS 60" in pe or ("TAUR" in pe and "60" in pe):
        # SMT 60 variants
        if any(k in li for k in ["SMT60", "SMT 60", "S60SMT", "S60 SMT"]):
            return "SMT 60"
        if "SMT" in li and "60" in li:
            return "SMT 60"
        if "PRE-RELEASE" in li or "PRERELEASE" in li:
            return "SMT 60"
        if "DF" in li or "DUAL" in li:
            return "SMT 60"
        # Check customer name for S60- prefix (SMT 60 projects)
        if cust.startswith("S60"):
            return "SMT 60"
        return "T60 CS"

    # ----- TAURUS 70 family (TAUR70, TAURUS 70) -----
    if "TAUR70" in pe or "TAURUS 70" in pe or ("TAUR" in pe and "70" in pe):
        if "PGM" in li:
            return "PGM70"
        return "TAUR70 CS"

    # ----- TTN250 (TITAN 250) -----
    if "TTN250" in pe or "T250" in pe or "TITAN 250" in pe:
        return "TTN250 CS"

    # ----- TTN350 (TITAN 350) -----
    if "TTN350" in pe or "T350" in pe or "TITAN 350" in pe:
        return "TTN350 MD"

    # ----- MRS100 / MARS 100 -----
    if "MRS100" in pe or "MARS100" in pe or "MARS 100" in pe or "MRS 100" in pe:
        return "MRS100 CS"

    # ----- MARS 90 / MARS90 -----
    if "MARS90" in pe or "MARS 90" in pe or "MRS90" in pe:
        return "MARS90 GS"

    # ----- EMD -----
    if "EMD" in pe:
        return "EMD CS"

    # ----- CENTAUR 50 -----
    if "CENT50" in pe or "CENTAUR 50" in pe or "C50" in pe:
        return "C50 CS"

    # ----- CENTAUR 40 -----
    if "CENT40" in pe or "CENTAUR 40" in pe or "C40" in pe:
        return "C40 CS"

    # ----- Bare TITAN (stock builds, etc.) -----
    if "TITAN" in pe:
        if "PGM" in li:
            return "PGM 130 TITAN GS"
        if "SMT" in li:
            return "SMT 130"
        return "T130 CS"

    # ----- MISC / unknown -----
    if pe == "MISC":
        return None

    return None


# ─────────────────────────────────────────────────────────────────────────────
# 4. Normalize PD values for matching
# ─────────────────────────────────────────────────────────────────────────────

def normalize_pd(pd: str) -> str:
    """
    Normalize PD/WO for matching between priority-list and PSS.
    Priority list may have suffixes like 'CB', 'CS', 'CC' that PSS doesn't.
    e.g., '2-4K491CB' → '2-4K491'
    """
    pd = pd.strip()
    # Strip common suffixes (CB, CS, CC)
    return re.sub(r'(CB|CS|CC)$', '', pd)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    # Load all data sources
    estimates = parse_estimates(ESTIMATES)
    pss_by_wo = load_pss(PSS_CSV)
    with open(PL_JSON, encoding="utf-8") as f:
        priority_list = json.load(f)

    entries = priority_list["entries"]
    print(f"Loaded {len(entries)} priority list entries")
    print(f"Loaded {sum(len(v) for v in pss_by_wo.values())} PSS records across {len(pss_by_wo)} WOs")
    print(f"Loaded {len(estimates)} unit type estimates")
    print()

    # Build a set of all WOs in PSS for matching
    pss_wo_set = set(pss_by_wo.keys())

    matched = 0
    unmatched_pds = []
    type_matched = 0
    type_unmatched = []

    for entry in entries:
        pd = entry.get("pd", "")
        customer = entry.get("customer", "")
        unit = entry.get("unit", "")

        # --- Step 1: Find PSS match by WO ---
        pss_rows = None
        # Direct match
        if pd in pss_by_wo:
            pss_rows = pss_by_wo[pd]
        else:
            # Try normalized (strip CB/CS/CC suffix)
            norm_pd = normalize_pd(pd)
            if norm_pd in pss_by_wo:
                pss_rows = pss_by_wo[norm_pd]

        # Pick the best PSS row (prefer matching customer+unit)
        pss_match = None
        if pss_rows:
            matched += 1
            # Try to find exact customer+unit match
            for row in pss_rows:
                if row["Customer"].upper() == customer.upper() and row["Unit"] == str(unit):
                    pss_match = row
                    break
            if not pss_match:
                # Fall back to just first with same customer
                for row in pss_rows:
                    if row["Customer"].upper() == customer.upper():
                        pss_match = row
                        break
            if not pss_match:
                # Fall back to first row
                pss_match = pss_rows[0]
        else:
            unmatched_pds.append((pd, customer, unit))

        # --- Step 2: Determine unit type from PSS data ---
        product_engine = pss_match["Product_Engine_Type"] if pss_match else ""
        line_item = pss_match["Line_Item_Type"] if pss_match else ""
        sn = pss_match["SN"] if pss_match else ""
        pd_no = pss_match["PD_No"] if pss_match else ""

        unit_type_key = classify_unit_type(product_engine, line_item, customer)

        # --- Step 3: Look up estimate ---
        estimate_data = estimates.get(unit_type_key) if unit_type_key else None

        if estimate_data:
            type_matched += 1
        elif unit_type_key:
            type_unmatched.append((pd, customer, unit_type_key))

        # --- Step 4: Enrich the entry ---
        entry["pssMatch"] = {
            "productEngineType": product_engine,
            "lineItemType": line_item,
            "serialNumber": sn,
            "pdNumber": pd_no,
        } if pss_match else None

        entry["unitTypeEstimate"] = {
            "unitType": unit_type_key or "UNKNOWN",
            "avgTotalHours": estimate_data["avgTotalHours"] if estimate_data else None,
            "sampleCount": estimate_data["sampleCount"] if estimate_data else None,
            "avgPanelCount": estimate_data["avgPanelCount"] if estimate_data else None,
            "operations": estimate_data.get("operations", []) if estimate_data else [],
        }

    # --- Write enriched output ---
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(priority_list, f, indent=2)

    print(f"PSS WO match:    {matched}/{len(entries)} entries matched")
    print(f"Unit type match: {type_matched}/{len(entries)} entries have time estimates")
    print()

    # --- Summary table ---
    print(f"{'ID':<8} {'Customer':<22} {'U#':<4} {'PD/WO':<14} {'Product Type':<16} {'Unit Type Est.':<22} {'Avg Hours':>10} {'Panels':>7}")
    print("─" * 115)

    for entry in entries:
        pss = entry.get("pssMatch") or {}
        est = entry.get("unitTypeEstimate") or {}
        prod = pss.get("productEngineType", "")
        ut = est.get("unitType", "")
        hours = est.get("avgTotalHours")
        panels = est.get("avgPanelCount")

        print(
            f"{entry['id']:<8} "
            f"{entry['customer'][:21]:<22} "
            f"{entry['unit']:<4} "
            f"{entry['pd'][:13]:<14} "
            f"{prod[:15]:<16} "
            f"{ut[:21]:<22} "
            f"{hours if hours else '—':>10} "
            f"{panels if panels else '—':>7}"
        )

    # --- Unmatched report ---
    if unmatched_pds:
        print(f"\n--- {len(unmatched_pds)} PDs with no PSS match ---")
        for pd, cust, unit in unmatched_pds[:30]:
            print(f"  {pd:<16} {cust} #{unit}")

    if type_unmatched:
        print(f"\n--- {len(type_unmatched)} entries with unresolved unit type estimate ---")
        for pd, cust, ut_key in type_unmatched:
            print(f"  {pd:<16} {cust:<20} classified as '{ut_key}' but no estimate found")

    # --- Unit type distribution in priority list ---
    print("\n--- Unit Type Distribution (Priority List) ---")
    type_counts: dict[str, int] = {}
    type_hours: dict[str, float] = {}
    for entry in entries:
        est = entry.get("unitTypeEstimate", {})
        ut = est.get("unitType", "UNKNOWN")
        type_counts[ut] = type_counts.get(ut, 0) + 1
        if est.get("avgTotalHours"):
            type_hours[ut] = est["avgTotalHours"]

    for ut, cnt in sorted(type_counts.items(), key=lambda x: -x[1]):
        hrs = type_hours.get(ut, 0)
        total = hrs * cnt
        print(f"  {ut:<24} {cnt:>3} units × {hrs:>7.1f} avg hrs = {total:>9.1f} total hrs")

    print(f"\nOutput written to: {OUTPUT_JSON.name}")


if __name__ == "__main__":
    main()
