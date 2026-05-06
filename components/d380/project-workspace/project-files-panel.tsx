import { ProjectFileCard } from '@/components/d380/project-workspace/project-file-card'
import { Card, CardContent } from '@/components/ui/card'
import type { ProjectWorkspaceFilesViewModel } from '@/types/d380-project-workspace'

export function ProjectFilesPanel({ files }: { files: ProjectWorkspaceFilesViewModel }) {
  return (
    <section className="space-y-6">
      {files.groups.map(group => (
        <Card key={group.id} className="rounded-[32px] border border-border/70 bg-card py-0">
          <CardContent className="space-y-5 px-6 py-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">{group.label}</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Managed file metadata aligned to current project state.</h2>
            </div>
            {group.files.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">No files staged in this category yet.</div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {group.files.map(file => <ProjectFileCard key={file.id} file={file} />)}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}