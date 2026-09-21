import { useEffect, useMemo, useState } from 'react'
import type {
  AccountSummary,
  AppState,
  CreatedKey,
  KeySummary,
  ProjectSummary
} from '../../shared/types'

const EMPTY_STATE: AppState = {
  oauthConfigured: false,
  accounts: []
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function shortKey(value: string): string {
  if (value.length <= 12) return value
  return `${value.slice(0, 7)}••••••${value.slice(-4)}`
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function App() {
  const [appState, setAppState] = useState<AppState>(EMPTY_STATE)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [selectedProjectNumber, setSelectedProjectNumber] = useState('')
  const [keys, setKeys] = useState<KeySummary[]>([])
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [createdKeys, setCreatedKeys] = useState<CreatedKey[]>([])
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [count, setCount] = useState(20)

  const selectedAccount = useMemo(
    () => appState.accounts.find((account) => account.id === selectedAccountId) || null,
    [appState.accounts, selectedAccountId]
  )

  const selectedProject = useMemo(
    () => projects.find((project) => project.number === selectedProjectNumber) || null,
    [projects, selectedProjectNumber]
  )

  async function refreshState() {
    const state = await window.keyHub.getState()
    setAppState(state)
    setSelectedAccountId((current) => {
      if (current && state.accounts.some((account) => account.id === current)) return current
      return state.accounts[0]?.id || ''
    })
    if (!state.oauthConfigured) setSettingsOpen(true)
  }

  async function loadProjects(accountId: string) {
    setBusy('projects')
    setError('')
    setProjects([])
    setSelectedProjectNumber('')
    setKeys([])
    setCreatedKeys([])
    setRevealed({})
    try {
      const next = await window.keyHub.listProjects(accountId)
      setProjects(next)
      setSelectedProjectNumber(next[0]?.number || '')
      if (next.length === 0) setNotice('Tidak ada project ACTIVE yang terlihat pada akun ini.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function loadKeys(accountId: string, projectNumber: string) {
    setBusy('keys')
    setError('')
    setKeys([])
    setRevealed({})
    try {
      const next = await window.keyHub.listKeys(accountId, projectNumber)
      setKeys(next)
    } catch (err) {
      setError(
        `${errorMessage(err)} — jika API Keys API belum aktif, tekan tombol “Aktifkan API”.`
      )
    } finally {
      setBusy('')
    }
  }

  useEffect(() => {
    void refreshState().catch((err) => setError(errorMessage(err)))
  }, [])

  useEffect(() => {
    if (selectedAccountId) void loadProjects(selectedAccountId)
  }, [selectedAccountId])

  useEffect(() => {
    if (selectedAccountId && selectedProjectNumber) {
      void loadKeys(selectedAccountId, selectedProjectNumber)
    }
  }, [selectedAccountId, selectedProjectNumber])

  async function saveSettings() {
    setBusy('settings')
    setError('')
    try {
      const state = await window.keyHub.saveOAuthConfig({
        clientId,
        clientSecret: clientSecret || undefined
      })
      setAppState(state)
      setClientId('')
      setClientSecret('')
      setSettingsOpen(false)
      setNotice('OAuth Google tersimpan secara terenkripsi.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function addAccount() {
    setBusy('login')
    setError('')
    setNotice('Browser Google dibuka. Pilih akun yang ingin ditambahkan.')
    try {
      const account = await window.keyHub.loginGoogle()
      await refreshState()
      setSelectedAccountId(account.id)
      setNotice(`${account.email} berhasil ditambahkan.`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function removeAccount(account: AccountSummary) {
    if (!confirm(`Hapus login lokal untuk ${account.email}? API key di Google Cloud tidak akan dihapus.`)) {
      return
    }
    setBusy('remove')
    setError('')
    try {
      const state = await window.keyHub.removeAccount(account.id)
      setAppState(state)
      setSelectedAccountId(state.accounts[0]?.id || '')
      setNotice('Akun dihapus dari Gemini KeyHub.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function enableApis() {
    if (!selectedAccount || !selectedProject) return
    setBusy('enable')
    setError('')
    setNotice('Mengaktifkan API Keys API dan Gemini API…')
    try {
      await window.keyHub.enableGeminiApis(selectedAccount.id, selectedProject.projectId)
      setNotice('API Keys API dan Gemini API aktif.')
      await loadKeys(selectedAccount.id, selectedProject.number)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function createMany() {
    if (!selectedAccount || !selectedProject) return
    setBusy('create')
    setError('')
    setCreatedKeys([])
    setNotice(`Membuat ${count} key. Jangan tutup aplikasi selama proses ini.`)
    try {
      const result = await window.keyHub.createKeys({
        accountId: selectedAccount.id,
        projectNumber: selectedProject.number,
        projectId: selectedProject.projectId,
        count,
        prefix: 'gemini-keyhub'
      })
      setCreatedKeys(result)
      setNotice(`${result.length} API key berhasil dibuat.`)
      await loadKeys(selectedAccount.id, selectedProject.number)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function revealKey(key: KeySummary) {
    if (!selectedAccount) return
    setError('')
    try {
      const value = await window.keyHub.getKeyString(selectedAccount.id, key.name)
      setRevealed((current) => ({ ...current, [key.name]: value }))
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function copyKey(key: KeySummary) {
    if (!selectedAccount) return
    setError('')
    try {
      const value = revealed[key.name] || await window.keyHub.getKeyString(selectedAccount.id, key.name)
      setRevealed((current) => ({ ...current, [key.name]: value }))
      await window.keyHub.copyText(value)
      setNotice(`${key.displayName || 'API key'} disalin.`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function getAllValues(): Promise<string[]> {
    if (!selectedAccount || keys.length === 0) return []
    return window.keyHub.getAllKeyStrings(
      selectedAccount.id,
      keys.map((key) => key.name)
    )
  }

  async function copyAll() {
    setBusy('copy')
    setError('')
    try {
      const values = await getAllValues()
      await window.keyHub.copyText(values.join('\n'))
      setNotice(`${values.length} key disalin ke clipboard.`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function exportTxt() {
    if (!selectedProject) return
    setBusy('export')
    setError('')
    try {
      const values = await getAllValues()
      const file = await window.keyHub.exportText(
        values.join('\n'),
        `gemini-keys-${selectedProject.projectId}.txt`
      )
      if (file) setNotice(`Key diexport ke ${file}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function exportEnv() {
    if (!selectedProject) return
    setBusy('export')
    setError('')
    try {
      const values = await getAllValues()
      const content = values
        .map((value, index) => `GEMINI_API_KEY_${String(index + 1).padStart(2, '0')}=${value}`)
        .join('\n')
      const file = await window.keyHub.exportText(
        content,
        `gemini-keys-${selectedProject.projectId}.env`
      )
      if (file) setNotice(`File .env dibuat di ${file}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function copyCreated() {
    if (createdKeys.length === 0) return
    await window.keyHub.copyText(createdKeys.map((key) => key.keyString).join('\n'))
    setNotice(`${createdKeys.length} key baru disalin.`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div>
            <strong>Gemini KeyHub</strong>
            <span>Google API Manager</span>
          </div>
        </div>

        <div className="section-label">AKUN GOOGLE</div>
        <div className="account-list">
          {appState.accounts.map((account) => (
            <button
              type="button"
              key={account.id}
              className={`account-card ${selectedAccountId === account.id ? 'active' : ''}`}
              onClick={() => setSelectedAccountId(account.id)}
            >
              {account.picture ? (
                <img src={account.picture} alt="" />
              ) : (
                <div className="avatar-fallback">{initials(account.name)}</div>
              )}
              <div className="account-copy">
                <strong>{account.name}</strong>
                <span>{account.email}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="secondary full"
          disabled={!appState.oauthConfigured || Boolean(busy)}
          onClick={() => void addAccount()}
        >
          + Tambah Akun Google
        </button>

        <div className="sidebar-spacer" />

        {selectedAccount && (
          <button
            type="button"
            className="ghost danger"
            disabled={Boolean(busy)}
            onClick={() => void removeAccount(selectedAccount)}
          >
            Hapus akun dari aplikasi
          </button>
        )}
        <button type="button" className="ghost" onClick={() => setSettingsOpen(true)}>
          ⚙ OAuth Settings
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">ACCOUNT / PROJECT / KEYS</p>
            <h1>{selectedAccount ? selectedAccount.email : 'Tambahkan akun Google'}</h1>
          </div>
          <div className="status-pill">
            <span className="status-dot" />
            Local encrypted vault
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert info">{notice}</div>}

        <section className="panel project-panel">
          <div>
            <p className="section-label">PROJECT GOOGLE CLOUD</p>
            <select
              value={selectedProjectNumber}
              disabled={!selectedAccount || busy === 'projects'}
              onChange={(event) => setSelectedProjectNumber(event.target.value)}
            >
              {projects.length === 0 && <option value="">Tidak ada project</option>}
              {projects.map((project) => (
                <option key={project.number} value={project.number}>
                  {project.displayName} — {project.projectId}
                </option>
              ))}
            </select>
            {selectedProject && (
              <div className="project-meta">
                Project number <code>{selectedProject.number}</code>
              </div>
            )}
          </div>

          <div className="project-actions">
            <button
              type="button"
              className="secondary"
              disabled={!selectedProject || Boolean(busy)}
              onClick={() => void enableApis()}
            >
              Aktifkan API
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!selectedAccount || Boolean(busy)}
              onClick={() => selectedAccount && void loadProjects(selectedAccount.id)}
            >
              ↻ Refresh
            </button>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Google Accounts</span>
            <strong>{appState.accounts.length}</strong>
          </div>
          <div className="stat-card">
            <span>Projects</span>
            <strong>{projects.length}</strong>
          </div>
          <div className="stat-card">
            <span>Keys di project</span>
            <strong>{keys.length}</strong>
          </div>
          <div className="stat-card accent">
            <span>Batch default</span>
            <strong>{count}</strong>
          </div>
        </section>

        <section className="panel create-panel">
          <div>
            <p className="section-label">BUAT GEMINI API KEYS</p>
            <h2>Buat key dalam satu aksi</h2>
            <p>
              Setiap key baru dibatasi ke Gemini API
              <code>generativelanguage.googleapis.com</code>.
            </p>
          </div>
          <div className="create-controls">
            <label>
              Jumlah
              <input
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(event) => {
                  const value = Math.max(1, Math.min(20, Number(event.target.value) || 1))
                  setCount(value)
                }}
              />
            </label>
            <button
              type="button"
              className="primary"
              disabled={!selectedProject || Boolean(busy)}
              onClick={() => void createMany()}
            >
              {busy === 'create' ? 'Membuat key…' : `Buat ${count} Key`}
            </button>
          </div>
        </section>

        {createdKeys.length > 0 && (
          <section className="panel created-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">BARU DIBUAT</p>
                <h2>{createdKeys.length} key siap dicopy</h2>
              </div>
              <button type="button" className="primary small" onClick={() => void copyCreated()}>
                Copy semua key baru
              </button>
            </div>
            <div className="created-list">
              {createdKeys.map((key) => (
                <code key={key.name}>{key.keyString}</code>
              ))}
            </div>
          </section>
        )}

        <section className="panel keys-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">API KEYS</p>
              <h2>{selectedProject?.displayName || 'Pilih project'}</h2>
            </div>
            <div className="toolbar">
              <button
                type="button"
                className="secondary small"
                disabled={keys.length === 0 || Boolean(busy)}
                onClick={() => void copyAll()}
              >
                Copy All
              </button>
              <button
                type="button"
                className="secondary small"
                disabled={keys.length === 0 || Boolean(busy)}
                onClick={() => void exportTxt()}
              >
                Export TXT
              </button>
              <button
                type="button"
                className="secondary small"
                disabled={keys.length === 0 || Boolean(busy)}
                onClick={() => void exportEnv()}
              >
                Export .env
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>API Key</th>
                  <th>Dibuat</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.name}>
                    <td>
                      <strong>{key.displayName || 'Untitled key'}</strong>
                      <span className="subtle">{key.uid}</span>
                    </td>
                    <td>
                      <code>{revealed[key.name] ? shortKey(revealed[key.name]) : '••••••••••••••••••••'}</code>
                    </td>
                    <td>{key.createTime ? new Date(key.createTime).toLocaleString('id-ID') : '—'}</td>
                    <td className="row-actions">
                      <button type="button" className="ghost compact" onClick={() => void revealKey(key)}>
                        Reveal
                      </button>
                      <button type="button" className="secondary compact" onClick={() => void copyKey(key)}>
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      {busy === 'keys' ? 'Membaca API keys…' : 'Belum ada key atau API Keys API belum aktif.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {settingsOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="section-label">SETUP SEKALI</p>
                <h2>Google OAuth Desktop Client</h2>
              </div>
              {appState.oauthConfigured && (
                <button type="button" className="ghost compact" onClick={() => setSettingsOpen(false)}>
                  ✕
                </button>
              )}
            </div>
            <p>
              Masukkan kredensial OAuth Client bertipe <strong>Desktop app</strong>.
              Nilainya disimpan terenkripsi secara lokal dan tidak dikirim ke repository.
            </p>
            <label className="field">
              Client ID
              <input
                type="text"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder="xxxxx.apps.googleusercontent.com"
                autoComplete="off"
              />
            </label>
            <label className="field">
              Client Secret
              <input
                type="password"
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
                placeholder="Opsional jika OAuth client Anda tidak memerlukannya"
                autoComplete="off"
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="primary"
                disabled={!clientId.trim() || busy === 'settings'}
                onClick={() => void saveSettings()}
              >
                {busy === 'settings' ? 'Menyimpan…' : 'Simpan OAuth'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
