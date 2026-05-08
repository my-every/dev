#!/usr/bin/env bash
# copy-to-fresh-project.sh
# Copies the minimal file set needed for:
#   create project → upload legals → print-modal → wire list / brand list downloads
#
# Usage:
#   ./scripts/copy-to-fresh-project.sh /path/to/fresh/project
#
# The destination must already be a Next.js + Tailwind project scaffold.
# Files are copied preserving directory structure; existing files are overwritten.

set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-}"

if [[ -z "$DEST" ]]; then
  echo "Usage: $0 <destination-directory>"
  exit 1
fi

if [[ ! -d "$DEST" ]]; then
  echo "Error: destination '$DEST' does not exist."
  exit 1
fi

copy() {
  local rel="$1"
  local src_path="$SRC/$rel"
  local dest_path="$DEST/$rel"
  if [[ ! -e "$src_path" ]]; then
    echo "  [SKIP – not found] $rel"
    return
  fi
  mkdir -p "$(dirname "$dest_path")"
  cp -p "$src_path" "$dest_path"
  echo "  [OK] $rel"
}

copy_dir() {
  local rel="$1"
  local src_path="$SRC/$rel"
  if [[ ! -d "$src_path" ]]; then
    echo "  [SKIP – dir not found] $rel"
    return
  fi
  mkdir -p "$DEST/$rel"
  cp -rp "$src_path/." "$DEST/$rel/"
  echo "  [OK – dir] $rel"
}

echo ""
echo "==> Source : $SRC"
echo "==> Dest   : $DEST"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# ROOT CONFIG
# ─────────────────────────────────────────────────────────────────────────────
echo "[1/9] Root config files"
copy "tsconfig.json"
copy "next.config.mjs"
copy "postcss.config.mjs"
copy "components.json"
copy "middleware.ts"
copy "terminalSchema.ts"
copy "boxSide.ts"
copy "next-env.d.ts"
copy "app/globals.css"
copy "app/layout.tsx"
# Standalone entry point → becomes root page in the destination
if [[ -f "$SRC/app/standalone/page.tsx" ]]; then
  mkdir -p "$DEST/app"
  cp -p "$SRC/app/standalone/page.tsx" "$DEST/app/page.tsx"
  echo "  [OK] app/standalone/page.tsx → app/page.tsx"
fi

# ─────────────────────────────────────────────────────────────────────────────
# TYPES
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[2/9] Types"
copy_dir "types"

# ─────────────────────────────────────────────────────────────────────────────
# UI PRIMITIVES  (shadcn/radix — copy the whole folder; it's shared everywhere)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[3/9] UI primitives"
copy_dir "components/ui"
copy "components/theme-provider.tsx"
copy "components/theme-toggle.tsx"

# ─────────────────────────────────────────────────────────────────────────────
# PROJECT CREATION
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[4/9] Project creation"

# Components
copy "components/projects/create-project-dialog.tsx"
copy "components/projects/project-initialization-workspace.tsx"
copy "components/projects/project-initialize-button.tsx"

# Contexts & hooks
copy "contexts/project-context.tsx"
copy "contexts/upload-context.tsx"
copy "hooks/use-project-initialize.ts"
copy "hooks/use-project-revisions.ts"
copy "hooks/use-project-lookups.ts"
copy "hooks/use-project-details-v2.ts"
copy "hooks/use-permissions.ts"
copy "hooks/use-session.ts"
copy "hooks/use-toast.ts"
copy "hooks/use-mobile.ts"
copy "hooks/use-isomorphic-layout-effect.ts"
copy "hooks/use-as-ref.ts"
copy "hooks/use-lazy-ref.ts"
copy "hooks/use-delay.ts"

# API routes — projects
copy "app/api/projects/route.ts"
copy "app/api/projects/files/route.ts"
copy "app/api/projects/[projectId]/route.ts"
copy "app/api/projects/[projectId]/manifest/route.ts"
copy "app/api/projects/[projectId]/manifest/schema/route.ts"
copy "app/api/projects/[projectId]/manifest/tabs/route.ts"
copy "app/api/projects/[projectId]/manifest/recalculate/route.ts"
copy "app/api/projects/[projectId]/manifest/regenerate/route.ts"
copy "app/api/projects/[projectId]/initialize/route.ts"
copy "app/api/projects/[projectId]/units/route.ts"
copy "app/api/projects/[projectId]/sheets/[sheetSlug]/route.ts"
copy "app/api/projects/[projectId]/state/[key]/route.ts"
copy "app/api/projects/[projectId]/progress/route.ts"

