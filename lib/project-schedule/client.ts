import type {
  ProjectScheduleActualsDocument,
  ProjectScheduleActualsPatchRequest,
  ProjectScheduleActualsRecord,
  ProjectScheduleComparisonDocument,
} from "@/lib/project-schedule/types";

interface ProjectScheduleActualsPatchResponse {
  success: boolean;
  record: ProjectScheduleActualsRecord;
  documentUpdatedAt: string;
  writes: {
    actualsFile: string;
  };
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => ({ error: fallbackMessage })) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

export async function fetchProjectScheduleComparison(): Promise<ProjectScheduleComparisonDocument> {
  const response = await fetch("/api/schedule/project-schedule/compare", {
    cache: "no-store",
  });

  return parseJsonResponse<ProjectScheduleComparisonDocument>(
    response,
    "Failed to load project schedule comparison",
  );
}

export async function fetchProjectScheduleActuals(): Promise<ProjectScheduleActualsDocument> {
  const response = await fetch("/api/schedule/project-schedule/metrics", {
    cache: "no-store",
  });

  return parseJsonResponse<ProjectScheduleActualsDocument>(
    response,
    "Failed to load project schedule actuals",
  );
}

export async function patchProjectScheduleActuals(
  body: ProjectScheduleActualsPatchRequest,
): Promise<ProjectScheduleActualsPatchResponse> {
  const response = await fetch("/api/schedule/project-schedule/metrics", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse<ProjectScheduleActualsPatchResponse>(
    response,
    "Failed to update project schedule actuals",
  );
}
