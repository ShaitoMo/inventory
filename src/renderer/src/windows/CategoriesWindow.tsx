import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import InfoHint from '@/components/InfoHint'
import type { IpcData } from '@/lib/ipc-types'

type Category = IpcData<typeof window.api.categories.list>[number]

const INFO_TEXT =
  "Group items for easier browsing and low-stock reporting. A category can't be deleted while " +
  'any item still references it.'

function CategoriesWindow(): React.JSX.Element {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const categoryNameOptions = useMemo(
    () => categories.map((category) => ({ value: category.name, label: category.name })),
    [categories]
  )

  async function refresh(): Promise<void> {
    setLoading(true)
    const result = await window.api.categories.list()
    if (result.ok) {
      setCategories(
        [...result.data].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        )
      )
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  function resetForm(): void {
    setEditingId(null)
    setName('')
  }

  function startEdit(category: Category): void {
    setEditingId(category.id)
    setName(category.name)
  }

  function handleFormSubmit(event: FormEvent): void {
    event.preventDefault()
    if (editingId) {
      setConfirmOpen(true)
      return
    }
    void performSave()
  }

  async function performSave(): Promise<void> {
    setConfirmOpen(false)
    setError(null)
    setSubmitting(true)
    try {
      const result = editingId
        ? await window.api.categories.update(editingId, { name })
        : await window.api.categories.create({ name })
      if (result.ok) {
        resetForm()
        await refresh()
      } else {
        setError(result.error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: number): Promise<void> {
    const result = await window.api.categories.delete(id)
    if (result.ok) {
      if (editingId === id) resetForm()
      await refresh()
    } else {
      setError(result.error.message)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">
      <form onSubmit={handleFormSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="category-name">Name</Label>
          <Combobox
            id="category-name"
            freeText
            options={categoryNameOptions}
            value={name}
            onChange={setName}
            placeholder="Category name"
            required
            className="w-48"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {editingId ? 'Save changes' : 'Add category'}
        </Button>
        {editingId && (
          <Button type="button" variant="outline" onClick={resetForm}>
            Cancel
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => refresh()}
            aria-label="Refresh categories"
          >
            <RefreshCw className="size-4" />
          </Button>
          <InfoHint text={INFO_TEXT} />
        </div>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex-1 overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow
                  key={category.id}
                  className={category.id === editingId ? 'bg-muted/50' : undefined}
                >
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(category)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive-ghost"
                        size="sm"
                        onClick={() => handleDelete(category.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes to &quot;{name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Every item currently in this category will immediately show the new name - they
              reference it by id, not by the old name, so nothing else needs to change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => void performSave()}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default CategoriesWindow
