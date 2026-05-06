/**
 * generate-user-profiles.js
 *
 * Reads Share/users/users.csv and creates a directory tree:
 *
 *   Share/users/1st-shift/<badge>/profile.json
 *   Share/users/2nd-shift/<badge>/profile.json
 *
 * Each profile.json is seeded from the CSV row and serves as the mutable
 * source-of-truth for all per-user profile changes (preferences, avatar, etc.).
 *
 * Re-running the script is safe:
 *   - Existing profile.json files are NOT overwritten (preserves user edits).
 *   - Pass --force to regenerate all profiles from CSV.
 *   - Pass --dry-run to preview what would be created.
 *
 * Usage:
 *   node scripts/generate-user-profiles.js
 *   node scripts/generate-user-profiles.js --force
 *   node scripts/generate-user-profiles.js --dry-run
 */

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CSV_PATH = path.join(__dirname, '..', 'Share', 'users', 'users.csv');
const USERS_DIR = path.join(__dirname, '..', 'Share', 'users');

const SHIFT_DIR_MAP = {
    '1': '1st-shift',
    '2': '2nd-shift',
};

const ROLE_MAP = {
    DEVELOPER: 'developer',
    MANAGER: 'manager',
    SUPERVISOR: 'supervisor',
    BRANDER: 'brander',
    WIRER: 'wirer',
    CROSS_WIRER: 'cross_wirer',
    TEST: 'test',
    PWR_CHECK: 'pwr_check',
    LEAD: 'lead',
    BIQ: 'biq',
    TEAM_LEAD: 'team_lead',
    QA: 'qa',
    BRANDER: 'brander',
    ASSEMBLER: 'assembler',
};

const flags = process.argv.slice(2);
const FORCE = flags.includes('--force');
const DRY_RUN = flags.includes('--dry-run');

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function stripQuotes(v) {
    if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
    return v;
}

function parseCsv(filepath) {
    const raw = fs.readFileSync(filepath, 'utf-8');
    const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const headers = lines[0].split(',').map(stripQuotes);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(stripQuotes);
        const row = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        rows.push(row);
    }

    return rows;
}

// ---------------------------------------------------------------------------
// Profile builder
// ---------------------------------------------------------------------------

function buildDefaultPreferences() {
    return {
        theme: 'system',
        notifications: {
            stageComplete: true,
            assignmentBlocked: true,
            handoffRequired: true,
            shiftReminders: true,
        },
        dashboardLayout: 'expanded',
        defaultViews: {
            projectBoard: 'grid',
            workAreaBoard: 'floor',
        },
    };
}

function buildSkills(row) {
    const skillKeys = [
        'skill_brand_list', 'skill_branding', 'skill_build_up', 'skill_wiring',
        'skill_wiring_ipv', 'skill_box_build', 'skill_cross_wire',
        'skill_test', 'skill_pwr_check', 'skill_biq',
        'skill_green_change',
    ];

    const skills = {};
    for (const key of skillKeys) {
        const label = key.replace('skill_', '');
        const val = parseInt(row[key], 10);
        skills[label] = isNaN(val) ? 0 : val;
    }
    return skills;
}

function csvRowToProfile(row) {
    const shift = SHIFT_DIR_MAP[row.shift] || '1st-shift';
    const role = ROLE_MAP[row.role] || row.role.toLowerCase();
    const now = new Date().toISOString();

    return {
        badge: row.badge,
        fullName: row.legal_name,
        preferredName: row.preferred_name || null,
        initials: row.initials || null,
        role,
        shift: shift.replace('-shift', ''),
        primaryLwc: row.primary_lwc || 'NEW_FLEX',
        email: row.email || null,
        phone: row.phone || null,
        avatarPath: null,
        coverImagePath: null,
        bio: null,
        department: null,
        title: null,
        location: null,
        hireDate: row.hire_date || null,
        yearsExperience: parseFloat(row.years_experience) || 0,
        skills: buildSkills(row),
        preferences: buildDefaultPreferences(),
        lastLoginAt: null,
        createdAt: row.created_at || now,
        updatedAt: now,
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`✗ CSV not found: ${CSV_PATH}`);
        process.exit(1);
    }

    const rows = parseCsv(CSV_PATH);
    console.log(`Found ${rows.length} users in CSV\n`);

    let created = 0;
    let skipped = 0;
    let overwritten = 0;

    const summary = { '1st-shift': 0, '2nd-shift': 0, '3rd-shift': 0 };

    for (const row of rows) {
        if (!row.badge || row.is_active === 'false') {
            skipped++;
            continue;
        }

        const shiftDir = SHIFT_DIR_MAP[row.shift] || '1st-shift';
        const badgeDir = path.join(USERS_DIR, shiftDir, row.badge);
        const profilePath = path.join(badgeDir, 'profile.json');

        const exists = fs.existsSync(profilePath);

        if (exists && !FORCE) {
            skipped++;
            continue;
        }

        const profile = csvRowToProfile(row);

        if (DRY_RUN) {
            const action = exists ? 'OVERWRITE' : 'CREATE';
            console.log(`  [${action}] ${path.relative(USERS_DIR, profilePath)}`);
        } else {
            fs.mkdirSync(badgeDir, { recursive: true });
            fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n', 'utf-8');
        }

        if (exists) overwritten++;
        else created++;

        summary[shiftDir] = (summary[shiftDir] || 0) + 1;
    }

    console.log(`\n${'─'.repeat(40)}`);
    console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Results:`);
    console.log(`  Created:     ${created}`);
    console.log(`  Overwritten: ${overwritten}`);
    console.log(`  Skipped:     ${skipped}`);
    console.log(`\nBy shift:`);
    for (const [shift, count] of Object.entries(summary)) {
        if (count > 0) console.log(`  ${shift}: ${count}`);
    }
    console.log(`\nOutput: ${USERS_DIR}/<shift>/<badge>/profile.json`);
}

main();
