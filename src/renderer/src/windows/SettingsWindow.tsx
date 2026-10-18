import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import InfoHint from '@/components/InfoHint'

const INFO_TEXT =
  'Choose where backup files and exported reports are saved - each feature has its own folder - ' +
  'then export a full snapshot of items, categories, stock movements, and user accounts to an ' +
  'Excel workbook or a SQL data dump whenever you need one. Neither ever contains real ' +
  'passwords - restored accounts from the SQL dump get a placeholder password and need it ' +
  'reset before signing in.'

type FolderKey = 'backupFolder' | 'reportsFolder'

// One card per feature that writes files; adding another is one more entry here
// (plus its setting, channel and preload method).
const FOLDER_SETTINGS: { key: FolderKey; label: string; description: string }[] = [
  {
    key: 'backupFolder',
    label: 'Backup folder',
    description: 'Backup files are written here each time you export.'
  },
  {
    key: 'reportsFolder',
    label: 'Reports folder',
    description: 'Monthly reports exported from the Reports window are written here.'
  }
]

// Never leaves a folder undefined: an input whose value turns undefined becomes uncontrolled, and
// React then keeps showing whatever text it had - i.e. "Loading…" - forever. That is what happens
// if the main process is older than this screen (e.g. a dev session that wasn't restarted after
// a setting was added) and doesn't send every setting.
function toFolders(settings: Partial<Record<FolderKey, string>>): Record<FolderKey, string> {
  return {
    backupFolder: settings.backupFolder ?? '',
    reportsFolder: settings.reportsFolder ?? ''
  }
}

function SettingsWindow(): React.JSX.Element {
  const [folders, setFolders] = useState<Record<FolderKey, string>>(() => toFolders({}))
  const [loading, setLoading] = useState(true)
  const [savingFolder, setSavingFolder] = useState<FolderKey | null>(null)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingSql, setExportingSql] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const result = await window.api.settings.get()
        if (result.ok) {
          setFolders(toFolders(result.data))
        } else {
          setError(result.error.message)
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleChooseFolder(key: FolderKey): Promise<void> {
    setError(null)
    const chosen = await window.api.settings.chooseFolder()
    if (!chosen.ok || !chosen.data) return

    setSavingFolder(key)
    try {
      const result =
        key === 'backupFolder'
          ? await window.api.settings.updateBackupFolder(chosen.data)
          : await window.api.settings.updateReportsFolder(chosen.data)
      if (result.ok) {
        setFolders(toFolders(result.data))
      } else {
        setError(result.error.message)
      }
    } catch (caught) {
      // e.g. "updateReportsFolder is not a function" from a preload that predates the setting
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSavingFolder(null)
    }
  }

  async function handleExportExcel(): Promise<void> {
    setError(null)
    setLastExportPath(null)
    setExportingExcel(true)
    try {
      const result = await window.api.backup.export()
      if (result.ok) {
        setLastExportPath(result.data.filePath)
      } else {
        setError(result.error.message)
      }
    } finally {
      setExportingExcel(false)
    }
  }

  async function handleExportSql(): Promise<void> {
    setError(null)
    setLastExportPath(null)
    setExportingSql(true)
    try {
      const result = await window.api.backup.exportSql()
      if (result.ok) {
        setLastExportPath(result.data.filePath)
      } else {
        setError(result.error.message)
      }
    } finally {
      setExportingSql(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <InfoHint text={INFO_TEXT} />
      </div>

      {FOLDER_SETTINGS.map(({ key, label, description }) => (
        <div key={key} className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <Label htmlFor={`folder-${key}`}>{label}</Label>
          <div className="flex gap-2">
            <Input
              id={`folder-${key}`}
              value={loading ? 'Loading…' : folders[key]}
              readOnly
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => handleChooseFolder(key)}
              disabled={loading || savingFolder !== null}
            >
              <FolderOpen className="size-4" />
              Choose…
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      ))}

      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleExportExcel}
            disabled={loading || exportingExcel || exportingSql}
            className="border border-input bg-white text-black hover:bg-black hover:text-white"
          >
            {exportingExcel ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Exporting…
              </>
            ) : (
              'Export backup (.xlsx)'
            )}
          </Button>
          <Button
            type="button"
            onClick={handleExportSql}
            disabled={loading || exportingExcel || exportingSql}
            className="border border-input bg-white text-black hover:bg-black hover:text-white"
          >
            {exportingSql ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Exporting…
              </>
            ) : (
              'Export backup (.sql)'
            )}
          </Button>
        </div>
        {lastExportPath && (
          <p className="text-sm text-muted-foreground">Saved to {lastExportPath}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export default SettingsWindow
