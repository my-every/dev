import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const LAYOUT_AGGREGATES_PATH = path.join(
  process.cwd(),
  "Share",
  "References",
  "layout-pages-aggregates-reference.json"
);

interface AggregateEntry {
  value: string;
  projectCount: number;
}

interface LayoutAggregates {
  aggregates: {
    unitTypes: AggregateEntry[];
  };
}

export async function GET() {
  try {
    const content = await fs.readFile(LAYOUT_AGGREGATES_PATH, "utf-8");
    const data = JSON.parse(content) as LayoutAggregates;
    
    // Extract just the unit type values, sorted by project count (most used first)
    const unitTypes = data.aggregates.unitTypes
      .sort((a, b) => b.projectCount - a.projectCount)
      .map((entry) => entry.value);
    
    return NextResponse.json({ unitTypes });
  } catch (error) {
    console.error("Failed to read layout aggregates reference:", error);
    // Return a fallback list of common unit types
    return NextResponse.json({
      unitTypes: [
        "JB70",
        "JB5",
        "JB352",
        "JB73",
        "2BAY",
        "JB74",
        "JB1123",
        "JB72",
        "CONSOLE",
        "JB4",
        "JB75",
        "JB130",
        "JB500",
      ],
    });
  }
}
