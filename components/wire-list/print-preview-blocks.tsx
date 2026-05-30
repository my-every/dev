"use client";

import { FileText } from "lucide-react";

import { SectionHeaderBlock } from "@/components/wire-list/sections";
import type { BrandingVisibleSection, VisiblePreviewSection } from "@/lib/wire-list-print/model";

interface BrandingPreviewContentProps {
  sections: BrandingVisibleSection[];
  renderSection: (section: BrandingVisibleSection) => React.ReactNode;
}

export function BrandingPreviewContent({
  sections,
  renderSection,
}: BrandingPreviewContentProps) {
  return (
    <>
      {sections.length > 0 ? (
        sections.map((section, index) => (
          <div
            key={`${section.group.location}-${section.subsection.label}-${index}`}
            className={index > 0 ? "mt-5" : ""}
          >
            <SectionHeaderBlock
              title={`${section.group.location} - ${section.subsection.label}`}
              count={section.rows.length}
              className="mb-2 border-b border-foreground/10 pb-2"
            />
            {renderSection(section)}
          </div>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="mb-4 h-12 w-12 opacity-50" />
          <p className="text-sm">No branding sections visible</p>
          <p className="mt-1 text-xs">Use the section controls to unhide the sections you want to edit.</p>
        </div>
      )}
    </>
  );
}

interface StandardPreviewBodyProps {
  visibleSections: VisiblePreviewSection[];
  renderSection: (section: VisiblePreviewSection) => React.ReactNode;
}

export function StandardPreviewBody({
  visibleSections,
  renderSection,
}: StandardPreviewBodyProps) {
  return (
    <>
      {visibleSections.length > 0 ? (
        visibleSections.map((section, index) => {
          // Determine if we should show the location header
          // Only show it for the first section of each unique location
          const previousSection = index > 0 ? visibleSections[index - 1] : null;
          const showLocationHeader = 
            index === 0 || 
            !previousSection ||
            previousSection.group.location !== section.group.location;
          
          return (
            <div
              key={`${section.group.location}-${section.subsection.label}-${index}`}
              className={`location-group ${index > 0 ? "mt-6 pt-4 border-t border-foreground/20" : ""}`}
            >
              {showLocationHeader && (
                <SectionHeaderBlock
                  title={section.group.location}
                  subtitle="Location:"
                  subtitleFirst
                  className="mb-3 border-b border-foreground/10 pb-2"
                  titleClassName="text-[13px] font-bold text-foreground"
                  subtitleClassName="text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                />
              )}

              <div className="section-wrapper">
                <SectionHeaderBlock
                  title={section.subsection.label}
                  count={section.visibleRows.length > 0 ? section.visibleRows.length : undefined}
                />
                {renderSection(section)}
              </div>
            </div>
          );
        })
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-sm">No rows to display</p>
          <p className="text-xs mt-1">Adjust your filter settings or switch to Standardize mode</p>
        </div>
      )}
    </>
  );
}

interface WireListPreviewEmptyStateProps {
  title: string;
  description: string;
}

export function WireListPreviewEmptyState({
  title,
  description,
}: WireListPreviewEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <FileText className="mb-4 h-12 w-12 opacity-50" />
      <p className="text-sm">{title}</p>
      <p className="mt-1 text-xs">{description}</p>
    </div>
  );
}

interface StandardWireListPreviewDocumentProps {
  visibleSections: VisiblePreviewSection[];
  renderPage: (content: React.ReactNode) => React.ReactNode;
  renderSection: (section: VisiblePreviewSection) => React.ReactNode;
  renderEmptyState?: () => React.ReactNode;
}

export function StandardWireListPreviewDocument({
  visibleSections,
  renderPage,
  renderSection,
  renderEmptyState,
}: StandardWireListPreviewDocumentProps) {
  return renderPage(
    visibleSections.length > 0 ? (
      <StandardPreviewBody visibleSections={visibleSections} renderSection={renderSection} />
    ) : (
      renderEmptyState?.() ?? (
        <WireListPreviewEmptyState
          title="No rows to display"
          description="Adjust your filter settings or switch to Standardize mode"
        />
      )
    ),
  );
}

interface CrossWirePreviewDocumentProps {
  visibleSections: VisiblePreviewSection[];
  renderCoverPage?: () => React.ReactNode;
  renderTableOfContentsPage?: () => React.ReactNode;
  renderPage: (content: React.ReactNode) => React.ReactNode;
  renderSection: (section: VisiblePreviewSection, index: number, showLocationHeader: boolean) => React.ReactNode;
  renderEmptyState?: () => React.ReactNode;
}

export function CrossWirePreviewDocument({
  visibleSections,
  renderCoverPage,
  renderTableOfContentsPage,
  renderPage,
  renderSection,
  renderEmptyState,
}: CrossWirePreviewDocumentProps) {
  return (
    <>
      {renderCoverPage?.()}
      {renderTableOfContentsPage?.()}
      {renderPage(
        visibleSections.length > 0 ? (
          <>
            {visibleSections.map((section, index) => {
              const previousSection = index > 0 ? visibleSections[index - 1] : null;
              const showLocationHeader =
                index === 0 ||
                !previousSection ||
                previousSection.group.location !== section.group.location;

              return renderSection(section, index, showLocationHeader);
            })}
          </>
        ) : (
          renderEmptyState?.() ?? (
            <WireListPreviewEmptyState
              title="No cross-wire rows to display"
              description="Move an external section into CrossWire to build the alternate printout."
            />
          )
        ),
      )}
    </>
  );
}

interface StandardWorkspacePreviewProps {
  enabled: boolean;
  showCoverPage: boolean;
  showTableOfContents: boolean;
  showIPVCodes: boolean;
  showIPVWireList: boolean;
  showFeedbackSection: boolean;
  hasVisibleSections: boolean;
  renderCoverPage: () => React.ReactNode;
  renderTableOfContentsPage: () => React.ReactNode;
  renderIpvCodesPage: () => React.ReactNode;
  renderPreviewDocument: () => React.ReactNode;
  renderFeedbackPage: () => React.ReactNode;
  renderIPVCoverPage: () => React.ReactNode;
  renderIPVReferencePage: () => React.ReactNode;
  renderIPVWireListPage: () => React.ReactNode;
}

export function StandardWorkspacePreviewDocument({
  enabled,
  showCoverPage,
  showTableOfContents,
  showIPVCodes,
  showIPVWireList,
  showFeedbackSection,
  hasVisibleSections,
  renderCoverPage,
  renderTableOfContentsPage,
  renderIpvCodesPage,
  renderPreviewDocument,
  renderFeedbackPage,
  renderIPVCoverPage,
  renderIPVReferencePage,
  renderIPVWireListPage,
}: StandardWorkspacePreviewProps) {
  if (!enabled) {
    return null;
  }

  return (
    <>
      {showCoverPage ? renderCoverPage() : null}
      {showTableOfContents && hasVisibleSections ? renderTableOfContentsPage() : null}
      {showIPVCodes ? renderIpvCodesPage() : null}
      {renderPreviewDocument()}
      {showFeedbackSection ? renderFeedbackPage() : null}
      {showIPVWireList ? renderIPVCoverPage() : null}
      {showIPVWireList ? renderIPVReferencePage() : null}
      {showIPVWireList ? renderIPVWireListPage() : null}
    </>
  );
}

interface CrossWireWorkspacePreviewProps {
  enabled: boolean;
  renderPreviewDocument: () => React.ReactNode;
}

export function CrossWireWorkspacePreviewDocument({
  enabled,
  renderPreviewDocument,
}: CrossWireWorkspacePreviewProps) {
  if (!enabled) {
    return null;
  }

  return <>{renderPreviewDocument()}</>;
}
