import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:3000'
const PROD_SERVER_PORT = Number(process.env.PORT ?? '38011')

let mainWindow: BrowserWindow | null = null
let nextServerProcess: ChildProcess | null = null
let packagedServerFailure: string | null = null
let packagedServerStderr = ''

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.js')
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function resolvePackagedServerPath(): Promise<string> {
  const candidates = [
    path.join(process.resourcesPath, 'next-standalone', 'server.js'),
    path.join(process.resourcesPath, 'app', '.next', 'standalone', 'server.js'),
  ]

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  throw new Error([
    'Could not find the packaged Next standalone server.',
    `resourcesPath: ${process.resourcesPath}`,
    `appPath: ${app.getAppPath()}`,
    'Checked:',
    ...candidates.map(candidate => `- ${candidate}`),
  ].join('\n'))
}

async function assertPackagedNextBundle(serverPath: string): Promise<void> {
  const standaloneRoot = path.dirname(serverPath)
  const requiredPaths = [
    path.join(standaloneRoot, '.next', 'BUILD_ID'),
    path.join(standaloneRoot, '.next', 'server'),
    path.join(standaloneRoot, '.next', 'static'),
  ]
  const missingPaths: string[] = []

  for (const requiredPath of requiredPaths) {
    if (!(await pathExists(requiredPath))) {
      missingPaths.push(requiredPath)
    }
  }

  if (missingPaths.length > 0) {
    throw new Error([
      'Packaged Next standalone server is present, but the .next bundle is incomplete.',
      `Standalone root: ${standaloneRoot}`,
      'Missing:',
      ...missingPaths.map(missingPath => `- ${missingPath}`),
    ].join('\n'))
  }
}

function startupHtml(message = 'Starting D380...'): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>D380</title>',
    '<style>',
    'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;font:14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
    'main{max-width:680px;padding:32px}',
    'h1{margin:0 0 10px;font-size:22px}',
    'pre{white-space:pre-wrap;border:1px solid #334155;border-radius:10px;padding:14px;background:#020617;color:#cbd5e1}',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '<h1>D380</h1>',
    `<pre>${escapeHtml(message)}</pre>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

async function waitForServer(url: string, timeoutMs = 30000): Promise<void> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (packagedServerFailure) {
      throw new Error(packagedServerFailure)
    }

    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // The server is still starting.
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for the packaged Next server at ${url}`)
}

async function startPackagedNextServer(): Promise<string> {
  const serverPath = await resolvePackagedServerPath()
  await assertPackagedNextBundle(serverPath)
  const standaloneRoot = path.dirname(serverPath)
  const fallbackNodePath = [
    path.join(standaloneRoot, 'node_modules'),
    path.join(standaloneRoot, 'node_modules', '.pnpm', 'node_modules'),
    path.join(standaloneRoot, '.next', 'node_modules'),
    process.env.NODE_PATH,
  ]
    .filter(Boolean)
    .join(path.delimiter)

  packagedServerFailure = null
  packagedServerStderr = ''
  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      D380_USER_DATA_DIR: app.getPath('userData'),
      ELECTRON_RUN_AS_NODE: '1',
      HOSTNAME: '127.0.0.1',
      PORT: String(PROD_SERVER_PORT),
      NODE_ENV: 'production',
      NODE_PATH: fallbackNodePath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  nextServerProcess.stdout?.on('data', chunk => {
    console.log(`[next] ${String(chunk)}`)
  })

  nextServerProcess.stderr?.on('data', chunk => {
    const message = String(chunk)
    packagedServerStderr += message
    console.error(`[next] ${message}`)
  })

  nextServerProcess.once('exit', (code, signal) => {
    if (!packagedServerFailure) {
      const stderr = packagedServerStderr.trim()
      packagedServerFailure = [
        `Packaged Next server exited before startup. code=${code ?? 'null'} signal=${signal ?? 'null'}`,
        stderr ? `Server stderr:\n${stderr}` : null,
      ].filter(Boolean).join('\n\n')
    }
  })

  const serverUrl = `http://127.0.0.1:${PROD_SERVER_PORT}`
  await waitForServer(serverUrl)
  return serverUrl
}

async function resolveRendererUrl(): Promise<string> {
  if (!app.isPackaged) {
    return DEV_SERVER_URL
  }

  return startPackagedNextServer()
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startupHtml())}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  try {
    const rendererUrl = await resolveRendererUrl()
    await mainWindow.loadURL(rendererUrl)
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error)
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(startupHtml(message))}`)
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('d380:get-runtime-info', async () => {
    return {
      isElectron: true,
      isPackaged: app.isPackaged,
      platform: process.platform,
      version: app.getVersion(),
    }
  })

  ipcMain.handle('d380:choose-workspace-root', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select D380 Share Root',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0] ?? null
  })
}

function registerApplicationLifecycle(): void {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', () => {
    if (nextServerProcess && !nextServerProcess.killed) {
      nextServerProcess.kill()
      nextServerProcess = null
    }
  })

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
}

async function bootstrap(): Promise<void> {
  await app.whenReady()
  registerIpcHandlers()
  registerApplicationLifecycle()
  await createMainWindow()
}

bootstrap().catch(error => {
  console.error('[electron] Failed to bootstrap desktop runtime', error)
  app.quit()
})
