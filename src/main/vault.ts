import { app, safeStorage } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AccountSummary, OAuthConfigInput } from '../shared/types'

type StoredAccount = AccountSummary & {
  refreshToken: string
}

type VaultData = {
  version: 1
  oauth?: {
    clientId: string
    clientSecret?: string
  }
  accounts: StoredAccount[]
}

const EMPTY_VAULT: VaultData = {
  version: 1,
  accounts: []
}

function vaultPath(): string {
  return join(app.getPath('userData'), 'keyhub.vault.json')
}

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Penyimpanan terenkripsi OS belum tersedia. Coba login kembali setelah Windows siap.')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Penyimpanan terenkripsi OS tidak tersedia.')
  }
  return safeStorage.decryptString(Buffer.from(value, 'base64'))
}

async function readVault(): Promise<VaultData> {
  try {
    const raw = await readFile(vaultPath(), 'utf8')
    const parsed = JSON.parse(raw) as VaultData
    return {
      version: 1,
      oauth: parsed.oauth,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : []
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY_VAULT, accounts: [] }
    throw error
  }
}

async function writeVault(data: VaultData): Promise<void> {
  const target = vaultPath()
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
}

export async function saveOAuthConfig(input: OAuthConfigInput): Promise<void> {
  const clientId = input.clientId.trim()
  const clientSecret = input.clientSecret?.trim() || undefined
  if (!clientId) throw new Error('OAuth Client ID wajib diisi.')

  const vault = await readVault()
  vault.oauth = {
    clientId: encrypt(clientId),
    clientSecret: clientSecret ? encrypt(clientSecret) : undefined
  }
  await writeVault(vault)
}

export async function getOAuthConfig(): Promise<OAuthConfigInput | null> {
  const vault = await readVault()
  if (!vault.oauth?.clientId) return null
  return {
    clientId: decrypt(vault.oauth.clientId),
    clientSecret: vault.oauth.clientSecret ? decrypt(vault.oauth.clientSecret) : undefined
  }
}

export async function isOAuthConfigured(): Promise<boolean> {
  const vault = await readVault()
  return Boolean(vault.oauth?.clientId)
}

export async function listAccounts(): Promise<AccountSummary[]> {
  const vault = await readVault()
  return vault.accounts.map(({ refreshToken: _refreshToken, ...account }) => account)
}

export async function getStoredAccount(accountId: string): Promise<StoredAccount | null> {
  const vault = await readVault()
  const account = vault.accounts.find((item) => item.id === accountId)
  if (!account) return null
  return {
    ...account,
    refreshToken: decrypt(account.refreshToken)
  }
}

export async function upsertAccount(account: AccountSummary, refreshToken: string): Promise<void> {
  const vault = await readVault()
  const stored: StoredAccount = {
    ...account,
    refreshToken: encrypt(refreshToken)
  }
  const index = vault.accounts.findIndex((item) => item.id === account.id)
  if (index >= 0) vault.accounts[index] = stored
  else vault.accounts.push(stored)
  await writeVault(vault)
}

export async function removeStoredAccount(accountId: string): Promise<void> {
  const vault = await readVault()
  vault.accounts = vault.accounts.filter((item) => item.id !== accountId)
  await writeVault(vault)
}
