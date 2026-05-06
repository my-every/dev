/**
 * Structured PDF text extraction utilities for layout parsing.
 * Captures text content along with page and item coordinates.
 */

import type { LayoutPdfTextItem, LayoutPdfTextSource } from "@/lib/wire-length/parse-layout-pdf";

const PDFJS_VERSION = "3.11.174";
const PDFJS_CDN_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (params: { data: ArrayBuffer | Uint8Array | string }) => {
        promise: Promise<PdfDocumentProxy>;
      };
    };
  }
}

type BrowserPdfJsLib = NonNullable<typeof window.pdfjsLib>;

interface PdfTextContentItem {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
}

function isPdfTextContentItem(item: unknown): item is PdfTextContentItem {
  return typeof item === "object" && item !== null && "str" in item;
}

interface PdfPageProxy {
  getTextContent: () => Promise<{ items: PdfTextContentItem[] }>;
}

interface PdfDocumentProxy {
  numPages: number;
  getPage: (num: number) => Promise<PdfPageProxy>;
}

let browserPdfJsPromise: Promise<BrowserPdfJsLib> | null = null;

export async function loadBrowserPdfJs(): Promise<BrowserPdfJsLib> {
  if (browserPdfJsPromise) {
    return browserPdfJsPromise;
  }

  if (window.pdfjsLib) {
    browserPdfJsPromise = Promise.resolve(window.pdfjsLib);
    return browserPdfJsPromise;
  }

  browserPdfJsPromise = new Promise<BrowserPdfJsLib>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PDFJS_CDN_URL}"]`);
    if (existing && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      resolve(window.pdfjsLib);
      return;
    }

    const script = existing ?? document.createElement("script");
    script.src = PDFJS_CDN_URL;
    script.async = true;
    script.onload = () => {
      window.setTimeout(() => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
          resolve(window.pdfjsLib);
        } else {
          reject(new Error("PDF.js failed to initialize"));
        }
      }, 100);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));

    if (!existing) {
      document.head.appendChild(script);
    }
  });

  return browserPdfJsPromise;
}

export async function extractStructuredPdfText(file: File): Promise<LayoutPdfTextSource> {
  const pdfjsLib = await loadBrowserPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const items: LayoutPdfTextItem[] = [];
  const pageText: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageItems: LayoutPdfTextItem[] = [];
    for (const entry of textContent.items as unknown[]) {
      if (!isPdfTextContentItem(entry)) {
        continue;
      }

      const text = entry.str?.trim() ?? "";
      if (!text) {
        continue;
      }

      const transform = Array.isArray(entry.transform) ? entry.transform : [];
      pageItems.push({
        text,
        pageNumber: pageNum,
        x: Number(transform[4] ?? 0),
        y: Number(transform[5] ?? 0),
        width: entry.width,
        height: entry.height,
      });
    }

    items.push(...pageItems);
    pageText.push(pageItems.map((item) => item.text).join("\n"));
  }

  return {
    text: pageText.join("\n"),
    items,
    totalPages: pdf.numPages,
  };
}
