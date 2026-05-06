import { caseStudiesByProduct, type Product } from "@/lib/case-studies/case-studies";
import type { TrainingModuleV2 } from "@/types/training";

export type TrainingResourceSource = "case-study" | "link" | "document";

export interface TrainingResourceItem {
  id: string;
  title: string;
  url: string;
  source: TrainingResourceSource;
  tags: string[];
  product?: Product;
}

export interface TrainingResourceCategory {
  id: string;
  label: string;
  description?: string;
  managedByTraining: boolean;
  items: TrainingResourceItem[];
}

export interface TrainingModuleResourceBinding {
  moduleId: string;
  categoryIds: string[];
  resourceItemIds: string[];
}

const CASE_STUDY_CATEGORY_ID = "case-studies";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createCaseStudyItem(product: Product, name: string, url: string): TrainingResourceItem {
  return {
    id: `case-study-${slugify(product)}-${slugify(name)}`,
    title: name.trim(),
    url: url.trim(),
    source: "case-study",
    tags: ["case-study", product],
    product,
  };
}

export function buildCaseStudyResourceCategory(): TrainingResourceCategory {
  const items: TrainingResourceItem[] = [];

  for (const [product, studies] of Object.entries(caseStudiesByProduct) as Array<[Product, Array<{ name: string; url: string }>]>) {
    for (const study of studies) {
      if (!study?.name || !study?.url) continue;
      items.push(createCaseStudyItem(product, study.name, study.url));
    }
  }

  const deduped = Array.from(
    new Map(items.map((item) => [item.id, item])).values(),
  ).sort((a, b) => a.title.localeCompare(b.title));

  return {
    id: CASE_STUDY_CATEGORY_ID,
    label: "Case Studies",
    description: "Solar Turbines product case studies curated for training modules.",
    managedByTraining: true,
    items: deduped,
  };
}

export function buildDefaultTrainingResourceCategories(): TrainingResourceCategory[] {
  return [buildCaseStudyResourceCategory()];
}

export function createTrainingModuleResourceBinding(
  module: Pick<TrainingModuleV2, "id" | "tags" | "partNumbers">,
): TrainingModuleResourceBinding {
  const categories = buildDefaultTrainingResourceCategories();
  const categoryIds = categories.map((category) => category.id);

  const normalizedTokens = new Set<string>(
    [...(module.tags ?? []), ...(module.partNumbers ?? [])]
      .map((value) => value.toLowerCase().trim())
      .filter(Boolean),
  );

  const caseStudyItems = categories.find((entry) => entry.id === CASE_STUDY_CATEGORY_ID)?.items ?? [];
  const matched = caseStudyItems.filter((item) => {
    if (!item.product) return false;
    const productToken = item.product.toLowerCase();
    return normalizedTokens.has(productToken) || normalizedTokens.has(productToken.replace(/\s+/g, "-"));
  });

  return {
    moduleId: module.id,
    categoryIds,
    resourceItemIds: matched.map((item) => item.id),
  };
}

export function filterResourceItems(
  categories: TrainingResourceCategory[],
  query: string,
): TrainingResourceItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return categories.flatMap((category) => category.items);
  }

  return categories
    .flatMap((category) => category.items)
    .filter((item) => {
      const haystack = `${item.title} ${item.product ?? ""} ${item.tags.join(" ")}`.toLowerCase();
      return haystack.includes(normalized);
    });
}
