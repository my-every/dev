import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { chromium } from "playwright";

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
}): Promise<Uint8Array> {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (launchError) {
    const fallbackExecutablePath = await resolveChromiumExecutablePath();
    if (fallbackExecutablePath) {
      browser = await chromium.launch({
        headless: true,
        executablePath: fallbackExecutablePath,
      });
    } else {
      const message = launchError instanceof Error ? launchError.message : String(launchError);
      throw new Error(
        `Playwright Chromium browser is not available. Run "npx playwright install chromium" to install it. (${message})`,
      );
    }
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1800 },
      deviceScaleFactor: 1,
    });
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
