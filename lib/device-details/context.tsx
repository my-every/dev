/**
 * Device Details Context - provides device details state and handlers.
 */

"use client";

import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useProjectContext } from "@/contexts/project-context";
import type { DeviceDetails } from "@/lib/device-details/types";
import { resolveDeviceDetails } from "@/lib/device-details/utils";
import { useProjectPartNumbers } from "@/hooks/use-project-lookups";
import type { SemanticWireListRow } from "@/lib/workbook/types";

interface DeviceDetailsContextType {
  selectedDeviceId: string | null;
  deviceDetails: DeviceDetails | null;
  isOpen: boolean;
  selectDevice: (deviceId: string, details: DeviceDetails) => void;
  openDeviceDetails: (deviceId: string) => void;
  closeDeviceDetails: () => void;
}

const DeviceDetailsContext = createContext<DeviceDetailsContextType | undefined>(undefined);

export function DeviceDetailsProvider({ children }: { children: React.ReactNode }) {
  const { currentProject } = useProjectContext();
  const { partNumberMap } = useProjectPartNumbers();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [deviceDetails, setDeviceDetails] = useState<DeviceDetails | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // In manifest architecture, semantic rows are loaded per-sheet, not globally.
  // Device details resolution currently works without global rows — the caller
  // provides device details directly via selectDevice.
  const semanticRows = useMemo<SemanticWireListRow[]>(() => [], []);

  // Part number data is now from the dedicated hook
  const partListData = null;

  const selectDevice = useCallback((deviceId: string, details: DeviceDetails) => {
    setSelectedDeviceId(deviceId);
    setDeviceDetails(details);
    setIsOpen(true);
  }, []);

  const openDeviceDetails = useCallback((deviceId: string) => {
    const details = resolveDeviceDetails(deviceId, semanticRows, partListData);
    if (!details) {
      return;
    }

    setSelectedDeviceId(deviceId);
    setDeviceDetails(details);
    setIsOpen(true);
  }, [partListData, semanticRows]);

  const closeDeviceDetails = useCallback(() => {
    setIsOpen(false);
    // Keep state for potential re-opening
  }, []);

  return (
    <DeviceDetailsContext.Provider
      value={{
        selectedDeviceId,
        deviceDetails,
        isOpen,
        selectDevice,
        openDeviceDetails,
        closeDeviceDetails,
      }}
    >
      {children}
    </DeviceDetailsContext.Provider>
  );
}

export function useDeviceDetailsContext() {
  const context = useContext(DeviceDetailsContext);
  if (!context) {
    throw new Error("useDeviceDetailsContext must be used within DeviceDetailsProvider");
  }
  return context;
}
