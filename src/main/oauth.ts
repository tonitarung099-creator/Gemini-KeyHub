import { shell } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { AccountSummary } from '../shared/types'
import { cacheAccessToken } from './google-auth'
import { getOAuthConfig, getStoredAccount, upsertAccount } from './vault'

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/cloud-platform'
]

function base64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

type OAuthCode = {
  code: string
  redirectUri: string
  verifier: string
}

async function waitForOAuthCode(clientId: string): Promise<OAuthCode> {
  const verifier = base64Url(randomBytes(48))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  const state = base64Url(randomBytes(24))

  return new Promise<OAuthCode>((resolve, reject) => {
    let settled = false

    const finish = (error?: Error, value?: OAuthCode): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      server.close()
      if (error) reject(error)
      else if (value) resolve(value)
    }

    const server = createServer((req, res) => {
      try {
        const address = server.address() as AddressInfo
        const requestUrl = new URL(req.url || '/', `http://127.0.0.1:${address.port}`)

        if (requestUrl.pathname !== '/oauth/callback') {
          res.writeHead(404).end('Not found')
          return
        }

        const returnedState = requestUrl.searchParams.get('state')
        const error = requestUrl.searchParams.get('error')
        const code = requestUrl.searchParams.get('code')

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<h2>Login Google dibatalkan.</h2><p>Anda dapat menutup tab ini.</p>')
          finish(new Error(`Google OAuth: ${error}`))
          return
        }

        if (!code || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end('<h2>Login tidak valid.</h2><p>Silakan kembali ke aplikasi.</p>')
          finish(new Error('Callback OAuth tidak valid.'))
          return
        }

        const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h2>Login berhasil.</h2><p>Kembali ke Gemini KeyHub. Tab ini boleh ditutup.</p>')
        finish(undefined, { code, redirectUri, verifier })
      } catch (error) {
        finish(error as Error)
      }
    })

    server.listen(0, '127.0.0.1', async () => {
      try {
        const address = server.address() as AddressInfo
        const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', SCOPES.join(' '))
        authUrl.searchParams.set('access_type', 'offline')
        authUrl.searchParams.set('prompt', 'consent select_account')
        authUrl.searchParams.set('include_granted_scopes', 'true')
        authUrl.searchParams.set('code_challenge', challenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')
        authUrl.searchParams.set('state', state)
        await shell.openExternal(authUrl.toString())
      } catch (error) {
        finish(error as Error)
      }
    })

    const timeout = setTimeout(() => {
      finish(new Error('Login Google tidak kembali ke aplikasi. Jika browser menampilkan 401 invalid_client, buka OAuth Settings lalu import JSON OAuth Client bertipe Desktop app yang baru dari Google Cloud.'))
    }, 5 * 60 * 1000)
  })
}

export async function loginWithGoogle(): Promise<AccountSummary> {
  const oauth = await getOAuthConfig()
  if (!oauth) throw new Error('OAuth belum dikonfigurasi. Buka OAuth Settings dan import JSON OAuth Client bertipe Desktop app.')

  const { code, redirectUri, verifier } = await waitForOAuthCode(oauth.clientId)

  const body = new URLSearchParams({
    code,
    client_id: oauth.clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier
  })
  if (oauth.clientSecret) body.set('client_secret', oauth.clientSecret)

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const tokens = await tokenResponse.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!tokenResponse.ok || !tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || 'Gagal menukar kode OAuth.')
  }

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  })
  const profile = await profileResponse.json() as {
    sub?: string
    email?: string
    name?: string
    picture?: string
  }

  if (!profileResponse.ok || !profile.sub || !profile.email) {
    throw new Error('Gagal membaca profil akun Google.')
  }

  const account: AccountSummary = {
    id: profile.sub,
    email: profile.email,
    name: profile.name || profile.email,
    picture: profile.picture
  }

  const existing = await getStoredAccount(account.id)
  const refreshToken = tokens.refresh_token || existing?.refreshToken
  if (!refreshToken) {
    throw new Error('Google tidak memberikan refresh token. Hapus akses aplikasi dari akun Google lalu login ulang.')
  }

  await upsertAccount(account, refreshToken)
  cacheAccessToken(account.id, tokens.access_token, tokens.expires_in ?? 3600)
  return account
}
