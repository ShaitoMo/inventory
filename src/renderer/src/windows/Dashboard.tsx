import { useEffect, useState } from 'react'

interface DashboardStats {
  itemCount: number
  categoryCount: number
  lowStockCount: number
}

function StatCard({
  label,
  value
}: {
  label: string
  value: number | undefined
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value ?? '—'}</div>
    </div>
  )
}

function Dashboard(): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      const [items, categories, lowStock] = await Promise.all([
        window.api.items.list({ pageSize: 1 }),
        window.api.categories.list(),
        window.api.items.lowStock()
      ])
      if (cancelled) return
      setStats({
        itemCount: items.ok ? items.data.total : 0,
        categoryCount: categories.ok ? categories.data.length : 0,
        lowStockCount: lowStock.ok ? lowStock.data.length : 0
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Items" value={stats?.itemCount} />
        <StatCard label="Categories" value={stats?.categoryCount} />
        <StatCard label="Low stock" value={stats?.lowStockCount} />
      </div>
    </div>
  )
}

export default Dashboard
