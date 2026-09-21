import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateKeysRequest,
  CreateProjectInput,
  KeyHubApi,
  OAuthConfigInput
} from '../shared/types'

const api: KeyHubApi = {
  getState: () => ipcRenderer.invoke('app:get-state'),
  saveOAuthConfig: (input: OAuthConfigInput) => ipcRenderer.invoke('oauth:save-config', input),
  importOAuthConfig: () => ipcRenderer.invoke('oauth:import-config'),
  clearOAuthConfig: () => ipcRenderer.invoke('oauth:clear-config'),
  openOAuthSetup: () => ipcRenderer.invoke('oauth:open-setup'),
  loginGoogle: () => ipcRenderer.invoke('oauth:login'),
  removeAccount: (accountId: string) => ipcRenderer.invoke('account:remove', accountId),
  listProjects: (accountId: string) => ipcRenderer.invoke('projects:list', accountId),
  createProject: (input: CreateProjectInput) => ipcRenderer.invoke('projects:create', input),
  enableGeminiApis: (accountId: string, projectId: string) =>
    ipcRenderer.invoke('apis:enable-gemini', accountId, projectId),
  listKeys: (accountId: string, projectNumber: string) =>
    ipcRenderer.invoke('keys:list', accountId, projectNumber),
  createKeys: (request: CreateKeysRequest) => ipcRenderer.invoke('keys:create', request),
  getKeyString: (accountId: string, keyName: string) =>
    ipcRenderer.invoke('keys:get-string', accountId, keyName),
  getAllKeyStrings: (accountId: string, keyNames: string[]) =>
    ipcRenderer.invoke('keys:get-all-strings', accountId, keyNames),
  testKey: (accountId: string, keyName: string) =>
    ipcRenderer.invoke('keys:test', accountId, keyName),
  copyText: (text: string) => ipcRenderer.invoke('clipboard:write', text),
  exportText: (content: string, suggestedName: string) =>
    ipcRenderer.invoke('file:export-text', content, suggestedName)
}

contextBridge.exposeInMainWorld('keyHub', api)
