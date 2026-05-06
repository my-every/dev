# Users Data

## Overview
This folder contains user identity and profile data for the D380 manufacturing application.

## Files

### users.csv
Contains all user records with authentication and profile information.

| Column | Type | Description |
|--------|------|-------------|
| badge | string | Unique badge number (primary identifier) |
| pin_hash | string | Hashed PIN for authentication (never raw) |
| legal_name | string | Legal full name |
| preferred_name | string | Preferred display name |
| initials | string | Display initials (2-3 chars) |
| role | UserRole | Role: MANAGER, SUPERVISOR, TEAM_LEAD, QA, BRANDER, ASSEMBLER |
| avatar_path | string | Path to profile photo (nullable) |
| primary_lwc | LwcType | Primary Labor Work Code section |
| current_shift | string | Current shift: 1st, 2nd, 3rd |
| email | string | Email address (nullable) |
| phone | string | Phone number (nullable) |
| is_active | boolean | Whether user is active |
| created_at | ISO8601 | Record creation timestamp |
| updated_at | ISO8601 | Last update timestamp |

## Usage

### Import (App Load)
```typescript
import { loadUsersFromCSV } from '@/lib/data-loader/share-loader';

const users = await loadUsersFromCSV('/Share/users/users.csv');
```

### Export (State Change)
```typescript
import { exportUsersToCSV } from '@/lib/data-loader/share-loader';

await exportUsersToCSV(users, '/Share/users/users.csv');
```

## Related Types
- `UserIdentity` in `types/d380-user-session.ts`
- `UserProfile` in `types/profile.ts`
- `D380User` in `types/d380-user-session.ts`

## Notes
- PIN hashes should never be stored in plain text
- Badge numbers are unique identifiers used for all authentication
- Role determines dashboard configuration and action permissions
