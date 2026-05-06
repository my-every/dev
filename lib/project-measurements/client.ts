interface ReuseMeasurementsRequest {
  sourceSheetSlug?: string;
  targetSheetSlugs: string[];
  mode?: "branding" | "wire-list" | "both";
}

interface ReuseMeasurementsResponse {
  success: boolean;
  projectId: string;
  sourceSheetSlug: string;
  sourceInferenceUsed?: boolean;
  confidence?: "high" | "medium" | "low" | "none";
  reason?: string;
  targetSheetSlugs: string[];
  mode: "branding" | "wire-list" | "both";
  results: Array<{
    sheetSlug: string;
    brandingRowsCopied?: number;
    wireListRowsCopied?: number;
  }>;
  guidance?: string;
}

interface ResolveMeasurementSourceResponse {
  success: boolean;
  projectId: string;
  sourceSheetSlug: string;
  sourceInferenceUsed: boolean;
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
  targetSheetSlugs: string[];
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({ error: fallbackMessage })) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

export async function reuseProjectMeasurements(
  projectId: string,
  body: ReuseMeasurementsRequest,
): Promise<ReuseMeasurementsResponse> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/measurements/reuse`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  return parseJsonResponse<ReuseMeasurementsResponse>(
    response,
    "Failed to reuse project measurements",
  );
}

export async function resolveProjectMeasurementSource(
  projectId: string,
  body: Pick<ReuseMeasurementsRequest, "sourceSheetSlug" | "targetSheetSlugs">,
): Promise<ResolveMeasurementSourceResponse> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/measurements/reuse/resolve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  return parseJsonResponse<ResolveMeasurementSourceResponse>(
    response,
    "Failed to resolve measurement source",
  );
}
