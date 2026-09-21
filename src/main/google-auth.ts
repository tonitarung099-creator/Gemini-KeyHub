import { getOAuthConfig, getStoredAccount } from './vault'

type CachedToken = {
  accessToken: string
  expiresAt: number
}

const accessTokens = new Map<string, CachedToken>()

export function cacheAccessToken(accountId: string, accessToken: string, expiresInSeconds: number): void {
  accessTokens.set(accountId, {
    accessToken,
    expiresAt: Date.now() + Math.max(30, expiresInSeconds - 60) * 1000
  })
}

export function clearAccessToken(accountId: string): void {
  accessTokens.delete(accountId)
}

export async function getAccessToken(accountId: string): Promise<string> {
  const cached = accessTokens.get(accountId)
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken

  const [oauth, account] = await Promise.all([
    getOAuthConfig(),
    getStoredAccount(accountId)
  ])

  if (!oauth) throw new Error('OAuth belum dikonfigurasi.')
  if (!account) throw new Error('Akun Google tidak ditemukan.')

  const body = new URLSearchParams({
    client_id: oauth.clientId,
    refresh_token: account.refreshToken,
    grant_type: 'refresh_token'
  })
  if (oauth.clientSecret) body.set('client_secret', oauth.clientSecret)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const payload = await response.json() as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || 'Gagal memperbarui login Google.')
  }

  cacheAccessToken(accountId, payload.access_token, payload.expires_in ?? 3600)
  return payload.access_token
}
