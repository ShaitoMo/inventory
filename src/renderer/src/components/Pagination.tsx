import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PaginationProps {
  page: number
  totalPages: number
  totalRows: number
  onPageChange: (page: number) => void
}

function Pagination({
  page,
  totalPages,
  totalRows,
  onPageChange
}: PaginationProps): React.JSX.Element | null {
  const [jumpValue, setJumpValue] = useState('')

  if (totalPages <= 1) return null

  function handleJump(event: FormEvent): void {
    event.preventDefault()
    const target = Math.trunc(Number(jumpValue))
    if (Number.isFinite(target) && target >= 1 && target <= totalPages) {
      onPageChange(target)
    }
    setJumpValue('')
  }

  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <span className="text-muted-foreground">{totalRows} total</span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>
        <span className="px-1 text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
      <form onSubmit={handleJump} className="flex items-center gap-1">
        <Input
          type="number"
          min={1}
          max={totalPages}
          value={jumpValue}
          onChange={(event) => setJumpValue(event.target.value)}
          placeholder="Page #"
          aria-label="Jump to page"
          className="h-8 w-20"
        />
        <Button type="submit" variant="outline" size="sm">
          Go
        </Button>
      </form>
    </div>
  )
}

export default Pagination
