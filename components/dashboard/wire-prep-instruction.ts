export interface WirePrepInstructionParts {
  safeCount: number;
  normalizedInstruction: string;
}

export function getWirePrepInstructionParts(instruction: string, count: number): WirePrepInstructionParts {
  const normalizedInstruction = String(instruction ?? "")
    .trim()
    .replace(/^prepare\s+\d+\s+/i, "")
    .replace(/^prepare\s+/i, "");

  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;

  return {
    safeCount,
    normalizedInstruction,
  };
}

export function formatWirePrepInstruction(instruction: string, count: number): string {
  const { safeCount, normalizedInstruction } = getWirePrepInstructionParts(instruction, count);

  if (!normalizedInstruction) {
    return `Prepare ${safeCount}`;
  }

  return `Prepare ${safeCount} ${normalizedInstruction}`;
}