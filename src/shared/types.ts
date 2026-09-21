export type AccountSummary = {
  id: string
  email: string
  name: string
  picture?: string
}

export type ProjectSummary = {
  name: string
  number: string
  projectId: string
  displayName: string
  state: string
}

export type KeySummary = {
  name: string
  uid: string
  displayName: string
  createTime?: string
  updateTime?: string
  deleteTime?: string
}

export type CreatedKey = KeySummary & {
  keyString: string
}

export type AppState = {
  oauthConfigured: boolean
  accounts: AccountSummary[]
}

export type OAuthConfigInput = {
  clientId: string
  clientSecret?: string
}

export type CreateKeysRequest = {
  accountId: string
  projectNumber: string
  projectId: string
  count: number
  prefix?: string
}

export type KeyHubApi = {
  getState: () => Promise<AppState>
  saveOAuthConfig: (input: OAuthConfigInput) => Promise<AppState>
  loginGoogle: () => Promise<AccountSummary>
  removeAccount: (accountId: string) => Promise<AppState>
  listProjects: (accountId: string) => Promise<ProjectSummary[]>
  enableGeminiApis: (accountId: string, projectId: string) => Promise<void>
  listKeys: (accountId: string, projectNumber: string) => Promise<KeySummary[]>
  createKeys: (request: CreateKeysRequest) => Promise<CreatedKey[]>
  getKeyString: (accountId: string, keyName: string) => Promise<string>
  getAllKeyStrings: (accountId: string, keyNames: string[]) => Promise<string[]>
  copyText: (text: string) => Promise<void>
  exportText: (content: string, suggestedName: string) => Promise<string | null>
}
