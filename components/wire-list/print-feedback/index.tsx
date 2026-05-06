"use client";

/**
 * Print Feedback Components
 * 
 * Reusable, print-ready feedback section components that can be appended
 * to wire list printouts. Designed for black-and-white printing with
 * clean table/form hybrid layouts.
 */

import { Fragment } from "react";
import type {
  WireListFeedbackFormValues,
  WireListFeedbackSection,
  WireListFeedbackBooleanOption,
  WireListFeedbackDifficulty,
  WireListFeedbackQualityRating,
  WireListFeedbackImprovementArea,
  PrintFeedbackConfig,
  FeedbackQuestion,
  CustomQuestionConfig,
} from "@/lib/wire-list-feedback/types";
import {
  BOOLEAN_OPTION_LABELS,
  DIFFICULTY_LABELS,
  QUALITY_RATING_LABELS,
  IMPROVEMENT_AREA_LABELS,
  FEEDBACK_SECTION_QUESTIONS,
  DEFAULT_WIRE_LIST_FEEDBACK_SECTIONS,
} from "@/lib/wire-list-feedback/types";

// ============================================================================
// Print Footer Component
// ============================================================================

interface PrintFooterProps {
  text?: string;
  className?: string;
}

export function PrintFooter({ text = "Caterpillar: Confidential Green", className = "" }: PrintFooterProps) {
  return (
    <div className={`print-footer text-center text-[9px] text-muted-foreground border-t pt-2 mt-4 ${className}`}>
      {text}
    </div>
  );
}

// ============================================================================
// Boolean Option Display (Yes / No / Partially / N/A)
// ============================================================================

interface BooleanOptionDisplayProps {
  value?: WireListFeedbackBooleanOption | null;
  renderMode: "PREFILLED" | "BLANK";
}

export function BooleanOptionDisplay({ value, renderMode }: BooleanOptionDisplayProps) {
  const options: WireListFeedbackBooleanOption[] = ["YES", "NO", "PARTIALLY", "NOT_APPLICABLE"];
  
  return (
    <div className="flex items-center gap-3">
      {options.map((option) => {
        const isSelected = renderMode === "PREFILLED" && value === option;
        return (
          <label key={option} className="flex items-center gap-1.5 text-[9px]">
            <div 
              className={`w-3 h-3 border border-foreground/50 flex items-center justify-center ${
                isSelected ? "bg-foreground" : "bg-transparent"
              }`}
            >
              {isSelected && (
                <svg className="w-2 h-2 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span className="text-foreground/80">{BOOLEAN_OPTION_LABELS[option]}</span>
          </label>
        );
      })}
    </div>
  );
}

// ============================================================================
// Difficulty Rating Display
// ============================================================================

interface DifficultyDisplayProps {
  value?: WireListFeedbackDifficulty | null;
  renderMode: "PREFILLED" | "BLANK";
}

export function DifficultyDisplay({ value, renderMode }: DifficultyDisplayProps) {
  const options: WireListFeedbackDifficulty[] = ["EASY", "MODERATE", "DIFFICULT"];
  
  return (
    <div className="flex items-center gap-3">
      {options.map((option) => {
        const isSelected = renderMode === "PREFILLED" && value === option;
        return (
          <label key={option} className="flex items-center gap-1.5 text-[9px]">
            <div 
              className={`w-3 h-3 rounded-full border border-foreground/50 flex items-center justify-center ${
                isSelected ? "bg-foreground" : "bg-transparent"
              }`}
            >
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
            </div>
            <span className="text-foreground/80">{DIFFICULTY_LABELS[option]}</span>
          </label>
        );
      })}
    </div>
  );
}

// ============================================================================
// Quality Rating Display
// ============================================================================

interface QualityRatingDisplayProps {
  value?: WireListFeedbackQualityRating | null;
  renderMode: "PREFILLED" | "BLANK";
}

export function QualityRatingDisplay({ value, renderMode }: QualityRatingDisplayProps) {
  const options: WireListFeedbackQualityRating[] = ["EXCELLENT", "GOOD", "NEEDS_IMPROVEMENT", "REWORK_REQUIRED"];
  
  return (
    <div className="flex flex-wrap items-center gap-3">
      {options.map((option) => {
        const isSelected = renderMode === "PREFILLED" && value === option;
        return (
          <label key={option} className="flex items-center gap-1.5 text-[9px]">
            <div 
              className={`w-3 h-3 rounded-full border border-foreground/50 flex items-center justify-center ${
                isSelected ? "bg-foreground" : "bg-transparent"
              }`}
            >
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
            </div>
            <span className="text-foreground/80">{QUALITY_RATING_LABELS[option]}</span>
          </label>
        );
      })}
    </div>
  );
}

// ============================================================================
// Improvement Areas Display (Multi-select Checkboxes)
// ============================================================================

interface ImprovementAreasDisplayProps {
  values?: WireListFeedbackImprovementArea[] | null;
  renderMode: "PREFILLED" | "BLANK";
}

export function ImprovementAreasDisplay({ values, renderMode }: ImprovementAreasDisplayProps) {
  const options: WireListFeedbackImprovementArea[] = [
    "DEVICE_LABELING",
    "ROUTING_CLARITY",
    "TERMINATION_DETAILS",
    "SEQUENCE_ORDER",
    "MATERIALS",
    "OTHER",
  ];
  
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const isSelected = renderMode === "PREFILLED" && values?.includes(option);
        return (
          <label key={option} className="flex items-center gap-1.5 text-[9px]">
            <div 
              className={`w-3 h-3 border border-foreground/50 flex items-center justify-center ${
                isSelected ? "bg-foreground" : "bg-transparent"
              }`}
            >
              {isSelected && (
                <svg className="w-2 h-2 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span className="text-foreground/80">{IMPROVEMENT_AREA_LABELS[option]}</span>
          </label>
        );
      })}
    </div>
  );
}

