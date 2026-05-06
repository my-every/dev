/**
 * Device Details Aside - Right-side panel showing device information.
 * Opens when a device ID cell in the wire list is clicked.
 */

"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DeviceDetails, TerminationGuideProps } from "@/lib/device-details/types";
import { getDeviceFamily } from "@/lib/device-details/utils";
import { DeviceProperty } from "@/components/device/device-property";
import { IOModuleTerminationGuide } from "./io-module-guide";

interface DeviceDetailsAsideProps {
  isOpen: boolean;
  deviceDetails: DeviceDetails | null;
  onClose: () => void;
  onTerminalClick?: (terminal: string) => void;
}

/**
 * Maps device families to their termination guide components.
 */
const GUIDE_REGISTRY: Record<string, React.ComponentType<TerminationGuideProps>> = {
  "i-o-module": IOModuleTerminationGuide,
  // Future guides: relay, fuse, terminal-block, etc.
};

export function DeviceDetailsAside({
  isOpen,
  deviceDetails,
  onClose,
  onTerminalClick,
}: DeviceDetailsAsideProps) {
  const isMobile = useIsMobile();
  const [expandedSection, setExpandedSection] = useState<string | null>("parts");
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null);

  const parsedId = deviceDetails?.parsedId;
  const partInfo = deviceDetails?.partInfo ?? null;
  const terminations = deviceDetails?.terminations ?? [];
  const usedTerminals = deviceDetails?.usedTerminals ?? new Set<string>();
  const usedTerminalList = deviceDetails?.usedTerminalList ?? [];
  const partNumbers = partInfo?.partNumbers ?? [];
  const family = parsedId ? getDeviceFamily(parsedId.baseId) : "other";
  const GuideComponent = GUIDE_REGISTRY[family] || null;

  useEffect(() => {
    setSelectedTerminal(null);
  }, [parsedId?.baseId]);

  const handleTerminalClick = (terminal: string) => {
    setSelectedTerminal((current) => (current === terminal ? null : terminal));
  };

  const guideProps: TerminationGuideProps = {
    deviceId: parsedId?.baseId ?? "",
    description: partInfo?.description || "No information found",
    terminations,
    usedTerminals,
    usedTerminalList,
    partNumbers,
    selectedTerminal,
    onTerminalClick: onTerminalClick ?? handleTerminalClick,
  };

  if (!deviceDetails || !parsedId) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        onInteractOutside={onClose}
        className={isMobile
          ? "h-[94vh] rounded-t-[28px] border-t border-border px-0 pb-0"
          : "h-screen w-[min(98vw,1400px)] min-w-[72vw] border-l px-0"
        }
      >
        {isMobile ? (
          <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-muted-foreground/25" />
        ) : null}

        <SheetHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5 sm:px-6">
          <div className="pr-10">
            <Badge className="mb-2">{parsedId.baseId}</Badge>
            <SheetTitle className="text-left text-2xl font-semibold leading-tight text-pretty">
              {partInfo?.description || "Device not found in Part Number List"}
            </SheetTitle>
            {!partInfo && (
              <p className="mt-2 text-xs text-muted-foreground">
                Add this device to your Part Number List sheet to view details.
              </p>
            )}
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-5 sm:space-y-8 sm:p-6 lg:p-8">
            {GuideComponent && (
              <div className="space-y-4 rounded-4xl border border-border/60 bg-muted/10 p-4 sm:p-5 lg:p-6">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold tracking-tight">Termination Guide</h2>
                  <p className="text-sm text-muted-foreground">
                    Default view is optimized to keep the full I/O guide visible.
                  </p>
                </div>
                <GuideComponent {...guideProps} />
              </div>
            )}

            {partInfo && partNumbers.length > 0 && (
              <Section title="Reference Images" defaultExpanded>
                <DeviceProperty
                  type="referenceImageCarousel"
                  pn={partNumbers}
                  preferredDescription={partInfo.description}
                  fallback={<p className="text-sm text-muted-foreground">No reference images found</p>}
                />
              </Section>
            )}

                {/* Part Numbers */}
                {partInfo && (
                  <Section
                    title="Part Numbers"
                    isExpanded={expandedSection === "parts"}
                    onToggle={() =>
                      setExpandedSection(expandedSection === "parts" ? null : "parts")
                    }
                  >
                    {partInfo.partNumbers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {partInfo.partNumbers.map((pn, i) => (
                          <Badge key={i} variant="secondary" className="font-mono text-xs">
                            {pn}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No part numbers found</p>
                    )}
                  </Section>
                )}

                {/* Location */}
                {partInfo?.location && (
                  <Section title="Location" defaultExpanded>
                    <p className="text-sm text-muted-foreground">{partInfo.location}</p>
                  </Section>
                )}

            </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Collapsible section component.
 */
interface SectionProps {
  title: string;
  children: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
  defaultExpanded?: boolean;
}

function Section({
  title,
  children,
  isExpanded: controlledExpanded,
  onToggle,
  defaultExpanded = false,
}: SectionProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  return (
    <div className="space-y-3 rounded-3xl border border-border/50 bg-background/60 p-3 sm:p-4">
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-medium transition-colors hover:bg-muted"
      >
        <span>{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      {isExpanded && <div className="px-2 pb-1 pt-1">{children}</div>}
    </div>
  );
}
