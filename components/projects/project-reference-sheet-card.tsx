"use client";

import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { Book } from "@/components/ui/book";
import type { ProjectSheetSummary } from "@/lib/workbook/types";
import { getSheetRoutePath } from "@/hooks/use-sheet-route";

interface ProjectReferenceSheetCardProps {
  sheet: ProjectSheetSummary;
  projectId: string;
  index: number;
}

// White and black color scheme for all reference cards
function getReferenceBookColor(sheetName: string): { bg: string; text: string; iconBg: string } {
  const normalized = sheetName.toLowerCase();

  // Alternate between white and black based on name hash for visual variety
  const hash = normalized.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isLight = hash % 2 === 0;

  if (isLight) {
    // White/light card
    return {
      bg: "#FAFAFA",
      text: "#1a1a1a",
      iconBg: "rgba(0,0,0,0.05)"
    };
  } else {
    // Black/dark card
    return {
      bg: "#1a1a1a",
      text: "#ffffff",
      iconBg: "rgba(255,255,255,0.1)"
    };
  }
}

export function ProjectReferenceSheetCard({ sheet, projectId, index }: ProjectReferenceSheetCardProps) {
  const routePath = getSheetRoutePath(projectId, sheet.slug);
  const displayName = sheet.name.toUpperCase();
  const colorScheme = getReferenceBookColor(sheet.name);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="flex justify-center sm:justify-start"
    >
      <Book
        title={displayName}
        href={routePath}
        disabled={!sheet.hasData}
        ariaLabel={`Open reference sheet ${sheet.name}`}
        variant="stripe"
        width={{ sm: 170, md: 190, lg: 196, xl: 208 }}
        className="w-full"
        color={colorScheme.bg}
        textColor={colorScheme.text}
        backColor={colorScheme.bg}
        spineColor={colorScheme.bg}
        titleClassName="line-clamp-2 min-h-[2.6em]"
        illustration={
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ 
              backgroundColor: colorScheme.iconBg,
              width: '40px',
              height: '40px'
            }}
          >
            <BookOpen
              className="h-5 w-5"
              strokeWidth={1.75}
              style={{ color: colorScheme.text }}
            />
          </div>
        }
        subtitle="Reference sheet"
        footer={
          <div className="space-y-2" style={{ color: colorScheme.text }}>
            {/* Removed column badges - just show footer action */}
            <div
              className="flex items-center justify-between pt-[2.6cqw] text-[4.5cqw] font-semibold tracking-[-0.02em]"
              style={{ borderTop: `1px solid ${colorScheme.text === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}` }}
            >
              <span>{sheet.hasData ? "Open List" : "No Data"}</span>
              <ArrowRight className="h-[4.8cqw] w-[4.8cqw]" />
            </div>
          </div>
        }
      />
    </motion.div>
  );
}