// ============================================================================
// Text Answer Box (For written responses)
// ============================================================================

interface TextAnswerBoxProps {
  value?: string | null;
  renderMode: "PREFILLED" | "BLANK";
  minHeight?: number;
}

export function TextAnswerBox({ value, renderMode, minHeight = 40 }: TextAnswerBoxProps) {
  return (
    <div 
      className="border border-foreground/30 rounded-sm px-2 py-1.5 text-[9px] leading-relaxed"
      style={{ minHeight: `${minHeight}px` }}
    >
      {renderMode === "PREFILLED" && value ? (
        <span className="text-foreground/80">{value}</span>
      ) : (
        <span className="text-foreground/20 italic">Write response here...</span>
      )}
    </div>
  );
}

// ============================================================================
// Number Input Box
// ============================================================================

interface NumberInputBoxProps {
  value?: number | null;
  renderMode: "PREFILLED" | "BLANK";
  suffix?: string;
}

export function NumberInputBox({ value, renderMode, suffix }: NumberInputBoxProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="border border-foreground/30 rounded-sm px-2 py-1 min-w-[60px] text-center text-[10px]">
        {renderMode === "PREFILLED" && value !== null && value !== undefined ? (
          <span className="font-mono">{value}</span>
        ) : (
          <span className="text-foreground/20">____</span>
        )}
      </div>
      {suffix && <span className="text-[9px] text-foreground/60">{suffix}</span>}
    </div>
  );
}

// ============================================================================
// Question Row Component
// ============================================================================

interface QuestionRowProps {
  question: FeedbackQuestion;
  values?: Partial<WireListFeedbackFormValues>;
  renderMode: "PREFILLED" | "BLANK";
}

export function PrintFeedbackQuestionRow({ question, values, renderMode }: QuestionRowProps) {
  const value = values?.[question.key];
  
  return (
    <tr className="border-b border-foreground/10">
      <td className="px-3 py-2 text-[10px] font-medium text-foreground/90 w-[40%] align-top">
        {question.label}
      </td>
      <td className="px-3 py-2 align-top">
        {question.type === "boolean" && (
          <BooleanOptionDisplay 
            value={value as WireListFeedbackBooleanOption} 
            renderMode={renderMode} 
          />
        )}
        {question.type === "difficulty" && (
          <DifficultyDisplay 
            value={value as WireListFeedbackDifficulty} 
            renderMode={renderMode} 
          />
        )}
        {question.type === "quality" && (
          <QualityRatingDisplay 
            value={value as WireListFeedbackQualityRating} 
            renderMode={renderMode} 
          />
        )}
        {question.type === "improvement" && (
          <ImprovementAreasDisplay 
            values={value as WireListFeedbackImprovementArea[]} 
            renderMode={renderMode} 
          />
        )}
        {question.type === "text" && (
          <TextAnswerBox 
            value={value as string} 
            renderMode={renderMode} 
          />
        )}
        {question.type === "number" && (
          <NumberInputBox 
            value={value as number} 
            renderMode={renderMode}
            suffix={question.key.includes("Time") ? "hrs" : undefined}
          />
        )}
      </td>
    </tr>
  );
}

