import { cn } from "@/lib/utils";

interface SectionHeaderBlockProps {
  title: string;
  count?: number;
  subtitle?: string;
  subtitleFirst?: boolean;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export function SectionHeaderBlock({
  title,
  count,
  subtitle,
  subtitleFirst = false,
  className,
  titleClassName,
  subtitleClassName,
}: SectionHeaderBlockProps) {
  return (
    <div className={cn("mb-2", className)}>
      {subtitle && subtitleFirst ? (
        <p className={cn("text-[11px] text-muted-foreground", subtitleClassName)}>{subtitle}</p>
      ) : null}
      <h3 className={cn("text-[13px] font-semibold text-foreground", titleClassName)}>
        {title}
        {typeof count === "number" && (
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">({count})</span>
        )}
      </h3>
      {subtitle && !subtitleFirst ? (
        <p className={cn("text-[11px] text-muted-foreground", subtitleClassName)}>{subtitle}</p>
      ) : null}
    </div>
  );
}