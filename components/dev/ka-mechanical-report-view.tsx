import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { KaMechanicalReport } from '@/lib/diagnostics/ka-mechanical-report'

interface KaMechanicalReportViewProps {
  report: KaMechanicalReport
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString()
}

export function KaMechanicalReportView({ report }: KaMechanicalReportViewProps) {
  const sheetsWithRuns = report.sheets.filter((sheet) => sheet.runCount > 0)
  const totalRuns = sheetsWithRuns.reduce((total, sheet) => total + sheet.runCount, 0)
  const totalSegments = sheetsWithRuns.reduce((total, sheet) => total + sheet.segmentCount, 0)
  const totalDevices = sheetsWithRuns.reduce((total, sheet) => total + sheet.deviceCount, 0)

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">Diagnostic Route</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">KA Mechanical Jumper Summary</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Using the latest Legal Drawings workbook and matched layout for {report.pdNumber} from {report.projectFolder}.
          </p>
        </div>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <Card>
            <CardHeader>
              <CardTitle>Source Files</CardTitle>
              <CardDescription>
                Parsed against the current Legal Drawings selection rather than Share project state.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Wire List</p>
                <Link className="text-sm font-medium text-primary hover:underline" href={report.wireList.href} target="_blank">
                  {report.wireList.filename}
                </Link>
                <p className="text-sm text-muted-foreground">Revision {report.wireList.revision}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Layout</p>
                {report.layoutPdf ? (
                  <>
                    <Link className="text-sm font-medium text-primary hover:underline" href={report.layoutPdf.href} target="_blank">
                      {report.layoutPdf.filename}
                    </Link>
                    <p className="text-sm text-muted-foreground">Revision {report.layoutPdf.revision}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No matching layout PDF was discovered.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reference Sheets</p>
                <p className="text-sm text-foreground">Blue Labels: {report.blueLabelsSheetName ?? 'Missing'}</p>
                <p className="text-sm text-foreground">Part List: {report.partListSheetName ?? 'Missing'}</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Generated</p>
                <p className="text-sm text-foreground">{formatTimestamp(report.generatedAt)}</p>
                <p className="text-sm text-muted-foreground">{report.projectName}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
              <CardDescription>Current KA mechanical extraction output across parsed operational sheets.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Sheets With Runs</p>
                <p className="mt-1 text-2xl font-semibold">{sheetsWithRuns.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Runs</p>
                <p className="mt-1 text-2xl font-semibold">{totalRuns}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Segments</p>
                <p className="mt-1 text-2xl font-semibold">{totalSegments}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground uppercase">Devices</p>
                <p className="mt-1 text-2xl font-semibold">{totalDevices}</p>
              </div>
              <div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-2">
                <p className="text-xs text-muted-foreground uppercase">Part Number Entries</p>
                <p className="mt-1 text-2xl font-semibold">{report.partNumberCount}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {(report.blueLabelWarnings.length > 0 || report.workbookWarnings.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Parser Warnings</CardTitle>
              <CardDescription>These warnings came from the workbook parser and Blue Labels sequence builder.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {report.blueLabelWarnings.map((warning) => (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50/50 px-3 py-2 text-amber-950" key={`blue-${warning}`}>
                  {warning}
                </div>
              ))}
              {report.workbookWarnings.map((warning) => (
                <div className="rounded-lg border border-zinc-300/60 bg-muted px-3 py-2" key={`workbook-${warning}`}>
                  {warning}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Sheet Coverage</CardTitle>
            <CardDescription>Every parsed operational sheet, sorted by KA mechanical runs detected.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="px-2 py-3 font-medium">Sheet</th>
                    <th className="px-2 py-3 font-medium">Rows</th>
                    <th className="px-2 py-3 font-medium">Runs</th>
                    <th className="px-2 py-3 font-medium">Segments</th>
                    <th className="px-2 py-3 font-medium">Devices</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sheets.map((sheet) => (
                    <tr className="border-b" key={sheet.sheetSlug}>
                      <td className="px-2 py-3 font-medium text-foreground">{sheet.sheetName}</td>
                      <td className="px-2 py-3 text-muted-foreground">{sheet.rowCount}</td>
                      <td className="px-2 py-3">
                        <Badge variant={sheet.runCount > 0 ? 'default' : 'outline'}>{sheet.runCount}</Badge>
                      </td>
                      <td className="px-2 py-3 text-muted-foreground">{sheet.segmentCount}</td>
                      <td className="px-2 py-3 text-muted-foreground">{sheet.deviceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <section className="flex flex-col gap-4">
          {sheetsWithRuns.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No Mechanical Runs Detected</CardTitle>
                <CardDescription>
                  The current workbook parsed successfully, but the KA mechanical extractor returned no runs.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            sheetsWithRuns.map((sheet) => (
              <Card key={sheet.sheetSlug}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{sheet.sheetName}</CardTitle>
                    <Badge>{sheet.runCount} runs</Badge>
                    <Badge variant="outline">{sheet.segmentCount} segments</Badge>
                    <Badge variant="outline">{sheet.deviceCount} devices</Badge>
                  </div>
                  <CardDescription>Detailed run output for the existing KA mechanical jumper extractor.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sheet.runs.map((run) => (
                    <div className="rounded-xl border" key={run.id}>
                      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                        <Badge>{run.terminal}</Badge>
                        <Badge variant="outline">{run.signalType}</Badge>
                        <span className="text-sm font-medium text-foreground">{run.startDeviceId} to {run.endDeviceId}</span>
                        <span className="text-sm text-muted-foreground">{run.deviceCount} devices</span>
                        <span className="text-sm text-muted-foreground">{run.segmentCount} rows</span>
                        {run.location ? <span className="text-sm text-muted-foreground">{run.location}</span> : null}
                      </div>
                      <div className="space-y-4 px-4 py-4">
                        <div>
                          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Blue Labels Order</p>
                          <p className="mt-2 break-words text-sm text-foreground">{run.orderedDevices.join(' -> ')}</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="border-b text-muted-foreground">
                              <tr>
                                <th className="px-2 py-2 font-medium">Row</th>
                                <th className="px-2 py-2 font-medium">From</th>
                                <th className="px-2 py-2 font-medium">To</th>
                                <th className="px-2 py-2 font-medium">Wire No</th>
                                <th className="px-2 py-2 font-medium">Wire ID</th>
                                <th className="px-2 py-2 font-medium">Location</th>
                              </tr>
                            </thead>
                            <tbody>
                              {run.rows.map((row) => (
                                <tr className="border-b" key={row.rowId}>
                                  <td className="px-2 py-2 font-mono text-xs text-muted-foreground">{row.rowId}</td>
                                  <td className="px-2 py-2 text-foreground">{row.fromDeviceId}</td>
                                  <td className="px-2 py-2 text-foreground">{row.toDeviceId}</td>
                                  <td className="px-2 py-2 text-muted-foreground">{row.wireNo || '—'}</td>
                                  <td className="px-2 py-2 text-muted-foreground">{row.wireId || '—'}</td>
                                  <td className="px-2 py-2 text-muted-foreground">{row.location || row.toLocation || row.fromLocation || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  )
}