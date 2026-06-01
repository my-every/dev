"use client";

import { type ReactNode } from "react";
import { BlueLabelMatrixReferenceTable } from "@/components/dashboard/blue-label-matrix-reference-table";

import {
  WirePreperationTable,
  type WirePreparationRow,
} from "@/components/dashboard/wire-preperation-table";
import type { BlueLabelSequenceMatrixEntry, IdentificationFilterKind } from "@/lib/wiring-identification";

const QUICK_REF_CARD_BASE_ROW_COST = 6;
const QUICK_REF_PAGE_ROW_BUDGET = 56;


function PrintPage({
  fileName,
  sheetName,
  children,
  footer = "Caterpillar: Confidential Green",
}: {
  fileName: string;
  sheetName: string;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <section
      className="print-page  flex min-h-[10.6in] gap-2 w-full  flex-col border bg-white print:mx-0 print:min-h-252 print:w-full print:max-w-none print:border-0 print:shadow-none"
    >
      <div className="shrink-0 min-h-[0.85in] flex-col  border-b border-gray-300 flex items-center justify-center gap-1 px-3 py-2 print:min-h-[0.85in] print:px-3 print:py-2">
        <div className="text-sm w-full font-semibold uppercase tracking-wide">{sheetName} - Assignment Preparation Print Out</div>
        <div className="text-[10px] w-full text-muted-foreground">
          Assignment preparation reference for Blue Label sequence and quick-reference wiring tables.
        </div>
      </div>

      <div className="grid min-h-[9.4in] flex-1 grid-cols-3 gap-3 px-3 print:min-h-0 print:px-3">
        {children}
      </div>

      <div className="assignment-prep-print-footer min-h-[0.35in] shrink-0 border-t px-3 py-2 text-[10px] text-muted-foreground print:min-h-[0.35in] print:px-3 print:py-2">
        <span className="w-full">{footer}</span>
      </div>
    </section>
  );
}




export interface AssignmentPreparationQuickRefCard {
  kind: IdentificationFilterKind;
  title: string;
  instruction: string;
  rows: WirePreparationRow[];
}

interface AssignmentPreperationPrintOutProps {
  fileName: string;
  sheetName: string;
  entries: BlueLabelSequenceMatrixEntry[];
  quickRefCards: AssignmentPreparationQuickRefCard[];
}

function estimateQuickRefRowCost(card: AssignmentPreparationQuickRefCard) {
  return card.rows.length + QUICK_REF_CARD_BASE_ROW_COST;
}

interface QuickRefPageLayout {
  leftColumnCards: AssignmentPreparationQuickRefCard[];
  rightColumnCards: AssignmentPreparationQuickRefCard[];
}

function paginateQuickRefCards(cards: AssignmentPreparationQuickRefCard[]): QuickRefPageLayout[] {
  const remainingCards = [...cards].sort(
    (cardA, cardB) => estimateQuickRefRowCost(cardB) - estimateQuickRefRowCost(cardA),
  );

  const pages: QuickRefPageLayout[] = [];

  while (remainingCards.length > 0) {
    const leftColumnCards: AssignmentPreparationQuickRefCard[] = [];
    const rightColumnCards: AssignmentPreparationQuickRefCard[] = [];
    let leftHeight = 0;
    let rightHeight = 0;

    while (remainingCards.length > 0) {
      let bestCardIndex = -1;
      let bestColumn: "left" | "right" = "left";
      let bestRemainingSpace = Number.POSITIVE_INFINITY;
      let bestHeightBalance = Number.POSITIVE_INFINITY;

      for (let cardIndex = 0; cardIndex < remainingCards.length; cardIndex += 1) {
        const card = remainingCards[cardIndex];
        const cardHeight = estimateQuickRefRowCost(card);

        const leftRemaining = QUICK_REF_PAGE_ROW_BUDGET - (leftHeight + cardHeight);
        if (leftRemaining >= 0) {
          const leftBalance = Math.abs(leftHeight + cardHeight - rightHeight);
          if (
            leftRemaining < bestRemainingSpace ||
            (leftRemaining === bestRemainingSpace && leftBalance < bestHeightBalance)
          ) {
            bestCardIndex = cardIndex;
            bestColumn = "left";
            bestRemainingSpace = leftRemaining;
            bestHeightBalance = leftBalance;
          }
        }

        const rightRemaining = QUICK_REF_PAGE_ROW_BUDGET - (rightHeight + cardHeight);
        if (rightRemaining >= 0) {
          const rightBalance = Math.abs(rightHeight + cardHeight - leftHeight);
          if (
            rightRemaining < bestRemainingSpace ||
            (rightRemaining === bestRemainingSpace && rightBalance < bestHeightBalance)
          ) {
            bestCardIndex = cardIndex;
            bestColumn = "right";
            bestRemainingSpace = rightRemaining;
            bestHeightBalance = rightBalance;
          }
        }
      }

      if (bestCardIndex === -1) {
        break;
      }

      const [chosenCard] = remainingCards.splice(bestCardIndex, 1);
      const chosenCardHeight = estimateQuickRefRowCost(chosenCard);

      if (bestColumn === "left") {
        leftColumnCards.push(chosenCard);
        leftHeight += chosenCardHeight;
      } else {
        rightColumnCards.push(chosenCard);
        rightHeight += chosenCardHeight;
      }
    }

    // Guard against pathological data where an item cannot fit the budget.
    if (leftColumnCards.length === 0 && rightColumnCards.length === 0) {
      leftColumnCards.push(remainingCards.shift()!);
    }

    pages.push({ leftColumnCards, rightColumnCards });
  }

  return pages;
}

