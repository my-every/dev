import { cn } from "@/lib/utils";

interface TableSubgroupHeaderRowProps {
  colSpan: number;
  label: string;
  tone?: "default" | "muted" | "warning";
  description?: string;
  rowClassName?: string;
  cellClassName?: string;
}

export function TableSubgroupHeaderRow({
  colSpan,
  label,
  tone = "muted",
  description,
  rowClassName,
  cellClassName,
}: TableSubgroupHeaderRowProps) {
  const toneRowClassName = tone === "warning"
    ? "bg-orange-50/70 border-t border-orange-300"
    : "bg-muted/40 border-t border-foreground/10";
  const toneCellClassName = tone === "warning"
    ? "bg-orange-50/70 border-x border-orange-300 px-2 py-1 text-[11px] font-semibold text-orange-900 tracking-wide"
    : "bg-muted/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground tracking-wide";

  return (
    <tr className={cn(toneRowClassName, rowClassName)}>
      <td
        colSpan={colSpan}
        className={cn(cellClassName, toneCellClassName)}
      >
        <div>{label}</div>
        {description ? <div className="mt-0.5 text-[10px] font-medium tracking-normal">{description}</div> : null}
      </td>
    </tr>
  );
}