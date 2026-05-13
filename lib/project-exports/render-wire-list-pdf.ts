import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { chromium } from "playwright";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getPlaywrightCacheRoots() {
  const homeDirectory = os.homedir();

  return [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.platform === "win32"
      ? path.join(homeDirectory, "AppData", "Local", "ms-playwright")
      : null,
    process.platform === "darwin"
      ? path.join(homeDirectory, "Library", "Caches", "ms-playwright")
      : null,
    process.platform === "linux"
      ? path.join(homeDirectory, ".cache", "ms-playwright")
      : null,
    path.join(homeDirectory, "AppData", "Local", "ms-playwright"),
    path.join(homeDirectory, "Library", "Caches", "ms-playwright"),
    path.join(homeDirectory, ".cache", "ms-playwright"),
  ].filter((entry): entry is string => Boolean(entry));
}

function getExecutableCandidates(cacheRoot: string, entryName: string) {
  return [
    path.join(cacheRoot, entryName, "chrome-headless-shell-win64", "chrome-headless-shell.exe"),
    path.join(cacheRoot, entryName, "chrome-win", "chrome.exe"),
    path.join(cacheRoot, entryName, "chrome-linux", "chrome"),
    path.join(cacheRoot, entryName, "chrome-headless-shell-linux64", "chrome-headless-shell"),
    path.join(cacheRoot, entryName, "chrome-headless-shell-mac-arm64", "chrome-headless-shell"),
    path.join(cacheRoot, entryName, "chrome-headless-shell-mac-x64", "chrome-headless-shell"),
    path.join(cacheRoot, entryName, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
  ];
}

function getSystemExecutableCandidates() {
  return [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.GOOGLE_CHROME_EXECUTABLE_PATH,
    process.env.CHROMIUM_EXECUTABLE_PATH,
    process.env.BROWSER_EXECUTABLE_PATH,
    process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : null,
    process.platform === "darwin"
      ? "/Applications/Chromium.app/Contents/MacOS/Chromium"
      : null,
    process.platform === "darwin"
      ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
      : null,
    process.platform === "darwin"
      ? "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
      : null,
    process.platform === "linux" ? "/usr/bin/google-chrome" : null,
    process.platform === "linux" ? "/usr/bin/google-chrome-stable" : null,
    process.platform === "linux" ? "/usr/bin/chromium" : null,
    process.platform === "linux" ? "/usr/bin/chromium-browser" : null,
    process.platform === "linux" ? "/snap/bin/chromium" : null,
    process.platform === "win32"
      ? path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe")
      : null,
    process.platform === "win32"
      ? path.join(process.env["PROGRAMFILES"] ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe")
      : null,
    process.platform === "win32"
      ? path.join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe")
      : null,
    "/opt/homebrew/bin/chromium",
    "/opt/homebrew/bin/chromium-browser",
    "/usr/local/bin/chromium",
    "/usr/local/bin/chromium-browser",
  ].filter((entry): entry is string => Boolean(entry));
}

async function resolveChromiumExecutablePath() {
  const explicitPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicitPath && await pathExists(explicitPath)) {
    return explicitPath;
  }

  for (const cacheRoot of getPlaywrightCacheRoots()) {
    try {
      const entries = await fs.readdir(cacheRoot, { withFileTypes: true });
      const chromiumCandidates = entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium"))
        .sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true }));

      for (const entry of chromiumCandidates) {
        for (const executablePath of getExecutableCandidates(cacheRoot, entry.name)) {
          if (await pathExists(executablePath)) {
            return executablePath;
          }
        }
      }
    } catch {
      continue;
    }
  }

  for (const executablePath of getSystemExecutableCandidates()) {
    if (await pathExists(executablePath)) {
      return executablePath;
    }
  }

  return null;
}

export async function renderWireListPdfFromRoute(options: {
  origin: string;
  projectId: string;
  sheetSlug: string;
  grouping?: string;
  mode?: "branding";
}): Promise<Uint8Array> {
  const targetUrl = new URL(
    `/print/project-context/${encodeURIComponent(options.projectId)}/wire-list/${encodeURIComponent(options.sheetSlug)}`,
    options.origin,
  );
  // Force HTTP for localhost to avoid SSL errors in Playwright
  if (targetUrl.hostname === "localhost" && targetUrl.protocol === "https:") {
    targetUrl.protocol = "http:";
  }
  if (options.grouping) {
    targetUrl.searchParams.set("grouping", options.grouping);
  }
  if (options.mode) {
    targetUrl.searchParams.set("mode", options.mode);
  }

  return renderPdfFromUrl(targetUrl);
}