# Lib — project init + manifest
copy "lib/project-state/project-initialize-pipeline.ts"
copy "lib/project-state/share-project-state-handlers.ts"
copy "lib/project-state/manifest-enrichment.ts"
copy "lib/project-state/manifest-layout-utils.ts"
copy "lib/project-state/manifest-assignment-summaries.ts"
copy "lib/project-state/layout-pages-manifest-summary.ts"
copy "lib/project-state/schema-generators.ts"
copy "lib/project-state/unit-type-grouping.ts"
copy "lib/project-state/share-project-units-handlers.ts"
copy "lib/project-state/share-print-schema-handlers.ts"
copy "lib/project-units/types.ts"
copy "lib/project-units/icon-resolver.ts"
copy "lib/manifest"
copy "lib/workspace"
copy "lib/runtime"
copy "lib/storage"
copy "lib/session"
copy "lib/permissions"
copy "lib/utils.ts"

# ─────────────────────────────────────────────────────────────────────────────
# LEGAL UPLOAD
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[5/9] Legal upload"

# Components
copy "components/projects/project-upload-flow.tsx"
copy "components/projects/project-upload-card.tsx"
copy "components/projects/unified-upload-card.tsx"
copy "components/projects/simple-project-upload.tsx"
copy "components/projects/layout-pdf-upload-card.tsx"

# API routes — revisions + legal-drawings
copy "app/api/projects/revisions/route.ts"
copy "app/api/projects/revisions/[projectId]/route.ts"
copy "app/api/projects/revisions/[projectId]/files/route.ts"
copy "app/api/projects/revisions/[projectId]/files/[filename]/route.ts"
copy "app/api/projects/revisions/generate/route.ts"
copy "app/api/projects/revisions/file/route.ts"
copy "app/api/legal-drawings/route.ts"
copy "app/api/legal-drawings/[pdNumber]/route.ts"
copy "app/api/legal-drawings/[pdNumber]/rebuild/route.ts"
copy "app/api/legal-drawings/[pdNumber]/layout-pdf/route.ts"
copy "app/api/legal-drawings/[pdNumber]/restore-root-sources/route.ts"
copy "app/api/legal-drawings/[pdNumber]/clear-generated/route.ts"
copy "app/api/legal-drawings/instantiate/route.ts"
copy "app/api/legal-drawings/sync/route.ts"
copy "app/api/legal-drawings/workspace/route.ts"

# Lib
copy "lib/legal-drawings/library.ts"
copy "lib/legal-drawings/discovery.ts"
copy "lib/legal-drawings/admin.ts"
copy "lib/revision"
copy "lib/workbook/upload-props.ts"

# ─────────────────────────────────────────────────────────────────────────────
# PRINT MODAL + WIRE LIST RENDERING (print-modal.tsx and its direct deps)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[6/9] Print modal + wire list rendering"

# The modal itself
copy "components/wire-list/print-modal.tsx"
copy "components/wire-list/print-preview-blocks.tsx"
copy "components/wire-list/print-feedback/index.tsx"
copy "components/wire-list/semantic-wire-list.tsx"
copy "components/wire-list/semantic-wire-list-table.tsx"
copy "components/wire-list/semantic-wire-list-toolbar.tsx"
copy "components/wire-list/semantic-wire-list-shell.tsx"
copy "components/wire-list/semantic-wire-list-with-sidebar.tsx"
copy "components/wire-list/wire-list.tsx"
copy "components/wire-list/wire-list-table.tsx"
copy "components/wire-list/wire-list-toolbar.tsx"
copy "components/wire-list/wire-list-page-header.tsx"
copy "components/wire-list/wire-list-layout-preview.tsx"
copy "components/wire-list/wire-list-grounds-section.tsx"
copy "components/wire-list/wire-list-empty-state.tsx"
copy "components/wire-list/wire-list-floating-toolbar.tsx"
copy "components/wire-list/wire-list-column-picker.tsx"
copy "components/wire-list/wire-list-location-tabs.tsx"
copy "components/wire-list/wire-list-review-table.tsx"
copy "components/wire-list/wire-list-schema-view.tsx"
copy "components/wire-list/wire-no-search.tsx"
copy "components/wire-list/wire-type-badge.tsx"
copy "components/wire-list/project-information-banner.tsx"
copy "components/wire-list/project-sheet-subheader.tsx"
copy "components/wire-list/sheet-metadata-panel.tsx"
copy "components/wire-list/floating-layout-reference-window.tsx"
copy "components/wire-list/full-screen-search.tsx"
copy "components/wire-list/gauge-filter-dropdown.tsx"
copy "components/wire-list/prefix-filter-dropdown.tsx"
copy "components/wire-list/identification-filter-dropdown.tsx"
copy "components/wire-list/multi-identity-filter.tsx"
copy "components/wire-list/draggable-column-header.tsx"
copy "components/wire-list/relay-plugin-jumper-runs.tsx"
copy "components/wire-list/wiring-execution-mode.tsx"
copy "components/wire-list/wiring-stage-content.tsx"
copy "components/wire-list/brand-list-editor-table.tsx"
copy "components/wire-list/brand-list-review-cover-page.tsx"
copy "components/wire-list/brand-row-measurement-dialog.tsx"

