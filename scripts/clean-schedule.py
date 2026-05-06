#!/usr/bin/env python3
"""
Clean up Schedule.csv by removing rows where D380 FINAL-BIQ column 
has a date that falls in April or later (after March).
"""

import csv
from datetime import datetime
from pathlib import Path


def parse_date(date_str: str) -> datetime | None:
    """Parse date string in MM/DD/YY format. Returns None if invalid."""
    if not date_str or date_str.strip() in ("", "#N/A", "#VALUE!", "see #1"):
        return None
    
    try:
        return datetime.strptime(date_str.strip(), "%m/%d/%y")
    except ValueError:
        return None


def is_after_march(date_obj: datetime) -> bool:
    """Check if date is in April (month 4) or later in the year."""
    return date_obj.month > 3


def clean_schedule(input_file: str, output_file: str) -> None:
    """
    Remove rows where D380 FINAL-BIQ column has a date after March.
    """
    input_path = Path(input_file)
    output_path = Path(output_file)
    
    if not input_path.exists():
        print(f"❌ Input file not found: {input_file}")
        return
    
    rows_read = 0
    rows_kept = 0
    rows_removed = 0
    removed_slots = []
    
    with open(input_path, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        if not reader.fieldnames:
            print("❌ Could not read CSV headers")
            return
        
        # Check if the target column exists
        if "D380 FINAL-BIQ" not in reader.fieldnames:
            print(f"❌ Column 'D380 FINAL-BIQ' not found in CSV")
            print(f"   Available columns: {', '.join(reader.fieldnames[:10])}...")
            return
        
        print(f"🔍 Looking for 'D380 FINAL-BIQ' column...")
        print(f"   Removing rows where date is April or later\n")
        
        with open(output_path, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
            writer.writeheader()
            
            for row in reader:
                rows_read += 1
                d380_final_value = row.get("D380 FINAL-BIQ")
                d380_final = (d380_final_value if d380_final_value is not None else "").strip()
                
                # Parse the date in D380 FINAL-BIQ column
                date_obj = parse_date(d380_final)
                
                # Check if date is after March (April or later)
                if date_obj and is_after_march(date_obj):
                    # Remove this row
                    rows_removed += 1
                    slot = row.get("SLOT", "N/A")
                    removed_slots.append({
                        "slot": slot,
                        "date": date_obj.strftime("%m/%d/%y"),
                        "month": date_obj.strftime("%B")
                    })
                else:
                    # Keep this row
                    writer.writerow(row)
                    rows_kept += 1
    
    print(f"✅ Cleanup complete!")
    print(f"   Total rows read:    {rows_read}")
    print(f"   Rows kept:         {rows_kept}")
    print(f"   Rows removed:      {rows_removed}")
    
    if rows_removed > 0:
        print(f"\n📋 Sample of removed rows (showing first 10):")
        for item in removed_slots[:10]:
            print(f"   • {item['slot']:15} (D380 FINAL-BIQ: {item['date']} - {item['month']})")
        
        if len(removed_slots) > 10:
            print(f"   ... and {len(removed_slots) - 10} more rows")
    
    print(f"\n💾 Cleaned file saved to: {output_path}")


if __name__ == "__main__":
    input_file = "Share/Schedule/Schedule.csv"
    output_file = "Share/Schedule/Schedule-cleaned.csv"
    
    clean_schedule(input_file, output_file)
