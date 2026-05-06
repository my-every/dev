"use client";

/**
 * Relay Plugin Jumper Runs Display
 * 
 * Displays grouped relay plugin jumper runs as cards above the table.
 * Shows signal type, terminal, device count, and ordered device list.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RelayPluginJumperRun } from "@/lib/wiring-identification/types";
import { Zap, ArrowRight, Layers } from "lucide-react";

interface RelayPluginJumperRunsProps {
  runs: RelayPluginJumperRun[];
  className?: string;
}

/**
 * Get the color scheme for a signal type.
 */
function getSignalColor(signalType: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (signalType) {
    case "ESTOP":
      return {
        bg: "bg-red-500/10",
        text: "text-red-600",
        border: "border-red-500/30",
      };
    case "0V":
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-600",
        border: "border-blue-500/30",
      };
    default:
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        border: "border-foreground/20",
      };
  }
}

/**
 * Single run card component.
 */
function RunCard({ run }: { run: RelayPluginJumperRun }) {
  const colors = getSignalColor(run.signalType);
  
  return (
    <Card className={`${colors.bg} ${colors.border} border`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <span className={colors.text}>{run.signalType}</span>
            <span className="text-muted-foreground">/</span>
            <span>{run.terminal}</span>
          </CardTitle>
          <Badge variant="secondary" className="text-xs font-mono">
            {run.suggestedCutLengthLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3 px-4 space-y-2">
        {/* Device range */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-medium">{run.startDeviceId}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono font-medium">{run.endDeviceId}</span>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Layers className="h-3 w-3" />
            <span>{run.deviceCount} devices</span>
          </div>
          <div>
            <span>{run.segmentCount} segments</span>
          </div>
          {run.location && (
            <div className="truncate max-w-[150px]" title={run.location}>
              {run.location}
            </div>
          )}
        </div>
        
        {/* Ordered device list (collapsible for long lists) */}
        {run.orderedDevices.length <= 8 ? (
          <div className="text-xs font-mono text-muted-foreground">
            {run.orderedDevices.join(" → ")}
          </div>
        ) : (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show all {run.orderedDevices.length} devices
            </summary>
            <div className="mt-1 font-mono text-muted-foreground break-all">
              {run.orderedDevices.join(" → ")}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Display all relay plugin jumper runs.
 */
export function RelayPluginJumperRuns({ runs, className = "" }: RelayPluginJumperRunsProps) {
  // Group runs by terminal
  const { a1Runs, a2Runs } = useMemo(() => {
    return {
      a1Runs: runs.filter(r => r.terminal === "A1"),
      a2Runs: runs.filter(r => r.terminal === "A2"),
    };
  }, [runs]);
  
  if (runs.length === 0) {
    return null;
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-secondary-foreground" />
        <h3 className="text-sm font-semibold">Relay Plugin Jumpers</h3>
        <Badge variant="outline" className="text-xs">
          {runs.length} run{runs.length !== 1 ? "s" : ""}
        </Badge>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* A1/ESTOP runs first */}
        {a1Runs.map(run => (
          <RunCard key={run.id} run={run} />
        ))}
        
        {/* A2/0V runs */}
        {a2Runs.map(run => (
          <RunCard key={run.id} run={run} />
        ))}
      </div>
    </div>
  );
}
