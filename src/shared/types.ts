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

export type CreateProjectInput = {
  accountId: string
  projectId: string
  displayName: string
}

export type CreateKeysRequest = {
  accountId: string
  projectNumber: string
  projectId: string
  count: number
  prefix?: string
}

export type BatchCreateKeysResult = {
  requested: number
  created: CreatedKey[]
  error?: string
}

export type KeyTestResult = {
  ok: boolean
  message: string
  sampleModel?: string
}

export type KeyHubApi = {
  getState: () => Promise<AppState>
  saveOAuthConfig: (input: OAuthConfigInput) => Promise<AppState>
  loginGoogle: () => Promise<AccountSummary>
  removeAccount: (accountId: string) => Promise<AppState>
  listProjects: (accountId: string) => Promise<ProjectSummary[]>
  createProject: (input: CreateProjectInput) => Promise<ProjectSummary>
  enableGeminiApis: (accountId: string, projectId: string) => Promise<void>
  listKeys: (accountId: string, projectNumber: string) => Promise<KeySummary[]>
  createKeys: (request: CreateKeysRequest) => Promise<BatchCreateKeysResult>
  getKeyString: (accountId: string, keyName: string) => Promise<string>
  getAllKeyStrings: (accountId: string, keyNames: string[]) => Promise<string[]>
  testKey: (accountId: string, keyName: string) => Promise<KeyTestResult>
  copyText: (text: string) => Promise<void>
  exportText: (content: string, suggestedName: string) => Promise<string | null>
}
