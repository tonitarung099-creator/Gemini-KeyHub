import { app } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { OAuthBootstrapResult } from '../shared/types'

export type BridgeResult = OAuthBootstrapResult & {
  clientId: string
  clientSecret?: string
  clientPath: string
  refreshToken: string
  accessToken?: string
}

const CDP_PORT = 9223

function chromeCandidates(): string[] {
  const values = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)']!, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Chromium', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ]

  return values.filter((value): value is string => Boolean(value))
}

function findChrome(): string {
  const found = chromeCandidates().find((candidate) => existsSync(candidate))
  if (!found) {
    throw new Error(
      'Google Chrome tidak ditemukan. Install Google Chrome terlebih dahulu lalu jalankan Setup OAuth Otomatis lagi.'
    )
  }
  return found
}

async function cdpReady(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
    if (!response.ok) return false
    const payload = await response.json() as { webSocketDebuggerUrl?: string }
    return Boolean(payload.webSocketDebuggerUrl)
  } catch {
    return false
  }
}

async function waitForCdp(timeoutMs = 25_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await cdpReady()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(
    'Chrome khusus OAuth berhasil dibuka tetapi koneksi otomatis ke Chrome belum siap. Tutup Chrome OAuth lalu coba lagi.'
  )
}

async function launchBootstrapChrome(): Promise<void> {
  if (await cdpReady()) return

  const chrome = findChrome()
  const profile = join(app.getPath('userData'), 'oauth-bootstrap-chrome')
  await mkdir(profile, { recursive: true })

  const child = spawn(
    chrome,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--new-window',
      'https://console.cloud.google.com/'
    ],
    {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    }
  )
  child.unref()

  await waitForCdp()
}

function helperCommand(): { command: string; args: string[] } {
  if (app.isPackaged) {
    const helper = join(process.resourcesPath, 'gclientid-bridge.exe')
    if (!existsSync(helper)) {
      throw new Error('Komponen OAuth otomatis tidak ditemukan di portable EXE. Download build Gemini KeyHub terbaru.')
    }
    return { command: helper, args: [] }
  }

  const script = join(app.getAppPath(), 'scripts', 'gclientid_bridge.py')
  return {
    command: process.platform === 'win32' ? 'python' : 'python3',
    args: [script]
  }
}

function parseBridgeLine(line: string): BridgeResult | Error | null {
  if (line.startsWith('GKH_RESULT=')) {
    return JSON.parse(line.slice('GKH_RESULT='.length)) as BridgeResult
  }
  if (line.startsWith('GKH_ERROR=')) {
    const payload = JSON.parse(line.slice('GKH_ERROR='.length)) as { message?: string }
    return new Error(payload.message || 'gclientid gagal menyiapkan OAuth.')
  }
  return null
}

async function runBridge(outputDir: string): Promise<BridgeResult> {
  const helper = helperCommand()
  const args = [...helper.args, 'bootstrap', outputDir]

  return new Promise<BridgeResult>((resolve, reject) => {
    const child = spawn(helper.command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdoutBuffer = ''
    let stderr = ''
    let settled = false

    const finishError = (error: Error): void => {
      if (settled) return
      settled = true
      reject(error)
    }

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() || ''

      for (const line of lines) {
        const parsed = parseBridgeLine(line.trim())
        if (parsed instanceof Error) finishError(parsed)
        else if (parsed && !settled) {
          settled = true
          resolve(parsed)
        }
      }
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('error', (error) => finishError(error))
    child.on('exit', (code) => {
      if (settled) return

      const parsed = parseBridgeLine(stdoutBuffer.trim())
      if (parsed instanceof Error) {
        finishError(parsed)
        return
      }
      if (parsed) {
        settled = true
        resolve(parsed)
        return
      }

      const detail = stderr.trim()
      finishError(
        new Error(
          detail
            ? `OAuth otomatis gagal (exit ${code ?? 'unknown'}): ${detail}`
            : `OAuth otomatis berhenti tanpa hasil (exit ${code ?? 'unknown'}).`
        )
      )
    })
  })
}

export async function bootstrapOAuthWithGclientid(): Promise<BridgeResult> {
  await launchBootstrapChrome()
  const outputDir = join(app.getPath('userData'), 'gclientid')
  await mkdir(outputDir, { recursive: true })
  return runBridge(outputDir)
}

export async function resetGclientidBootstrapState(): Promise<void> {
  const outputDir = join(app.getPath('userData'), 'gclientid')
  await rm(outputDir, { recursive: true, force: true })
}
