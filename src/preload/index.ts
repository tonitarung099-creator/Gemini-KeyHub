import { contextBridge, ipcRenderer } from 'electron'
import type { CreateKeysRequest, KeyHubApi, OAuthConfigInput } from '../shared/types'

const api: KeyHubApi = {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveOAuthConfig: (input: OAuthConfigInput) => ipcRenderer.invoke('oauth:save-config', input),
  loginGoogle: () => ipcRenderer.invoke('oauth:login'),
  removeAccount: (accountId: string) => ipcRenderer.invoke('account:remove', accountId),
  listProjects: (accountId: string) => ipcRenderer.invoke('projects:list', accountId),
  enableGeminiApis: (accountId: string, projectId: string) =>
    ipcRenderer.invoke('apis:enable-gemini', accountId, projectId),
  listKeys: (accountId: string, projectNumber: string) =>
    ipcRenderer.invoke('keys:list', accountId, projectNumber),
  createKeys: (request: CreateKeysRequest) => ipcRenderer.invoke('keys:create', request),
  getKeyString: (accountId: string, keyName: string) =>
    ipcRenderer.invoke('keys:get-string', accountId, keyName),
  getAllKeyStrings: (accountId: string, keyNames: string[]) =>
    ipcRenderer.invoke('keys:get-all-strings', accountId, keyNames),
  copyText: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  exportText: (content: string, suggestedName: string) =>
    ipcRenderer.invoke('file:export-text', content, suggestedName)
}

contextBridge.exposeInMainWorld('keyHub', api)
