import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import type { CreateKeysRequest, CreateProjectInput, OAuthConfigInput } from '../shared/types'
import {
  createKeys,
  createProject,
  enableGeminiApis,
  getAllKeyStrings,
  getKeyString,
  listKeys,
  listProjects,
  testStoredKey
} from './google-cloud'
import { clearAccessToken } from './google-auth'
import { loginWithGoogle } from './oauth'
import { isOAuthConfigured, listAccounts, removeStoredAccount, saveOAuthConfig } from './vault'

async function getState() {
  return {
    oauthConfigured: await isOAuthConfigured(),
    accounts: await listAccounts()
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('app:get-state', () => getState())

  ipcMain.handle('oauth:save-config', async (_event, input: OAuthConfigInput) => {
    await saveOAuthConfig(input)
    return getState()
  })

  ipcMain.handle('oauth:login', () => loginWithGoogle())

  ipcMain.handle('account:remove', async (_event, accountId: string) => {
    clearAccessToken(accountId)
    await removeStoredAccount(accountId)
    return getState()
  })

  ipcMain.handle('projects:list', (_event, accountId: string) => listProjects(accountId))
  ipcMain.handle('projects:create', (_event, input: CreateProjectInput) => createProject(input))

  ipcMain.handle(
    'apis:enable-gemini',
    (_event, accountId: string, projectId: string) => enableGeminiApis(accountId, projectId)
  )

  ipcMain.handle(
    'keys:list',
    (_event, accountId: string, projectNumber: string) => listKeys(accountId, projectNumber)
  )

  ipcMain.handle(
    'keys:create',
    (_event, request: CreateKeysRequest) => createKeys(request)
  )

  ipcMain.handle(
    'keys:get-string',
    (_event, accountId: string, keyName: string) => getKeyString(accountId, keyName)
  )

  ipcMain.handle(
    'keys:get-all-strings',
    (_event, accountId: string, keyNames: string[]) => getAllKeyStrings(accountId, keyNames)
  )

  ipcMain.handle(
    'keys:test',
    (_event, accountId: string, keyName: string) => testStoredKey(accountId, keyName)
  )

  ipcMain.handle('clipboard:write', (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(
    'file:export-text',
    async (_event, content: string, suggestedName: string) => {
      const result = await dialog.showSaveDialog({
        title: 'Export API Keys',
        defaultPath: suggestedName,
        filters: [
          { name: 'Text', extensions: ['txt'] },
          { name: 'Environment', extensions: ['env'] },
          { name: 'All files', extensions: ['*'] }
        ]
      })

      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, content, 'utf8')
      return result.filePath
    }
  )
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.geminikeyhub.desktop')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
