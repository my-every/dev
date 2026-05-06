import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const csvPath = path.join(root, 'Share/biq/BIQ-Checklist.csv');
const swsRoot = path.join(root, 'Share/sws-library');
const templatesDir = path.join(swsRoot, 'templates');
const operationsPath = path.join(swsRoot, 'operations.json');
const manifestPath = path.join(swsRoot, 'manifest.json');

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((value) => value.replace(/\r/g, '').trim());
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function countTasks(tasks: Array<{ children?: unknown[] }>): number {
  return tasks.reduce((sum, task) => sum + 1 + countTasks((task.children as Array<{ children?: unknown[] }> | undefined) ?? []), 0);
}

async function main() {
  await fs.mkdir(templatesDir, { recursive: true });

  const raw = await fs.readFile(csvPath, 'utf-8');
  const lines = raw.split('\n').map((line) => line.trimEnd());

  const rows = lines
    .filter((line) => /^(FIRST|SECOND|THIRD),/i.test(line))
    .map((line) => {
      const cols = parseCsvLine(line);
      return {
        phase: (cols[0] || '').toUpperCase(),
        itemNo: cols[1] || '',
        tier: cols[2] || '',
        check: cols[3] || '',
        category: cols[4] || 'General',
        ipvCodes: cols[5] || '',
      };
    });

  const phaseOrder = ['FIRST', 'SECOND', 'THIRD'];
  const groups = phaseOrder.map((phase, phaseIndex) => {
    const phaseRows = rows.filter((row) => row.phase === phase);
    return {
      id: `biq-${phase.toLowerCase()}-phase`,
      title: `${phase} Phase`,
      description: `BIQ ${phase.toLowerCase()} pass checklist tasks`,
      order: phaseIndex,
      tasks: phaseRows.map((row) => {
        const notesParts = [row.tier ? `Tier ${row.tier}` : 'Tier -'];
        if (row.ipvCodes && row.ipvCodes !== '-') notesParts.push(`IPV: ${row.ipvCodes}`);
        return {
          id: `biq-${phase.toLowerCase()}-${row.itemNo}`,
          title: `#${row.itemNo} ${row.category}`,
          description: row.check,
          required: row.tier !== 'D',
          completedByDefault: false,
          notes: notesParts.join(' | '),
          reviewRequirement: 'Visual + functional verification',
          stageIds: ['BIQ'],
          children: [],
        };
      }),
    };
  });

  const now = new Date().toISOString();
  const template = {
    id: 'BIQ_FINAL_INSPECTION_V1_2',
    name: 'BIQ Final Inspection Checklist',
    description: 'Derived from BIQ-Checklist.csv Rev V1.2. Covers FIRST/SECOND/THIRD BIQ verification passes.',
    kind: 'standard',
    status: 'active',
    version: 1,
    versionLabel: 'V1.2',
    tags: ['biq', 'inspection', 'quality', 'final-inspection'],
    groups,
    prerequisites: [
      'Box build SWS completed',
      'Cross-wiring completion confirmed',
      'Latest layout and wirelist revisions verified',
    ],
    blockers: [
      'Any unresolved mission-critical discrepancy',
      'Missing mandatory labels/guards',
      'Open shortage without ATL documentation',
    ],
    reviewRequirements: [
      'Verify all S-tier items are complete before BIQ signoff',
      'Upload BIQ discrepancy evidence and photos',
      'Record discrepancy count in BIQ completed log',
    ],
    accessoryHardwareHints: [
      'Penetrox for bonded holes',
      'Torque paint check on required fasteners',
      'Grounding hardware integrity',
    ],
    reviewCadenceDays: 14,
    notes: 'This template is seeded from CSV and intended as the default BIQ worksheet.',
    baseTemplateId: null,
    createdAt: now,
    updatedAt: now,
    createdBy: 'codex-seed',
    updatedBy: 'codex-seed',
  };

  await fs.writeFile(path.join(templatesDir, `${template.id}.json`), JSON.stringify(template, null, 2), 'utf-8');

  const operations = await readJson<any[]>(operationsPath, []);
  const op = {
    id: 'operation-biq-final-inspection-v1-2-stage-biq',
    templateId: template.id,
    targetType: 'stage',
    targetId: 'BIQ',
    targetLabel: 'BIQ',
    status: 'active',
    note: 'Auto-linked from BIQ checklist CSV seed',
    createdAt: now,
    updatedAt: now,
  };
  const filteredOps = operations.filter((entry) => entry.id !== op.id && !(entry.templateId === op.templateId && entry.targetType === op.targetType && entry.targetId === op.targetId));
  filteredOps.unshift(op);
  await fs.writeFile(operationsPath, JSON.stringify(filteredOps, null, 2), 'utf-8');

  const templateFiles = (await fs.readdir(templatesDir)).filter((name) => name.endsWith('.json'));
  const templates = [] as any[];
  for (const file of templateFiles) {
    const t = await readJson<any | null>(path.join(templatesDir, file), null);
    if (t?.id && t?.name) templates.push(t);
  }
  const manifest = {
    version: 1,
    updatedAt: now,
    totalTemplates: templates.length,
    templates: templates.map((t) => {
      const templateOps = filteredOps.filter((o) => o.templateId === t.id);
      return {
        id: t.id,
        name: t.name,
        kind: t.kind,
        status: t.status,
        groupCount: (t.groups ?? []).length,
        taskCount: (t.groups ?? []).reduce((sum: number, g: any) => sum + countTasks(g.tasks ?? []), 0),
        operationCount: templateOps.length,
        linkedStageCount: templateOps.filter((o) => o.targetType === 'stage').length,
        linkedPartCount: templateOps.filter((o) => o.targetType === 'part-number' || o.targetType === 'part-family').length,
        linkedTrainingCount: templateOps.filter((o) => o.targetType === 'training-module').length,
        updatedAt: t.updatedAt,
      };
    }),
  };

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`Seeded BIQ template with ${rows.length} checklist rows and rebuilt manifest.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
