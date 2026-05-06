#!/usr/bin/env python3
"""
Clean up Schedule.csv by removing rows with dates that have passed.
Offers multiple filtering options based on project completion dates.
"""

import csv
import sys
from datetime import datetime
from pathlib import Path
from collections import defaultdict


def parse_date(date_str: str) -> datetime | None:
    """Parse date string in MM/DD/YY format. Returns None if invalid."""
    if not date_str or date_str.strip() in ("", "#N/A", "#VALUE!", "see #1"):
        return None
    
    try:
        # Try MM/DD/YY format
        return datetime.strptime(date_str.strip(), "%m/%d/%y")
    except ValueError:
        return None


def is_date_column(header: str) -> bool:
    """Determine if a column header represents a date column."""
    # Common date column patterns in the schedule
    date_indicators = [
        "AMKT", "NEW", "LEGALS", "SW", "BRAND LIST", "BRAND WIRE",
        "PROJ KITTED", "CONLAY", "CONASY", "PWRCHK", "D380 FINAL",
        "SHIPC", "DAYS LATE", "COMMMIT", "BIQ COMP",
        "PTION-LINE", "TEST 1ST PASS", "CONCUS", "CONCSH WO OPEN",
        "MSR", "BAAN"
    ]
    
    header_upper = header.strip().upper()
    return any(indicator in header_upper for indicator in date_indicators)


def get_latest_date(row: dict, date_columns: list) -> datetime | None:
    """Find the latest date in a row."""
    dates = []
    for col in date_columns:
        if col in row:
            parsed = parse_date(row[col])
            if parsed:
                dates.append(parsed)
    
    return max(dates) if dates else None


def analyze_schedule(input_file: str) -> tuple[list, dict]:
    """
    Analyze the schedule to show date range and distribution.
    Returns date_columns and analysis dict.
    """
    input_path = Path(input_file)
    
    if not input_path.exists():
        print(f"❌ Input file not found: {input_file}")
        return [], {}
    
    all_dates = []
    year_distribution = defaultdict(int)
    
    with open(input_path, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        if not reader.fieldnames:
            print("❌ Could not read CSV headers")
            return [], {}
        
        # Identify date columns
        date_columns = [col for col in reader.fieldnames if is_date_column(col)]
        
        for row in reader:
            latest_date = get_latest_date(row, date_columns)
            if latest_date:
                all_dates.append(latest_date)
                year_distribution[latest_date.year] += 1
    
    if all_dates:
        min_date = min(all_dates)
        max_date = max(all_dates)
        
        analysis = {
            "min_date": min_date,
            "max_date": max_date,
            "total_dated_rows": len(all_dates),
            "year_distribution": dict(year_distribution),
        }
        return date_columns, analysis
    
    return date_columns, {}


def clean_schedule(input_file: str, output_file: str, cutoff_date: datetime) -> None:
    """
    Clean the schedule CSV by removing rows with all dates before the cutoff.
    
    Args:
        input_file: Path to input CSV file
        output_file: Path to output CSV file
        cutoff_date: Keep rows with at least one date >= this date
    """
    input_path = Path(input_file)
    output_path = Path(output_file)
    
    if not input_path.exists():
        print(f"❌ Input file not found: {input_file}")
        return
    
    rows_read = 0
    rows_kept = 0
    rows_removed = 0
    
    with open(input_path, 'r', encoding='utf-8') as infile:
        reader = csv.DictReader(infile)
        
        if not reader.fieldnames:
            print("❌ Could not read CSV headers")
            return
        
        # Identify date columns
        date_columns = [col for col in reader.fieldnames if is_date_column(col)]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
            writer.writeheader()
            
            for row in reader:
                rows_read += 1
                latest_date = get_latest_date(row, date_columns)
                
                # Keep row if it has a date on or after the cutoff
                if latest_date and latest_date >= cutoff_date:
                    writer.writerow(row)
                    rows_kept += 1
                else:
                    rows_removed += 1
    
    print(f"\n✅ Cleanup complete!")
    print(f"   Total rows read:    {rows_read}")
    print(f"   Rows kept:         {rows_kept}")
    print(f"   Rows removed:      {rows_removed}")
    
    if rows_kept > 0:
        print(f"\n💾 Cleaned file saved to: {output_path}")
    else:
        print(f"\n⚠️  No rows matched the cutoff date.")


if __name__ == "__main__":
    input_file = "Share/Schedule/Schedule.csv"
    output_file = "Share/Schedule/Schedule-cleaned.csv"
    
    # First, analyze the file
    print("🔎 Analyzing Schedule.csv...\n")
    date_columns, analysis = analyze_schedule(input_file)
    
    if analysis:
        print(f"📊 Date Range in Your Schedule:")
        print(f"   Earliest date: {analysis['min_date'].strftime('%B %d, %Y')}")
        print(f"   Latest date:   {analysis['max_date'].strftime('%B %d, %Y')}")
        print(f"   Rows with dates: {analysis['total_dated_rows']}")
        print(f"\n📈 Distribution by year:")
        for year in sorted(analysis['year_distribution'].keys()):
            count = analysis['year_distribution'][year]
            print(f"   {year}: {count} rows")
        
        print("\n" + "="*60)
        print("🎯 FILTERING OPTIONS:")
        print("="*60)
        print(f"\n1. Remove all pre-2025 data (keeps 2025+)")
        print(f"\n2. Remove all pre-2026 data (keeps 2026+)")
        print(f"\n3. Keep only future dates (May 3, 2026+)")
        print(f"\n4. Remove dates that passed March 2026 (April 1, 2026+)")
        
        print(f"\n⚠️  Since your data ranges from {analysis['min_date'].year}-{analysis['max_date'].month}/{analysis['max_date'].day}")
        print(f"   to {analysis['max_date'].year}-{analysis['max_date'].month}/{analysis['max_date'].day},")
        print(f"   all dates have technically 'passed' after May 3, 2026.")
        print(f"\n📝 The script below will use Option 4 (April 1, 2026 cutoff).\n")
    
    # Clean with April 1, 2026 cutoff (remove dates that passed March 2026)
    cutoff_date = datetime(2026, 4, 1)
    print(f"🔍 Using cutoff: {cutoff_date.strftime('%B %d, %Y')}")
    print(f"   (keeping rows with dates >= {cutoff_date.strftime('%m/%d/%y')})\n")
    
    clean_schedule(input_file, output_file, cutoff_date)
