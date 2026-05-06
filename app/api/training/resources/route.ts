import { NextRequest, NextResponse } from "next/server";

import {
  buildDefaultTrainingResourceCategories,
  createTrainingModuleResourceBinding,
  filterResourceItems,
} from "@/lib/training/training-resource-categories";
import { TRAINING_MODULE_SEEDS_380_V2 } from "@/components/training/training-module-seeds-380";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const moduleId = searchParams.get("moduleId");
  const query = searchParams.get("query") ?? "";

  const categories = buildDefaultTrainingResourceCategories();
  const items = filterResourceItems(categories, query);

  if (!moduleId) {
    return NextResponse.json({
      categories,
      items,
      total: items.length,
    });
  }

  const module = TRAINING_MODULE_SEEDS_380_V2.find((entry) => entry.module.id === moduleId)?.module;
  if (!module) {
    return NextResponse.json(
      { error: `Training module not found for moduleId: ${moduleId}` },
      { status: 404 },
    );
  }

  const binding = createTrainingModuleResourceBinding({
    id: module.id,
    tags: module.tags,
    partNumbers: module.partNumbers,
  });

  return NextResponse.json({
    categories,
    items,
    total: items.length,
    binding,
  });
}
