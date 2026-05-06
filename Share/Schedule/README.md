# Schedule Data

## Overview
Master production schedule imported from external planning systems. Contains project slot assignments with milestone dates and status tracking.

## Files

### Schedule.csv
Production schedule with project milestones and dates.

## Key Columns

| Column | Description |
|--------|-------------|
| SLOT | Unique slot identifier |
| LWC | Labor Work Code (Onskid, Offskid, New, NTB, etc.) |
| PROJECT | Project name/customer |
| UNIT | Unit number |
| PD# | Production Drawing number |
| LEGALS | Legal drawings received date |
| SW | Standard work date |
| BRAND LIST | Brand list date |
| BRAND WIRE | Brand wire date |
| PROJ KITTED | Project kitted date |
| PTI ON-LINE | PTI online date |
| CONLAY | Console lay date |
| CONASY | Console assembly date |
| TEST 1ST PASS | First test pass date |
| PWRCHK | Power check date |
| D380 FINAL-BIQ | Final BIQ date |
| SHIPC | Ship complete date |
| DEPT 380 TARGET | Department 380 target date |
| DAYS LATE | Days behind schedule |
| NEW COMMMIT | New commitment date |
| BIQ COMP | BIQ complete date |
| HIDE | Hide from display flag |
| COMMENTS | Additional notes |

## Date Formats
- Standard dates: `MM/DD/YY` (e.g., `04/20/23`)
- Actuals: Suffix with `A` (e.g., `04/20/23A`)
- Committed: Suffix with `C` (e.g., `04/20/23C`)
- References: `see #1` (refers to another unit)
- Not applicable: `#N/A`

## LWC Types
| Code | Description |
|------|-------------|
| Onskid | On-skid work packages |
| Offskid | Off-skid work packages |
| New | New projects |
| NTB | Non-Traditional Build |

## Usage

### Import (App Load)
```typescript
import { loadScheduleFromCSV } from '@/lib/data-loader/share-loader';

const schedule = await loadScheduleFromCSV('/Share/Schedule/Schedule.csv');
```

### Data Flow
1. Schedule is imported from external planning system
2. Used to create project records and assignment targets
3. Milestone dates drive stage progression tracking
4. "DAYS LATE" calculated against targets

## Related Files
- `assignments/assignments.csv` - Active assignment state
- `stages/stages.csv` - Stage definitions

## Notes
- This file is read-only (imported from external system)
- Contains historical data (do not delete completed rows)
- HIDE column excludes rows from active displays
- Complex header structure (multi-line headers in source)
