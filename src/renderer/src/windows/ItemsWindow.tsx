import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type Item = IpcData<typeof window.api.items.list>['items'][number]
type Category = IpcData<typeof window.api.categories.list>[number]

const INFO_TEXT =
  'Track stock items. Each item belongs to a category; its quantity is derived from Movements ' +
  "(Stock in/out/adjust) and can't be edited here directly. Rows in red are at or below their minimum quantity."

function ItemsWindow(): React.JSX.Element {
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unit, setUnit] = useState('')
  const [minQty, setMinQty] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ value: String(category.id), label: category.name })),
    [categories]
  )
  const itemNameOptions = useMemo(
    () => items.map((item) => ({ value: item.name, label: item.name })),
    [items]
  )
  const unitOptions = useMemo(() => {
    const distinct = Array.from(new Set(items.map((item) => item.unit))).sort()
    return distinct.map((value) => ({ value, label: value }))
  }, [items])

  async function refresh(): Promise<void> {
    setLoading(true)
    const [itemsResult, categoriesResult] = await Promise.all([
      window.api.items.list({ pageSize: 100 }),
      window.api.categories.list()
    ])
    if (itemsResult.ok) {
      setItems(
        [...itemsResult.data.items].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        )
      )
    }
    if (categoriesResult.ok) {
      setCategories(
        [...categoriesResult.data].sort((a, b) =>
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
    setCategoryId('')
    setUnit('')
    setMinQty('')
  }

  function startEdit(item: Item): void {
    setEditingId(item.id)
    setName(item.name)
    setCategoryId(String(item.categoryId))
    setUnit(item.unit)
    setMinQty(String(item.minQty))
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
        ? await window.api.items.update(editingId, {
            name,
            categoryId: Number(categoryId),
            unit,
            minQty: Number(minQty)
          })
        : await window.api.items.create({
            name,
            categoryId: Number(categoryId),
            unit,
            minQty: Number(minQty)
          })
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
    const result = await window.api.items.delete(id)
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
          <Label htmlFor="item-name">Name</Label>
          <Combobox
            id="item-name"
            freeText
            options={itemNameOptions}
            value={name}
            onChange={setName}
            placeholder="Item name"
            required
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="item-category">Category</Label>
          <Combobox
            id="item-category"
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            required
            className="w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="item-unit">Unit</Label>
          <Combobox
            id="item-unit"
            freeText
            options={unitOptions}
            value={unit}
            onChange={setUnit}
            placeholder="Piece"
            required
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="item-minqty">Min qty</Label>
          <Input
            id="item-minqty"
            type="number"
            min={0}
            step={1}
            value={minQty}
            onChange={(event) => setMinQty(event.target.value)}
            placeholder="10"
            required
            className="w-20"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {editingId ? 'Save changes' : 'Add item'}
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
            aria-label="Refresh items"
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
              <TableHead>Category</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Min</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No items yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const category = categories.find((c) => c.id === item.categoryId)
                const low = item.quantity <= item.minQty
                return (
                  <TableRow key={item.id} className={item.id === editingId ? 'bg-muted/50' : undefined}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{category?.name ?? '—'}</TableCell>
                    <TableCell className={low ? 'font-semibold text-destructive' : undefined}>
                      {item.quantity}
                    </TableCell>
                    <TableCell>{item.minQty}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(item)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive-ghost"
                          size="sm"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes to &quot;{name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This updates the item&apos;s name, category, unit, and minimum quantity. The
              item&apos;s quantity itself is never changed here - it only ever changes through
              Movements.
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

export default ItemsWindow
