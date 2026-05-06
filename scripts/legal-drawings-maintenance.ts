#!/usr/bin/env node

import { parseArgs } from 'node:util'

import {
  getLegalDrawingsMaintenanceHelpText,
  runLegalDrawingsMaintenance,
  type LegalDrawingsMaintenanceCommand,
} from '../lib/legal-drawings/admin.ts'

const cliArgs = process.argv.slice(2).filter((arg) => arg !== '--')

const { positionals, values } = parseArgs({
  args: cliArgs,
  allowPositionals: true,
  options: {
    pd: { type: 'string' },
    rev: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  strict: false,
})

async function main() {
  const command = positionals[0] as LegalDrawingsMaintenanceCommand | undefined
  if (!command || values.help || command === ('help' as LegalDrawingsMaintenanceCommand)) {
    process.stdout.write(`${getLegalDrawingsMaintenanceHelpText()}\n`)
    return
  }

  const summary = await runLegalDrawingsMaintenance({
    command,
    pdNumber: values.pd,
    revision: values.rev,
    dryRun: values['dry-run'],
  })

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})