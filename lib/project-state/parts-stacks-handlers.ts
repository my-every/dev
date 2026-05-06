import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveShareDirectorySync } from "@/lib/runtime/share-directory";
import type { PartStack, PartStacksManifest } from "@/types/parts-library";

function getStacksDir(): string {
    return path.join(resolveShareDirectorySync(), "parts", "stacks");
}

function getStacksManifestPath(): string {
    return path.join(getStacksDir(), "manifest.json");
}

function getStackFilePath(stackId: string): string {
    const safeId = stackId.replace(/[/\\:*?"<>|]/g, "_");
    return path.join(getStacksDir(), `${safeId}.json`);
}

async function ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function createEmptyManifest(): PartStacksManifest {
    return {
        version: 1,
        updatedAt: new Date().toISOString(),
        totalStacks: 0,
        stacks: [],
    };
}

function sanitizeStack(stack: PartStack): PartStack {
    const now = new Date().toISOString();
    return {
        ...stack,
        description: stack.description?.trim() ?? "",
        category: stack.category ?? "mixed",
        type: stack.type ?? "mixed",
        useCases: Array.from(new Set(stack.useCases ?? [])),
        tags: Array.from(new Set((stack.tags ?? []).map((tag) => tag.trim()).filter(Boolean))),
        items: [...(stack.items ?? [])]
            .map((item, index) => ({
                id: item.id,
                partNumber: item.partNumber.trim(),
                category: item.category,
                type: item.type,
                quantity: item.quantity ?? 1,
                sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index,
                role: item.role ?? "optional",
                notes: item.notes?.trim() ?? "",
                config: item.config ?? {},
            }))
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((item, index) => ({ ...item, sortOrder: index })),
        source: stack.source ?? "manual",
        createdAt: stack.createdAt ?? now,
        updatedAt: now,
        createdBy: stack.createdBy,
        updatedBy: stack.updatedBy,
    };
}

async function updateManifestFromFiles(): Promise<PartStacksManifest> {
    await ensureDir(getStacksDir());
    const entries = await fs.readdir(getStacksDir(), { withFileTypes: true }).catch(() => []);
    const stacks: PartStacksManifest["stacks"] = [];

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json") || entry.name === "manifest.json") {
            continue;
        }

        const stack = await readJsonFile<PartStack | null>(path.join(getStacksDir(), entry.name), null);
        if (!stack) {
            continue;
        }

        stacks.push({
            id: stack.id,
            name: stack.name,
            category: stack.category,
            type: stack.type,
            useCases: stack.useCases ?? [],
            itemCount: stack.items?.length ?? 0,
            updatedAt: stack.updatedAt,
        });
    }

    const manifest: PartStacksManifest = {
        version: 1,
        updatedAt: new Date().toISOString(),
        totalStacks: stacks.length,
        stacks: stacks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    };

    await writeJsonFile(getStacksManifestPath(), manifest);
    return manifest;
}

export async function getPartStacksManifest(): Promise<PartStacksManifest> {
    return readJsonFile(getStacksManifestPath(), createEmptyManifest());
}

export async function listPartStacks(query?: string): Promise<PartStack[]> {
    const manifest = await updateManifestFromFiles();
    const files = await Promise.all(
        manifest.stacks.map((entry) => readJsonFile<PartStack | null>(getStackFilePath(entry.id), null)),
    );

    const normalizedQuery = query?.trim().toUpperCase();
    const stacks = files.filter(Boolean) as PartStack[];
    if (!normalizedQuery) {
        return stacks;
    }

    return stacks.filter((stack) => {
        const haystack = [
            stack.name,
            stack.description,
            ...(stack.tags ?? []),
            ...(stack.useCases ?? []),
            ...stack.items.map((item) => item.partNumber),
        ]
            .filter(Boolean)
            .join(" ")
            .toUpperCase();

        return haystack.includes(normalizedQuery);
    });
}

export async function getPartStack(stackId: string): Promise<PartStack | null> {
    return readJsonFile<PartStack | null>(getStackFilePath(stackId), null);
}

export async function createPartStack(input: PartStack): Promise<PartStack> {
    const stack = sanitizeStack(input);
    await writeJsonFile(getStackFilePath(stack.id), stack);
    await updateManifestFromFiles();
    return stack;
}

export async function updatePartStack(input: PartStack): Promise<PartStack> {
    const existing = await getPartStack(input.id);
    if (!existing) {
        throw new Error(`Stack ${input.id} not found`);
    }

    const next = sanitizeStack({
        ...existing,
        ...input,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
    });

    await writeJsonFile(getStackFilePath(next.id), next);
    await updateManifestFromFiles();
    return next;
}

export async function deletePartStack(stackId: string): Promise<boolean> {
    try {
        await fs.unlink(getStackFilePath(stackId));
        await updateManifestFromFiles();
        return true;
    } catch {
        return false;
    }
}