export async function renderCrossWirePdfFromRoute(options: {
  origin: string;
  projectId: string;
}): Promise<Uint8Array> {
  const targetUrl = new URL(
    `/print/project-context/${encodeURIComponent(options.projectId)}/cross-wire`,
    options.origin,
  );
  // Force HTTP for localhost to avoid SSL errors in Playwright
  if (targetUrl.hostname === "localhost" && targetUrl.protocol === "https:") {
    targetUrl.protocol = "http:";
  }

  return renderPdfFromUrl(targetUrl);
}

async function renderFallbackPdf(targetUrl: URL): Promise<Uint8Array> {
  // Create a simple PDF using pdf-lib when Playwright is not available
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;
  
  // Header
  page.drawText("Wire List / Brand List Export", {
    x: margin,
    y: y,
    size: 18,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 30;
  
  // Timestamp
  page.drawText(`Generated: ${new Date().toLocaleString()}`, {
    x: margin,
    y: y,
    size: 10,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 40;
  
  // Info box
  page.drawRectangle({
    x: margin,
    y: y - 80,
    width: width - margin * 2,
    height: 100,
    color: rgb(0.97, 0.97, 0.95),
    borderColor: rgb(0.9, 0.9, 0.85),
    borderWidth: 1,
  });
  
  y -= 20;
  page.drawText("PDF Generation Notice", {
    x: margin + 15,
    y: y,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;
  
  const noticeLines = [
    "The full PDF rendering requires a browser environment (Playwright/Chromium).",
    "This simplified export contains basic document information.",
    "",
    "For production deployments, ensure Playwright browsers are installed:",
    "  npx playwright install chromium",
  ];
  
  for (const line of noticeLines) {
    page.drawText(line, {
      x: margin + 15,
      y: y,
      size: 9,
      font: font,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 14;
  }
  
  y -= 30;
  
  // Document details
  page.drawText("Document Details", {
    x: margin,
    y: y,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 25;
  
  const details = [
    `Source URL: ${targetUrl.pathname}`,
    `Project ID: ${targetUrl.pathname.split("/")[3] || "N/A"}`,
    `Document Type: ${targetUrl.pathname.includes("cross-wire") ? "Cross Wire" : targetUrl.pathname.includes("brand") ? "Brand List" : "Wire List"}`,
  ];
  
  for (const detail of details) {
    page.drawText(detail, {
      x: margin,
      y: y,
      size: 10,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 18;
  }
  
  // Footer
  page.drawText("Caterpillar: Confidential Green", {
    x: margin,
    y: 30,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  page.drawText("Page 1 of 1", {
    x: width - margin - 50,
    y: 30,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
  
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

async function renderPdfFromUrl(targetUrl: URL): Promise<Uint8Array> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (launchError) {
    const fallbackExecutablePath = await resolveChromiumExecutablePath();
    if (fallbackExecutablePath) {
      try {
        browser = await chromium.launch({
          headless: true,
          executablePath: fallbackExecutablePath,
        });
      } catch {
        // If fallback executable also fails, use pdf-lib fallback
        console.warn("[v0] Playwright launch failed, using pdf-lib fallback");
        return renderFallbackPdf(targetUrl);
      }
    } else {
      // No browser available, use pdf-lib fallback instead of throwing
      console.warn("[v0] No Chromium browser available, using pdf-lib fallback");
      return renderFallbackPdf(targetUrl);
    }
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1800 },
      deviceScaleFactor: 1,
    });
    await page.goto(targetUrl.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForSelector(".print-content", {
      state: "visible",
      timeout: 15000,
    });
    await page.waitForTimeout(500);
    await page.emulateMedia({ media: "print" });
    await page.addStyleTag({
      content: `
        @media print {
          .print-footer {
            display: none !important;
          }
        }
      `,
    });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width: 100%; padding: 0 0.4in; font-size: 10px; color: #666; font-family: Arial, sans-serif;">
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #d4d4d4; padding-top: 6px;">
            <span>Caterpillar: Confidential Green</span>
            <span style="font-weight: 600;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        </div>
      `,
      margin: {
        top: "0.4in",
        right: "0.4in",
        bottom: "0.7in",
        left: "0.4in",
      },
    });

    return pdf;
  } finally {
    await browser.close();
  }
}
