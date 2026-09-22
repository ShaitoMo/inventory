import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { Input } from './input'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  id?: string
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
  /**
   * When true, the field accepts arbitrary typed text as its value (e.g. a
   * name being created or renamed) instead of requiring the value to match
   * one of `options` - the dropdown becomes suggestions rather than a
   * closed list to pick from. There's no "Select…" row in this mode, since
   * there's no concept of an empty/unselected state to represent.
   */
  freeText?: boolean
}

function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  required,
  className,
  freeText = false
}: ComboboxProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.value === value)
  const displayValue = freeText ? value : open ? query : (selected?.label ?? '')
  const filterText = freeText ? value : query
  const filtered = filterText
    ? options.filter((option) => option.label.toLowerCase().includes(filterText.toLowerCase()))
    : options

  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        if (!freeText) setQuery('')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [freeText])

  function selectOption(nextValue: string): void {
    onChange(nextValue)
    if (!freeText) setQuery('')
    setOpen(false)
  }

  const showPanel = open && (freeText ? filtered.length > 0 : true)

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        value={displayValue}
        placeholder={placeholder}
        required={required}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const next = event.target.value
          if (freeText) {
            onChange(next)
          } else {
            setQuery(next)
            if (value) onChange('')
          }
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            if (!freeText) setQuery('')
          }
        }}
        className={cn(!freeText && !selected && 'text-muted-foreground/60', className)}
      />
      {showPanel && (
        <div className="absolute z-[9999] mt-1 max-h-48 w-full min-w-40 overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md">
          {!freeText && (
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                selectOption('')
              }}
              className="block w-full px-2 py-1.5 text-left text-sm text-muted-foreground/60 hover:bg-accent"
            >
              Select…
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No matches</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectOption(option.value)
                }}
                className={cn(
                  'block w-full px-2 py-1.5 text-left text-sm hover:bg-accent',
                  !freeText && option.value === value && 'bg-accent'
                )}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export { Combobox }