// ============================================================================
// Feedback Section Group Component
// ============================================================================

interface FeedbackGroupProps {
  sectionId: string;
  title: string;
  values?: Partial<WireListFeedbackFormValues>;
  renderMode: "PREFILLED" | "BLANK";
  customQuestions?: Record<string, CustomQuestionConfig>;
}

export function PrintFeedbackGroup({ sectionId, title, values, renderMode, customQuestions }: FeedbackGroupProps) {
  // Get questions for this section, filtered by enabled status if customQuestions is provided
  const baseQuestions = FEEDBACK_SECTION_QUESTIONS[sectionId] || [];
  
  // Filter and modify questions based on customQuestions config
  const questions = customQuestions 
    ? baseQuestions
        .map(q => {
          const custom = customQuestions[q.key as string];
          if (custom) {
            return { ...q, label: custom.label, enabled: custom.enabled };
          }
          return { ...q, enabled: true };
        })
        .filter(q => q.enabled)
    : baseQuestions;
  
  // Add any custom questions for this section
  const customQuestionsForSection = customQuestions
    ? Object.values(customQuestions)
        .filter(q => q.sectionId === sectionId && q.isCustom && q.enabled)
        .map(q => ({
          key: q.key as keyof WireListFeedbackFormValues,
          label: q.label,
          type: q.type,
        }))
    : [];
  
  const allQuestions = [...questions, ...customQuestionsForSection];
  
  if (allQuestions.length === 0) return null;
  
  return (
    <div className="break-inside-avoid mb-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-foreground mb-2 border-b border-foreground/20 pb-1">
        {title}
      </h3>
      <table className="w-full border-collapse">
        <tbody>
          {allQuestions.map((question) => (
            <PrintFeedbackQuestionRow
              key={question.key}
              question={question}
              values={values}
              renderMode={renderMode}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Feedback Header Component
// ============================================================================

interface FeedbackHeaderProps {
  values?: Partial<WireListFeedbackFormValues>;
  renderMode: "PREFILLED" | "BLANK";
}

export function PrintFeedbackHeader({ values, renderMode }: FeedbackHeaderProps) {
  const isBlank = renderMode === "BLANK";
  
  // Build the title with PD# and Project Name - Sheet Name at the top
  const pdNumber = !isBlank && values?.pdNumber ? values.pdNumber : "";
  const projectName = !isBlank && values?.projectName ? values.projectName : "";
  const sheetName = !isBlank && values?.sheetName ? values.sheetName : "";
  const titleParts = [pdNumber, projectName, sheetName].filter(Boolean);
  const headerTitle = titleParts.length > 0 ? titleParts.join(" - ") : "";
  
  return (
    <div className="break-inside-avoid mb-4 border border-foreground/30 rounded-sm overflow-hidden">
      {/* Top line: PD# and Project Name - Sheet Name */}
      {headerTitle && (
        <div className="bg-foreground/5 px-3 py-2 border-b-2 border-foreground/30">
          <h1 className="text-[14px] font-bold tracking-tight text-foreground">{headerTitle}</h1>
        </div>
      )}
      <div className="bg-muted/50 px-3 py-2 border-b border-foreground/20">
        <h2 className="text-[12px] font-bold uppercase tracking-wide">Wire List Feedback Form</h2>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[9px]">
          <div className="flex gap-2">
            <span className="font-medium text-foreground/70 w-20">Project:</span>
            <span className="flex-1 border-b border-foreground/30 min-h-[16px]">
              {!isBlank && values?.projectName}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-foreground/70 w-20">Sheet Name:</span>
            <span className="flex-1 border-b border-foreground/30 min-h-[16px]">
              {!isBlank && values?.sheetName}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-foreground/70 w-20">Unit:</span>
            <span className="flex-1 border-b border-foreground/30 min-h-[16px]">
              {!isBlank && values?.unit}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="font-medium text-foreground/70 w-20">Revision:</span>
            <span className="flex-1 border-b border-foreground/30 min-h-[16px]">
              {!isBlank && values?.revision}
            </span>
          </div>
          <div className="flex gap-2 col-span-2">
            <span className="font-medium text-foreground/70 w-20">Assignment ID:</span>
            <span className="flex-1 border-b border-foreground/30 min-h-[16px]">
              {!isBlank && values?.assignmentId}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Feedback Sign-off Component
// ============================================================================

interface FeedbackSignoffProps {
  values?: Partial<WireListFeedbackFormValues>;
  renderMode: "PREFILLED" | "BLANK";
}

export function PrintFeedbackSignoff({ values, renderMode }: FeedbackSignoffProps) {
  const isBlank = renderMode === "BLANK";
  
  return (
    <div className="break-inside-avoid mt-6 border border-foreground/30 rounded-sm overflow-hidden">
      <div className="bg-muted/50 px-3 py-2 border-b border-foreground/20">
        <h3 className="text-[11px] font-bold uppercase tracking-wide">Sign-Off</h3>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-6">
          {/* Technician */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-foreground/80 uppercase">Technician</h4>
            <div className="space-y-1.5 text-[9px]">
              <div className="flex gap-2">
                <span className="font-medium text-foreground/70 w-16">Name:</span>
                <span className="flex-1 border-b border-foreground/30 min-h-[16px]">
                  {!isBlank && values?.technicianName}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-foreground/70 w-16">Badge #:</span>
                <span className="flex-1 border-b border-foreground/30 min-h-[16px] font-mono">
                  {!isBlank && values?.technicianBadge}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-foreground/70 w-16">Date:</span>
                <span className="flex-1 border-b border-foreground/30 min-h-[16px]">
                  {!isBlank && values?.completedDate}
                </span>
              </div>
            </div>
          </div>
          
          {/* Auditor */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-foreground/80 uppercase">Auditor (if applicable)</h4>
            <div className="space-y-1.5 text-[9px]">
              <div className="flex gap-2">
                <span className="font-medium text-foreground/70 w-16">Name:</span>
                <span className="flex-1 border-b border-foreground/30 min-h-[16px]">
                  {!isBlank && values?.auditorName}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-medium text-foreground/70 w-16">Badge #:</span>
                <span className="flex-1 border-b border-foreground/30 min-h-[16px] font-mono">
                  {!isBlank && values?.auditorBadge}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Signature Lines */}
        <div className="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-foreground/20">
          <div className="space-y-1">
            <div className="border-b border-foreground/50 h-8" />
            <span className="text-[8px] text-foreground/60">Technician Signature</span>
          </div>
          <div className="space-y-1">
            <div className="border-b border-foreground/50 h-8" />
            <span className="text-[8px] text-foreground/60">Auditor Signature (if required)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Feedback Section Component
// ============================================================================

interface PrintFeedbackSectionProps {
  config: PrintFeedbackConfig;
  sheetName?: string;
  projectName?: string;
  withLeadingPageBreak?: boolean;
}

export function PrintFeedbackSection({
  config,
  sheetName,
  projectName,
  withLeadingPageBreak = true,
}: PrintFeedbackSectionProps) {
  const {
    showFeedbackSection = false,
    feedbackSections = DEFAULT_WIRE_LIST_FEEDBACK_SECTIONS,
    feedbackValues = {},
    feedbackRenderMode = "BLANK",
    footer,
    customQuestions,
  } = config;
  
  if (!showFeedbackSection) return null;
  
  // Merge with default values for context
  const mergedValues: Partial<WireListFeedbackFormValues> = {
    sheetName: sheetName || "",
    projectName: projectName || "",
    ...feedbackValues,
  };
  
  // Sort sections by order and filter enabled
  const sortedSections = [...feedbackSections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
  
  return (
    <div className={withLeadingPageBreak ? "print-feedback-section page-break-before" : "print-feedback-section"}>
      {withLeadingPageBreak && <div className="break-before-page" />}
      
      {sortedSections.map((section) => (
        <Fragment key={section.id}>
          {section.id === "header" && (
            <PrintFeedbackHeader values={mergedValues} renderMode={feedbackRenderMode} />
          )}
          {section.id === "footer" && footer && (
            <PrintFooter text={footer.text} />
          )}
          {section.id !== "header" && section.id !== "footer" && (
            <PrintFeedbackGroup
              sectionId={section.id}
              title={section.title}
              values={mergedValues}
              renderMode={feedbackRenderMode}
              customQuestions={customQuestions}
            />
          )}
        </Fragment>
      ))}
      
      {/* Always show sign-off at the end */}
      {sortedSections.some((s) => s.id === "final") && (
        <PrintFeedbackSignoff values={mergedValues} renderMode={feedbackRenderMode} />
      )}
      
      {/* Footer on every page via CSS */}
      {footer?.repeatOnEveryPage && (
        <PrintFooter text={footer.text} className="print-footer-repeated" />
      )}
    </div>
  );
}

// ============================================================================
// Export All Components
// ============================================================================

export {
  type PrintFeedbackConfig,
  type WireListFeedbackFormValues,
  type WireListFeedbackSection,
};
