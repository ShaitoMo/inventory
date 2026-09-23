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
import InfoHint from '@/components/InfoHint'
import type { IpcData } from '@/lib/ipc-types'

type Movement = IpcData<typeof window.api.movements.list>['movements'][number]
type Item = IpcData<typeof window.api.items.list>['items'][number]
type User = IpcData<typeof window.api.users.list>[number]
type Mode = 'in' | 'out' | 'adjust'

const INFO_TEXT =
  'Record stock changes. Stock in/out change quantity by the amount entered. Adjust applies a ' +
  '+/- correction to the current quantity (e.g. -3 to remove 3) and logs the difference; it ' +
  "can't take an item below zero. Every entry is tied to your user automatically."

const MODE_OPTIONS = [
  { value: 'in', label: 'Stock in' },
  { value: 'out', label: 'Stock out' },
  { value: 'adjust', label: 'Adjust' }
]

function MovementsWindow(): React.JSX.Element {
  const [movements, setMovements] = useState<Movement[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode | ''>('')
  const [itemId, setItemId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const itemOptions = useMemo(
    () => items.map((item) => ({ value: String(item.id), label: item.name })),
    [items]
  )
  const noteSuggestions = useMemo(
    () =>
      Array.from(new Set(movements.map((movement) => movement.note).filter(Boolean))) as string[],
    [movements]
  )

  async function refresh(): Promise<void> {
    setLoading(true)
    const [movementsResult, itemsResult, usersResult] = await Promise.all([
      window.api.movements.list({ pageSize: 100 }),
      window.api.items.list({ pageSize: 100 }),
      window.api.users.list()
    ])
    if (movementsResult.ok) setMovements(movementsResult.data.movements)
    if (itemsResult.ok) setItems(itemsResult.data.items)
    if (usersResult.ok) setUsers(usersResult.data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!mode) return
    setError(null)
    setSubmitting(true)
    try {
      let result
      if (mode === 'adjust') {
        const currentQuantity = items.find((item) => String(item.id) === itemId)?.quantity ?? 0
        const countedQuantity = currentQuantity + Number(quantity)
        if (countedQuantity < 0) {
          setError('This adjustment would take the quantity below zero.')
          return
        }
        result = await window.api.movements.recount({
          itemId: Number(itemId),
          countedQuantity,
          note: note || undefined
        })
      } else {
        result = await window.api.movements.create({
          itemId: Number(itemId),
          type: mode,
          quantity: Number(quantity),
          note: note || undefined
        })
      }
      if (result.ok) {
        setMode('')
        setItemId('')
        setQuantity('')
        setNote('')
        await refresh()
      } else {
        setError(result.error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="movement-item">Item</Label>
          <Combobox
            id="movement-item"
            options={itemOptions}
            value={itemId}
            onChange={setItemId}
            required
            className="w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="movement-mode">Type</Label>
          <Combobox
            id="movement-mode"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(value) => setMode(value as Mode | '')}
            required
            className="w-36"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="movement-quantity">{mode === 'adjust' ? 'Adjust by (+/-)' : 'Quantity'}</Label>
          <Input
            id="movement-quantity"
            type="number"
            min={mode === 'adjust' ? undefined : 0}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder={mode === 'adjust' ? 'e.g. -3' : '1'}
            required
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="movement-note">Note</Label>
          <Combobox
            id="movement-note"
            freeText
            options={noteSuggestions.map((value) => ({ value, label: value }))}
            value={note}
            onChange={setNote}
            placeholder="Optional note"
            className="w-40"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          Record
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => refresh()}
            aria-label="Refresh movements"
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
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Entered Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No movements yet.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => {
                const item = items.find((candidate) => candidate.id === movement.itemId)
                const user = users.find((candidate) => candidate.id === movement.userId)
                return (
                  <TableRow key={movement.id}>
                    <TableCell className="font-medium">
                      {item?.name ?? `#${movement.itemId}`}
                    </TableCell>
                    <TableCell className="capitalize">{movement.type}</TableCell>
                    <TableCell>
                      {movement.type === 'adjust' && movement.quantity > 0
                        ? `+${movement.quantity}`
                        : movement.quantity}
                    </TableCell>
                    <TableCell>{user?.username ?? `#${movement.userId}`}</TableCell>
                    <TableCell>{movement.note ?? '—'}</TableCell>
                    <TableCell>{new Date(movement.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default MovementsWindow
