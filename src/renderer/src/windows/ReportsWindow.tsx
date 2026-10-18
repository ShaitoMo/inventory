import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import InfoHint from '@/components/InfoHint'
import type { IpcData } from '@/lib/ipc-types'
import {
  compareMonths,
  currentYearMonth,
  formatMonth,
  parseMonthValue,
  shiftMonth,
  toMonthValue,
  type YearMonth
} from '@/lib/month'

type MonthlyReport = IpcData<typeof window.api.reports.monthly>

const INFO_TEXT =
  'Stock movement summary for one month, one table per category. Opening is the quantity at the ' +
  'start of the month, In/Out are stock received and removed, Adjust is the net of recounts ' +
  '(+/-), and Closing is the quantity at the end of the month. Months are in your local time ' +
  'and future months are not available. Untick "Show items with no movements" to hide items ' +
  'that had no stock movement that month. Export asks whether to include every item or only ' +
  'items with movements, and writes an Excel workbook with one sheet per category to the ' +
  'reports folder (change it in Settings).'

// Fixed column widths keep Opening/In/Out/Adjust/Closing lined up from one category's table to
// the next; Item takes whatever is left and truncates.
const COLUMN_WIDTHS = ['', 'w-20', 'w-20', 'w-16', 'w-16', 'w-[4.5rem]', 'w-20']
const NUMBER_CELL = 'py-1.5 text-right tabular-nums'

