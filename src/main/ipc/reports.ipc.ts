import { Db } from '../db/types'
import * as reportsService from '../services/reports.service'
import { IPC_CHANNELS } from '../../shared/ipc'
import { protectedHandle } from './handle'
import { loadSettings } from './settings.ipc'

export function registerReportsIpcHandlers(db: Db): void {
  protectedHandle(IPC_CHANNELS.reports.monthly, (_user, filters: reportsService.MonthlyReportFilters) =>
    reportsService.getMonthlyReport(db, filters)
  )

  protectedHandle(
    IPC_CHANNELS.reports.exportMonthly,
    async (_user, filters: reportsService.MonthlyReportFilters) => {
      const settings = await loadSettings()
      return reportsService.exportMonthlyReport(db, settings.reportsFolder, filters)
    }
  )
}
