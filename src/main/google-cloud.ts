import type { CreateKeysRequest, CreatedKey, KeySummary, ProjectSummary } from '../shared/types'
import { clearAccessToken, getAccessToken } from './google-auth'

type GoogleErrorPayload = {
  error?: {
    code?: number
    message?: string
    status?: string
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestJson<T>(
  accountId: string,
  url: string,
  init: RequestInit = {},
  retryAuth = true
): Promise<T> {
  const accessToken = await getAccessToken(accountId)
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(url, { ...init, headers })

  if (response.status === 401 && retryAuth) {
    clearAccessToken(accountId)
    return requestJson<T>(accountId, url, init, false)
  }

  const text = await response.text()
  const payload = text ? JSON.parse(text) as T & GoogleErrorPayload : {} as T & GoogleErrorPayload

  if (!response.ok) {
    const message = payload.error?.message || `Google API error ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

type Operation<T = unknown> = {
  name: string
  done?: boolean
  response?: T
  error?: {
    code?: number
    message?: string
  }
}

async function waitOperation<T>(
  accountId: string,
  baseUrl: string,
  operationName: string,
  timeoutMs = 120_000
): Promise<T | undefined> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const op = await requestJson<Operation<T>>(accountId, `${baseUrl}/${operationName}`)
    if (op.done) {
      if (op.error) throw new Error(op.error.message || 'Operasi Google gagal.')
      return op.response
    }
    await sleep(900)
  }

  throw new Error('Operasi Google terlalu lama dan dihentikan oleh aplikasi.')
}

export async function listProjects(accountId: string): Promise<ProjectSummary[]> {
  const projects: ProjectSummary[] = []
  let pageToken = ''

  do {
    const url = new URL('https://cloudresourcemanager.googleapis.com/v3/projects:search')
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const payload = await requestJson<{
      projects?: Array<{
        name?: string
        projectId?: string
        displayName?: string
        state?: string
      }>
      nextPageToken?: string
    }>(accountId, url.toString())

    for (const project of payload.projects ?? []) {
      if (!project.name || !project.projectId) continue
      const number = project.name.split('/').pop()
      if (!number) continue

      projects.push({
        name: project.name,
        number,
        projectId: project.projectId,
        displayName: project.displayName || project.projectId,
        state: project.state || 'STATE_UNSPECIFIED'
      })
    }

    pageToken = payload.nextPageToken || ''
  } while (pageToken)

  return projects
    .filter((project) => project.state === 'ACTIVE')
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function enableGeminiApis(accountId: string, projectId: string): Promise<void> {
  const payload = await requestJson<Operation>(
    accountId,
    `https://serviceusage.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/services:batchEnable`,
    {
      method: 'POST',
      body: JSON.stringify({
        serviceIds: [
          'apikeys.googleapis.com',
          'generativelanguage.googleapis.com'
        ]
      })
    }
  )

  if (payload.name) {
    await waitOperation(accountId, 'https://serviceusage.googleapis.com/v1', payload.name)
  }
}

export async function listKeys(accountId: string, projectNumber: string): Promise<KeySummary[]> {
  const keys: KeySummary[] = []
  let pageToken = ''

  do {
    const url = new URL(
      `https://apikeys.googleapis.com/v2/projects/${encodeURIComponent(projectNumber)}/locations/global/keys`
    )
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const payload = await requestJson<{
      keys?: KeySummary[]
      nextPageToken?: string
    }>(accountId, url.toString())

    keys.push(...(payload.keys ?? []))
    pageToken = payload.nextPageToken || ''
  } while (pageToken)

  return keys.sort((a, b) => (b.createTime || '').localeCompare(a.createTime || ''))
}

export async function getKeyString(accountId: string, keyName: string): Promise<string> {
  if (!keyName.startsWith('projects/')) throw new Error('Nama API key tidak valid.')

  const payload = await requestJson<{ keyString?: string }>(
    accountId,
    `https://apikeys.googleapis.com/v2/${keyName}/keyString`
  )

  if (!payload.keyString) throw new Error('Google tidak mengembalikan key string.')
  return payload.keyString
}

async function createOneKey(
  accountId: string,
  projectNumber: string,
  displayName: string
): Promise<CreatedKey> {
  const operation = await requestJson<Operation<KeySummary>>(
    accountId,
    `https://apikeys.googleapis.com/v2/projects/${encodeURIComponent(projectNumber)}/locations/global/keys`,
    {
      method: 'POST',
      body: JSON.stringify({
        displayName,
        restrictions: {
          apiTargets: [
            { service: 'generativelanguage.googleapis.com' }
          ]
        }
      })
    }
  )

  if (!operation.name) throw new Error('Google tidak mengembalikan operation name.')
  const key = await waitOperation<KeySummary>(
    accountId,
    'https://apikeys.googleapis.com/v2',
    operation.name
  )
  if (!key?.name) throw new Error('API key selesai dibuat tetapi metadata key tidak ditemukan.')

  const keyString = await getKeyString(accountId, key.name)
  return { ...key, keyString }
}

export async function createKeys(request: CreateKeysRequest): Promise<CreatedKey[]> {
  const count = Math.trunc(request.count)
  if (!Number.isFinite(count) || count < 1 || count > 20) {
    throw new Error('Jumlah key per proses harus antara 1 sampai 20.')
  }

  await enableGeminiApis(request.accountId, request.projectId)

  const result: CreatedKey[] = []
  const prefix = (request.prefix || 'gemini-keyhub').trim().slice(0, 40) || 'gemini-keyhub'
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)

  for (let index = 1; index <= count; index += 1) {
    const displayName = `${prefix}-${stamp}-${String(index).padStart(2, '0')}`
    const key = await createOneKey(
      request.accountId,
      request.projectNumber,
      displayName
    )
    result.push(key)
    if (index < count) await sleep(350)
  }

  return result
}

export async function getAllKeyStrings(accountId: string, keyNames: string[]): Promise<string[]> {
  const uniqueNames = [...new Set(keyNames)].filter((name) => name.startsWith('projects/'))
  const values: string[] = []

  for (const name of uniqueNames) {
    values.push(await getKeyString(accountId, name))
    await sleep(120)
  }

  return values
}