function QuickRefGrid({
  leftColumnCards,
  rightColumnCards,
  getVisibleColumnsForCard,
  className,
}: {
  leftColumnCards: AssignmentPreparationQuickRefCard[];
  rightColumnCards: AssignmentPreparationQuickRefCard[];
  getVisibleColumnsForCard: (kind: IdentificationFilterKind) => readonly ["from", "to"] | readonly ["from", "to", "wire", "gauge"];
  className: string;
}) {
  return (
    <div className={className}>
      <div className="flex h-full min-w-0 flex-col gap-3">
        {leftColumnCards.map((card, index) => (
          <div key={`quick-ref-wrap-left-${card.kind}-${index}`} className="h-fit min-w-0">
            <WirePreperationTable
              key={`quick-ref-card-left-${card.kind}-${index}`}
              title={card.title}
              instruction={card.instruction}
              rows={card.rows}
              kind={card.kind}
              visibleColumns={getVisibleColumnsForCard(card.kind)}
            />
          </div>
        ))}
      </div>

      <div className="flex h-full min-w-0 flex-col gap-3">
        {rightColumnCards.map((card, index) => (
          <div key={`quick-ref-wrap-right-${card.kind}-${index}`} className="h-fit min-w-0">
            <WirePreperationTable
              key={`quick-ref-card-right-${card.kind}-${index}`}
              title={card.title}
              instruction={card.instruction}
              rows={card.rows}
              kind={card.kind}
              visibleColumns={getVisibleColumnsForCard(card.kind)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssignmentPreperationPrintOut({
  fileName,
  sheetName,
  entries,
  quickRefCards,
}: AssignmentPreperationPrintOutProps) {
  const visibleQuickRefCards = quickRefCards.filter(
    (card) => card.kind !== "xt_clips" && card.kind !== "jumpers",
  );

  function getVisibleColumnsForCard(kind: IdentificationFilterKind) {
    if (kind === "clips" || kind === "fu_jumpers") {
      return ["from", "to"] as const;
    }

    return ["from", "to", "wire", "gauge"] as const;
  }

  const quickRefPages = paginateQuickRefCards(visibleQuickRefCards);
  const firstPage = quickRefPages[0] ?? { leftColumnCards: [], rightColumnCards: [] };
  const followingPages = quickRefPages.slice(1);

  return (
    <>
      <PrintPage fileName={fileName} sheetName={sheetName}>
        <BlueLabelMatrixReferenceTable entries={entries} />

        <QuickRefGrid
          leftColumnCards={firstPage.leftColumnCards}
          rightColumnCards={firstPage.rightColumnCards}
          getVisibleColumnsForCard={getVisibleColumnsForCard}
          className="col-span-2 col-start-2 grid h-full grid-cols-2 gap-3"
        />
      </PrintPage>

      {followingPages.map((page, pageIndex) => (
        <PrintPage
          key={`assignment-prep-page-${pageIndex + 2}`}
          fileName={fileName}
          sheetName={sheetName}
        >
          <QuickRefGrid
            leftColumnCards={page.leftColumnCards}
            rightColumnCards={page.rightColumnCards}
            getVisibleColumnsForCard={getVisibleColumnsForCard}
            className="col-span-2 col-start-1 grid h-full grid-cols-2 gap-3"
          />
        </PrintPage>
      ))}
    </>
  );
}
