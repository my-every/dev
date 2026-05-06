"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home } from "lucide-react";

import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbSegment = {
    label: string;
    href: string;
};

function formatSegmentLabel(segment: string): string {
    return segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function generateBreadcrumbs(pathname: string): BreadcrumbSegment[] {
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length === 0) {
        return [];
    }

    const breadcrumbs: BreadcrumbSegment[] = [];
    let currentPath = "";

    segments.forEach((segment, index) => {
        currentPath += `/${segment}`;
        const isLast = index === segments.length - 1;

        breadcrumbs.push({
            label: formatSegmentLabel(segment),
            href: isLast ? "" : currentPath,
        });
    });

    return breadcrumbs;
}

export function DynamicBreadcrumb() {
    const pathname = usePathname();
    const breadcrumbs = generateBreadcrumbs(pathname);

    if (breadcrumbs.length === 0) {
        return null;
    }

    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href="/" className="inline-flex items-center gap-1">
                            <Home className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Home</span>
                        </Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>

                {breadcrumbs.map((breadcrumb, index) => (
                    <div key={`${breadcrumb.label}-${index}`} className="flex items-center gap-1.5">
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            {breadcrumb.href ? (
                                <BreadcrumbLink asChild>
                                    <Link href={breadcrumb.href}>
                                        {breadcrumb.label}
                                    </Link>
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                    </div>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
