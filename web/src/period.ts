import { formatDate, pad2 } from './format'

export type PeriodKind = '7' | '30' | 'custom'

export interface Period {
  kind: PeriodKind
  /** yyyy-mm-dd, значимо только для kind === 'custom' */
  from: string
  to: string
}

export interface DateRange {
  /** начало первого дня периода */
  from: Date
  /** начало дня, следующего за последним (в диапазон не входит) */
  to: Date
  fromIso: string
  toIso: string
}

export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/** Date → yyyy-mm-dd для <input type="date"> */
export function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** yyyy-mm-dd → локальная дата этого дня (или null, если строка битая) */
export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

export function createPeriod(kind: '7' | '30' = '7', now = new Date()): Period {
  return { kind, from: formatDateInput(now), to: formatDateInput(now) }
}

/** Период → границы для API; произвольный диапазон включает весь день `to`. */
export function resolveRange(period: Period, now = new Date()): DateRange | null {
  let from: Date
  let to: Date

  if (period.kind === 'custom') {
    const first = parseDateInput(period.from)
    const last = parseDateInput(period.to)
    if (!first || !last || first > last) return null
    from = startOfDay(first)
    to = startOfDay(last)
    to.setDate(to.getDate() + 1)
  } else {
    const days = period.kind === '7' ? 7 : 30
    to = startOfDay(now)
    to.setDate(to.getDate() + 1)
    from = startOfDay(now)
    from.setDate(from.getDate() - (days - 1))
  }

  return { from, to, fromIso: from.toISOString(), toIso: to.toISOString() }
}

export function periodLabel(range: DateRange | null): string {
  if (!range) return 'не выбран'
  const last = new Date(range.to)
  last.setDate(last.getDate() - 1)
  return `${formatDate(range.from)} — ${formatDate(last)}`
}
