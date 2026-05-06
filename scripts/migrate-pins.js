const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CSV_PATH = path.join(__dirname, '..', 'Share', 'users', 'users.csv');
const PIN_HMAC_SECRET = 'd380-pin-auth-key';

function hashPin(pin, badge) {
    return crypto.createHmac('sha256', PIN_HMAC_SECRET).update(badge + ':' + pin).digest('hex');
}

function stripQuotes(v) {
    if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
    return v;
}

function splitLine(line) {
    return line.split(',').map(stripQuotes);
}

const raw = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = raw.trim().split(/\r?\n/);
const headers = splitLine(lines[0]);
const badgeIdx = headers.indexOf('badge');
const pinIdx = headers.indexOf('pin');

let migrated = 0;
const output = [lines[0]];

for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const badge = cols[badgeIdx];
    const pin = cols[pinIdx];
    if (/^\d{4}$/.test(pin)) {
        cols[pinIdx] = hashPin(pin, badge);
        migrated++;
    }
    output.push(cols.join(','));
}

fs.writeFileSync(CSV_PATH, output.join('\n') + '\n', 'utf-8');
console.log('Migrated ' + migrated + ' PINs to HMAC-SHA256 hashes');

// Show a sample
const sampleCols = splitLine(output[1]);
console.log('Sample hash for badge ' + sampleCols[badgeIdx] + ': ' + sampleCols[pinIdx].substring(0, 16) + '...');
