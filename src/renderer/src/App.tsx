import { useEffect, useMemo, useState } from 'react'
import type {
  AccountSummary,
  AppState,
  CreatedKey,
  KeySummary,
  KeyTestResult,
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
  const [testResults, setTestResults] = useState<Record<string, KeyTestResult>>({})
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [newProjectName, setNewProjectName] = useState('Gemini KeyHub')
  const [newProjectId, setNewProjectId] = useState('')
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
    if (!state.oauthConfigured || state.accounts.length === 0) setSettingsOpen(true)
  }

  async function loadProjects(accountId: string, preferredProjectNumber?: string) {
    setBusy('projects')
    setError('')
    setProjects([])
    setKeys([])
    setCreatedKeys([])
    setRevealed({})
    setTestResults({})
    try {
      const next = await window.keyHub.listProjects(accountId)
      setProjects(next)
      const preferred = preferredProjectNumber && next.some((project) => project.number === preferredProjectNumber)
        ? preferredProjectNumber
        : next[0]?.number || ''
      setSelectedProjectNumber(preferred)
      if (next.length === 0) setNotice('Tidak ada project ACTIVE yang terlihat pada akun ini.')
    } catch (err) {
      setError(errorMessage(err))
      setSelectedProjectNumber('')
    } finally {
      setBusy('')
    }
  }

  async function loadKeys(accountId: string, projectNumber: string) {
    setBusy('keys')
    setError('')
    setKeys([])
    setRevealed({})
    setTestResults({})
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
    else {
      setProjects([])
      setSelectedProjectNumber('')
      setKeys([])
    }
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

  async function importOAuth() {
    setBusy('settings')
    setError('')
    try {
      const state = await window.keyHub.importOAuthConfig()
      if (!state) return
      setAppState(state)
      setClientId('')
      setClientSecret('')
      setSettingsOpen(true)
      setNotice('OAuth Desktop JSON berhasil diimpor. Sekarang login ulang dengan Client ID baru.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function autoSetupOAuth() {
    setBusy('oauth-bootstrap')
    setError('')
    setNotice(
      'Membuka Chrome khusus untuk setup OAuth. Login ke Google di jendela Chrome tersebut jika diminta, lalu biarkan aplikasi menyelesaikan setup.'
    )
    try {
      const result = await window.keyHub.bootstrapOAuth()
      await refreshState()
      const warningText = result.warnings.length > 0
        ? ` Catatan: ${result.warnings.join(' | ')}`
        : ''
      setNotice(
        `OAuth otomatis siap dan ${result.account} sudah masuk ke Gemini KeyHub. Project: ${result.projectId}. Client: ${result.clientIdHint}.${warningText}`
      )
      setSettingsOpen(false)
    } catch (err) {
      setError(errorMessage(err))
      setSettingsOpen(true)
    } finally {
      setBusy('')
    }
  }

  async function resetOAuth() {
    if (!confirm('Reset OAuth lokal? Semua login akun yang tersimpan akan dihapus dari aplikasi dan Anda harus login ulang. API key di Google Cloud tidak akan dihapus.')) {
      return
    }
    setBusy('settings')
    setError('')
    try {
      const state = await window.keyHub.clearOAuthConfig()
      setAppState(state)
      setSelectedAccountId('')
      setProjects([])
      setKeys([])
      setNotice('OAuth lokal sudah direset. Import OAuth Desktop JSON yang baru.')
      setSettingsOpen(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  async function addAccount() {
    setBusy('login')
    setError('')
    setNotice('Browser default Windows dibuka. Pilih akun Google yang ingin ditambahkan.')
    try {
      const account = await window.keyHub.loginGoogle()
      await refreshState()
      setSelectedAccountId(account.id)
      setSettingsOpen(false)
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

  async function createNewProject() {
    if (!selectedAccount) return
    setBusy('project-create')
    setError('')
    try {
      const project = await window.keyHub.createProject({
        accountId: selectedAccount.id,
        projectId: newProjectId,
        displayName: newProjectName
      })
      setProjectModalOpen(false)
      setNotice(`Project ${project.displayName} berhasil dibuat.`)
      setNewProjectName('Gemini KeyHub')
      setNewProjectId('')
      await loadProjects(selectedAccount.id, project.number)
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
    setNotice(`Membuat ${count} authorization key Gemini. Jangan tutup aplikasi selama proses ini.`)
    try {
      const result = await window.keyHub.createKeys({
        accountId: selectedAccount.id,
        projectNumber: selectedProject.number,
        projectId: selectedProject.projectId,
        count,
        prefix: 'gemini-keyhub'
      })
      setCreatedKeys(result.created)
      if (result.error) {
        setError(`${result.created.length}/${result.requested} key berhasil dibuat. ${result.error}`)
      } else {
        setNotice(
          `${result.created.length} authorization key berhasil dibuat${result.serviceAccountEmail ? ` dan dibind ke ${result.serviceAccountEmail}` : ''}.`
        )
      }
      await loadKeys(selectedAccount.id, selectedProject.number)
      setCreatedKeys(result.created)
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

  async function testKey(key: KeySummary) {
    if (!selectedAccount) return
    setError('')
    setTestResults((current) => ({
      ...current,
      [key.name]: { ok: false, message: 'Menguji…' }
    }))
    try {
      const result = await window.keyHub.testKey(selectedAccount.id, key.name)
      setTestResults((current) => ({ ...current, [key.name]: result }))
    } catch (err) {
      setTestResults((current) => ({
        ...current,
        [key.name]: { ok: false, message: errorMessage(err) }
      }))
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
            Portable · encrypted vault
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
              disabled={!selectedAccount || Boolean(busy)}
              onClick={() => setProjectModalOpen(true)}
            >
              + Project Baru
            </button>
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
            <h2>Buat authorization key dalam satu aksi</h2>
            <p>
              Key baru dibatasi ke <code>generativelanguage.googleapis.com</code> dan
              dibind ke service account khusus project agar sesuai model autentikasi Gemini terbaru.
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
                  <th>Tipe</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => {
                  const result = testResults[key.name]
                  return (
                    <tr key={key.name}>
                      <td>
                        <strong>{key.displayName || 'Untitled key'}</strong>
                        <span className="subtle">{key.uid}</span>
                      </td>
                      <td>
                        <code>{revealed[key.name] ? shortKey(revealed[key.name]) : '••••••••••••••••••••'}</code>
                      </td>
                      <td>
                        <span
                          className={key.serviceAccountEmail ? 'key-type auth' : 'key-type legacy'}
                          title={key.serviceAccountEmail || 'Standard API key lama'}
                        >
                          {key.serviceAccountEmail ? 'AUTH' : 'LEGACY'}
                        </span>
                      </td>
                      <td>
                        {result ? (
                          <span
                            className={
                              result.message === 'Menguji…'
                                ? 'key-status pending'
                                : result.ok
                                  ? 'key-status good'
                                  : 'key-status bad'
                            }
                            title={result.message}
                          >
                            {result.message === 'Menguji…' ? 'Testing…' : result.ok ? 'Valid' : 'Error'}
                          </span>
                        ) : (
                          <span className="key-status idle">Belum dites</span>
                        )}
                      </td>
                      <td>{key.createTime ? new Date(key.createTime).toLocaleString('id-ID') : '—'}</td>
                      <td className="row-actions">
                        <button type="button" className="ghost compact" onClick={() => void testKey(key)}>
                          Test
                        </button>
                        <button type="button" className="ghost compact" onClick={() => void revealKey(key)}>
                          Reveal
                        </button>
                        <button type="button" className="secondary compact" onClick={() => void copyKey(key)}>
                          Copy
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      {busy === 'keys' ? 'Membaca API keys…' : 'Belum ada key atau API Keys API belum aktif.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {projectModalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-heading">
              <div>
                <p className="section-label">PROJECT BARU</p>
                <h2>Buat Google Cloud Project</h2>
              </div>
              <button type="button" className="ghost compact" onClick={() => setProjectModalOpen(false)}>
                ✕
              </button>
            </div>
            <p>
              Project dibuat memakai akun Google yang sedang dipilih. Jika akun tidak memiliki izin membuat project,
              Google akan menampilkan error aslinya.
            </p>
            <label className="field">
              Nama project
              <input
                type="text"
                value={newProjectName}
                maxLength={30}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Gemini KeyHub"
              />
            </label>
            <label className="field">
              Project ID
              <input
                type="text"
                value={newProjectId}
                maxLength={30}
                onChange={(event) => setNewProjectId(event.target.value.toLowerCase())}
                placeholder="gemini-keyhub-123456"
              />
            </label>
            <p className="field-help">
              Project ID harus unik secara global di Google Cloud dan tidak dapat diganti setelah dibuat.
            </p>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setProjectModalOpen(false)}>
                Batal
              </button>
              <button
                type="button"
                className="primary"
                disabled={!newProjectName.trim() || !newProjectId.trim() || busy === 'project-create'}
                onClick={() => void createNewProject()}
              >
                {busy === 'project-create' ? 'Membuat…' : 'Buat Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop">
          <div className="modal oauth-modal">
            <div className="modal-heading">
              <div>
                <p className="section-label">SETUP SEKALI</p>
                <h2>Hubungkan Google OAuth</h2>
              </div>
              {appState.oauthConfigured && (
                <button type="button" className="ghost compact" onClick={() => setSettingsOpen(false)}>
                  ✕
                </button>
              )}
            </div>

            <div className="auto-setup-card">
              <div>
                <strong>Setup otomatis dari gclientid</strong>
                <p>
                  Direkomendasikan. Gemini KeyHub membuka Chrome khusus, menyiapkan project OAuth,
                  membuat Desktop Client, mengotorisasi akun, lalu menyimpan login ke vault terenkripsi otomatis.
                </p>
              </div>
              <button
                type="button"
                className="primary"
                disabled={Boolean(busy) || appState.oauthConfigured}
                onClick={() => void autoSetupOAuth()}
              >
                {busy === 'oauth-bootstrap'
                  ? 'Menyiapkan OAuth…'
                  : appState.oauthConfigured
                    ? 'Reset OAuth dulu'
                    : 'Setup OAuth Otomatis'}
              </button>
            </div>

            <div className="setup-callout">
              <strong>Alternatif manual: OAuth Client bertipe Desktop app</strong>
              <p>
                Error 401 “OAuth client was not found” berarti Client ID yang dipakai Google tidak valid,
                sudah dihapus, atau bukan Client ID yang benar.
              </p>
              {appState.oauthClientHint && (
                <p className="oauth-current">
                  Tersimpan saat ini: <code>{appState.oauthClientHint}</code>
                </p>
              )}
              {appState.oauthConfigured && (
                <button
                  type="button"
                  className="ghost danger small"
                  disabled={busy === 'settings'}
                  onClick={() => void resetOAuth()}
                >
                  Reset OAuth lama
                </button>
              )}
            </div>

            <div className="setup-steps">
              <div className="setup-step">
                <span>1</span>
                <div>
                  <strong>Buat OAuth Client Desktop app</strong>
                  <p>Buka Google Cloud Credentials lalu pilih Create credentials → OAuth client ID → Desktop app.</p>
                </div>
                <button type="button" className="secondary small" onClick={() => void window.keyHub.openOAuthSetup()}>
                  Buka Google
                </button>
              </div>
              <div className="setup-step">
                <span>2</span>
                <div>
                  <strong>Download JSON lalu import</strong>
                  <p>Cara ini lebih aman dan menghindari salah copy Client ID atau Client Secret.</p>
                </div>
                <button
                  type="button"
                  className="primary small"
                  disabled={busy === 'settings'}
                  onClick={() => void importOAuth()}
                >
                  Import OAuth JSON
                </button>
              </div>
              <div className="setup-step">
                <span>3</span>
                <div>
                  <strong>Login akun Google</strong>
                  <p>
                    Login dibuka di browser default Windows. Google tidak mengizinkan login OAuth di browser
                    tertanam/webview aplikasi desktop.
                  </p>
                </div>
                <button
                  type="button"
                  className="primary small"
                  disabled={!appState.oauthConfigured || Boolean(busy)}
                  onClick={() => void addAccount()}
                >
                  Login Google
                </button>
              </div>
            </div>

            <details className="manual-config">
              <summary>Masukkan Client ID secara manual</summary>
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
                  placeholder="Client Secret dari Desktop app"
                  autoComplete="off"
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={!clientId.trim() || busy === 'settings'}
                  onClick={() => void saveSettings()}
                >
                  Simpan Manual
                </button>
              </div>
            </details>

            {appState.oauthConfigured && (
              <div className="modal-actions">
                <button type="button" className="primary" onClick={() => setSettingsOpen(false)}>
                  Selesai
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