# Cells
copy_dir "components/wire-list/cells"

# Sections
copy_dir "components/wire-list/sections"

# Device component (used by print-modal)
copy_dir "components/device"

# Lib — wiring identification (all used by print-modal)
copy_dir "lib/wiring-identification"

# Lib — wire list print engine
copy_dir "lib/wire-list-print"

# Lib — wire list sections
copy_dir "lib/wire-list-sections"

# Lib — wire list sheet document
copy_dir "lib/wire-list-sheet-document"

# Lib — wire list feedback
copy_dir "lib/wire-list-feedback"

# Lib — workbook
copy_dir "lib/workbook"

# Lib — part number list
copy_dir "lib/part-number-list"

# Lib — assignment (SWS type detection used by print-modal)
copy_dir "lib/assignment"

# Lib — persistence (project-storage)
copy_dir "lib/persistence"

# Lib — wire images
copy_dir "lib/wire-images"

# Lib — wiring domain / ordering
copy_dir "lib/wiring-domain"
copy_dir "lib/wiring-ordering"

# Lib — row patches
copy_dir "lib/row-patches"

# Lib — print
copy_dir "lib/print"

# Hooks used by print-modal
copy "hooks/use-multi-identity-filter.ts"
copy "hooks/use-identification-filter.ts"
copy "hooks/use-branding-sheet.ts"

# ─────────────────────────────────────────────────────────────────────────────
# WIRE LIST EXPORT (PDF download per sheet + all)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[7/9] Wire list export API"

copy "app/api/projects/[projectId]/wire-list-pdf/[sheetSlug]/route.ts"
copy "app/api/projects/[projectId]/wire-list-pdf/download-all/route.ts"
copy "app/api/projects/[projectId]/wire-list-print-schemas/route.ts"
copy "app/api/projects/[projectId]/wire-list-green-changes/route.ts"
copy "app/api/projects/[projectId]/exports/route.ts"
copy "app/api/projects/[projectId]/exports/files/[...segments]/route.ts"

copy "lib/project-exports/render-wire-list-pdf.ts"
copy "lib/project-exports/wire-list-pdf-exports.ts"
copy "lib/project-exports/generate-print-schemas.ts"
copy "lib/project-exports/multi-sheet-print-exports.ts"
copy "lib/project-exports/project-exports-paths.ts"
copy "lib/project-exports/cross-wire-schema.ts"
copy "lib/green-changes"

# ─────────────────────────────────────────────────────────────────────────────
# BRAND LIST EXPORT (per sheet + merged)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[8/9] Brand list export API"

copy "app/api/projects/[projectId]/wire-brand-list-schemas/route.ts"

copy "lib/wire-brand-list/schema.ts"
copy "lib/wire-brand-list/multi-sheet-review.ts"
copy "lib/wire-brand-list/import-workbook.ts"

copy_dir "lib/branding-list"

copy "lib/project-exports/branding-xlsx-workbook.ts"
copy "lib/project-exports/branding-workbook-helpers.ts"
copy "lib/project-exports/branding-csv-exports.ts"
copy "lib/project-exports/branding-filename.ts"

# ─────────────────────────────────────────────────────────────────────────────
# SHARED INFRA
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[9/9] Shared infra"

copy_dir "lib/services"
copy_dir "lib/data-loader"
copy_dir "lib/diagnostics"
copy_dir "lib/catalog"
copy_dir "lib/parts"
copy_dir "lib/device"
copy_dir "lib/device-details"
copy_dir "lib/layout-matching"
copy_dir "lib/users"
copy_dir "lib/user-settings"
copy_dir "lib/theme"
copy "lib/utils.ts"

# Cache dir (runtime config)
copy "cache/runtime-settings.json"

echo ""
echo "✓ Done. Review the destination for any missing transitive imports."
echo "  Run: cd '$DEST' && pnpm install && pnpm tsc --noEmit"
echo ""
