/**
 * Utilities for rendering PDF pages to preview images.
 * Uses pdf.js loaded from CDN for browser-based rendering.
 */

import type { LayoutPagePreview } from "./types";
import {
  type PositionedTextItem,
  buildPositionedTextItems,
  extractTitleByPosition,
  extractTitleByRegex,
  extractPanelNumber,
  extractBoxNumber,
  hasDoorLabels,
  extractRailGroups,
  extractPanducts,
} from "./extract-drawing-metadata";

export type { PositionedTextItem } from "./extract-drawing-metadata";

// ============================================================================
// PDF.js CDN Loading
// ============================================================================

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// Type declaration for pdf.js globals
declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (params: { data: ArrayBuffer }) => {
        promise: Promise<PDFDocumentProxy>;
      };
    };
  }
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (num: number) => Promise<PDFPageProxy>;
}

interface PDFTextItem {
  str?: string;
  transform?: number[];  // [scaleX, skewY, skewX, scaleY, x, y]
  width?: number;
  height?: number;
}

interface PDFPageProxy {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
  getTextContent: () => Promise<{ items: PDFTextItem[] }>;
}

/**
 * Load pdf.js from CDN if not already loaded.
 */
async function loadPdfJs(): Promise<typeof window.pdfjsLib> {
  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PDFJS_CDN_URL;
    script.async = true;

    script.onload = () => {
      setTimeout(() => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
          resolve(window.pdfjsLib);
        } else {
          reject(new Error("PDF.js failed to initialize"));
        }
      }, 100);
    };

    script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
    document.head.appendChild(script);
  });
}

// ============================================================================
// PDF Rendering
// ============================================================================

/**
 * Render a single PDF page to a canvas and return as base64 data URL.
 * Using base64 instead of blob URLs to enable localStorage persistence.
 */
async function renderPageToImage(
  page: PDFPageProxy,
  scale: number = 1.5
): Promise<{ imageUrl: string; width: number; height: number }> {
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get canvas context");
  }

  // Render the page
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  // Convert to base64 data URL (JPEG for smaller size)
  const imageUrl = canvas.toDataURL("image/jpeg", 0.7);

  return {
    imageUrl,
    width: viewport.width,
    height: viewport.height,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Progress callback for page rendering.
 */
export interface RenderProgress {
  currentPage: number;
  totalPages: number;
  message: string;
}

/**
 * Render all pages from a PDF file to preview images.
 */
export async function renderPdfPagesToImages(
  file: File,
  options?: {
    scale?: number;
    onProgress?: (progress: RenderProgress) => void;
  }
): Promise<LayoutPagePreview[]> {
  const { scale = 1.5, onProgress } = options || {};

  // Load pdf.js
  const pdfjsLib = await loadPdfJs();

  if (!pdfjsLib) {
    throw new Error("Failed to load PDF.js library");
  }

  // Load the PDF
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: LayoutPagePreview[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.({
      currentPage: pageNum,
      totalPages: pdf.numPages,
      message: `Rendering page ${pageNum} of ${pdf.numPages}`,
    });

    const page = await pdf.getPage(pageNum);

    // Render page to image (now returns base64 data URL)
    const { imageUrl, width, height } = await renderPageToImage(page, scale);

    // Extract text for title detection and panel/box numbers
    const rawTextContent = await page.getTextContent();
    const { text: textContent, items: textItems } = buildPositionedTextItems(rawTextContent.items);

    // Primary: spatial lookup near "DRAWING TITLE" label (consistent title block position)
    // Fallback: regex-based strategies for non-standard layouts
    const title = extractTitleByPosition(textItems) || extractTitleByRegex(textContent);
    const panelNumber = extractPanelNumber(textContent);
    const boxNumber = extractBoxNumber(textContent);
    const doorLabelsDetected = hasDoorLabels(textContent);
    const railGroups = extractRailGroups(textItems);
    const panducts = extractPanducts(textItems);

    // Build normalizedTitle: uppercase, replace special chars with space (preserving word boundaries), collapse whitespace
    const normalizedTitle = title
      ? title.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
      : undefined;

    // Extract unitType from JB# pattern in title (e.g., "CONTROL,JB70" → "JB70")
    const jbMatch = title?.match(/\b(JB\d+)\b/i);
    const unitType = jbMatch ? jbMatch[1].toUpperCase() : undefined;

    pages.push({
      pageNumber: pageNum,
      title,
      normalizedTitle,
      unitType,
      imageUrl,
      width,
      height,
      panelNumber,
      boxNumber,
      hasDoorLabels: doorLabelsDetected,
      textContent,
      textItems,
      railGroups,
      panducts,
    });
  }

  return pages;
}

/**
 * Build a layout page preview map from a PDF file.
 * Returns a map of page numbers to preview data.
 */
export async function buildLayoutPagePreviewMap(
  file: File,
  onProgress?: (progress: RenderProgress) => void
): Promise<Map<number, LayoutPagePreview>> {
  const pages = await renderPdfPagesToImages(file, { onProgress });

  const map = new Map<number, LayoutPagePreview>();
  for (const page of pages) {
    map.set(page.pageNumber, page);
  }

  return map;
}

/**
 * Cleanup function for compatibility (no-op since we now use data URLs).
 * Previously used to revoke blob URLs.
 */
export function cleanupPreviewUrls(_pages: LayoutPagePreview[]): void {
  // No-op: base64 data URLs don't need cleanup like blob URLs did
}

/**
 * Get a thumbnail URL for a page at a smaller scale.
 */
export async function renderPageThumbnail(
  file: File,
  pageNumber: number,
  thumbnailScale: number = 0.5
): Promise<string> {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}`);
  }

  const page = await pdf.getPage(pageNumber);
  const { imageUrl } = await renderPageToImage(page, thumbnailScale);

  return imageUrl;
}