function formatAdjust(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

type LoadResult = { request: LoadRequest; report: MonthlyReport | null; error: string | null }
type ExportState = { month: string; path: string | null; error: string | null }
// A fresh object per load - changing the month or hitting refresh creates a new one, which
// re-runs the effect and lets `loading` be derived by comparing it with the last result.
type LoadRequest = { period: YearMonth; showIdle: boolean }

function ReportsWindow(): React.JSX.Element {
  const [request, setRequest] = useState<LoadRequest>(() => ({
    period: currentYearMonth(),
    showIdle: true
  }))
  const [loaded, setLoaded] = useState<LoadResult | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportState, setExportState] = useState<ExportState | null>(null)

  const { period, showIdle } = request
  const month = toMonthValue(period)
  // Reports are for months that have started; the window can stay open across a month change,
  // so this is recomputed on every render rather than captured once.
  const latest = currentYearMonth()
  const atLatest = compareMonths(period, latest) >= 0
  const loading = loaded?.request !== request
  const report = loaded?.report ?? null
  const loadError = loading ? null : (loaded?.error ?? null)
  // Only show the outcome of an export for the month on screen.
  const currentExport = exportState?.month === month ? exportState : null

  const categoryOptions = useMemo(
    () =>
      (report?.categories ?? []).map((category) => ({
        value: String(category.categoryId),
        label: category.categoryName
      })),
    [report]
  )
  // A category with no items in the chosen month isn't in the report, so a leftover filter falls
  // back to all categories instead of showing nothing under an empty-looking picker.
  const activeFilter = categoryOptions.some((option) => option.value === categoryFilter)
    ? categoryFilter
    : ''
  const visibleCategories = useMemo(
    () =>
      (report?.categories ?? []).filter(
        (category) => !activeFilter || String(category.categoryId) === activeFilter
      ),
    [report, activeFilter]
  )

  useEffect(() => {
    let cancelled = false
    const filters = { ...request.period, onlyWithMovements: !request.showIdle }
    window.api.reports.monthly(filters).then((result) => {
      if (cancelled) return
      setLoaded({
        request,
        report: result.ok ? result.data : null,
        error: result.ok ? null : result.error.message
      })
    })
    return () => {
      cancelled = true
    }
  }, [request])

  // The choice comes from the export prompt, not from the on-screen toggle.
  async function handleExport(onlyWithMovements: boolean): Promise<void> {
    setExporting(true)
    try {
      const result = await window.api.reports.exportMonthly({ ...period, onlyWithMovements })
      setExportState(
        result.ok
          ? { month, path: result.data.filePath, error: null }
          : { month, path: null, error: result.error.message }
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    // Native controls (calendar icon, scrollbars, checkbox) otherwise stay light in dark mode.
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3 [:root.dark_&]:[color-scheme:dark]">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-month">Month</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setRequest((r) => ({ ...r, period: shiftMonth(r.period, -1) }))}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              id="report-month"
              type="month"
              value={month}
              max={toMonthValue(latest)}
              onChange={(event) => {
                const next = parseMonthValue(event.target.value)
                // Typing past the picker's max still fires a change - ignore it, and React
                // puts the previous month back.
                if (next && compareMonths(next, currentYearMonth()) <= 0) {
                  setRequest((r) => ({ ...r, period: next }))
                }
              }}
              className="w-40"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() =>
                setRequest((r) =>
                  compareMonths(r.period, currentYearMonth()) >= 0
                    ? r
                    : { ...r, period: shiftMonth(r.period, 1) }
                )
              }
              disabled={atLatest}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-category">Category</Label>
          <Combobox
            id="report-category"
            options={categoryOptions}
            value={activeFilter}
            onChange={setCategoryFilter}
            placeholder="All categories"
            className="w-44"
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => setExportDialogOpen(true)}
            disabled={loading || exporting || !report}
          >
            {exporting ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <FileSpreadsheet className="size-4" />
                Export (.xlsx)
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setRequest((r) => ({ ...r }))}
            aria-label="Refresh report"
          >
            <RefreshCw className="size-4" />
          </Button>
          <InfoHint text={INFO_TEXT} />
        </div>
      </div>
      <Label htmlFor="report-show-idle" className="w-fit cursor-pointer gap-2 font-normal">
        <input
          id="report-show-idle"
          type="checkbox"
          checked={showIdle}
          onChange={(event) => setRequest((r) => ({ ...r, showIdle: event.target.checked }))}
          className="size-4 accent-primary"
        />
        Show items with no movements
      </Label>
      {(loadError ?? currentExport?.error) && (
        <p className="text-sm text-destructive">{loadError ?? currentExport?.error}</p>
      )}
      {currentExport?.path && (
        <p className="text-sm break-all text-muted-foreground">Saved to {currentExport.path}</p>
      )}
      <div className="flex-1 overflow-auto select-text">
        {loading ? (
          <p className="p-3 text-center text-sm text-muted-foreground">Loading…</p>
        ) : visibleCategories.length === 0 ? (
          <p className="p-3 text-center text-sm text-muted-foreground">
            {loadError
              ? 'No report to show.'
              : showIdle
                ? `No items to report for ${formatMonth(period)}.`
                : `No items had movements in ${formatMonth(period)}.`}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {visibleCategories.map((category) => (
              <section key={category.categoryId} className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">{category.categoryName}</h2>
                <div className="overflow-auto rounded-md border border-border">
                  <Table className="min-w-[560px] table-fixed">
                    <colgroup>
                      {COLUMN_WIDTHS.map((width, index) => (
                        <col key={index} className={width} />
                      ))}
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right">In</TableHead>
                        <TableHead className="text-right">Out</TableHead>
                        <TableHead className="text-right">Adjust</TableHead>
                        <TableHead className="text-right">Closing</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {category.items.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell className="truncate py-1.5 font-medium" title={item.name}>
                            {item.name}
                          </TableCell>
                          <TableCell className="truncate py-1.5 text-muted-foreground">
                            {item.unit}
                          </TableCell>
                          <TableCell className={NUMBER_CELL}>{item.opening}</TableCell>
                          <TableCell className={NUMBER_CELL}>{item.in}</TableCell>
                          <TableCell className={NUMBER_CELL}>{item.out}</TableCell>
                          <TableCell className={NUMBER_CELL}>{formatAdjust(item.adjust)}</TableCell>
                          <TableCell className={NUMBER_CELL}>{item.closing}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="py-1.5">
                          Total
                        </TableCell>
                        <TableCell className={NUMBER_CELL}>{category.totals.opening}</TableCell>
                        <TableCell className={NUMBER_CELL}>{category.totals.in}</TableCell>
                        <TableCell className={NUMBER_CELL}>{category.totals.out}</TableCell>
                        <TableCell className={NUMBER_CELL}>
                          {formatAdjust(category.totals.adjust)}
                        </TableCell>
                        <TableCell className={NUMBER_CELL}>{category.totals.closing}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      <AlertDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        {/* Three buttons don't fit the default max-w-sm. */}
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Export {formatMonth(period)}</AlertDialogTitle>
            <AlertDialogDescription>
              Include every item, or only the items that had movements this month?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap pt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleExport(true)}>
              Only items with movements
            </AlertDialogAction>
            <AlertDialogAction onClick={() => void handleExport(false)}>Everything</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ReportsWindow
