import { useEffect, useState } from 'react'
import { FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import InfoHint from '@/components/InfoHint'

const INFO_TEXT =
  'Choose where backup files are saved, then export a full snapshot of items, categories, ' +
  'stock movements, and user accounts to an Excel workbook or a SQL data dump whenever you ' +
  'need one. Neither ever contains real passwords - restored accounts from the SQL dump get ' +
  'a placeholder password and need it reset before signing in.'

function SettingsWindow(): React.JSX.Element {
  const [backupFolder, setBackupFolder] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingFolder, setSavingFolder] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingSql, setExportingSql] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastExportPath, setLastExportPath] = useState<string | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
      const result = await window.api.settings.get()
      if (result.ok) setBackupFolder(result.data.backupFolder)
      setLoading(false)
    }
    load()
  }, [])

  async function handleChooseFolder(): Promise<void> {
    setError(null)
    const chosen = await window.api.settings.chooseFolder()
    if (!chosen.ok || !chosen.data) return

    setSavingFolder(true)
    try {
      const result = await window.api.settings.updateBackupFolder(chosen.data)
      if (result.ok) {
        setBackupFolder(result.data.backupFolder)
      } else {
        setError(result.error.message)
      }
    } finally {
      setSavingFolder(false)
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

      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <Label htmlFor="backup-folder">Backup folder</Label>
        <div className="flex gap-2">
          <Input
            id="backup-folder"
            value={loading ? 'Loading…' : backupFolder}
            readOnly
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleChooseFolder}
            disabled={loading || savingFolder}
          >
            <FolderOpen className="size-4" />
            Choose…
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Backup files are written here each time you export.
        </p>
      </div>

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
